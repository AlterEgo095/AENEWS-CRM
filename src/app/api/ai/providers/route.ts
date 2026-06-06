import { NextResponse } from 'next/server';
import { getAIGateway } from '@/core/ai-gateway';

/**
 * GET /api/ai/providers
 * Returns available AI providers, the active provider, and model listings.
 */
export async function GET() {
  try {
    const gateway = getAIGateway();

    const activeProvider = gateway.getActiveProvider();
    const availableProviders = gateway.getAvailableProviders();
    const models = await gateway.listModels();
    const stats = gateway.getStats();

    const providerDetails = availableProviders.map((name) => {
      const config = gateway.getProviderConfig(name);
      return {
        name,
        defaultModel: config?.defaultModel ?? null,
        hasApiKey: !!config?.apiKey,
      };
    });

    return NextResponse.json({
      providers: providerDetails,
      activeProvider,
      activeModel: stats.model,
      availableProviders,
      models,
      stats: {
        provider: stats.provider,
        model: stats.model,
        totalRequests: stats.totalRequests,
      },
    });
  } catch (error) {
    console.error('[GET /api/ai/providers] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch AI providers' },
      { status: 500 }
    );
  }
}
