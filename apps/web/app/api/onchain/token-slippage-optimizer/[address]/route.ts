import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-slippage-optimizer/[address]
 * Optimize slippage tolerance for better execution
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
    const cacheKey = `onchain-slippage-optimizer:${normalizedAddress}:${amount}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const optimizer: any = {
      tokenAddress: normalizedAddress,
      chainId: targetChainId,
      amount,
      recommendedSlippage: 0.5,
      currentSlippage: 1.0,
      priceImpact: 0,
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
        optimizer.priceImpact = liquidity > 0 ? (amount / liquidity) * 100 : 5.0;
        optimizer.recommendedSlippage = optimizer.priceImpact < 1 ? 0.5 : optimizer.priceImpact * 1.2;
        optimizer.recommendations = [
          `Set slippage to ${optimizer.recommendedSlippage.toFixed(2)}% for optimal execution`,
          'Consider splitting large orders',
        ];
      }
    } catch (error) {
      console.error('Error optimizing slippage:', error);
    }

    cache.set(cacheKey, optimizer, 2 * 60 * 1000);

    return NextResponse.json(optimizer);
  } catch (error) {
    console.error('Slippage optimizer error:', error);
    return NextResponse.json(
      {
        error: 'Failed to optimize slippage',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

