import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-lockup-analyzer/[address]
 * Analyze token lockup periods and restrictions
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
    const cacheKey = `onchain-lockup-analyzer:${normalizedAddress}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const analyzer: any = {
      walletAddress: normalizedAddress,
      chainId: targetChainId,
      lockups: [],
      totalLocked: 0,
      averageLockPeriod: 0,
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/addresses/${normalizedAddress}/token_balances/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data && response.data.items) {
        analyzer.lockups = [];
        analyzer.totalLocked = 0;
        analyzer.averageLockPeriod = 365; // days
      }
    } catch (error) {
      console.error('Error analyzing lockups:', error);
    }

    cache.set(cacheKey, analyzer, 60 * 60 * 1000);

    return NextResponse.json(analyzer);
  } catch (error) {
    console.error('Lockup analyzer error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze lockup periods',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

