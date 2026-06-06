import { NextRequest, Response } from 'next/server';
import { db } from '@/lib/db';
import { getPluginCatalog } from '@/lib/plugin-registry';

/**
 * POST /api/chat
 * Send a message to the AI chat. Currently returns a mock response that
 * demonstrates the AI can discover and use plugin tools.
 * Body: { tenantId, userId, message, threadId? }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tenantId, userId, message, threadId } = body;

    if (!tenantId || !userId || !message) {
      return Response.json(
        { error: 'tenantId, userId, and message are required' },
        { status: 400 }
      );
    }

    // ── Mock: Discover available plugin tools for this tenant ──
    const catalog = getPluginCatalog();

    // Get installed plugins for the tenant
    const installedPlugins = await db.installedPlugin.findMany({
      where: { tenantId, status: 'ACTIVE' },
      include: { plugin: true },
    });

    const installedSlugs = new Set(installedPlugins.map((ip) => ip.plugin.slug));

    // Collect all tools from installed plugins
    const availableTools = catalog
      .filter((p) => installedSlugs.has(p.slug) && p.tools)
      .flatMap((p) =>
        (p.tools ?? []).map((tool) => ({
          plugin: p.name,
          pluginSlug: p.slug,
          ...tool,
        }))
      );

    // ── Mock: Generate AI response ──
    const toolSummary = availableTools.length > 0
      ? availableTools.slice(0, 5).map((t) => `  - **${t.plugin} → ${t.name}**: ${t.description}`).join('\n')
      : '  - No plugins are currently active. Install and activate plugins to enable AI tools.';

    const aiResponse = `Hello! I'm your AENEWS AI assistant. 🤖

I have access to **${availableTools.length} tools** across **${installedSlugs.size} active plugins**:

${toolSummary}
${availableTools.length > 5 ? `\n...and ${availableTools.length - 5} more tools available.` : ''}

You asked: _"${message}"_

I can help you with:
- **CRM**: Managing contacts, deals, and pipeline
- **Finance**: Invoicing, expenses, and reporting
- **HR**: Employee management, payroll, and recruitment
- And much more based on your active plugins!

Just ask me to do something, and I'll use the appropriate tools. For example:
- "Create a new contact named John Doe"
- "Show me the sales pipeline summary"
- "Generate a financial report for this quarter"

What would you like to do?`;

    // ── Persist the conversation ──
    let targetThreadId = threadId;

    if (!targetThreadId) {
      // Create a new thread
      const thread = await db.chatThread.create({
        data: {
          tenantId,
          userId,
          title: message.slice(0, 100),
        },
      });
      targetThreadId = thread.id;
    }

    // Save user message
    await db.chatMessage.create({
      data: {
        threadId: targetThreadId,
        tenantId,
        role: 'USER',
        content: message,
      },
    });

    // Save AI response
    const toolsCalled = availableTools.length > 0
      ? [availableTools[0].name]
      : [];
    await db.chatMessage.create({
      data: {
        threadId: targetThreadId,
        tenantId,
        role: 'ASSISTANT',
        content: aiResponse,
        toolsCalled: JSON.stringify(toolsCalled),
      },
    });

    return Response.json({
      id: `msg-${Date.now()}`,
      threadId: targetThreadId,
      role: 'assistant',
      content: aiResponse,
      toolsAvailable: availableTools.length,
      toolsCalled,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[POST /api/chat] Error:', error);
    return Response.json(
      { error: 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
