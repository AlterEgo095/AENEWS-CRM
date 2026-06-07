'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import * as LucideIcons from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  Search,
  Plus,
  Users,
  Mail,
  Phone,
  Building2,
  MoreHorizontal,
  Filter,
  LayoutGrid,
  List,
  ArrowUpDown,
  Bot,
  Wrench,
  Zap,
  BookOpen,
  FileCode,
  Layout,
  UserCircle,
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// ============================================================
// Types
// ============================================================

interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  status: 'active' | 'inactive' | 'lead' | 'prospect' | 'customer';
  tags: string[];
  lastContactAt: string;
  source: string;
  notes: string;
}

// ============================================================
// Seed Data (removed — now using real API)
// ============================================================

// CRM Plugin capabilities
const CRM_CAPABILITIES = [
  { name: 'Search Contacts', engine: 'Capability Registry', icon: 'Zap', id: 'crm.contacts.search' },
  { name: 'Create Contact', engine: 'Capability Registry', icon: 'Zap', id: 'crm.contacts.create' },
  { name: 'Read Contact', engine: 'Capability Registry', icon: 'Zap', id: 'crm.contacts.read' },
  { name: 'Update Contact', engine: 'Capability Registry', icon: 'Zap', id: 'crm.contacts.update' },
  { name: 'Delete Contact', engine: 'Capability Registry', icon: 'Zap', id: 'crm.contacts.delete' },
  { name: 'Analyze Contacts', engine: 'Capability Registry', icon: 'Zap', id: 'crm.contacts.analyze' },
];

const CRM_TOOLS = [
  { name: 'create_contact', engine: 'Tool Registry', icon: 'Wrench' },
  { name: 'search_contacts', engine: 'Tool Registry', icon: 'Wrench' },
  { name: 'get_contact', engine: 'Tool Registry', icon: 'Wrench' },
];

const CRM_KNOWLEDGE = [
  { name: 'Contact Best Practices', engine: 'Knowledge Registry', icon: 'BookOpen' },
  { name: 'Data Privacy Policy', engine: 'Knowledge Registry', icon: 'BookOpen' },
  { name: 'Contacts FAQ', engine: 'Knowledge Registry', icon: 'BookOpen' },
];

const CRM_SCHEMAS = [
  { name: 'Contact Schema', engine: 'Schema Registry', icon: 'FileCode' },
];

// ============================================================
// Status badge styles
// ============================================================

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  inactive: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700',
  lead: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  prospect: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300 border-sky-200 dark:border-sky-800',
  customer: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300 border-violet-200 dark:border-violet-800',
};

const TAG_STYLES: Record<string, string> = {
  vip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  partner: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
  lead: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  customer: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300',
};

// ============================================================
// CRM Contacts View
// ============================================================

