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
  CircularDependency,
  DependencyGraph,
  ParserOptions,
  SupportedLanguage,
} from './types.js';

export { extensionToLanguage } from './types.js';

// Re-export parser functions
export {
  initParser,
  parseFile,
  parseSource,
  getLanguageForFile,
  isSupportedFile,
} from './parser.js';
