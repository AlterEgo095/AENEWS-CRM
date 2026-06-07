// ============================================================
// AENEWS Enterprise OS — Platform Bootstrap
// ============================================================
// Initializes all core engines and wires the CRM plugin
// as a proof-of-concept that exercises EVERY engine.
//
// This file is imported by API routes to ensure all registries
// are populated before any request is handled.
//
// Validation criterion:
//   "Si ce premier plugin fonctionne sans aucune modification
//    du Core, alors tu auras validé l'architecture"
// ============================================================

import { getToolRegistry } from '@/core/tool-registry';
import { getCapabilityRegistry } from '@/core/capability-registry';
import { getUIRegistry } from '@/core/ui-registry';
import { getAgentRegistry } from '@/core/agent-registry';
import { getKnowledgeRegistry } from '@/core/knowledge-registry';
import { getSchemaRegistry } from '@/core/schema-registry';
import { eventBus, EVENT_TYPES } from '@/lib/event-bus';
import { db } from '@/lib/db';

// Default tenant used until multi-tenant auth is wired
const DEFAULT_TENANT_ID = 'default';

// ============================================================
// Bootstrap State
// ============================================================

let _bootstrapped = false;

export function isBootstrapped(): boolean {
  return _bootstrapped;
}

// ============================================================
// Main Bootstrap Function
// ============================================================

