# CodeCanvas

[![npm version](https://img.shields.io/npm/v/@codecanvas/cli.svg)](https://www.npmjs.com/package/@codecanvas/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/github/actions/workflow/status/username/codecanvas/ci.yml?branch=main)](https://github.com/username/codecanvas/actions)

Visual circular dependency detection and visualization for TypeScript/JavaScript monorepos.

CodeCanvas helps you identify, understand, and fix circular dependencies in your codebase through accurate static analysis and interactive visualization.

## Features

- **Tree-sitter based parsing** - Accurate AST analysis using tree-sitter for TypeScript and JavaScript files
- **Circular dependency detection** - Uses Tarjan's strongly connected components algorithm for efficient cycle detection
- **Interactive web visualization** - Explore your dependency graph with Cytoscape.js-powered visualization
- **Actionable suggestions** - Get concrete recommendations for breaking cycles (extract interfaces, dependency injection, lazy imports)
- **CLI with progress indicators** - Beautiful terminal output with real-time progress bars
- **JSON output for CI/CD** - Machine-readable output for automated pipelines
- **Local-first** - Your code never leaves your machine

## Installation

```bash
# Using npm
npm install -g @codecanvas/cli

# Using pnpm
pnpm add -g @codecanvas/cli

# Using yarn
yarn global add @codecanvas/cli
```

## Quick Start

```bash
# Analyze current directory
codecanvas analyze .

# Analyze a specific project
codecanvas analyze ./my-project

# Output as JSON for scripting
codecanvas analyze . --output json

# Ignore test files
codecanvas analyze . --ignore "*.test.ts" --ignore "*.spec.ts"

# Ignore multiple patterns
codecanvas analyze . --ignore "**/__tests__/**" --ignore "**/*.mock.ts"
```

## CLI Commands

### `codecanvas analyze <path>`

Analyze a directory for circular dependencies.

**Arguments:**

| Argument | Description |
|----------|-------------|
| `<path>` | Path to the directory to analyze |

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `-o, --output <format>` | Output format (`text` or `json`) | `text` |
| `-i, --ignore <patterns...>` | Glob patterns to ignore (in addition to defaults) | - |

**Default ignored directories:** `node_modules`, `dist`, `build`, `.git`, `coverage`, `.next`, `.nuxt`

**Supported file extensions:** `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.mts`, `.cts`

**Examples:**

```bash
# Basic analysis with colored output
codecanvas analyze ./src

# JSON output for CI/CD pipelines
codecanvas analyze . --output json > analysis.json

# Ignore test and mock files
codecanvas analyze . \
  --ignore "**/*.test.ts" \
  --ignore "**/*.spec.ts" \
  --ignore "**/__mocks__/**"
```

## Web Visualization

CodeCanvas includes an interactive web UI for exploring your dependency graph.

### Running the Web UI

```bash
# From the project root
cd packages/web
pnpm dev

# Open http://localhost:3000 in your browser
```

### Visualization Features

The web visualization provides:

- **Interactive graph** - Pan, zoom, and explore your dependency structure
- **Node selection** - Click on any file to see its dependencies and dependents
- **Cycle highlighting** - Files and edges involved in cycles are highlighted in red
- **Search/filter** - Filter the graph by file path patterns using regex
- **Show only cycles** - Toggle to focus on problematic dependencies
- **Zoom controls** - Zoom in, zoom out, and fit to screen
- **Statistics panel** - See total nodes, edges, and cycle count at a glance

The graph uses an fcose (fast compound spring embedder) layout algorithm that automatically positions nodes to minimize edge crossings and clearly show the dependency structure.

## Understanding Output

### Text Output

```
Analyzing: /path/to/project

Found 42 files

Parsing [████████████████████████████] 100% | 42/42 files

📊 Analysis Results

Files analyzed: 42
Dependencies: 128
Circular dependencies: 2

❌ Found 2 circular dependency chains:

  1. src/moduleA.ts → src/moduleB.ts → src/moduleA.ts
     Files involved: 2

     💡 Suggestions to break this cycle:
        • Extract shared types/interfaces to a new file that both can import.
        • If these files are tightly coupled, consider merging them into a single module.
        • Use dynamic imports (import()) to lazily load dependencies at runtime.

  2. src/utils/helpers.ts → src/services/api.ts → src/utils/format.ts → src/utils/helpers.ts
     Files involved: 3

     💡 Suggestions to break this cycle:
        • The weakest link is helpers.ts → api.ts. Extract the shared dependency to break the cycle here.
        • Consider using dependency injection instead of direct imports.
        • Use dynamic imports (import()) to lazily load dependencies at runtime.

✅ Analysis completed in 1.2s
```

### What Cycles Mean

A circular dependency occurs when module A depends on module B, which (directly or indirectly) depends back on module A. This creates problems:

- **Undefined behavior** - Module initialization order becomes unpredictable
- **Testing difficulties** - Hard to test modules in isolation
- **Refactoring challenges** - Tightly coupled code is difficult to change
- **Build issues** - Some bundlers struggle with circular imports

### Understanding Suggestions

CodeCanvas analyzes each cycle and provides targeted suggestions:

| Suggestion Type | When to Use |
|-----------------|-------------|
| **Extract interface** | When two files share types or interfaces - extract them to a separate file |
| **Dependency injection** | When runtime dependencies can be passed as parameters instead of imported |
| **Lazy import** | Use `import()` for dependencies needed only at runtime, not initialization |
| **Merge files** | When files are so tightly coupled they should be a single module |
| **Reorder imports** | For self-referential imports or complex architecture issues |

### JSON Output

```json
{
  "stats": {
    "totalFiles": 42,
    "totalDependencies": 128,
    "circularDependencies": 2
  },
  "cycles": [
    {
      "chain": ["src/moduleA.ts", "src/moduleB.ts", "src/moduleA.ts"],
      "length": 2,
      "suggestions": [
        {
          "type": "extract-interface",
          "description": "Extract shared types/interfaces to a new file that both can import.",
          "targetEdge": {
            "from": "src/moduleA.ts",
            "to": "src/moduleB.ts"
          }
        }
      ]
    }
  ],
  "graph": {
    "nodes": ["src/moduleA.ts", "src/moduleB.ts", "..."],
    "edges": [
      { "from": "src/moduleA.ts", "to": "src/moduleB.ts" }
    ]
  },
  "errors": []
}
```

## CI/CD Integration

### Exit Codes

| Code | Meaning |
|------|---------|
| `0` | No circular dependencies found |
| `1` | Circular dependencies detected or error occurred |

### GitHub Actions Example

```yaml
name: Dependency Check

on: [push, pull_request]

jobs:
  check-dependencies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install CodeCanvas
        run: npm install -g @codecanvas/cli

      - name: Check for circular dependencies
        run: codecanvas analyze . --output json > analysis.json

      - name: Upload analysis results
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: dependency-analysis
          path: analysis.json
```

### Using JSON Output in Scripts

```bash
#!/bin/bash

# Run analysis and capture output
result=$(codecanvas analyze . --output json)

# Check cycle count with jq
cycles=$(echo "$result" | jq '.stats.circularDependencies')

if [ "$cycles" -gt 0 ]; then
  echo "Found $cycles circular dependencies!"
  echo "$result" | jq '.cycles[].chain'
  exit 1
fi

echo "No circular dependencies found"
```

## Configuration

### Path Aliases (tsconfig.json)

CodeCanvas respects TypeScript path aliases configured in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"],
      "@components/*": ["src/components/*"]
    }
  }
}
```

### Ignore Patterns

Use glob patterns to exclude files from analysis:

```bash
# Ignore all test files
codecanvas analyze . --ignore "**/*.test.ts" --ignore "**/*.spec.ts"

