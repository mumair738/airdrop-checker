import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-whale-alert-system/[address]
 * Alert system for large token movements
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const searchParams = request.nextUrl.searchParams;
    const chainId = searchParams.get('chainId');
    const threshold = parseFloat(searchParams.get('threshold') || '100000');

    if (!isValidAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address' },
        { status: 400 }
      );
    }

    const normalizedAddress = address.toLowerCase();
    const cacheKey = `onchain-whale-alert:${normalizedAddress}:${threshold}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const alert: any = {
      tokenAddress: normalizedAddress,
      chainId: targetChainId,
      threshold,
      recentMovements: [],
      alerts: [],
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/tokens/${normalizedAddress}/transactions/`,
        { 'quote-currency': 'USD', 'page-size': 20 }
      );

      if (response.data && response.data.items) {
        const largeTxs = response.data.items.filter(
          (tx: any) => parseFloat(tx.value_quote || '0') > threshold
        );
        alert.recentMovements = largeTxs.slice(0, 10);
        alert.alerts = largeTxs.length > 0 ? ['Large movements detected'] : [];
      }
    } catch (error) {
      console.error('Error monitoring whale movements:', error);
    }

    cache.set(cacheKey, alert, 2 * 60 * 1000);

    return NextResponse.json(alert);
  } catch (error) {
    console.error('Whale alert system error:', error);
    return NextResponse.json(
      {
        error: 'Failed to monitor whale movements',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
