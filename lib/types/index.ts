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
  /**
   * Structured handoff to the next MCP tool. After the burn confirms on the
   * source chain, the agent calls `prepare_mint` with the burn tx hash to build
   * the unsigned `receiveMessage` tx for the destination.
   */
  nextStep?: {
    tool: 'prepare_mint';
    description: string;
    requires: { burnTxHash: string };
  };
}

export type PreparedMint =
  | {
      rail: Rail;
      source: ChainKey;
      destination: ChainKey;
      burnTxHash: Hex;
      status: 'pending';
      irisStatus: string;
      delayReason?: string | null;
    }
  | {
      rail: Rail;
      source: ChainKey;
      destination: ChainKey;
      burnTxHash: Hex;
      status: 'ready';
      to: Address;
      data: Hex;
      value: string;
      chainId: number;
      nonce: Hex;
    };

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
