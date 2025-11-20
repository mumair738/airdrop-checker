import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-price-impact-calculator/[address]
 * Calculate price impact for token swaps
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const searchParams = request.nextUrl.searchParams;
    const chainId = searchParams.get('chainId');
    const amount = parseFloat(searchParams.get('amount') || '1000');

    if (!isValidAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address' },
        { status: 400 }
      );
    }

    const normalizedAddress = address.toLowerCase();
    const cacheKey = `onchain-price-impact:${normalizedAddress}:${amount}:${chainId || 'all'}`;
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
      amount,
      priceImpact: 0,
      estimatedPrice: 0,
      recommendations: [],
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/tokens/${normalizedAddress}/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data) {
        const liquidity = parseFloat(response.data.total_liquidity_quote || '0');
        const currentPrice = parseFloat(response.data.quote_rate || '0');
        calculator.priceImpact = liquidity > 0 ? (amount / liquidity) * 100 : 5.0;
        calculator.estimatedPrice = currentPrice * (1 - calculator.priceImpact / 100);
        calculator.recommendations = [
          calculator.priceImpact > 3
            ? 'High price impact - consider splitting order'
            : 'Price impact is acceptable',
        ];
      }
    } catch (error) {
      console.error('Error calculating price impact:', error);
    }

    cache.set(cacheKey, calculator, 2 * 60 * 1000);

    return NextResponse.json(calculator);
  } catch (error) {
    console.error('Price impact calculator error:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate price impact',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
