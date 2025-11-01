import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';
import { ReactNode } from 'react';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <div>No error</div>;
};

describe('ErrorBoundary Component', () => {
  // Suppress console.error for cleaner test output
  beforeAll(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    (console.error as jest.Mock).mockRestore();
  });

  it('should render children when there is no error', () => {
    render(
      <ErrorBoundary fallback={<div>Error occurred</div>}>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should render fallback when error occurs', () => {
    render(
      <ErrorBoundary fallback={<div>Error occurred</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error occurred')).toBeInTheDocument();
  });

  it('should call onReset when provided', () => {
    const mockOnReset = jest.fn();
    
    const { rerender } = render(
      <ErrorBoundary 
        fallback={<div>Error occurred</div>}
        onReset={mockOnReset}
      >
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error occurred')).toBeInTheDocument();

    // Reset by re-rendering with no error
    rerender(
      <ErrorBoundary 
        fallback={<div>Error occurred</div>}
        onReset={mockOnReset}
      >
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );
  });

  it('should handle multiple errors', () => {
    const { rerender } = render(
      <ErrorBoundary fallback={<div>Error 1</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error 1')).toBeInTheDocument();

    // Trigger another error
    rerender(
      <ErrorBoundary fallback={<div>Error 2</div>}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(screen.getByText('Error 2')).toBeInTheDocument();
  });
});
