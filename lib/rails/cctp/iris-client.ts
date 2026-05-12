import type { Network } from '@/lib/types';

const IRIS_URLS: Record<Network, string> = {
  mainnet: 'https://iris-api.circle.com',
  testnet: 'https://iris-api-sandbox.circle.com',
};

export interface IrisFee {
  finalityThreshold: number;
  minimumFee: number;
}

export interface IrisMessage {
  message: string;
  eventNonce: string;
  attestation: string;
  status?: string;
  decodedMessage?: unknown;
}

export interface IrisMessagesResponse {
  messages: IrisMessage[];
}

function baseUrl(network: Network): string {
  return process.env.IRIS_BASE_URL?.trim() || IRIS_URLS[network];
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Iris ${res.status} ${res.statusText} for ${url}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function getFees(
  sourceDomain: number,
  destinationDomain: number,
  network: Network,
): Promise<IrisFee[]> {
  const url = `${baseUrl(network)}/v2/burn/USDC/fees/${sourceDomain}/${destinationDomain}`;
  return getJson<IrisFee[]>(url);
}

export async function getMessagesByTx(
  sourceDomain: number,
  transactionHash: string,
  network: Network,
): Promise<IrisMessagesResponse> {
  const url = `${baseUrl(network)}/v2/messages/${sourceDomain}?transactionHash=${transactionHash}`;
  return getJson<IrisMessagesResponse>(url);
}
