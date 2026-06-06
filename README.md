<p align="center">
  <a href="https://github.com/AlterEgo095/AENEWS-CRM">
    <img src="https://img.shields.io/badge/AENEWS-Enterprise%20OS-emerald?style=for-the-badge" alt="AENEWS Enterprise OS">
  </a>
</p>

<h1 align="center">AENEWS Enterprise OS</h1>

<p align="center">
  <strong>The Plugin-First AI-Native Business Operating System</strong>
</p>

<p align="center">
  A platform to build <em>any</em> business. CRM, ERP, HR, Healthcare, Pharmacy, Education, Real Estate, Manufacturing — all as plugins. One core. Zero business logic in the kernel.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript 5">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss" alt="Tailwind CSS 4">
  <img src="https://img.shields.io/badge/shadcn%2Fui-New_York-black" alt="shadcn/ui">
  <img src="https://img.shields.io/badge/Prisma-2d3748?logo=prisma" alt="Prisma">
  <img src="https://img.shields.io/badge/Zustand-orange?logo=react" alt="Zustand">
</p>

---

## ⚠️ Status: Core Development

AENEWS is currently in **Core development**. The foundation is being built — no business modules yet. The goal is a rock-solid platform engine that allows any plugin to be added without touching the core.

> **"Arrête temporairement le développement des fonctionnalités visibles et investis d'abord dans un Plugin SDK, un Plugin Loader, un Event Bus, un AI Gateway (MCP compatible), un Module Registry et un système de découverte automatique des capacités."**

---

## Philosophy

AENEWS Enterprise OS is **NOT** a CRM. It is a **Business Operating System** designed to manage any business sector on a single technical foundation.

### Core Principles

1. **Plugin-First** — The core knows **zero** business logic. Everything is a plugin.
2. **AI-Native** — AI discovers plugin capabilities dynamically via the MCP Gateway. Zero hardcoded AI↔plugin coupling.
3. **Event-Driven** — All inter-plugin communication passes through the Event Bus. Zero coupling.
4. **Multi-Tenant** — Full workspace isolation with RBAC permissions.
5. **Extensible** — SDK + CLI + Marketplace. Third-party developers build plugins.

---

## Core Architecture

```
src/core/
├── plugin-sdk/            # Plugin Manifest spec + definePlugin() API
│   ├── manifest.ts        # TypeScript interfaces for plugin.json
│   ├── index.ts           # SDK: definePlugin(), validateManifest()
│   └── templates/         # Templates for plugin developers
│
├── plugin-loader/         # Plugin lifecycle engine
│   └── index.ts           # scan → resolve deps → load → install → activate
│
├── plugin-registry/       # Plugin registry & marketplace
│
├── tool-registry/         # Central registry of AI-callable tools
│   └── index.ts           # register/get/invoke + MCP export
│
├── event-store/           # Persistent event storage
│   └── index.ts           # persist / replay / query / aggregate
│
├── mcp/                   # MCP Gateway (AI ↔ Plugin bridge)
│   └── index.ts           # tool discovery + execution + agentic loop
│
├── ai-gateway/            # AI provider abstraction
│   └── index.ts           # multi-provider LLM adapter
│
├── auth/                  # Authentication system
│   └── index.ts           # JWT sessions + API keys
│
├── tenant/                # Multi-tenant workspace management
│   └── index.ts           # create / settings / plugin status
│
├── permission/             # RBAC engine
│   └── index.ts           # roles / permissions / require() guards
│
└── cli/                   # Plugin development CLI
    └── create-plugin.ts   # npx create-aenews-plugin <name>
```

---

## Plugin Lifecycle

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Scan    │───▶│  Resolve │───▶│   Load   │───▶│ Install  │───▶│ Activate │
│ plugins/ │    │  deps    │    │ manifest │    │ migrate  │    │ register │
└──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘
                                                                      │
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐         │
│  Remove  │◀───│Uninstall │◀───│Deactivate│◀───│  Error   │◀────────┘
│          │    │ rollback │    │ unregister│    │  handle  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### What the Plugin Loader does:
1. **Scan** the `plugins/` directory for valid `plugin.json` manifests
2. **Resolve** dependency graph (topological sort, cycle detection)
3. **Load** plugin server entries via dynamic `import()`
4. **Install**: run migrations, create DB records, call `onInstall()`
5. **Activate**: register tools, events, routes, menus, permissions for tenant
6. **Deactivate**: unregister everything, call `onDeactivate()`
7. **Uninstall**: run down migrations, delete data, call `onUninstall()`
8. **Reload**: hot-reload for development (`dev` mode)

---

## Plugin Manifest

Every plugin MUST have a `plugin.json`:

