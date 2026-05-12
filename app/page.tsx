const CLAUDE_DESKTOP_CONFIG = `{
  "mcpServers": {
    "fmb-agents": {
      "url": "https://agents.findmybridge.com/mcp"
    }
  }
}`;

const TOOLS = [
  {
    name: 'get_supported_routes',
    description: 'List USDC routes available across CCTP V2 today.',
  },
  {
    name: 'quote_transfer',
    description: 'Live quote with fee, finality threshold, and expected duration.',
  },
  {
    name: 'prepare_transfer',
    description: 'Returns the unsigned approve + depositForBurn calldata. Non-custodial — you sign.',
  },
  {
    name: 'track_transfer',
    description: 'Track a transfer through pending → attested → completed.',
  },
];

const VALUE_PROPS = [
  {
    title: 'Stablecoin-specialized',
    body: 'Stablecoins are 80%+ of cross-chain volume. We optimize for them — not the generalist bridge graph.',
  },
  {
    title: 'Multi-rail routing',
    body: 'CCTP V2 today, then deBridge, LayerZero, Across, Mayan. The MCP picks the right rail per transfer.',
  },
  {
    title: 'Bridge-health backed',
    body: 'Quotes are informed by Find My Bridge’s live monitoring of every major bridge in production.',
  },
];

export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 sm:py-24 text-neutral-200 bg-black min-h-screen">
      <header className="mb-16">
        <p className="text-xs tracking-widest uppercase text-neutral-500 mb-3">
          A Find My Bridge product
        </p>
        <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-white">
          FMB Agents
        </h1>
        <p className="mt-4 text-lg text-neutral-400 max-w-2xl">
          A Model Context Protocol server that lets AI agents move stablecoins across chains
          with optimal routing. Non-custodial. Designed for Claude, ChatGPT, Cursor, AgentCore,
          n8n, and Make.
        </p>
      </header>

      <section className="mb-16">
        <h2 className="text-sm font-semibold tracking-widest uppercase text-neutral-500 mb-4">
          60-second quickstart
        </h2>
        <p className="text-neutral-400 mb-3">
          Add this to <code className="font-mono text-neutral-300">claude_desktop_config.json</code> and
          restart Claude Desktop:
        </p>
        <pre className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-4 text-sm font-mono text-neutral-200 overflow-x-auto">
{CLAUDE_DESKTOP_CONFIG}
        </pre>
        <p className="text-neutral-400 mt-3">
          Then ask Claude:{' '}
          <em className="text-neutral-200">
            &ldquo;Quote moving 100 USDC from Arbitrum to Base.&rdquo;
          </em>
        </p>
      </section>

      <section className="mb-16 grid sm:grid-cols-3 gap-6">
        {VALUE_PROPS.map((v) => (
          <div key={v.title} className="border border-neutral-800 rounded-lg p-5">
            <h3 className="font-medium text-white mb-2">{v.title}</h3>
            <p className="text-sm text-neutral-400">{v.body}</p>
          </div>
        ))}
      </section>

      <section className="mb-16">
        <h2 className="text-sm font-semibold tracking-widest uppercase text-neutral-500 mb-4">
          Tools (Phase 1)
        </h2>
        <ul className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg">
          {TOOLS.map((t) => (
            <li key={t.name} className="p-4">
              <code className="font-mono text-white text-sm">{t.name}</code>
              <p className="text-sm text-neutral-400 mt-1">{t.description}</p>
            </li>
          ))}
        </ul>
        <p className="text-xs text-neutral-500 mt-3">
          Phase 1: USDC, CCTP V2, EVM-to-EVM across Ethereum, Arbitrum, Base, Optimism, Polygon,
          and Avalanche.
        </p>
      </section>

      <footer className="mt-24 pt-8 border-t border-neutral-800 flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-500">
        <a
          className="hover:text-neutral-300"
          href="https://findmybridge.com"
          target="_blank"
          rel="noreferrer"
        >
          findmybridge.com
        </a>
        <a
          className="hover:text-neutral-300"
          href="https://github.com/findmybridge/fmb-agents"
          target="_blank"
          rel="noreferrer"
        >
          GitHub
        </a>
        <a
          className="hover:text-neutral-300"
          href="https://modelcontextprotocol.io"
          target="_blank"
          rel="noreferrer"
        >
          MCP spec
        </a>
        <span className="ml-auto">Non-custodial. Server never holds keys.</span>
      </footer>
    </main>
  );
}
