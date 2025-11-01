import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { WalletConnect } from '../WalletConnect';
import { useWalletKit } from '@mysten/wallet-kit';

// Mock wallet kit
jest.mock('@mysten/wallet-kit', () => ({
  useWalletKit: jest.fn(),
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
  },
}));

describe('WalletConnect Component', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('should render connect button when wallet is not connected', () => {
    (useWalletKit as jest.Mock).mockReturnValue({
      currentAccount: null,
      isConnected: false,
      connect: jest.fn(),
      disconnect: jest.fn(),
    });

    render(<WalletConnect />);
    
    expect(screen.getByText(/connect wallet/i)).toBeInTheDocument();
  });

  it('should render disconnect button when wallet is connected', () => {
    (useWalletKit as jest.Mock).mockReturnValue({
      currentAccount: {
        address: '0x1234567890abcdef',
      },
      isConnected: true,
      connect: jest.fn(),
      disconnect: jest.fn(),
    });

    render(<WalletConnect />);
    
    expect(screen.getByText(/disconnect/i)).toBeInTheDocument();
    expect(screen.getByText(/0x1234/)).toBeInTheDocument();
  });

  it('should call connect function when connect button is clicked', async () => {
    const mockConnect = jest.fn().mockResolvedValue(undefined);
    
    (useWalletKit as jest.Mock).mockReturnValue({
      currentAccount: null,
      isConnected: false,
      connect: mockConnect,
      disconnect: jest.fn(),
    });

    render(<WalletConnect />);
    
    const connectButton = screen.getByText(/connect wallet/i);
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(mockConnect).toHaveBeenCalled();
    });
  });

  it('should call disconnect and clear storage when disconnect button is clicked', async () => {
    const mockDisconnect = jest.fn().mockResolvedValue(undefined);
    
    // Set some localStorage items
    localStorage.setItem('wallet_connected', 'true');
    localStorage.setItem('cached_transactions', JSON.stringify([]));
    
    (useWalletKit as jest.Mock).mockReturnValue({
      currentAccount: {
        address: '0x1234567890abcdef',
      },
      isConnected: true,
      connect: jest.fn(),
      disconnect: mockDisconnect,
    });

    // Mock window.location.reload
    delete window.location;
    window.location = { reload: jest.fn() } as any;

    render(<WalletConnect />);
    
    const disconnectButton = screen.getByText(/disconnect/i);
    fireEvent.click(disconnectButton);

    await waitFor(() => {
      expect(mockDisconnect).toHaveBeenCalled();
    });
  });

  it('should handle connection errors gracefully', async () => {
    const mockConnect = jest.fn().mockRejectedValue(new Error('Connection failed'));
    const mockToastError = require('react-hot-toast').toast.error;
    
    (useWalletKit as jest.Mock).mockReturnValue({
      currentAccount: null,
      isConnected: false,
      connect: mockConnect,
      disconnect: jest.fn(),
    });

    render(<WalletConnect />);
    
    const connectButton = screen.getByText(/connect wallet/i);
    fireEvent.click(connectButton);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });
  });

  it('should truncate long addresses correctly', () => {
    (useWalletKit as jest.Mock).mockReturnValue({
      currentAccount: {
        address: '0x1234567890abcdef1234567890abcdef',
      },
      isConnected: true,
      connect: jest.fn(),
      disconnect: jest.fn(),
    });

    render(<WalletConnect />);
    
    // Should show first 6 and last 4 characters
    expect(screen.getByText(/0x1234...cdef/)).toBeInTheDocument();
  });
});
