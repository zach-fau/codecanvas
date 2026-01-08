export default function Home() {
  return (
    <main style={styles.main}>
      <header style={styles.header}>
        <h1 style={styles.title}>CodeCanvas</h1>
        <p style={styles.subtitle}>Circular Dependency Detector</p>
      </header>

      <section style={styles.graphSection}>
        <div style={styles.graphPlaceholder}>
          <div style={styles.placeholderIcon}>◉</div>
          <p style={styles.placeholderText}>Dependency graph visualization will appear here</p>
          <p style={styles.placeholderHint}>
            Run <code style={styles.code}>codecanvas analyze .</code> to generate graph data
          </p>
        </div>
      </section>

      <section style={styles.instructions}>
        <h2 style={styles.sectionTitle}>Getting Started</h2>
        <ol style={styles.stepsList}>
          <li>Install CodeCanvas CLI: <code style={styles.code}>pnpm add -g @codecanvas/cli</code></li>
          <li>Analyze your project: <code style={styles.code}>codecanvas analyze /path/to/project</code></li>
          <li>View the results in this visualization</li>
        </ol>
      </section>
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
  graphSection: {
    width: '100%',
    maxWidth: '1200px',
    flex: 1,
    minHeight: '400px',
  },
  graphPlaceholder: {
    width: '100%',
    height: '100%',
    minHeight: '400px',
    border: '2px dashed #27272a',
    borderRadius: '12px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '1rem',
    background: '#18181b',
  },
  placeholderIcon: {
    fontSize: '3rem',
    color: '#3b82f6',
    opacity: 0.5,
  },
  placeholderText: {
    fontSize: '1.125rem',
    color: '#71717a',
  },
  placeholderHint: {
    fontSize: '0.875rem',
    color: '#52525b',
  },
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    background: '#27272a',
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    fontSize: '0.875em',
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
  },
  stepsList: {
    paddingLeft: '1.5rem',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
    color: '#a1a1aa',
  },
};
