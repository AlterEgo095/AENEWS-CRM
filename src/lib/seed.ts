// ============================================================
// AENEWS Enterprise OS — Demo Data Seed
// Creates demo tenant, user, org, roles, notifications, audit logs, and plugins
// ============================================================

import { db } from '@/lib/db';
import { getPluginCatalog, registryCategoryToPrisma } from '@/lib/plugin-registry';

export async function seedDemoData() {
  console.log('🌱 [Seed] Starting AENEWS demo data seeding...');

  const results = {
    tenant: false,
    user: false,
    organization: false,
    role: false,
    notifications: 0,
    auditLogs: 0,
    chatThreads: 0,
    chatMessages: 0,
    plugins: 0,
  };

  // ── 1. Tenant ─────────────────────────────────────────────
  const existingTenant = await db.tenant.findUnique({
    where: { slug: 'aenews-demo' },
  });

  const tenant = existingTenant ?? await db.tenant.create({
    data: {
      name: 'AENEWS Demo',
      slug: 'aenews-demo',
      domain: 'demo.aenews.io',
      plan: 'pro',
      status: 'active',
      settings: JSON.stringify({
        theme: 'light',
        language: 'en',
        timezone: 'UTC',
      }),
    },
  });

  results.tenant = !!existingTenant;
  console.log(`  ${existingTenant ? '✓' : '+'} Tenant: ${tenant.name} (${tenant.id})`);

  // ── 2. User ────────────────────────────────────────────────
  const existingUser = await db.user.findUnique({
    where: { email: 'admin@aenews.io' },
  });

  const user = existingUser ?? await db.user.create({
    data: {
      email: 'admin@aenews.io',
      firstName: 'Admin',
      lastName: 'User',
      phone: '+1-555-0100',
      locale: 'en',
      timezone: 'UTC',
      isActive: true,
      tenantId: tenant.id,
    },
  });

  results.user = !!existingUser;
  console.log(`  ${existingUser ? '✓' : '+'} User: ${user.email} (${user.id})`);

  // ── 3. Organization ────────────────────────────────────────
  const existingOrg = await db.organization.findFirst({
    where: { tenantId: tenant.id, name: 'AENEWS Corp' },
  });

  const organization = existingOrg ?? await db.organization.create({
    data: {
      tenantId: tenant.id,
      name: 'AENEWS Corp',
      type: 'COMPANY',
      address: '123 Enterprise Blvd',
      city: 'San Francisco',
      country: 'US',
      phone: '+1-555-0200',
      email: 'info@aenews.io',
      website: 'https://aenews.io',
      settings: JSON.stringify({ industry: 'Technology' }),
    },
  });

  results.organization = !!existingOrg;
  console.log(`  ${existingOrg ? '✓' : '+'} Organization: ${organization.name} (${organization.id})`);

  // ── 4. Admin Role ──────────────────────────────────────────
  const existingRole = await db.role.findFirst({
    where: { tenantId: tenant.id, name: 'Admin' },
  });

  const role = existingRole ?? await db.role.create({
    data: {
      tenantId: tenant.id,
      name: 'Admin',
      description: 'Full system administrator with all permissions',
      isDefault: false,
      permissions: JSON.stringify([
        'plugins.manage',
        'users.manage',
        'roles.manage',
        'organizations.manage',
        'notifications.manage',
        'audit.view',
        'chat.manage',
        'workflows.manage',
        'files.manage',
        'settings.manage',
        'billing.manage',
      ]),
    },
  });

  results.role = !!existingRole;
  console.log(`  ${existingRole ? '✓' : '+'} Role: ${role.name} (${role.id})`);

  // Assign user to admin role
  if (!existingUser || !existingRole) {
    await db.userRole.upsert({
      where: {
        userId_roleId_tenantId: {
          userId: user.id,
          roleId: role.id,
          tenantId: tenant.id,
        },
      },
      update: {},
      create: {
        userId: user.id,
        roleId: role.id,
        tenantId: tenant.id,
      },
    });
    console.log('  + UserRole assigned');
  }

  // ── 5. Notifications (mix of read/unread) ──────────────────
  const existingNotifCount = await db.notification.count({
    where: { tenantId: tenant.id },
  });

  if (existingNotifCount === 0) {
    const notifications = [
      {
        type: 'system',
        title: 'Welcome to AENEWS Enterprise OS',
        message: 'Your workspace has been set up successfully. Start by installing plugins from the marketplace.',
        data: { action: 'onboarding' },
        isRead: true,
      },
      {
        type: 'plugin',
        title: 'CRM Plugin Activated',
        message: 'The CRM plugin is now active. You can manage contacts, deals, and your sales pipeline.',
        data: { pluginSlug: 'crm-contacts' },
        isRead: true,
      },
      {
        type: 'workflow',
        title: 'New Lead Assigned',
        message: 'A new lead "Acme Corporation" has been assigned to you from the website contact form.',
        data: { leadId: 'demo-lead-1' },
        isRead: true,
      },
      {
        type: 'alert',
        title: 'Payment Overdue',
        message: 'Invoice #INV-2024-042 from "TechStart Inc." is 5 days overdue ($12,500.00).',
        data: { invoiceId: 'inv-042' },
        isRead: false,
      },
      {
        type: 'hr',
        title: 'Leave Request Pending',
        message: 'Sarah Chen has requested 3 days of vacation from Dec 20-22. Please review.',
        data: { requestId: 'leave-req-7' },
        isRead: false,
      },
      {
        type: 'system',
        title: 'System Update Available',
        message: 'AENEOS v2.1.0 is available with new features: AI-powered analytics, bulk import, and custom dashboards.',
        data: { version: '2.1.0' },
        isRead: false,
      },
      {
        type: 'task',
        title: 'Monthly Report Due',
        message: 'The Q4 financial report is due by end of month. All department heads should submit their data.',
        data: { dueDate: '2024-12-31' },
        isRead: false,
      },
      {
        type: 'chat',
        title: 'New AI Chat Message',
        message: 'The AI assistant has a suggestion for your sales pipeline optimization.',
        data: { threadId: 'thread-1' },
        isRead: false,
      },
    ];

    for (const notif of notifications) {
      await db.notification.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          type: notif.type,
          title: notif.title,
          message: notif.message,
          data: JSON.stringify(notif.data),
          isRead: notif.isRead,
        },
      });
      results.notifications++;
    }
    console.log(`  + ${results.notifications} notifications created`);
  } else {
    console.log(`  ✓ ${existingNotifCount} notifications already exist`);
    results.notifications = existingNotifCount;
  }

  // ── 6. Audit Log Entries ──────────────────────────────────
  const existingAuditCount = await db.auditLog.count({
    where: { tenantId: tenant.id },
  });

  if (existingAuditCount === 0) {
    const auditEntries = [
      {
        action: 'tenant.created',
        entityType: 'Tenant',
        entityId: tenant.id,
        metadata: { name: tenant.name },
        daysAgo: 30,
      },
      {
        action: 'user.login',
        entityType: 'User',
        entityId: user.id,
        metadata: { email: user.email, method: 'password' },
        ipAddress: '192.168.1.100',
        daysAgo: 7,
      },
      {
        action: 'user.login',
        entityType: 'User',
        entityId: user.id,
        metadata: { email: user.email, method: 'sso' },
        ipAddress: '10.0.0.42',
        daysAgo: 5,
      },
      {
        action: 'plugin.installed',
        entityType: 'Plugin',
        entityId: 'crm-contacts',
        metadata: { name: 'CRM - Contacts', version: '1.0.0' },
        daysAgo: 14,
      },
      {
        action: 'plugin.installed',
        entityType: 'Plugin',
        entityId: 'finance-invoicing',
        metadata: { name: 'Finance - Invoicing', version: '1.0.0' },
        daysAgo: 14,
      },
      {
        action: 'plugin.installed',
        entityType: 'Plugin',
        entityId: 'hr-employees',
        metadata: { name: 'HR - Employees', version: '1.0.0' },
        daysAgo: 14,
      },
      {
        action: 'notification.created',
        entityType: 'Notification',
        entityId: 'notif-1',
        metadata: { type: 'system', title: 'Welcome' },
        daysAgo: 30,
      },
      {
        action: 'settings.updated',
        entityType: 'Tenant',
        entityId: tenant.id,
        metadata: { setting: 'theme', old: 'dark', new: 'light' },
        daysAgo: 3,
      },
      {
        action: 'chat.thread.created',
        entityType: 'ChatThread',
        entityId: 'thread-1',
        metadata: { title: 'Sales Pipeline Optimization' },
        daysAgo: 1,
      },
      {
        action: 'user.login',
        entityType: 'User',
        entityId: user.id,
        metadata: { email: user.email, method: 'password' },
        ipAddress: '172.16.0.5',
        daysAgo: 0,
      },
    ];

    for (const entry of auditEntries) {
      const createdAt = new Date();
      createdAt.setDate(createdAt.getDate() - (entry as any).daysAgo);

      await db.auditLog.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          metadata: JSON.stringify(entry.metadata),
          ipAddress: (entry as any).ipAddress ?? null,
          createdAt,
        },
      });
      results.auditLogs++;
    }
    console.log(`  + ${results.auditLogs} audit log entries created`);
  } else {
    console.log(`  ✓ ${existingAuditCount} audit log entries already exist`);
    results.auditLogs = existingAuditCount;
  }

  // ── 7. Chat Threads with Messages ───────────────────────────
  const existingThreads = await db.chatThread.count({
    where: { tenantId: tenant.id },
  });

  if (existingThreads === 0) {
    // Thread 1: Sales Pipeline Discussion
    const thread1 = await db.chatThread.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        title: 'Sales Pipeline Optimization',
        model: 'gpt-4o',
      },
    });

    await db.chatMessage.createMany({
      data: [
        {
          threadId: thread1.id,
          tenantId: tenant.id,
          role: 'USER',
          content: 'Can you analyze our current sales pipeline and suggest improvements?',
          toolsCalled: '[]',
        },
        {
          threadId: thread1.id,
          tenantId: tenant.id,
          role: 'ASSISTANT',
          content: `I'd be happy to analyze your sales pipeline! Let me pull up the current data.\n\nBased on your pipeline, I can see:\n- **12 deals** in the qualification stage (total value: $185,000)\n- **8 deals** in proposal stage ($420,000)\n- **5 deals** in negotiation ($210,000)\n- **3 deals** closing this week ($95,000)\n\nHere are my recommendations:\n1. **Reduce qualification time**: The average deal spends 12 days in qualification. Try to reduce this to 7 days.\n2. **Follow-up automation**: Set up automated email sequences for deals stuck in proposal for >5 days.\n3. **Win rate optimization**: Your win rate in negotiation is 67%. Focus on addressing common objections earlier in the pipeline.`,
          toolsCalled: JSON.stringify(['get_pipeline_summary', 'analyze_deals']),
        },
        {
          threadId: thread1.id,
          tenantId: tenant.id,
          role: 'USER',
          content: 'Great analysis! Can you help me create a follow-up email template for deals in proposal stage?',
          toolsCalled: '[]',
        },
        {
          threadId: thread1.id,
          tenantId: tenant.id,
          role: 'ASSISTANT',
          content: `Here's a follow-up email template for your proposal stage deals:\n\n---\n**Subject**: Following up on our proposal for [Company Name]\n\nHi [First Name],\n\nI hope this email finds you well. I wanted to follow up on the proposal we sent over for [Project/Service Name].\n\nI understand you're busy, so I'll keep it brief:\n- The proposal is still valid for the quoted pricing\n- We've had some recent success stories from similar clients that I think would be relevant\n- I'm happy to jump on a 15-minute call to answer any questions\n\nWould any of these be helpful? Looking forward to hearing from you.\n\nBest regards,\n[Your Name]\n---\n\nWant me to create this as a reusable email template in the CRM?`,
          toolsCalled: JSON.stringify(['create_email_template']),
        },
      ],
    });

    results.chatThreads++;
    results.chatMessages += 4;

    // Thread 2: Financial Report Discussion
    const thread2 = await db.chatThread.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        title: 'Q4 Financial Report Questions',
        model: 'gpt-4o',
      },
    });

    await db.chatMessage.createMany({
      data: [
        {
          threadId: thread2.id,
          tenantId: tenant.id,
          role: 'USER',
          content: 'Show me the revenue breakdown by department for Q4.',
          toolsCalled: '[]',
        },
        {
          threadId: thread2.id,
          tenantId: tenant.id,
          role: 'ASSISTANT',
          content: `Here's the Q4 revenue breakdown by department:\n\n| Department | Revenue | % of Total | vs Q3 |\n|-----------|---------|-----------|--------|\n| Sales | $1.2M | 45% | +12% |\n| Consulting | $680K | 25% | +8% |\n| Support | $408K | 15% | +3% |\n| Training | $270K | 10% | -2% |\n| Other | $67K | 5% | +1% |\n| **Total** | **$2.625M** | **100%** | **+8.5%** |\n\nKey highlights:\n- Sales continues to be the strongest growth driver\n- Consulting had a solid quarter with new enterprise clients\n- Training dipped slightly due to fewer corporate programs\n\nWould you like me to drill down into any specific department?`,
          toolsCalled: JSON.stringify(['generate_report', 'get_revenue_breakdown']),
        },
      ],
    });

    results.chatThreads++;
    results.chatMessages += 2;

    console.log(`  + ${results.chatThreads} chat threads created (${results.chatMessages} messages)`);
  } else {
    console.log(`  ✓ ${existingThreads} chat threads already exist`);
    const msgCount = await db.chatMessage.count({
      where: { tenantId: tenant.id },
    });
    results.chatThreads = existingThreads;
    results.chatMessages = msgCount;
  }

  // ── 8. Install CRM, Finance, HR plugins as "active" ─────────
  const pluginsToInstall = [
    'crm-contacts',
    'crm-companies',
    'crm-deals',
    'crm-pipeline',
    'finance-invoicing',
    'finance-expenses',
    'finance-budget',
    'hr-employees',
    'hr-payroll',
    'hr-leave',
  ];

  const catalog = getPluginCatalog();

  for (const pluginSlug of pluginsToInstall) {
    const catalogPlugin = catalog.find((p) => p.slug === pluginSlug);
    if (!catalogPlugin) continue;

    // Ensure plugin exists in DB
    const dbPlugin = await db.plugin.upsert({
      where: { slug: pluginSlug },
      update: {
        status: 'ACTIVE',
      },
      create: {
        id: catalogPlugin.id,
        name: catalogPlugin.name,
        slug: catalogPlugin.slug,
        description: catalogPlugin.description,
        version: catalogPlugin.version,
        author: catalogPlugin.author,
        category: registryCategoryToPrisma(catalogPlugin.category) as any,
        status: 'ACTIVE',
        capabilities: JSON.stringify(catalogPlugin.capabilities),
        settings: '{}',
      },
    });

    // Install the plugin for the tenant
    const existingInstall = await db.installedPlugin.findUnique({
      where: {
        tenantId_pluginId: { tenantId: tenant.id, pluginId: dbPlugin.id },
      },
    });

    if (!existingInstall) {
      await db.installedPlugin.create({
        data: {
          tenantId: tenant.id,
          pluginId: dbPlugin.id,
          version: catalogPlugin.version,
          status: 'ACTIVE',
          settings: '{}',
        },
      });
      results.plugins++;
    } else {
      // Ensure it's marked active
      await db.installedPlugin.update({
        where: { id: existingInstall.id },
        data: { status: 'ACTIVE' },
      });
      results.plugins++;
    }
  }
  console.log(`  + ${results.plugins} plugins installed and activated`);

  console.log('✅ [Seed] AENEWS demo data seeding complete!\n');
  return results;
}
