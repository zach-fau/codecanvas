/**
 * Directory analyzer for building dependency graphs from codebases
 *
 * Performance optimizations:
 * - Batched parallel file parsing (configurable concurrency)
 * - Content-based caching for repeated analyses
 * - Concurrent directory discovery
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type {
  AnalyzerOptions,
  AnalysisResult,
  AnalysisStats,
  ImportInfo,
} from './types.js';
import { DEFAULT_EXTENSIONS, DEFAULT_IGNORE_DIRS } from './types.js';
import { DependencyGraph } from './graph.js';
import { parseFile, isSupportedFile, initParser, getLanguageForFile, parseSource } from './parser.js';
import { findCycles } from './cycles.js';
import { ParseCache, globalParseCache } from './cache.js';

/** Default concurrency for parallel file parsing */
const DEFAULT_CONCURRENCY = 50;

/**
 * Analyze a directory and build a dependency graph.
 *
 * @param dirPath - Path to the directory to analyze
 * @param options - Analyzer options
 * @returns Analysis result with graph, cycles, and stats
 */
export async function analyzeDirectory(
  dirPath: string,
  options: AnalyzerOptions = {}
): Promise<AnalysisResult> {
  const startTime = Date.now();

  // Resolve to absolute path
  const rootDir = path.resolve(dirPath);

  // Merge options with defaults
  const extensions = options.extensions || DEFAULT_EXTENSIONS;
  const ignoreDirs = options.ignoreDirs || DEFAULT_IGNORE_DIRS;
  const ignorePatterns = options.ignorePatterns || [];
  const onProgress = options.onProgress;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;
  const enableCache = options.enableCache ?? true;

  // Use global cache or create a new one
  const cache = enableCache ? globalParseCache : new ParseCache();

  // Notify progress: discovering files
  onProgress?.({ phase: 'discovering' });

  // Discover all files (with concurrent directory reads)
  const files = await discoverFilesConcurrent(rootDir, extensions, ignoreDirs, ignorePatterns);

  // Build the graph
  const graph = new DependencyGraph(rootDir);
  const errors: { file: string; error: string }[] = [];
  const totalFiles = files.length;

  // Pre-initialize the parser (one-time cost)
  initParser();

  // Add all nodes first
  for (const file of files) {
    graph.addNode(file);
  }

  // Parse files in parallel batches
  let processedCount = 0;

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, Math.min(i + concurrency, files.length));

    // Parse all files in this batch concurrently
    const batchResults = await Promise.all(
      batch.map(async (file) => {
        try {
          const imports = await parseFileWithCache(file, cache, enableCache);
          return { file, imports, error: null };
        } catch (err) {
          return {
            file,
            imports: [] as ImportInfo[],
            error: err instanceof Error ? err.message : String(err)
          };
        }
      })
    );

    // Process results and add edges
    for (const result of batchResults) {
      if (result.error) {
        errors.push({ file: result.file, error: result.error });
      }

      // Resolve each import to an actual file path
      for (const importInfo of result.imports) {
        const resolvedPath = await resolveImport(
          result.file,
          importInfo.source,
          rootDir,
          extensions,
          options
        );

        if (resolvedPath) {
          graph.addEdge(result.file, resolvedPath);
        }
      }
    }

    // Update progress
    processedCount = Math.min(i + concurrency, files.length);
    onProgress?.({
      phase: 'parsing',
      current: processedCount,
      total: totalFiles,
    });
  }

  // Notify progress: analyzing graph
  onProgress?.({ phase: 'analyzing' });

  // Find cycles
  const cycles = findCycles(graph);

  // Calculate stats
  const duration = Date.now() - startTime;
  const stats: AnalysisStats = {
    totalFiles: graph.nodeCount,
    totalDependencies: graph.edgeCount,
    circularDependencies: cycles.length,
    topDependencies: graph.getTopDependencies(10),
    topDependents: graph.getTopDependents(10),
    duration,
  };

  return {
    graph: graph.toData(),
    cycles,
    stats,
    errors,
    rootDir,
  };
}

/**
 * Parse a file with caching support
 */
