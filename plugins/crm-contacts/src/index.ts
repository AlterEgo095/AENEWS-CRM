// ============================================================
// AENEWS CRM Contacts Plugin — Server Entry
// ============================================================
// This is the main entry point for the CRM Contacts plugin.
// It uses definePlugin() from the AENEWS Plugin SDK to register
// the plugin with the core system.
//
// Build: bun build src/index.ts --outdir dist --format esm
// ============================================================

import { definePlugin } from '../../../src/core/plugin-sdk';
import type {
  PluginContext,
  PluginRequest,
  PluginResponse,
  SearchResult,
} from '../../../src/core/plugin-sdk';
import manifest from '../plugin.json';

// ── Route handler implementations ──────────────────────────

async function listContacts(_req: PluginRequest, ctx: PluginContext): Promise<PluginResponse> {
  // In a real implementation, this queries the database with tenant isolation
  ctx.logger.info('Listing contacts', { tenantId: ctx.tenantId });
  return {
    status: 200,
    body: {
      success: true,
      contacts: [],
      total: 0,
    },
  };
}

async function getContact(req: PluginRequest, ctx: PluginContext): Promise<PluginResponse> {
  const id = req.path.split('/').pop();
  ctx.logger.info('Getting contact', { id, tenantId: ctx.tenantId });
  return {
    status: 200,
    body: {
      success: true,
      contact: null,
    },
  };
}

async function createContact(req: PluginRequest, ctx: PluginContext): Promise<PluginResponse> {
  const body = req.body as Record<string, unknown>;
  ctx.logger.info('Creating contact', { body, tenantId: ctx.tenantId });

  // Emit event for other plugins to react to
  await ctx.eventBus.emit('contact.created', {
    id: `contact_${Date.now()}`,
    firstName: body.firstName,
    lastName: body.lastName,
    email: body.email,
    company: body.company,
    createdBy: req.userId,
    tenantId: ctx.tenantId,
  });

  return {
    status: 201,
    body: {
      success: true,
      contact: {
        id: `contact_${Date.now()}`,
        ...body,
        createdAt: new Date().toISOString(),
      },
    },
  };
}

async function updateContact(req: PluginRequest, ctx: PluginContext): Promise<PluginResponse> {
  const id = req.path.split('/').pop();
  const body = req.body as Record<string, unknown>;
  ctx.logger.info('Updating contact', { id, body, tenantId: ctx.tenantId });

  await ctx.eventBus.emit('contact.updated', {
    id,
    changedFields: Object.keys(body),
    updatedBy: req.userId,
    tenantId: ctx.tenantId,
    ...body,
  });

  return {
    status: 200,
    body: {
      success: true,
      contact: { id, ...body, updatedAt: new Date().toISOString() },
    },
  };
}

async function deleteContact(req: PluginRequest, ctx: PluginContext): Promise<PluginResponse> {
  const id = req.path.split('/').pop();
  ctx.logger.info('Deleting contact', { id, tenantId: ctx.tenantId });

  await ctx.eventBus.emit('contact.deleted', {
    id,
    deletedBy: req.userId,
    tenantId: ctx.tenantId,
  });

  return {
    status: 200,
    body: {
      success: true,
      message: 'Contact deleted',
    },
  };
}

// ── Plugin definition ───────────────────────────────────────

