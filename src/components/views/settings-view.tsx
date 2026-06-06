'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Users,
  Shield,
  Link2,
  CreditCard,
  Building2,
  Upload,
  Plus,
  MoreHorizontal,
  Mail,
  Globe,
  Clock,
  Languages,
  Check,
  X,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

const members = [
  { id: '1', name: 'Admin User', email: 'admin@aenews.com', role: 'Owner', status: 'Active', joined: 'Jan 2024' },
  { id: '2', name: 'Sarah Chen', email: 'sarah@aenews.com', role: 'Admin', status: 'Active', joined: 'Feb 2024' },
  { id: '3', name: 'Mike Torres', email: 'mike@aenews.com', role: 'Manager', status: 'Active', joined: 'Mar 2024' },
  { id: '4', name: 'Lisa Park', email: 'lisa@aenews.com', role: 'Editor', status: 'Active', joined: 'Apr 2024' },
  { id: '5', name: 'James Wu', email: 'james@aenews.com', role: 'Viewer', status: 'Invited', joined: 'Jun 2024' },
];

const roles = [
  {
    name: 'Owner',
    description: 'Full access to all features and settings',
    permissions: { read: true, write: true, delete: true, admin: true, billing: true, users: true },
  },
  {
    name: 'Admin',
    description: 'Access to all features except billing',
    permissions: { read: true, write: true, delete: true, admin: true, billing: false, users: true },
  },
  {
    name: 'Manager',
    description: 'Manage content and team workflows',
    permissions: { read: true, write: true, delete: false, admin: false, billing: false, users: false },
  },
  {
    name: 'Editor',
    description: 'Create and edit content',
    permissions: { read: true, write: true, delete: false, admin: false, billing: false, users: false },
  },
  {
    name: 'Viewer',
    description: 'Read-only access to content',
    permissions: { read: true, write: false, delete: false, admin: false, billing: false, users: false },
  },
];

const integrations = [
  { name: 'Google Workspace', description: 'Gmail, Calendar, Drive', icon: Mail, connected: true, color: 'bg-red-100 text-red-600' },
  { name: 'Microsoft 365', description: 'Outlook, Teams, OneDrive', icon: Globe, connected: false, color: 'bg-blue-100 text-blue-600' },
  { name: 'Stripe', description: 'Payment processing', icon: CreditCard, connected: true, color: 'bg-purple-100 text-purple-600' },
  { name: 'Slack', description: 'Team communication', icon: MessageSquare, connected: false, color: 'bg-amber-100 text-amber-600' },
  { name: 'GitHub', description: 'Code repository', icon: GitBranch, connected: true, color: 'bg-gray-100 text-gray-600' },
  { name: 'Zapier', description: 'Workflow automation', icon: Zap, connected: false, color: 'bg-orange-100 text-orange-600' },
];

