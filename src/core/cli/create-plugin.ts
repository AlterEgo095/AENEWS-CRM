#!/usr/bin/env bun
// AENEWS Plugin CLI — create-aenews-plugin
// Usage: npx create-aenews-plugin <plugin-name> [--category <cat>] [--author <author>]

import fs from 'fs';
import path from 'path';

// ============================================================
// CLI Argument Parser
// ============================================================

interface CLIArgs {
  name: string;
  category: string;
  author: string;
  description: string;
  output: string;
}

function parseArgs(argv: string[]): CLIArgs {
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    }
    if (arg === '--version' || arg === '-v') {
      console.log('create-aenews-plugin v0.1.0');
      process.exit(0);
    }
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      // Handles --flag value
      // We store the flag and expect the next arg as value
      positional.push(`__flag__${key}`);
    } else if (arg.startsWith('-')) {
      const shortMap: Record<string, string> = {
        c: 'category',
        a: 'author',
        d: 'description',
        o: 'output',
      };
      const key = shortMap[arg.slice(1)] ?? arg.slice(1);
      positional.push(`__flag__${key}`);
    } else {
      positional.push(arg);
    }
  }

  // Now resolve flags with values
  const names: string[] = [];
  for (let i = 0; i < positional.length; i++) {
    const token = positional[i];
    if (token.startsWith('__flag__')) {
      const flagName = token.slice(8); // __flag__ is 8 chars
      const nextToken = positional[i + 1];
      if (nextToken && !nextToken.startsWith('__flag__')) {
        flags[flagName] = nextToken;
        i++; // skip the value on next iteration
      } else {
        flags[flagName] = 'true';
      }
    } else {
      names.push(token);
    }
  }

  if (names.length === 0) {
    console.error('Error: Plugin name is required.');
    console.error('');
    printUsage();
    process.exit(1);
  }

  return {
    name: names[0],
    category: flags['category'] ?? flags['c'] ?? 'custom',
    author: flags['author'] ?? flags['a'] ?? 'AENEWS',
    description: flags['description'] ?? flags['d'] ?? 'A new AENEWS plugin',
    output: flags['output'] ?? flags['o'] ?? './plugins',
  };
}

function printUsage(): void {
  console.log(`
create-aenews-plugin — Scaffold a new AENEWS plugin

Usage:
  npx create-aenews-plugin <plugin-name> [options]

Arguments:
  plugin-name    The name of the plugin to create (e.g. "my-tool")

Options:
  -c, --category <cat>       Plugin category (default: "custom")
  -a, --author <author>      Plugin author (default: "AENEWS")
  -d, --description <desc>   Plugin description (default: "A new AENEWS plugin")
  -o, --output <path>        Output directory (default: "./plugins")
  -h, --help                 Show this help message
  -v, --version              Show CLI version

Examples:
  npx create-aenews-plugin task-manager
  npx create-aenews-plugin inventory --category ops --author "Acme Inc"
  npx create-aenews-plugin support-bot --description "AI support chatbot"
  npx create-aenews-plugin analytics --output ./my-plugins
`.trimStart());
}

// ============================================================
// Plugin Template Generator
// ============================================================

