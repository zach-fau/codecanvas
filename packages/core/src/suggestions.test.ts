/**
 * Tests for cycle-breaking suggestions generator
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from './graph.js';
import { generateCycleSuggestions, addSuggestionsToAllCycles } from './suggestions.js';
import type { CircularDependency } from './types.js';

describe('Suggestions Generator', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph('/project');
  });

  describe('generateCycleSuggestions', () => {
    it('should suggest refactoring for self-loops', () => {
      const selfLoop: CircularDependency = {
        chain: ['/a.ts', '/a.ts'],
        length: 1,
      };

      const suggestions = generateCycleSuggestions(selfLoop, graph);

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].type).toBe('reorder-imports');
      expect(suggestions[0].description).toContain('imports itself');
    });

    it('should suggest extracting interfaces for 2-node cycles', () => {
      // Set up the graph
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/a.ts');

      const cycle: CircularDependency = {
        chain: ['/a.ts', '/b.ts', '/a.ts'],
        length: 2,
      };

      const suggestions = generateCycleSuggestions(cycle, graph);

      expect(suggestions.length).toBeGreaterThanOrEqual(2);
      expect(suggestions[0].type).toBe('extract-interface');
      expect(suggestions[0].description).toContain('Extract shared types');

      // Should also suggest merging files for 2-node cycles
      const mergeSuggestion = suggestions.find(s => s.type === 'merge-files');
      expect(mergeSuggestion).toBeDefined();
    });

    it('should identify weakest link for longer cycles', () => {
      // Set up the graph with a 3-node cycle
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/c.ts');
      graph.addEdge('/c.ts', '/a.ts');

      const cycle: CircularDependency = {
        chain: ['/a.ts', '/b.ts', '/c.ts', '/a.ts'],
        length: 3,
      };

      const suggestions = generateCycleSuggestions(cycle, graph);

      expect(suggestions.length).toBeGreaterThanOrEqual(2);
      // Should mention weakest link
      expect(suggestions[0].type).toBe('extract-interface');
      expect(suggestions[0].targetEdge).toBeDefined();
    });

    it('should suggest dependency injection for longer cycles', () => {
      // Set up the graph with a 4-node cycle
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/c.ts');
      graph.addEdge('/c.ts', '/d.ts');
      graph.addEdge('/d.ts', '/a.ts');

      const cycle: CircularDependency = {
        chain: ['/a.ts', '/b.ts', '/c.ts', '/d.ts', '/a.ts'],
        length: 4,
      };

      const suggestions = generateCycleSuggestions(cycle, graph);

      const diSuggestion = suggestions.find(s => s.type === 'dependency-injection');
      expect(diSuggestion).toBeDefined();
      expect(diSuggestion!.description).toContain('dependency injection');
    });

    it('should suggest lazy imports for any cycle', () => {
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/a.ts');

      const cycle: CircularDependency = {
        chain: ['/a.ts', '/b.ts', '/a.ts'],
        length: 2,
      };

      const suggestions = generateCycleSuggestions(cycle, graph);

      const lazySuggestion = suggestions.find(s => s.type === 'lazy-import');
      expect(lazySuggestion).toBeDefined();
      expect(lazySuggestion!.description).toContain('dynamic imports');
    });

    it('should add architecture review suggestion for long cycles', () => {
      // Set up a 5-node cycle
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/c.ts');
      graph.addEdge('/c.ts', '/d.ts');
      graph.addEdge('/d.ts', '/e.ts');
      graph.addEdge('/e.ts', '/a.ts');

      const cycle: CircularDependency = {
        chain: ['/a.ts', '/b.ts', '/c.ts', '/d.ts', '/e.ts', '/a.ts'],
        length: 5,
      };

      const suggestions = generateCycleSuggestions(cycle, graph);

      const architectureSuggestion = suggestions.find(s =>
        s.type === 'reorder-imports' && s.description.includes('long cycle')
      );
      expect(architectureSuggestion).toBeDefined();
    });

    it('should prefer type files as weakest link targets', () => {
      // Set up a cycle where one file is a types file
      graph.addEdge('/service.ts', '/types.ts');
      graph.addEdge('/types.ts', '/utils.ts');
      graph.addEdge('/utils.ts', '/service.ts');

      const cycle: CircularDependency = {
        chain: ['/service.ts', '/types.ts', '/utils.ts', '/service.ts'],
        length: 3,
      };

      const suggestions = generateCycleSuggestions(cycle, graph);

      // The suggestion should target the types.ts edge as weakest
      const extractSuggestion = suggestions.find(s => s.type === 'extract-interface');
      expect(extractSuggestion).toBeDefined();
      // The target edge should involve types.ts
      if (extractSuggestion?.targetEdge) {
        expect(
          extractSuggestion.targetEdge.from.includes('types') ||
          extractSuggestion.targetEdge.to.includes('types')
        ).toBe(true);
      }
    });
  });

  describe('addSuggestionsToAllCycles', () => {
    it('should add suggestions to multiple cycles', () => {
      // Set up the graph with two cycles
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/a.ts');
      graph.addEdge('/c.ts', '/d.ts');
      graph.addEdge('/d.ts', '/c.ts');

      const cycles: CircularDependency[] = [
        { chain: ['/a.ts', '/b.ts', '/a.ts'], length: 2 },
        { chain: ['/c.ts', '/d.ts', '/c.ts'], length: 2 },
      ];

      const cyclesWithSuggestions = addSuggestionsToAllCycles(cycles, graph);

      expect(cyclesWithSuggestions).toHaveLength(2);
      expect(cyclesWithSuggestions[0].suggestions).toBeDefined();
      expect(cyclesWithSuggestions[0].suggestions!.length).toBeGreaterThan(0);
      expect(cyclesWithSuggestions[1].suggestions).toBeDefined();
      expect(cyclesWithSuggestions[1].suggestions!.length).toBeGreaterThan(0);
    });

    it('should preserve original cycle data', () => {
      graph.addEdge('/a.ts', '/b.ts');
      graph.addEdge('/b.ts', '/a.ts');

      const cycles: CircularDependency[] = [
        { chain: ['/a.ts', '/b.ts', '/a.ts'], length: 2 },
      ];

      const cyclesWithSuggestions = addSuggestionsToAllCycles(cycles, graph);

      expect(cyclesWithSuggestions[0].chain).toEqual(cycles[0].chain);
      expect(cyclesWithSuggestions[0].length).toBe(cycles[0].length);
    });
  });

  describe('Real-world scenarios', () => {
    it('should suggest fixes for component circular dependency', () => {
      // Common React pattern where components import each other
      graph.addEdge('/components/Header.tsx', '/components/Navigation.tsx');
      graph.addEdge('/components/Navigation.tsx', '/components/MenuItem.tsx');
      graph.addEdge('/components/MenuItem.tsx', '/components/Header.tsx');

      const cycle: CircularDependency = {
        chain: [
          '/components/Header.tsx',
          '/components/Navigation.tsx',
          '/components/MenuItem.tsx',
          '/components/Header.tsx',
        ],
        length: 3,
      };

      const suggestions = generateCycleSuggestions(cycle, graph);

      expect(suggestions.length).toBeGreaterThanOrEqual(2);
      // Should suggest extracting shared types/interfaces
      expect(suggestions[0].type).toBe('extract-interface');
    });

    it('should suggest fixes for service layer circular dependency', () => {
      // Service A uses Service B, B uses C, C uses A
      graph.addEdge('/services/UserService.ts', '/services/AuthService.ts');
      graph.addEdge('/services/AuthService.ts', '/services/SessionService.ts');
      graph.addEdge('/services/SessionService.ts', '/services/UserService.ts');

      const cycle: CircularDependency = {
        chain: [
          '/services/UserService.ts',
          '/services/AuthService.ts',
          '/services/SessionService.ts',
          '/services/UserService.ts',
        ],
        length: 3,
      };

      const suggestions = generateCycleSuggestions(cycle, graph);

      // Should suggest dependency injection for service layer
      const diSuggestion = suggestions.find(s => s.type === 'dependency-injection');
      expect(diSuggestion).toBeDefined();
    });
  });
});
