import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { FlashLoanForm } from '../FlashLoanForm';
import axios from 'axios';

jest.mock('axios');
jest.mock('@mysten/wallet-kit', () => ({
  useWalletKit: () => ({
    currentAccount: { address: '0x123abc' },
    signAndExecuteTransactionBlock: jest.fn(),
  }),
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    loading: jest.fn(),
  },
}));

describe('FlashLoanForm Component', () => {
  const mockPoolData = {
    poolId: '0xpool123',
    balance: 1000000,
    feeRate: 5,
    isPaused: false,
    maxLoanAmount: 500000,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the form with all fields', () => {
    render(
      <FlashLoanForm
        poolData={mockPoolData}
        loading={false}
        error={null}
        onSuccess={jest.fn()}
      />
    );

    expect(screen.getByLabelText(/loan amount/i)).toBeInTheDocument();
    expect(screen.getByText(/request flash loan/i)).toBeInTheDocument();
  });

  it('should display pool information', () => {
    render(
      <FlashLoanForm
        poolData={mockPoolData}
        loading={false}
        error={null}
        onSuccess={jest.fn()}
      />
    );

    expect(screen.getByText(/available liquidity/i)).toBeInTheDocument();
  });

  it('should validate amount is positive', async () => {
    render(
      <FlashLoanForm
        poolData={mockPoolData}
        loading={false}
        error={null}
        onSuccess={jest.fn()}
      />
    );

    const input = screen.getByLabelText(/loan amount/i);
    fireEvent.change(input, { target: { value: '-100' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByText(/must be positive/i)).toBeInTheDocument();
    });
  });

  it('should validate amount does not exceed max loan', async () => {
    render(
      <FlashLoanForm
        poolData={mockPoolData}
        loading={false}
        error={null}
        onSuccess={jest.fn()}
      />
    );

    const input = screen.getByLabelText(/loan amount/i);
    fireEvent.change(input, { target: { value: '600000' } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(screen.getByText(/exceeds maximum/i)).toBeInTheDocument();
    });
  });

  it('should estimate gas when amount changes', async () => {
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          gasEstimate: 120000,
          feeAmount: 50,
          totalRepayment: 100050,
          isViable: true,
        },
      },
    });

    render(
      <FlashLoanForm
        poolData={mockPoolData}
        loading={false}
        error={null}
        onSuccess={jest.fn()}
      />
    );

    const input = screen.getByLabelText(/loan amount/i);
    fireEvent.change(input, { target: { value: '100000' } });

    await waitFor(() => {
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/estimate'),
        expect.any(Object)
      );
    });
  });

  it('should disable submit when pool is paused', () => {
    const pausedPoolData = { ...mockPoolData, isPaused: true };
    
    render(
      <FlashLoanForm
        poolData={pausedPoolData}
        loading={false}
        error={null}
        onSuccess={jest.fn()}
      />
    );

    const submitButton = screen.getByText(/request flash loan/i);
    expect(submitButton).toBeDisabled();
  });

  it('should call onSuccess after successful loan execution', async () => {
    const mockOnSuccess = jest.fn();
    
    (axios.post as jest.Mock).mockResolvedValue({
      data: {
        success: true,
        data: {
          transactionHash: '0xtxhash123',
          status: 'success',
        },
      },
    });

    render(
      <FlashLoanForm
        poolData={mockPoolData}
        loading={false}
        error={null}
        onSuccess={mockOnSuccess}
      />
    );

    const input = screen.getByLabelText(/loan amount/i);
    fireEvent.change(input, { target: { value: '100000' } });

    const submitButton = screen.getByText(/request flash loan/i);
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnSuccess).toHaveBeenCalled();
    });
  });
});
