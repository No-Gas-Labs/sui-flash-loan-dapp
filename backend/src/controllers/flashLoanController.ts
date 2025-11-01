import { Request, Response, Router } from 'express';
import Joi from 'joi';
import { v4 as uuidv4 } from 'uuid';
import { estimateGasCost, executeTransaction } from '@/services/suiService';
import { insertAuditLog, insertTransaction } from '@/services/databaseService';
import { flashLoanRateLimitMiddleware } from '@/middleware/rateLimiter';
import { ValidationError } from '@/types';
import { auditLogger } from '@/utils/logger';

const router = Router();

/**
 * Validation schemas
 */
const estimateSchema = Joi.object({
  poolId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  borrowerAddress: Joi.string().required(),
});

const executeSchema = Joi.object({
  poolId: Joi.string().required(),
  amount: Joi.number().positive().required(),
  borrowerAddress: Joi.string().required(),
  transactionBlock: Joi.object().required(),
});

/**
 * POST /api/v1/flash-loan/estimate
 * Estimate gas cost for flash loan
 */
router.post('/estimate', async (req: Request, res: Response) => {
  try {
    const { error, value } = estimateSchema.validate(req.body);
    
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { poolId, amount, borrowerAddress } = value;
    const requestId = uuidv4();

    // Build transaction block for estimation
    // This would be implemented with actual Sui transaction building
    const transactionBlock = {} as any; // Placeholder

    // Estimate gas
    const gasEstimate = await estimateGasCost(transactionBlock, borrowerAddress);

    // Calculate fee (0.05% = 5 basis points)
    const feeRate = 5;
    const feeAmount = Math.floor((amount * feeRate) / 10000);
    const totalRepayment = amount + feeAmount;

    // Log estimation
    await insertAuditLog({
      requestId,
      action: 'flash_loan_estimate',
      poolId,
      borrower: borrowerAddress,
      amount,
      status: gasEstimate.isValid ? 'success' : 'failed',
      error: gasEstimate.error,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
    });

    res.json({
      success: true,
      data: {
        gasEstimate: gasEstimate.gasEstimate,
        isViable: gasEstimate.isValid,
        feeAmount,
        totalRepayment,
        breakdown: gasEstimate.breakdown,
        error: gasEstimate.error,
      },
      timestamp: new Date().toISOString(),
      requestId,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'ESTIMATION_ERROR',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * POST /api/v1/flash-loan/execute
 * Execute flash loan transaction
 */
router.post('/execute', flashLoanRateLimitMiddleware, async (req: Request, res: Response) => {
  try {
    const { error, value } = executeSchema.validate(req.body);
    
    if (error) {
      throw new ValidationError(error.details[0].message);
    }

    const { poolId, amount, borrowerAddress, transactionBlock } = value;
    const requestId = uuidv4();

    // Execute transaction
    const result = await executeTransaction(transactionBlock, borrowerAddress);

    // Calculate fee
    const feeRate = 5;
    const feeAmount = Math.floor((amount * feeRate) / 10000);

    // Log transaction
    await insertAuditLog({
      requestId,
      action: 'flash_loan_execute',
      poolId,
      borrower: borrowerAddress,
      amount,
      txHash: result.digest,
      status: result.status,
      gasUsed: parseInt(result.gasUsed.computationCost || '0'),
      error: result.error,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
    });

    // Store transaction in database
    if (result.status === 'success') {
      await insertTransaction({
        txHash: result.digest,
        poolId,
        borrower: borrowerAddress,
        amount,
        feeAmount,
        status: result.status,
        gasUsed: parseInt(result.gasUsed.computationCost || '0'),
      });
    }

    // Audit log
    auditLogger.logFlashLoan({
      requestId,
      poolId,
      borrower: borrowerAddress,
      amount,
      feeAmount,
      txHash: result.digest,
      status: result.status,
      gasUsed: parseInt(result.gasUsed.computationCost || '0'),
      error: result.error,
      ip: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
    });

    res.json({
      success: result.status === 'success',
      data: {
        transactionHash: result.digest,
        status: result.status,
        gasUsed: result.gasUsed,
        events: result.events,
        error: result.error,
      },
      timestamp: new Date().toISOString(),
      requestId,
    });
  } catch (error: any) {
    res.status(error.statusCode || 500).json({
      success: false,
      error: {
        code: error.code || 'EXECUTION_ERROR',
        message: error.message,
      },
      timestamp: new Date().toISOString(),
    });
  }
});

export const flashLoanRoutes = router;
export default router;