export async function bootstrapPlatform(): Promise<void> {
  if (_bootstrapped) return;

  console.log('[Bootstrap] Initializing AENEWS Enterprise OS platform...');

  // Step 1: Initialize Tool Registry
  const toolRegistry = getToolRegistry();

  // Step 2: Initialize Capability Registry
  const capabilityRegistry = getCapabilityRegistry();

  // Step 3: Initialize UI Registry
  const uiRegistry = getUIRegistry();

  // Step 4: Initialize Agent Registry
  const agentRegistry = getAgentRegistry();

  // Step 5: Initialize Knowledge Registry
  const knowledgeRegistry = getKnowledgeRegistry();

  // Step 6: Initialize Schema Registry
  const schemaRegistry = getSchemaRegistry();

  // ==========================================================
  // Register CRM Plugin — Proof of Concept
  // This exercises ALL engines WITHOUT modifying Core code
  // ==========================================================

  const CRM_PLUGIN_ID = 'aenews-crm-contacts';

  // ── Tool Registry: Register AI-callable tools ──────────

  toolRegistry.register(CRM_PLUGIN_ID, 'create_contact', {
    description: 'Create a new CRM contact. Requires firstName and lastName. Email, phone, company, and title are optional.',
    parameters: {
      type: 'object',
      properties: {
        firstName: { type: 'string', description: 'First name' },
        lastName: { type: 'string', description: 'Last name' },
        email: { type: 'string', description: 'Email address' },
        phone: { type: 'string', description: 'Phone number' },
        company: { type: 'string', description: 'Company name' },
        title: { type: 'string', description: 'Job title' },
      },
      required: ['firstName', 'lastName'],
    },
    execute: async (params: Record<string, unknown>) => {
      const contact = await db.crmContact.create({
        data: {
          tenantId: DEFAULT_TENANT_ID,
          firstName: String(params.firstName || ''),
          lastName: String(params.lastName || ''),
          email: params.email ? String(params.email) : null,
          phone: params.phone ? String(params.phone) : null,
          company: params.company ? String(params.company) : null,
          title: params.title ? String(params.title) : null,
          tags: '[]',
          metadata: '{}',
        },
      });
      await eventBus.emit('contact.created', {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        email: contact.email,
        company: contact.company,
        source: contact.source,
      });
      return { success: true, contactId: contact.id, ...params };
    },
    permissions: ['crm.contacts.write'],
    rateLimit: { maxRequests: 100, windowMs: 60000 },
    version: '1.0.0',
  });

  toolRegistry.register(CRM_PLUGIN_ID, 'search_contacts', {
    description: 'Search CRM contacts by name, email, phone, or company.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results', default: 20, minimum: 1, maximum: 100 },
      },
      required: ['query'],
    },
    execute: async (params: Record<string, unknown>) => {
      const q = String(params.query || '');
      const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
      const where: Record<string, unknown> = { tenantId: DEFAULT_TENANT_ID };
      if (q) {
        where.OR = [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { email: { contains: q } },
          { company: { contains: q } },
        ];
      }
      const contacts = await db.crmContact.findMany({ where, take: limit, orderBy: { createdAt: 'desc' } });
      const total = await db.crmContact.count({ where });
      return {
        success: true,
        query: q,
        contacts: contacts.map((c) => ({
          id: c.id, firstName: c.firstName, lastName: c.lastName,
          email: c.email, phone: c.phone, company: c.company,
          title: c.title, status: c.status, source: c.source,
        })),
        total,
      };
    },
    permissions: ['crm.contacts.read'],
    cache: { enabled: true, ttl: 30000 },
    version: '1.0.0',
  });

  toolRegistry.register(CRM_PLUGIN_ID, 'get_contact', {
    description: 'Get detailed info about a specific contact by ID.',
    parameters: {
      type: 'object',
      properties: {
        contactId: { type: 'string', description: 'Contact ID' },
      },
      required: ['contactId'],
    },
    execute: async (params: Record<string, unknown>) => {
      const contact = await db.crmContact.findUnique({ where: { id: String(params.contactId), tenantId: DEFAULT_TENANT_ID } });
      if (!contact) return { success: false, error: 'Contact not found' };
      return {
        success: true,
        contact: {
          id: contact.id, firstName: contact.firstName, lastName: contact.lastName,
          email: contact.email, phone: contact.phone, company: contact.company,
          title: contact.title, status: contact.status,
          tags: (() => { try { return JSON.parse(contact.tags); } catch { return []; } })(),
          notes: contact.notes, source: contact.source,
          createdAt: contact.createdAt, updatedAt: contact.updatedAt,
        },
      };
    },
    permissions: ['crm.contacts.read'],
    version: '1.0.0',
  });

  // ── Capability Registry: Register capabilities ──────────

  capabilityRegistry.register({
    id: 'crm.contacts.search',
    pluginId: CRM_PLUGIN_ID,
    type: 'search',
    name: 'Search Contacts',
    description: 'Search contacts by name, email, phone, or company',
    inputSchema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
    handler: async (input) => {
      const q = input.query || '';
      const where: Record<string, unknown> = { tenantId: DEFAULT_TENANT_ID };
      if (q) {
        where.OR = [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { email: { contains: q } },
          { company: { contains: q } },
        ];
      }
      const contacts = await db.crmContact.findMany({ where, take: 50, orderBy: { createdAt: 'desc' } });
      const total = await db.crmContact.count({ where });
      return {
        results: contacts.map((c) => ({
          id: c.id, firstName: c.firstName, lastName: c.lastName,
          email: c.email, company: c.company, status: c.status,
        })),
        total,
      };
    },
    version: '1.0.0',
    tags: ['crm', 'contacts', 'search'],
  });

  capabilityRegistry.register({
    id: 'crm.contacts.create',
    pluginId: CRM_PLUGIN_ID,
    type: 'create',
    name: 'Create Contact',
    description: 'Create a new contact in the CRM',
    inputSchema: {
      type: 'object',
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        company: { type: 'string' },
        title: { type: 'string' },
      },
      required: ['firstName', 'lastName'],
    },
    handler: async (input) => {
      const contact = await db.crmContact.create({
        data: {
          tenantId: DEFAULT_TENANT_ID,
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email || null,
          phone: input.phone || null,
          company: input.company || null,
          title: input.title || null,
          tags: '[]',
          metadata: '{}',
        },
      });
      await eventBus.emit('contact.created', { id: contact.id, ...input });
      return { id: contact.id, firstName: contact.firstName, lastName: contact.lastName };
    },
    version: '1.0.0',
    tags: ['crm', 'contacts', 'create'],
  });

  capabilityRegistry.register({
    id: 'crm.contacts.read',
    pluginId: CRM_PLUGIN_ID,
    type: 'read',
    name: 'Read Contact',
    description: 'Read a contact by ID',
    inputSchema: { type: 'object', properties: { contactId: { type: 'string' } }, required: ['contactId'] },
    handler: async (input) => {
      const contact = await db.crmContact.findUnique({ where: { id: input.contactId, tenantId: DEFAULT_TENANT_ID } });
      if (!contact) return { contact: null, error: 'Contact not found' };
      return {
        contact: {
          id: contact.id, firstName: contact.firstName, lastName: contact.lastName,
          email: contact.email, phone: contact.phone, company: contact.company,
          title: contact.title, status: contact.status,
          tags: (() => { try { return JSON.parse(contact.tags); } catch { return []; } })(),
          notes: contact.notes, source: contact.source,
          createdAt: contact.createdAt, updatedAt: contact.updatedAt,
        },
      };
    },
    version: '1.0.0',
    tags: ['crm', 'contacts', 'read'],
  });

  capabilityRegistry.register({
    id: 'crm.contacts.update',
    pluginId: CRM_PLUGIN_ID,
    type: 'update',
    name: 'Update Contact',
    description: 'Update an existing contact',
    inputSchema: {
      type: 'object',
      properties: { contactId: { type: 'string' }, data: { type: 'object' } },
      required: ['contactId', 'data'],
    },
    handler: async (input) => {
      const { contactId, data } = input;
      const existing = await db.crmContact.findUnique({ where: { id: contactId, tenantId: DEFAULT_TENANT_ID } });
      if (!existing) return { success: false, error: 'Contact not found' };
      const updateData: Record<string, unknown> = {};
      if (data.firstName !== undefined) updateData.firstName = data.firstName;
      if (data.lastName !== undefined) updateData.lastName = data.lastName;
      if (data.email !== undefined) updateData.email = data.email || null;
      if (data.phone !== undefined) updateData.phone = data.phone || null;
      if (data.company !== undefined) updateData.company = data.company || null;
      if (data.title !== undefined) updateData.title = data.title || null;
      if (data.status !== undefined) updateData.status = data.status;
      if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
      if (data.notes !== undefined) updateData.notes = data.notes || null;
      const updated = await db.crmContact.update({ where: { id: contactId }, data: updateData });
      await eventBus.emit('contact.updated', { id: updated.id, changes: Object.keys(updateData) });
      return { success: true, contactId };
    },
    version: '1.0.0',
    tags: ['crm', 'contacts', 'update'],
  });

  capabilityRegistry.register({
    id: 'crm.contacts.delete',
    pluginId: CRM_PLUGIN_ID,
    type: 'delete',
    name: 'Delete Contact',
    description: 'Delete a contact permanently',
    inputSchema: { type: 'object', properties: { contactId: { type: 'string' } }, required: ['contactId'] },
    handler: async (input) => {
      const existing = await db.crmContact.findUnique({ where: { id: input.contactId, tenantId: DEFAULT_TENANT_ID } });
      if (!existing) return { success: false, error: 'Contact not found' };
      await db.crmContact.delete({ where: { id: input.contactId } });
      await eventBus.emit('contact.deleted', { id: existing.id, firstName: existing.firstName, lastName: existing.lastName });
      return { success: true, deletedId: input.contactId };
    },
    version: '1.0.0',
    tags: ['crm', 'contacts', 'delete'],
  });

  capabilityRegistry.register({
    id: 'crm.contacts.analyze',
    pluginId: CRM_PLUGIN_ID,
    type: 'analyze',
    name: 'Analyze Contacts',
    description: 'AI-powered analysis of contact data',
    inputSchema: { type: 'object', properties: { analysisType: { type: 'string', enum: ['distribution', 'trends', 'summary'] } } },
    handler: async () => {
      const [statusGroups, total, recent] = await Promise.all([
        db.crmContact.groupBy({ by: ['status'], where: { tenantId: DEFAULT_TENANT_ID }, _count: true }),
        db.crmContact.count({ where: { tenantId: DEFAULT_TENANT_ID } }),
        db.crmContact.findMany({ where: { tenantId: DEFAULT_TENANT_ID }, orderBy: { createdAt: 'desc' }, take: 5 }),
      ]);
      return {
        analysis: {
          total,
          byStatus: statusGroups.map((g) => ({ status: g.status, count: g._count })),
          recent: recent.map((c) => ({ id: c.id, firstName: c.firstName, lastName: c.lastName, status: c.status, createdAt: c.createdAt })),
        },
      };
    },
    version: '1.0.0',
    tags: ['crm', 'contacts', 'analyze', 'ai'],
  });

  // ── UI Registry: Register UI extensions ──────────────────

  uiRegistry.registerSidebarItem({
    id: 'crm-contacts',
    pluginId: CRM_PLUGIN_ID,
    label: 'Contacts',
    icon: 'Users',
    section: 'CRM',
    order: 1,
    permission: 'crm.contacts.read',
  });

  uiRegistry.registerSidebarItem({
    id: 'crm-companies',
    pluginId: CRM_PLUGIN_ID,
    label: 'Companies',
    icon: 'Building2',
    section: 'CRM',
    order: 2,
    permission: 'crm.contacts.read',
  });

  uiRegistry.registerSidebarItem({
    id: 'crm-deals',
    pluginId: CRM_PLUGIN_ID,
    label: 'Deals',
    icon: 'Handshake',
    section: 'CRM',
    order: 3,
    permission: 'crm.contacts.read',
  });

  uiRegistry.registerSidebarItem({
    id: 'crm-tasks',
    pluginId: CRM_PLUGIN_ID,
    label: 'Tasks',
    icon: 'CheckSquare',
    section: 'CRM',
    order: 4,
    permission: 'crm.contacts.read',
  });

  uiRegistry.registerPage({
    id: 'crm-contacts-list',
    pluginId: CRM_PLUGIN_ID,
    path: '/crm/contacts',
    title: 'Contacts',
    icon: 'Users',
    permissions: ['crm.contacts.read'],
    order: 1,
  });

  uiRegistry.registerPage({
    id: 'crm-contacts-detail',
    pluginId: CRM_PLUGIN_ID,
    path: '/crm/contacts/:id',
    title: 'Contact Detail',
    icon: 'UserCircle',
    permissions: ['crm.contacts.read'],
    order: 2,
  });

  uiRegistry.registerDashboardCard({
    id: 'crm-total-contacts',
    pluginId: CRM_PLUGIN_ID,
    title: 'Total Contacts',
    description: 'Total number of contacts in the CRM',
    icon: 'Users',
    value: '0',
    trend: '+0%',
    href: '/crm/contacts',
    color: 'emerald',
    order: 1,
  });

  uiRegistry.registerDashboardCard({
    id: 'crm-recent-contacts',
    pluginId: CRM_PLUGIN_ID,
    title: 'New This Week',
    description: 'Contacts added this week',
    icon: 'UserPlus',
    value: '0',
    trend: '+0%',
    color: 'blue',
    order: 2,
  });

  uiRegistry.registerDashboardCard({
    id: 'crm-active-deals',
    pluginId: CRM_PLUGIN_ID,
    title: 'Active Deals',
    description: 'Deals currently in progress',
    icon: 'Handshake',
    value: '0',
    trend: '+0%',
    color: 'amber',
    order: 3,
  });

  uiRegistry.registerAction({
    id: 'crm-create-contact',
    pluginId: CRM_PLUGIN_ID,
    label: 'New Contact',
    icon: 'UserPlus',
    action: 'crm.contacts.create',
    shortcut: 'Ctrl+Shift+C',
    permission: 'crm.contacts.write',
    contexts: ['contact-list', 'dashboard'],
  });

  uiRegistry.registerCommand({
    id: 'crm-search-contacts',
    pluginId: CRM_PLUGIN_ID,
    label: 'Search Contacts',
    icon: 'Search',
    command: 'crm.contacts.search',
    shortcut: 'Ctrl+K',
    keywords: ['contact', 'find', 'search', 'crm'],
    permission: 'crm.contacts.read',
  });

  uiRegistry.registerCommand({
    id: 'crm-new-contact',
    pluginId: CRM_PLUGIN_ID,
    label: 'Create New Contact',
    icon: 'UserPlus',
    command: 'crm.contacts.create',
    shortcut: 'Ctrl+Shift+N',
    keywords: ['new', 'create', 'contact', 'add'],
    permission: 'crm.contacts.write',
  });

  // ── Agent Registry: Register CRM Agent ───────────────────

  agentRegistry.register({
    id: 'crm.contact-agent',
    pluginId: CRM_PLUGIN_ID,
    name: 'CRM Contact Agent',
    description: 'Specialized AI agent for managing CRM contacts. Can create, search, update, and analyze contacts.',
    category: 'crm',
    icon: 'UserCircle',
    systemPrompt: `You are AENEWS CRM Contact Agent. You help users manage their CRM contacts.
    You can create new contacts, search existing ones, update information, and provide analysis.
    Always be helpful and professional. Use the tools available to you to perform actions.`,
    tools: [
      `${CRM_PLUGIN_ID}:create_contact`,
      `${CRM_PLUGIN_ID}:search_contacts`,
      `${CRM_PLUGIN_ID}:get_contact`,
    ],
    capabilities: [
      'crm.contacts.search',
      'crm.contacts.create',
      'crm.contacts.read',
      'crm.contacts.update',
      'crm.contacts.analyze',
    ],
    knowledge: [
      'crm.knowledge.contact-best-practices',
      'crm.knowledge.privacy-policy',
    ],
    model: undefined,
    temperature: 0.3,
    permissions: ['crm.contacts.read'],
    tags: ['crm', 'contacts', 'agent'],
    version: '1.0.0',
  });

  // ── Knowledge Registry: Register CRM Knowledge ───────────

  knowledgeRegistry.register({
    id: 'crm.knowledge.contact-best-practices',
    pluginId: CRM_PLUGIN_ID,
    type: 'guide',
    title: 'Contact Management Best Practices',
    description: 'Guidelines for managing contacts in the CRM',
    content: `# Contact Management Best Practices

## Creating Contacts
- Always include first name, last name, and at least one contact method (email or phone)
- Use proper capitalization for names
- Add company information when available for better segmentation

## Data Quality
- Verify email addresses before adding contacts
- Keep phone numbers in international format (+XXX XXX XXX XXX)
- Regularly deduplicate the contact database

## Segmentation
- Use tags consistently for categorization
- Assign contacts to the correct company for B2B contexts
- Track contact source for attribution analysis`,
    tags: ['crm', 'contacts', 'best-practices', 'guide'],
    keywords: ['contact', 'create', 'manage', 'quality', 'segment'],
    category: 'crm',
    language: 'en',
    version: '1.0.0',
  });

  knowledgeRegistry.register({
    id: 'crm.knowledge.privacy-policy',
    pluginId: CRM_PLUGIN_ID,
    type: 'policy',
    title: 'CRM Data Privacy Policy',
    description: 'Privacy policy for handling contact data',
    content: `# CRM Data Privacy Policy

## Data Collection
- Only collect data necessary for business purposes
- Obtain explicit consent before storing personal information
- Record the source and purpose of each contact entry

## Data Access
- Contact data is tenant-isolated and never shared between tenants
- Access is controlled via RBAC permissions (crm.contacts.read, crm.contacts.write)
- All access is logged for audit purposes

## Data Retention
- Contacts can be permanently deleted via the delete capability
- Deletion events are stored in the Event Store for compliance
- GDPR "right to be forgotten" is supported via the delete operation`,
    tags: ['crm', 'privacy', 'policy', 'gdpr'],
    keywords: ['privacy', 'gdpr', 'data', 'consent', 'deletion'],
    category: 'crm',
    language: 'en',
    version: '1.0.0',
  });

  knowledgeRegistry.register({
    id: 'crm.knowledge.contact-faq',
    pluginId: CRM_PLUGIN_ID,
    type: 'faq',
    title: 'CRM Contacts FAQ',
    description: 'Frequently asked questions about contact management',
    content: `# Contact Management FAQ

## How do I add a new contact?
Use the "New Contact" button in the sidebar or use Ctrl+Shift+N. You can also ask the CRM Agent: "Create a contact for John Smith at ACME Corp".

## How do I search for contacts?
Use the search bar (Ctrl+K) and type a name, email, or company. The search checks all contact fields.

## Can I import contacts from a CSV?
Yes! Use the Import action in the Contacts list view. CSV files with headers matching the contact fields are supported.

## How do I merge duplicate contacts?
Select two or more contacts in the list view and click "Merge". The primary contact retains all data.

## What happens when I delete a contact?
The contact is permanently removed from the database. The deletion is logged in the audit trail and an event is emitted for workflow triggers.`,
    tags: ['crm', 'contacts', 'faq', 'help'],
    keywords: ['faq', 'help', 'import', 'merge', 'delete', 'search', 'create'],
    category: 'crm',
    language: 'en',
    version: '1.0.0',
  });

  // ── Schema Registry: Register Contact Object ────────────────

  schemaRegistry.register({
    id: 'crm.contact',
    pluginId: CRM_PLUGIN_ID,
    name: 'contact',
    namePlural: 'contacts',
    labelSingular: 'Contact',
    labelPlural: 'Contacts',
    icon: 'UserCircle',
    description: 'A person or entity in the CRM system',
    category: 'crm',
    tags: ['crm', 'contact', 'person'],
    permissions: {
      create: 'crm.contacts.write',
      read: 'crm.contacts.read',
      update: 'crm.contacts.write',
      delete: 'crm.contacts.write',
    },
    fields: [
      {
        name: 'firstName',
        label: 'First Name',
        type: 'string',
        required: true,
        searchable: true,
        showInList: true,
        showInDetail: true,
        order: 1,
      },
      {
        name: 'lastName',
        label: 'Last Name',
        type: 'string',
        required: true,
        searchable: true,
        showInList: true,
        showInDetail: true,
        order: 2,
      },
      {
        name: 'email',
        label: 'Email',
        type: 'email',
        searchable: true,
        showInList: true,
        showInDetail: true,
        validation: { unique: true },
        order: 3,
      },
      {
        name: 'phone',
        label: 'Phone',
        type: 'phone',
        searchable: true,
        showInList: false,
        showInDetail: true,
        order: 4,
      },
      {
        name: 'company',
        label: 'Company',
        type: 'string',
        searchable: true,
        showInList: true,
        showInDetail: true,
        order: 5,
      },
      {
        name: 'title',
        label: 'Job Title',
        type: 'string',
        searchable: false,
        showInList: false,
        showInDetail: true,
        order: 6,
      },
      {
        name: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        defaultValue: 'active',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
          { label: 'Lead', value: 'lead' },
          { label: 'Prospect', value: 'prospect' },
          { label: 'Customer', value: 'customer' },
        ],
        showInList: true,
        showInDetail: true,
        order: 7,
      },
      {
        name: 'tags',
        label: 'Tags',
        type: 'multiselect',
        options: [
          { label: 'VIP', value: 'vip' },
          { label: 'Partner', value: 'partner' },
          { label: 'Lead', value: 'lead' },
          { label: 'Customer', value: 'customer' },
        ],
        showInList: false,
        showInDetail: true,
        order: 8,
      },
      {
        name: 'notes',
        label: 'Notes',
        type: 'text',
        showInList: false,
        showInDetail: true,
        order: 9,
      },
      {
        name: 'lastContactAt',
        label: 'Last Contact',
        type: 'datetime',
        showInList: true,
        showInDetail: true,
        order: 10,
      },
      {
        name: 'source',
        label: 'Source',
        type: 'select',
        options: [
          { label: 'Manual', value: 'manual' },
          { label: 'Web Form', value: 'web' },
          { label: 'Import', value: 'import' },
          { label: 'API', value: 'api' },
          { label: 'Referral', value: 'referral' },
        ],
        showInList: false,
        showInDetail: true,
        order: 11,
      },
    ],
    indexes: [
      { name: 'idx_contact_name', fields: ['firstName', 'lastName'] },
      { name: 'idx_contact_email', fields: ['email'], unique: true },
      { name: 'idx_contact_company', fields: ['company'] },
      { name: 'idx_contact_status', fields: ['status'] },
    ],
  });

  // ── Emit bootstrap complete event ────────────────────────

  await eventBus.emit('platform.bootstrapped', {
    engines: {
      toolRegistry: true,
      capabilityRegistry: true,
      uiRegistry: true,
      agentRegistry: true,
      knowledgeRegistry: true,
      schemaRegistry: true,
      eventBus: true,
      eventStore: true,
      workflowEngine: true,
      builderEngine: true,
      aiGateway: true,
    },
    plugins: [CRM_PLUGIN_ID],
  });

  _bootstrapped = true;
  console.log('[Bootstrap] Platform initialized successfully. All engines active.');
}
