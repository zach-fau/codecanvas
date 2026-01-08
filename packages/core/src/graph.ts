/**
 * Dependency graph implementation for tracking file dependencies
 */

import type { DependencyNode, DependencyEdge, DependencyGraphData } from './types.js';

/**
 * A class representing a dependency graph for a codebase.
 * Tracks which files depend on which other files.
 */
export class DependencyGraph {
  /** Map of file paths to their dependency information */
  private nodes: Map<string, DependencyNode> = new Map();
  /** Root directory of the analyzed project */
  private rootDir: string;

  /**
   * Create a new DependencyGraph
   * @param rootDir - The root directory of the project being analyzed
   */
  constructor(rootDir: string = '') {
    this.rootDir = rootDir;
  }

  /**
   * Add a node (file) to the graph.
   * If the node already exists, this is a no-op.
   * @param filePath - Absolute path to the file
   */
  addNode(filePath: string): void {
    if (!this.nodes.has(filePath)) {
      this.nodes.set(filePath, {
        filePath,
        dependencies: [],
        dependents: [],
      });
    }
  }

  /**
   * Add a directed edge from one file to another (dependency relationship).
   * Creates nodes for both files if they don't exist.
   * @param from - The file that imports (depends on the other)
   * @param to - The file being imported (depended upon)
   */
  addEdge(from: string, to: string): void {
    // Ensure both nodes exist
    this.addNode(from);
    this.addNode(to);

    const fromNode = this.nodes.get(from)!;
    const toNode = this.nodes.get(to)!;

    // Add dependency if not already present
    if (!fromNode.dependencies.includes(to)) {
      fromNode.dependencies.push(to);
    }

    // Add dependent if not already present
    if (!toNode.dependents.includes(from)) {
      toNode.dependents.push(from);
    }
  }

  /**
   * Check if a node exists in the graph
   * @param filePath - Path to check
   */
  hasNode(filePath: string): boolean {
    return this.nodes.has(filePath);
  }

  /**
   * Check if an edge exists in the graph
   * @param from - Source file
   * @param to - Target file
   */
  hasEdge(from: string, to: string): boolean {
    const node = this.nodes.get(from);
    return node ? node.dependencies.includes(to) : false;
  }

  /**
   * Get all nodes in the graph
   * @returns Array of all file paths in the graph
   */
  getNodes(): string[] {
    return Array.from(this.nodes.keys());
  }

  /**
   * Get all edges in the graph
   * @returns Array of all edges (from, to pairs)
   */
  getEdges(): DependencyEdge[] {
    const edges: DependencyEdge[] = [];
    for (const [from, node] of this.nodes) {
      for (const to of node.dependencies) {
        edges.push({ from, to });
      }
    }
    return edges;
  }

  /**
   * Get a specific node's data
   * @param filePath - Path to the file
   * @returns The node data or undefined if not found
   */
  getNode(filePath: string): DependencyNode | undefined {
    return this.nodes.get(filePath);
  }

  /**
   * Get direct dependencies of a file (files it imports)
   * @param filePath - Path to the file
   * @returns Array of file paths this file depends on
   */
  getDependencies(filePath: string): string[] {
    const node = this.nodes.get(filePath);
    return node ? [...node.dependencies] : [];
  }

  /**
   * Get direct dependents of a file (files that import it)
   * @param filePath - Path to the file
   * @returns Array of file paths that depend on this file
   */
  getDependents(filePath: string): string[] {
    const node = this.nodes.get(filePath);
    return node ? [...node.dependents] : [];
  }

  /**
   * Get all transitive dependencies of a file (recursive)
   * @param filePath - Path to the file
   * @returns Set of all file paths this file transitively depends on
   */
  getTransitiveDependencies(filePath: string): Set<string> {
    const visited = new Set<string>();
    const stack = [filePath];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const deps = this.getDependencies(current);
      for (const dep of deps) {
        if (!visited.has(dep)) {
          visited.add(dep);
          stack.push(dep);
        }
      }
    }

