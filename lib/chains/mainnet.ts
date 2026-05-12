import type { ChainConfig } from '@/lib/types';

const TOKEN_MESSENGER_V2 = '0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d';
const MESSAGE_TRANSMITTER_V2 = '0x81D40F21F12A8F0E3252Bccb954D722d4c464B64';

const env = (key: string, fallback: string): string =>
  (process.env[key]?.trim() || fallback);

export const mainnetChains: ChainConfig[] = [
  {
    key: 'ethereum',
    chainId: 1,
    name: 'Ethereum',
    rpcUrl: env('RPC_ETHEREUM_MAINNET', 'https://eth.llamarpc.com'),
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    tokenMessengerV2: TOKEN_MESSENGER_V2,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2,
    cctpDomain: 0,
    explorer: 'https://etherscan.io',
  },
  {
    key: 'avalanche',
    chainId: 43114,
    name: 'Avalanche',
    rpcUrl: env('RPC_AVALANCHE_MAINNET', 'https://api.avax.network/ext/bc/C/rpc'),
    usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    tokenMessengerV2: TOKEN_MESSENGER_V2,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2,
    cctpDomain: 1,
    explorer: 'https://snowtrace.io',
  },
  {
    key: 'optimism',
    chainId: 10,
    name: 'OP Mainnet',
    rpcUrl: env('RPC_OPTIMISM_MAINNET', 'https://mainnet.optimism.io'),
    usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    tokenMessengerV2: TOKEN_MESSENGER_V2,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2,
    cctpDomain: 2,
    explorer: 'https://optimistic.etherscan.io',
  },
  {
    key: 'arbitrum',
    chainId: 42161,
    name: 'Arbitrum One',
    rpcUrl: env('RPC_ARBITRUM_MAINNET', 'https://arb1.arbitrum.io/rpc'),
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    tokenMessengerV2: TOKEN_MESSENGER_V2,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2,
    cctpDomain: 3,
    explorer: 'https://arbiscan.io',
  },
  {
    key: 'base',
    chainId: 8453,
    name: 'Base',
    rpcUrl: env('RPC_BASE_MAINNET', 'https://mainnet.base.org'),
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    tokenMessengerV2: TOKEN_MESSENGER_V2,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2,
    cctpDomain: 6,
    explorer: 'https://basescan.org',
  },
  {
    key: 'polygon',
    chainId: 137,
    name: 'Polygon',
    rpcUrl: env('RPC_POLYGON_MAINNET', 'https://polygon-rpc.com'),
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    tokenMessengerV2: TOKEN_MESSENGER_V2,
    messageTransmitterV2: MESSAGE_TRANSMITTER_V2,
    cctpDomain: 7,
    explorer: 'https://polygonscan.com',
  },
];
