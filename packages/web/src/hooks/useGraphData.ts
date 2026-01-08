'use client';

import { useState, useMemo, useCallback } from 'react';

/**
 * Analysis result from the CLI
 * This matches the JSON output from @codecanvas/core
 */
export interface AnalysisJSON {
  nodes: Record<string, {
    filePath: string;
    dependencies: string[];
    dependents: string[];
  }>;
  cycles: Array<{
    chain: string[];
    length: number;
  }>;
  rootDir: string;
  stats?: {
    totalFiles: number;
    totalDependencies: number;
    circularDependencies: number;
  };
}

/**
 * A node in the Cytoscape graph format
 */
export interface CytoscapeNode {
  data: {
    id: string;
    label: string;
    dependencies: string[];
    dependents: string[];
    inCycle: boolean;
  };
}

/**
 * An edge in the Cytoscape graph format
 */
export interface CytoscapeEdge {
  data: {
    id: string;
    source: string;
    target: string;
    inCycle: boolean;
  };
}

/**
 * Combined Cytoscape elements
 */
export interface CytoscapeElements {
  nodes: CytoscapeNode[];
  edges: CytoscapeEdge[];
}

/**
 * Graph data state
 */
export interface GraphDataState {
  /** All elements in Cytoscape format */
  elements: CytoscapeElements;
  /** Filtered elements based on current filter settings */
  filteredElements: CytoscapeElements;
  /** Currently selected node */
  selectedNode: CytoscapeNode['data'] | null;
  /** Current filter pattern */
  filterPattern: string;
  /** Whether to show only nodes involved in cycles */
  showOnlyCycles: boolean;
  /** Set of node IDs that are part of cycles */
  cycleNodeIds: Set<string>;
  /** Currently highlighted node (for navigation) */
  highlightedNodeId: string | null;
  /** Statistics about the graph */
  stats: {
    nodes: number;
    edges: number;
    cycles: number;
  };
}

/**
 * Graph data hook actions
 */
export interface GraphDataActions {
  /** Set the selected node by ID */
  selectNode: (nodeId: string | null) => void;
  /** Update the filter pattern */
  setFilterPattern: (pattern: string) => void;
  /** Toggle showing only cycle nodes */
  setShowOnlyCycles: (show: boolean) => void;
  /** Highlight a specific node (for navigation) */
  highlightNode: (nodeId: string) => void;
  /** Clear all highlights */
  clearHighlights: () => void;
}

/**
 * Transform analysis JSON data to Cytoscape format
 */
function transformToCytoscape(data: AnalysisJSON): {
  elements: CytoscapeElements;
  cycleNodeIds: Set<string>;
} {
  const cycleNodeIds = new Set<string>();
  const cycleEdges = new Set<string>();

  // Build set of nodes and edges in cycles
  for (const cycle of data.cycles) {
    for (let i = 0; i < cycle.chain.length; i++) {
      cycleNodeIds.add(cycle.chain[i]);
      // Create edge identifier for cycle detection
      const nextIdx = (i + 1) % cycle.chain.length;
      const edgeKey = `${cycle.chain[i]}->${cycle.chain[nextIdx]}`;
      cycleEdges.add(edgeKey);
    }
  }

  // Transform nodes
  const nodes: CytoscapeNode[] = Object.entries(data.nodes).map(([filePath, nodeData]) => ({
    data: {
      id: filePath,
      label: filePath,
      dependencies: nodeData.dependencies,
      dependents: nodeData.dependents,
      inCycle: cycleNodeIds.has(filePath),
    },
  }));

  // Transform edges
  const edges: CytoscapeEdge[] = [];
  const seenEdges = new Set<string>();

  for (const [filePath, nodeData] of Object.entries(data.nodes)) {
    for (const dep of nodeData.dependencies) {
      const edgeId = `${filePath}->${dep}`;
      if (!seenEdges.has(edgeId)) {
        seenEdges.add(edgeId);
        edges.push({
          data: {
            id: edgeId,
            source: filePath,
            target: dep,
            inCycle: cycleEdges.has(edgeId),
          },
        });
      }
    }
  }

  return {
    elements: { nodes, edges },
    cycleNodeIds,
  };
}

