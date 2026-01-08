'use client';

import { useState, useCallback, useRef } from 'react';
import { DependencyGraph, ControlPanel, NodeDetails } from '../components';
import { useGraphData, AnalysisJSON } from '../hooks/useGraphData';

// Sample data for demonstration
const SAMPLE_DATA: AnalysisJSON = {
  rootDir: '/project',
  nodes: {
    'src/index.ts': {
      filePath: 'src/index.ts',
      dependencies: ['src/app.ts', 'src/utils/helpers.ts'],
      dependents: [],
    },
    'src/app.ts': {
      filePath: 'src/app.ts',
      dependencies: ['src/components/Button.tsx', 'src/services/api.ts'],
      dependents: ['src/index.ts'],
    },
    'src/utils/helpers.ts': {
      filePath: 'src/utils/helpers.ts',
      dependencies: ['src/utils/constants.ts'],
      dependents: ['src/index.ts', 'src/components/Button.tsx'],
    },
    'src/utils/constants.ts': {
      filePath: 'src/utils/constants.ts',
      dependencies: [],
      dependents: ['src/utils/helpers.ts'],
    },
    'src/components/Button.tsx': {
      filePath: 'src/components/Button.tsx',
      dependencies: ['src/utils/helpers.ts', 'src/services/api.ts'],
      dependents: ['src/app.ts'],
    },
    'src/services/api.ts': {
      filePath: 'src/services/api.ts',
      dependencies: ['src/services/auth.ts'],
      dependents: ['src/app.ts', 'src/components/Button.tsx'],
    },
    'src/services/auth.ts': {
      filePath: 'src/services/auth.ts',
      dependencies: ['src/services/api.ts'], // Circular!
      dependents: ['src/services/api.ts'],
    },
  },
  cycles: [
    {
      chain: ['src/services/api.ts', 'src/services/auth.ts', 'src/services/api.ts'],
      length: 2,
    },
  ],
  stats: {
    totalFiles: 7,
    totalDependencies: 9,
    circularDependencies: 1,
  },
};

