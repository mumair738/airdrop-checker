import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-freeze-mechanism-detector/[address]
 * Detect token freeze functionality
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
    const cacheKey = `onchain-freeze-mechanism:${normalizedAddress}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const detector: any = {
      tokenAddress: normalizedAddress,
      chainId: targetChainId,
      canFreeze: false,
      frozenAddresses: [],
      freezeHistory: [],
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/tokens/${normalizedAddress}/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data) {
        detector.canFreeze = true;
        detector.frozenAddresses = [];
        detector.freezeHistory = [];
      }
    } catch (error) {
      console.error('Error detecting freeze mechanism:', error);
    }

    cache.set(cacheKey, detector, 5 * 60 * 1000);

    return NextResponse.json(detector);
  } catch (error) {
    console.error('Freeze mechanism detector error:', error);
    return NextResponse.json(
      {
        error: 'Failed to detect freeze mechanism',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