```json
{
  "aenews": "1",
  "id": "aenews-crm-contacts",
  "name": "CRM Contacts",
  "slug": "crm-contacts",
  "version": "1.0.0",
  "description": "Manage customer and lead contacts",
  "author": "AENEWS",
  "license": "MIT",
  "coreVersion": "0.1.0",

  "dependencies": [
    { "pluginId": "aenews-crm-core", "version": "^1.0.0", "optional": false }
  ],

  "capabilities": [
    { "type": "object", "name": "contact", "description": "Contact entity" },
    { "type": "view", "name": "contact-list", "description": "Contact list view" },
    { "type": "tool", "name": "create_contact", "description": "AI tool" }
  ],

  "entry": {
    "server": "./dist/server.js"
  },

  "permissions": [
    { "id": "crm.contacts.read", "name": "Read Contacts", "category": "crm" },
    { "id": "crm.contacts.write", "name": "Write Contacts", "category": "crm" }
  ],

  "settings": [
    { "key": "default_view", "type": "select", "label": "Default View", "scope": "tenant", "options": [...] }
  ],

  "menus": [
    { "id": "contacts", "label": "Contacts", "icon": "Users", "href": "/contacts", "section": "CRM", "order": 1 }
  ],

  "events": [
    { "type": "contact.created", "payloadSchema": { "type": "object", "properties": { "id": { "type": "string" } } } }
  ],

  "migrations": [
    { "version": "0.1.0", "name": "create_contacts_table", "up": "CREATE TABLE contacts (...)" }
  ]
}
```

---

## Plugin SDK Usage

Plugin developers use `definePlugin()` to build plugins:

```typescript
import { definePlugin } from '@aenews/plugin-sdk';
import manifest from './plugin.json';

export default definePlugin({
  manifest,

  onInstall: async (ctx) => {
    ctx.logger.info('Installing contacts plugin...');
  },

  onActivate: async (ctx) => {
    ctx.logger.info('Contacts plugin activated');
  },

  tools: {
    create_contact: {
      description: 'Create a new contact',
      parameters: {
        type: 'object',
        properties: {
          firstName: { type: 'string' },
          lastName: { type: 'string' },
          email: { type: 'string' },
        },
        required: ['firstName', 'lastName'],
      },
      execute: async (params, ctx) => {
        const contact = await ctx.db.contact.create({ data: params });
        await ctx.eventBus.emit('contact.created', contact);
        return contact;
      },
    },
  },

  events: {
    'contact.created': {
      handler: async (payload, ctx) => {
        await ctx.eventBus.emit('notification.send', {
          message: `New contact: ${payload.firstName}`,
        });
      },
    },
  },
});
```

---

## CLI: Create a Plugin

```bash
# Generate a complete plugin scaffold
npx create-aenews-plugin hospital

# With options
npx create-aenews-plugin inventory --category ops --author "Acme Inc"
npx create-aenews-plugin support-bot --description "AI support chatbot" --output ./my-plugins
```

This generates:
```
hospital/
├── plugin.json        # Full manifest (capabilities, permissions, events, routes, menus)
├── package.json       # NPM package config
├── tsconfig.json      # TypeScript config
├── src/
│   ├── server.ts      # Plugin entry point (definePlugin with lifecycle + tools)
│   └── types.ts       # TypeScript interfaces
└── README.md           # Auto-generated documentation
```

---

## MCP Gateway: AI ↔ Plugin

The MCP Gateway enables AI to discover and use plugin tools dynamically:

```
User: "Create a new contact named John Doe"
    │
    ▼
MCP Gateway
    ├── getTools(tenantId)     → discovers all tools from active plugins
    ├── buildSystemPrompt()    → generates prompt with tool descriptions
    ├── call LLM               → AI decides to call "crm.contacts.create"
    ├── executeTool()          → calls the plugin's handler
    ├── feed result back       → AI generates final response
    └── return to user         → "Contact John Doe created successfully"
```

The AI contains **zero** business logic. It discovers tools at runtime.

---

## Event Bus

All cross-plugin communication is event-driven:

```
Event: contact.created
  ├── Notification Plugin → sends welcome email
  ├── Billing Plugin → creates account
  ├── Analytics Plugin → tracks metric
  └── AI Plugin → generates summary
```

