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
  /** Files involved in the cycle, in order */
  chain: string[];
  /** Length of the cycle */
  length: number;
}

/**
 * Complete dependency graph for a project
 */
export interface DependencyGraph {
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
