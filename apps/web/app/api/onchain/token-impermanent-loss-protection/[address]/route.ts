import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-impermanent-loss-protection/[address]
 * Calculate and protect against impermanent loss
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const searchParams = request.nextUrl.searchParams;
    const chainId = searchParams.get('chainId');
    const priceChange = parseFloat(searchParams.get('priceChange') || '0');

    if (!isValidAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address' },
        { status: 400 }
      );
    }

    const normalizedAddress = address.toLowerCase();
    const cacheKey = `onchain-impermanent-loss:${normalizedAddress}:${priceChange}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;
    const k = 1 + priceChange / 100;
    const il = 2 * Math.sqrt(k) / (1 + k) - 1;

    const protection: any = {
      tokenAddress: normalizedAddress,
      chainId: targetChainId,
      priceChange,
      impermanentLoss: parseFloat((il * 100).toFixed(4)),
      protectionStrategies: [],
      recommendations: [],
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/tokens/${normalizedAddress}/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data) {
        protection.protectionStrategies = [
          'Use stablecoin pairs to minimize IL',
          'Consider single-sided staking',
          'Monitor price movements closely',
        ];
        protection.recommendations = [
          Math.abs(protection.impermanentLoss) > 5
            ? 'High IL risk - consider alternative strategies'
            : 'IL risk is manageable',
        ];
      }
    } catch (error) {
      console.error('Error calculating impermanent loss:', error);
    }

    cache.set(cacheKey, protection, 5 * 60 * 1000);

    return NextResponse.json(protection);
  } catch (error) {
    console.error('Impermanent loss protection error:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate impermanent loss',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

