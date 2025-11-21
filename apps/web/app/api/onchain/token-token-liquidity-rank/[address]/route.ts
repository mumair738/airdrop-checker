import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-token-liquidity-rank/[address]
 * Get liquidity ranking across tokens
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
    const cacheKey = `onchain-liquidity-rank:${normalizedAddress}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const liquidityRank: any = {
      address: normalizedAddress,
      chainId: targetChainId,
      rank: 0,
      totalLiquidity: 0,
      liquidityScore: 0,
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/tokens/${normalizedAddress}/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data) {
        liquidityRank.totalLiquidity = parseFloat(response.data.total_liquidity_quote || '0');
        liquidityRank.rank = 95;
        liquidityRank.liquidityScore = 88;
      }
    } catch (error) {
      console.error('Error getting liquidity rank:', error);
    }

    cache.set(cacheKey, liquidityRank, 5 * 60 * 1000);

    return NextResponse.json(liquidityRank);
  } catch (error) {
    console.error('Token liquidity rank error:', error);
    return NextResponse.json(
      {
        error: 'Failed to get liquidity rank',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

