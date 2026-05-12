# FMB Agents

**Stablecoin cross-chain MCP for AI agents.** Built by [Find My Bridge](https://findmybridge.com).

FMB Agents is a [Model Context Protocol](https://modelcontextprotocol.io) server that lets AI agents — Claude, ChatGPT, Cursor, AWS AgentCore, n8n, Make — move stablecoins across chains with optimal routing. **Non-custodial**: the server never holds keys. It returns prepared transactions for the caller to sign.

## Why FMB Agents

- **Stablecoin-specialized.** Stablecoins are 80%+ of cross-chain volume. We optimize for them, not the generalist bridge graph.
- **Multi-rail routing.** CCTP V2 in Phase 1; deBridge, LayerZero, Across, and Mayan follow. The MCP picks the right rail per transfer.
- **Bridge-health backed.** Quotes informed by Find My Bridge's live monitoring of every major bridge in production.

## 60-second quickstart

Add to your `claude_desktop_config.json` and restart Claude Desktop:

```json
{
  "mcpServers": {
    "fmb-agents": {
      "url": "https://agents.findmybridge.com/mcp"
    }
  }
}
```

Then ask:

> *"Quote moving 100 USDC from Arbitrum to Base, and prepare the transaction."*

## Tools (Phase 1)

| Tool | What it does |
| --- | --- |
| `get_supported_routes` | List USDC routes available across CCTP V2 today. |
| `quote_transfer` | Live fee quote with finality threshold and ETA. Hits Circle Iris in real time. |
| `prepare_transfer` | Returns unsigned approve + `depositForBurn` calldata. Non-custodial. |
| `track_transfer` | Track a transfer through `pending` → `attested` → `completed`. |

Phase 1 supports **USDC** over **CCTP V2** between Ethereum, Arbitrum, Base, Optimism, Polygon, and Avalanche (and the matching testnets).

## Run locally

```bash
npm install
cp .env.example .env.local   # NETWORK=testnet by default
npm run dev
```

The MCP endpoint is at [http://localhost:3000/mcp](http://localhost:3000/mcp). `GET /mcp` returns a capabilities probe; `POST /mcp` speaks MCP Streamable HTTP.

Run the integration test (hits Circle Iris sandbox):

```bash
npm test
```

## Architecture

- **Next.js 16** on Vercel. Landing page is a Server Component (Node runtime). The MCP endpoint runs on the **Edge runtime** for low latency.
- **MCP Streamable HTTP transport** from the official `@modelcontextprotocol/sdk`. Stateless, one transport per request.
- **`viem`** for EVM calldata encoding. **`zod`** for tool input schemas.
- **No custody.** The server only constructs unsigned transactions; signing happens in the caller's wallet.

## Roadmap

- **Phase 2:** `estimate_fees`, `get_balance`, `consolidate_balances`, `route_with_hook`. Multi-rail (deBridge, LayerZero, Across, Mayan).
- **Phase 3:** Solana and Tron.

## Links

- [Find My Bridge](https://findmybridge.com)
- [Source on GitHub](https://github.com/findmybridge/fmb-agents)
- [MCP specification](https://modelcontextprotocol.io)
- [Circle CCTP docs](https://developers.circle.com/cctp)

---

MIT licensed.