Events are persisted to the database for replay and auditing.

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/login` | POST | Login with email + password |
| `/api/auth/register` | POST | Create workspace + user |
| `/api/auth/logout` | POST | Invalidate session |
| `/api/auth/me` | GET | Get current user |
| `/api/tenants` | GET/POST | Tenant management |
| `/api/plugins` | GET/POST | Plugin catalog + install |
| `/api/plugins/[slug]` | GET/PATCH/DELETE | Plugin detail + update + remove |
| `/api/chat` | GET/POST | AI chat with tool discovery |
| `/api/notifications` | GET/POST | User notifications |
| `/api/audit` | GET | Audit log |

---

## Reference Plugin: CRM Contacts

The `plugins/crm-contacts/` directory contains the first reference plugin demonstrating:
- Full `plugin.json` manifest with all sections
- 3 AI tools (`create_contact`, `search_contacts`, `get_contact`)
- 3 event handlers with cross-plugin emission
- 5 REST API route handlers
- Global search integration
- Permission-scoped operations

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 (strict) |
| **Styling** | Tailwind CSS 4 + shadcn/ui (New York) |
| **State** | Zustand |
| **Database** | Prisma ORM (SQLite dev / PostgreSQL prod) |
| **AI** | z-ai-web-dev-sdk (multi-provider) |
| **Icons** | Lucide React |
| **Animations** | Framer Motion |

---

## Project Structure

```
src/
├── core/                    # AENEWS Core Platform (plugin engine)
│   ├── plugin-sdk/          # Manifest types + definePlugin() API
│   ├── plugin-loader/       # Scan, resolve, load, lifecycle management
│   ├── plugin-registry/     # Plugin catalog & marketplace
│   ├── tool-registry/       # AI tool discovery & execution
│   ├── event-store/         # Persistent event storage
│   ├── mcp/                 # MCP Gateway (AI ↔ Plugin)
│   ├── ai-gateway/          # AI provider abstraction
│   ├── auth/                # Authentication & sessions
│   ├── tenant/              # Multi-tenant workspaces
│   ├── permission/          # RBAC engine
│   └── cli/                 # create-aenews-plugin CLI
│
├── app/
│   ├── layout.tsx           # Root layout
│   ├── page.tsx             # Auth gate → Platform
│   └── api/                 # REST API routes
│
├── components/
│   ├── layout/              # Platform sidebar + header
│   ├── ui/                  # shadcn/ui components
│   └── views/               # Module views (stubs)
│
├── lib/                     # Shared utilities
│   ├── db.ts                # Prisma client
│   ├── plugin-registry.ts   # Static plugin catalog
│   ├── plugin-data.ts       # Frontend catalog data
│   ├── event-bus.ts         # In-memory pub/sub
│   └── utils.ts
│
├── store/                   # Zustand stores
│
└── prisma/
    └── schema.prisma         # 19 models, 7 enums

plugins/
└── crm-contacts/             # Reference plugin
    ├── plugin.json
    └── src/index.ts
```

---

## Roadmap

### ✅ Phase 1 — Core Foundation (Current)
- [x] Database schema (19 models, 7 enums)
- [x] Plugin Manifest specification (`plugin.json`)
- [x] Plugin SDK (`definePlugin()` API)
- [x] Plugin Loader (scan → resolve → load → install → activate)
- [x] Tool Registry (AI tool discovery + MCP export)
- [x] Event Store (persist / replay / query / aggregate)
- [x] MCP Gateway (AI ↔ Plugin tool discovery)
- [x] AI Gateway (multi-provider abstraction)
- [x] Auth System (JWT sessions + API keys)
- [x] Tenant Service (multi-tenant workspaces)
- [x] RBAC Engine (roles / permissions / guards)
- [x] CLI (`create-aenews-plugin`)
- [x] Reference Plugin (CRM Contacts)
- [x] API Routes (Auth, Tenants, Plugins, Chat, Notifications, Audit)
- [x] Platform UI (Sidebar, Header, Dashboard, App Store)

### 🔲 Phase 2 — Core Hardening
- [ ] View Engine (dynamic views from plugin manifests)
- [ ] Custom Objects / Custom Fields engine
- [ ] Search Engine (full-text across plugins)
- [ ] Storage abstraction (local / S3 / GCS)
- [ ] Plugin sandboxing / isolation
- [ ] Plugin hot-reload (dev mode)
- [ ] Plugin versioning & migration system
- [ ] Settings engine (per-tenant plugin settings)
- [ ] Automation / Workflow engine
- [ ] Billing integration (Stripe)

### 🔲 Phase 3 — First Official Plugin (CRM)
- [ ] CRM Core (Contacts, Companies, Deals)
- [ ] CRM Pipeline (Kanban + table views)
- [ ] CRM Activities (calls, notes, tasks, calendar)
- [ ] CRM Email (IMAP sync, templates, sequences)
- [ ] CRM Import/Export (CSV, Excel)
- [ ] CRM Custom fields & views

### 🔲 Phase 4 — Ecosystem
- [ ] Plugin Marketplace (public directory)
- [ ] Plugin review & security scanning
- [ ] Visual Form Builder
- [ ] Visual Page Builder
- [ ] Dashboard Builder
- [ ] AI Agent Builder

---

## Getting Started

```bash
# Clone
git clone https://github.com/AlterEgo095/AENEWS-CRM.git
cd AENEWS-CRM

# Install
bun install

# Database
bun run db:push

# Dev server
bun run dev
```

### Create a plugin

```bash
npx create-aenews-plugin my-module
cd plugins/my-module
bun run dev
```

---

## License

**AGPL-3.0** — This is a platform. Use it. Extend it. Contribute plugins back.

---

<p align="center">
  <strong>AENEWS Enterprise OS</strong> — Build any business. One platform. Infinite plugins.
</p>