export default function Home() {
  const [analysisData, setAnalysisData] = useState<AnalysisJSON | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const graphRef = useRef<{ zoomIn: () => void; zoomOut: () => void; fit: () => void } | null>(null);

  // Graph data hook
  const {
    filteredElements,
    selectedNode,
    filterPattern,
    showOnlyCycles,
    stats,
    selectNode,
    setFilterPattern,
    setShowOnlyCycles,
    highlightNode,
  } = useGraphData(analysisData);

  // Transform filtered elements to the format DependencyGraph expects
  const nodes = filteredElements.nodes.map((n) => ({
    id: n.data.id,
    label: n.data.label,
    inCycle: n.data.inCycle,
  }));

  const edges = filteredElements.edges.map((e) => ({
    source: e.data.source,
    target: e.data.target,
    inCycle: e.data.inCycle,
  }));

  // Handle file upload
  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        setAnalysisData(json);
      } catch (err) {
        console.error('Failed to parse JSON:', err);
        alert('Invalid JSON file. Please upload a valid CodeCanvas analysis output.');
      } finally {
        setIsLoading(false);
      }
    };
    reader.readAsText(file);
  }, []);

  // Load sample data
  const handleLoadSample = useCallback(() => {
    setAnalysisData(SAMPLE_DATA);
  }, []);

  // Node click handler
  const handleNodeClick = useCallback((nodeId: string) => {
    selectNode(nodeId);
  }, [selectNode]);

  // Close node details
  const handleCloseDetails = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  // Navigate to node from details panel
  const handleNavigateToNode = useCallback((nodeId: string) => {
    highlightNode(nodeId);
  }, [highlightNode]);

  // Zoom controls (placeholder - need to expose from DependencyGraph)
  const handleZoomIn = useCallback(() => {
    graphRef.current?.zoomIn();
  }, []);

  const handleZoomOut = useCallback(() => {
    graphRef.current?.zoomOut();
  }, []);

  const handleFitToScreen = useCallback(() => {
    graphRef.current?.fit();
  }, []);

  // Show upload UI if no data loaded
  if (!analysisData) {
    return (
      <main style={styles.main}>
        <header style={styles.header}>
          <h1 style={styles.title}>CodeCanvas</h1>
          <p style={styles.subtitle}>Circular Dependency Detector</p>
        </header>

        <section style={styles.uploadSection}>
          <div style={styles.uploadCard}>
            <div style={styles.uploadIcon}>📊</div>
            <h2 style={styles.uploadTitle}>Load Analysis Data</h2>
            <p style={styles.uploadDescription}>
              Upload a JSON file from <code style={styles.code}>codecanvas analyze --output json</code>
            </p>

            <div style={styles.uploadActions}>
              <label style={styles.uploadButton}>
                {isLoading ? 'Loading...' : 'Upload JSON File'}
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                  disabled={isLoading}
                />
              </label>

              <span style={styles.orDivider}>or</span>

              <button onClick={handleLoadSample} style={styles.sampleButton}>
                Load Sample Data
              </button>
            </div>
          </div>
        </section>

        <section style={styles.instructions}>
          <h2 style={styles.sectionTitle}>Getting Started</h2>
          <ol style={styles.stepsList}>
            <li>Install CodeCanvas CLI: <code style={styles.code}>pnpm add -g @codecanvas/cli</code></li>
            <li>Analyze your project: <code style={styles.code}>codecanvas analyze /path/to/project --output json &gt; analysis.json</code></li>
            <li>Upload the JSON file above to visualize</li>
          </ol>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.appContainer}>
      {/* Header */}
      <header style={styles.appHeader}>
        <div style={styles.appHeaderLeft}>
          <h1 style={styles.appTitle}>CodeCanvas</h1>
          <button onClick={() => setAnalysisData(null)} style={styles.newAnalysisButton}>
            New Analysis
          </button>
        </div>
      </header>

      {/* Main content */}
      <div style={styles.appContent}>
        {/* Left sidebar - Controls */}
        <aside style={styles.sidebar}>
          <ControlPanel
            filterPattern={filterPattern}
            onFilterChange={setFilterPattern}
            showOnlyCycles={showOnlyCycles}
            onShowOnlyCyclesChange={setShowOnlyCycles}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onFitToScreen={handleFitToScreen}
            stats={stats}
          />
        </aside>

        {/* Graph visualization */}
        <div style={styles.graphContainer}>
          <DependencyGraph
            nodes={nodes}
            edges={edges}
            selectedNode={selectedNode?.id ?? null}
            onNodeClick={handleNodeClick}
            filterPattern={filterPattern}
          />
        </div>
      </div>

      {/* Node details panel */}
      <NodeDetails
        node={selectedNode}
        onClose={handleCloseDetails}
        onNavigateToNode={handleNavigateToNode}
      />
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    padding: '2rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2rem',
  },
  header: {
    textAlign: 'center',
    marginBottom: '1rem',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 700,
    marginBottom: '0.5rem',
    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
  },
  subtitle: {
    fontSize: '1.25rem',
    color: '#71717a',
  },
  uploadSection: {
    width: '100%',
    maxWidth: '500px',
  },
  uploadCard: {
    padding: '2rem',
    background: '#18181b',
    borderRadius: '12px',
    border: '1px solid #27272a',
    textAlign: 'center',
  },
  uploadIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  uploadTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    marginBottom: '0.5rem',
    color: '#fafafa',
  },
  uploadDescription: {
    fontSize: '0.875rem',
    color: '#71717a',
    marginBottom: '1.5rem',
  },
  uploadActions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.75rem',
  },
  uploadButton: {
    padding: '0.75rem 1.5rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    background: '#3b82f6',
    border: 'none',
    borderRadius: '8px',
    color: '#ffffff',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  orDivider: {
    fontSize: '0.75rem',
    color: '#52525b',
    textTransform: 'uppercase',
  },
  sampleButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    fontWeight: 500,
    background: 'transparent',
    border: '1px solid #3f3f46',
    borderRadius: '8px',
    color: '#a1a1aa',
    cursor: 'pointer',
    transition: 'border-color 0.2s, color 0.2s',
  },
  instructions: {
    width: '100%',
    maxWidth: '600px',
    padding: '1.5rem',
    background: '#18181b',
    borderRadius: '12px',
    border: '1px solid #27272a',
  },
  sectionTitle: {
    fontSize: '1.25rem',
    fontWeight: 600,
    marginBottom: '1rem',
    color: '#fafafa',
  },
  stepsList: {
    paddingLeft: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    color: '#a1a1aa',
  },
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    background: '#27272a',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.875em',
  },
  // App layout styles (when data is loaded)
  appContainer: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
  },
  appHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    borderBottom: '1px solid #27272a',
    background: '#18181b',
  },
  appHeaderLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  appTitle: {
    fontSize: '1.25rem',
    fontWeight: 700,
    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    margin: 0,
  },
  newAnalysisButton: {
    padding: '0.375rem 0.75rem',
    fontSize: '0.75rem',
    fontWeight: 500,
    background: 'transparent',
    border: '1px solid #3f3f46',
    borderRadius: '6px',
    color: '#a1a1aa',
    cursor: 'pointer',
    transition: 'border-color 0.2s, color 0.2s',
  },
  appContent: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  sidebar: {
    width: '240px',
    flexShrink: 0,
    padding: '1rem',
    borderRight: '1px solid #27272a',
    overflowY: 'auto',
  },
  graphContainer: {
    flex: 1,
    padding: '1rem',
    overflow: 'hidden',
  },
};
