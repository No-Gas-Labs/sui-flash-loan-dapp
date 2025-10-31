import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useWalletKit } from '@mysten/wallet-kit';
import { toast } from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

import { WalletConnect } from '@/components/WalletConnect';
import { FlashLoanForm } from '@/components/FlashLoanForm';
import { PoolInfo } from '@/components/PoolInfo';
import { TransactionHistory } from '@/components/TransactionHistory';
import { StatsOverview } from '@/components/StatsOverview';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { usePoolInfo, useStats, useTransactionHistory } from '@/hooks/useApi';
import { API_BASE_URL } from '@/config/constants';

export default function Home() {
  const { currentAccount, isConnected, isConnectedWithSigner } = useWalletKit();
  const [isClient, setIsClient] = useState(false);

  // Handle hydration
  useEffect(() => {
    setIsClient(true);
  }, []);

  // API hooks
  const { 
    data: poolData, 
    isLoading: poolLoading, 
    error: poolError,
    mutate: refreshPool 
  } = usePoolInfo();

  const { 
    data: statsData, 
    isLoading: statsLoading 
  } = useStats();

  const { 
    data: transactions, 
    isLoading: transactionsLoading,
    mutate: refreshTransactions 
  } = useTransactionHistory(currentAccount?.address);

  // Global error handler
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Global error:', event.error);
      toast.error('An unexpected error occurred. Please refresh the page.');
    };

    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  // Reset state on wallet disconnect (R5 - Frontend State Reset)
  useEffect(() => {
    if (!isConnected) {
      // Clear cached data
      localStorage.removeItem('flash_loan_form_data');
      localStorage.removeItem('cached_transactions');
      
      // Reset any other state as needed
      refreshPool();
      refreshTransactions();
    }
  }, [isConnected, refreshPool, refreshTransactions]);

  if (!isClient) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Sui Flash Loan DApp - Hyper-Resilient Platform</title>
        <meta name="description" content="Production-grade flash loan platform on Sui blockchain with enterprise-level security" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <ErrorBoundary
        fallback={
          <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center">
            <div className="text-center p-8">
              <h1 className="text-4xl font-bold text-white mb-4">Something went wrong</h1>
              <p className="text-gray-300 mb-6">We encountered an unexpected error. Please try refreshing the page.</p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh Page
              </button>
            </div>
          </div>
        }
      >
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
          {/* Header */}
          <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-700">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between h-16">
                {/* Logo */}
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                    <span className="text-white font-bold text-xl">⚡</span>
                  </div>
                  <div>
                    <h1 className="text-xl font-bold text-white">Sui Flash Loan</h1>
                    <p className="text-xs text-gray-400">Hyper-Resilient DApp</p>
                  </div>
                </div>

                {/* Wallet Connection */}
                <WalletConnect />
              </div>
            </div>
          </header>

          {/* Main Content */}
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <AnimatePresence mode="wait">
              {!isConnected ? (
                // Landing Page
                <motion.div
                  key="landing"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="text-center py-16"
                >
                  <div className="max-w-3xl mx-auto">
                    <h2 className="text-5xl font-bold text-white mb-6">
                      Enterprise-Grade Flash Loans
                      <span className="block text-3xl text-blue-400 mt-2">on Sui Blockchain</span>
                    </h2>
                    
                    <p className="text-xl text-gray-300 mb-8 leading-relaxed">
                      Experience the future of DeFi with our hyper-resilient flash loan platform. 
                      Built with military-grade security, zero-trust architecture, and 99.9% uptime guarantee.
                    </p>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                      <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
                        <div className="text-4xl mb-4">🔒</div>
                        <h3 className="text-lg font-semibold text-white mb-2">Zero-Trust Security</h3>
                        <p className="text-gray-400 text-sm">All keys remain client-side. Military-grade encryption.</p>
                      </div>
                      
                      <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
                        <div className="text-4xl mb-4">⚡</div>
                        <h3 className="text-lg font-semibold text-white mb-2">Lightning Fast</h3>
                        <p className="text-gray-400 text-sm">Atomic execution with sub-second confirmation.</p>
                      </div>
                      
                      <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-6 border border-slate-700">
                        <div className="text-4xl mb-4">🛡️</div>
                        <h3 className="text-lg font-semibold text-white mb-2">Battle-Tested</h3>
                        <p className="text-gray-400 text-sm">99.9% uptime with automatic failover protection.</p>
                      </div>
                    </div>

                    <WalletConnect />
                  </div>
                </motion.div>
              ) : (
                // DApp Interface
                <motion.div
                  key="dapp"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                  transition={{ duration: 0.3 }}
                  className="space-y-8"
                >
                  {/* Stats Overview */}
                  <StatsOverview 
                    data={statsData} 
                    loading={statsLoading}
                  />

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Flash Loan Form */}
                    <FlashLoanForm
                      poolData={poolData}
                      loading={poolLoading}
                      error={poolError}
                      onSuccess={() => {
                        refreshPool();
                        refreshTransactions();
                        toast.success('Flash loan executed successfully!');
                      }}
                    />

                    {/* Pool Information */}
                    <PoolInfo
                      data={poolData}
                      loading={poolLoading}
                      error={poolError}
                      onRefresh={refreshPool}
                    />
                  </div>

                  {/* Transaction History */}
                  <TransactionHistory
                    transactions={transactions}
                    loading={transactionsLoading}
                    onRefresh={refreshTransactions}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </main>

          {/* Footer */}
          <footer className="bg-slate-900/50 backdrop-blur-sm border-t border-slate-700 mt-16">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="text-center">
                <p className="text-gray-400 text-sm">
                  Built with ❤️ for the Sui ecosystem • 99.9% Uptime • Enterprise Security
                </p>
                <div className="mt-4 flex justify-center space-x-6">
                  <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Documentation
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Security Audit
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                    GitHub
                  </a>
                  <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">
                    Support
                  </a>
                </div>
              </div>
            </div>
          </footer>
        </div>
      </ErrorBoundary>
    </>
  );
}