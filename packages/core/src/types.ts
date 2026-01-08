/**
 * Types for CodeCanvas dependency analysis
 */

/**
 * Type of import/require statement
 */
export type ImportType = 'esm' | 'cjs';

/**
 * Information about a single import statement extracted from a file
 */
export interface ImportInfo {
  /** The module specifier (path or package name) */
  source: string;
  /** Named imports, default import, or namespace imports */
  specifiers: string[];
  /** Whether this is an ES module import or CommonJS require */
  type: ImportType;
  /** Line number where the import appears (1-indexed) */
  line?: number;
}

/**
 * Result of parsing a single file
 */
export interface ParsedFile {
  /** Absolute path to the file */
  filePath: string;
  /** All imports found in the file */
  imports: ImportInfo[];
  /** Any errors encountered during parsing */
  errors?: string[];
}

/**
 * A node in the dependency graph
 */
export interface DependencyNode {
  /** Absolute path to the file */
  filePath: string;
  /** Files this file imports */
  dependencies: string[];
  /** Files that import this file */
  dependents: string[];
}

/**
 * A circular dependency chain
 */
export interface CircularDependency {
  /** Files involved in the cycle, in order (e.g., A → B → C → A) */
  chain: string[];
  /** Length of the cycle (number of files involved) */
  length: number;
}

/**
 * An edge in the dependency graph
 */
export interface DependencyEdge {
  /** Source file (the file that imports) */
  from: string;
  /** Target file (the file being imported) */
  to: string;
}

/**
 * Complete dependency graph data for a project (serializable format)
 */
export interface DependencyGraphData {
  /** All nodes in the graph, keyed by file path */
  nodes: Map<string, DependencyNode>;
  /** All detected circular dependencies */
  cycles: CircularDependency[];
  /** Root directory of the analyzed project */
  rootDir: string;
}

/**
 * Options for the parser
 */
export interface ParserOptions {
  /** File extensions to parse (default: ['.ts', '.tsx', '.js', '.jsx']) */
  extensions?: string[];
  /** Directories to ignore (default: ['node_modules', 'dist', 'build']) */
  ignoreDirs?: string[];
  /** Whether to follow symlinks (default: false) */
  followSymlinks?: boolean;
}

/**
 * Options for the analyzer
 */
export interface AnalyzerOptions {
  /** File extensions to analyze (default: ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']) */
  extensions?: string[];
  /** Directories to ignore (default: ['node_modules', 'dist', 'build', '.git']) */
  ignoreDirs?: string[];
  /** Glob patterns to ignore */
  ignorePatterns?: string[];
  /** Whether to follow symlinks (default: false) */
  followSymlinks?: boolean;
  /** Base URL for path resolution (from tsconfig) */
  baseUrl?: string;
  /** Path aliases for resolution (from tsconfig) */
  pathAliases?: Record<string, string[]>;
}

/**
 * Statistics about the analyzed codebase
 */
export interface AnalysisStats {
  /** Total number of files analyzed */
  totalFiles: number;
  /** Total number of dependencies (edges) */
  totalDependencies: number;
  /** Number of circular dependencies found */
  circularDependencies: number;
  /** Files with the most dependencies */
  topDependencies: { file: string; count: number }[];
  /** Files with the most dependents */
  topDependents: { file: string; count: number }[];
  /** Analysis duration in milliseconds */
  duration: number;
}

/**
 * Result of analyzing a directory
 */
export interface AnalysisResult {
  /** The dependency graph */
  graph: DependencyGraphData;
  /** All circular dependencies found */
  cycles: CircularDependency[];
  /** Statistics about the analysis */
  stats: AnalysisStats;
  /** Any errors encountered during analysis */
  errors: { file: string; error: string }[];
  /** Root directory that was analyzed */
  rootDir: string;
}

/**
 * Supported file types for parsing
 */
export type SupportedLanguage = 'typescript' | 'javascript' | 'tsx' | 'jsx';

/**
 * Maps file extensions to their language type
 */
export const extensionToLanguage: Record<string, SupportedLanguage> = {
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.mts': 'typescript',
  '.cts': 'typescript',
};

/**
 * Default file extensions to analyze
 */
export const DEFAULT_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];

/**
 * Default directories to ignore
 */
export const DEFAULT_IGNORE_DIRS = ['node_modules', 'dist', 'build', '.git', 'coverage', '.next', '.nuxt'];
