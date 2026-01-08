'use client';

import { useEffect, useRef, useCallback, useMemo } from 'react';
import cytoscape, { Core, ElementDefinition, StylesheetStyle } from 'cytoscape';

// Cytoscape fcose layout extension
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let fcoseRegistered = false;

// Dynamic import and registration of fcose to handle SSR
const registerFcose = async () => {
  if (fcoseRegistered || typeof window === 'undefined') return;
  const fcose = (await import('cytoscape-fcose')).default;
  cytoscape.use(fcose);
  fcoseRegistered = true;
};

export interface GraphNode {
  id: string;
  label: string;
  inCycle?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  inCycle?: boolean;
}

export interface DependencyGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selectedNode?: string | null;
  onNodeClick?: (nodeId: string) => void;
  highlightedNodes?: Set<string>;
  filterPattern?: string;
}

// Color constants matching the project's dark theme
const COLORS = {
  normal: '#3b82f6',      // Blue for normal nodes
  cycle: '#ef4444',       // Red for cycle nodes
  edge: '#52525b',        // Gray for edges
  cycleEdge: '#ef4444',   // Red for cycle edges
  selected: '#f59e0b',    // Amber for selected
  highlighted: '#22c55e', // Green for highlighted
  background: '#18181b',  // Surface background
  text: '#ededed',        // Foreground text
};

// Stylesheet for Cytoscape
const createStylesheet = (): StylesheetStyle[] => [
  {
    selector: 'node',
    style: {
      'background-color': COLORS.normal,
      'label': 'data(label)',
      'color': COLORS.text,
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 8,
      'font-size': 11,
      'font-family': 'system-ui, -apple-system, sans-serif',
      'width': 24,
      'height': 24,
      'border-width': 2,
      'border-color': COLORS.normal,
      'text-outline-color': COLORS.background,
      'text-outline-width': 2,
      'text-max-width': '120px',
      'text-wrap': 'ellipsis',
    },
  },
  {
    selector: 'node[?inCycle]',
    style: {
      'background-color': COLORS.cycle,
      'border-color': COLORS.cycle,
    },
  },
  {
    selector: 'node.highlighted',
    style: {
      'border-width': 4,
      'border-color': COLORS.highlighted,
      'box-shadow': `0 0 10px ${COLORS.highlighted}`,
      'width': 32,
      'height': 32,
    } as cytoscape.Css.Node,
  },
  {
    selector: 'node.selected',
    style: {
      'border-width': 4,
      'border-color': COLORS.selected,
      'width': 36,
      'height': 36,
    },
  },
  {
    selector: 'node.dimmed',
    style: {
      'opacity': 0.2,
    },
  },
  {
    selector: 'edge',
    style: {
      'width': 1.5,
      'line-color': COLORS.edge,
      'target-arrow-color': COLORS.edge,
      'target-arrow-shape': 'triangle',
      'curve-style': 'bezier',
      'arrow-scale': 0.8,
    },
  },
  {
    selector: 'edge[?inCycle]',
    style: {
      'line-color': COLORS.cycleEdge,
      'target-arrow-color': COLORS.cycleEdge,
      'width': 2.5,
    },
  },
  {
    selector: 'edge.dimmed',
    style: {
      'opacity': 0.15,
    },
  },
];

