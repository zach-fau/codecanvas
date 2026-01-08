---
name: circular-dependency-detector
description: Visual circular dependency detection and visualization for TypeScript/JavaScript monorepos
status: backlog
created: 2026-01-08T14:37:01Z
updated: 2026-01-08T14:37:01Z
---

# CodeCanvas: Circular Dependency Detector

## Problem Statement

Circular dependencies in TypeScript/JavaScript codebases cause:
- Build failures and bundler issues
- Subtle runtime bugs (undefined imports)
- Difficult-to-debug initialization order problems
- Technical debt that compounds over time

Existing tools either:
- Only detect (no visualization of HOW to fix)
- Require cloud/SaaS (code leaves your machine)
- Generate static diagrams (no interactivity)
- Are full architecture tools (overwhelming for this specific problem)

## Solution

A local-first CLI + web UI tool that:
1. Analyzes TS/JS codebases using tree-sitter
2. Detects circular dependency chains
3. Visualizes dependency graphs interactively
4. Suggests specific refactoring to break cycles

## Target Users

- Senior developers maintaining large TS/JS codebases
- Tech leads doing architecture reviews
- Teams migrating to monorepos (Nx, Turborepo, pnpm workspaces)

## Core Features

### MVP (3-4 weeks)

#### 1. CLI Analysis
```bash
codecanvas analyze .
codecanvas analyze ./src --output json
codecanvas analyze . --watch
```

- Parse all `.ts`, `.tsx`, `.js`, `.jsx` files
- Extract import/export relationships
- Detect circular dependency chains
- Output summary to terminal

#### 2. Interactive Web UI
- Force-directed graph of module dependencies
- Highlight circular dependency chains in red
- Click node to see its imports/exports
- Filter by directory/package
- Zoom/pan for large codebases

#### 3. Actionable Suggestions
For each circular dependency, show:
- The full cycle path (A → B → C → A)
- Which edge is easiest to break
- Suggested refactoring pattern (extract interface, dependency injection, etc.)

### Future Enhancements (Post-MVP)
- Watch mode with live updates
- VS Code extension
- CI integration (fail on new cycles)
- Package-level analysis for monorepos
- Export to SVG/PNG

## Technical Architecture

### Stack
- **Parsing**: tree-sitter with TypeScript/JavaScript grammars (WASM for browser)
- **Graph Engine**: Custom dependency graph with cycle detection (Tarjan's algorithm)
- **Visualization**: D3.js force-directed layout or Cytoscape.js
- **Frontend**: Next.js (static export, no server required)
- **CLI**: Node.js with Commander.js

### Key Technical Decisions

1. **Local-first**: All parsing happens locally. Code never leaves the machine.
2. **Incremental parsing**: Use file hashes to skip unchanged files.
3. **Streaming for large repos**: Process files in batches to handle 10k+ file repos.
4. **Browser-based tree-sitter**: WASM bindings for consistent parsing client-side.

### Data Flow
```
CLI invocation
    ↓
File discovery (glob patterns)
    ↓
Tree-sitter parsing (extract imports)
    ↓
Build dependency graph
    ↓
Cycle detection (Tarjan's SCC)
    ↓
Terminal summary + launch web UI
    ↓
Interactive exploration
```

## Success Metrics

1. **Performance**: Analyze 10,000 file repo in < 30 seconds
2. **Accuracy**: Zero false positives on cycle detection
3. **Usability**: First-time user finds cycles in < 2 minutes
4. **Portfolio value**: Demonstrable on real open-source projects

## Non-Goals

- Multi-language support (TS/JS only for MVP)
- Cloud features or SaaS
- Code review integration
- Git history analysis
- Semantic code search

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Tree-sitter parsing edge cases | Test against major OSS projects (React, Vue, Next.js) |
| Performance on huge repos | Implement streaming + caching early |
| Graph visualization performance | Use WebGL renderer (Cytoscape) for 1000+ nodes |
| Dynamic imports not detected | Document limitation, focus on static imports |

## Milestones

### Week 1: Foundation
- [ ] Project setup (Next.js, tree-sitter WASM)
- [ ] CLI scaffold with file discovery
- [ ] Basic import extraction from TS files

### Week 2: Graph Engine
- [ ] Dependency graph data structure
- [ ] Tarjan's algorithm for cycle detection
- [ ] JSON output format

### Week 3: Visualization
- [ ] D3/Cytoscape force-directed graph
- [ ] Cycle highlighting
- [ ] Node click interactions

### Week 4: Polish & Testing
- [ ] Test on real OSS projects
- [ ] Performance optimization
- [ ] CLI UX polish
- [ ] Documentation

## Portfolio Talking Points

After completing this project:
- "I parsed TypeScript ASTs with tree-sitter WASM"
- "I implemented Tarjan's algorithm for cycle detection in a real tool"
- "I visualized a 10,000+ file monorepo with interactive graph navigation"
- "I found and helped fix circular dependencies in [Next.js/other OSS project]"

## References

- [tree-sitter](https://tree-sitter.github.io/tree-sitter/)
- [Tarjan's SCC Algorithm](https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm)
- [D3 Force Layout](https://d3js.org/d3-force)
- [Cytoscape.js](https://js.cytoscape.org/)
