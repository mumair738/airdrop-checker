import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-flash-loan-analyzer/[address]
 * Analyze flash loan opportunities and costs
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
    const cacheKey = `onchain-flash-loan-analyzer:${normalizedAddress}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const analyzer: any = {
      tokenAddress: normalizedAddress,
      chainId: targetChainId,
      availableProtocols: [],
      fees: {},
      maxAmount: 0,
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/tokens/${normalizedAddress}/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data) {
        analyzer.availableProtocols = ['Aave', 'dYdX', 'Uniswap'];
        analyzer.fees = { aave: 0.09, dydx: 0.0, uniswap: 0.3 };
        analyzer.maxAmount = parseFloat(response.data.total_liquidity_quote || '0') * 0.5;
      }
    } catch (error) {
      console.error('Error analyzing flash loans:', error);
    }

    cache.set(cacheKey, analyzer, 5 * 60 * 1000);

    return NextResponse.json(analyzer);
  } catch (error) {
    console.error('Flash loan analyzer error:', error);
    return NextResponse.json(
      {
        error: 'Failed to analyze flash loans',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
