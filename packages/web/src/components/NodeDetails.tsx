'use client';

import { useCallback } from 'react';

/**
 * Props for the NodeDetails component
 */
export interface NodeDetailsProps {
  node: {
    id: string;
    label: string;
    dependencies: string[];
    dependents: string[];
    inCycle: boolean;
  } | null;
  onClose: () => void;
  onNavigateToNode: (nodeId: string) => void;
}

/**
 * Slide-in panel showing details for a selected node
 * Displays file path, dependencies, dependents, and cycle status
 */
export function NodeDetails({ node, onClose, onNavigateToNode }: NodeDetailsProps) {
  const handleDependencyClick = useCallback(
    (nodeId: string) => {
      onNavigateToNode(nodeId);
    },
    [onNavigateToNode]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    },
    [onClose]
  );

  // Extract just the filename from the full path for display
  const getFileName = (path: string): string => {
    const parts = path.split('/');
    return parts[parts.length - 1] || path;
  };

  // Don't render if no node is selected
  if (!node) {
    return null;
  }

  return (
    <div
      style={styles.overlay}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="node-details-title"
    >
      <div
        style={styles.panel}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerContent}>
            <h2 id="node-details-title" style={styles.title}>
              {getFileName(node.label)}
            </h2>
            {node.inCycle && (
              <span style={styles.cycleBadge} title="This file is part of a circular dependency">
                In Cycle
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={styles.closeButton}
            aria-label="Close panel"
            title="Close"
          >
            ×
          </button>
        </div>

        {/* File Path */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>File Path</div>
          <code style={styles.filePath}>{node.label}</code>
        </div>

        {/* Dependencies (Imports) */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            Imports ({node.dependencies.length})
          </div>
          {node.dependencies.length > 0 ? (
            <ul style={styles.list}>
              {node.dependencies.map((dep) => (
                <li key={dep} style={styles.listItem}>
                  <button
                    onClick={() => handleDependencyClick(dep)}
                    style={styles.linkButton}
                    title={`Navigate to ${dep}`}
                  >
                    <span style={styles.arrow}>→</span>
                    <span style={styles.fileName}>{getFileName(dep)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div style={styles.emptyText}>No imports</div>
          )}
        </div>

        {/* Dependents (Imported By) */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            Imported By ({node.dependents.length})
          </div>
          {node.dependents.length > 0 ? (
            <ul style={styles.list}>
              {node.dependents.map((dep) => (
                <li key={dep} style={styles.listItem}>
                  <button
                    onClick={() => handleDependencyClick(dep)}
                    style={styles.linkButton}
                    title={`Navigate to ${dep}`}
                  >
                    <span style={styles.arrow}>←</span>
                    <span style={styles.fileName}>{getFileName(dep)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div style={styles.emptyText}>Not imported by any file</div>
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    background: 'rgba(0, 0, 0, 0.3)',
    display: 'flex',
    justifyContent: 'flex-end',
    zIndex: 1000,
  },
  panel: {
    width: '100%',
    maxWidth: '400px',
    height: '100%',
    background: '#18181b',
    borderLeft: '1px solid #27272a',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    animation: 'slideIn 0.2s ease-out',
  },
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: '1.25rem',
    borderBottom: '1px solid #27272a',
    gap: '1rem',
  },
  headerContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    minWidth: 0,
    flex: 1,
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: 600,
    color: '#fafafa',
    margin: 0,
    wordBreak: 'break-word',
  },
  cycleBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    background: 'rgba(248, 113, 113, 0.15)',
    color: '#f87171',
    borderRadius: '4px',
    border: '1px solid rgba(248, 113, 113, 0.3)',
    alignSelf: 'flex-start',
  },
  closeButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '2rem',
    height: '2rem',
    fontSize: '1.5rem',
    fontWeight: 300,
    background: 'transparent',
    border: 'none',
    borderRadius: '6px',
    color: '#71717a',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background-color 0.2s, color 0.2s',
  },
  section: {
    padding: '1rem 1.25rem',
    borderBottom: '1px solid #27272a',
  },
  sectionTitle: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: '0.75rem',
  },
  filePath: {
    display: 'block',
    padding: '0.5rem 0.75rem',
    fontSize: '0.75rem',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    background: '#27272a',
    borderRadius: '6px',
    color: '#a1a1aa',
    wordBreak: 'break-all',
    overflowWrap: 'anywhere',
  },
  list: {
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
    maxHeight: '200px',
    overflowY: 'auto',
  },
  listItem: {
    margin: 0,
  },
  linkButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    width: '100%',
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    background: '#27272a',
    border: '1px solid transparent',
    borderRadius: '6px',
    color: '#3b82f6',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'background-color 0.2s, border-color 0.2s',
  },
  arrow: {
    fontSize: '0.75rem',
    color: '#71717a',
    flexShrink: 0,
  },
  fileName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  emptyText: {
    fontSize: '0.875rem',
    color: '#52525b',
    fontStyle: 'italic',
  },
};

export default NodeDetails;
