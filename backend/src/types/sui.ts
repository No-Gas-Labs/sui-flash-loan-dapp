export interface SuiObjectResponse {
  data?: {
    objectId: string;
    version: string;
    digest: string;
    type?: string;
    owner?: any;
    previousTransaction?: string;
    storageRebate?: string;
    content?: any;
  };
  error?: any;
}

export interface SuiTransactionBlockResponse {
  digest: string;
  transaction?: any;
  effects?: any;
  events?: any[];
  objectChanges?: any[];
  balanceChanges?: any[];
  timestampMs?: string;
  checkpoint?: string;
  confirmedLocalExecution?: boolean;
}

export interface SuiSystemState {
  epoch: string;
  protocolVersion: string;
  systemStateVersion: string;
  storageFundTotalObjectStorageRebates: string;
  storageFundNonRefundableBalance: string;
  referenceGasPrice: string;
  safeMode: boolean;
  safeModeStorageRewards: string;
  safeModeComputationRewards: string;
  safeModeStorageRebates: string;
  safeModeNonRefundableStorageFee: string;
  epochStartTimestampMs: string;
  epochDurationMs: string;
  stakeSubsidyStartEpoch: string;
  maxValidatorCount: string;
  minValidatorJoiningStake: string;
  validatorLowStakeThreshold: string;
  validatorVeryLowStakeThreshold: string;
  validatorLowStakeGracePeriod: string;
  activeValidators: any[];
}