'use client';

import { ChangeEvent, useCallback } from 'react';

/**
 * Props for the ControlPanel component
 */
export interface ControlPanelProps {
  filterPattern: string;
  onFilterChange: (pattern: string) => void;
  showOnlyCycles: boolean;
  onShowOnlyCyclesChange: (show: boolean) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToScreen: () => void;
  stats: { nodes: number; edges: number; cycles: number };
}

/**
 * Control panel for the dependency graph visualization
 * Provides filtering, zoom controls, and statistics display
 */
export function ControlPanel({
  filterPattern,
  onFilterChange,
  showOnlyCycles,
  onShowOnlyCyclesChange,
  onZoomIn,
  onZoomOut,
  onFitToScreen,
  stats,
}: ControlPanelProps) {
  const handleFilterChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onFilterChange(e.target.value);
    },
    [onFilterChange]
  );

  const handleCyclesToggle = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onShowOnlyCyclesChange(e.target.checked);
    },
    [onShowOnlyCyclesChange]
  );

  return (
    <div style={styles.container}>
      {/* Filter Section */}
      <div style={styles.section}>
        <label style={styles.label} htmlFor="filter-input">
          Filter by path
        </label>
        <input
          id="filter-input"
          type="text"
          value={filterPattern}
          onChange={handleFilterChange}
          placeholder="e.g., src/components/*"
          style={styles.input}
        />
      </div>

      {/* Cycles Toggle */}
      <div style={styles.section}>
        <label style={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={showOnlyCycles}
            onChange={handleCyclesToggle}
            style={styles.checkbox}
          />
          <span>Show only cycles</span>
        </label>
      </div>

      {/* Zoom Controls */}
      <div style={styles.section}>
        <div style={styles.label}>Zoom</div>
        <div style={styles.zoomControls}>
          <button
            onClick={onZoomIn}
            style={styles.zoomButton}
            title="Zoom in"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            onClick={onZoomOut}
            style={styles.zoomButton}
            title="Zoom out"
            aria-label="Zoom out"
          >
            -
          </button>
          <button
            onClick={onFitToScreen}
            style={styles.fitButton}
            title="Fit to screen"
            aria-label="Fit to screen"
          >
            Fit
          </button>
        </div>
      </div>

      {/* Stats Display */}
      <div style={styles.statsSection}>
        <div style={styles.statsTitle}>Statistics</div>
        <div style={styles.statsGrid}>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.nodes}</span>
            <span style={styles.statLabel}>Nodes</span>
          </div>
          <div style={styles.statItem}>
            <span style={styles.statValue}>{stats.edges}</span>
            <span style={styles.statLabel}>Edges</span>
          </div>
          <div style={styles.statItem}>
            <span
              style={{
                ...styles.statValue,
                ...(stats.cycles > 0 ? styles.cycleWarning : {}),
              }}
            >
              {stats.cycles}
            </span>
            <span style={styles.statLabel}>Cycles</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    padding: '1rem',
    background: '#18181b',
    borderRadius: '8px',
    border: '1px solid #27272a',
    minWidth: '200px',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
  },
  label: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  input: {
    padding: '0.5rem 0.75rem',
    fontSize: '0.875rem',
    background: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    color: '#fafafa',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.5rem',
    fontSize: '0.875rem',
    color: '#fafafa',
    cursor: 'pointer',
  },
  checkbox: {
    width: '1rem',
    height: '1rem',
    accentColor: '#3b82f6',
    cursor: 'pointer',
  },
  zoomControls: {
    display: 'flex',
    gap: '0.5rem',
  },
  zoomButton: {
    width: '2rem',
    height: '2rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.25rem',
    fontWeight: 600,
    background: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    color: '#fafafa',
    cursor: 'pointer',
    transition: 'background-color 0.2s, border-color 0.2s',
  },
  fitButton: {
    flex: 1,
    padding: '0.5rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    background: '#27272a',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    color: '#fafafa',
    cursor: 'pointer',
    transition: 'background-color 0.2s, border-color 0.2s',
  },
  statsSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    paddingTop: '0.5rem',
    borderTop: '1px solid #27272a',
  },
  statsTitle: {
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#a1a1aa',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '0.5rem',
  },
  statItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.25rem',
    padding: '0.5rem',
    background: '#27272a',
    borderRadius: '6px',
  },
  statValue: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#fafafa',
  },
  statLabel: {
    fontSize: '0.625rem',
    color: '#71717a',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  cycleWarning: {
    color: '#f87171',
  },
};

export default ControlPanel;
