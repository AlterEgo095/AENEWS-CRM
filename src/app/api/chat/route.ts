import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { getToolRegistry } from '@/core/tool-registry';
import { getAIGateway } from '@/core/ai-gateway';
import { MCPGateway } from '@/core/mcp';

// ── Initialise singletons (lazy, once) ──────────────────────

let gatewayReady: Promise<void> | null = null;

async function ensureGateway(): Promise<MCPGateway> {
  const registry = getToolRegistry();
  const ai = getAIGateway();
  const mcp = new MCPGateway(registry, ai);

  if (!gatewayReady) {
    gatewayReady = mcp.initialize();
  }
  await gatewayReady;
  return mcp;
}

// ============================================================
// GET /api/chat — List threads for a user
// ============================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const tenantId = searchParams.get('tenantId');

    if (!userId || !tenantId) {
      return Response.json(
        { error: 'userId and tenantId are required' },
        { status: 400 },
      );
    }

    const threads = await db.chatThread.findMany({
      where: { userId, tenantId },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        model: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { messages: true } },
      },
    });

    return Response.json({ threads });
  } catch (error) {
    console.error('[GET /api/chat] Error:', error);
    return Response.json({ error: 'Failed to list threads' }, { status: 500 });
  }
}

// ============================================================
// DELETE /api/chat — Delete a thread and all its messages
// ============================================================

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const threadId = searchParams.get('threadId');
    const userId = searchParams.get('userId');
    const tenantId = searchParams.get('tenantId');

    if (!threadId || !userId || !tenantId) {
      return Response.json(
        { error: 'threadId, userId, and tenantId are required' },
        { status: 400 },
      );
    }

    // Verify ownership
    const thread = await db.chatThread.findUnique({
      where: { id: threadId },
    });

    if (!thread || thread.userId !== userId || thread.tenantId !== tenantId) {
      return Response.json({ error: 'Thread not found' }, { status: 404 });
    }

    await db.chatMessage.deleteMany({ where: { threadId } });
    await db.chatThread.delete({ where: { id: threadId } });

    return Response.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/chat] Error:', error);
    return Response.json({ error: 'Failed to delete thread' }, { status: 500 });
  }
}

// ============================================================
// POST /api/chat — Send a message and get AI response
// ============================================================

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const body = await request.json();
    const {
      tenantId,
      userId,
      message,
      threadId,
      model = 'default',
    } = body;

    // ── Validate ─────────────────────────────────────────
    if (!tenantId || !userId || !message) {
      return Response.json(
        { error: 'tenantId, userId, and message are required' },
        { status: 400 },
      );
    }

    if (typeof message !== 'string' || message.trim().length === 0) {
      return Response.json(
        { error: 'message must be a non-empty string' },
        { status: 400 },
      );
    }

    // ── Get or create thread ─────────────────────────────
    let targetThreadId = threadId;
    if (!targetThreadId) {
      const thread = await db.chatThread.create({
        data: {
          tenantId,
          userId,
          title: message.slice(0, 100),
          model,
        },
      });
      targetThreadId = thread.id;
    } else {
      // Verify the thread belongs to this user/tenant
      const existing = await db.chatThread.findUnique({
        where: { id: targetThreadId },
      });
      if (!existing || existing.userId !== userId || existing.tenantId !== tenantId) {
        return Response.json({ error: 'Thread not found' }, { status: 404 });
      }
    }

    // ── Persist user message ──────────────────────────────
    await db.chatMessage.create({
      data: {
        threadId: targetThreadId,
        tenantId,
        role: 'USER',
        content: message,
      },
    });

    // ── Load conversation history ─────────────────────────
    const historyMessages = await db.chatMessage.findMany({
      where: { threadId: targetThreadId },
      orderBy: { createdAt: 'asc' },
      take: 50, // last 50 messages for context window
    });

    // Convert DB messages to MCP format (exclude the just-added user message
    // since processMessage adds it)
    const history = historyMessages.slice(0, -1).map((msg) => ({
      role: msg.role === 'USER'
        ? 'user' as const
        : msg.role === 'ASSISTANT'
          ? 'assistant' as const
          : 'system' as const,
      content: msg.content,
    }));

    // ── Process through MCP Gateway ─────────────────────
    const mcp = await ensureGateway();

    const aiResponse = await mcp.processMessage(
      message,
      { tenantId, userId, model },
      history,
    );

    // ── Persist AI response ───────────────────────────────
    const toolsCalled = aiResponse.toolResults
      ?.filter((r) => r.success)
      .map((r) => r.toolName) ?? [];

    const savedMessage = await db.chatMessage.create({
      data: {
        threadId: targetThreadId,
        tenantId,
        role: 'ASSISTANT',
        content: aiResponse.content,
        toolsCalled: JSON.stringify(toolsCalled),
      },
    });

    const duration = Date.now() - startTime;
    console.log(
      `[POST /api/chat] Completed in ${duration}ms. ` +
        `Tools called: ${toolsCalled.length > 0 ? toolsCalled.join(', ') : 'none'}`,
    );

    // ── Response ─────────────────────────────────────────
    return Response.json({
      id: savedMessage.id,
      threadId: targetThreadId,
      role: 'assistant',
      content: aiResponse.content,
      toolsCalled,
      toolResults: aiResponse.toolResults?.length
        ? aiResponse.toolResults
        : undefined,
      createdAt: savedMessage.createdAt.toISOString(),
      duration,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(
      `[POST /api/chat] Error after ${duration}ms:`,
      error,
    );

    return Response.json(
      {
        error: 'Failed to process chat message',
        details: error instanceof Error ? error.message : undefined,
      },
      { status: 500 },
    );
  }
}
