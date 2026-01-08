/**
 * Cycle detection using Tarjan's strongly connected components algorithm
 */

import type { CircularDependency } from './types.js';
import type { DependencyGraph } from './graph.js';

/**
 * Internal state for Tarjan's algorithm
 */
interface TarjanState {
  index: number;
  stack: string[];
  onStack: Set<string>;
  indices: Map<string, number>;
  lowlinks: Map<string, number>;
  sccs: string[][];
}

/**
 * Find all strongly connected components (SCCs) in the graph using Tarjan's algorithm.
 * An SCC with more than one node indicates a circular dependency.
 *
 * @param graph - The dependency graph to analyze
 * @returns Array of SCCs (each SCC is an array of file paths)
 */
export function findStronglyConnectedComponents(graph: DependencyGraph): string[][] {
  const state: TarjanState = {
    index: 0,
    stack: [],
    onStack: new Set(),
    indices: new Map(),
    lowlinks: new Map(),
    sccs: [],
  };

  // Run Tarjan's algorithm from each unvisited node
  for (const node of graph.getNodes()) {
    if (!state.indices.has(node)) {
      strongConnect(node, graph, state);
    }
  }

  return state.sccs;
}

/**
 * Recursive helper function for Tarjan's algorithm
 */
function strongConnect(v: string, graph: DependencyGraph, state: TarjanState): void {
  // Set the depth index for v
  state.indices.set(v, state.index);
  state.lowlinks.set(v, state.index);
  state.index++;
  state.stack.push(v);
  state.onStack.add(v);

  // Consider successors of v
  for (const w of graph.getDependencies(v)) {
    if (!state.indices.has(w)) {
      // Successor w has not yet been visited; recurse on it
      strongConnect(w, graph, state);
      state.lowlinks.set(v, Math.min(state.lowlinks.get(v)!, state.lowlinks.get(w)!));
    } else if (state.onStack.has(w)) {
      // Successor w is in stack and hence in the current SCC
      state.lowlinks.set(v, Math.min(state.lowlinks.get(v)!, state.indices.get(w)!));
    }
  }

  // If v is a root node, pop the stack and generate an SCC
  if (state.lowlinks.get(v) === state.indices.get(v)) {
    const scc: string[] = [];
    let w: string;
    do {
      w = state.stack.pop()!;
      state.onStack.delete(w);
      scc.push(w);
    } while (w !== v);

    state.sccs.push(scc);
  }
}

/**
 * Find all circular dependencies in the graph.
 * Returns an array of CircularDependency objects, each representing a cycle.
 *
 * @param graph - The dependency graph to analyze
 * @returns Array of circular dependencies found
 */
export function findCycles(graph: DependencyGraph): CircularDependency[] {
  // Find all SCCs
  const sccs = findStronglyConnectedComponents(graph);

  // Filter to SCCs with more than one node (actual cycles)
  const cyclicSccs = sccs.filter(scc => scc.length > 1);

  // Also check for self-loops (A -> A)
  const selfLoops: CircularDependency[] = [];
  for (const node of graph.getNodes()) {
    if (graph.getDependencies(node).includes(node)) {
      selfLoops.push({
        chain: [node, node],
        length: 1,
      });
    }
  }

  // Convert SCCs to CircularDependency format
  const cycles: CircularDependency[] = cyclicSccs.map(scc => {
    // Reconstruct the cycle path
    const cyclePath = reconstructCyclePath(scc, graph);
    return {
      chain: cyclePath,
      length: scc.length,
    };
  });

  return [...selfLoops, ...cycles];
}

/**
 * Reconstruct a meaningful cycle path from an SCC.
 * Tries to find an actual traversal path through the cycle.
 *
 * @param scc - The strongly connected component
 * @param graph - The dependency graph
 * @returns Array representing the cycle path (ends with the first element repeated)
 */
function reconstructCyclePath(scc: string[], graph: DependencyGraph): string[] {
  if (scc.length === 0) return [];
  if (scc.length === 1) return [scc[0], scc[0]];

  const sccSet = new Set(scc);

  // Find a path through all nodes in the SCC using DFS
  // Start from the first node in the SCC
  const start = scc[0];
  const path: string[] = [];
  const visited = new Set<string>();

  // DFS to find a cycle
  function dfs(current: string): boolean {
    if (path.length > 0 && current === start) {
      // Found a cycle back to start
      path.push(current);
      return true;
    }

    if (visited.has(current)) {
      return false;
    }

    visited.add(current);
    path.push(current);

    // Explore dependencies that are in the SCC
    const deps = graph.getDependencies(current).filter(d => sccSet.has(d));

    for (const dep of deps) {
      if (dfs(dep)) {
        return true;
      }
    }

    // Backtrack
    path.pop();
    visited.delete(current);
    return false;
  }

  dfs(start);

  // If DFS didn't find a complete cycle, fall back to simple reconstruction
  if (path.length <= 1 || path[path.length - 1] !== start) {
    // Simple fallback: list nodes in SCC order and close the loop
    return [...scc, scc[0]];
  }

  return path;
}

