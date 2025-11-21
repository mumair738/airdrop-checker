import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-liquidity-pool-health-monitor/[address]
 * Monitor liquidity pool health metrics
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const searchParams = request.nextUrl.searchParams;
    const chainId = searchParams.get('chainId');

    if (!isValidAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address' },
        { status: 400 }
      );
    }

    const normalizedAddress = address.toLowerCase();
    const cacheKey = `onchain-pool-health:${normalizedAddress}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const monitor: any = {
      tokenAddress: normalizedAddress,
      chainId: targetChainId,
      healthScore: 0,
      metrics: {},
      warnings: [],
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/tokens/${normalizedAddress}/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data) {
        const liquidity = parseFloat(response.data.total_liquidity_quote || '0');
        monitor.healthScore = liquidity > 100000 ? 85 : liquidity > 50000 ? 70 : 50;
        monitor.metrics = {
          liquidity,
          volume24h: parseFloat(response.data.total_volume_24h || '0'),
          priceStability: 'stable',
        };
        monitor.warnings = monitor.healthScore < 60 ? ['Low liquidity detected'] : [];
      }
    } catch (error) {
      console.error('Error monitoring pool health:', error);
    }

    cache.set(cacheKey, monitor, 5 * 60 * 1000);

    return NextResponse.json(monitor);
  } catch (error) {
    console.error('Liquidity pool health monitor error:', error);
    return NextResponse.json(
      {
        error: 'Failed to monitor pool health',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
