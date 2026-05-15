# Agent Wallet

## What this is

FMB Agents gives the AI agent its **own autonomous wallet** so it can sign and
broadcast the transactions that `prepare_transfer` produces — without a human
signing each one. This is "Pattern A — autonomous agent wallet" and is the
default use case for FMB Agents.

The wallet is a **Privy Server Wallet** (an "App Wallet" under the project's
Wallets section): programmatic, no seed phrase, governed by a policy engine.

### The MCP server stays non-custodial

The signer is a **separate concern** from the MCP tools. `prepare_transfer`
still builds unsigned transactions and the MCP server never holds keys. The
signer ([lib/signers/privy.ts](../lib/signers/privy.ts)) is a standalone module
that *consumes* `prepare_transfer` output. Nothing in `lib/mcp/` imports it.

## Setup

Add to `.env` (see [.env.example](../.env.example)):

```
PRIVY_APP_ID=...
PRIVY_APP_SECRET=...
PRIVY_WALLET_ID=...
```

`.env` is gitignored — never commit real secrets. RPC endpoints reuse the
existing `RPC_<CHAIN>_TESTNET` variables from `lib/chains/testnet.ts`.

SDK: [`@privy-io/node`](https://docs.privy.io/basics/nodeJS/setup) (the current
server SDK). The client is constructed from env in `getPrivyClient()`.

## The signer module

`executePreparedTransfer(prepared)` in [lib/signers/privy.ts](../lib/signers/privy.ts)
accepts any `PreparedTransfer` (the `prepare_transfer` output shape) and:

1. Resolves the source chain from `prepared.chainId` via `getChainById()`.
2. If `prepared.approval` exists, estimates gas with viem, sends the approve via
   `privy.wallets().ethereum().sendTransaction(...)`, and waits for **1
   confirmation**.
3. Sends the main `depositForBurn` transaction the same way.
4. Returns `{ approval?, burn }` with tx hashes and receipts.

It also exposes `executePreparedMint(prepared)`, which signs and broadcasts the
unsigned `receiveMessage` transaction returned by the MCP `prepare_mint` tool —
the destination-leg counterpart of `executePreparedTransfer`.

Both entry points share an internal `signAndSend` helper: estimate gas, send via
Privy, wait for one confirmation. Gas is estimated with a viem `publicClient`
(EIP-1559, type-2 transactions) and paid from the **wallet's own ETH balance** —
no gas sponsorship. Privy does not wait for confirmations, so viem's
`waitForTransactionReceipt` bridges the gap between consecutive transactions.

## Running the acceptance test

```
npx tsx scripts/execute-transfer.ts
```

This signs and broadcasts the first real testnet transfer (5 USDC, Arbitrum
Sepolia → Base Sepolia) from the server wallet, prints both explorer links and
the `burnTxHash`, and prints the exact `track_transfer` call to run next.

**Timing:** this transfer uses **STANDARD** finality (`minFinalityThreshold
2000`), so the Circle attestation and the mint on Base Sepolia take **~15
minutes** — not seconds. Don't be alarmed if the destination balance doesn't
update immediately.

## Completing the transfer (the mint)

CCTP V2 has three steps: (1) `depositForBurn` on the source, (2) Circle attests
the burn, (3) someone calls `receiveMessage` on the destination's
`MessageTransmitterV2`, which mints the USDC. `execute-transfer.ts` only does
step 1 — the burn. **Nothing mints automatically**; step 3 must be submitted.

```
npx tsx scripts/complete-transfer.ts [burnTxHash] [source] [destination]
```

With no arguments it defaults to the first stuck transfer. The script dogfoods
the public MCP flow: it calls `prepareMint(...)` (the shared logic behind the
`prepare_mint` MCP tool) which fetches the attestation from Circle's Iris API
([lib/rails/cctp/iris-client.ts](../lib/rails/cctp/iris-client.ts)). If the
result is `status: "pending"` it prints the Iris status and exits cleanly. If
`status: "ready"`, it hands the unsigned tx to `executePreparedMint(...)` to
sign and broadcast `receiveMessage` from the server wallet.