/**
 * Check if a path matches a filter pattern
 * Supports simple glob-like patterns with * wildcards
 */
function matchesPattern(path: string, pattern: string): boolean {
  if (!pattern) return true;

  // Convert glob pattern to regex
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&') // Escape special chars except * and ?
    .replace(/\*/g, '.*') // * matches anything
    .replace(/\?/g, '.'); // ? matches single char

  try {
    const regex = new RegExp(regexPattern, 'i');
    return regex.test(path);
  } catch {
    // If regex is invalid, fall back to simple includes
    return path.toLowerCase().includes(pattern.toLowerCase());
  }
}

/**
 * Filter elements based on pattern and cycle settings
 */
function filterElements(
  elements: CytoscapeElements,
  filterPattern: string,
  showOnlyCycles: boolean,
  cycleNodeIds: Set<string>
): CytoscapeElements {
  // Filter nodes
  const filteredNodes = elements.nodes.filter((node) => {
    // Apply pattern filter
    if (filterPattern && !matchesPattern(node.data.label, filterPattern)) {
      return false;
    }
    // Apply cycle filter
    if (showOnlyCycles && !cycleNodeIds.has(node.data.id)) {
      return false;
    }
    return true;
  });

  // Get set of visible node IDs
  const visibleNodeIds = new Set(filteredNodes.map((n) => n.data.id));

  // Filter edges to only include those between visible nodes
  const filteredEdges = elements.edges.filter(
    (edge) => visibleNodeIds.has(edge.data.source) && visibleNodeIds.has(edge.data.target)
  );

  return {
    nodes: filteredNodes,
    edges: filteredEdges,
  };
}

/**
 * Custom hook to manage graph state
 * Accepts analysis JSON data and transforms it to Cytoscape format
 */
export function useGraphData(analysisData: AnalysisJSON | null): GraphDataState & GraphDataActions {
  // State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [filterPattern, setFilterPattern] = useState<string>('');
  const [showOnlyCycles, setShowOnlyCycles] = useState<boolean>(false);
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);

  // Transform data to Cytoscape format
  const { elements, cycleNodeIds } = useMemo(() => {
    if (!analysisData) {
      return {
        elements: { nodes: [], edges: [] },
        cycleNodeIds: new Set<string>(),
      };
    }
    return transformToCytoscape(analysisData);
  }, [analysisData]);

  // Filter elements based on current settings
  const filteredElements = useMemo(() => {
    return filterElements(elements, filterPattern, showOnlyCycles, cycleNodeIds);
  }, [elements, filterPattern, showOnlyCycles, cycleNodeIds]);

  // Get selected node data
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    const node = elements.nodes.find((n) => n.data.id === selectedNodeId);
    return node?.data ?? null;
  }, [selectedNodeId, elements.nodes]);

  // Calculate stats
  const stats = useMemo(() => ({
    nodes: filteredElements.nodes.length,
    edges: filteredElements.edges.length,
    cycles: analysisData?.cycles.length ?? 0,
  }), [filteredElements, analysisData]);

  // Actions
  const selectNode = useCallback((nodeId: string | null) => {
    setSelectedNodeId(nodeId);
  }, []);

  const highlightNode = useCallback((nodeId: string) => {
    setHighlightedNodeId(nodeId);
    // Also select the node for details view
    setSelectedNodeId(nodeId);
  }, []);

  const clearHighlights = useCallback(() => {
    setHighlightedNodeId(null);
  }, []);

  return {
    // State
    elements,
    filteredElements,
    selectedNode,
    filterPattern,
    showOnlyCycles,
    cycleNodeIds,
    highlightedNodeId,
    stats,
    // Actions
    selectNode,
    setFilterPattern,
    setShowOnlyCycles,
    highlightNode,
    clearHighlights,
  };
}

export default useGraphData;
