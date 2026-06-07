'use client';

import React from 'react';
import {
  Building2,
  Globe,
  Monitor,
  Moon,
  Sun,
  Palette,
  Info,
} from 'lucide-react';
import { useTheme } from 'next-themes';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

// ============================================================
// Settings View
// ============================================================

export default function SettingsView() {
  const { setTheme, theme } = useTheme();

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Configure your AENEWS workspace preferences.
        </p>
      </div>

      {/* Appearance */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
          <CardDescription>
            Customize how AENEWS looks and feels.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Theme</Label>
              <p className="text-xs text-muted-foreground">
                Choose your preferred color scheme.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={theme === 'light' ? 'default' : 'outline'}
                onClick={() => setTheme('light')}
              >
                <Sun className="mr-1.5 h-4 w-4" />
                Light
              </Button>
              <Button
                size="sm"
                variant={theme === 'dark' ? 'default' : 'outline'}
                onClick={() => setTheme('dark')}
              >
                <Moon className="mr-1.5 h-4 w-4" />
                Dark
              </Button>
              <Button
                size="sm"
                variant={theme === 'system' ? 'default' : 'outline'}
                onClick={() => setTheme('system')}
              >
                <Monitor className="mr-1.5 h-4 w-4" />
                System
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Workspace */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Workspace
          </CardTitle>
          <CardDescription>
            General workspace settings.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="org-name">Organization Name</Label>
              <Input id="org-name" placeholder="My Organization" defaultValue="AENEWS Workspace" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="locale">Language</Label>
              <Select defaultValue="en">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Spanish</SelectItem>
                  <SelectItem value="fr">French</SelectItem>
                  <SelectItem value="de">German</SelectItem>
                  <SelectItem value="zh">Chinese</SelectItem>
                  <SelectItem value="ja">Japanese</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="timezone">Timezone</Label>
              <Select defaultValue="UTC">
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">Eastern (US)</SelectItem>
                  <SelectItem value="America/Chicago">Central (US)</SelectItem>
                  <SelectItem value="America/Denver">Mountain (US)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific (US)</SelectItem>
                  <SelectItem value="Europe/London">London</SelectItem>
                  <SelectItem value="Europe/Paris">Paris</SelectItem>
                  <SelectItem value="Asia/Tokyo">Tokyo</SelectItem>
                  <SelectItem value="Asia/Shanghai">Shanghai</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* System Information */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Info className="h-5 w-5" />
            System Information
          </CardTitle>
          <CardDescription>
            Technical details about your AENEWS installation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Platform</p>
              <p className="text-sm font-medium">AENEWS Enterprise OS</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Core Version</p>
              <p className="text-sm font-medium flex items-center gap-1.5">
                0.1.0
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  beta
                </Badge>
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Plugin SDK Version</p>
              <p className="text-sm font-medium">1.0.0</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Framework</p>
              <p className="text-sm font-medium">Next.js 16 + App Router</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">UI Library</p>
              <p className="text-sm font-medium">shadcn/ui + Tailwind CSS 4</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Database</p>
              <p className="text-sm font-medium">SQLite (Prisma ORM)</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Architecture</p>
              <p className="text-sm font-medium">Plugin-first Business OS</p>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Manifest Format</p>
              <p className="text-sm font-medium flex items-center gap-1.5">
                aenews: "1"
                <Badge variant="outline" className="text-[10px] px-1 py-0">
                  v1
                </Badge>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