export default function CrmContactsView() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [sortField, setSortField] = useState<string>('lastName');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [showNewContactDialog, setShowNewContactDialog] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch contacts from API
  const fetchContacts = useCallback(async (query?: string) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (activeTab !== 'all') params.set('status', activeTab);
      params.set('sort', sortField);
      params.set('order', sortDirection);
      params.set('limit', '100');
      const res = await fetch(`/api/crm/contacts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(
          data.contacts.map((c: any) => ({
            ...c,
            phone: c.phone || '',
            company: c.company || '',
            title: c.title || '',
            email: c.email || '',
            lastContactAt: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : '',
          }))
        );
      }
    } catch (err) {
      console.error('Failed to fetch contacts:', err);
    } finally {
      setLoading(false);
    }
  }, [activeTab, sortField, sortDirection]);

  // Load on mount and when tab changes
  useEffect(() => {
    let cancelled = false;
    (async () => { await fetchContacts(); })();
    return () => { cancelled = true; };
  }, [fetchContacts]);

  // Debounced search
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => { await fetchContacts(searchQuery); }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [searchQuery, fetchContacts]);

  // Filter contacts
  const filteredContacts = useMemo(() => {
    let result = [...contacts];

    // Tab filter
    if (activeTab !== 'all') {
      result = result.filter((c) => c.status === activeTab);
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.firstName.toLowerCase().includes(q) ||
          c.lastName.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q) ||
          c.company.toLowerCase().includes(q) ||
          c.title.toLowerCase().includes(q)
      );
    }

    // Sort
    result.sort((a, b) => {
      const aVal = (a as Record<string, any>)[sortField] || '';
      const bVal = (b as Record<string, any>)[sortField] || '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortDirection === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [contacts, activeTab, searchQuery, sortField, sortDirection]);

  // Stats
  const stats = useMemo(() => ({
    total: contacts.length,
    active: contacts.filter((c) => c.status === 'active').length,
    leads: contacts.filter((c) => c.status === 'lead').length,
    prospects: contacts.filter((c) => c.status === 'prospect').length,
    customers: contacts.filter((c) => c.status === 'customer').length,
  }), [contacts]);

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Users className="h-6 w-6 text-emerald-500" />
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Contacts</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            CRM Contact Management — Powered by AENEWS Plugin Engine
          </p>
        </div>
        <Button
          onClick={() => setShowNewContactDialog(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Contact
        </Button>
      </div>

      {/* ─── Stats Cards ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <MiniStat label="Total" value={stats.total} color="text-foreground" />
        <MiniStat label="Active" value={stats.active} color="text-emerald-600 dark:text-emerald-400" />
        <MiniStat label="Leads" value={stats.leads} color="text-amber-600 dark:text-amber-400" />
        <MiniStat label="Prospects" value={stats.prospects} color="text-sky-600 dark:text-sky-400" />
        <MiniStat label="Customers" value={stats.customers} color="text-violet-600 dark:text-violet-400" />
      </div>

      {/* ─── Tabs + Search + View Toggle ─── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <TabsList>
            <TabsTrigger value="all">All Contacts</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="lead">Leads</TabsTrigger>
            <TabsTrigger value="prospect">Prospects</TabsTrigger>
            <TabsTrigger value="customer">Customers</TabsTrigger>
          </TabsList>

          <div className="flex-1" />

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search contacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-[200px] lg:w-[260px]"
              />
            </div>

            {/* View mode toggle */}
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-none"
                onClick={() => setViewMode('table')}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-none"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}
          </span>
          {searchQuery && (
            <button className="text-xs hover:underline" onClick={() => setSearchQuery('')}>
              Clear search
            </button>
          )}
        </div>

        {/* ─── All Tab Content ─── */}
        <TabsContent value="all" className="mt-0">
          {renderContacts(filteredContacts, viewMode, sortField, sortDirection, toggleSort)}
        </TabsContent>
        <TabsContent value="active" className="mt-0">
          {renderContacts(filteredContacts, viewMode, sortField, sortDirection, toggleSort)}
        </TabsContent>
        <TabsContent value="lead" className="mt-0">
          {renderContacts(filteredContacts, viewMode, sortField, sortDirection, toggleSort)}
        </TabsContent>
        <TabsContent value="prospect" className="mt-0">
          {renderContacts(filteredContacts, viewMode, sortField, sortDirection, toggleSort)}
        </TabsContent>
        <TabsContent value="customer" className="mt-0">
          {renderContacts(filteredContacts, viewMode, sortField, sortDirection, toggleSort)}
        </TabsContent>
      </Tabs>

      {/* ─── Loading skeleton ─── */}
      {loading && contacts.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* ─── New Contact Dialog (simple inline form) ─── */}
      {showNewContactDialog && (
        <NewContactInline
          onAdd={(contact) => {
            setContacts((prev) => [contact, ...prev]);
            setShowNewContactDialog(false);
          }}
          onCancel={() => setShowNewContactDialog(false)}
        />
      )}

      {/* ═══════════════════════════════════════════════════════════
          SECTION: Engine Capabilities Being Used
          ═══════════════════════════════════════════════════════════ */}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-emerald-500" />
          <h2 className="text-lg font-semibold">Engine Capabilities in Use</h2>
          <Badge variant="outline" className="ml-1 text-[10px]">
            {CRM_CAPABILITIES.length + CRM_TOOLS.length + CRM_KNOWLEDGE.length + CRM_SCHEMAS.length} registered
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Capabilities */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Zap className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <CardTitle className="text-sm">Capabilities</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {CRM_CAPABILITIES.map((cap) => (
                  <div key={cap.id} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="truncate">{cap.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Tools */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Wrench className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <CardTitle className="text-sm">AI Tools</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {CRM_TOOLS.map((tool) => (
                  <div key={tool.name} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                    <span className="truncate">{tool.name}</span>
                    <Badge variant="outline" className="text-[9px] ml-auto shrink-0">
                      {tool.engine}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Knowledge */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-100 dark:bg-sky-900/30">
                  <BookOpen className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                </div>
                <CardTitle className="text-sm">Knowledge Base</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {CRM_KNOWLEDGE.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-sky-500 shrink-0" />
                    <span className="truncate">{entry.name}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Schemas */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <FileCode className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <CardTitle className="text-sm">Schemas</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {CRM_SCHEMAS.map((schema) => (
                  <div key={schema.name} className="flex items-center gap-2 text-sm">
                    <div className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                    <span className="truncate">{schema.name}</span>
                    <Badge variant="outline" className="text-[9px] ml-auto shrink-0">
                      {schema.engine}
                    </Badge>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-1.5 w-1.5 rounded-full bg-violet-500 shrink-0" />
                  <span className="truncate">Contact (11 fields, 4 indexes)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

// ============================================================
// Render contacts based on view mode
// ============================================================

function renderContacts(
  contacts: Contact[],
  viewMode: 'table' | 'grid',
  sortField: string,
  sortDirection: string,
  toggleSort: (field: string) => void,
) {
  if (contacts.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <h3 className="font-semibold mb-1">No contacts found</h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            Try adjusting your search or filter, or add a new contact.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {contacts.map((contact) => (
          <ContactCard key={contact.id} contact={contact} />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('lastName')}
              >
                <div className="flex items-center gap-1">
                  Name
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hidden md:table-cell"
                onClick={() => toggleSort('email')}
              >
                <div className="flex items-center gap-1">
                  Email
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </TableHead>
              <TableHead
                className="cursor-pointer select-none hidden lg:table-cell"
                onClick={() => toggleSort('company')}
              >
                <div className="flex items-center gap-1">
                  Company
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </TableHead>
              <TableHead className="hidden xl:table-cell">Title</TableHead>
              <TableHead
                className="cursor-pointer select-none"
                onClick={() => toggleSort('status')}
              >
                <div className="flex items-center gap-1">
                  Status
                  <ArrowUpDown className="h-3.5 w-3.5" />
                </div>
              </TableHead>
              <TableHead className="hidden xl:table-cell">Source</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {contacts.map((contact) => (
              <ContactTableRow key={contact.id} contact={contact} />
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Contact Table Row
// ============================================================

function ContactTableRow({ contact }: { contact: Contact }) {
  const initials = `${contact.firstName[0]}${contact.lastName[0]}`;

  return (
    <TableRow className="group hover:bg-muted/50">
      <TableCell>
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-[11px] bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">
              {contact.firstName} {contact.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate md:hidden">
              {contact.email}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        <div className="flex items-center gap-1.5 text-sm">
          <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{contact.email}</span>
        </div>
      </TableCell>
      <TableCell className="hidden lg:table-cell">
        <div className="flex items-center gap-1.5 text-sm">
          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="truncate">{contact.company}</span>
        </div>
      </TableCell>
      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
        {contact.title}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={`text-[10px] ${STATUS_STYLES[contact.status] || ''}`}
        >
          {contact.status}
        </Badge>
      </TableCell>
      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
        {contact.source}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>View Details</DropdownMenuItem>
            <DropdownMenuItem>Edit Contact</DropdownMenuItem>
            <DropdownMenuItem>Send Email</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// ============================================================
// Contact Card (grid view)
// ============================================================

function ContactCard({ contact }: { contact: Contact }) {
  const initials = `${contact.firstName[0]}${contact.lastName[0]}`;

  return (
    <Card className="hover:shadow-md transition-shadow group">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">
                {contact.firstName} {contact.lastName}
              </h3>
              <p className="text-xs text-muted-foreground truncate">{contact.title}</p>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-[9px] shrink-0 ${STATUS_STYLES[contact.status] || ''}`}
          >
            {contact.status}
          </Badge>
        </div>

        {/* Contact info */}
        <div className="space-y-1.5 text-sm">
          {contact.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{contact.phone}</span>
            </div>
          )}
          {contact.company && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{contact.company}</span>
            </div>
          )}
        </div>

        {/* Tags */}
        {contact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-3">
            {contact.tags.map((tag) => (
              <Badge
                key={tag}
                variant="outline"
                className={`text-[9px] ${TAG_STYLES[tag] || 'bg-slate-100 text-slate-600'}`}
              >
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Actions */}
        <Separator className="my-3" />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="flex-1 h-7 text-xs">
            View
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
            <Mail className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
            <Phone className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Mini Stat Card
// ============================================================

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="py-3 px-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className={`text-lg font-bold ${color}`}>{value}</span>
      </div>
    </Card>
  );
}

// ============================================================
// New Contact Inline Form
// ============================================================

function NewContactInline({
  onAdd,
  onCancel,
}: {
  onAdd: (contact: Contact) => void;
  onCancel: () => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState('lead');

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/crm/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
          company: company.trim() || undefined,
          title: title.trim() || undefined,
          status: status || 'lead',
          tags: ['lead'],
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const c = data.contact;
        const newContact: Contact = {
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email || '',
          phone: c.phone || '',
          company: c.company || '',
          title: c.title || '',
          status: c.status as Contact['status'],
          tags: c.tags || [],
          lastContactAt: c.createdAt ? new Date(c.createdAt).toISOString().split('T')[0] : '',
          source: c.source || 'Manual',
          notes: c.notes || '',
        };
        onAdd(newContact);
      } else {
        console.error('Failed to create contact');
      }
    } catch (err) {
      console.error('Failed to create contact:', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="border-emerald-200 dark:border-emerald-800">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCircle className="h-5 w-5 text-emerald-500" />
            <CardTitle className="text-lg">New Contact</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
        <CardDescription>
          Create a new contact using the crm.contacts.create capability
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">First Name *</label>
              <Input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="John"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Last Name *</label>
              <Input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Smith"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="john@example.com"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Company</label>
              <Input
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Acme Corp"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Title</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VP of Engineering"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="prospect">Prospect</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="submit"
              disabled={!firstName.trim() || !lastName.trim() || submitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {submitting ? 'Creating...' : 'Create Contact'}
            </Button>
            <span className="text-xs text-muted-foreground">
              Uses Tool: create_contact · Permission: crm.contacts.write
            </span>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
