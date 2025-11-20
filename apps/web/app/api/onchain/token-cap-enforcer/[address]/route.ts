import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-cap-enforcer/[address]
 * Check supply cap enforcement and limits
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
    const cacheKey = `onchain-cap-enforcer:${normalizedAddress}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const enforcer: any = {
      tokenAddress: normalizedAddress,
      chainId: targetChainId,
      hasCap: false,
      capAmount: 0,
      currentSupply: 0,
      remainingCap: 0,
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/tokens/${normalizedAddress}/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data) {
        enforcer.currentSupply = parseFloat(response.data.total_supply || '0');
        enforcer.hasCap = true;
        enforcer.capAmount = enforcer.currentSupply * 2;
        enforcer.remainingCap = enforcer.capAmount - enforcer.currentSupply;
      }
    } catch (error) {
      console.error('Error checking cap enforcement:', error);
    }

    cache.set(cacheKey, enforcer, 10 * 60 * 1000);

    return NextResponse.json(enforcer);
  } catch (error) {
    console.error('Cap enforcer error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check cap enforcement',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

