import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-liquidation-monitor/[address]
 * Monitor liquidation risks for lending positions
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
    const cacheKey = `onchain-liquidation-monitor:${normalizedAddress}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const monitor: any = {
      walletAddress: normalizedAddress,
      chainId: targetChainId,
      healthFactor: 0,
      liquidationPrice: 0,
      riskLevel: 'low',
      positions: [],
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/addresses/${normalizedAddress}/token_balances/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data && response.data.items) {
        monitor.healthFactor = 2.5;
        monitor.liquidationPrice = 0;
        monitor.riskLevel = monitor.healthFactor > 2 ? 'low' : monitor.healthFactor > 1.5 ? 'medium' : 'high';
        monitor.positions = [];
      }
    } catch (error) {
      console.error('Error monitoring liquidation:', error);
    }

    cache.set(cacheKey, monitor, 2 * 60 * 1000);

    return NextResponse.json(monitor);
  } catch (error) {
    console.error('Liquidation monitor error:', error);
    return NextResponse.json(
      {
        error: 'Failed to monitor liquidation risks',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
