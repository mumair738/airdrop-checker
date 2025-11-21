import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { SUPPORTED_CHAINS } from '@airdrop-finder/shared';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-oracle-price-aggregator/[address]
 * Aggregate prices from multiple on-chain oracles
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
    const cacheKey = `onchain-oracle-aggregator:${normalizedAddress}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChains = chainId
      ? SUPPORTED_CHAINS.filter((c) => c.id === parseInt(chainId))
      : SUPPORTED_CHAINS.slice(0, 3);

    const prices: any[] = [];

    for (const chain of targetChains) {
      try {
        const response = await goldrushClient.get(
          `/v2/${chain.id}/tokens/${normalizedAddress}/token_prices/`,
          { 'quote-currency': 'USD', 'format': 'json' }
        );

        if (response.data?.items && response.data.items.length > 0) {
          const tokenData = response.data.items[0];
          prices.push({
            chainId: chain.id,
            chainName: chain.name,
            oracle: 'GoldRush',
            price: tokenData.quote_rate,
            timestamp: tokenData.last_updated,
          });
        }
      } catch (error) {
        console.error(`Error fetching oracle price on ${chain.name}:`, error);
      }
    }

    const result = {
      tokenAddress: normalizedAddress,
      oraclePrices: prices,
      averagePrice: prices.length > 0
        ? prices.reduce((sum, p) => sum + (p.price || 0), 0) / prices.length
        : null,
      priceDeviation: prices.length > 1
        ? Math.max(...prices.map(p => p.price)) - Math.min(...prices.map(p => p.price))
        : 0,
      timestamp: Date.now(),
    };

    cache.set(cacheKey, result, 60 * 1000);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Oracle price aggregator error:', error);
    return NextResponse.json(
      {
        error: 'Failed to aggregate oracle prices',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

