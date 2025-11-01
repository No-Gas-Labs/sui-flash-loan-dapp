import type { AppProps } from 'next/app';
import { WalletKitProvider } from '@mysten/wallet-kit';
import { Toaster } from 'react-hot-toast';
import '@/styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <WalletKitProvider>
      <Component {...pageProps} />
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 5000,
          style: {
            background: '#1e293b',
            color: '#fff',
            border: '1px solid #334155',
          },
          success: {
            iconTheme: {
              primary: '#22c55e',
              secondary: '#fff',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </WalletKitProvider>
  );
}