function generatePluginTemplate(args: CLIArgs): Map<string, string> {
  const slug = args.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const id = `aenews-${slug}`;
  const titleName = toTitleCase(args.name);
  const pascalName = pascalCase(args.name);
  const files = new Map<string, string>();

  // ── 1. plugin.json ────────────────────────────────────────
  files.set('plugin.json', JSON.stringify({
    aenews: '1',
    id,
    name: titleName,
    slug,
    version: '0.1.0',
    description: args.description,
    author: args.author,
    license: 'MIT',
    coreVersion: '0.1.0',
    capabilities: [
      {
        type: 'object',
        name: `${slug}-record`,
        description: `${titleName} record management`,
      },
      {
        type: 'view',
        name: `${slug}-list`,
        description: `${titleName} list view`,
      },
    ],
    entry: {
      server: './dist/server.js',
    },
    permissions: [
      {
        id: `${slug}.read`,
        name: `Read ${titleName}`,
        description: `Can view ${args.name} records`,
        category: slug,
      },
      {
        id: `${slug}.write`,
        name: `Write ${titleName}`,
        description: `Can create and edit ${args.name} records`,
        category: slug,
      },
    ],
    settings: [
      {
        key: 'default_view',
        type: 'select',
        label: 'Default View',
        description: 'Default view for the plugin',
        options: [
          { label: 'Table', value: 'table' },
          { label: 'Grid', value: 'grid' },
          { label: 'Kanban', value: 'kanban' },
        ],
        defaultValue: 'table',
        scope: 'tenant',
      },
    ],
    menus: [
      {
        id: `${slug}-main`,
        label: titleName,
        icon: 'Package',
        href: `/${slug}`,
        section: 'Apps',
        order: 100,
        permission: `${slug}.read`,
      },
    ],
    events: [
      {
        type: `${slug}.created`,
        payloadSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
          },
        },
        description: `Emitted when a ${args.name} record is created`,
      },
      {
        type: `${slug}.updated`,
        payloadSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            changes: { type: 'object' },
          },
        },
        description: `Emitted when a ${args.name} record is updated`,
      },
      {
        type: `${slug}.deleted`,
        payloadSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
        },
        description: `Emitted when a ${args.name} record is deleted`,
      },
    ],
    search: {
      entities: [
        {
          name: slug,
          table: `${slug}_records`,
          fields: ['name', 'description'],
          labelField: 'name',
        },
      ],
    },
    routes: [
      { method: 'GET', path: `/api/plugins/${slug}`, handler: 'listRecords', permissions: [`${slug}.read`] },
      { method: 'POST', path: `/api/plugins/${slug}`, handler: 'createRecord', permissions: [`${slug}.write`] },
      { method: 'GET', path: `/api/plugins/${slug}/[id]`, handler: 'getRecord', permissions: [`${slug}.read`] },
      { method: 'PATCH', path: `/api/plugins/${slug}/[id]`, handler: 'updateRecord', permissions: [`${slug}.write`] },
      { method: 'DELETE', path: `/api/plugins/${slug}/[id]`, handler: 'deleteRecord', permissions: [`${slug}.write`] },
    ],
  }, null, 2));

  // ── 2. package.json ───────────────────────────────────────
  files.set('package.json', JSON.stringify({
    name: id,
    version: '0.1.0',
    description: args.description,
    main: 'dist/server.js',
    scripts: {
      build: 'tsc',
      dev: 'tsc --watch',
    },
    devDependencies: {
      typescript: '^5',
      '@aenews/plugin-sdk': 'workspace:*',
    },
  }, null, 2));

  // ── 3. tsconfig.json ──────────────────────────────────────
  files.set('tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      outDir: './dist',
      declaration: true,
      sourceMap: true,
      resolveJsonModule: true,
      isolatedModules: true,
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  }, null, 2));

  // ── 4. src/server.ts (plugin entry point) ────────────────
  const toolNameList = slug.replace(/-/g, '_');
  const toolNameCreate = slug.replace(/-/g, '_');

  files.set('src/server.ts', `import { definePlugin } from '../../../src/core/plugin-sdk';
import type {
  PluginContext,
  PluginRequest,
  PluginResponse,
  SearchResult,
} from '../../../src/core/plugin-sdk';
import manifest from '../plugin.json';

// ── Route handler implementations ──────────────────────────

async function listRecords(_req: PluginRequest, ctx: PluginContext): Promise<PluginResponse> {
  ctx.logger.info('Listing ${slug} records', { tenantId: ctx.tenantId });
  return {
    status: 200,
    body: {
      success: true,
      records: [],
      total: 0,
    },
  };
}

async function getRecord(req: PluginRequest, ctx: PluginContext): Promise<PluginResponse> {
  const id = req.path.split('/').pop();
  ctx.logger.info('Getting ${slug} record', { id, tenantId: ctx.tenantId });
  return {
    status: 200,
    body: {
      success: true,
      record: null,
    },
  };
}

async function createRecord(req: PluginRequest, ctx: PluginContext): Promise<PluginResponse> {
  const body = req.body as Record<string, unknown>;
  ctx.logger.info('Creating ${slug} record', { body, tenantId: ctx.tenantId });

  const recordId = \`${slug}_\${Date.now()}\`;

  // Emit event for other plugins to react to
  await ctx.eventBus.emit('${slug}.created', {
    id: recordId,
    name: body.name,
    createdBy: req.userId,
    tenantId: ctx.tenantId,
  });

  return {
    status: 201,
    body: {
      success: true,
      record: {
        id: recordId,
        ...body,
        createdAt: new Date().toISOString(),
      },
    },
  };
}

async function updateRecord(req: PluginRequest, ctx: PluginContext): Promise<PluginResponse> {
  const id = req.path.split('/').pop();
  const body = req.body as Record<string, unknown>;
  ctx.logger.info('Updating ${slug} record', { id, body, tenantId: ctx.tenantId });

  await ctx.eventBus.emit('${slug}.updated', {
    id,
    changes: Object.keys(body),
    updatedBy: req.userId,
    tenantId: ctx.tenantId,
    ...body,
  });

  return {
    status: 200,
    body: {
      success: true,
      record: { id, ...body, updatedAt: new Date().toISOString() },
    },
  };
}

async function deleteRecord(req: PluginRequest, ctx: PluginContext): Promise<PluginResponse> {
  const id = req.path.split('/').pop();
  ctx.logger.info('Deleting ${slug} record', { id, tenantId: ctx.tenantId });

  await ctx.eventBus.emit('${slug}.deleted', {
    id,
    deletedBy: req.userId,
    tenantId: ctx.tenantId,
  });

  return {
    status: 200,
    body: {
      success: true,
      message: 'Record deleted',
    },
  };
}

// ── Plugin definition ───────────────────────────────────────

export default definePlugin({
  manifest,

  // ── Lifecycle Hooks ──────────────────────────────────────

  onInstall: async (ctx) => {
    ctx.logger.info('${titleName} plugin installing...');
    // TODO: Run migrations, seed default data
  },

  onActivate: async (ctx) => {
    ctx.logger.info('${titleName} plugin activated');
    // TODO: Register event handlers, start services
  },

  onDeactivate: async (ctx) => {
    ctx.logger.info('${titleName} plugin deactivated');
    // TODO: Cleanup resources
  },

  onUninstall: async (ctx) => {
    ctx.logger.info('${titleName} plugin uninstalling...');
    // TODO: Run down migrations, clean data
  },

  // ── AI Tools ─────────────────────────────────────────────

  tools: {
    list_${toolNameList}: {
      description: 'List ${args.name} records with pagination',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Max results to return', default: 20 },
          offset: { type: 'number', description: 'Offset for pagination', default: 0 },
        },
      },
      execute: async (params, ctx) => {
        ctx.logger.info('Listing ${args.name} records', params);
        // TODO: Implement with Prisma
        return { success: true, data: [], total: 0 };
      },
    },

    create_${toolNameCreate}: {
      description: 'Create a new ${args.name} record',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Record name' },
          description: { type: 'string', description: 'Record description' },
        },
        required: ['name'],
      },
      execute: async (params, ctx) => {
        const recordId = \`${slug}_\${Date.now()}\`;
        ctx.logger.info('Creating ${args.name} record', params);

        // Emit event for cross-plugin integration
        await ctx.eventBus.emit('${slug}.created', {
          id: recordId,
          name: (params as Record<string, unknown>).name,
          createdBy: 'ai-assistant',
          tenantId: ctx.tenantId,
        });

        return {
          success: true,
          data: {
            id: recordId,
            ...params,
            createdAt: new Date().toISOString(),
          },
        };
      },
    },
  },

  // ── Event Handlers ────────────────────────────────────────

  events: {
    '${slug}.created': {
      handler: async (payload, ctx) => {
        ctx.logger.info('New ${args.name} created', payload);
        await ctx.eventBus.emit('notification.send', {
          type: 'info',
          title: 'New ${titleName}',
          message: \`New ${args.name}: \${(payload as Record<string, string>).name ?? payload}\`,
          tenantId: ctx.tenantId,
        });
      },
    },

    '${slug}.updated': {
      handler: async (payload, ctx) => {
        ctx.logger.info('${args.name} updated', payload);
      },
    },

    '${slug}.deleted': {
      handler: async (payload, ctx) => {
        ctx.logger.warn('${args.name} deleted', payload);
      },
    },
  },

  // ── API Routes ─────────────────────────────────────────────

  routes: [
    { method: 'GET', path: '/api/plugins/${slug}', handler: listRecords, permissions: ['${slug}.read'] },
    { method: 'POST', path: '/api/plugins/${slug}', handler: createRecord, permissions: ['${slug}.write'] },
    { method: 'GET', path: '/api/plugins/${slug}/:id', handler: getRecord, permissions: ['${slug}.read'] },
    { method: 'PATCH', path: '/api/plugins/${slug}/:id', handler: updateRecord, permissions: ['${slug}.write'] },
    { method: 'DELETE', path: '/api/plugins/${slug}/:id', handler: deleteRecord, permissions: ['${slug}.write'] },
  ],

  // ── Search Handler ────────────────────────────────────────

  search: {
    search: async (query: string, ctx: PluginContext): Promise<SearchResult[]> => {
      ctx.logger.debug('Global search for ${slug}', { query });
      // TODO: Query database for matching records
      return [];
    },
  },
});`);

  // ── 5. src/types.ts ────────────────────────────────────────
  files.set('src/types.ts', `/**
 * ${pascalName} Plugin — Type Definitions
 * Generated by create-aenews-plugin
 */

export interface ${pascalName}Record {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Create${pascalName}Input {
  name: string;
  description?: string;
}

export interface Update${pascalName}Input {
  name?: string;
  description?: string;
}`);

  // ── 6. README.md ─────────────────────────────────────────
  files.set('README.md', `# ${titleName} Plugin

> ${args.description}

## Installation

\`\`\`bash
# Via AENEWS CLI
aenews plugin install ${id}

# Via API
POST /api/plugins
{ "pluginSlug": "${slug}" }
\`\`\`

## Capabilities

- **${titleName} Records**: Full CRUD operations
- **List View**: Table view of all records
- **Search**: Full-text search across records

## Permissions

| Permission | Description |
|-----------|-------------|
| \`${slug}.read\` | View ${args.name} records |
| \`${slug}.write\` | Create and edit ${args.name} records |

## Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| \`default_view\` | select | table | Default view for the plugin |

## Events

| Event | Payload | Description |
|-------|---------|-------------|
| \`${slug}.created\` | \`{ id, name }\` | New record created |
| \`${slug}.updated\` | \`{ id, changes }\` | Record updated |
| \`${slug}.deleted\` | \`{ id }\` | Record deleted |

## AI Tools

| Tool | Description |
|------|-------------|
| \`list_${toolNameList}\` | List records with pagination |
| \`create_${toolNameCreate}\` | Create a new record |

## Development

\`\`\`bash
bun install
bun run dev
\`\`\`

## License

MIT
`);

  return files;
}