export default definePlugin({
  manifest,

  // ── Lifecycle Hooks ──────────────────────────────────────

  onInstall: async (ctx) => {
    ctx.logger.info('CRM Contacts plugin installing...');

    // Migrations are run automatically by the core before onInstall fires.
    // Use this hook for seed data, default configurations, etc.

    const defaultTags = (ctx.settings['default_tags'] as string[]) || ['new'];
    ctx.logger.info('Default tags configured:', defaultTags);
  },

  onActivate: async (ctx) => {
    ctx.logger.info('CRM Contacts plugin activated');

    // Register event listeners for consumed events
    ctx.eventBus.on('company.created', async (payload) => {
      ctx.logger.debug('Company created — updating contact references', payload);
    });

    ctx.eventBus.on('company.updated', async (payload) => {
      ctx.logger.debug('Company updated — refreshing contact company info', payload);
    });
  },

  onDeactivate: async (ctx) => {
    ctx.logger.info('CRM Contacts plugin deactivated');
  },

  onUninstall: async (ctx) => {
    ctx.logger.info('CRM Contacts plugin uninstalling — cleaning up data...');
  },

  // ── AI Tools ──────────────────────────────────────────────

  tools: {
    create_contact: {
      description: 'Create a new contact in the CRM. Requires first and last name. Email, phone, company, and title are optional.',
      parameters: {
        type: 'object',
        properties: {
          firstName: {
            type: 'string',
            description: 'First name of the contact',
          },
          lastName: {
            type: 'string',
            description: 'Last name of the contact',
          },
          email: {
            type: 'string',
            description: 'Email address (optional but recommended)',
          },
          phone: {
            type: 'string',
            description: 'Phone number',
          },
          company: {
            type: 'string',
            description: 'Company or organization name',
          },
          title: {
            type: 'string',
            description: 'Job title or role',
          },
        },
        required: ['firstName', 'lastName'],
      },
      execute: async (params, ctx) => {
        const contactId = `contact_${Date.now()}`;

        // Emit event for cross-plugin integration
        await ctx.eventBus.emit('contact.created', {
          id: contactId,
          firstName: params.firstName,
          lastName: params.lastName,
          email: (params as Record<string, unknown>).email,
          company: (params as Record<string, unknown>).company,
          createdBy: 'ai-assistant',
          tenantId: ctx.tenantId,
        });

        ctx.logger.info('Contact created via AI tool', { contactId });

        return {
          success: true,
          contact: {
            id: contactId,
            ...params,
            status: 'active',
            createdAt: new Date().toISOString(),
          },
        };
      },
    },

    search_contacts: {
      description: 'Search CRM contacts by name, email, phone, or company. Returns a list of matching contacts.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — matches against name, email, phone, and company',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 20)',
            default: 20,
            minimum: 1,
            maximum: 100,
          },
        },
        required: ['query'],
      },
      execute: async (params, ctx) => {
        ctx.logger.info('Searching contacts', {
          query: params.query,
          limit: params.limit,
          tenantId: ctx.tenantId,
        });

        // In a real implementation, this would query the database:
        // const contacts = await ctx.db.plugin_crm_contacts.findMany({
        //   where: {
        //     tenantId: ctx.tenantId,
        //     OR: [
        //       { firstName: { contains: params.query } },
        //       { lastName: { contains: params.query } },
        //       { email: { contains: params.query } },
        //       { company: { contains: params.query } },
        //     ],
        //   },
        //   take: params.limit || 20,
        // });

        return {
          success: true,
          contacts: [],
          total: 0,
          query: params.query,
        };
      },
    },

    get_contact: {
      description: 'Get detailed information about a specific contact by ID.',
      parameters: {
        type: 'object',
        properties: {
          contactId: {
            type: 'string',
            description: 'The unique ID of the contact to retrieve',
          },
        },
        required: ['contactId'],
      },
      execute: async (params, ctx) => {
        ctx.logger.info('Getting contact by ID', {
          contactId: params.contactId,
          tenantId: ctx.tenantId,
        });

        return {
          success: true,
          contact: null,
        };
      },
    },
  },

  // ── Event Handlers ────────────────────────────────────────

  events: {
    'contact.created': {
      handler: async (payload, ctx) => {
        ctx.logger.info('Contact created — sending notification', payload);

        // Auto-notify the team about new contacts
        await ctx.eventBus.emit('notification.send', {
          type: 'info',
          title: 'New Contact Added',
          message: `A new contact "${(payload as Record<string, string>).firstName} ${(payload as Record<string, string>).lastName}" has been added to the CRM.`,
          category: 'crm',
          actionUrl: `/crm/contacts/${(payload as Record<string, string>).id}`,
          tenantId: ctx.tenantId,
        });
      },
    },

    'contact.updated': {
      handler: async (payload, ctx) => {
        ctx.logger.info('Contact updated', payload);
        // Could trigger workflows, audit logging, or sync with external services
      },
    },

    'contact.deleted': {
      handler: async (payload, ctx) => {
        ctx.logger.warn('Contact deleted', payload);
        // Audit log, cleanup related records, etc.
      },
    },
  },

  // ── API Routes ─────────────────────────────────────────────

  routes: [
    { method: 'GET', path: '/contacts', handler: listContacts, permissions: ['crm.contacts.read'] },
    { method: 'GET', path: '/contacts/:id', handler: getContact, permissions: ['crm.contacts.read'] },
    { method: 'POST', path: '/contacts', handler: createContact, permissions: ['crm.contacts.write'] },
    { method: 'PUT', path: '/contacts/:id', handler: updateContact, permissions: ['crm.contacts.write'] },
    { method: 'DELETE', path: '/contacts/:id', handler: deleteContact, permissions: ['crm.contacts.write'] },
  ],

  // ── Search Handler ────────────────────────────────────────

  search: {
    search: async (query: string, ctx: PluginContext): Promise<SearchResult[]> => {
      ctx.logger.debug('Global search for contacts', { query });

      // In a real implementation:
      // const contacts = await ctx.db.plugin_crm_contacts.findMany({
      //   where: {
      //     tenantId: ctx.tenantId,
      //     OR: [
      //       { firstName: { contains: query } },
      //       { lastName: { contains: query } },
      //       { email: { contains: query } },
      //       { company: { contains: query } },
      //     ],
      //   },
      //   take: 5,
      // });
      //
      // return contacts.map(c => ({
      //   type: 'contact',
      //   id: c.id,
      //   title: `${c.firstName} ${c.lastName}`,
      //   description: c.company || c.email || 'No additional info',
      //   href: `/crm/contacts/${c.id}`,
      //   metadata: { email: c.email, company: c.company, status: c.status },
      // }));

      return [];
    },
  },

  // ── Permission Checker (optional override) ────────────────

  checkPermission: async (userId: string, permission: string): Promise<boolean> => {
    // In a real implementation, check against the user's role/permissions store
    // For now, allow all permissions (override for demo purposes)
    return true;
  },
});
