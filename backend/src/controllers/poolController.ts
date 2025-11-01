import { Request, Response, Router } from 'express';
import { getObject } from '@/services/suiService';
import { updatePoolState } from '@/services/databaseService';
import { setWithExpiry, get } from '@/services/redisService';

const router = Router();

/**
 * GET /api/v1/pools/:poolId
 * Get pool information
 */
router.get('/:poolId', async (req: Request, res: Response) => {
  try {
    const { poolId } = req.params;
    const cacheKey = `pool:${poolId}`;

    // Check cache first
    const cached = await get(cacheKey);
    if (cached) {
      return res.json({
        success: true,
        data: JSON.parse(cached),
        cached: true,
        timestamp: new Date().toISOString(),
      });
    }

    // Fetch from blockchain
    const poolObject = await getObject(poolId);

    if (!poolObject.data) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'POOL_NOT_FOUND',
          message: `Pool ${poolId} not found`,
        },
        timestamp: new Date().toISOString(),
      });
    }

    const poolData = poolObject.data.content as any;

    // Parse pool information
    const poolInfo = {
      poolId,
      owner: poolData.fields.owner,
      balance: parseInt(poolData.fields.balance),
      feeRate: parseInt(poolData.fields.fee_rate),
      isPaused: poolData.fields.is_paused,
      totalLoansIssued: parseInt(poolData.fields.total_loans_issued),
      totalFeesCollected: parseInt(poolData.fields.total_fees_collected),
      poolVersion: parseInt(poolData.fields.pool_version),
      createdAt: parseInt(poolData.fields.created_at),
      maxLoanAmount: parseInt(poolData.fields.max_loan_amount),
      activeLoansCount: poolData.fields.active_loans?.length || 0,
    };

    // Update database
    await updatePoolState(poolId, {
      balance: poolInfo.balance,
      feeRate: poolInfo.feeRate,
      isPaused: poolInfo.isPaused,
      totalLoansIssued: poolInfo.totalLoansIssued,
      totalFeesCollected: poolInfo.totalFeesCollected,
    });

    // Cache for 5 minutes
    await setWithExpiry(cacheKey, JSON.stringify(poolInfo), 300);

    res.json({
      success: true,
      data: poolInfo,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'POOL_FETCH_ERROR',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/v1/pools
 * List all pools
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // This would query all pools from the blockchain or database
    // For now, return empty array
    res.json({
      success: true,
      data: [],
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'POOLS_FETCH_ERROR',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export const poolRoutes = router;
export default router;