// ============================================================
// Helper functions
// ============================================================

function toTitleCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function pascalCase(str: string): string {
  return toTitleCase(str).replace(/\s/g, '');
}

// ============================================================
// Main — Generate the plugin
// ============================================================

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const slug = args.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const outputDir = path.resolve(args.output, slug);

  // Validate slug is not empty
  if (slug.length === 0) {
    console.error('Error: Plugin name must contain at least one alphanumeric character.');
    process.exit(1);
  }

  // Check if directory already exists
  if (fs.existsSync(outputDir)) {
    console.error(`Error: Directory "${outputDir}" already exists.`);
    console.error('Use a different name or delete the existing directory.');
    process.exit(1);
  }

  // Generate template
  const files = generatePluginTemplate(args);

  // Write files to disk
  for (const [filePath, content] of files) {
    const fullPath = path.join(outputDir, filePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  // Summary
  const titleName = toTitleCase(args.name);
  const fileList = Array.from(files.keys()).map((f) => `  📄 ${f}`).join('\n');

  console.log('');
  console.log(`  ✅ Plugin "${titleName}" created successfully!`);
  console.log('');
  console.log(`  📁 Location:  ${outputDir}`);
  console.log(`  📝 ID:        aenews-${slug}`);
  console.log(`  📦 Files:     ${files.size}`);
  console.log('');
  console.log('  Generated files:');
  console.log(fileList);
  console.log('');
  console.log('  Next steps:');
  console.log(`    cd ${path.relative(process.cwd(), outputDir)}`);
  console.log('    bun install');
  console.log('    bun run dev');
  console.log('');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
