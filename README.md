<p align="center">
  <a href="https://github.com/AlterEgo095/AENEWS-CRM">
    <img src="https://img.shields.io/badge/AENEWS-Enterprise%20OS-emerald?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWNhcD0icm91bmQiIHN0cm9rZS1saW5lam9pbj0icm91bmQiPjxwYXRoIGQ9Ik0xMiAyTDE1LjA5IDguMjZMMjIgOUwyNyAyNkw1LjkxIDE3Ljc0bC02LjkxLTYuNDdIMkwyMiAyWiIvPjwvc3ZnPg==" alt="AENEWS Enterprise OS">
  </a>
</p>

<h1 align="center">AENEWS Enterprise OS</h1>

<p align="center">
  <strong>The AI-Native Business Operating System</strong>
</p>

<p align="center">
  A unified platform combining CRM, ERP, HR, Healthcare, Education, and more — powered by a plugin-first architecture and AI orchestration.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript">
  <img src="https://img.shields.io/badge/Tailwind_CSS-4-38bdf8?logo=tailwindcss" alt="Tailwind CSS 4">
  <img src="https://img.shields.io/badge/shadcn/ui-New_York-black" alt="shadcn/ui">
  <img src="https://img.shields.io/badge/Prisma-2d3748?logo=prisma" alt="Prisma">
  <img src="https://img.shields.io/badge/License-AGPL--3.0-green" alt="License">
</p>

---

## Philosophy

AENEWS Enterprise OS is **NOT** a CRM. It is a **Business Operating System** designed to manage any business sector on a single technical foundation.

> **One core. One AI. One user base. Hundreds of activatable modules.**

### Core Principles

1. **Plugin-First** — The core knows no business logic. Everything is a plugin.
2. **AI-Native** — AI is a transversal orchestrator that discovers plugin capabilities dynamically.
3. **Event-Driven** — All inter-plugin communication passes through an event bus. Zero coupling.
4. **Multi-Tenant** — Full workspace isolation with RBAC/ABAC permissions.
5. **Extensible** — SDK + Marketplace + CLI for third-party developers.

---

## Architecture

```
AENEWS OS
├── Core
│   ├── Authentication (JWT, OAuth, SSO)
│   ├── Multi-Tenant Workspaces
│   ├── Organizations & Teams
│   ├── RBAC Permissions
│   ├── File Storage
│   ├── Full-Text Search
│   ├── Notifications
│   ├── AI Orchestrator (MCP Gateway)
│   ├── Automation / Workflows
│   ├── Event Bus
│   ├── Billing (Stripe)
│   ├── Plugin Registry
│   └── Marketplace
│
├── SDK
│   ├── Plugin Definition API
│   ├── Tool Registration API
│   ├── CLI (create-aenews-app)
│   └── Type-safe Client SDK
│
├── Installed Apps (Plugins)
│   ├── CRM (Contacts, Companies, Deals, Pipeline, Activities)
│   ├── ERP (Finance, Accounting, Inventory, Procurement)
│   ├── HR (Employees, Payroll, Recruitment, Performance)
│   ├── Healthcare (Patients, Doctors, Prescriptions, Lab)
│   ├── Pharmacy (Medicines, Expiry, Stock, POS)
│   ├── Education (Students, Exams, Grades, Attendance)
│   ├── Real Estate (Properties, Contracts, Rentals, Tenants)
│   ├── Manufacturing (Machines, Production, Quality, IoT)
│   ├── Marketing (Campaigns, Email, SMS, Social Media)
│   ├── Support (Tickets, Chat, Knowledge Base)
│   ├── Projects (Kanban, Gantt, Scrum, Sprints)
│   ├── eCommerce (Catalog, Cart, Payments, Delivery)
│   └── ... (infinite extensibility via Marketplace)
│
└── Infrastructure
    └── PostgreSQL + pgvector (single DB for everything)
```

---

## AI Architecture

```
User Query
    │
    ▼
AI Orchestrator (MCP Gateway)
    │
    ├── Discover active plugins
    ├── Load their tools, schemas, resources
    ├── Route to appropriate LLM (GPT, Claude, Gemini, DeepSeek...)
    │
    ▼
Plugin Tools (auto-discovered)
    ├── CRM: findContact(), createDeal(), searchCompany()
    ├── Finance: createInvoice(), getExpenses(), generateReport()
    ├── HR: calculatePayroll(), checkLeave(), evaluatePerformance()
    ├── Pharmacy: findExpiredMedicine(), checkStock()
    └── ... any plugin can register tools
```

The AI contains **zero business logic**. Each plugin exposes tools and schemas. The AI discovers and uses them dynamically.

---

## Event Bus

All cross-plugin communication is event-driven:

```
Event: PatientCreated
  ├── CRM Plugin → creates Contact
  ├── Billing Plugin → creates Account
  ├── Notification Plugin → sends welcome email
  └── AI Plugin → generates summary
```

No direct coupling between plugins. Ever.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | Next.js 16 (App Router) |
| **Language** | TypeScript 5 |
| **Styling** | Tailwind CSS 4 + shadcn/ui |
| **State Management** | Zustand |
| **Database** | Prisma ORM (SQLite dev / PostgreSQL prod) |
| **UI Components** | shadcn/ui (New York) + Lucide Icons |
| **Animations** | Framer Motion |
| **Theme** | next-themes (Light/Dark/System) |
| **Forms** | React Hook Form + Zod |
| **AI SDK** | Vercel AI SDK (multi-provider) |
| **Icons** | Lucide React |

---

## Getting Started

### Prerequisites

- Node.js 18+ or Bun
- A package manager (bun recommended)

### Installation

