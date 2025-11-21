import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-voting-power-calculator/[address]
 * Calculate governance voting power for wallet
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
    const cacheKey = `onchain-voting-power:${normalizedAddress}:${chainId || 'all'}`;
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
      totalVotingPower: 0,
      delegatedPower: 0,
      availablePower: 0,
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/addresses/${normalizedAddress}/token_balances/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data && response.data.items) {
        const governanceTokens = response.data.items.filter(
          (token: any) => token.contract_name?.toLowerCase().includes('governance') || 
                          token.contract_ticker_symbol?.toLowerCase().includes('gov')
        );
        calculator.totalVotingPower = governanceTokens.reduce(
          (sum: number, token: any) => sum + parseFloat(token.balance || '0'),
          0
        );
        calculator.availablePower = calculator.totalVotingPower;
      }
    } catch (error) {
      console.error('Error calculating voting power:', error);
    }

    cache.set(cacheKey, calculator, 5 * 60 * 1000);

    return NextResponse.json(calculator);
  } catch (error) {
    console.error('Voting power calculator error:', error);
    return NextResponse.json(
      {
        error: 'Failed to calculate voting power',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

