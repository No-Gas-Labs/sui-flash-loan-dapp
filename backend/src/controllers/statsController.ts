import { Request, Response, Router } from 'express';
import { query } from '@/services/databaseService';
import { setWithExpiry, get } from '@/services/redisService';

const router = Router();

/**
 * GET /api/v1/stats
 * Get aggregate statistics
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const cacheKey = 'stats:aggregate';

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

    // Fetch statistics from database
    const [totalVolumeResult, totalLoansResult, totalFeesResult, recentLoansResult] = await Promise.all([
      query('SELECT COALESCE(SUM(amount), 0) as total FROM transactions WHERE status = $1', ['success']),
      query('SELECT COUNT(*) as count FROM transactions WHERE status = $1', ['success']),
      query('SELECT COALESCE(SUM(fee_amount), 0) as total FROM transactions WHERE status = $1', ['success']),
      query('SELECT COUNT(*) as count FROM transactions WHERE status = $1 AND timestamp > NOW() - INTERVAL \'24 hours\'', ['success']),
    ]);

    const stats = {
      totalVolume: parseInt(totalVolumeResult.rows[0].total),
      totalLoans: parseInt(totalLoansResult.rows[0].count),
      totalFees: parseInt(totalFeesResult.rows[0].total),
      loansLast24h: parseInt(recentLoansResult.rows[0].count),
      averageLoanSize: totalLoansResult.rows[0].count > 0 
        ? Math.floor(totalVolumeResult.rows[0].total / totalLoansResult.rows[0].count)
        : 0,
    };

    // Cache for 10 minutes
    await setWithExpiry(cacheKey, JSON.stringify(stats), 600);

    res.json({
      success: true,
      data: stats,
      cached: false,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'STATS_FETCH_ERROR',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/v1/stats/transactions/:address
 * Get transaction history for an address
 */
router.get('/transactions/:address', async (req: Request, res: Response) => {
  try {
    const { address } = req.params;
    const limit = parseInt(req.query.limit as string) || 50;

    const result = await query(
      'SELECT * FROM transactions WHERE borrower = $1 ORDER BY timestamp DESC LIMIT $2',
      [address, limit]
    );

    res.json({
      success: true,
      data: result.rows,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: {
        code: 'TRANSACTIONS_FETCH_ERROR',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export const statsRoutes = router;
export default router;