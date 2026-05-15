/**
 * Executes the first real testnet CCTP V2 transfer from the Privy server wallet:
 * 5 USDC, Arbitrum Sepolia -> Base Sepolia.
 *
 * Run with: npx tsx scripts/execute-transfer.ts
 *
 * The PreparedTransfer below is the verbatim output of a prior `prepare_transfer`
 * call. The signer module accepts any `prepare_transfer` output, so this script
 * is just a hardcoded driver for the acceptance test.
 */
import { executePreparedTransfer } from '@/lib/signers/privy';
import { getChainById } from '@/lib/chains';
import type { PreparedTransfer } from '@/lib/types';

try {
  process.loadEnvFile();
} catch {
  // No .env file — fall back to the ambient process environment.
}

const prepared: PreparedTransfer = {
  rail: 'cctp-v2',
  source: 'arbitrum',
  destination: 'base',
  to: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA',
  data: '0x8e0250ee00000000000000000000000000000000000000000000000000000000004c4b40000000000000000000000000000000000000000000000000000000000000000600000000000000000000000046aD5e560e843cF5Ffb22c8423048142547D821000000000000000000000000075faf114eafb1bdbe2f0316df893fd58ce46aa4d0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000007d0',
  value: '0',
  chainId: 421614,
  approval: {
    to: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    data: '0x095ea7b30000000000000000000000008fe6b999dc680ccfdd5bf7eb0974218be2542daa00000000000000000000000000000000000000000000000000000000004c4b40',
    value: '0',
  },
  expectedBurnTxHashFormat: '0x[64 hex chars]',
  trackingId: 'fmb_c023a27f17bab37ec9756542',
};

// mintRecipient encoded in the depositForBurn calldata — the server wallet itself.
const MINT_RECIPIENT = '0x46aD5e560e843cF5Ffb22c8423048142547D8210';

async function main(): Promise<void> {
  const srcExplorer = getChainById(prepared.chainId).explorer;
  const dstExplorer = getChainById(84532).explorer;

  console.log('Executing CCTP V2 transfer from the Privy server wallet');
  console.log(`  ${prepared.source} -> ${prepared.destination}  (tracking ${prepared.trackingId})`);
  console.log('  Signing approve, waiting 1 confirmation, then depositForBurn...\n');

  const result = await executePreparedTransfer(prepared);

  if (result.approval) {
    console.log('approve USDC:');
    console.log(`  ${srcExplorer}/tx/${result.approval.txHash}`);
  }
  console.log('depositForBurn:');
  console.log(`  ${srcExplorer}/tx/${result.burn.txHash}`);
  console.log(`\nburnTxHash: ${result.burn.txHash}`);

  console.log('\nThis transfer uses STANDARD finality (minFinalityThreshold 2000):');
  console.log('the Circle attestation + mint on Base Sepolia take ~15 min, not seconds.');
  console.log(`Watch for the mint at: ${dstExplorer}/address/${MINT_RECIPIENT}`);

  console.log('\nNext, call track_transfer:');
  console.log(
    `  track_transfer({ trackingId: "${prepared.trackingId}", ` +
      `source: "${prepared.source}", destination: "${prepared.destination}", ` +
      `burnTxHash: "${result.burn.txHash}" })`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