    return visited;
  }

  /**
   * Get all transitive dependents of a file (recursive)
   * @param filePath - Path to the file
   * @returns Set of all file paths that transitively depend on this file
   */
  getTransitiveDependents(filePath: string): Set<string> {
    const visited = new Set<string>();
    const stack = [filePath];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const dependents = this.getDependents(current);
      for (const dep of dependents) {
        if (!visited.has(dep)) {
          visited.add(dep);
          stack.push(dep);
        }
      }
    }

    return visited;
  }

  /**
   * Get the number of nodes in the graph
   */
  get nodeCount(): number {
    return this.nodes.size;
  }

  /**
   * Get the number of edges in the graph
   */
  get edgeCount(): number {
    let count = 0;
    for (const node of this.nodes.values()) {
      count += node.dependencies.length;
    }
    return count;
  }

  /**
   * Get the root directory
   */
  getRootDir(): string {
    return this.rootDir;
  }

  /**
   * Set the root directory
   */
  setRootDir(rootDir: string): void {
    this.rootDir = rootDir;
  }

  /**
   * Remove a node and all its edges from the graph
   * @param filePath - Path to the file to remove
   */
  removeNode(filePath: string): void {
    const node = this.nodes.get(filePath);
    if (!node) return;

    // Remove this node from all its dependents' dependency lists
    for (const dependent of node.dependents) {
      const depNode = this.nodes.get(dependent);
      if (depNode) {
        depNode.dependencies = depNode.dependencies.filter(d => d !== filePath);
      }
    }

    // Remove this node from all its dependencies' dependent lists
    for (const dependency of node.dependencies) {
      const depNode = this.nodes.get(dependency);
      if (depNode) {
        depNode.dependents = depNode.dependents.filter(d => d !== filePath);
      }
    }

    this.nodes.delete(filePath);
  }

  /**
   * Remove an edge from the graph
   * @param from - Source file
   * @param to - Target file
   */
  removeEdge(from: string, to: string): void {
    const fromNode = this.nodes.get(from);
    const toNode = this.nodes.get(to);

    if (fromNode) {
      fromNode.dependencies = fromNode.dependencies.filter(d => d !== to);
    }
    if (toNode) {
      toNode.dependents = toNode.dependents.filter(d => d !== from);
    }
  }

  /**
   * Clear all nodes and edges from the graph
   */
  clear(): void {
    this.nodes.clear();
  }

  /**
   * Convert the graph to a serializable data format
   */
  toData(): DependencyGraphData {
    return {
      nodes: new Map(this.nodes),
      cycles: [], // Cycles are computed separately
      rootDir: this.rootDir,
    };
  }

  /**
   * Create a DependencyGraph from serialized data
   */
  static fromData(data: DependencyGraphData): DependencyGraph {
    const graph = new DependencyGraph(data.rootDir);
    for (const [path, node] of data.nodes) {
      graph.nodes.set(path, { ...node });
    }
    return graph;
  }

  /**
   * Get files with the most dependencies
   * @param limit - Maximum number of results
   */
  getTopDependencies(limit: number = 10): { file: string; count: number }[] {
    return Array.from(this.nodes.entries())
      .map(([file, node]) => ({ file, count: node.dependencies.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get files with the most dependents
   * @param limit - Maximum number of results
   */
  getTopDependents(limit: number = 10): { file: string; count: number }[] {
    return Array.from(this.nodes.entries())
      .map(([file, node]) => ({ file, count: node.dependents.length }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Get orphan files (files with no dependencies and no dependents)
   */
  getOrphanFiles(): string[] {
    return Array.from(this.nodes.entries())
      .filter(([_, node]) => node.dependencies.length === 0 && node.dependents.length === 0)
      .map(([file]) => file);
  }

  /**
   * Get leaf files (files with no dependents, only dependencies)
   */
  getLeafFiles(): string[] {
    return Array.from(this.nodes.entries())
      .filter(([_, node]) => node.dependents.length === 0 && node.dependencies.length > 0)
      .map(([file]) => file);
  }

  /**
   * Get root files (files with no dependencies, only dependents)
   */
  getRootFiles(): string[] {
    return Array.from(this.nodes.entries())
      .filter(([_, node]) => node.dependencies.length === 0 && node.dependents.length > 0)
      .map(([file]) => file);
  }
}
