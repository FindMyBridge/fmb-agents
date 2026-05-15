import { PrivyClient } from '@privy-io/node';
import {
  createPublicClient,
  http,
  numberToHex,
  type Address,
  type Hex,
  type TransactionReceipt,
} from 'viem';
import { getChainById } from '@/lib/chains';
import type { PreparedMint, PreparedTransfer } from '@/lib/types';

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

let cachedClient: PrivyClient | null = null;

export function getPrivyClient(): PrivyClient {
  if (!cachedClient) {
    cachedClient = new PrivyClient({
      appId: requireEnv('PRIVY_APP_ID'),
      appSecret: requireEnv('PRIVY_APP_SECRET'),
    });
  }
  return cachedClient;
}

let cachedWalletAddress: Address | null = null;

async function getWalletAddress(): Promise<Address> {
  if (!cachedWalletAddress) {
    const wallet = await getPrivyClient().wallets().get(requireEnv('PRIVY_WALLET_ID'));
    cachedWalletAddress = wallet.address as Address;
  }
  return cachedWalletAddress;
}

interface UnsignedTx {
  chainId: number;
  to: Address;
  data: Hex;
  value: string;
}

export interface SignedTxResult {
  txHash: Hex;
  receipt: TransactionReceipt;
}

export interface ExecuteTransferResult {
  approval?: SignedTxResult;
  burn: SignedTxResult;
}

// 20% headroom over the estimate — CCTP calldata can underestimate slightly.
const GAS_LIMIT_BUFFER_NUM = 12n;
const GAS_LIMIT_BUFFER_DEN = 10n;

/**
 * Estimates gas, signs and broadcasts a single transaction from the Privy server
 * wallet, then waits for one confirmation. Gas is estimated via viem and paid
 * from the wallet's own balance — no gas sponsorship. Reused by every signer
 * entry point so the send/confirm logic stays in one place.
 */
async function signAndSend(tx: UnsignedTx): Promise<SignedTxResult> {
  const privy = getPrivyClient();
  const walletId = requireEnv('PRIVY_WALLET_ID');
  const walletAddress = await getWalletAddress();

  const chain = getChainById(tx.chainId);
  const publicClient = createPublicClient({ transport: http(chain.rpcUrl) });

  const value = BigInt(tx.value);
  const gasEstimate = await publicClient.estimateGas({
    account: walletAddress,
    to: tx.to,
    data: tx.data,
    value,
  });
  const fees = await publicClient.estimateFeesPerGas();

  const response = await privy
    .wallets()
    .ethereum()
    .sendTransaction(walletId, {
      caip2: `eip155:${tx.chainId}`,
      params: {
        transaction: {
          to: tx.to,
          data: tx.data,
          value: numberToHex(value),
          chain_id: tx.chainId,
          type: 2,
          gas_limit: numberToHex((gasEstimate * GAS_LIMIT_BUFFER_NUM) / GAS_LIMIT_BUFFER_DEN),
          max_fee_per_gas: numberToHex(fees.maxFeePerGas),
          max_priority_fee_per_gas: numberToHex(fees.maxPriorityFeePerGas),
        },
      },
    });

  const txHash = response.hash as Hex;
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    confirmations: 1,
  });
  if (receipt.status !== 'success') {
    throw new Error(`Transaction ${txHash} reverted on chain ${tx.chainId}`);
  }
  return { txHash, receipt };
}

/**
 * Signs and broadcasts the transactions of a `prepare_transfer` output from the
 * Privy server wallet. Sends the `approval` first (waiting one confirmation)
 * before the main burn transaction.
 */
export async function executePreparedTransfer(
  prepared: PreparedTransfer,
): Promise<ExecuteTransferResult> {
  const { chainId } = prepared;

  const approval = prepared.approval
    ? await signAndSend({
        chainId,
        to: prepared.approval.to,
        data: prepared.approval.data,
        value: prepared.approval.value,
      })
    : undefined;

  const burn = await signAndSend({
    chainId,
    to: prepared.to,
    data: prepared.data,
    value: prepared.value,
  });

  return { approval, burn };
}

/**
 * Signs and broadcasts the `receiveMessage` transaction returned by the MCP
 * `prepare_mint` tool, which completes a CCTP V2 transfer on the destination
 * chain. Mirrors `executePreparedTransfer`: takes an unsigned tx and signs it.
 */
export async function executePreparedMint(
  prepared: Extract<PreparedMint, { status: 'ready' }>,
): Promise<SignedTxResult> {
  return signAndSend({
    chainId: prepared.chainId,
    to: prepared.to,
    data: prepared.data,
    value: prepared.value,
  });
}
