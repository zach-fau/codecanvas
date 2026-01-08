/**
 * @codecanvas/core
 *
 * Core parsing and graph logic for CodeCanvas circular dependency detection.
 * Uses tree-sitter for accurate parsing of TypeScript and JavaScript files.
 */

// Re-export all types
export type {
  ImportType,
  ImportInfo,
  ParsedFile,
  DependencyNode,
  DependencyEdge,
  CircularDependency,
  DependencyGraphData,
  ParserOptions,
  AnalyzerOptions,
  AnalysisResult,
  AnalysisStats,
  SupportedLanguage,
} from './types.js';

export {
  extensionToLanguage,
  DEFAULT_EXTENSIONS,
  DEFAULT_IGNORE_DIRS,
} from './types.js';

// Re-export parser functions
export {
  initParser,
  parseFile,
  parseSource,
  getLanguageForFile,
  isSupportedFile,
} from './parser.js';

// Re-export graph class
export { DependencyGraph } from './graph.js';

// Re-export cycle detection functions
export {
  findCycles,
  findStronglyConnectedComponents,
  findAllSimpleCycles,
  findCyclesInvolvingFile,
  findLongestCycle,
  hasCycles,
} from './cycles.js';

// Re-export analyzer functions
export {
  analyzeDirectory,
  analyzeFile,
  hasCircularDependencies,
} from './analyzer.js';