export function DependencyGraph({
  nodes,
  edges,
  selectedNode,
  onNodeClick,
  highlightedNodes,
  filterPattern,
}: DependencyGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);

  // Build Cytoscape elements from props
  const elements = useMemo((): ElementDefinition[] => {
    const nodeElements: ElementDefinition[] = nodes.map((node) => ({
      group: 'nodes' as const,
      data: {
        id: node.id,
        label: node.label,
        inCycle: node.inCycle || false,
      },
    }));

    const edgeElements: ElementDefinition[] = edges.map((edge, index) => ({
      group: 'edges' as const,
      data: {
        id: `edge-${edge.source}-${edge.target}-${index}`,
        source: edge.source,
        target: edge.target,
        inCycle: edge.inCycle || false,
      },
    }));

    return [...nodeElements, ...edgeElements];
  }, [nodes, edges]);

  // Apply filter pattern to nodes
  const applyFilter = useCallback((cy: Core, pattern?: string) => {
    if (!pattern) {
      // Show all nodes
      cy.elements().removeClass('dimmed');
      return;
    }

    try {
      const regex = new RegExp(pattern, 'i');
      cy.nodes().forEach((node) => {
        const label = node.data('label') as string;
        const matches = regex.test(label);
        if (matches) {
          node.removeClass('dimmed');
          // Also show connected edges
          node.connectedEdges().removeClass('dimmed');
        } else {
          node.addClass('dimmed');
        }
      });
      // Dim edges where both ends are dimmed
      cy.edges().forEach((edge) => {
        const source = edge.source();
        const target = edge.target();
        if (source.hasClass('dimmed') && target.hasClass('dimmed')) {
          edge.addClass('dimmed');
        }
      });
    } catch {
      // Invalid regex, show all
      cy.elements().removeClass('dimmed');
    }
  }, []);

  // Apply highlighted nodes
  const applyHighlights = useCallback((cy: Core, highlighted?: Set<string>) => {
    cy.nodes().removeClass('highlighted');
    if (highlighted && highlighted.size > 0) {
      highlighted.forEach((nodeId) => {
        cy.$id(nodeId).addClass('highlighted');
      });
    }
  }, []);

  // Apply selected node
  const applySelection = useCallback((cy: Core, selected?: string | null) => {
    cy.nodes().removeClass('selected');
    if (selected) {
      cy.$id(selected).addClass('selected');
    }
  }, []);

  // Initialize Cytoscape
  useEffect(() => {
    if (!containerRef.current) return;

    let cy: Core | null = null;

    const initCytoscape = async () => {
      // Register fcose layout extension
      await registerFcose();

      if (!containerRef.current) return;

      cy = cytoscape({
        container: containerRef.current,
        elements,
        style: createStylesheet(),
        layout: {
          name: 'fcose',
          animate: true,
          animationDuration: 500,
          fit: true,
          padding: 50,
          nodeDimensionsIncludeLabels: true,
          // fcose-specific options for better layout
          quality: 'default',
          randomize: true,
          nodeRepulsion: 4500,
          idealEdgeLength: 80,
          edgeElasticity: 0.45,
          nestingFactor: 0.1,
          gravity: 0.25,
          numIter: 2500,
          tile: true,
          tilingPaddingVertical: 10,
          tilingPaddingHorizontal: 10,
          gravityRangeCompound: 1.5,
          gravityCompound: 1.0,
          gravityRange: 3.8,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        // Performance optimizations
        minZoom: 0.1,
        maxZoom: 3,
        wheelSensitivity: 0.3,
        // Enable WebGL renderer hints
        textureOnViewport: true,
        hideEdgesOnViewport: true,
        hideLabelsOnViewport: true,
      });

      // Set up click handler
      cy.on('tap', 'node', (event) => {
        const nodeId = event.target.id();
        onNodeClick?.(nodeId);
      });

      // Apply initial state
      applyFilter(cy, filterPattern);
      applyHighlights(cy, highlightedNodes);
      applySelection(cy, selectedNode);

      cyRef.current = cy;
    };

    initCytoscape();

    return () => {
      if (cy) {
        cy.destroy();
      }
      cyRef.current = null;
    };
  }, [elements, onNodeClick, applyFilter, applyHighlights, applySelection, filterPattern, highlightedNodes, selectedNode]);

  // Update filter when pattern changes
  useEffect(() => {
    if (cyRef.current) {
      applyFilter(cyRef.current, filterPattern);
    }
  }, [filterPattern, applyFilter]);

  // Update highlights when highlightedNodes changes
  useEffect(() => {
    if (cyRef.current) {
      applyHighlights(cyRef.current, highlightedNodes);
    }
  }, [highlightedNodes, applyHighlights]);

  // Update selection when selectedNode changes
  useEffect(() => {
    if (cyRef.current) {
      applySelection(cyRef.current, selectedNode);
      // Optionally center on selected node
      if (selectedNode) {
        const node = cyRef.current.$id(selectedNode);
        if (node.length > 0) {
          cyRef.current.animate({
            center: { eles: node },
            duration: 300,
          });
        }
      }
    }
  }, [selectedNode, applySelection]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        backgroundColor: COLORS.background,
        borderRadius: '8px',
        overflow: 'hidden',
      }}
      aria-label="Dependency graph visualization"
      role="img"
    />
  );
}

export default DependencyGraph;
