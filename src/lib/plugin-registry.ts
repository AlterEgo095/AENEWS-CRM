// ============================================================
// AENEWS Enterprise OS — Plugin Registry System
// Defines the full plugin catalog, interfaces, and query functions
// ============================================================

export interface PluginTool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface PluginDefinition {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  icon: string; // lucide icon name
  author: string;
  category:
    | 'crm'
    | 'erp'
    | 'hr'
    | 'finance'
    | 'stock'
    | 'healthcare'
    | 'pharmacy'
    | 'education'
    | 'realestate'
    | 'manufacturing'
    | 'marketing'
    | 'support'
    | 'project'
    | 'ecommerce'
    | 'other';
  status: 'available' | 'installed' | 'active' | 'disabled';
  capabilities: string[];
  tools?: PluginTool[];
}

export interface InstalledPlugin {
  pluginId: string;
  version: string;
  status: 'installed' | 'active' | 'disabled';
  settings: Record<string, unknown>;
  installedAt: string;
}

// ============================================================
// Full Plugin Catalog
// ============================================================

const pluginCatalog: PluginDefinition[] = [
  // ── CRM ──────────────────────────────────────────────────
  {
    id: 'crm-contacts',
    name: 'Contacts',
    slug: 'crm-contacts',
    description: 'Manage customer and lead contacts with full profile, history, tags, and communication tracking.',
    version: '1.0.0',
    icon: 'Users',
    author: 'AENEWS',
    category: 'crm',
    status: 'available',
    capabilities: ['contacts', 'leads', 'tags', 'import', 'export'],
    tools: [
      {
        name: 'create_contact',
        description: 'Create a new contact with name, email, phone, and optional fields.',
        parameters: {
          firstName: { type: 'string', required: true },
          lastName: { type: 'string', required: true },
          email: { type: 'string', required: false },
          phone: { type: 'string', required: false },
        },
      },
      {
        name: 'search_contacts',
        description: 'Search contacts by name, email, or tag.',
        parameters: {
          query: { type: 'string', required: true },
          limit: { type: 'number', required: false, default: 10 },
        },
      },
      {
        name: 'list_contacts',
        description: 'List all contacts with optional pagination and filters.',
        parameters: {
          page: { type: 'number', required: false, default: 1 },
          limit: { type: 'number', required: false, default: 20 },
        },
      },
    ],
  },
  {
    id: 'crm-companies',
    name: 'Companies',
    slug: 'crm-companies',
    description: 'Track companies and organizations with company profiles, industry, size, and key contacts.',
    version: '1.0.0',
    icon: 'Building2',
    author: 'AENEWS',
    category: 'crm',
    status: 'available',
    capabilities: ['companies', 'industries', 'company-contacts'],
    tools: [
      {
        name: 'create_company',
        description: 'Create a new company entry.',
        parameters: {
          name: { type: 'string', required: true },
          industry: { type: 'string', required: false },
          website: { type: 'string', required: false },
        },
      },
      {
        name: 'search_companies',
        description: 'Search companies by name or industry.',
        parameters: {
          query: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'crm-deals',
    name: 'Deals',
    slug: 'crm-deals',
    description: 'Track sales deals and opportunities through stages with value forecasting and win/loss analysis.',
    version: '1.0.0',
    icon: 'Handshake',
    author: 'AENEWS',
    category: 'crm',
    status: 'available',
    capabilities: ['deals', 'opportunities', 'forecasting'],
    tools: [
      {
        name: 'create_deal',
        description: 'Create a new deal with title, value, and stage.',
        parameters: {
          title: { type: 'string', required: true },
          value: { type: 'number', required: false },
          stage: { type: 'string', required: false },
          contactId: { type: 'string', required: false },
        },
      },
      {
        name: 'update_deal_stage',
        description: 'Move a deal to a new stage.',
        parameters: {
          dealId: { type: 'string', required: true },
          stage: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'crm-pipeline',
    name: 'Pipeline',
    slug: 'crm-pipeline',
    description: 'Visual sales pipeline management with drag-and-drop stages, conversion tracking, and bottleneck detection.',
    version: '1.0.0',
    icon: 'GitBranch',
    author: 'AENEWS',
    category: 'crm',
    status: 'available',
    capabilities: ['pipeline', 'stages', 'kanban', 'conversion'],
    tools: [
      {
        name: 'get_pipeline_summary',
        description: 'Get a summary of all deals across pipeline stages.',
        parameters: {},
      },
    ],
  },
  {
    id: 'crm-activities',
    name: 'Activities',
    slug: 'crm-activities',
    description: 'Log and track all customer-facing activities including calls, meetings, emails, and tasks.',
    version: '1.0.0',
    icon: 'Activity',
    author: 'AENEWS',
    category: 'crm',
    status: 'available',
    capabilities: ['activities', 'calls', 'meetings', 'logging'],
    tools: [
      {
        name: 'log_activity',
        description: 'Log a new activity (call, meeting, email).',
        parameters: {
          type: { type: 'string', required: true },
          subject: { type: 'string', required: true },
          contactId: { type: 'string', required: false },
          notes: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'crm-notes',
    name: 'Notes',
    slug: 'crm-notes',
    description: 'Rich notes and comments attached to contacts, companies, and deals for team collaboration.',
    version: '1.0.0',
    icon: 'StickyNote',
    author: 'AENEWS',
    category: 'crm',
    status: 'available',
    capabilities: ['notes', 'comments', 'collaboration'],
    tools: [
      {
        name: 'create_note',
        description: 'Create a note attached to a contact or deal.',
        parameters: {
          content: { type: 'string', required: true },
          entityType: { type: 'string', required: true },
          entityId: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'crm-tasks',
    name: 'Tasks',
    slug: 'crm-tasks',
    description: 'Task management for sales teams with priorities, due dates, assignments, and reminders.',
    version: '1.0.0',
    icon: 'CheckSquare',
    author: 'AENEWS',
    category: 'crm',
    status: 'available',
    capabilities: ['tasks', 'reminders', 'priorities', 'assignments'],
    tools: [
      {
        name: 'create_task',
        description: 'Create a new task with priority and due date.',
        parameters: {
          title: { type: 'string', required: true },
          priority: { type: 'string', required: false },
          dueDate: { type: 'string', required: false },
          assigneeId: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'crm-calendar',
    name: 'Calendar',
    slug: 'crm-calendar',
    description: 'Shared team calendar for scheduling meetings, calls, follow-ups, and deadlines.',
    version: '1.0.0',
    icon: 'CalendarDays',
    author: 'AENEWS',
    category: 'crm',
    status: 'available',
    capabilities: ['calendar', 'scheduling', 'events'],
    tools: [
      {
        name: 'create_event',
        description: 'Create a calendar event.',
        parameters: {
          title: { type: 'string', required: true },
          startAt: { type: 'string', required: true },
          endAt: { type: 'string', required: false },
          contactId: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'crm-email',
    name: 'Email',
    slug: 'crm-email',
    description: 'Email integration for tracking correspondence, templates, sequences, and mass mailings.',
    version: '1.0.0',
    icon: 'Mail',
    author: 'AENEWS',
    category: 'crm',
    status: 'available',
    capabilities: ['email', 'templates', 'sequences', 'tracking'],
    tools: [
      {
        name: 'send_email',
        description: 'Send an email to a contact.',
        parameters: {
          to: { type: 'string', required: true },
          subject: { type: 'string', required: true },
          body: { type: 'string', required: true },
        },
      },
    ],
  },

  // ── ERP ──────────────────────────────────────────────────
  {
    id: 'erp-finance',
    name: 'Finance',
    slug: 'erp-finance',
    description: 'Core financial management with general ledger, journal entries, and financial statements.',
    version: '1.0.0',
    icon: 'Landmark',
    author: 'AENEWS',
    category: 'erp',
    status: 'available',
    capabilities: ['finance', 'general-ledger', 'journal-entries'],
    tools: [
      {
        name: 'get_financial_summary',
        description: 'Get a summary of financial data for a period.',
        parameters: {
          period: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'erp-accounting',
    name: 'Accounting',
    slug: 'erp-accounting',
    description: 'Double-entry bookkeeping, chart of accounts, trial balance, and period closing.',
    version: '1.0.0',
    icon: 'Calculator',
    author: 'AENEWS',
    category: 'erp',
    status: 'available',
    capabilities: ['accounting', 'chart-of-accounts', 'trial-balance'],
    tools: [
      {
        name: 'get_trial_balance',
        description: 'Get the trial balance for the current period.',
        parameters: {},
      },
    ],
  },
  {
    id: 'erp-tax',
    name: 'Tax',
    slug: 'erp-tax',
    description: 'Tax management with automatic calculations, filing support, and compliance reporting.',
    version: '1.0.0',
    icon: 'Receipt',
    author: 'AENEWS',
    category: 'erp',
    status: 'available',
    capabilities: ['tax', 'filing', 'compliance', 'vat'],
    tools: [
      {
        name: 'calculate_tax',
        description: 'Calculate tax for a given amount and tax rate.',
        parameters: {
          amount: { type: 'number', required: true },
          taxRate: { type: 'number', required: true },
        },
      },
    ],
  },
  {
    id: 'erp-treasury',
    name: 'Treasury',
    slug: 'erp-treasury',
    description: 'Cash flow management, bank reconciliations, and treasury operations.',
    version: '1.0.0',
    icon: 'Vault',
    author: 'AENEWS',
    category: 'erp',
    status: 'available',
    capabilities: ['treasury', 'cash-flow', 'bank-reconciliation'],
    tools: [
      {
        name: 'get_cash_flow',
        description: 'Get cash flow summary for a period.',
        parameters: {
          startDate: { type: 'string', required: false },
          endDate: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'erp-inventory',
    name: 'Inventory',
    slug: 'erp-inventory',
    description: 'Inventory tracking with stock levels, locations, lot tracking, and valuation methods.',
    version: '1.0.0',
    icon: 'Package',
    author: 'AENEWS',
    category: 'erp',
    status: 'available',
    capabilities: ['inventory', 'stock-levels', 'lots', 'valuation'],
    tools: [
      {
        name: 'check_stock',
        description: 'Check current stock levels for a product.',
        parameters: {
          productId: { type: 'string', required: true },
        },
      },
      {
        name: 'adjust_stock',
        description: 'Adjust stock quantity for a product.',
        parameters: {
          productId: { type: 'string', required: true },
          quantity: { type: 'number', required: true },
          reason: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'erp-procurement',
    name: 'Procurement',
    slug: 'erp-procurement',
    description: 'Procurement lifecycle management from requisition to purchase order to goods receipt.',
    version: '1.0.0',
    icon: 'ShoppingCart',
    author: 'AENEWS',
    category: 'erp',
    status: 'available',
    capabilities: ['procurement', 'requisitions', 'purchase-orders', 'goods-receipt'],
    tools: [
      {
        name: 'create_purchase_requisition',
        description: 'Create a new purchase requisition.',
        parameters: {
          items: { type: 'array', required: true },
          requestedBy: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'erp-sales',
    name: 'Sales',
    slug: 'erp-sales',
    description: 'Sales order management, pricing, quotations, and order fulfillment tracking.',
    version: '1.0.0',
    icon: 'TrendingUp',
    author: 'AENEWS',
    category: 'erp',
    status: 'available',
    capabilities: ['sales-orders', 'pricing', 'quotations', 'fulfillment'],
    tools: [
      {
        name: 'create_sales_order',
        description: 'Create a new sales order.',
        parameters: {
          customerId: { type: 'string', required: true },
          items: { type: 'array', required: true },
        },
      },
    ],
  },
  {
    id: 'erp-purchasing',
    name: 'Purchasing',
    slug: 'erp-purchasing',
    description: 'Vendor management, supplier evaluation, RFQ processes, and cost optimization.',
    version: '1.0.0',
    icon: 'Truck',
    author: 'AENEWS',
    category: 'erp',
    status: 'available',
    capabilities: ['purchasing', 'vendors', 'rfq', 'cost-optimization'],
    tools: [
      {
        name: 'create_rfq',
        description: 'Create a request for quotation.',
        parameters: {
          title: { type: 'string', required: true },
          items: { type: 'array', required: true },
          vendorIds: { type: 'array', required: false },
        },
      },
    ],
  },
  {
    id: 'erp-production',
    name: 'Production',
    slug: 'erp-production',
    description: 'Production planning, BOM management, work orders, and manufacturing execution.',
    version: '1.0.0',
    icon: 'Factory',
    author: 'AENEWS',
    category: 'erp',
    status: 'available',
    capabilities: ['production', 'bom', 'work-orders', 'manufacturing'],
    tools: [
      {
        name: 'create_work_order',
        description: 'Create a production work order.',
        parameters: {
          productId: { type: 'string', required: true },
          quantity: { type: 'number', required: true },
          dueDate: { type: 'string', required: false },
        },
      },
    ],
  },

  // ── HR ───────────────────────────────────────────────────
  {
    id: 'hr-employees',
    name: 'Employees',
    slug: 'hr-employees',
    description: 'Complete employee profiles with personal info, employment history, documents, and onboarding.',
    version: '1.0.0',
    icon: 'UserCheck',
    author: 'AENEWS',
    category: 'hr',
    status: 'available',
    capabilities: ['employees', 'profiles', 'onboarding', 'documents'],
    tools: [
      {
        name: 'create_employee',
        description: 'Create a new employee record.',
        parameters: {
          firstName: { type: 'string', required: true },
          lastName: { type: 'string', required: true },
          email: { type: 'string', required: true },
          department: { type: 'string', required: false },
          position: { type: 'string', required: false },
        },
      },
      {
        name: 'search_employees',
        description: 'Search employees by name, department, or position.',
        parameters: {
          query: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'hr-payroll',
    name: 'Payroll',
    slug: 'hr-payroll',
    description: 'Salary processing, deductions, benefits, bonuses, payslip generation, and tax withholding.',
    version: '1.0.0',
    icon: 'Banknote',
    author: 'AENEWS',
    category: 'hr',
    status: 'available',
    capabilities: ['payroll', 'salary', 'deductions', 'payslips', 'benefits'],
    tools: [
      {
        name: 'run_payroll',
        description: 'Run payroll for a specific period.',
        parameters: {
          period: { type: 'string', required: true },
        },
      },
      {
        name: 'get_payslip',
        description: 'Get payslip details for an employee and period.',
        parameters: {
          employeeId: { type: 'string', required: true },
          period: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'hr-leave',
    name: 'Leave',
    slug: 'hr-leave',
    description: 'Leave management with request/approval workflows, balances, carry-over, and calendar views.',
    version: '1.0.0',
    icon: 'CalendarOff',
    author: 'AENEWS',
    category: 'hr',
    status: 'available',
    capabilities: ['leave', 'vacation', 'sick-leave', 'approval', 'balances'],
    tools: [
      {
        name: 'request_leave',
        description: 'Submit a leave request.',
        parameters: {
          employeeId: { type: 'string', required: true },
          type: { type: 'string', required: true },
          startDate: { type: 'string', required: true },
          endDate: { type: 'string', required: true },
          reason: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'hr-attendance',
    name: 'Attendance',
    slug: 'hr-attendance',
    description: 'Time tracking, clock-in/out, overtime calculation, and attendance reporting.',
    version: '1.0.0',
    icon: 'Clock',
    author: 'AENEWS',
    category: 'hr',
    status: 'available',
    capabilities: ['attendance', 'time-tracking', 'overtime', 'clock-in-out'],
    tools: [
      {
        name: 'clock_in',
        description: 'Clock in an employee.',
        parameters: {
          employeeId: { type: 'string', required: true },
        },
      },
      {
        name: 'clock_out',
        description: 'Clock out an employee.',
        parameters: {
          employeeId: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'hr-recruitment',
    name: 'Recruitment',
    slug: 'hr-recruitment',
    description: 'Full recruitment pipeline with job postings, applicants, interviews, and offer management.',
    version: '1.0.0',
    icon: 'UserPlus',
    author: 'AENEWS',
    category: 'hr',
    status: 'available',
    capabilities: ['recruitment', 'job-postings', 'applicants', 'interviews', 'offers'],
    tools: [
      {
        name: 'create_job_posting',
        description: 'Create a new job posting.',
        parameters: {
          title: { type: 'string', required: true },
          department: { type: 'string', required: false },
          description: { type: 'string', required: true },
        },
      },
      {
        name: 'add_applicant',
        description: 'Add an applicant to a job posting.',
        parameters: {
          jobPostingId: { type: 'string', required: true },
          firstName: { type: 'string', required: true },
          lastName: { type: 'string', required: true },
          email: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'hr-performance',
    name: 'Performance',
    slug: 'hr-performance',
    description: 'Performance reviews, goals/OKRs, 360-degree feedback, and competency tracking.',
    version: '1.0.0',
    icon: 'Target',
    author: 'AENEWS',
    category: 'hr',
    status: 'available',
    capabilities: ['performance', 'reviews', 'goals', 'okr', 'feedback'],
    tools: [
      {
        name: 'create_review',
        description: 'Create a performance review cycle.',
        parameters: {
          title: { type: 'string', required: true },
          period: { type: 'string', required: true },
          employeeIds: { type: 'array', required: true },
        },
      },
    ],
  },
  {
    id: 'hr-contracts',
    name: 'Contracts',
    slug: 'hr-contracts',
    description: 'Employment contract management with templates, e-signatures, renewals, and expiry alerts.',
    version: '1.0.0',
    icon: 'FileText',
    author: 'AENEWS',
    category: 'hr',
    status: 'available',
    capabilities: ['contracts', 'templates', 'e-signatures', 'renewals'],
    tools: [
      {
        name: 'create_contract',
        description: 'Create a new employment contract.',
        parameters: {
          employeeId: { type: 'string', required: true },
          type: { type: 'string', required: true },
          startDate: { type: 'string', required: true },
          endDate: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'hr-org-chart',
    name: 'Org Chart',
    slug: 'hr-org-chart',
    description: 'Interactive organizational chart with hierarchy visualization, departments, and reporting lines.',
    version: '1.0.0',
    icon: 'Network',
    author: 'AENEWS',
    category: 'hr',
    status: 'available',
    capabilities: ['org-chart', 'hierarchy', 'departments', 'reporting'],
    tools: [
      {
        name: 'get_org_chart',
        description: 'Get the full organizational chart.',
        parameters: {
          departmentId: { type: 'string', required: false },
        },
      },
    ],
  },

  // ── Finance ───────────────────────────────────────────────
  {
    id: 'finance-invoicing',
    name: 'Invoicing',
    slug: 'finance-invoicing',
    description: 'Create, send, and track invoices with automatic numbering, templates, and payment reminders.',
    version: '1.0.0',
    icon: 'FileSpreadsheet',
    author: 'AENEWS',
    category: 'finance',
    status: 'available',
    capabilities: ['invoicing', 'quotes', 'proformas', 'reminders'],
    tools: [
      {
        name: 'create_invoice',
        description: 'Create a new invoice.',
        parameters: {
          customerId: { type: 'string', required: true },
          items: { type: 'array', required: true },
          dueDate: { type: 'string', required: false },
        },
      },
      {
        name: 'send_invoice',
        description: 'Send an invoice to a customer.',
        parameters: {
          invoiceId: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'finance-expenses',
    name: 'Expenses',
    slug: 'finance-expenses',
    description: 'Expense tracking with receipt capture, approval workflows, categories, and policy enforcement.',
    version: '1.0.0',
    icon: 'CreditCard',
    author: 'AENEWS',
    category: 'finance',
    status: 'available',
    capabilities: ['expenses', 'receipts', 'approvals', 'policies'],
    tools: [
      {
        name: 'submit_expense',
        description: 'Submit an expense claim.',
        parameters: {
          amount: { type: 'number', required: true },
          category: { type: 'string', required: true },
          description: { type: 'string', required: true },
          date: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'finance-budget',
    name: 'Budget',
    slug: 'finance-budget',
    description: 'Budget planning, allocation, tracking, variance analysis, and forecasting.',
    version: '1.0.0',
    icon: 'PieChart',
    author: 'AENEWS',
    category: 'finance',
    status: 'available',
    capabilities: ['budget', 'planning', 'allocation', 'forecasting', 'variance'],
    tools: [
      {
        name: 'create_budget',
        description: 'Create a budget for a department or project.',
        parameters: {
          name: { type: 'string', required: true },
          amount: { type: 'number', required: true },
          period: { type: 'string', required: true },
        },
      },
      {
        name: 'get_budget_variance',
        description: 'Get budget vs actual variance report.',
        parameters: {
          budgetId: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'finance-reports',
    name: 'Reports',
    slug: 'finance-reports',
    description: 'Financial reporting with P&L, balance sheet, cash flow statement, and custom reports.',
    version: '1.0.0',
    icon: 'BarChart3',
    author: 'AENEWS',
    category: 'finance',
    status: 'available',
    capabilities: ['reports', 'profit-loss', 'balance-sheet', 'cash-flow'],
    tools: [
      {
        name: 'generate_report',
        description: 'Generate a financial report.',
        parameters: {
          type: { type: 'string', required: true },
          startDate: { type: 'string', required: false },
          endDate: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'finance-payments',
    name: 'Payments',
    slug: 'finance-payments',
    description: 'Payment processing, gateways integration, reconciliation, and multi-currency support.',
    version: '1.0.0',
    icon: 'Wallet',
    author: 'AENEWS',
    category: 'finance',
    status: 'available',
    capabilities: ['payments', 'gateways', 'reconciliation', 'multi-currency'],
    tools: [
      {
        name: 'process_payment',
        description: 'Process a payment.',
        parameters: {
          invoiceId: { type: 'string', required: true },
          amount: { type: 'number', required: true },
          method: { type: 'string', required: false },
        },
      },
    ],
  },

  // ── Stock ─────────────────────────────────────────────────
  {
    id: 'stock-warehouses',
    name: 'Warehouses',
    slug: 'stock-warehouses',
    description: 'Warehouse management with locations, zones, bins, capacity tracking, and warehouse maps.',
    version: '1.0.0',
    icon: 'Warehouse',
    author: 'AENEWS',
    category: 'stock',
    status: 'available',
    capabilities: ['warehouses', 'locations', 'zones', 'capacity'],
    tools: [
      {
        name: 'create_warehouse',
        description: 'Create a new warehouse.',
        parameters: {
          name: { type: 'string', required: true },
          address: { type: 'string', required: false },
          capacity: { type: 'number', required: false },
        },
      },
    ],
  },
  {
    id: 'stock-management',
    name: 'Stock Management',
    slug: 'stock-management',
    description: 'Real-time stock management with SKU tracking, serial numbers, batches, and stock movements.',
    version: '1.0.0',
    icon: 'PackageSearch',
    author: 'AENEWS',
    category: 'stock',
    status: 'available',
    capabilities: ['stock', 'sku', 'serial-numbers', 'batches', 'movements'],
    tools: [
      {
        name: 'get_stock_level',
        description: 'Get current stock level for a SKU.',
        parameters: {
          sku: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'stock-transfers',
    name: 'Transfers',
    slug: 'stock-transfers',
    description: 'Inter-warehouse and inter-location stock transfers with tracking and approval workflows.',
    version: '1.0.0',
    icon: 'ArrowRightLeft',
    author: 'AENEWS',
    category: 'stock',
    status: 'available',
    capabilities: ['transfers', 'inter-warehouse', 'approvals'],
    tools: [
      {
        name: 'create_transfer',
        description: 'Create a stock transfer between warehouses.',
        parameters: {
          fromWarehouseId: { type: 'string', required: true },
          toWarehouseId: { type: 'string', required: true },
          items: { type: 'array', required: true },
        },
      },
    ],
  },
  {
    id: 'stock-suppliers',
    name: 'Suppliers',
    slug: 'stock-suppliers',
    description: 'Supplier management with ratings, lead times, MOQ tracking, and supplier portal.',
    version: '1.0.0',
    icon: 'UsersRound',
    author: 'AENEWS',
    category: 'stock',
    status: 'available',
    capabilities: ['suppliers', 'ratings', 'lead-times', 'moq'],
    tools: [
      {
        name: 'create_supplier',
        description: 'Create a new supplier.',
        parameters: {
          name: { type: 'string', required: true },
          contactEmail: { type: 'string', required: false },
          phone: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'stock-purchase-orders',
    name: 'Purchase Orders',
    slug: 'stock-purchase-orders',
    description: 'Purchase order management from creation to receiving, with PO tracking and approval chains.',
    version: '1.0.0',
    icon: 'ClipboardList',
    author: 'AENEWS',
    category: 'stock',
    status: 'available',
    capabilities: ['purchase-orders', 'receiving', 'approvals', 'tracking'],
    tools: [
      {
        name: 'create_purchase_order',
        description: 'Create a new purchase order.',
        parameters: {
          supplierId: { type: 'string', required: true },
          items: { type: 'array', required: true },
          expectedDate: { type: 'string', required: false },
        },
      },
    ],
  },

  // ── Healthcare ───────────────────────────────────────────
  {
    id: 'healthcare-patients',
    name: 'Patients',
    slug: 'healthcare-patients',
    description: 'Patient records with demographics, medical history, allergies, insurance, and consent forms.',
    version: '1.0.0',
    icon: 'Heart',
    author: 'AENEWS',
    category: 'healthcare',
    status: 'available',
    capabilities: ['patients', 'records', 'demographics', 'medical-history'],
    tools: [
      {
        name: 'create_patient',
        description: 'Register a new patient.',
        parameters: {
          firstName: { type: 'string', required: true },
          lastName: { type: 'string', required: true },
          dateOfBirth: { type: 'string', required: true },
          gender: { type: 'string', required: false },
        },
      },
      {
        name: 'search_patients',
        description: 'Search patients by name or ID.',
        parameters: {
          query: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'healthcare-doctors',
    name: 'Doctors',
    slug: 'healthcare-doctors',
    description: 'Doctor profiles with specialties, schedules, availability, qualifications, and credentials.',
    version: '1.0.0',
    icon: 'Stethoscope',
    author: 'AENEWS',
    category: 'healthcare',
    status: 'available',
    capabilities: ['doctors', 'specialties', 'schedules', 'credentials'],
    tools: [
      {
        name: 'create_doctor',
        description: 'Register a new doctor.',
        parameters: {
          firstName: { type: 'string', required: true },
          lastName: { type: 'string', required: true },
          specialty: { type: 'string', required: true },
          licenseNumber: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'healthcare-consultations',
    name: 'Consultations',
    slug: 'healthcare-consultations',
    description: 'Consultation management with SOAP notes, diagnosis coding (ICD-10), treatment plans, and follow-ups.',
    version: '1.0.0',
    icon: 'MessageSquare',
    author: 'AENEWS',
    category: 'healthcare',
    status: 'available',
    capabilities: ['consultations', 'soap-notes', 'diagnosis', 'treatment-plans'],
    tools: [
      {
        name: 'create_consultation',
        description: 'Create a new consultation record.',
        parameters: {
          patientId: { type: 'string', required: true },
          doctorId: { type: 'string', required: true },
          chiefComplaint: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'healthcare-hospitalization',
    name: 'Hospitalization',
    slug: 'healthcare-hospitalization',
    description: 'Inpatient management with bed assignments, room tracking, admission/discharge workflows, and daily notes.',
    version: '1.0.0',
    icon: 'BedDouble',
    author: 'AENEWS',
    category: 'healthcare',
    status: 'available',
    capabilities: ['hospitalization', 'beds', 'admission', 'discharge'],
    tools: [
      {
        name: 'admit_patient',
        description: 'Admit a patient for hospitalization.',
        parameters: {
          patientId: { type: 'string', required: true },
          department: { type: 'string', required: true },
          bedId: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'healthcare-lab',
    name: 'Lab',
    slug: 'healthcare-lab',
    description: 'Laboratory management with test orders, specimen tracking, results entry, and reference ranges.',
    version: '1.0.0',
    icon: 'FlaskConical',
    author: 'AENEWS',
    category: 'healthcare',
    status: 'available',
    capabilities: ['lab', 'tests', 'specimens', 'results'],
    tools: [
      {
        name: 'order_lab_test',
        description: 'Order a laboratory test for a patient.',
        parameters: {
          patientId: { type: 'string', required: true },
          testType: { type: 'string', required: true },
          urgency: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'healthcare-radiology',
    name: 'Radiology',
    slug: 'healthcare-radiology',
    description: 'Radiology orders, imaging scheduling, DICOM viewer integration, and report management.',
    version: '1.0.0',
    icon: 'Scan',
    author: 'AENEWS',
    category: 'healthcare',
    status: 'available',
    capabilities: ['radiology', 'imaging', 'dicom', 'reports'],
    tools: [
      {
        name: 'order_imaging',
        description: 'Order an imaging study for a patient.',
        parameters: {
          patientId: { type: 'string', required: true },
          studyType: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'healthcare-prescriptions',
    name: 'Prescriptions',
    slug: 'healthcare-prescriptions',
    description: 'Electronic prescribing with drug databases, dosage checking, interaction alerts, and refill management.',
    version: '1.0.0',
    icon: 'Pill',
    author: 'AENEWS',
    category: 'healthcare',
    status: 'available',
    capabilities: ['prescriptions', 'e-prescribing', 'drug-database', 'interactions'],
    tools: [
      {
        name: 'create_prescription',
        description: 'Create a new prescription for a patient.',
        parameters: {
          patientId: { type: 'string', required: true },
          medication: { type: 'string', required: true },
          dosage: { type: 'string', required: true },
          frequency: { type: 'string', required: true },
          duration: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'healthcare-billing',
    name: 'Billing',
    slug: 'healthcare-billing',
    description: 'Medical billing with CPT/ICD coding, insurance claims, patient statements, and payment processing.',
    version: '1.0.0',
    icon: 'FileBadgeDollarSign',
    author: 'AENEWS',
    category: 'healthcare',
    status: 'available',
    capabilities: ['billing', 'coding', 'claims', 'insurance', 'statements'],
    tools: [
      {
        name: 'create_claim',
        description: 'Create an insurance claim for a service.',
        parameters: {
          patientId: { type: 'string', required: true },
          serviceDate: { type: 'string', required: true },
          cptCodes: { type: 'array', required: true },
        },
      },
    ],
  },
  {
    id: 'healthcare-appointments',
    name: 'Appointments',
    slug: 'healthcare-appointments',
    description: 'Appointment scheduling with online booking, waitlists, reminders, and doctor availability.',
    version: '1.0.0',
    icon: 'CalendarHeart',
    author: 'AENEWS',
    category: 'healthcare',
    status: 'available',
    capabilities: ['appointments', 'scheduling', 'booking', 'reminders'],
    tools: [
      {
        name: 'book_appointment',
        description: 'Book an appointment.',
        parameters: {
          patientId: { type: 'string', required: true },
          doctorId: { type: 'string', required: true },
          date: { type: 'string', required: true },
          timeSlot: { type: 'string', required: true },
        },
      },
    ],
  },

  // ── Pharmacy ─────────────────────────────────────────────
  {
    id: 'pharmacy-medicines',
    name: 'Medicines',
    slug: 'pharmacy-medicines',
    description: 'Medicine catalog with ATC coding, dosage forms, contraindications, and drug interaction database.',
    version: '1.0.0',
    icon: 'Tablets',
    author: 'AENEWS',
    category: 'pharmacy',
    status: 'available',
    capabilities: ['medicines', 'atc-codes', 'dosage-forms', 'interactions'],
    tools: [
      {
        name: 'add_medicine',
        description: 'Add a medicine to the catalog.',
        parameters: {
          name: { type: 'string', required: true },
          atcCode: { type: 'string', required: false },
          dosageForm: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'pharmacy-prescriptions',
    name: 'Prescriptions',
    slug: 'pharmacy-prescriptions',
    description: 'Prescription management with dispensing workflow, refill tracking, and verification.',
    version: '1.0.0',
    icon: 'ClipboardCheck',
    author: 'AENEWS',
    category: 'pharmacy',
    status: 'available',
    capabilities: ['prescriptions', 'dispensing', 'refills', 'verification'],
    tools: [
      {
        name: 'dispense_prescription',
        description: 'Dispense a prescription.',
        parameters: {
          prescriptionId: { type: 'string', required: true },
          pharmacistId: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'pharmacy-patients',
    name: 'Patients',
    slug: 'pharmacy-patients',
    description: 'Pharmacy patient profiles with medication history, allergies, and insurance coverage.',
    version: '1.0.0',
    icon: 'UserRound',
    author: 'AENEWS',
    category: 'pharmacy',
    status: 'available',
    capabilities: ['patients', 'medication-history', 'allergies', 'insurance'],
    tools: [
      {
        name: 'get_patient_medication_history',
        description: 'Get medication history for a pharmacy patient.',
        parameters: {
          patientId: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'pharmacy-stock',
    name: 'Stock',
    slug: 'pharmacy-stock',
    description: 'Pharmacy stock management with FIFO/FEFO dispensing, minimum stock alerts, and batch tracking.',
    version: '1.0.0',
    icon: 'PackageMinus',
    author: 'AENEWS',
    category: 'pharmacy',
    status: 'available',
    capabilities: ['stock', 'fifo-fefo', 'min-stock', 'batches'],
    tools: [
      {
        name: 'check_medicine_stock',
        description: 'Check stock level for a medicine.',
        parameters: {
          medicineId: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'pharmacy-purchases',
    name: 'Purchases',
    slug: 'pharmacy-purchases',
    description: 'Pharmacy purchasing from wholesalers with price comparison, order management, and GRN.',
    version: '1.0.0',
    icon: 'ShoppingBag',
    author: 'AENEWS',
    category: 'pharmacy',
    status: 'available',
    capabilities: ['purchases', 'wholesale', 'price-comparison', 'grn'],
    tools: [
      {
        name: 'create_purchase',
        description: 'Create a pharmacy purchase order.',
        parameters: {
          supplierId: { type: 'string', required: true },
          items: { type: 'array', required: true },
        },
      },
    ],
  },
  {
    id: 'pharmacy-expiry',
    name: 'Expiry',
    slug: 'pharmacy-expiry',
    description: 'Expiry date tracking with alerts, near-expiry reports, and return-to-vendor workflows.',
    version: '1.0.0',
    icon: 'AlarmClock',
    author: 'AENEWS',
    category: 'pharmacy',
    status: 'available',
    capabilities: ['expiry', 'alerts', 'near-expiry', 'returns'],
    tools: [
      {
        name: 'get_expiry_report',
        description: 'Get report of medicines nearing expiry.',
        parameters: {
          daysThreshold: { type: 'number', required: false, default: 90 },
        },
      },
    ],
  },
  {
    id: 'pharmacy-suppliers',
    name: 'Suppliers',
    slug: 'pharmacy-suppliers',
    description: 'Pharmaceutical supplier management with license verification, pricing agreements, and lead times.',
    version: '1.0.0',
    icon: 'TruckIcon',
    author: 'AENEWS',
    category: 'pharmacy',
    status: 'available',
    capabilities: ['suppliers', 'licenses', 'pricing', 'lead-times'],
    tools: [
      {
        name: 'add_supplier',
        description: 'Add a pharmaceutical supplier.',
        parameters: {
          name: { type: 'string', required: true },
          licenseNumber: { type: 'string', required: true },
          contactEmail: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'pharmacy-pos',
    name: 'POS',
    slug: 'pharmacy-pos',
    description: 'Pharmacy point-of-sale with barcode scanning, receipt printing, insurance co-pay, and daily closing.',
    version: '1.0.0',
    icon: 'MonitorSmartphone',
    author: 'AENEWS',
    category: 'pharmacy',
    status: 'available',
    capabilities: ['pos', 'barcode', 'receipts', 'co-pay', 'closing'],
    tools: [
      {
        name: 'process_sale',
        description: 'Process a pharmacy sale at POS.',
        parameters: {
          items: { type: 'array', required: true },
          patientId: { type: 'string', required: false },
          paymentMethod: { type: 'string', required: false },
        },
      },
    ],
  },

  // ── Education ──────────────────────────────────────────────
  {
    id: 'education-students',
    name: 'Students',
    slug: 'education-students',
    description: 'Student management with enrollment, profiles, academic history, and parent communication.',
    version: '1.0.0',
    icon: 'GraduationCap',
    author: 'AENEWS',
    category: 'education',
    status: 'available',
    capabilities: ['students', 'enrollment', 'profiles', 'academic-history'],
    tools: [
      {
        name: 'enroll_student',
        description: 'Enroll a new student.',
        parameters: {
          firstName: { type: 'string', required: true },
          lastName: { type: 'string', required: true },
          dateOfBirth: { type: 'string', required: true },
          grade: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'education-faculties',
    name: 'Faculties',
    slug: 'education-faculties',
    description: 'Faculty and department management with organizational structure and resource allocation.',
    version: '1.0.0',
    icon: 'School',
    author: 'AENEWS',
    category: 'education',
    status: 'available',
    capabilities: ['faculties', 'departments', 'resources'],
    tools: [
      {
        name: 'create_faculty',
        description: 'Create a new faculty/department.',
        parameters: {
          name: { type: 'string', required: true },
          headId: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'education-professors',
    name: 'Professors',
    slug: 'education-professors',
    description: 'Professor profiles with teaching assignments, office hours, research interests, and qualifications.',
    version: '1.0.0',
    icon: 'BookOpenCheck',
    author: 'AENEWS',
    category: 'education',
    status: 'available',
    capabilities: ['professors', 'teaching', 'office-hours', 'qualifications'],
    tools: [
      {
        name: 'add_professor',
        description: 'Add a new professor.',
        parameters: {
          firstName: { type: 'string', required: true },
          lastName: { type: 'string', required: true },
          department: { type: 'string', required: true },
          email: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'education-exams',
    name: 'Exams',
    slug: 'education-exams',
    description: 'Exam management with scheduling, hall allocation, invigilation duties, and exam papers.',
    version: '1.0.0',
    icon: 'ClipboardPen',
    author: 'AENEWS',
    category: 'education',
    status: 'available',
    capabilities: ['exams', 'scheduling', 'invigilation', 'papers'],
    tools: [
      {
        name: 'schedule_exam',
        description: 'Schedule an exam.',
        parameters: {
          courseId: { type: 'string', required: true },
          date: { type: 'string', required: true },
          hallId: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'education-grades',
    name: 'Grades',
    slug: 'education-grades',
    description: 'Grade management with GPA calculation, transcripts, grade reports, and analytics.',
    version: '1.0.0',
    icon: 'Award',
    author: 'AENEWS',
    category: 'education',
    status: 'available',
    capabilities: ['grades', 'gpa', 'transcripts', 'reports'],
    tools: [
      {
        name: 'input_grades',
        description: 'Input grades for a student in a course.',
        parameters: {
          studentId: { type: 'string', required: true },
          courseId: { type: 'string', required: true },
          grade: { type: 'string', required: true },
        },
      },
      {
        name: 'get_transcript',
        description: 'Get student transcript.',
        parameters: {
          studentId: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'education-attendance',
    name: 'Attendance',
    slug: 'education-attendance',
    description: 'Student and teacher attendance tracking with daily registers, absence alerts, and statistics.',
    version: '1.0.0',
    icon: 'UserCog',
    author: 'AENEWS',
    category: 'education',
    status: 'available',
    capabilities: ['attendance', 'registers', 'absence-alerts', 'statistics'],
    tools: [
      {
        name: 'mark_attendance',
        description: 'Mark attendance for a class session.',
        parameters: {
          courseId: { type: 'string', required: true },
          date: { type: 'string', required: true },
          records: { type: 'array', required: true },
        },
      },
    ],
  },
  {
    id: 'education-payments',
    name: 'Payments',
    slug: 'education-payments',
    description: 'Fee management with invoicing, payment tracking, scholarships, and installment plans.',
    version: '1.0.0',
    icon: 'MoneyBill',
    author: 'AENEWS',
    category: 'education',
    status: 'available',
    capabilities: ['fees', 'payments', 'scholarships', 'installments'],
    tools: [
      {
        name: 'generate_fee_invoice',
        description: 'Generate a fee invoice for a student.',
        parameters: {
          studentId: { type: 'string', required: true },
          feeType: { type: 'string', required: true },
          amount: { type: 'number', required: true },
        },
      },
    ],
  },
  {
    id: 'education-courses',
    name: 'Courses',
    slug: 'education-courses',
    description: 'Course catalog management with curriculum, syllabus, prerequisites, and credit hours.',
    version: '1.0.0',
    icon: 'BookMarked',
    author: 'AENEWS',
    category: 'education',
    status: 'available',
    capabilities: ['courses', 'curriculum', 'syllabus', 'credits'],
    tools: [
      {
        name: 'create_course',
        description: 'Create a new course.',
        parameters: {
          name: { type: 'string', required: true },
          code: { type: 'string', required: true },
          credits: { type: 'number', required: false },
          professorId: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'education-library',
    name: 'Library',
    slug: 'education-library',
    description: 'Library management with catalog, lending, returns, reservations, fines, and digital resources.',
    version: '1.0.0',
    icon: 'Library',
    author: 'AENEWS',
    category: 'education',
    status: 'available',
    capabilities: ['library', 'catalog', 'lending', 'reservations', 'fines'],
    tools: [
      {
        name: 'search_books',
        description: 'Search the library catalog.',
        parameters: {
          query: { type: 'string', required: true },
          limit: { type: 'number', required: false },
        },
      },
      {
        name: 'lend_book',
        description: 'Lend a book to a student.',
        parameters: {
          bookId: { type: 'string', required: true },
          studentId: { type: 'string', required: true },
          dueDate: { type: 'string', required: false },
        },
      },
    ],
  },

  // ── Real Estate ────────────────────────────────────────────
  {
    id: 'realestate-properties',
    name: 'Properties',
    slug: 'realestate-properties',
    description: 'Property listings with details, media gallery, virtual tours, features, and map integration.',
    version: '1.0.0',
    icon: 'Home',
    author: 'AENEWS',
    category: 'realestate',
    status: 'available',
    capabilities: ['properties', 'listings', 'media', 'virtual-tours'],
    tools: [
      {
        name: 'add_property',
        description: 'Add a new property listing.',
        parameters: {
          title: { type: 'string', required: true },
          type: { type: 'string', required: false },
          address: { type: 'string', required: true },
          price: { type: 'number', required: false },
        },
      },
    ],
  },
  {
    id: 'realestate-contracts',
    name: 'Contracts',
    slug: 'realestate-contracts',
    description: 'Lease and sale contract management with templates, e-signatures, renewals, and clauses.',
    version: '1.0.0',
    icon: 'FileSignature',
    author: 'AENEWS',
    category: 'realestate',
    status: 'available',
    capabilities: ['contracts', 'templates', 'e-signatures', 'renewals'],
    tools: [
      {
        name: 'create_contract',
        description: 'Create a real estate contract.',
        parameters: {
          propertyId: { type: 'string', required: true },
          type: { type: 'string', required: true },
          parties: { type: 'array', required: true },
        },
      },
    ],
  },
  {
    id: 'realestate-rentals',
    name: 'Rentals',
    slug: 'realestate-rentals',
    description: 'Rental management with tenant tracking, rent collection, lease terms, and rental analytics.',
    version: '1.0.0',
    icon: 'KeyRound',
    author: 'AENEWS',
    category: 'realestate',
    status: 'available',
    capabilities: ['rentals', 'tenants', 'rent-collection', 'analytics'],
    tools: [
      {
        name: 'create_rental',
        description: 'Create a rental listing for a property.',
        parameters: {
          propertyId: { type: 'string', required: true },
          rentAmount: { type: 'number', required: true },
          deposit: { type: 'number', required: false },
        },
      },
    ],
  },
  {
    id: 'realestate-payments',
    name: 'Payments',
    slug: 'realestate-payments',
    description: 'Property payment management for rent, deposits, fees, and automated payment reminders.',
    version: '1.0.0',
    icon: 'CircleDollarSign',
    author: 'AENEWS',
    category: 'realestate',
    status: 'available',
    capabilities: ['payments', 'rent', 'deposits', 'fees', 'reminders'],
    tools: [
      {
        name: 'record_payment',
        description: 'Record a property payment.',
        parameters: {
          rentalId: { type: 'string', required: true },
          amount: { type: 'number', required: true },
          type: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'realestate-owners',
    name: 'Owners',
    slug: 'realestate-owners',
    description: 'Property owner management with portfolios, revenue reports, and owner portals.',
    version: '1.0.0',
    icon: 'UserCircle',
    author: 'AENEWS',
    category: 'realestate',
    status: 'available',
    capabilities: ['owners', 'portfolios', 'revenue-reports'],
    tools: [
      {
        name: 'add_owner',
        description: 'Add a property owner.',
        parameters: {
          name: { type: 'string', required: true },
          contactEmail: { type: 'string', required: false },
          phone: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'realestate-tenants',
    name: 'Tenants',
    slug: 'realestate-tenants',
    description: 'Tenant management with screening, applications, background checks, and communication.',
    version: '1.0.0',
    icon: 'DoorOpen',
    author: 'AENEWS',
    category: 'realestate',
    status: 'available',
    capabilities: ['tenants', 'screening', 'applications', 'background-checks'],
    tools: [
      {
        name: 'register_tenant',
        description: 'Register a new tenant.',
        parameters: {
          firstName: { type: 'string', required: true },
          lastName: { type: 'string', required: true },
          email: { type: 'string', required: true },
          phone: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'realestate-visits',
    name: 'Visits',
    slug: 'realestate-visits',
    description: 'Property visit scheduling with calendar, notes, feedback, and conversion tracking.',
    version: '1.0.0',
    icon: 'Eye',
    author: 'AENEWS',
    category: 'realestate',
    status: 'available',
    capabilities: ['visits', 'scheduling', 'feedback', 'conversion'],
    tools: [
      {
        name: 'schedule_visit',
        description: 'Schedule a property visit.',
        parameters: {
          propertyId: { type: 'string', required: true },
          visitorName: { type: 'string', required: true },
          date: { type: 'string', required: true },
          time: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'realestate-maintenance',
    name: 'Maintenance',
    slug: 'realestate-maintenance',
    description: 'Property maintenance tracking with work orders, contractor management, and cost tracking.',
    version: '1.0.0',
    icon: 'Wrench',
    author: 'AENEWS',
    category: 'realestate',
    status: 'available',
    capabilities: ['maintenance', 'work-orders', 'contractors', 'costs'],
    tools: [
      {
        name: 'create_maintenance_request',
        description: 'Create a maintenance work order.',
        parameters: {
          propertyId: { type: 'string', required: true },
          title: { type: 'string', required: true },
          priority: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'realestate-agents',
    name: 'Agents',
    slug: 'realestate-agents',
    description: 'Real estate agent management with performance tracking, commissions, and territory assignment.',
    version: '1.0.0',
    icon: 'Briefcase',
    author: 'AENEWS',
    category: 'realestate',
    status: 'available',
    capabilities: ['agents', 'commissions', 'performance', 'territories'],
    tools: [
      {
        name: 'add_agent',
        description: 'Add a real estate agent.',
        parameters: {
          name: { type: 'string', required: true },
          email: { type: 'string', required: true },
          licenseNumber: { type: 'string', required: true },
        },
      },
    ],
  },

  // ── Manufacturing ────────────────────────────────────────
  {
    id: 'manufacturing-machines',
    name: 'Machines',
    slug: 'manufacturing-machines',
    description: 'Machine registry with specifications, maintenance schedules, downtime tracking, and OEE metrics.',
    version: '1.0.0',
    icon: 'Cog',
    author: 'AENEWS',
    category: 'manufacturing',
    status: 'available',
    capabilities: ['machines', 'specifications', 'maintenance', 'oee'],
    tools: [
      {
        name: 'register_machine',
        description: 'Register a new machine.',
        parameters: {
          name: { type: 'string', required: true },
          model: { type: 'string', required: false },
          serialNumber: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'manufacturing-production',
    name: 'Production',
    slug: 'manufacturing-production',
    description: 'Production management with work orders, routing, scheduling, and throughput monitoring.',
    version: '1.0.0',
    icon: 'CogIcon',
    author: 'AENEWS',
    category: 'manufacturing',
    status: 'available',
    capabilities: ['production', 'work-orders', 'routing', 'scheduling'],
    tools: [
      {
        name: 'start_production_run',
        description: 'Start a production run.',
        parameters: {
          productId: { type: 'string', required: true },
          quantity: { type: 'number', required: true },
          machineId: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'manufacturing-maintenance',
    name: 'Maintenance',
    slug: 'manufacturing-maintenance',
    description: 'Preventive and corrective maintenance with PM schedules, work orders, and spare parts management.',
    version: '1.0.0',
    icon: 'Settings',
    author: 'AENEWS',
    category: 'manufacturing',
    status: 'available',
    capabilities: ['maintenance', 'preventive', 'corrective', 'spare-parts'],
    tools: [
      {
        name: 'schedule_maintenance',
        description: 'Schedule preventive maintenance.',
        parameters: {
          machineId: { type: 'string', required: true },
          type: { type: 'string', required: true },
          scheduledDate: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'manufacturing-quality',
    name: 'Quality',
    slug: 'manufacturing-quality',
    description: 'Quality control with inspection plans, sampling, defect tracking, CAPA, and SPC charts.',
    version: '1.0.0',
    icon: 'ShieldCheck',
    author: 'AENEWS',
    category: 'manufacturing',
    status: 'available',
    capabilities: ['quality', 'inspections', 'defects', 'capa', 'spc'],
    tools: [
      {
        name: 'create_inspection',
        description: 'Create a quality inspection plan.',
        parameters: {
          productId: { type: 'string', required: true },
          criteria: { type: 'array', required: true },
        },
      },
    ],
  },
  {
    id: 'manufacturing-work-orders',
    name: 'Work Orders',
    slug: 'manufacturing-work-orders',
    description: 'Manufacturing work order lifecycle from creation to completion with labor and material tracking.',
    version: '1.0.0',
    icon: 'ClipboardEdit',
    author: 'AENEWS',
    category: 'manufacturing',
    status: 'available',
    capabilities: ['work-orders', 'labor', 'materials', 'completion'],
    tools: [
      {
        name: 'create_work_order',
        description: 'Create a manufacturing work order.',
        parameters: {
          productId: { type: 'string', required: true },
          quantity: { type: 'number', required: true },
          dueDate: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'manufacturing-planning',
    name: 'Planning',
    slug: 'manufacturing-planning',
    description: 'Production planning with MPS, MRP, capacity planning, and demand forecasting.',
    version: '1.0.0',
    icon: 'GanttChartSquare',
    author: 'AENEWS',
    category: 'manufacturing',
    status: 'available',
    capabilities: ['planning', 'mps', 'mrp', 'capacity', 'forecasting'],
    tools: [
      {
        name: 'run_mrp',
        description: 'Run Material Requirements Planning.',
        parameters: {
          period: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'manufacturing-stock',
    name: 'Stock',
    slug: 'manufacturing-stock',
    description: 'Manufacturing inventory with raw materials, WIP, finished goods, and inventory optimization.',
    version: '1.0.0',
    icon: 'Layers',
    author: 'AENEWS',
    category: 'manufacturing',
    status: 'available',
    capabilities: ['stock', 'raw-materials', 'wip', 'finished-goods'],
    tools: [
      {
        name: 'check_material_availability',
        description: 'Check material availability for production.',
        parameters: {
          productId: { type: 'string', required: true },
          quantity: { type: 'number', required: true },
        },
      },
    ],
  },
  {
    id: 'manufacturing-iot',
    name: 'IoT',
    slug: 'manufacturing-iot',
    description: 'IoT integration for machine sensors, real-time monitoring, predictive maintenance, and dashboards.',
    version: '1.0.0',
    icon: 'Radio',
    author: 'AENEWS',
    category: 'manufacturing',
    status: 'available',
    capabilities: ['iot', 'sensors', 'real-time', 'predictive', 'dashboards'],
    tools: [
      {
        name: 'get_sensor_data',
        description: 'Get latest sensor data from a machine.',
        parameters: {
          machineId: { type: 'string', required: true },
        },
      },
    ],
  },

  // ── Marketing ──────────────────────────────────────────────
  {
    id: 'marketing-campaigns',
    name: 'Campaigns',
    slug: 'marketing-campaigns',
    description: 'Marketing campaign management with creation, execution, budgeting, and performance tracking.',
    version: '1.0.0',
    icon: 'Megaphone',
    author: 'AENEWS',
    category: 'marketing',
    status: 'available',
    capabilities: ['campaigns', 'creation', 'execution', 'budgeting'],
    tools: [
      {
        name: 'create_campaign',
        description: 'Create a new marketing campaign.',
        parameters: {
          name: { type: 'string', required: true },
          type: { type: 'string', required: false },
          budget: { type: 'number', required: false },
          startDate: { type: 'string', required: false },
          endDate: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'marketing-email-marketing',
    name: 'Email Marketing',
    slug: 'marketing-email-marketing',
    description: 'Email marketing with drag-and-drop builder, automation, A/B testing, and analytics.',
    version: '1.0.0',
    icon: 'MailCheck',
    author: 'AENEWS',
    category: 'marketing',
    status: 'available',
    capabilities: ['email', 'builder', 'automation', 'a-b-testing'],
    tools: [
      {
        name: 'send_campaign_email',
        description: 'Send an email marketing campaign.',
        parameters: {
          campaignId: { type: 'string', required: true },
          subject: { type: 'string', required: true },
          content: { type: 'string', required: true },
          recipientList: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'marketing-sms',
    name: 'SMS',
    slug: 'marketing-sms',
    description: 'SMS marketing with bulk messaging, templates, short links, delivery tracking, and opt-out management.',
    version: '1.0.0',
    icon: 'Smartphone',
    author: 'AENEWS',
    category: 'marketing',
    status: 'available',
    capabilities: ['sms', 'bulk-messaging', 'templates', 'tracking'],
    tools: [
      {
        name: 'send_bulk_sms',
        description: 'Send bulk SMS messages.',
        parameters: {
          message: { type: 'string', required: true },
          recipientList: { type: 'array', required: true },
        },
      },
    ],
  },
  {
    id: 'marketing-social-media',
    name: 'Social Media',
    slug: 'marketing-social-media',
    description: 'Social media management with scheduling, publishing, engagement tracking, and multi-platform support.',
    version: '1.0.0',
    icon: 'Share2',
    author: 'AENEWS',
    category: 'marketing',
    status: 'available',
    capabilities: ['social-media', 'scheduling', 'publishing', 'engagement'],
    tools: [
      {
        name: 'schedule_post',
        description: 'Schedule a social media post.',
        parameters: {
          content: { type: 'string', required: true },
          platform: { type: 'string', required: true },
          scheduledAt: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'marketing-seo',
    name: 'SEO',
    slug: 'marketing-seo',
    description: 'SEO tools with keyword research, site audits, rank tracking, backlink analysis, and content optimization.',
    version: '1.0.0',
    icon: 'Search',
    author: 'AENEWS',
    category: 'marketing',
    status: 'available',
    capabilities: ['seo', 'keywords', 'audits', 'rank-tracking', 'backlinks'],
    tools: [
      {
        name: 'analyze_keywords',
        description: 'Analyze keywords for SEO opportunities.',
        parameters: {
          query: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'marketing-analytics',
    name: 'Analytics',
    slug: 'marketing-analytics',
    description: 'Marketing analytics with attribution modeling, ROI tracking, funnel analysis, and dashboards.',
    version: '1.0.0',
    icon: 'LineChart',
    author: 'AENEWS',
    category: 'marketing',
    status: 'available',
    capabilities: ['analytics', 'attribution', 'roi', 'funnels', 'dashboards'],
    tools: [
      {
        name: 'get_campaign_analytics',
        description: 'Get analytics for a marketing campaign.',
        parameters: {
          campaignId: { type: 'string', required: true },
          startDate: { type: 'string', required: false },
          endDate: { type: 'string', required: false },
        },
      },
    ],
  },

  // ── Support ──────────────────────────────────────────────
  {
    id: 'support-tickets',
    name: 'Tickets',
    slug: 'support-tickets',
    description: 'Support ticket management with prioritization, SLA tracking, escalation rules, and assignment.',
    version: '1.0.0',
    icon: 'Ticket',
    author: 'AENEWS',
    category: 'support',
    status: 'available',
    capabilities: ['tickets', 'priorities', 'sla', 'escalation', 'assignment'],
    tools: [
      {
        name: 'create_ticket',
        description: 'Create a support ticket.',
        parameters: {
          title: { type: 'string', required: true },
          description: { type: 'string', required: true },
          priority: { type: 'string', required: false },
          category: { type: 'string', required: false },
        },
      },
      {
        name: 'update_ticket',
        description: 'Update a support ticket.',
        parameters: {
          ticketId: { type: 'string', required: true },
          status: { type: 'string', required: false },
          assigneeId: { type: 'string', required: false },
          comment: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'support-chat',
    name: 'Chat',
    slug: 'support-chat',
    description: 'Live chat support with real-time messaging, chat routing, canned responses, and chat transfer.',
    version: '1.0.0',
    icon: 'MessageCircle',
    author: 'AENEWS',
    category: 'support',
    status: 'available',
    capabilities: ['chat', 'live-chat', 'routing', 'canned-responses'],
    tools: [
      {
        name: 'send_chat_message',
        description: 'Send a chat message in a support conversation.',
        parameters: {
          conversationId: { type: 'string', required: true },
          message: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'support-helpdesk',
    name: 'Helpdesk',
    slug: 'support-helpdesk',
    description: 'Helpdesk management with team dashboards, queue management, metrics, and reporting.',
    version: '1.0.0',
    icon: 'Headset',
    author: 'AENEWS',
    category: 'support',
    status: 'available',
    capabilities: ['helpdesk', 'dashboards', 'queues', 'metrics'],
    tools: [
      {
        name: 'get_helpdesk_stats',
        description: 'Get helpdesk performance statistics.',
        parameters: {
          period: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'support-knowledge-base',
    name: 'Knowledge Base',
    slug: 'support-knowledge-base',
    description: 'Knowledge base with articles, categories, search, versioning, and AI-powered suggestions.',
    version: '1.0.0',
    icon: 'BookOpen',
    author: 'AENEWS',
    category: 'support',
    status: 'available',
    capabilities: ['knowledge-base', 'articles', 'categories', 'search', 'ai-suggestions'],
    tools: [
      {
        name: 'create_article',
        description: 'Create a knowledge base article.',
        parameters: {
          title: { type: 'string', required: true },
          content: { type: 'string', required: true },
          category: { type: 'string', required: false },
        },
      },
      {
        name: 'search_articles',
        description: 'Search knowledge base articles.',
        parameters: {
          query: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'support-ai-support',
    name: 'AI Support',
    slug: 'support-ai-support',
    description: 'AI-powered support with automated responses, ticket classification, sentiment analysis, and escalation.',
    version: '1.0.0',
    icon: 'Bot',
    author: 'AENEWS',
    category: 'support',
    status: 'available',
    capabilities: ['ai-support', 'auto-responses', 'classification', 'sentiment'],
    tools: [
      {
        name: 'classify_ticket',
        description: 'AI-classify a support ticket.',
        parameters: {
          title: { type: 'string', required: true },
          description: { type: 'string', required: true },
        },
      },
    ],
  },

  // ── Project ──────────────────────────────────────────────
  {
    id: 'project-kanban',
    name: 'Kanban',
    slug: 'project-kanban',
    description: 'Kanban boards with drag-and-drop cards, WIP limits, swimlanes, and cumulative flow diagrams.',
    version: '1.0.0',
    icon: 'Columns3',
    author: 'AENEWS',
    category: 'project',
    status: 'available',
    capabilities: ['kanban', 'boards', 'wip-limits', 'swimlanes'],
    tools: [
      {
        name: 'create_board',
        description: 'Create a new Kanban board.',
        parameters: {
          name: { type: 'string', required: true },
          columns: { type: 'array', required: false },
        },
      },
    ],
  },
  {
    id: 'project-gantt',
    name: 'Gantt',
    slug: 'project-gantt',
    description: 'Gantt chart project planning with dependencies, milestones, critical path, and resource allocation.',
    version: '1.0.0',
    icon: 'GanttChart',
    author: 'AENEWS',
    category: 'project',
    status: 'available',
    capabilities: ['gantt', 'dependencies', 'milestones', 'critical-path'],
    tools: [
      {
        name: 'create_gantt_task',
        description: 'Add a task to a Gantt chart.',
        parameters: {
          title: { type: 'string', required: true },
          startDate: { type: 'string', required: true },
          endDate: { type: 'string', required: false },
          dependsOn: { type: 'array', required: false },
        },
      },
    ],
  },
  {
    id: 'project-scrum',
    name: 'Scrum',
    slug: 'project-scrum',
    description: 'Scrum framework with backlog grooming, sprint planning, daily standups, and sprint reviews.',
    version: '1.0.0',
    icon: 'RefreshCw',
    author: 'AENEWS',
    category: 'project',
    status: 'available',
    capabilities: ['scrum', 'backlog', 'sprint-planning', 'standups'],
    tools: [
      {
        name: 'create_user_story',
        description: 'Create a user story in the backlog.',
        parameters: {
          title: { type: 'string', required: true },
          description: { type: 'string', required: true },
          points: { type: 'number', required: false },
        },
      },
    ],
  },
  {
    id: 'project-sprints',
    name: 'Sprints',
    slug: 'project-sprints',
    description: 'Sprint management with velocity tracking, burndown charts, retrospective, and capacity planning.',
    version: '1.0.0',
    icon: 'Timer',
    author: 'AENEWS',
    category: 'project',
    status: 'available',
    capabilities: ['sprints', 'velocity', 'burndown', 'retrospectives'],
    tools: [
      {
        name: 'start_sprint',
        description: 'Start a new sprint.',
        parameters: {
          name: { type: 'string', required: true },
          duration: { type: 'number', required: false, default: 14 },
          storyIds: { type: 'array', required: false },
        },
      },
    ],
  },
  {
    id: 'project-time-tracking',
    name: 'Time Tracking',
    slug: 'project-time-tracking',
    description: 'Time tracking with timesheets, timers, billable hours, project cost analysis, and reports.',
    version: '1.0.0',
    icon: 'TimerReset',
    author: 'AENEWS',
    category: 'project',
    status: 'available',
    capabilities: ['time-tracking', 'timesheets', 'timers', 'billable-hours'],
    tools: [
      {
        name: 'log_time',
        description: 'Log time against a project or task.',
        parameters: {
          projectId: { type: 'string', required: true },
          hours: { type: 'number', required: true },
          description: { type: 'string', required: false },
          date: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'project-roadmap',
    name: 'Roadmap',
    slug: 'project-roadmap',
    description: 'Product and project roadmaps with strategic planning, timeline views, and stakeholder communication.',
    version: '1.0.0',
    icon: 'Map',
    author: 'AENEWS',
    category: 'project',
    status: 'available',
    capabilities: ['roadmap', 'strategic-planning', 'timeline', 'stakeholders'],
    tools: [
      {
        name: 'add_roadmap_item',
        description: 'Add an item to the roadmap.',
        parameters: {
          title: { type: 'string', required: true },
          startDate: { type: 'string', required: true },
          endDate: { type: 'string', required: false },
          priority: { type: 'string', required: false },
        },
      },
    ],
  },

  // ── eCommerce ─────────────────────────────────────────────
  {
    id: 'ecommerce-catalog',
    name: 'Catalog',
    slug: 'ecommerce-catalog',
    description: 'Product catalog with categories, attributes, variants, media, SEO fields, and bulk import/export.',
    version: '1.0.0',
    icon: 'Grid3x3',
    author: 'AENEWS',
    category: 'ecommerce',
    status: 'available',
    capabilities: ['catalog', 'categories', 'variants', 'attributes', 'seo'],
    tools: [
      {
        name: 'add_product',
        description: 'Add a product to the catalog.',
        parameters: {
          name: { type: 'string', required: true },
          price: { type: 'number', required: true },
          category: { type: 'string', required: false },
          description: { type: 'string', required: false },
        },
      },
    ],
  },
  {
    id: 'ecommerce-cart',
    name: 'Cart',
    slug: 'ecommerce-cart',
    description: 'Shopping cart with persistent sessions, coupons, gift cards, and abandoned cart recovery.',
    version: '1.0.0',
    icon: 'ShoppingCartIcon',
    author: 'AENEWS',
    category: 'ecommerce',
    status: 'available',
    capabilities: ['cart', 'coupons', 'gift-cards', 'abandoned-recovery'],
    tools: [
      {
        name: 'get_cart',
        description: 'Get current shopping cart.',
        parameters: {
          sessionId: { type: 'string', required: true },
        },
      },
      {
        name: 'apply_coupon',
        description: 'Apply a coupon code to cart.',
        parameters: {
          sessionId: { type: 'string', required: true },
          code: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'ecommerce-payments',
    name: 'Payments',
    slug: 'ecommerce-payments',
    description: 'Payment processing with multiple gateways, fraud detection, split payments, and refunds.',
    version: '1.0.0',
    icon: 'CreditCard',
    author: 'AENEWS',
    category: 'ecommerce',
    status: 'available',
    capabilities: ['payments', 'gateways', 'fraud-detection', 'refunds'],
    tools: [
      {
        name: 'process_order_payment',
        description: 'Process payment for an order.',
        parameters: {
          orderId: { type: 'string', required: true },
          paymentMethod: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'ecommerce-delivery',
    name: 'Delivery',
    slug: 'ecommerce-delivery',
    description: 'Delivery management with shipping carriers, rate calculation, tracking, and returns.',
    version: '1.0.0',
    icon: 'PackageOpen',
    author: 'AENEWS',
    category: 'ecommerce',
    status: 'available',
    capabilities: ['delivery', 'shipping', 'tracking', 'returns'],
    tools: [
      {
        name: 'calculate_shipping',
        description: 'Calculate shipping rates.',
        parameters: {
          origin: { type: 'string', required: true },
          destination: { type: 'string', required: true },
          weight: { type: 'number', required: true },
        },
      },
      {
        name: 'track_shipment',
        description: 'Track a shipment.',
        parameters: {
          trackingNumber: { type: 'string', required: true },
        },
      },
    ],
  },
  {
    id: 'ecommerce-marketplace',
    name: 'Marketplace',
    slug: 'ecommerce-marketplace',
    description: 'Multi-vendor marketplace with vendor management, commission structures, and vendor portals.',
    version: '1.0.0',
    icon: 'Store',
    author: 'AENEWS',
    category: 'ecommerce',
    status: 'available',
    capabilities: ['marketplace', 'vendors', 'commissions', 'vendor-portals'],
    tools: [
      {
        name: 'register_vendor',
        description: 'Register a new marketplace vendor.',
        parameters: {
          name: { type: 'string', required: true },
          email: { type: 'string', required: true },
          commissionRate: { type: 'number', required: false },
        },
      },
    ],
  },
];

// ============================================================
// Exported Functions
// ============================================================

/** Returns the full plugin catalog */
export function getPluginCatalog(): PluginDefinition[] {
  return [...pluginCatalog];
}

/** Returns a single plugin by slug */
export function getPluginBySlug(slug: string): PluginDefinition | undefined {
  return pluginCatalog.find((p) => p.slug === slug);
}

/** Returns plugins filtered by category */
export function getPluginsByCategory(category: PluginDefinition['category']): PluginDefinition[] {
  return pluginCatalog.filter((p) => p.category === category);
}

/** Returns all categories with plugin counts */
export function getPluginCategories(): { category: PluginDefinition['category']; count: number; label: string }[] {
  const categoryLabels: Record<PluginDefinition['category'], string> = {
    crm: 'CRM',
    erp: 'ERP',
    hr: 'Human Resources',
    finance: 'Finance',
    stock: 'Stock & Inventory',
    healthcare: 'Healthcare',
    pharmacy: 'Pharmacy',
    education: 'Education',
    realestate: 'Real Estate',
    manufacturing: 'Manufacturing',
    marketing: 'Marketing',
    support: 'Support',
    project: 'Project Management',
    ecommerce: 'eCommerce',
    other: 'Other',
  };

  const counts = new Map<PluginDefinition['category'], number>();
  for (const p of pluginCatalog) {
    counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
  }

  return Array.from(counts.entries()).map(([category, count]) => ({
    category,
    count,
    label: categoryLabels[category] ?? category,
  }));
}

/** Map registry category to Prisma PluginCategory enum */
export function registryCategoryToPrisma(
  category: PluginDefinition['category']
): string {
  const mapping: Record<string, string> = {
    crm: 'CRM',
    erp: 'ERP',
    hr: 'HR',
    finance: 'FINANCE',
    stock: 'STOCK',
    healthcare: 'HEALTHCARE',
    pharmacy: 'PHARMACY',
    education: 'EDUCATION',
    realestate: 'REAL_ESTATE',
    manufacturing: 'MANUFACTURING',
    marketing: 'MARKETING',
    support: 'SUPPORT',
    project: 'PROJECT',
    ecommerce: 'ECOMMERCE',
    other: 'OTHER',
  };
  return mapping[category] ?? 'CUSTOM';
}
