import type { Address, Hex } from 'viem';

export type Network = 'testnet' | 'mainnet';

export type Rail = 'cctp-v2';

export type ChainKey =
  | 'ethereum'
  | 'arbitrum'
  | 'base'
  | 'optimism'
  | 'polygon'
  | 'avalanche';

export interface ChainConfig {
  key: ChainKey;
  chainId: number;
  name: string;
  rpcUrl: string;
  usdc: Address;
  tokenMessengerV2: Address;
  messageTransmitterV2: Address;
  cctpDomain: number;
  explorer: string;
}

export interface Route {
  source: ChainKey;
  destination: ChainKey;
  asset: 'USDC';
  rails: Rail[];
}

export interface Quote {
  rail: Rail;
  source: ChainKey;
  destination: ChainKey;
  asset: 'USDC';
  amountIn: string;
  amountOut: string;
  maxFee: string;
  estimatedSeconds: number;
  minFinalityThreshold: number;
  expiresAt: string;
}

export interface PreparedTransfer {
  rail: Rail;
  source: ChainKey;
  destination: ChainKey;
  to: Address;
  data: Hex;
  value: string;
  chainId: number;
  approval?: {
    to: Address;
    data: Hex;
    value: string;
  };
  expectedBurnTxHashFormat: string;
  trackingId: string;
}

export type TransferStage = 'pending' | 'attested' | 'completed' | 'failed';

export interface TransferStatus {
  trackingId: string;
  stage: TransferStage;
  source: ChainKey;
  destination: ChainKey;
  burnTxHash?: Hex;
  attestation?: Hex;
  mintTxHash?: Hex;
  updatedAt: string;
}
