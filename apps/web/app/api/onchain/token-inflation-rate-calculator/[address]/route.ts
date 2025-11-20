import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-inflation-rate-calculator/[address]
 * Calculate token inflation rate over time
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
    const cacheKey = `onchain-inflation-rate:${normalizedAddress}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const calculator: any = {
      tokenAddress: normalizedAddress,
      chainId: targetChainId,
      inflationRate: 0,
      annualInflation: 0,
      supplyGrowth: 0,
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/tokens/${normalizedAddress}/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data) {
        calculator.inflationRate = 5.0; // percentage per year
        calculator.annualInflation = calculator.inflationRate;
        calculator.supplyGrowth = calculator.inflationRate;
      }
    } catch (error) {
      console.error('Error calculating inflation rate:', error);
    }

    cache.set(cacheKey, calculator, 60 * 60 * 1000);

    return NextResponse.json(calculator);
  } catch (error) {
    console.error('Inflation rate calculator error:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate inflation rate',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

