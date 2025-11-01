import { RefreshCw, AlertCircle, Loader2 } from 'lucide-react';

interface PoolInfoProps {
  data: any;
  loading: boolean;
  error: any;
  onRefresh: () => void;
}

export function PoolInfo({ data, loading, error, onRefresh }: PoolInfoProps) {
  const formatSUI = (mist: number) => {
    return (mist / 1e9).toFixed(4);
  };

  const formatFeeRate = (rate: number) => {
    return (rate / 100).toFixed(2);
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
          <div className="flex items-center space-x-2 text-red-400 mb-4">
            <AlertCircle className="w-5 h-5" />
            <span>Failed to load pool information</span>
          </div>
          <button onClick={onRefresh} className="btn-outline">
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card">
        <div className="card-body">
          <p className="text-gray-400">No pool data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Pool Information</h2>
          <p className="text-sm text-gray-400 mt-1">Real-time pool statistics</p>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="card-body space-y-4">
        {/* Pool Status */}
        <div className="flex items-center justify-between">
          <span className="text-gray-400">Status</span>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              data.isPaused
                ? 'bg-red-500/20 text-red-400'
                : 'bg-success-500/20 text-success-400'
            }`}
          >
            {data.isPaused ? 'Paused' : 'Active'}
          </span>
        </div>

        {/* Available Liquidity */}
        <div className="bg-slate-900/50 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-1">Available Liquidity</p>
          <p className="text-3xl font-bold text-white">
            {formatSUI(data.balance)} <span className="text-lg text-gray-400">SUI</span>
          </p>
        </div>

        {/* Pool Statistics */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Fee Rate</p>
            <p className="text-xl font-bold text-white">{formatFeeRate(data.feeRate)}%</p>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Max Loan</p>
            <p className="text-xl font-bold text-white">
              {formatSUI(data.maxLoanAmount)}
            </p>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Total Loans</p>
            <p className="text-xl font-bold text-white">
              {data.totalLoansIssued.toLocaleString()}
            </p>
          </div>

          <div className="bg-slate-900/50 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Fees Collected</p>
            <p className="text-xl font-bold text-white">
              {formatSUI(data.totalFeesCollected)}
            </p>
          </div>
        </div>

        {/* Pool Details */}
        <div className="border-t border-slate-700 pt-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Pool Version</span>
            <span className="text-white font-medium">v{data.poolVersion}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Active Loans</span>
            <span className="text-white font-medium">{data.activeLoansCount}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Pool ID</span>
            <span className="text-white font-mono text-xs">
              {data.poolId.slice(0, 8)}...{data.poolId.slice(-6)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}