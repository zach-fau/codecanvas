/**
 * Caching utilities for parsed file results
 */

import { createHash } from 'node:crypto';
import type { ImportInfo } from './types.js';

/**
 * Cache entry storing parsed imports for a file
 */
interface CacheEntry {
  /** Content hash used to validate cache freshness */
  hash: string;
  /** Cached import information */
  imports: ImportInfo[];
}

/**
 * In-memory cache for parsed file results.
 * Uses content hashing to invalidate stale entries.
 */
export class ParseCache {
  private cache = new Map<string, CacheEntry>();
  private hits = 0;
  private misses = 0;

  /**
   * Compute an MD5 hash of file content.
   * MD5 is fast and sufficient for cache validation (not security).
   *
   * @param content - File content to hash
   * @returns Hex-encoded MD5 hash
   */
  getHash(content: string): string {
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * Get cached imports for a file if the content hash matches.
   *
   * @param filePath - Absolute path to the file
   * @param contentHash - Hash of the current file content
   * @returns Cached imports if valid, null otherwise
   */
  get(filePath: string, contentHash: string): ImportInfo[] | null {
    const entry = this.cache.get(filePath);
    if (entry && entry.hash === contentHash) {
      this.hits++;
      return entry.imports;
    }
    this.misses++;
    return null;
  }

  /**
   * Store parsed imports in the cache.
   *
   * @param filePath - Absolute path to the file
   * @param contentHash - Hash of the file content
   * @param imports - Parsed import information
   */
  set(filePath: string, contentHash: string, imports: ImportInfo[]): void {
    this.cache.set(filePath, { hash: contentHash, imports });
  }

  /**
   * Check if a file is in the cache (regardless of validity).
   *
   * @param filePath - Absolute path to the file
   * @returns true if file has a cache entry
   */
  has(filePath: string): boolean {
    return this.cache.has(filePath);
  }

  /**
   * Remove a file from the cache.
   *
   * @param filePath - Absolute path to the file
   */
  delete(filePath: string): void {
    this.cache.delete(filePath);
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Get the number of entries in the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics.
   */
  get stats(): { size: number; hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return {
      size: this.cache.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total > 0 ? this.hits / total : 0,
    };
  }
}

/**
 * Shared global cache instance for use across multiple analyses.
 * This enables caching benefits when re-analyzing the same codebase.
 */
export const globalParseCache = new ParseCache();
