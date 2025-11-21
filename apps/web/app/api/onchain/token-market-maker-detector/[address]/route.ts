import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-market-maker-detector/[address]
 * Detect market maker activity patterns
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
    const cacheKey = `onchain-market-maker-detector:${normalizedAddress}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const detector: any = {
      walletAddress: normalizedAddress,
      chainId: targetChainId,
      isMarketMaker: false,
      activityScore: 0,
      patterns: [],
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/addresses/${normalizedAddress}/transactions/`,
        { 'quote-currency': 'USD', 'page-size': 50 }
      );

      if (response.data && response.data.items) {
        const txCount = response.data.items.length;
        detector.activityScore = Math.min(txCount * 2, 100);
        detector.isMarketMaker = txCount > 100;
        detector.patterns = detector.isMarketMaker ? ['High frequency trading detected'] : [];
      }
    } catch (error) {
      console.error('Error detecting market maker:', error);
    }

    cache.set(cacheKey, detector, 5 * 60 * 1000);

    return NextResponse.json(detector);
  } catch (error) {
    console.error('Market maker detector error:', error);
    return NextResponse.json(
      {
        error: 'Failed to detect market maker activity',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
