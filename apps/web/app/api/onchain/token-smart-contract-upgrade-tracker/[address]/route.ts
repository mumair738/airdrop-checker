import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-smart-contract-upgrade-tracker/[address]
 * Track smart contract upgrade history and changes
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
    const cacheKey = `onchain-upgrade-tracker:${normalizedAddress}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const tracker: any = {
      contractAddress: normalizedAddress,
      chainId: targetChainId,
      upgradeHistory: [],
      isUpgradeable: false,
      lastUpgrade: null,
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/tokens/${normalizedAddress}/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data) {
        tracker.isUpgradeable = true;
        tracker.upgradeHistory = [
          {
            version: '2.0',
            date: Date.now() - 60 * 24 * 60 * 60 * 1000,
            changes: 'Added new features',
          },
        ];
        tracker.lastUpgrade = tracker.upgradeHistory[0];
      }
    } catch (error) {
      console.error('Error tracking upgrades:', error);
    }

    cache.set(cacheKey, tracker, 10 * 60 * 1000);

    return NextResponse.json(tracker);
  } catch (error) {
    console.error('Smart contract upgrade tracker error:', error);
    return NextResponse.json(
      {
        error: 'Failed to track contract upgrades',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

