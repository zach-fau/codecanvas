/**
 * Tests for the DependencyGraph class
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DependencyGraph } from './graph.js';

describe('DependencyGraph', () => {
  let graph: DependencyGraph;

  beforeEach(() => {
    graph = new DependencyGraph('/project');
  });

  describe('constructor', () => {
    it('should create an empty graph', () => {
      expect(graph.nodeCount).toBe(0);
      expect(graph.edgeCount).toBe(0);
    });

    it('should store the root directory', () => {
      expect(graph.getRootDir()).toBe('/project');
    });
  });

  describe('addNode', () => {
    it('should add a new node', () => {
      graph.addNode('/project/src/index.ts');
      expect(graph.nodeCount).toBe(1);
      expect(graph.hasNode('/project/src/index.ts')).toBe(true);
    });

    it('should not duplicate nodes', () => {
      graph.addNode('/project/src/index.ts');
      graph.addNode('/project/src/index.ts');
      expect(graph.nodeCount).toBe(1);
    });

    it('should create node with empty dependencies and dependents', () => {
      graph.addNode('/project/src/index.ts');
      const node = graph.getNode('/project/src/index.ts');
      expect(node?.dependencies).toEqual([]);
      expect(node?.dependents).toEqual([]);
    });
  });

  describe('addEdge', () => {
    it('should add an edge between two nodes', () => {
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');
      expect(graph.hasEdge('/project/src/a.ts', '/project/src/b.ts')).toBe(true);
    });

    it('should create nodes if they do not exist', () => {
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');
      expect(graph.hasNode('/project/src/a.ts')).toBe(true);
      expect(graph.hasNode('/project/src/b.ts')).toBe(true);
    });

    it('should not duplicate edges', () => {
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');
      expect(graph.edgeCount).toBe(1);
    });

    it('should update dependencies and dependents correctly', () => {
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');

      const nodeA = graph.getNode('/project/src/a.ts');
      const nodeB = graph.getNode('/project/src/b.ts');

      expect(nodeA?.dependencies).toContain('/project/src/b.ts');
      expect(nodeB?.dependents).toContain('/project/src/a.ts');
    });
  });

  describe('getNodes', () => {
    it('should return all node paths', () => {
      graph.addNode('/project/src/a.ts');
      graph.addNode('/project/src/b.ts');
      graph.addNode('/project/src/c.ts');

      const nodes = graph.getNodes();
      expect(nodes).toHaveLength(3);
      expect(nodes).toContain('/project/src/a.ts');
      expect(nodes).toContain('/project/src/b.ts');
      expect(nodes).toContain('/project/src/c.ts');
    });
  });

  describe('getEdges', () => {
    it('should return all edges', () => {
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');
      graph.addEdge('/project/src/b.ts', '/project/src/c.ts');

      const edges = graph.getEdges();
      expect(edges).toHaveLength(2);
      expect(edges).toContainEqual({ from: '/project/src/a.ts', to: '/project/src/b.ts' });
      expect(edges).toContainEqual({ from: '/project/src/b.ts', to: '/project/src/c.ts' });
    });
  });

  describe('getDependencies', () => {
    it('should return direct dependencies of a file', () => {
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');
      graph.addEdge('/project/src/a.ts', '/project/src/c.ts');

      const deps = graph.getDependencies('/project/src/a.ts');
      expect(deps).toHaveLength(2);
      expect(deps).toContain('/project/src/b.ts');
      expect(deps).toContain('/project/src/c.ts');
    });

    it('should return empty array for node with no dependencies', () => {
      graph.addNode('/project/src/a.ts');
      expect(graph.getDependencies('/project/src/a.ts')).toEqual([]);
    });

    it('should return empty array for non-existent node', () => {
      expect(graph.getDependencies('/project/src/nonexistent.ts')).toEqual([]);
    });
  });

  describe('getDependents', () => {
    it('should return files that depend on this file', () => {
      graph.addEdge('/project/src/a.ts', '/project/src/c.ts');
      graph.addEdge('/project/src/b.ts', '/project/src/c.ts');

      const dependents = graph.getDependents('/project/src/c.ts');
      expect(dependents).toHaveLength(2);
      expect(dependents).toContain('/project/src/a.ts');
      expect(dependents).toContain('/project/src/b.ts');
    });

    it('should return empty array for node with no dependents', () => {
      graph.addNode('/project/src/a.ts');
      expect(graph.getDependents('/project/src/a.ts')).toEqual([]);
    });
  });

  describe('getTransitiveDependencies', () => {
    it('should return all transitive dependencies', () => {
      // a -> b -> c -> d
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');
      graph.addEdge('/project/src/b.ts', '/project/src/c.ts');
      graph.addEdge('/project/src/c.ts', '/project/src/d.ts');

      const deps = graph.getTransitiveDependencies('/project/src/a.ts');
      expect(deps.size).toBe(3);
      expect(deps.has('/project/src/b.ts')).toBe(true);
      expect(deps.has('/project/src/c.ts')).toBe(true);
      expect(deps.has('/project/src/d.ts')).toBe(true);
    });

    it('should handle cycles in transitive dependencies', () => {
      // a -> b -> c -> a (cycle)
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');
      graph.addEdge('/project/src/b.ts', '/project/src/c.ts');
      graph.addEdge('/project/src/c.ts', '/project/src/a.ts');

      const deps = graph.getTransitiveDependencies('/project/src/a.ts');
      expect(deps.size).toBe(3);
      expect(deps.has('/project/src/a.ts')).toBe(true);
      expect(deps.has('/project/src/b.ts')).toBe(true);
      expect(deps.has('/project/src/c.ts')).toBe(true);
    });
  });

  describe('getTransitiveDependents', () => {
    it('should return all transitive dependents', () => {
      // d <- c <- b <- a
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');
      graph.addEdge('/project/src/b.ts', '/project/src/c.ts');
      graph.addEdge('/project/src/c.ts', '/project/src/d.ts');

      const dependents = graph.getTransitiveDependents('/project/src/d.ts');
      expect(dependents.size).toBe(3);
      expect(dependents.has('/project/src/a.ts')).toBe(true);
      expect(dependents.has('/project/src/b.ts')).toBe(true);
      expect(dependents.has('/project/src/c.ts')).toBe(true);
    });
  });

  describe('removeNode', () => {
    it('should remove a node and all its edges', () => {
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');
      graph.addEdge('/project/src/b.ts', '/project/src/c.ts');

      graph.removeNode('/project/src/b.ts');

      expect(graph.hasNode('/project/src/b.ts')).toBe(false);
      expect(graph.getDependencies('/project/src/a.ts')).not.toContain('/project/src/b.ts');
      expect(graph.getDependents('/project/src/c.ts')).not.toContain('/project/src/b.ts');
    });
  });

  describe('removeEdge', () => {
    it('should remove an edge between nodes', () => {
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');
      graph.removeEdge('/project/src/a.ts', '/project/src/b.ts');

      expect(graph.hasEdge('/project/src/a.ts', '/project/src/b.ts')).toBe(false);
      expect(graph.hasNode('/project/src/a.ts')).toBe(true);
      expect(graph.hasNode('/project/src/b.ts')).toBe(true);
    });
  });

  describe('clear', () => {
    it('should remove all nodes and edges', () => {
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');
      graph.addEdge('/project/src/b.ts', '/project/src/c.ts');

      graph.clear();

      expect(graph.nodeCount).toBe(0);
      expect(graph.edgeCount).toBe(0);
    });
  });

  describe('toData and fromData', () => {
    it('should serialize and deserialize correctly', () => {
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');
      graph.addEdge('/project/src/b.ts', '/project/src/c.ts');

      const data = graph.toData();
      const restored = DependencyGraph.fromData(data);

      expect(restored.nodeCount).toBe(graph.nodeCount);
      expect(restored.edgeCount).toBe(graph.edgeCount);
      expect(restored.getRootDir()).toBe(graph.getRootDir());
      expect(restored.hasEdge('/project/src/a.ts', '/project/src/b.ts')).toBe(true);
      expect(restored.hasEdge('/project/src/b.ts', '/project/src/c.ts')).toBe(true);
    });
  });

  describe('getTopDependencies', () => {
    it('should return files with most dependencies', () => {
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');
      graph.addEdge('/project/src/a.ts', '/project/src/c.ts');
      graph.addEdge('/project/src/a.ts', '/project/src/d.ts');
      graph.addEdge('/project/src/b.ts', '/project/src/c.ts');

      const top = graph.getTopDependencies(2);
      expect(top[0].file).toBe('/project/src/a.ts');
      expect(top[0].count).toBe(3);
      expect(top[1].file).toBe('/project/src/b.ts');
      expect(top[1].count).toBe(1);
    });
  });

  describe('getTopDependents', () => {
    it('should return files with most dependents', () => {
      graph.addEdge('/project/src/a.ts', '/project/src/d.ts');
      graph.addEdge('/project/src/b.ts', '/project/src/d.ts');
      graph.addEdge('/project/src/c.ts', '/project/src/d.ts');
      graph.addEdge('/project/src/a.ts', '/project/src/e.ts');

      const top = graph.getTopDependents(2);
      expect(top[0].file).toBe('/project/src/d.ts');
      expect(top[0].count).toBe(3);
      expect(top[1].file).toBe('/project/src/e.ts');
      expect(top[1].count).toBe(1);
    });
  });

  describe('getOrphanFiles', () => {
    it('should return files with no dependencies or dependents', () => {
      graph.addNode('/project/src/orphan.ts');
      graph.addEdge('/project/src/a.ts', '/project/src/b.ts');

      const orphans = graph.getOrphanFiles();
      expect(orphans).toContain('/project/src/orphan.ts');
      expect(orphans).not.toContain('/project/src/a.ts');
      expect(orphans).not.toContain('/project/src/b.ts');
    });
  });

  describe('getLeafFiles', () => {
    it('should return files with no dependents but have dependencies', () => {
      graph.addEdge('/project/src/leaf.ts', '/project/src/util.ts');
      graph.addEdge('/project/src/another.ts', '/project/src/util.ts');

      const leaves = graph.getLeafFiles();
      expect(leaves).toContain('/project/src/leaf.ts');
      expect(leaves).toContain('/project/src/another.ts');
      expect(leaves).not.toContain('/project/src/util.ts');
    });
  });

  describe('getRootFiles', () => {
    it('should return files with no dependencies but have dependents', () => {
      graph.addEdge('/project/src/app.ts', '/project/src/root.ts');
      graph.addEdge('/project/src/test.ts', '/project/src/root.ts');

      const roots = graph.getRootFiles();
      expect(roots).toContain('/project/src/root.ts');
      expect(roots).not.toContain('/project/src/app.ts');
      expect(roots).not.toContain('/project/src/test.ts');
    });
  });
});
