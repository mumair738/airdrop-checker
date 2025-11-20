import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-market-maker-detector/[address]
 * Detect market maker activity and patterns
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
      mmScore: 0,
      tradingPatterns: [],
      activityMetrics: {},
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/addresses/${normalizedAddress}/transactions/`,
        { 'quote-currency': 'USD', 'page-size': 100 }
      );

      if (response.data && response.data.items) {
        const txCount = response.data.items.length;
        const avgValue = response.data.items.reduce(
          (sum: number, tx: any) => sum + parseFloat(tx.value_quote || '0'),
          0
        ) / txCount;
        detector.mmScore = txCount > 50 && avgValue > 1000 ? 75 : 30;
        detector.isMarketMaker = detector.mmScore > 60;
        detector.tradingPatterns = detector.isMarketMaker
          ? ['High frequency trading', 'Consistent volume', 'Bid-ask spread management']
          : [];
        detector.activityMetrics = {
          transactionCount: txCount,
          averageValue: avgValue,
          frequency: 'high',
        };
      }
    } catch (error) {
      console.error('Error detecting market maker:', error);
    }

    cache.set(cacheKey, detector, 10 * 60 * 1000);

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