`receiveMessage` is **permissionless** (anyone can submit it), but the
transaction still needs **gas on the destination chain**. The server wallet was
funded with ETH on Arbitrum Sepolia; it must also hold ETH on Base Sepolia (or
any destination) for this step to succeed.

## The policy

```
npx tsx scripts/setup-policy.ts
```

`scripts/setup-policy.ts` creates a Privy policy and attaches it to the wallet
(`policy_ids` — Privy allows one policy per wallet). The policy has two rules:

1. **Allow** `eth_sendTransaction` when the transaction `to` is in an allowlist
   of every supported testnet's `TokenMessengerV2` (burn), `MessageTransmitterV2`
   (mint via `receiveMessage`) and `USDC` (approve) contract — addresses from
   [lib/chains/testnet.ts](../lib/chains/testnet.ts), included in both
   checksummed and lowercased form.
2. **Deny** everything else (`method: '*'`, no conditions).

Privy's policy engine denies by default when no rule matches, so the allowlist
is the real guardrail: the autonomous wallet can *only* touch CCTP contracts.
**`MessageTransmitterV2` must be in the allowlist** — without it the
`receiveMessage` mint step is denied and transfers can never complete.

**Run order:** run `execute-transfer.ts` first (wallet without a restrictive
policy) to confirm the signer works end-to-end, *then* `setup-policy.ts`. That
isolates a signer bug from a malformed-policy bug.

To update the policy, edit the rules in `setup-policy.ts` and either re-run it
(creating a new policy) or use `privy.policies().update(policyId, { rules })`.

### Per-transaction spend cap (not yet wired up)

A USDC amount cap is intentionally **not** in `setup-policy.ts`. The transaction
`value` field is native ETH (always `0` here), so capping the USDC amount
requires decoding the calldata. Privy supports this with an `ethereum_calldata`
condition that carries the contract ABI:

```ts
{
  field_source: 'ethereum_calldata',
  field: 'amount',           // the decoded depositForBurn / approve param
  operator: 'lte',
  value: '50000000',         // 50 USDC, 6 decimals
  abi: [ /* tokenMessengerV2Abi + erc20Abi */ ],
}
```

Add it as a second condition on the ALLOW rule once the field path and ABI
format are verified against a live policy. Until then, the contract allowlist +
default-deny is the guardrail.

## Full MCP cycle (5 tools)

The MCP surface now covers the whole CCTP V2 cycle. An agent never signs
anything via the MCP — it receives unsigned transactions and reads real status:

- `get_supported_routes`, `quote_transfer` — discovery.
- `prepare_transfer` — unsigned approve + depositForBurn on the source. Output
  carries a structured `nextStep` handoff to `prepare_mint`.
- `prepare_mint` — given a confirmed burn tx hash, returns
  `status: "pending"` (with Iris status / delay reason) while the attestation is
  still being produced, or `status: "ready"` with the unsigned
  `receiveMessage` tx `{ to, data, value, chainId, nonce }` once it lands.
- `track_transfer` — queries Iris + the destination's
  `MessageTransmitterV2.usedNonces[nonce]` to return real stages
  (`pending → attested → completed`). The destination tx hash is included on a
  best-effort basis via a log scan.

## Caveats

- **Testnet only.** No mainnet code paths are active.
- **Authorization signatures.** If the server wallet is configured with an owner
  or key quorum, `sendTransaction` / `policies().create` / `wallets().update`
  may require an authorization signature. The current setup assumes app-secret
  auth is sufficient (wallet owned by the app). If you hit an auth error,
  configure an authorization key and pass `authorization_context`.
- **Secrets.** The signer never logs secrets. Keep it that way.