/**
 * Find all simple cycles in the graph (more exhaustive but slower).
 * Uses Johnson's algorithm for finding all elementary cycles.
 *
 * This is more thorough than just finding SCCs, as an SCC may contain
 * multiple overlapping cycles.
 *
 * @param graph - The dependency graph to analyze
 * @param maxCycles - Maximum number of cycles to find (for performance)
 * @returns Array of circular dependencies found
 */
export function findAllSimpleCycles(
  graph: DependencyGraph,
  maxCycles: number = 1000
): CircularDependency[] {
  const cycles: string[][] = [];
  const nodes = graph.getNodes();

  // For each node, try to find cycles starting from it
  for (const startNode of nodes) {
    if (cycles.length >= maxCycles) break;

    const blocked = new Set<string>();
    const blockedMap = new Map<string, Set<string>>();
    const stack: string[] = [];

    function unblock(node: string): void {
      blocked.delete(node);
      const blockers = blockedMap.get(node);
      if (blockers) {
        for (const blocker of blockers) {
          if (blocked.has(blocker)) {
            unblock(blocker);
          }
        }
        blockers.clear();
      }
    }

    function circuit(node: string): boolean {
      let foundCycle = false;
      stack.push(node);
      blocked.add(node);

      for (const neighbor of graph.getDependencies(node)) {
        if (cycles.length >= maxCycles) {
          stack.pop();
          return true;
        }

        if (neighbor === startNode) {
          // Found a cycle
          cycles.push([...stack, startNode]);
          foundCycle = true;
        } else if (!blocked.has(neighbor)) {
          if (circuit(neighbor)) {
            foundCycle = true;
          }
        }
      }

      if (foundCycle) {
        unblock(node);
      } else {
        for (const neighbor of graph.getDependencies(node)) {
          if (!blockedMap.has(neighbor)) {
            blockedMap.set(neighbor, new Set());
          }
          blockedMap.get(neighbor)!.add(node);
        }
      }

      stack.pop();
      return foundCycle;
    }

    circuit(startNode);
  }

  // Remove duplicate cycles (same cycle starting from different nodes)
  const uniqueCycles = deduplicateCycles(cycles);

  return uniqueCycles.map(cycle => ({
    chain: cycle,
    length: cycle.length - 1, // Don't count the repeated node
  }));
}

/**
 * Remove duplicate cycles (cycles that represent the same loop but start from different nodes)
 */
function deduplicateCycles(cycles: string[][]): string[][] {
  const seen = new Set<string>();
  const unique: string[][] = [];

  for (const cycle of cycles) {
    // Create a canonical representation (smallest rotation)
    const normalizedCycle = normalizeCycle(cycle);
    const key = normalizedCycle.join('->');

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(cycle);
    }
  }

  return unique;
}

/**
 * Normalize a cycle to its canonical form (smallest rotation)
 */
function normalizeCycle(cycle: string[]): string[] {
  if (cycle.length <= 1) return cycle;

  // Remove the last element if it's the same as the first (closing the cycle)
  const nodes = cycle[cycle.length - 1] === cycle[0]
    ? cycle.slice(0, -1)
    : cycle;

  if (nodes.length === 0) return cycle;

  // Find the smallest element
  let minIdx = 0;
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i] < nodes[minIdx]) {
      minIdx = i;
    }
  }

  // Rotate to start from the smallest element
  const rotated = [...nodes.slice(minIdx), ...nodes.slice(0, minIdx)];

  // Add the closing node back
  return [...rotated, rotated[0]];
}

/**
 * Check if a specific file is part of any cycle
 *
 * @param graph - The dependency graph
 * @param filePath - The file to check
 * @returns Array of cycles that include this file
 */
export function findCyclesInvolvingFile(
  graph: DependencyGraph,
  filePath: string
): CircularDependency[] {
  const allCycles = findCycles(graph);
  return allCycles.filter(cycle =>
    cycle.chain.slice(0, -1).includes(filePath)
  );
}

/**
 * Get the longest cycle in the graph
 *
 * @param graph - The dependency graph
 * @returns The longest circular dependency, or null if no cycles exist
 */
export function findLongestCycle(graph: DependencyGraph): CircularDependency | null {
  const cycles = findCycles(graph);
  if (cycles.length === 0) return null;

  return cycles.reduce((longest, current) =>
    current.length > longest.length ? current : longest
  );
}

/**
 * Check if the graph has any cycles
 *
 * @param graph - The dependency graph
 * @returns true if the graph contains at least one cycle
 */
export function hasCycles(graph: DependencyGraph): boolean {
  const sccs = findStronglyConnectedComponents(graph);

  // Check for SCCs with more than one node
  if (sccs.some(scc => scc.length > 1)) {
    return true;
  }

  // Check for self-loops
  for (const node of graph.getNodes()) {
    if (graph.getDependencies(node).includes(node)) {
      return true;
    }
  }

  return false;
}
