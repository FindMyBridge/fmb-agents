/**
 * Completes a CCTP V2 transfer by submitting `receiveMessage` on the destination
 * chain, which triggers the mint. This is the third and final CCTP step.
 *
 * Run with: npx tsx scripts/complete-transfer.ts [burnTxHash] [source] [destination]
 *
 * With no arguments it defaults to the first real testnet transfer
 * (5 USDC, Arbitrum Sepolia -> Base Sepolia) whose burn landed but never minted.
 *
 * Dogfoods the public MCP flow: builds the unsigned tx via `prepareMint`
 * (same logic the `prepare_mint` tool exposes) and signs it with
 * `executePreparedMint` from the Privy signer. The destination wallet must hold
 * gas (ETH) on the destination chain.
 */
import type { Hex } from 'viem';
import { currentNetwork, getChain, getChains } from '@/lib/chains';
import { prepareMint } from '@/lib/rails/cctp/prepare-mint';
import { executePreparedMint } from '@/lib/signers/privy';
import type { ChainKey } from '@/lib/types';

try {
  process.loadEnvFile();
} catch {
  // No .env file — fall back to the ambient process environment.
}

const DEFAULT_BURN_TX_HASH =
  '0xf7c2c5ae77517fb4b10545709e6907f0a25a30d0c8e1466001c27f8b3435c5c5';
const DEFAULT_SOURCE: ChainKey = 'arbitrum';
const DEFAULT_DESTINATION: ChainKey = 'base';

function parseChainKey(value: string): ChainKey {
  const chain = getChains().find((c) => c.key === value);
  if (!chain) throw new Error(`Unknown chain key: "${value}"`);
  return chain.key;
}

async function main(): Promise<void> {
  const [burnTxHashArg, sourceArg, destinationArg] = process.argv.slice(2);
  const burnTxHash = (burnTxHashArg ?? DEFAULT_BURN_TX_HASH) as Hex;
  const source = sourceArg ? parseChainKey(sourceArg) : DEFAULT_SOURCE;
  const destination = destinationArg ? parseChainKey(destinationArg) : DEFAULT_DESTINATION;

  const network = currentNetwork();
  const dstChain = getChain(destination, network);

  console.log('Completing CCTP V2 transfer (receiveMessage on destination)');
  console.log(`  ${source} -> ${destination}  (burn tx ${burnTxHash})`);
  console.log('  Fetching attestation from Circle Iris...\n');

  const prepared = await prepareMint({ source, destination, burnTxHash, network });

  if (prepared.status === 'pending') {
    console.log(`Attestation not ready yet — Iris status: "${prepared.irisStatus}".`);
    if (prepared.delayReason) console.log(`Delay reason: ${prepared.delayReason}`);
    console.log('Nothing is broken; the attestation is still being produced. Re-run later.');
    return;
  }

  console.log('Attestation is complete. Signing receiveMessage on the destination chain...\n');
  const result = await executePreparedMint(prepared);

  console.log('mint (receiveMessage):');
  console.log(`  ${dstChain.explorer}/tx/${result.txHash}`);
  console.log(`\nmintTxHash: ${result.txHash}`);
  console.log('\nTransfer complete. Confirm the USDC balance on the destination chain.');
  console.log('\nNext, call track_transfer:');
  console.log(
    `  track_transfer({ trackingId: "<trackingId>", ` +
      `source: "${source}", destination: "${destination}", ` +
      `burnTxHash: "${burnTxHash}" })`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