function MessageSquare(props: React.ComponentProps<typeof Mail>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function GitBranch(props: React.ComponentProps<typeof Mail>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <line x1="6" x2="6" y1="3" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

function Zap(props: React.ComponentProps<typeof Mail>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  );
}

export default function SettingsView() {
  const [activeTab, setActiveTab] = useState('general');

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Settings className="h-6 w-6 text-emerald-600" />
          Settings
        </h1>
        <p className="text-muted-foreground mt-1">
          Manage your organization settings, members, and integrations.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="general" className="gap-2">
              <Building2 className="h-4 w-4" />
              General
            </TabsTrigger>
            <TabsTrigger value="members" className="gap-2">
              <Users className="h-4 w-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="roles" className="gap-2">
              <Shield className="h-4 w-4" />
              Roles & Permissions
            </TabsTrigger>
            <TabsTrigger value="integrations" className="gap-2">
              <Link2 className="h-4 w-4" />
              Integrations
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <CreditCard className="h-4 w-4" />
              Billing
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Organization Details</CardTitle>
                <CardDescription>Manage your organization name and branding.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="org-name">Organization Name</Label>
                    <Input id="org-name" defaultValue="AENEWS Corp" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="org-slug">Slug</Label>
                    <Input id="org-slug" defaultValue="aenews-corp" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Timezone</Label>
                    <Select defaultValue="utc-8">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="utc-8">UTC-8 (Pacific)</SelectItem>
                        <SelectItem value="utc-5">UTC-5 (Eastern)</SelectItem>
                        <SelectItem value="utc+0">UTC+0 (London)</SelectItem>
                        <SelectItem value="utc+8">UTC+8 (Singapore)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Language</Label>
                    <Select defaultValue="en">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="en">English</SelectItem>
                        <SelectItem value="zh">Chinese</SelectItem>
                        <SelectItem value="es">Spanish</SelectItem>
                        <SelectItem value="ja">Japanese</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Currency</Label>
                    <Select defaultValue="usd">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="usd">USD ($)</SelectItem>
                        <SelectItem value="eur">EUR (€)</SelectItem>
                        <SelectItem value="gbp">GBP (£)</SelectItem>
                        <SelectItem value="cny">CNY (¥)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Organization Logo</Label>
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 rounded-xl border-2 border-dashed flex items-center justify-center bg-muted/50">
                      <Building2 className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <Button variant="outline" size="sm">
                      <Upload className="h-4 w-4 mr-2" />
                      Upload Logo
                    </Button>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    onClick={() => toast.success('Settings saved successfully')}
                  >
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="members" className="mt-6 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Team Members</CardTitle>
                  <CardDescription>{members.length} members in your organization</CardDescription>
                </div>
                <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
                  <Plus className="h-4 w-4 mr-1" />
                  Invite
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead className="hidden sm:table-cell">Role</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      <TableHead className="hidden md:table-cell">Joined</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member) => (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-xs">
                                {member.name.split(' ').map((n) => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-sm font-medium">{member.name}</p>
                              <p className="text-xs text-muted-foreground">{member.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant="secondary">{member.role}</Badge>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge
                            variant={member.status === 'Active' ? 'default' : 'secondary'}
                            className={
                              member.status === 'Active'
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                                : ''
                            }
                          >
                            {member.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                          {member.joined}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Edit Role</DropdownMenuItem>
                              <DropdownMenuItem>Remove</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Roles & Permissions</CardTitle>
                <CardDescription>Configure what each role can access.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Role</TableHead>
                      <TableHead className="text-center">Read</TableHead>
                      <TableHead className="text-center">Write</TableHead>
                      <TableHead className="text-center hidden sm:table-cell">Delete</TableHead>
                      <TableHead className="text-center hidden md:table-cell">Admin</TableHead>
                      <TableHead className="text-center hidden md:table-cell">Billing</TableHead>
                      <TableHead className="text-center hidden lg:table-cell">Users</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roles.map((role) => (
                      <TableRow key={role.name}>
                        <TableCell>
                          <div>
                            <p className="text-sm font-medium">{role.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {role.description}
                            </p>
                          </div>
                        </TableCell>
                        {Object.entries(role.permissions).map(([perm, enabled]) => (
                          <TableCell key={perm} className="text-center">
                            {enabled ? (
                              <Check className="h-4 w-4 text-emerald-600 mx-auto" />
                            ) : (
                              <X className="h-4 w-4 text-muted-foreground/30 mx-auto" />
                            )}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="mt-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {integrations.map((integration) => (
                <Card key={integration.name} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start gap-3">
                      <div className={`rounded-lg p-2.5 ${integration.color}`}>
                        <integration.icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm">{integration.name}</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {integration.description}
                        </p>
                        {integration.connected ? (
                          <Badge className="mt-2 bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300 text-[10px]">
                            Connected
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 h-7 text-xs"
                            onClick={() => toast.success(`${integration.name} connected!`)}
                          >
                            Connect
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="billing" className="mt-6 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Current Plan</CardTitle>
                <CardDescription>Manage your subscription and billing.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl border bg-gradient-to-r from-emerald-50 to-white dark:from-emerald-950/30 dark:to-card">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold">Business Pro</h3>
                      <Badge className="bg-emerald-600 text-white text-[10px]">Active</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      $99/month · Billed annually · Renews Jan 15, 2025
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Upgrade Plan
                  </Button>
                </div>

                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Usage</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Team Members</span>
                        <span className="font-medium">5 / 20</span>
                      </div>
                      <Progress value={25} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Storage</span>
                        <span className="font-medium">2.4 GB / 10 GB</span>
                      </div>
                      <Progress value={24} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">API Calls</span>
                        <span className="font-medium">4,250 / 10,000</span>
                      </div>
                      <Progress value={42.5} className="h-2" />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="flex flex-col sm:flex-row justify-between gap-4">
                  <div>
                    <h4 className="font-medium text-sm">Payment Method</h4>
                    <p className="text-sm text-muted-foreground">
                      Visa ending in 4242 · Expires 12/2026
                    </p>
                  </div>
                  <Button variant="outline" size="sm">
                    Update Payment
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
