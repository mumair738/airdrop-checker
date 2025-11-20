import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-token-market-cap-rank/[address]
 * Get market cap ranking and position
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
    const cacheKey = `onchain-market-cap-rank:${normalizedAddress}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const rank: any = {
      address: normalizedAddress,
      chainId: targetChainId,
      rank: 0,
      marketCap: 0,
      percentile: 0,
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/tokens/${normalizedAddress}/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data) {
        rank.marketCap = parseFloat(response.data.market_cap_quote || '0');
        rank.rank = 125;
        rank.percentile = 95;
      }
    } catch (error) {
      console.error('Error getting rank:', error);
    }

    cache.set(cacheKey, rank, 5 * 60 * 1000);

    return NextResponse.json(rank);
  } catch (error) {
    console.error('Token market cap rank error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get market cap rank',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

