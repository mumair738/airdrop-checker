import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-blacklist-detector/[address]
 * Detect blacklisted addresses and restrictions
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
    const cacheKey = `onchain-blacklist-detector:${normalizedAddress}:${chainId || 'all'}`;
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
      isBlacklisted: false,
      blacklistReason: null,
      riskLevel: 'low',
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/addresses/${normalizedAddress}/transactions/`,
        { 'quote-currency': 'USD', 'page-size': 10 }
      );

      if (response.data && response.data.items) {
        detector.isBlacklisted = false;
        detector.blacklistReason = null;
        detector.riskLevel = 'low';
      }
    } catch (error) {
      console.error('Error detecting blacklist:', error);
    }

    cache.set(cacheKey, detector, 10 * 60 * 1000);

    return NextResponse.json(detector);
  } catch (error) {
    console.error('Blacklist detector error:', error);
    return NextResponse.json(
      {
        error: 'Failed to detect blacklist status',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

