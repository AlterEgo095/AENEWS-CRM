import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/core/auth';

// ============================================================
// /api/auth/[action] — Auth endpoints
// POST /api/auth/login    — login with email + password
// POST /api/auth/register — register new account
// POST /api/auth/logout   — invalidate session
// GET  /api/auth/me       — get current user from token
// ============================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;

  switch (action) {
    case 'login':
      return handleLogin(request);
    case 'register':
      return handleRegister(request);
    case 'logout':
      return handleLogout(request);
    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 404 }
      );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ action: string }> }
) {
  const { action } = await params;

  switch (action) {
    case 'me':
      return handleMe(request);
    default:
      return NextResponse.json(
        { error: `Unknown action: ${action}` },
        { status: 404 }
      );
  }
}

// ── Handlers ──────────────────────────────────────────────────

async function handleLogin(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const result = await authService.login(email, password);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 401 }
      );
    }

    return NextResponse.json({
      user: result.user,
      token: result.token,
    });
  } catch (error) {
    console.error('[Auth API] Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleRegister(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, firstName, lastName, organizationName } = body;

    if (!email || !password || !firstName || !lastName || !organizationName) {
      return NextResponse.json(
        { error: 'All fields are required: email, password, firstName, lastName, organizationName' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    const result = await authService.register({
      email,
      password,
      firstName,
      lastName,
      organizationName,
    });

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        user: result.user,
        token: result.token,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[Auth API] Register error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleLogout(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7)
      : authHeader;

    await authService.logout(token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Auth API] Logout error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function handleMe(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization header required' },
        { status: 401 }
      );
    }

    const user = await authService.getAuthUser(authHeader);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('[Auth API] Me error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
