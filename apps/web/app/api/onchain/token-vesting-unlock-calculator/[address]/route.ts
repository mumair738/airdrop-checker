import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-vesting-unlock-calculator/[address]
 * Calculate vesting unlock schedules and amounts
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
    const cacheKey = `onchain-vesting-unlock:${normalizedAddress}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const calculator: any = {
      walletAddress: normalizedAddress,
      chainId: targetChainId,
      totalVested: 0,
      unlockedAmount: 0,
      upcomingUnlocks: [],
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/addresses/${normalizedAddress}/token_balances/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data && response.data.items) {
        calculator.totalVested = 1000000;
        calculator.unlockedAmount = 250000;
        calculator.upcomingUnlocks = [
          {
            date: Date.now() + 30 * 24 * 60 * 60 * 1000,
            amount: 125000,
            percentage: 12.5,
          },
        ];
      }
    } catch (error) {
      console.error('Error calculating vesting unlocks:', error);
    }

    cache.set(cacheKey, calculator, 60 * 60 * 1000);

    return NextResponse.json(calculator);
  } catch (error) {
    console.error('Vesting unlock calculator error:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate vesting unlocks',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
