import { NextRequest, NextResponse } from 'next/server';
import { getPluginBySlug } from '@/lib/plugin-registry';

// ============================================================
// Types
// ============================================================

interface PluginEntity {
  id: string;
  type: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  [key: string]: unknown;
}

// ============================================================
// Mock entity data generators
// ============================================================

// Generates contextual mock data based on plugin slug and entity type
function generateMockEntities(
  pluginSlug: string,
  entityType: string,
  limit: number = 20
): PluginEntity[] {
  const entities: PluginEntity[] = [];

  // Known entity templates per plugin type
  const TEMPLATES: Record<string, Record<string, string[][]>> = {
    'crm-contacts': {
      contacts: [
        ['name', 'email', 'phone', 'company', 'status'],
        ['Alice Johnson', 'alice@acme.com', '+1-555-0101', 'Acme Corp', 'active'],
        ['Bob Martinez', 'bob@startup.io', '+1-555-0102', 'StartupXYZ', 'lead'],
        ['Carol Wei', 'carol@global.co', '+1-555-0103', 'GlobalTech', 'customer'],
        ['David Kim', 'david@innovate.dev', '+1-555-0104', 'Innovate Labs', 'prospect'],
        ['Emma Davis', 'emma@bluechip.com', '+1-555-0105', 'BlueChip Inc', 'active'],
        ['Frank Zhang', 'frank@nexus.ai', '+1-555-0106', 'Nexus AI', 'lead'],
        ['Grace Lee', 'grace@omega.co', '+1-555-0107', 'Omega Systems', 'active'],
        ['Henry Patel', 'henry@vertex.io', '+1-555-0108', 'Vertex Solutions', 'inactive'],
      ],
    },
    'crm-companies': {
      companies: [
        ['name', 'industry', 'website', 'employees', 'revenue'],
        ['Acme Corp', 'Technology', 'acme.com', '250', '$5.2M'],
        ['GlobalTech', 'Enterprise Software', 'globaltech.com', '1200', '$48M'],
        ['StartupXYZ', 'AI/ML', 'startupxyz.io', '45', '$2.1M'],
        ['BlueChip Inc', 'Finance', 'bluechip.com', '5000', '$220M'],
        ['Nexus AI', 'Artificial Intelligence', 'nexus.ai', '120', '$8.5M'],
      ],
    },
    'crm-deals': {
      deals: [
        ['name', 'stage', 'value', 'company', 'closeDate'],
        ['Enterprise License', 'Negotiation', '$120,000', 'GlobalTech', '2025-03-15'],
        ['SaaS Migration', 'Proposal', '$85,000', 'Acme Corp', '2025-04-01'],
        ['AI Integration', 'Discovery', '$45,000', 'Nexus AI', '2025-05-20'],
        ['Platform Upgrade', 'Closed Won', '$200,000', 'BlueChip Inc', '2025-01-30'],
        ['Consulting Package', 'Qualification', '$35,000', 'Omega Systems', '2025-06-10'],
      ],
    },
    'crm-tasks': {
      tasks: [
        ['title', 'priority', 'status', 'assignee', 'dueDate'],
        ['Follow up with Alice', 'High', 'pending', 'Grace Lee', '2025-02-10'],
        ['Prepare proposal for Acme', 'High', 'in_progress', 'Frank Zhang', '2025-02-12'],
        ['Update CRM records', 'Medium', 'completed', 'Emma Davis', '2025-02-08'],
        ['Schedule demo with Nexus', 'High', 'pending', 'Bob Martinez', '2025-02-14'],
        ['Send contract to BlueChip', 'Critical', 'in_progress', 'Carol Wei', '2025-02-11'],
      ],
    },
    'erp-finance': {
      transactions: [
        ['description', 'type', 'amount', 'account', 'date'],
        ['Monthly Revenue', 'income', '$48,200', 'Operating Account', '2025-02-01'],
        ['Server Hosting', 'expense', '$2,400', 'Operating Account', '2025-02-03'],
        ['Client Payment - Acme', 'income', '$15,000', 'Operating Account', '2025-02-05'],
        ['Payroll', 'expense', '$32,500', 'Payroll Account', '2025-02-01'],
        ['Software Licenses', 'expense', '$1,800', 'Operating Account', '2025-02-07'],
      ],
    },
    'erp-inventory': {
      products: [
        ['name', 'sku', 'category', 'stock', 'price'],
        ['Enterprise Server License', 'ENT-001', 'Software', '∞', '$999/yr'],
        ['Pro Subscription', 'PRO-002', 'SaaS', '∞', '$49/mo'],
        ['API Calls Pack', 'API-100', 'Add-on', '∞', '$0.01/call'],
        ['Support Package', 'SUP-010', 'Service', '∞', '$299/mo'],
        ['Training Module', 'TRN-005', 'Education', '∞', '$1,500'],
      ],
    },
    'hr-employees': {
      employees: [
        ['name', 'department', 'role', 'status', 'startDate'],
        ['Grace Lee', 'Engineering', 'Senior Developer', 'active', '2023-01-15'],
        ['Frank Zhang', 'Engineering', 'Tech Lead', 'active', '2022-06-01'],
        ['Emma Davis', 'Sales', 'Account Executive', 'active', '2023-09-10'],
        ['Bob Martinez', 'Marketing', 'Growth Manager', 'active', '2024-02-20'],
        ['Carol Wei', 'Product', 'Product Manager', 'on_leave', '2022-11-01'],
      ],
    },
    'hr-leave': {
      requests: [
        ['employee', 'type', 'startDate', 'endDate', 'status'],
        ['Grace Lee', 'Vacation', '2025-03-10', '2025-03-14', 'approved'],
        ['Frank Zhang', 'Sick Leave', '2025-02-20', '2025-02-20', 'approved'],
        ['Emma Davis', 'Remote Work', '2025-02-15', '2025-02-28', 'pending'],
        ['Bob Martinez', 'Vacation', '2025-04-01', '2025-04-05', 'pending'],
      ],
    },
    'sup-tickets': {
      tickets: [
        ['subject', 'priority', 'status', 'requester', 'createdAt'],
        ['Cannot export contacts', 'High', 'open', 'Alice Johnson', '2025-02-08'],
        ['Login issues on mobile', 'Critical', 'in_progress', 'David Kim', '2025-02-09'],
        ['Feature request: bulk edit', 'Low', 'open', 'Bob Martinez', '2025-02-10'],
        ['Invoice discrepancy', 'High', 'resolved', 'Carol Wei', '2025-02-06'],
        ['API rate limit reached', 'Medium', 'in_progress', 'Henry Patel', '2025-02-11'],
      ],
    },
    'mkt-campaigns': {
      campaigns: [
        ['name', 'channel', 'status', 'budget', 'reach'],
        ['Spring Launch 2025', 'Email + Social', 'active', '$25,000', '45,200'],
        ['Product Demo Series', 'Webinar', 'planned', '$8,000', '—'],
        ['Partner Co-Marketing', 'Content', 'active', '$12,000', '22,800'],
        ['Brand Awareness Q1', 'Display Ads', 'completed', '$18,000', '89,500'],
      ],
    },
    'proj-kanban': {
      tasks: [
        ['title', 'status', 'priority', 'assignee', 'board'],
        ['Redesign dashboard', 'In Progress', 'High', 'Grace Lee', 'Product'],
        ['API v2 endpoints', 'Todo', 'Critical', 'Frank Zhang', 'Backend'],
        ['User onboarding flow', 'Review', 'Medium', 'Emma Davis', 'Product'],
        ['Database migration', 'Done', 'High', 'Bob Martinez', 'Backend'],
        ['Mobile responsive fixes', 'In Progress', 'Medium', 'Carol Wei', 'Frontend'],
      ],
    },
    'proj-sprints': {
      sprints: [
        ['name', 'status', 'startDate', 'endDate', 'points'],
        ['Sprint 24', 'active', '2025-02-03', '2025-02-14', '42'],
        ['Sprint 23', 'completed', '2025-01-20', '2025-01-31', '38'],
        ['Sprint 25', 'planned', '2025-02-17', '2025-02-28', '—'],
      ],
    },
    'eco-catalog': {
      products: [
        ['name', 'category', 'price', 'stock', 'status'],
        ['Enterprise Server License', 'Software', '$999/yr', '∞', 'active'],
        ['Pro Subscription', 'SaaS', '$49/mo', '∞', 'active'],
        ['Starter Bundle', 'Package', '$149/yr', '∞', 'active'],
        ['Custom Integration', 'Service', 'Custom', '—', 'draft'],
      ],
    },
    'eco-payments': {
      transactions: [
        ['id_ref', 'amount', 'method', 'status', 'date'],
        ['TXN-00124', '$999.00', 'Credit Card', 'completed', '2025-02-10'],
        ['TXN-00125', '$49.00', 'PayPal', 'completed', '2025-02-10'],
        ['TXN-00126', '$149.00', 'Wire Transfer', 'pending', '2025-02-11'],
        ['TXN-00127', '$2,400.00', 'Credit Card', 'failed', '2025-02-11'],
      ],
    },
  };

  // Look up template data
  const pluginTemplates = TEMPLATES[pluginSlug];
  const entityTemplate = pluginTemplates?.[entityType];

  if (entityTemplate && entityTemplate.length > 1) {
    const fields = entityTemplate[0]; // column names
    const rows = entityTemplate.slice(1); // data rows

    for (let i = 0; i < Math.min(rows.length, limit); i++) {
      const entity: PluginEntity = {
        id: `${pluginSlug}-${entityType}-${String(i + 1).padStart(4, '0')}`,
        type: entityType,
        name: rows[i][0],
        status: rows[i].includes('completed') || rows[i].includes('active')
          ? rows[i][rows[i].length - 2] || 'active'
          : rows[i][rows[i].length - 2] || 'active',
        createdAt: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
      };

      // Add each field from template
      for (let f = 0; f < fields.length && f < rows[i].length; f++) {
        entity[fields[f]] = rows[i][f];
      }

      entities.push(entity);
    }
  } else {
    // Generic mock data for unknown plugin/entity combos
    for (let i = 0; i < Math.min(limit, 8); i++) {
      entities.push({
        id: `${pluginSlug}-${entityType}-${String(i + 1).padStart(4, '0')}`,
        type: entityType,
        name: `${entityType.charAt(0).toUpperCase() + entityType.slice(1)} #${i + 1}`,
        status: ['active', 'pending', 'completed'][i % 3],
        description: `Sample ${entityType} record for ${pluginSlug}`,
        createdAt: new Date(Date.now() - Math.random() * 30 * 86400000).toISOString(),
        updatedAt: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
      });
    }
  }

  return entities;
}

