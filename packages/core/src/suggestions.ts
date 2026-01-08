/**
 * Cycle-breaking suggestions generator
 *
 * Analyzes circular dependencies and generates actionable suggestions
 * for how to break them.
 */

import type { CircularDependency, CycleSuggestion, DependencyEdge } from './types.js';
import type { DependencyGraph } from './graph.js';

/**
 * Information about an edge in a cycle, including its "strength"
 * (how many imports flow through it)
 */
interface EdgeAnalysis {
  edge: DependencyEdge;
  /** Number of other dependencies the 'from' file has on the 'to' file's module */
  strength: number;
  /** Whether this edge is likely a type-only import */
  likelyTypeImport: boolean;
}

/**
 * Generate suggestions for how to break a circular dependency.
 *
 * @param cycle - The circular dependency to analyze
 * @param graph - The full dependency graph for context
 * @returns Array of suggestions, ordered by likely effectiveness
 */
export function generateCycleSuggestions(
  cycle: CircularDependency,
  graph: DependencyGraph
): CycleSuggestion[] {
  const suggestions: CycleSuggestion[] = [];
  const chainWithoutLoop = cycle.chain.slice(0, -1); // Remove the repeated first element

  // Handle self-loops (file imports itself)
  if (cycle.length === 1) {
    suggestions.push({
      type: 'reorder-imports',
      description: 'This file imports itself. Refactor to remove the self-reference.',
      targetEdge: { from: chainWithoutLoop[0], to: chainWithoutLoop[0] },
    });
    return suggestions;
  }

  // Analyze each edge in the cycle
  const edges = getEdgesFromCycle(cycle);
  const edgeAnalyses = edges.map(edge => analyzeEdge(edge, graph));

  // Find the weakest link (edge with fewest imports)
  const weakestLink = findWeakestLink(edgeAnalyses);

  // Generate suggestions based on cycle characteristics
  if (cycle.length === 2) {
    // 2-node cycles are typically type/interface sharing issues
    suggestions.push({
      type: 'extract-interface',
      description: 'Extract shared types/interfaces to a new file that both can import. This is the most common fix for 2-file cycles.',
      targetEdge: weakestLink?.edge,
    });

    suggestions.push({
      type: 'merge-files',
      description: 'If these files are tightly coupled, consider merging them into a single module.',
    });
  } else {
    // For longer cycles, focus on the weakest link
    if (weakestLink) {
      const fromFile = getFileName(weakestLink.edge.from);
      const toFile = getFileName(weakestLink.edge.to);

      suggestions.push({
        type: 'extract-interface',
        description: `The weakest link is ${fromFile} \u2192 ${toFile} (fewest imports). Extract the shared dependency to break the cycle here.`,
        targetEdge: weakestLink.edge,
      });
    }

    suggestions.push({
      type: 'dependency-injection',
      description: 'Consider using dependency injection instead of direct imports. Pass dependencies as parameters rather than importing them directly.',
      targetEdge: weakestLink?.edge,
    });
  }

  // Lazy import suggestion for any cycle
  suggestions.push({
    type: 'lazy-import',
    description: 'Use dynamic imports (import()) to lazily load dependencies at runtime, breaking the static cycle.',
    targetEdge: weakestLink?.edge,
  });

  // Always suggest reviewing the architecture for longer cycles
  if (cycle.length >= 4) {
    suggestions.push({
      type: 'reorder-imports',
      description: `This is a long cycle (${cycle.length} files). Consider reviewing your module architecture. Long cycles often indicate unclear module boundaries.`,
    });
  }

  return suggestions;
}

/**
 * Extract edges from a cycle chain.
 * Chain is like [A, B, C, A], edges are A->B, B->C, C->A
 */
function getEdgesFromCycle(cycle: CircularDependency): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  const chain = cycle.chain;

  for (let i = 0; i < chain.length - 1; i++) {
    edges.push({
      from: chain[i],
      to: chain[i + 1],
    });
  }

  return edges;
}

/**
 * Analyze an edge to determine its "strength" in the cycle.
 * Weaker edges are better candidates for breaking.
 */
function analyzeEdge(edge: DependencyEdge, graph: DependencyGraph): EdgeAnalysis {
  // Get all dependencies from the 'from' file
  const allDeps = graph.getDependencies(edge.from);

  // Count how many other things the 'from' file imports
  // A file with many imports that only uses one thing from 'to' is a weak link
  const strength = allDeps.length > 0 ? 1 : 0;

  // Check if this might be a type-only import (heuristic based on file names)
  const likelyTypeImport =
    edge.to.includes('types') ||
    edge.to.includes('.d.ts') ||
    edge.to.includes('interfaces') ||
    edge.to.includes('models');

  return {
    edge,
    strength,
    likelyTypeImport,
  };
}

/**
 * Find the weakest link in a cycle - the edge that would be easiest to break.
 * Prefers edges that are likely type imports or have fewer overall dependencies.
 */
function findWeakestLink(analyses: EdgeAnalysis[]): EdgeAnalysis | null {
  if (analyses.length === 0) return null;
  if (analyses.length === 1) return analyses[0];

  // Sort by:
  // 1. Type imports first (they're easier to extract)
  // 2. Then by strength (fewer deps = easier to break)
  const sorted = [...analyses].sort((a, b) => {
    // Type imports are preferred
    if (a.likelyTypeImport && !b.likelyTypeImport) return -1;
    if (!a.likelyTypeImport && b.likelyTypeImport) return 1;

    // Otherwise, prefer lower strength
    return a.strength - b.strength;
  });

  return sorted[0];
}

/**
 * Extract just the filename from a full path for display
 */
function getFileName(filePath: string): string {
  const parts = filePath.split('/');
  return parts[parts.length - 1];
}

/**
 * Add suggestions to multiple cycles.
 * Convenience function for batch processing.
 *
 * @param cycles - Array of cycles to add suggestions to
 * @param graph - The dependency graph for analysis
 * @returns The same cycles with suggestions added
 */
export function addSuggestionsToAllCycles(
  cycles: CircularDependency[],
  graph: DependencyGraph
): CircularDependency[] {
  return cycles.map(cycle => ({
    ...cycle,
    suggestions: generateCycleSuggestions(cycle, graph),
  }));
}