async function parseFileWithCache(
  filePath: string,
  cache: ParseCache,
  enableCache: boolean
): Promise<ImportInfo[]> {
  // Read file content
  const content = await fs.readFile(filePath, 'utf-8');

  if (enableCache) {
    // Check cache with content hash
    const hash = cache.getHash(content);
    const cached = cache.get(filePath, hash);

    if (cached !== null) {
      return cached;
    }

    // Parse and cache
    const imports = parseFileContent(filePath, content);
    cache.set(filePath, hash, imports);
    return imports;
  }

  // Direct parse without caching
  return parseFileContent(filePath, content);
}

/**
 * Parse file content directly (used internally to avoid double file reads)
 */
function parseFileContent(filePath: string, content: string): ImportInfo[] {
  const language = getLanguageForFile(filePath);
  if (!language) {
    throw new Error(`Unsupported file type: ${path.extname(filePath)}`);
  }
  return parseSource(content, language);
}

/**
 * Recursively discover all supported files in a directory with concurrent reads
 */
async function discoverFilesConcurrent(
  dirPath: string,
  extensions: string[],
  ignoreDirs: string[],
  ignorePatterns: string[]
): Promise<string[]> {
  const files: string[] = [];
  const ignoreDirsSet = new Set(ignoreDirs);

  async function walkConcurrent(currentPath: string): Promise<void> {
    let entries: import('node:fs').Dirent[];

    try {
      entries = await fs.readdir(currentPath, { withFileTypes: true });
    } catch {
      // Directory doesn't exist or can't be read
      return;
    }

    // Separate directories and files
    const directories: string[] = [];
    const regularFiles: string[] = [];

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        // Skip ignored directories
        if (ignoreDirsSet.has(entry.name)) {
          continue;
        }

        // Skip if matches ignore pattern
        if (shouldIgnore(fullPath, ignorePatterns)) {
          continue;
        }

        directories.push(fullPath);
      } else if (entry.isFile()) {
        // Check if file has a supported extension
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext) && isSupportedFile(entry.name)) {
          // Skip if matches ignore pattern
          if (!shouldIgnore(fullPath, ignorePatterns)) {
            regularFiles.push(fullPath);
          }
        }
      }
    }

    // Add files from this directory
    files.push(...regularFiles);

    // Process subdirectories concurrently
    await Promise.all(directories.map(dir => walkConcurrent(dir)));
  }

  await walkConcurrent(dirPath);
  return files;
}

/**
 * Check if a path matches any ignore pattern
 */
