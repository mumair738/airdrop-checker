import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-rug-pull-risk-score/[address]
 * Calculate comprehensive rug pull risk score
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
    const cacheKey = `onchain-rug-pull-risk-score:${normalizedAddress}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const riskScore: any = {
      tokenAddress: normalizedAddress,
      chainId: targetChainId,
      overallScore: 0,
      riskFactors: [],
      safetyScore: 0,
      recommendations: [],
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/tokens/${normalizedAddress}/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data) {
        let score = 100;
        const factors: string[] = [];

        if (!response.data.contract_name) {
          score -= 20;
          factors.push('Missing contract name');
        }

        if (parseFloat(response.data.total_liquidity_quote || '0') < 50000) {
          score -= 30;
          factors.push('Low liquidity');
        }

        if (parseFloat(response.data.total_supply || '0') < 1000000) {
          score -= 15;
          factors.push('Very low supply');
        }

        riskScore.overallScore = Math.max(0, score);
        riskScore.safetyScore = riskScore.overallScore;
        riskScore.riskFactors = factors;
        riskScore.recommendations = score < 50
          ? ['High risk detected - proceed with caution']
          : ['Risk level is acceptable'];
      }
    } catch (error) {
      console.error('Error calculating rug pull risk:', error);
    }

    cache.set(cacheKey, riskScore, 10 * 60 * 1000);

    return NextResponse.json(riskScore);
  } catch (error) {
    console.error('Rug pull risk score error:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate rug pull risk score',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

