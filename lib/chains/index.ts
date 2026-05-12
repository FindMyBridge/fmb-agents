import type { ChainConfig, ChainKey, Network } from '@/lib/types';
import { mainnetChains } from './mainnet';
import { testnetChains } from './testnet';

export function currentNetwork(): Network {
  return process.env.NETWORK === 'mainnet' ? 'mainnet' : 'testnet';
}

export function getChains(network: Network = currentNetwork()): ChainConfig[] {
  return network === 'mainnet' ? mainnetChains : testnetChains;
}

export function getChain(key: ChainKey, network: Network = currentNetwork()): ChainConfig {
  const chain = getChains(network).find((c) => c.key === key);
  if (!chain) throw new Error(`Unknown chain "${key}" on ${network}`);
  return chain;
}

export function chainByDomain(domain: number, network: Network = currentNetwork()): ChainConfig {
  const chain = getChains(network).find((c) => c.cctpDomain === domain);
  if (!chain) throw new Error(`No chain with CCTP domain ${domain} on ${network}`);
  return chain;
}
