/**
 * AENEWS Enterprise OS — Massive Plugin Generator
 * Generates 100 test plugin directories with valid plugin.json manifests
 * for scalability testing of the plugin engine.
 *
 * Usage: bun run scripts/generate-test-plugins.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const PLUGINS_DIR = path.resolve(__dirname, '..', 'plugins');
const TOTAL_PLUGINS = 100;

// ── Data pools for deterministic generation ──

const capabilityTypes = [
  'object', 'search', 'create', 'read', 'update',
  'delete', 'tool', 'view', 'dashboard', 'widget',
];

const objectNames = [
  'Record', 'Item', 'Asset', 'Entry', 'Resource',
  'Document', 'Contract', 'Ticket', 'Project', 'Task',
];

const menuLabels = [
  'Overview', 'Records', 'Reports', 'Settings', 'Analytics',
  'Integrations', 'Team', 'Calendar', 'Audit Log', 'Workflow',
];

const actionVerbs = [
  'created', 'updated', 'deleted', 'archived', 'restored',
  'approved', 'rejected', 'assigned', 'completed', 'exported',
];

const settingTypes: Array<'string' | 'number' | 'boolean' | 'select' | 'json'> = [
  'string', 'number', 'boolean', 'select', 'json',
];

const entityDomains = [
  'orders', 'invoices', 'shipments', 'customers', 'products',
];

const fieldSets: string[][] = [
  ['id', 'reference_number', 'customer_name', 'total_amount', 'status', 'created_at', 'updated_at', 'due_date', 'notes', 'priority'],
  ['id', 'invoice_number', 'amount', 'currency', 'paid_status', 'issued_date', 'due_date', 'vendor', 'category', 'description'],
  ['id', 'tracking_code', 'origin', 'destination', 'carrier', 'weight', 'shipped_date', 'delivered_date', 'status', 'recipient'],
  ['id', 'full_name', 'email', 'phone', 'company', 'city', 'country', 'registration_date', 'tier', 'active'],
  ['id', 'sku', 'product_name', 'category', 'price', 'stock_quantity', 'supplier', 'weight_kg', 'description', 'tags'],
];

const iconNames = [
  'Box', 'Package', 'FileText', 'Database', 'Layers',
  'Archive', 'Clipboard', 'Tag', 'Briefcase', 'List',
];

// ── Helpers ──

function pad(n: number): string {
  return String(n).padStart(3, '0');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function generateCapabilityName(type: string, index: number, objName: string): string {
  const verbMap: Record<string, string> = {
    object: `manage${capitalize(objName)}`,
    search: `search${capitalize(objName)}s`,
    create: `create${capitalize(objName)}`,
    read: `get${capitalize(objName)}`,
    update: `update${capitalize(objName)}`,
    delete: `delete${capitalize(objName)}`,
    tool: `process${capitalize(objName)}Batch`,
    view: `view${capitalize(objName)}Dashboard`,
    dashboard: `${objName.toLowerCase()}Overview`,
    widget: `${objName.toLowerCase()}Widget`,
  };
  return verbMap[type] || `${type}${capitalize(objName)}`;
}

function generateCapabilityDescription(type: string, objName: string): string {
  const descMap: Record<string, string> = {
    object: `Full lifecycle management for ${objName} objects including CRUD and workflows`,
    search: `Search and filter ${objName} records by multiple criteria with pagination`,
    create: `Create new ${objName} records with validation and auto-generated fields`,
    read: `Retrieve ${objName} details by ID with full metadata and relationships`,
    update: `Modify existing ${objName} records with change tracking`,
    delete: `Remove ${objName} records with soft-delete and archival support`,
    tool: `Execute batch processing operations on ${objName} collections`,
    view: `Dedicated view component for rendering ${objName} data and actions`,
    dashboard: `Analytics dashboard showing ${objName} KPIs and trends`,
    widget: `Compact widget displaying ${objName} summary for portal embedding`,
  };
  return descMap[type] || `${type} capability for ${objName} management`;
}

// ── Plugin generator ──

function generatePluginManifest(index: number): Record<string, unknown> {
  const num = pad(index);
  const slug = `test-${num}`;
  const id = `aenews-test-${num}`;
  const shortId = `test${num}`; // e.g., test001 — for permission dot-notation

  const name = `Test Plugin ${num}`;
  const description = `Automated test plugin #${num} for AENEWS scalability testing. Validates plugin engine behavior under mass load conditions.`;

  // ── 10 Capabilities ──
  const capabilities = capabilityTypes.map((type, i) => ({
    type,
    name: generateCapabilityName(type, i, objectNames[i % objectNames.length]),
    description: generateCapabilityDescription(type, objectNames[i % objectNames.length]),
  }));

  // ── 10 Menus: first is top-level, rest are children ──
  const parentMenuId = `${slug}-menu-parent`;
  const menus = menuLabels.map((label, i) => {
    const menu: Record<string, unknown> = {
      id: `${slug}-menu-${i}`,
      label: `${name} ${label}`,
      icon: iconNames[i % iconNames.length],
      href: `plugin:${slug}:${label.toLowerCase().replace(/\s+/g, '-')}`,
      section: 'PLUGINS',
      order: (i + 1) * 10,
    };
    if (i > 0) {
      menu.parentId = parentMenuId;
    }
    return menu;
  });
  // Overwrite first menu to be the parent
  menus[0].id = parentMenuId;
  menus[0].label = name;

  // ── 10 Permissions with dot-notation ──
  const permissionCategories = [
    'record', 'item', 'asset', 'entry', 'resource',
    'document', 'contract', 'ticket', 'project', 'task',
  ];
  const permissionActions = ['read', 'create', 'update', 'delete', 'admin'];
  const permissions = permissionCategories.map((cat, i) => ({
    id: `${shortId}.${cat}.${permissionActions[i % permissionActions.length]}`,
    name: `${capitalize(cat)} ${capitalize(permissionActions[i % permissionActions.length])}`,
    description: `${capitalize(permissionActions[i % permissionActions.length])} permission for ${cat} entities in test plugin ${num}`,
    category: slug,
  }));

  // ── 10 Events ──
  const events = actionVerbs.map((verb, i) => ({
    type: `${slug}.${permissionCategories[i % permissionCategories.length]}.${verb}`,
    description: `Fires when a ${permissionCategories[i % permissionCategories.length]} is ${verb.replace('ed', 'd')} in test plugin ${num}`,
  }));

  // ── 5 Search Entities with 10 fields each ──
  const searchEntities = entityDomains.map((domain, i) => ({
    name: domain,
    table: `${slug}_${domain}`,
    fields: fieldSets[i % fieldSets.length],
    labelField: fieldSets[i % fieldSets.length][1], // second field as label
  }));

  // ── 5 Settings ──
  const settings = [
    {
      key: `${slug}.max_items_per_page`,
      type: 'number' as const,
      label: `Max Items Per Page`,
      defaultValue: 25,
      scope: 'tenant',
    },
    {
      key: `${slug}.enable_notifications`,
      type: 'boolean' as const,
      label: `Enable Notifications`,
      defaultValue: true,
      scope: 'tenant',
    },
    {
      key: `${slug}.default_sort_field`,
      type: 'string' as const,
      label: `Default Sort Field`,
      defaultValue: 'created_at',
      scope: 'tenant',
    },
    {
      key: `${slug}.archive_after_days`,
      type: 'number' as const,
      label: `Archive After Days`,
      defaultValue: 90,
      scope: 'tenant',
    },
    {
      key: `${slug}.export_format`,
      type: 'select' as const,
      label: `Export Format`,
      defaultValue: 'json',
      options: [
        { label: 'JSON', value: 'json' },
        { label: 'CSV', value: 'csv' },
        { label: 'XML', value: 'xml' },
      ],
      scope: 'tenant',
    },
  ];

  return {
    aenews: '1',
    id,
    name,
    slug,
    version: '1.0.0',
    description,
    author: 'AENEWS Auto-Generator',
    license: 'MIT',
    coreVersion: '0.1.0',
    dependencies: [],
    capabilities,
    entry: {
      server: './src/index.ts',
    },
    permissions,
    settings,
    menus,
    events,
    search: {
      entities: searchEntities,
    },
  };
}

// ── Main ──

function main() {
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  AENEWS Plugin Generator — Scalability Test Suite        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`\nTarget: ${TOTAL_PLUGINS} test plugins`);
  console.log(`Output: ${PLUGINS_DIR}/test-{001-100}/plugin.json\n`);

  let created = 0;
  let skipped = 0;
  const startTime = Date.now();

  for (let i = 1; i <= TOTAL_PLUGINS; i++) {
    const num = pad(i);
    const pluginDir = path.join(PLUGINS_DIR, `test-${num}`);
    const pluginFile = path.join(pluginDir, 'plugin.json');

    // Skip if already exists (idempotent)
    if (fs.existsSync(pluginFile)) {
      skipped++;
      continue;
    }

    const manifest = generatePluginManifest(i);

    // Create directory if needed
    fs.mkdirSync(pluginDir, { recursive: true });

    // Write plugin.json with pretty formatting
    fs.writeFileSync(pluginFile, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

    created++;

    // Progress indicator every 10 plugins
    if (i % 10 === 0 || i === 1) {
      const pct = Math.round((i / TOTAL_PLUGINS) * 100);
      console.log(`  [${pct}%] Generated test-${num} — ${i}/${TOTAL_PLUGINS}`);
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n────────────────────────────────────────────────────────────');
  console.log(`  ✅ Created:  ${created} plugin directories`);
  console.log(`  ⏭  Skipped:  ${skipped} (already exist)`);
  console.log(`  📁 Total:    ${TOTAL_PLUGINS} test plugins`);
  console.log(`  ⏱  Elapsed:  ${elapsed}s`);
  console.log('────────────────────────────────────────────────────────────\n');
  console.log('Each plugin contains:');
  console.log('  • 10 capabilities (object, search, create, read, update, delete, tool, view, dashboard, widget)');
  console.log('  • 10 menus (1 parent + 9 children)');
  console.log('  • 10 permissions with dot-notation');
  console.log('  • 10 events');
  console.log('  • 5 search entities × 10 fields = 50 search fields');
  console.log('  • 5 settings');
  console.log('');
}

main();
