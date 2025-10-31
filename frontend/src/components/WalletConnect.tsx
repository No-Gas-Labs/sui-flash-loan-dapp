import { useState, useEffect } from 'react';
import { useWalletKit } from '@mysten/wallet-kit';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, ExternalLink, AlertCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface WalletConnectProps {}

export function WalletConnect({}: WalletConnectProps) {
  const { 
    currentWallet, 
    currentAccount, 
    isConnected, 
    isConnecting,
    connect, 
    disconnect,
    wallets 
  } = useWalletKit();

  const [showDropdown, setShowDropdown] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Reset connection state when connection succeeds
  useEffect(() => {
    if (isConnected && connectionError) {
      setConnectionError(null);
    }
  }, [isConnected, connectionError]);

  // Handle wallet connection with error handling
  const handleConnect = async (walletName: string) => {
    setConnectionError(null);
    
    try {
      await connect(walletName);
      setShowDropdown(false);
      
      // Store connection state for persistence
      localStorage.setItem('preferred_wallet', walletName);
      
      toast.success(`Connected to ${walletName}`);
    } catch (error: any) {
      console.error('Wallet connection failed:', error);
      
      let errorMessage = 'Failed to connect wallet';
      
      if (error.message?.includes('User rejected')) {
        errorMessage = 'Connection rejected by user';
      } else if (error.message?.includes('Wallet not installed')) {
        errorMessage = `${walletName} is not installed`;
      } else if (error.message?.includes('Network')) {
        errorMessage = 'Network error. Please try again.';
      }
      
      setConnectionError(errorMessage);
      toast.error(errorMessage);
    }
  };

  // Handle wallet disconnection with state reset (R5 - Frontend State Reset)
  const handleDisconnect = async () => {
    try {
      await disconnect();
      
      // Clear all cached data (Zero-Trust Architecture - R1)
      localStorage.removeItem('preferred_wallet');
      localStorage.removeItem('flash_loan_form_data');
      localStorage.removeItem('cached_transactions');
      localStorage.removeItem('wallet_connection_state');
      
      // Force page reload to ensure clean state
      window.location.reload();
    } catch (error: any) {
      console.error('Wallet disconnection failed:', error);
      toast.error('Failed to disconnect wallet');
    }
  };

  // Copy address to clipboard
  const copyAddress = async () => {
    if (!currentAccount?.address) return;
    
    try {
      await navigator.clipboard.writeText(currentAccount.address);
      setCopiedAddress(true);
      toast.success('Address copied to clipboard');
      
      setTimeout(() => setCopiedAddress(false), 2000);
    } catch (error) {
      toast.error('Failed to copy address');
    }
  };

  // Format address for display
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Get wallet icon
  const getWalletIcon = (walletName: string) => {
    const icons: { [key: string]: string } = {
      'Sui Wallet': '🦊',
      'Ethos Wallet': '🔮',
      'Suiet Wallet': '🐸',
    };
    return icons[walletName] || '🔐';
  };

  if (!isConnected) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          disabled={isConnecting}
          className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-lg hover:shadow-xl transform hover:scale-105"
        >
          {isConnecting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <>
              <span>🔐</span>
              <span>Connect Wallet</span>
            </>
          )}
        </button>

        <AnimatePresence>
          {showDropdown && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full mt-2 right-0 w-64 bg-slate-800 rounded-lg shadow-xl border border-slate-700 z-50"
            >
              <div className="p-2">
                {wallets.length === 0 ? (
                  <div className="p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">No wallets available</p>
                    <p className="text-gray-500 text-xs mt-1">
                      Install a Sui wallet to continue
                    </p>
                  </div>
                ) : (
                  wallets.map((wallet) => (
                    <button
                      key={wallet.name}
                      onClick={() => handleConnect(wallet.name)}
                      className="w-full flex items-center space-x-3 p-3 rounded-lg hover:bg-slate-700 transition-colors text-left"
                    >
                      <span className="text-2xl">{getWalletIcon(wallet.name)}</span>
                      <div className="flex-1">
                        <p className="text-white font-medium">{wallet.name}</p>
                        <p className="text-gray-400 text-xs">
                          {wallet.installed ? 'Installed' : 'Not installed'}
                        </p>
                      </div>
                      {!wallet.installed && (
                        <ExternalLink className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  ))
                )}
              </div>

              {connectionError && (
                <div className="p-3 bg-red-500/10 border-t border-red-500/20">
                  <p className="text-red-400 text-sm">{connectionError}</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Click outside to close dropdown */}
        {showDropdown && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
        )}
      </div>
    );
  }

  // Connected state
  return (
    <div className="flex items-center space-x-4">
      <div className="hidden md:flex items-center space-x-3 bg-slate-800/50 backdrop-blur-sm rounded-lg px-4 py-2 border border-slate-700">
        <span className="text-2xl">{getWalletIcon(currentWallet?.name || 'Unknown')}</span>
        <div>
          <p className="text-white font-medium text-sm">
            {currentWallet?.name || 'Connected'}
          </p>
          <div className="flex items-center space-x-2">
            <p className="text-gray-400 text-xs font-mono">
              {currentAccount?.address && formatAddress(currentAccount.address)}
            </p>
            <button
              onClick={copyAddress}
              className="text-gray-400 hover:text-white transition-colors"
              title="Copy address"
            >
              {copiedAddress ? (
                <Check className="w-3 h-3" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          </div>
        </div>
      </div>

      <button
        onClick={handleDisconnect}
        className="px-4 py-2 bg-red-600/20 text-red-400 border border-red-600/30 rounded-lg hover:bg-red-600/30 transition-all duration-200 font-medium"
      >
        Disconnect
      </button>
    </div>
  );
}