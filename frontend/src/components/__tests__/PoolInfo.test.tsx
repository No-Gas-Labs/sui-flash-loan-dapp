import { render, screen } from '@testing-library/react';
import { PoolInfo } from '../PoolInfo';

describe('PoolInfo Component', () => {
  const mockPoolData = {
    poolId: '0xpool123',
    balance: 1000000,
    feeRate: 5,
    isPaused: false,
    totalLoansIssued: 42,
    totalFeesCollected: 2100,
    maxLoanAmount: 500000,
    activeLoansCount: 3,
  };

  it('should render pool information correctly', () => {
    render(
      <PoolInfo
        data={mockPoolData}
        loading={false}
        error={null}
        onRefresh={jest.fn()}
      />
    );

    expect(screen.getByText(/pool information/i)).toBeInTheDocument();
  });

  it('should display loading state', () => {
    render(
      <PoolInfo
        data={null}
        loading={true}
        error={null}
        onRefresh={jest.fn()}
      />
    );

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should display error state', () => {
    render(
      <PoolInfo
        data={null}
        loading={false}
        error="Failed to load pool data"
        onRefresh={jest.fn()}
      />
    );

    expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
  });

  it('should format large numbers correctly', () => {
    render(
      <PoolInfo
        data={mockPoolData}
        loading={false}
        error={null}
        onRefresh={jest.fn()}
      />
    );

    // Should display formatted numbers (e.g., 1,000,000)
    expect(screen.getByText(/1,000,000/)).toBeInTheDocument();
  });

  it('should display fee rate as percentage', () => {
    render(
      <PoolInfo
        data={mockPoolData}
        loading={false}
        error={null}
        onRefresh={jest.fn()}
      />
    );

    // Fee rate of 5 basis points = 0.05%
    expect(screen.getByText(/0.05%/)).toBeInTheDocument();
  });

  it('should show paused status when pool is paused', () => {
    const pausedPoolData = { ...mockPoolData, isPaused: true };
    
    render(
      <PoolInfo
        data={pausedPoolData}
        loading={false}
        error={null}
        onRefresh={jest.fn()}
      />
    );

    expect(screen.getByText(/paused/i)).toBeInTheDocument();
  });
});