# Ignore specific directories
codecanvas analyze . --ignore "**/test/**" --ignore "**/fixtures/**"

# Ignore generated files
codecanvas analyze . --ignore "**/generated/**" --ignore "**/*.generated.ts"
```

## How It Works

### Parsing with Tree-sitter

CodeCanvas uses [tree-sitter](https://tree-sitter.github.io/) for parsing, which provides:

- Accurate AST parsing that matches how TypeScript/JavaScript actually works
- Consistent parsing across Node.js and browser environments (via WASM)
- High performance even on large codebases

### Cycle Detection with Tarjan's Algorithm

The core detection uses [Tarjan's strongly connected components algorithm](https://en.wikipedia.org/wiki/Tarjan%27s_strongly_connected_components_algorithm):

1. Build a directed graph where nodes are files and edges are imports
2. Run Tarjan's algorithm to find all strongly connected components (SCCs)
3. Any SCC with more than one node represents a circular dependency
4. Reconstruct actual cycle paths for clear reporting

This approach is O(V + E), making it efficient even for large codebases.

### Suggestion Generation

For each detected cycle, CodeCanvas analyzes:

- **Edge strength** - How many imports flow through each edge
- **Type hints** - Whether imports are likely type-only (easier to extract)
- **Cycle length** - Shorter cycles often have simpler fixes

Based on this analysis, it generates prioritized suggestions for breaking the cycle.

## Project Structure

```
codecanvas/
├── packages/
│   ├── cli/           # Command-line interface
│   ├── core/          # Parsing, graph, and cycle detection
│   └── web/           # Next.js visualization UI
├── package.json       # Root package (pnpm workspaces)
└── README.md
```

## Contributing

Contributions are welcome! Here's how to get started:

```bash
# Clone the repository
git clone https://github.com/username/codecanvas.git
cd codecanvas

# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Start development mode
pnpm dev
```

### Development Commands

```bash
pnpm build          # Build all packages
pnpm dev            # Start development mode (all packages)
pnpm test           # Run tests
pnpm lint           # Lint all packages
pnpm cli analyze .  # Run CLI locally
```

### Guidelines

- Write tests for new features
- Follow existing code style
- Update documentation for user-facing changes
- Use conventional commits for commit messages

## Limitations

- **Static imports only** - Dynamic `import()` expressions are detected but their targets cannot be statically resolved
- **TypeScript/JavaScript only** - Other languages are not supported
- **File-level granularity** - Exports/imports are tracked at file level, not individual symbols

## License

MIT License - see [LICENSE](LICENSE) for details.

---

Made with care for developers who want cleaner codebases.