// Derive entity types from a plugin slug using mock manifest data
function getEntityTypesForPlugin(pluginSlug: string): string[][] {
  const ENTITY_MAP: Record<string, string[][]> = {
    'crm-contacts': [['contacts', 'Users']],
    'crm-companies': [['companies', 'Building2']],
    'crm-deals': [['deals', 'DollarSign']],
    'crm-tasks': [['tasks', 'CheckSquare']],
    'crm-activities': [['activities', 'Activity']],
    'crm-notes': [['notes', 'StickyNote']],
    'crm-calendar': [['events', 'Calendar']],
    'crm-email': [['emails', 'Mail']],
    'crm-pipeline': [['deals', 'GitBranch']],
    'erp-finance': [['transactions', 'Landmark'], ['accounts', 'Wallet']],
    'erp-accounting': [['journal_entries', 'Calculator'], ['accounts', 'BookOpen']],
    'erp-inventory': [['products', 'Package'], ['warehouses', 'Warehouse']],
    'erp-tax': [['filings', 'Receipt']],
    'erp-procurement': [['orders', 'Truck'], ['vendors', 'Building']],
    'hr-employees': [['employees', 'UserCog'], ['departments', 'Layout']],
    'hr-payroll': [['payslips', 'Wallet']],
    'hr-leave': [['requests', 'CalendarOff']],
    'hr-recruitment': [['positions', 'UserPlus'], ['applications', 'FileText']],
    'sup-tickets': [['tickets', 'Headphones']],
    'sup-chat': [['conversations', 'MessageSquare']],
    'sup-knowledge-base': [['articles', 'BookOpen']],
    'mkt-campaigns': [['campaigns', 'Megaphone']],
    'mkt-email-marketing': [['campaigns', 'Mail']],
    'proj-kanban': [['tasks', 'Columns3'], ['boards', 'LayoutGrid']],
    'proj-gantt': [['projects', 'GanttChart'], ['milestones', 'Flag']],
    'proj-sprints': [['sprints', 'Zap'], ['backlog', 'ListTodo']],
    'eco-catalog': [['products', 'ShoppingBag']],
    'eco-cart': [['carts', 'ShoppingCart']],
    'eco-payments': [['transactions', 'CreditCard']],
  };

  return ENTITY_MAP[pluginSlug] || [[pluginSlug.replace(/^[^-]+-/, '') || 'items', 'Box']];
}

