'use client';

import React, { useState } from 'react';
import {
  Building2,
  Shield,
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  CheckCircle2,
  Sparkles,
  Globe,
  Zap,
  BarChart3,
  Workflow,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useAuthStore } from '@/store/auth-store';

interface LoginForm {
  email: string;
  password: string;
}

interface RegisterForm {
  email: string;
  password: string;
  confirmPassword: string;
  firstName: string;
  lastName: string;
  organizationName: string;
}

const features = [
  { icon: Zap, label: 'AI-Powered', desc: 'Built-in AI assistant' },
  { icon: Workflow, label: 'Automation', desc: 'Visual workflow builder' },
  { icon: BarChart3, label: 'Analytics', desc: 'Real-time dashboards' },
  { icon: Globe, label: 'Multi-tenant', desc: 'Scalable architecture' },
];

export default function AuthPage() {
  const { setUser, isRegisterMode, setRegisterMode } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [loginForm, setLoginForm] = useState<LoginForm>({
    email: '',
    password: '',
  });

  const [registerForm, setRegisterForm] = useState<RegisterForm>({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
    organizationName: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginForm),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        return;
      }

      setUser(data.user, data.token);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (registerForm.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: registerForm.email,
          password: registerForm.password,
          firstName: registerForm.firstName,
          lastName: registerForm.lastName,
          organizationName: registerForm.organizationName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Registration failed');
        return;
      }

      setUser(data.user, data.token);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-emerald-50/30 to-slate-100 dark:from-slate-950 dark:via-emerald-950/20 dark:to-slate-900">
      {/* Left Panel — Branding */}
      <div className="hidden lg:flex lg:flex-1 flex-col justify-between p-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-600 to-emerald-800 dark:from-emerald-800 dark:to-emerald-950" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 rounded-full bg-emerald-300/20 blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm text-white font-bold text-lg">
              A
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">
              AENEWS
            </span>
          </div>
          <p className="text-emerald-100/80 text-sm ml-[52px]">
            Enterprise Operating System
          </p>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-3xl font-bold text-white leading-tight">
              Run your entire
              <br />
              business in one place.
            </h2>
            <p className="text-emerald-100/70 mt-3 text-lg max-w-md">
              AENEWS is the AI-first business operating system that unifies
              CRM, Finance, HR, and more into a single platform.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {features.map((feature) => (
              <div
                key={feature.label}
                className="flex items-start gap-3 bg-white/10 backdrop-blur-sm rounded-xl p-4"
              >
                <feature.icon className="h-5 w-5 text-emerald-300 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-white">
                    {feature.label}
                  </div>
                  <div className="text-xs text-emerald-100/60">
                    {feature.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-emerald-100/50 text-xs">
          © 2024 AENEWS Enterprise OS. All rights reserved.
        </div>
      </div>

      {/* Right Panel — Auth Form */}
      <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-6">
          {/* Mobile logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm">
              A
            </div>
            <span className="text-xl font-bold tracking-tight">AENEWS</span>
            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              Enterprise OS
            </span>
          </div>

          {!isRegisterMode ? (
            /* ── LOGIN FORM ────────────────────────────────── */
            <>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  Welcome back
                </h1>
                <p className="text-muted-foreground">
                  Sign in to your AENEWS workspace
                </p>
              </div>

              <Card className="border-0 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50">
                <CardContent className="p-6">
                  <form onSubmit={handleLogin} className="space-y-4">
                    {error && (
                      <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-center gap-2">
                        <Shield className="h-4 w-4 shrink-0" />
                        {error}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-email"
                          type="email"
                          placeholder="admin@aenews.io"
                          className="pl-10"
                          value={loginForm.email}
                          onChange={(e) =>
                            setLoginForm({ ...loginForm, email: e.target.value })
                          }
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password">Password</Label>
                        <button
                          type="button"
                          className="text-xs text-emerald-600 hover:text-emerald-700 font-medium"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="login-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Enter your password"
                          className="pl-10 pr-10"
                          value={loginForm.password}
                          onChange={(e) =>
                            setLoginForm({ ...loginForm, password: e.target.value })
                          }
                          required
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Signing in...
                        </>
                      ) : (
                        <>
                          Sign in
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <div className="relative">
                <Separator />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
                  or
                </span>
              </div>

              {/* Demo login button */}
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setLoginForm({ email: 'admin@aenews.io', password: 'demo1234' });
                  setError('');
                }}
              >
                <Sparkles className="mr-2 h-4 w-4 text-emerald-500" />
                Use demo account
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <button
                  type="button"
                  className="text-emerald-600 hover:text-emerald-700 font-medium"
                  onClick={() => {
                    setRegisterMode(true);
                    setError('');
                  }}
                >
                  Create workspace
                </button>
              </p>
            </>
          ) : (
            /* ── REGISTER FORM ───────────────────────────── */
            <>
              <div className="space-y-2">
                <h1 className="text-2xl font-bold tracking-tight">
                  Create your workspace
                </h1>
                <p className="text-muted-foreground">
                  Start your free AENEWS trial in seconds
                </p>
              </div>

              <Card className="border-0 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50">
                <CardContent className="p-6">
                  <form onSubmit={handleRegister} className="space-y-4">
                    {error && (
                      <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg flex items-center gap-2">
                        <Shield className="h-4 w-4 shrink-0" />
                        {error}
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="reg-org">Organization Name</Label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reg-org"
                          type="text"
                          placeholder="Acme Corporation"
                          className="pl-10"
                          value={registerForm.organizationName}
                          onChange={(e) =>
                            setRegisterForm({ ...registerForm, organizationName: e.target.value })
                          }
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="reg-first">First Name</Label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="reg-first"
                            type="text"
                            placeholder="John"
                            className="pl-10"
                            value={registerForm.firstName}
                            onChange={(e) =>
                              setRegisterForm({ ...registerForm, firstName: e.target.value })
                            }
                            required
                            disabled={isLoading}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reg-last">Last Name</Label>
                        <Input
                          id="reg-last"
                          type="text"
                          placeholder="Doe"
                          value={registerForm.lastName}
                          onChange={(e) =>
                            setRegisterForm({ ...registerForm, lastName: e.target.value })
                          }
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-email">Work Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reg-email"
                          type="email"
                          placeholder="john@acme.com"
                          className="pl-10"
                          value={registerForm.email}
                          onChange={(e) =>
                            setRegisterForm({ ...registerForm, email: e.target.value })
                          }
                          required
                          disabled={isLoading}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-password">Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reg-password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Min. 6 characters"
                          className="pl-10 pr-10"
                          value={registerForm.password}
                          onChange={(e) =>
                            setRegisterForm({ ...registerForm, password: e.target.value })
                          }
                          required
                          disabled={isLoading}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="reg-confirm">Confirm Password</Label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          id="reg-confirm"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Repeat password"
                          className="pl-10"
                          value={registerForm.confirmPassword}
                          onChange={(e) =>
                            setRegisterForm({ ...registerForm, confirmPassword: e.target.value })
                          }
                          required
                          disabled={isLoading}
                        />
                        {registerForm.confirmPassword &&
                          registerForm.password === registerForm.confirmPassword && (
                            <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                          )}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating workspace...
                        </>
                      ) : (
                        <>
                          Create workspace
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{' '}
                <button
                  type="button"
                  className="text-emerald-600 hover:text-emerald-700 font-medium"
                  onClick={() => {
                    setRegisterMode(false);
                    setError('');
                  }}
                >
                  Sign in
                </button>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
