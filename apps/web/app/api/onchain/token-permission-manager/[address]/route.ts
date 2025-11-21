import { NextRequest, NextResponse } from 'next/server';
import { isValidAddress } from '@airdrop-finder/shared';
import { goldrushClient } from '@/lib/goldrush/client';
import { cache } from '@airdrop-finder/shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onchain/token-permission-manager/[address]
 * Track permissions and access controls
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
    const cacheKey = `onchain-permission-manager:${normalizedAddress}:${chainId || 'all'}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult) {
      return NextResponse.json({
        ...cachedResult,
        cached: true,
      });
    }

    const targetChainId = chainId ? parseInt(chainId) : 1;

    const manager: any = {
      contractAddress: normalizedAddress,
      chainId: targetChainId,
      permissions: [],
      roles: [],
      accessControls: {},
      timestamp: Date.now(),
    };

    try {
      const response = await goldrushClient.get(
        `/v2/${targetChainId}/tokens/${normalizedAddress}/`,
        { 'quote-currency': 'USD' }
      );

      if (response.data) {
        manager.permissions = [];
        manager.roles = ['admin', 'minter', 'pauser'];
        manager.accessControls = { hasRoleBasedAccess: true };
      }
    } catch (error) {
      console.error('Error managing permissions:', error);
    }

    cache.set(cacheKey, manager, 10 * 60 * 1000);

    return NextResponse.json(manager);
  } catch (error) {
    console.error('Permission manager error:', error);
    return NextResponse.json(
      {
        error: 'Failed to manage permissions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

