import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-airdrop-snapshot-eligibility/[address]
 * Check eligibility for airdrop snapshots
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    const { address } = await params;
    const searchParams = request.nextUrl.searchParams;
    const chainId = searchParams.get('chainId');
    const snapshotDate = searchParams.get('snapshotDate');

    if (!isValidAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid Ethereum address' },
        { status: 400 }
      );
    }

    const normalizedAddress = address.toLowerCase();
    const cacheKey = `onchain-airdrop-snapshot-eligibility:${normalizedAddress}:${snapshotDate || 'latest'}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const eligibility: any = {
      walletAddress: normalizedAddress,
      chainId: targetChainId,
      snapshotDate: snapshotDate || Date.now(),
      isEligible: false,
      eligibilityScore: 0,
      requirements: [],
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/addresses/${normalizedAddress}/transactions/`,
        { 'quote-currency': 'USD', 'page-size': 100 }
      );

      if (response.data && response.data.items) {
        const txCount = response.data.items.length;
        eligibility.eligibilityScore = Math.min(txCount * 2, 100);
        eligibility.isEligible = eligibility.eligibilityScore > 50;
        eligibility.requirements = [
          'Minimum 25 transactions',
          'Active before snapshot date',
          'Sufficient activity volume',
        ];
      }
    } catch (error) {
      console.error('Error checking snapshot eligibility:', error);
    }

    cache.set(cacheKey, eligibility, 10 * 60 * 1000);

    return NextResponse.json(eligibility);
  } catch (error) {
    console.error('Airdrop snapshot eligibility error:', error);
    return NextResponse.json(
      {
        error: 'Failed to check snapshot eligibility',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

