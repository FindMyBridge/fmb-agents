/**
 * Creates a Privy policy and attaches it to the server wallet.
 *
 * Run with: npx tsx scripts/setup-policy.ts
 *
 * The policy is the autonomous wallet's guardrail. Its core, reliable rule is a
 * contract allowlist: the wallet may only call the CCTP TokenMessengerV2,
 * MessageTransmitterV2 and USDC contracts of supported testnets. Every other
 * call is denied by default. MessageTransmitterV2 must be allowlisted or the
 * `receiveMessage` mint step (scripts/complete-transfer.ts) gets denied.
 *
 * Per-amount spend caps require decoding calldata (ethereum_calldata + ABI) and
 * are intentionally left out of this script — see docs/agent-wallet.md for the
 * approach. Run this AFTER execute-transfer.ts has confirmed the signer works.
 */
import { getPrivyClient } from '@/lib/signers/privy';
import { testnetChains } from '@/lib/chains/testnet';

try {
  process.loadEnvFile();
} catch {
  // No .env file — fall back to the ambient process environment.
}

async function main(): Promise<void> {
  const privy = getPrivyClient();
  const walletId = process.env.PRIVY_WALLET_ID?.trim();
  if (!walletId) throw new Error('Missing required environment variable: PRIVY_WALLET_ID');

  // Allowlist every supported testnet's TokenMessengerV2 (burn),
  // MessageTransmitterV2 (mint via receiveMessage) and USDC (approve). Both
  // checksummed and lowercased forms are included so the match is robust to how
  // Privy normalizes the transaction `to` field.
  const allowlist = Array.from(
    new Set(
      testnetChains.flatMap((c) => [
        c.tokenMessengerV2,
        c.tokenMessengerV2.toLowerCase(),
        c.messageTransmitterV2,
        c.messageTransmitterV2.toLowerCase(),
        c.usdc,
        c.usdc.toLowerCase(),
      ]),
    ),
  );

  const uniqueAddrs = Array.from(
  new Set(
    testnetChains.flatMap((c) => [
      c.tokenMessengerV2,
      c.messageTransmitterV2,
      c.usdc,
    ]),
  ),
);
  const policy = await privy.policies().create({
    chain_type: 'ethereum',
    name: 'fmb-agents testnet — CCTP contract allowlist',
    version: '1.0',
    rules: uniqueAddrs.map((addr) => ({
      name: `Allow ${addr.slice(0, 10)}…`,
      method: 'eth_sendTransaction',
      action: 'ALLOW',
      conditions: [
        {
          field_source: 'ethereum_transaction',
          field: 'to',
          operator: 'eq',
          value: addr,
        },
      ],
    })),
  });

  console.log(`Created policy: ${policy.id}`);
  console.log(`  ${uniqueAddrs.length} ALLOW rules (one per address):`);
  for (const addr of uniqueAddrs) console.log(`    ${addr}`);

  await privy.wallets().update(walletId, { policy_ids: [policy.id] });
  console.log(`\nAttached policy ${policy.id} to wallet ${walletId}`);
  console.log(
    'The wallet can now only call CCTP TokenMessengerV2 / MessageTransmitterV2 / USDC contracts.',
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
