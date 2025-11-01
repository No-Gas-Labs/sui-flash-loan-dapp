import { renderHook, waitFor } from '@testing-library/react';
import { useApi } from '../useApi';
import axios from 'axios';
import { SWRConfig } from 'swr';

jest.mock('axios');

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig value={{ dedupingInterval: 0, provider: () => new Map() }}>
    {children}
  </SWRConfig>
);

describe('useApi Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should fetch data successfully', async () => {
    const mockData = { message: 'Success' };
    (axios.get as jest.Mock).mockResolvedValue({ data: mockData });

    const { result } = renderHook(
      () => useApi('/api/test'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
      expect(result.current.error).toBeUndefined();
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should handle errors', async () => {
    const mockError = new Error('API Error');
    (axios.get as jest.Mock).mockRejectedValue(mockError);

    const { result } = renderHook(
      () => useApi('/api/test'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.error).toBeDefined();
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should support manual revalidation', async () => {
    const mockData = { message: 'Success' };
    (axios.get as jest.Mock).mockResolvedValue({ data: mockData });

    const { result } = renderHook(
      () => useApi('/api/test'),
      { wrapper }
    );

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData);
    });

    // Update mock data
    const updatedData = { message: 'Updated' };
    (axios.get as jest.Mock).mockResolvedValue({ data: updatedData });

    // Manually revalidate
    await result.current.mutate();

    await waitFor(() => {
      expect(result.current.data).toEqual(updatedData);
    });
  });

  it('should handle loading state correctly', async () => {
    (axios.get as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ data: {} }), 100))
    );

    const { result } = renderHook(
      () => useApi('/api/test'),
      { wrapper }
    );

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 200 });
  });
});
