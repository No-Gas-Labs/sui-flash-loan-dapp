import { RefreshCw, ExternalLink, CheckCircle, XCircle, Clock } from 'lucide-react';
import { LoadingSpinner } from './LoadingSpinner';

interface TransactionHistoryProps {
  transactions: any[];
  loading: boolean;
  onRefresh: () => void;
}

export function TransactionHistory({ transactions, loading, onRefresh }: TransactionHistoryProps) {
  const formatSUI = (mist: number) => {
    return (mist / 1e9).toFixed(4);
  };

  const formatDate = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-success-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-error-400" />;
      default:
        return <Clock className="w-5 h-5 text-warning-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-success-500/20 text-success-400';
      case 'failed':
        return 'bg-error-500/20 text-error-400';
      default:
        return 'bg-warning-500/20 text-warning-400';
    }
  };

  return (
    <div className="card">
      <div className="card-header flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Transaction History</h2>
          <p className="text-sm text-gray-400 mt-1">Your recent flash loan transactions</p>
        </div>
        <button
          onClick={onRefresh}
          className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      <div className="card-body">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : !transactions || transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-400">No transactions yet</p>
            <p className="text-sm text-gray-500 mt-2">
              Your flash loan transactions will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((tx, index) => (
              <div
                key={index}
                className="bg-slate-900/50 rounded-lg p-4 hover:bg-slate-900/70 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(tx.status)}
                    <div>
                      <p className="text-white font-medium">
                        {formatSUI(tx.amount)} SUI
                      </p>
                      <p className="text-xs text-gray-400">
                        Fee: {formatSUI(tx.fee_amount)} SUI
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(
                      tx.status
                    )}`}
                  >
                    {tx.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Transaction Hash</span>
                    <a
                      href={`https://suiexplorer.com/txblock/${tx.tx_hash}?network=testnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 flex items-center space-x-1"
                    >
                      <span className="font-mono">
                        {tx.tx_hash.slice(0, 8)}...{tx.tx_hash.slice(-6)}
                      </span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {tx.gas_used && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Gas Used</span>
                      <span className="text-white">
                        {parseInt(tx.gas_used).toLocaleString()} MIST
                      </span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span className="text-gray-400">Time</span>
                    <span className="text-white">{formatDate(tx.timestamp)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}