// ============================================================
// Route handler
// ============================================================

type RouteContext = {
  params: Promise<{ slug: string }>;
};

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;
    const { searchParams } = new URL(request.url);

    const entityType = searchParams.get('type') || 'default';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Verify plugin exists
    const plugin = await getPluginBySlug(slug);
    if (!plugin) {
      return NextResponse.json(
        { error: `Plugin "${slug}" not found` },
        { status: 404 }
      );
    }

    // Generate entity data
    const allEntities = generateMockEntities(slug, entityType, limit + offset);
    const paginatedEntities = allEntities.slice(offset, offset + limit);

    // Get entity types for this plugin
    const entityTypes = getEntityTypesForPlugin(slug);

    // Build stats from entities
    const statusCounts: Record<string, number> = {};
    for (const entity of allEntities) {
      const s = entity.status || 'unknown';
      statusCounts[s] = (statusCounts[s] || 0) + 1;
    }

    return NextResponse.json({
      plugin: {
        id: plugin.id,
        name: plugin.name,
        slug: plugin.slug,
        description: plugin.description,
        version: plugin.version,
        status: plugin.status,
        icon: slug.split('-')[0], // prefix like 'crm', 'erp', etc.
      },
      entities: paginatedEntities,
      entityType,
      entityTypes,
      stats: {
        total: allEntities.length,
        byStatus: statusCounts,
      },
      pagination: {
        total: allEntities.length,
        limit,
        offset,
        hasMore: offset + limit < allEntities.length,
      },
    });
  } catch (error) {
    console.error(`[GET /api/plugins/${(await context.params).slug}/entities] Error:`, error);
    return NextResponse.json(
      { error: 'Failed to fetch plugin entities' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { slug } = await context.params;
    const body = await request.json();
    const { type = 'default', ...data } = body;

    // Verify plugin exists
    const plugin = await getPluginBySlug(slug);
    if (!plugin) {
      return NextResponse.json(
        { error: `Plugin "${slug}" not found` },
        { status: 404 }
      );
    }

    // Simulate creating an entity (mock)
    const newEntity: PluginEntity = {
      id: `${slug}-${type}-${Date.now()}`,
      type,
      name: data.name || `New ${type.slice(0, -1) || 'Item'}`,
      status: data.status || 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...data,
    };

    return NextResponse.json(
      {
        entity: newEntity,
        message: `Entity created in plugin "${slug}"`,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(`[POST /api/plugins/${(await context.params).slug}/entities] Error:`, error);
    return NextResponse.json(
      { error: 'Failed to create entity' },
      { status: 500 }
    );
  }
}