function shouldIgnore(filePath: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // Simple glob matching
    if (pattern.includes('*')) {
      const regex = new RegExp(
        '^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$'
      );
      if (regex.test(filePath) || regex.test(path.basename(filePath))) {
        return true;
      }
    } else if (filePath.includes(pattern) || path.basename(filePath) === pattern) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve an import specifier to an actual file path
 *
 * @param fromFile - The file containing the import
 * @param importSource - The import specifier (e.g., './utils', 'lodash')
 * @param rootDir - Root directory of the project
 * @param extensions - File extensions to try
 * @param options - Analyzer options with path aliases
 * @returns Resolved absolute file path, or null if not resolvable
 */
async function resolveImport(
  fromFile: string,
  importSource: string,
  rootDir: string,
  extensions: string[],
  options: AnalyzerOptions
): Promise<string | null> {
  // Skip external packages (node_modules)
  if (isExternalImport(importSource)) {
    return null;
  }

  // Handle path aliases first
  if (options.pathAliases) {
    const aliasResolved = resolvePathAlias(
      importSource,
      options.pathAliases,
      options.baseUrl || rootDir
    );
    if (aliasResolved) {
      const resolved = await tryResolve(aliasResolved, extensions);
      if (resolved) return resolved;
    }
  }

  // Handle relative imports
  if (importSource.startsWith('.')) {
    const fromDir = path.dirname(fromFile);
    const targetPath = path.resolve(fromDir, importSource);
    return tryResolve(targetPath, extensions);
  }

  // Handle absolute imports relative to baseUrl
  if (options.baseUrl) {
    const targetPath = path.resolve(options.baseUrl, importSource);
    const resolved = await tryResolve(targetPath, extensions);
    if (resolved) return resolved;
  }

  // Try as absolute path from root
  const rootPath = path.resolve(rootDir, importSource);
  return tryResolve(rootPath, extensions);
}

/**
 * Check if an import is an external package (node_modules)
 */
function isExternalImport(importSource: string): boolean {
  // Relative imports are not external
  if (importSource.startsWith('.')) {
    return false;
  }

  // Absolute paths are not external
  if (path.isAbsolute(importSource)) {
    return false;
  }

  // Check for scoped packages (@org/package) or bare specifiers
  // These are typically node_modules packages
  if (importSource.startsWith('@')) {
    // Scoped package: @org/package
    const parts = importSource.split('/');
    // If it's just @org/package or @org/package/subpath, it's external
    // unless it matches a path alias pattern
    return parts.length >= 2;
  }

  // Bare specifier without path prefix
  // Could be node_modules or a path alias
  // We'll try to resolve it and return null if it doesn't exist
  return !importSource.includes('/') || !importSource.startsWith('/');
}

/**
 * Resolve a path alias to an actual path
 */
function resolvePathAlias(
  importSource: string,
  aliases: Record<string, string[]>,
  baseUrl: string
): string | null {
  for (const [pattern, replacements] of Object.entries(aliases)) {
    // Handle wildcard patterns like "@/*" -> ["src/*"]
    if (pattern.endsWith('/*')) {
      const prefix = pattern.slice(0, -2);
      if (importSource.startsWith(prefix + '/')) {
        const rest = importSource.slice(prefix.length + 1);
        for (const replacement of replacements) {
          const replacementBase = replacement.endsWith('/*')
            ? replacement.slice(0, -2)
            : replacement;
          return path.resolve(baseUrl, replacementBase, rest);
        }
      }
    } else if (importSource === pattern || importSource.startsWith(pattern + '/')) {
      // Exact match or prefix match
      for (const replacement of replacements) {
        const rest = importSource.slice(pattern.length);
        return path.resolve(baseUrl, replacement + rest);
      }
    }
  }
  return null;
}

/**
 * Try to resolve a path to an actual file, trying various extensions and index files
 */
async function tryResolve(
  targetPath: string,
  extensions: string[]
): Promise<string | null> {
  // Try exact path first
  if (await fileExists(targetPath)) {
    return targetPath;
  }

  // Try with extensions
  for (const ext of extensions) {
    const withExt = targetPath + ext;
    if (await fileExists(withExt)) {
      return withExt;
    }
  }

  // Try as directory with index file
  for (const ext of extensions) {
    const indexPath = path.join(targetPath, 'index' + ext);
    if (await fileExists(indexPath)) {
      return indexPath;
    }
  }

  // Handle .js extension in source but actual .ts file
  // This is common in ESM TypeScript projects
  if (targetPath.endsWith('.js')) {
    const tsPath = targetPath.slice(0, -3) + '.ts';
    if (await fileExists(tsPath)) {
      return tsPath;
    }
    const tsxPath = targetPath.slice(0, -3) + '.tsx';
    if (await fileExists(tsxPath)) {
      return tsxPath;
    }
  }

  return null;
}

/**
 * Check if a file exists
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

/**
 * Analyze a single file and return its imports
 *
 * @param filePath - Path to the file
 * @returns Array of import information
 */
export async function analyzeFile(filePath: string): Promise<ImportInfo[]> {
  return parseFile(filePath);
}

/**
 * Quick check if a directory likely has circular dependencies.
 * Does a shallow analysis for faster results.
 *
 * @param dirPath - Path to the directory
 * @param options - Analyzer options
 * @returns true if circular dependencies are likely present
 */
export async function hasCircularDependencies(
  dirPath: string,
  options: AnalyzerOptions = {}
): Promise<boolean> {
  const result = await analyzeDirectory(dirPath, options);
  return result.cycles.length > 0;
}

/**
 * Clear the global parse cache.
 * Useful for forcing a fresh analysis.
 */
export function clearParseCache(): void {
  globalParseCache.clear();
}

/**
 * Get parse cache statistics.
 * Useful for debugging and performance monitoring.
 */
export function getParseCacheStats(): { size: number; hits: number; misses: number; hitRate: number } {
  return globalParseCache.stats;
}
