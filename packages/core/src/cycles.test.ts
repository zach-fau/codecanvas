/**
 * Tests for cycle detection using Tarjan's algorithm
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from './graph.js';
import {
  findCycles,
  findStronglyConnectedComponents,
  hasCycles,
  findCyclesInvolvingFile,
  findLongestCycle,
  findAllSimpleCycles,
} from './cycles.js';

describe('Cycle Detection', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph('/project');
  });

  describe('findStronglyConnectedComponents', () => {
    it('should find single nodes as individual SCCs in acyclic graph', () => {
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/c.ts');

      const sccs = findStronglyConnectedComponents(graph);

      // Each node should be its own SCC (no cycles)
      expect(sccs).toHaveLength(3);
      expect(sccs.every(scc => scc.length === 1)).toBe(true);
    });

    it('should find SCC with multiple nodes for a cycle', () => {
      // a -> b -> c -> a
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/c.ts');
      graph.addEdge('/c.ts', '/a.ts');

      const sccs = findStronglyConnectedComponents(graph);

      // Should have one SCC with 3 nodes (the cycle)
      const cycleScc = sccs.find(scc => scc.length === 3);
      expect(cycleScc).toBeDefined();
      expect(cycleScc).toContain('/a.ts');
      expect(cycleScc).toContain('/b.ts');
      expect(cycleScc).toContain('/c.ts');
    });

    it('should find multiple independent SCCs', () => {
      // Cycle 1: a -> b -> a
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/a.ts');

      // Cycle 2: c -> d -> c
      graph.addEdge('/c.ts', '/d.ts');
      graph.addEdge('/d.ts', '/c.ts');

      const sccs = findStronglyConnectedComponents(graph);

      // Should have two SCCs with 2 nodes each
      const largeSCCs = sccs.filter(scc => scc.length === 2);
      expect(largeSCCs).toHaveLength(2);
    });
  });

  describe('findCycles', () => {
    it('should return empty array for acyclic graph', () => {
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/c.ts');
      graph.addEdge('/a.ts', '/c.ts');

      const cycles = findCycles(graph);
      expect(cycles).toHaveLength(0);
    });

    it('should find a simple 2-node cycle', () => {
      // a -> b -> a
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/a.ts');

      const cycles = findCycles(graph);

      expect(cycles).toHaveLength(1);
      expect(cycles[0].length).toBe(2);
      expect(cycles[0].chain).toContain('/a.ts');
      expect(cycles[0].chain).toContain('/b.ts');
    });

    it('should find a 3-node cycle', () => {
      // a -> b -> c -> a
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/c.ts');
      graph.addEdge('/c.ts', '/a.ts');

      const cycles = findCycles(graph);

      expect(cycles).toHaveLength(1);
      expect(cycles[0].length).toBe(3);
    });

    it('should find self-loop', () => {
      // a -> a
      graph.addNode('/a.ts');
      // Manually create self-loop since addEdge may not support it
      const node = graph.getNode('/a.ts')!;
      node.dependencies.push('/a.ts');
      node.dependents.push('/a.ts');

      const cycles = findCycles(graph);

      expect(cycles).toHaveLength(1);
      expect(cycles[0].length).toBe(1);
      expect(cycles[0].chain).toContain('/a.ts');
    });

    it('should find multiple independent cycles', () => {
      // Cycle 1: a -> b -> a
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/a.ts');

      // Cycle 2: c -> d -> e -> c
      graph.addEdge('/c.ts', '/d.ts');
      graph.addEdge('/d.ts', '/e.ts');
      graph.addEdge('/e.ts', '/c.ts');

      const cycles = findCycles(graph);

      expect(cycles).toHaveLength(2);
      expect(cycles.find(c => c.length === 2)).toBeDefined();
      expect(cycles.find(c => c.length === 3)).toBeDefined();
    });

    it('should handle complex graph with cycle and non-cycle parts', () => {
      // Linear part: entry -> app -> utils
      graph.addEdge('/entry.ts', '/app.ts');
      graph.addEdge('/app.ts', '/utils.ts');

      // Cycle: a -> b -> c -> a
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/c.ts');
      graph.addEdge('/c.ts', '/a.ts');

      // Connection from linear to cycle
      graph.addEdge('/app.ts', '/a.ts');

      const cycles = findCycles(graph);

      expect(cycles).toHaveLength(1);
      expect(cycles[0].length).toBe(3);
    });

    it('should detect cycle chain correctly (A -> B -> C -> A)', () => {
      graph.addEdge('/src/a.ts', '/src/b.ts');
      graph.addEdge('/src/b.ts', '/src/c.ts');
      graph.addEdge('/src/c.ts', '/src/a.ts');

      const cycles = findCycles(graph);

      expect(cycles).toHaveLength(1);

      // The chain should form a complete cycle
      const chain = cycles[0].chain;
      expect(chain[0]).toBe(chain[chain.length - 1]); // First and last should be same
    });
  });

  describe('hasCycles', () => {
    it('should return false for acyclic graph', () => {
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/c.ts');

      expect(hasCycles(graph)).toBe(false);
    });

    it('should return true for cyclic graph', () => {
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/a.ts');

      expect(hasCycles(graph)).toBe(true);
    });

    it('should return false for empty graph', () => {
      expect(hasCycles(graph)).toBe(false);
    });

    it('should return true for self-loop', () => {
      graph.addNode('/a.ts');
      const node = graph.getNode('/a.ts')!;
      node.dependencies.push('/a.ts');

      expect(hasCycles(graph)).toBe(true);
    });
  });

  describe('findCyclesInvolvingFile', () => {
    it('should find cycles involving a specific file', () => {
      // Cycle 1: a -> b -> a
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/a.ts');

      // Cycle 2: c -> d -> c (does not involve a)
      graph.addEdge('/c.ts', '/d.ts');
      graph.addEdge('/d.ts', '/c.ts');

      const cyclesWithA = findCyclesInvolvingFile(graph, '/a.ts');
      const cyclesWithC = findCyclesInvolvingFile(graph, '/c.ts');

      expect(cyclesWithA).toHaveLength(1);
      expect(cyclesWithC).toHaveLength(1);
    });

    it('should return empty array if file is not in any cycle', () => {
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/a.ts');
      graph.addNode('/c.ts');

      const cycles = findCyclesInvolvingFile(graph, '/c.ts');
      expect(cycles).toHaveLength(0);
    });
  });

  describe('findLongestCycle', () => {
    it('should return the longest cycle', () => {
      // Short cycle: a -> b -> a (length 2)
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/a.ts');

      // Long cycle: c -> d -> e -> f -> c (length 4)
      graph.addEdge('/c.ts', '/d.ts');
      graph.addEdge('/d.ts', '/e.ts');
      graph.addEdge('/e.ts', '/f.ts');
      graph.addEdge('/f.ts', '/c.ts');

      const longest = findLongestCycle(graph);

      expect(longest).not.toBeNull();
      expect(longest!.length).toBe(4);
    });

    it('should return null for acyclic graph', () => {
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/c.ts');

      expect(findLongestCycle(graph)).toBeNull();
    });
  });

  describe('findAllSimpleCycles', () => {
    it('should find simple cycles', () => {
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/a.ts');

      const cycles = findAllSimpleCycles(graph);

      expect(cycles.length).toBeGreaterThanOrEqual(1);
    });

    it('should respect maxCycles limit', () => {
      // Create multiple cycles
      for (let i = 0; i < 10; i++) {
        graph.addEdge(`/a${i}.ts`, `/b${i}.ts`);
        graph.addEdge(`/b${i}.ts`, `/a${i}.ts`);
      }

      const cycles = findAllSimpleCycles(graph, 5);

      expect(cycles.length).toBeLessThanOrEqual(5);
    });
  });

  describe('Real-world scenarios', () => {
    it('should detect circular dependency in typical module structure', () => {
      // Common pattern: components importing each other
      graph.addEdge('/components/Header.tsx', '/components/Navigation.tsx');
      graph.addEdge('/components/Navigation.tsx', '/components/MenuItem.tsx');
      graph.addEdge('/components/MenuItem.tsx', '/components/Header.tsx'); // cycle!

      const cycles = findCycles(graph);

      expect(cycles).toHaveLength(1);
      expect(cycles[0].length).toBe(3);
    });

    it('should detect service layer circular dependencies', () => {
      // Service A uses Service B, B uses C, C uses A
      graph.addEdge('/services/UserService.ts', '/services/AuthService.ts');
      graph.addEdge('/services/AuthService.ts', '/services/SessionService.ts');
      graph.addEdge('/services/SessionService.ts', '/services/UserService.ts');

      const cycles = findCycles(graph);

      expect(cycles).toHaveLength(1);
    });

    it('should not detect false positives with shared dependencies', () => {
      // Multiple files depending on same utility (not a cycle)
      graph.addEdge('/app.ts', '/utils.ts');
      graph.addEdge('/api.ts', '/utils.ts');
      graph.addEdge('/db.ts', '/utils.ts');
      graph.addEdge('/app.ts', '/api.ts');
      graph.addEdge('/api.ts', '/db.ts');

      const cycles = findCycles(graph);

      expect(cycles).toHaveLength(0);
    });

    it('should handle diamond dependency without cycles', () => {
      //     A
      //    / \
      //   B   C
      //    \ /
      //     D
      graph.addEdge('/A.ts', '/B.ts');
      graph.addEdge('/A.ts', '/C.ts');
      graph.addEdge('/B.ts', '/D.ts');
      graph.addEdge('/C.ts', '/D.ts');

      const cycles = findCycles(graph);

      expect(cycles).toHaveLength(0);
    });

    it('should detect cycle in large graph efficiently', () => {
      // Create a chain of 100 files
      for (let i = 0; i < 100; i++) {
        graph.addEdge(`/file${i}.ts`, `/file${i + 1}.ts`);
      }
      // Close the cycle
      graph.addEdge('/file100.ts', '/file0.ts');

      const startTime = Date.now();
      const cycles = findCycles(graph);
      const duration = Date.now() - startTime;

      expect(cycles).toHaveLength(1);
      expect(cycles[0].length).toBe(101);
      expect(duration).toBeLessThan(1000); // Should be fast
    });
  });
});
