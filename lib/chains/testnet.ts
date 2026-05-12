import type { ChainConfig } from '@/lib/types';

const TOKEN_MESSENGER_V2 = '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA';
const MESSAGE_TRANSMITTER_V2 = '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275';

const env = (key: string, fallback: string): string =>
  (process.env[key]?.trim() || fallback);

export const testnetChains: ChainConfig[] = [
  {
    key: 'ethereum',
    chainId: 11155111,
    name: 'Ethereum Sepolia',
    rpcUrl: env('RPC_ETHEREUM_TESTNET', 'https://ethereum-sepolia.publicnode.com'),
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    tokenMessengerV2: TOKEN_MESSENGER_V2,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2,
    cctpDomain: 0,
    explorer: 'https://sepolia.etherscan.io',
  },
  {
    key: 'avalanche',
    chainId: 43113,
    name: 'Avalanche Fuji',
    rpcUrl: env('RPC_AVALANCHE_TESTNET', 'https://api.avax-test.network/ext/bc/C/rpc'),
    usdc: '0x5425890298aed601595a70AB815c96711a31Bc65',
    tokenMessengerV2: TOKEN_MESSENGER_V2,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2,
    cctpDomain: 1,
    explorer: 'https://testnet.snowtrace.io',
  },
  {
    key: 'optimism',
    chainId: 11155420,
    name: 'OP Sepolia',
    rpcUrl: env('RPC_OPTIMISM_TESTNET', 'https://sepolia.optimism.io'),
    usdc: '0x5fd84259d66Cd46123540766Be93DFE6D43130D7',
    tokenMessengerV2: TOKEN_MESSENGER_V2,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2,
    cctpDomain: 2,
    explorer: 'https://sepolia-optimism.etherscan.io',
  },
  {
    key: 'arbitrum',
    chainId: 421614,
    name: 'Arbitrum Sepolia',
    rpcUrl: env('RPC_ARBITRUM_TESTNET', 'https://sepolia-rollup.arbitrum.io/rpc'),
    usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    tokenMessengerV2: TOKEN_MESSENGER_V2,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2,
    cctpDomain: 3,
    explorer: 'https://sepolia.arbiscan.io',
  },
  {
    key: 'base',
    chainId: 84532,
    name: 'Base Sepolia',
    rpcUrl: env('RPC_BASE_TESTNET', 'https://sepolia.base.org'),
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    tokenMessengerV2: TOKEN_MESSENGER_V2,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2,
    cctpDomain: 6,
    explorer: 'https://sepolia.basescan.org',
  },
  {
    key: 'polygon',
    chainId: 80002,
    name: 'Polygon Amoy',
    rpcUrl: env('RPC_POLYGON_TESTNET', 'https://rpc-amoy.polygon.technology'),
    usdc: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
    tokenMessengerV2: TOKEN_MESSENGER_V2,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2,
    cctpDomain: 7,
    explorer: 'https://amoy.polygonscan.com',
  },
];
