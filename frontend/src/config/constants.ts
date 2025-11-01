export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
export const SUI_NETWORK = process.env.NEXT_PUBLIC_SUI_NETWORK || 'testnet';
export const PACKAGE_ID = process.env.NEXT_PUBLIC_PACKAGE_ID || '';

export const FLASH_LOAN_CONFIG = {
  MIN_LOAN_AMOUNT: 1000000, // 0.001 SUI in MIST
  MAX_LOAN_AMOUNT: 1000000000000, // 1000 SUI in MIST
  FEE_RATE: 5, // 0.05% in basis points
  GAS_BUDGET: 500000,
};

export const UI_CONFIG = {
  TOAST_DURATION: 5000,
  REFRESH_INTERVAL: 30000,
  CACHE_DURATION: 300000,
};