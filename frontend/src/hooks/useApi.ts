import useSWR from 'swr';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const fetcher = (url: string) => axios.get(url).then(res => res.data.data);

export function usePoolInfo(poolId?: string) {
  const { data, error, isLoading, mutate } = useSWR(
    poolId ? `${API_BASE_URL}/api/v1/pools/${poolId}` : null,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
      revalidateOnFocus: true,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}

export function useStats() {
  const { data, error, isLoading, mutate } = useSWR(
    `${API_BASE_URL}/api/v1/stats`,
    fetcher,
    {
      refreshInterval: 60000, // Refresh every minute
      revalidateOnFocus: true,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}

export function useTransactionHistory(address?: string) {
  const { data, error, isLoading, mutate } = useSWR(
    address ? `${API_BASE_URL}/api/v1/stats/transactions/${address}` : null,
    fetcher,
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
    }
  );

  return {
    data,
    error,
    isLoading,
    mutate,
  };
}