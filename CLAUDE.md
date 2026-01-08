# CodeCanvas

Visual circular dependency detection and visualization for TypeScript/JavaScript monorepos.

## What This Is

A local-first CLI + web tool that:
1. Analyzes TS/JS codebases using tree-sitter
2. Detects circular dependency chains
3. Visualizes dependency graphs interactively
4. Suggests refactoring to break cycles

## Project Structure

```
codecanvas/
├── packages/
│   ├── cli/           # Node.js CLI tool
│   ├── core/          # Parsing & graph logic (shared)
│   └── web/           # Next.js visualization UI
├── .claude/
│   └── prds/          # Product requirements
└── docs/              # User documentation
```

## Commands

```bash
# Development
pnpm install           # Install dependencies
pnpm dev               # Run in development mode
pnpm build             # Build all packages
pnpm test              # Run tests

# CLI usage
pnpm cli analyze .     # Analyze current directory
```

## Technical Stack

- **Parsing**: tree-sitter (TypeScript/JavaScript grammars)
- **Graph**: Custom dependency graph with Tarjan's SCC
- **Visualization**: D3.js or Cytoscape.js
- **Frontend**: Next.js (static export)
- **CLI**: Node.js + Commander.js
- **Monorepo**: pnpm workspaces

## Key Decisions

1. **Local-first**: Code never leaves the machine
2. **TS/JS only**: No multi-language complexity for MVP
3. **Static imports only**: Dynamic imports documented as limitation
4. **Browser tree-sitter**: WASM bindings for consistent parsing

## GitHub Issues

Check `gh issue list` for current tasks.
