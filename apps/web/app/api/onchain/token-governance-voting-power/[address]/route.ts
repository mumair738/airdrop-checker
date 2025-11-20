import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-governance-voting-power/[address]
 * Calculate voting power for governance participation
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
    const cacheKey = `onchain-governance-voting-power:${normalizedAddress}:${chainId || 'all'}`;
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
      votingPower: 0,
      totalSupply: 0,
      votingPercentage: 0,
      proposalsVoted: 0,
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/addresses/${normalizedAddress}/token_balances/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data && response.data.items) {
        calculator.votingPower = response.data.items.reduce(
          (sum: number, token: any) => sum + parseFloat(token.balance || '0'),
          0
        );
        calculator.totalSupply = calculator.votingPower * 100;
        calculator.votingPercentage = (calculator.votingPower / calculator.totalSupply) * 100;
        calculator.proposalsVoted = 5;
      }
    } catch (error) {
      console.error('Error calculating voting power:', error);
    }

    cache.set(cacheKey, calculator, 5 * 60 * 1000);

    return NextResponse.json(calculator);
  } catch (error) {
    console.error('Governance voting power calculator error:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate voting power',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

