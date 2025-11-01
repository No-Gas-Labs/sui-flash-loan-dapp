import { useState, useEffect } from 'react';
import { useWalletKit } from '@mysten/wallet-kit';
import { toast } from 'react-hot-toast';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL, FLASH_LOAN_CONFIG } from '@/config/constants';

interface FlashLoanFormProps {
  poolData: any;
  loading: boolean;
  error: any;
  onSuccess: () => void;
}

export function FlashLoanForm({ poolData, loading, error, onSuccess }: FlashLoanFormProps) {
  const { currentAccount, signAndExecuteTransactionBlock } = useWalletKit();
  const [amount, setAmount] = useState('');
  const [isEstimating, setIsEstimating] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [gasEstimate, setGasEstimate] = useState<any>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);

  // Debounced gas estimation
  useEffect(() => {
    if (!amount || parseFloat(amount) <= 0 || !currentAccount || !poolData) {
      setGasEstimate(null);
      setEstimateError(null);
      return;
    }

    const timer = setTimeout(async () => {
      await estimateGas();
    }, 500);

    return () => clearTimeout(timer);
  }, [amount, currentAccount, poolData]);

  const estimateGas = async () => {
    setIsEstimating(true);
    setEstimateError(null);

    try {
      const amountInMist = Math.floor(parseFloat(amount) * 1e9);

      const response = await axios.post(`${API_BASE_URL}/api/v1/flash-loan/estimate`, {
        poolId: poolData.poolId,
        amount: amountInMist,
        borrowerAddress: currentAccount?.address,
      });

      if (response.data.success) {
        setGasEstimate(response.data.data);
        if (!response.data.data.isViable) {
          setEstimateError(response.data.data.error || 'Transaction validation failed');
        }
      }
    } catch (error: any) {
      console.error('Gas estimation failed:', error);
      setEstimateError(error.response?.data?.error?.message || 'Failed to estimate gas');
    } finally {
      setIsEstimating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentAccount) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!gasEstimate?.isViable) {
      toast.error('Transaction validation failed');
      return;
    }

    setIsExecuting(true);

    try {
      const amountInMist = Math.floor(parseFloat(amount) * 1e9);

      // Build transaction block (simplified - would need actual implementation)
      const transactionBlock = {
        // Transaction building logic here
      };

      // Execute transaction
      const response = await axios.post(`${API_BASE_URL}/api/v1/flash-loan/execute`, {
        poolId: poolData.poolId,
        amount: amountInMist,
        borrowerAddress: currentAccount.address,
        transactionBlock,
      });

      if (response.data.success) {
        toast.success('Flash loan executed successfully!');
        setAmount('');
        setGasEstimate(null);
        onSuccess();
      } else {
        throw new Error(response.data.error?.message || 'Transaction failed');
      }
    } catch (error: any) {
      console.error('Flash loan execution failed:', error);
      toast.error(error.response?.data?.error?.message || 'Failed to execute flash loan');
    } finally {
      setIsExecuting(false);
    }
  };

  const formatSUI = (mist: number) => {
    return (mist / 1e9).toFixed(4);
  };

  if (loading) {
    return (
      <div className="card">
        <div className="card-body flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="card-body">
          <div className="flex items-center space-x-2 text-red-400">
            <AlertCircle className="w-5 h-5" />
            <span>Failed to load pool data</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header">
        <h2 className="text-xl font-bold text-white">Request Flash Loan</h2>
        <p className="text-sm text-gray-400 mt-1">Borrow SUI instantly with 0.05% fee</p>
      </div>

      <form onSubmit={handleSubmit} className="card-body space-y-6">
        {/* Amount Input */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Loan Amount (SUI)
          </label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            step="0.001"
            min={formatSUI(FLASH_LOAN_CONFIG.MIN_LOAN_AMOUNT)}
            max={poolData ? formatSUI(poolData.balance) : undefined}
            className="input"
            disabled={isExecuting}
          />
          {poolData && (
            <p className="text-xs text-gray-400 mt-1">
              Available: {formatSUI(poolData.balance)} SUI
            </p>
          )}
        </div>

        {/* Gas Estimate */}
        {isEstimating && (
          <div className="flex items-center space-x-2 text-gray-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Estimating gas cost...</span>
          </div>
        )}

        {gasEstimate && !isEstimating && (
          <div className="bg-slate-900/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Loan Amount:</span>
              <span className="text-white font-medium">{amount} SUI</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Fee (0.05%):</span>
              <span className="text-white font-medium">
                {formatSUI(gasEstimate.feeAmount)} SUI
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total Repayment:</span>
              <span className="text-white font-medium">
                {formatSUI(gasEstimate.totalRepayment)} SUI
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Estimated Gas:</span>
              <span className="text-white font-medium">
                {gasEstimate.gasEstimate.toLocaleString()} MIST
              </span>
            </div>
            {gasEstimate.isViable ? (
              <div className="flex items-center space-x-2 text-success-400 text-sm pt-2">
                <CheckCircle className="w-4 h-4" />
                <span>Transaction validated</span>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-error-400 text-sm pt-2">
                <AlertCircle className="w-4 h-4" />
                <span>{estimateError || 'Validation failed'}</span>
              </div>
            )}
          </div>
        )}

        {estimateError && !isEstimating && (
          <div className="flex items-center space-x-2 text-error-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{estimateError}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={
            !currentAccount ||
            !amount ||
            parseFloat(amount) <= 0 ||
            isEstimating ||
            isExecuting ||
            !gasEstimate?.isViable
          }
          className="btn-primary w-full"
        >
          {isExecuting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              Executing...
            </>
          ) : (
            'Request Flash Loan'
          )}
        </button>

        {/* Warning */}
        <div className="bg-warning-500/10 border border-warning-500/20 rounded-lg p-4">
          <p className="text-xs text-warning-400">
            ⚠️ Flash loans must be repaid within the same transaction. Ensure your use case
            can generate enough funds to repay the loan plus fees.
          </p>
        </div>
      </form>
    </div>
  );
}