```bash
# Clone the repository
git clone https://github.com/AlterEgo095/AENEWS-CRM.git
cd AENEWS-CRM

# Install dependencies
bun install

# Set up database
cp .env.example .env.local
bun run db:push
bun run db:generate

# Start development server
bun run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout (ThemeProvider, Toaster)
│   ├── page.tsx                # Main entry → PlatformLayout
│   ├── globals.css             # Global styles + CSS variables
│   └── api/
│       ├── plugins/
│       │   ├── route.ts        # GET catalog, POST install
│       │   └── [slug]/route.ts # GET/PATCH/DELETE single plugin
│       ├── notifications/route.ts
│       ├── chat/route.ts       # AI chat endpoint
│       └── audit/route.ts      # Audit log
│
├── components/
│   ├── layout/
│   │   └── platform-layout.tsx  # Sidebar + Header + ViewSwitcher
│   ├── ui/                     # shadcn/ui components
│   └── views/
│       ├── dashboard-view.tsx   # Dashboard with stats & activity
│       ├── app-store-view.tsx   # Marketplace / App Store
│       ├── chat-view.tsx        # AI Chat interface
│       ├── settings-view.tsx    # Settings & organization
│       ├── crm-view.tsx         # CRM module
│       ├── finance-view.tsx     # Finance module
│       ├── hr-view.tsx          # HR module
│       ├── stock-view.tsx       # Inventory module
│       ├── marketing-view.tsx   # Marketing module
│       ├── support-view.tsx     # Support module
│       ├── projects-view.tsx    # Projects module
│       ├── ecommerce-view.tsx   # eCommerce module
│       ├── workflows-view.tsx   # Workflows & automation
│       └── notifications-view.tsx
│
├── lib/
│   ├── db.ts                   # Prisma client
│   ├── utils.ts                # Utility functions (cn)
│   ├── plugin-registry.ts      # Core plugin system (111 plugins)
│   ├── plugin-data.ts          # Frontend plugin catalog
│   ├── event-bus.ts            # In-memory event bus
│   └── seed.ts                 # Demo data seeder
│
├── store/
│   └── app-store.ts            # Zustand global state
│
└── prisma/
    └── schema.prisma            # Database schema (19 models)
```

---

## Database Schema

19 models covering the entire platform:

| Model | Purpose |
|-------|---------|
| `Tenant` | Multi-tenant workspaces |
| `User` | User accounts |
| `Session` | Auth sessions |
| `ApiKey` | API key management |
| `Organization` | Org hierarchy (self-referencing) |
| `Role` / `UserRole` | RBAC roles & assignments |
| `Plugin` | Plugin registry / marketplace |
| `InstalledPlugin` | Per-tenant plugin installations |
| `CustomObject` | Dynamic entities (like Twenty) |
| `Notification` | User notifications |
| `AuditLog` | Activity & audit trail |
| `File` | File storage metadata |
| `ChatThread` / `ChatMessage` | AI chat conversations |
| `Workflow` / `WorkflowRun` | Automation engine |
| `Subscription` | Billing (Stripe) |
| `EventLog` | Event bus persistence |

---

## Roadmap

### Phase 1 — Core (Current)
- [x] Database schema (19 models, 7 enums)
- [x] Plugin Registry (111 plugins, 14 categories)
- [x] Event Bus (in-memory pub/sub)
- [x] Platform Layout (Sidebar, Header, Dark Mode)
- [x] Dashboard with stats & activity feed
- [x] App Store / Marketplace UI
- [x] AI Chat interface
- [x] Settings & Organization management
- [x] Backend API routes (Plugins, Chat, Notifications, Audit)
- [x] Demo data seeding

### Phase 2 — CRM Module
- [ ] Contacts management (CRUD, views, filters)
- [ ] Companies & organization tree
- [ ] Deals pipeline (Kanban + table views)
- [ ] Activities (calls, notes, tasks, calendar)
- [ ] Email integration (IMAP sync)
- [ ] Custom fields & views
- [ ] Import/Export (CSV, Excel)

### Phase 3 — Automation & AI
- [ ] Workflow builder (visual drag-and-drop)
- [ ] MCP Gateway (AI ↔ Plugin tool discovery)
- [ ] Multi-LLM support (GPT, Claude, Gemini, DeepSeek)
- [ ] RAG integration (pgvector)
- [ ] AI Agent builder

### Phase 4 — Vertical Modules
- [ ] ERP (Finance, Stock, Procurement)
- [ ] HR (Payroll, Leave, Recruitment)
- [ ] Healthcare (Patients, Prescriptions)
- [ ] Education (Students, Exams, Grades)
- [ ] Real Estate (Properties, Rentals)
- [ ] Marketplace for third-party plugins

### Phase 5 — Platform
- [ ] SDK & CLI (`create-aenews-app`)
- [ ] Plugin versioning & updates
- [ ] Visual Form Builder
- [ ] Visual Page Builder
- [ ] Dashboard Builder
- [ ] Widget Builder
- [ ] White-label / Theme Engine
- [ ] Mobile app (PWA → Native)

---

## Contributing

AENEWS follows a plugin-first architecture. To contribute:

1. Fork the repository
2. Create a feature branch
3. Follow the existing code patterns
4. Submit a PR with a clear description

See the [Architecture Guide](docs/architecture.md) for plugin development guidelines.

---

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

---

## Acknowledgments

- [Twenty CRM](https://github.com/twentyhq/twenty) — Reference architecture for plugin system & custom objects
- [shadcn/ui](https://ui.shadcn.com/) — UI component library
- [Next.js](https://nextjs.org/) — React framework
- [Prisma](https://prisma.io/) — Database ORM

---

<p align="center">
  <strong>AENEWS Enterprise OS</strong> — Build any business. One platform.
</p>
