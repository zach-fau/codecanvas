import chalk from "chalk";
import path from "node:path";
import ora from "ora";
import {
  analyzeDirectory,
  clearParseCache,
  getParseCacheStats,
  type ProgressEvent,
} from "@codecanvas/core";

interface BenchmarkOptions {
  runs: number;
  concurrency: number;
  noCache: boolean;
}

interface BenchmarkResult {
  run: number;
  duration: number;
  filesAnalyzed: number;
  filesPerSecond: number;
  memoryUsedMB: number;
  cacheHitRate: number;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function getMemoryUsage(): number {
  const usage = process.memoryUsage();
  return usage.heapUsed / (1024 * 1024);
}

function calculateStats(results: BenchmarkResult[]): {
  avgDuration: number;
  minDuration: number;
  maxDuration: number;
  avgFilesPerSecond: number;
  avgMemory: number;
} {
  const durations = results.map((r) => r.duration);
  const filesPerSecond = results.map((r) => r.filesPerSecond);
  const memories = results.map((r) => r.memoryUsedMB);

  return {
    avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    minDuration: Math.min(...durations),
    maxDuration: Math.max(...durations),
    avgFilesPerSecond: filesPerSecond.reduce((a, b) => a + b, 0) / filesPerSecond.length,
    avgMemory: memories.reduce((a, b) => a + b, 0) / memories.length,
  };
}

export async function benchmarkCommand(
  targetPath: string,
  options: BenchmarkOptions
): Promise<void> {
  const absolutePath = path.resolve(targetPath);
  const runs = Math.max(1, options.runs);
  const concurrency = Math.max(1, options.concurrency);
  const enableCache = !options.noCache;

  console.log(chalk.blue(`\nBenchmarking: ${absolutePath}\n`));
  console.log(chalk.dim(`Configuration:`));
  console.log(chalk.dim(`  - Runs: ${runs}`));
  console.log(chalk.dim(`  - Concurrency: ${concurrency}`));
  console.log(chalk.dim(`  - Cache: ${enableCache ? "enabled" : "disabled"}`));
  console.log();

  const results: BenchmarkResult[] = [];

  for (let run = 1; run <= runs; run++) {
    // Clear cache before first run if caching is enabled
    // This ensures the first run measures cold cache performance
    if (run === 1 && enableCache) {
      clearParseCache();
    }

    // Force garbage collection if available (requires --expose-gc flag)
    if (global.gc) {
      global.gc();
    }

    const spinner = ora({
      text: `Run ${run}/${runs}: Analyzing...`,
      color: "cyan",
    }).start();

    const startMemory = getMemoryUsage();
    const startTime = Date.now();

    try {
      const result = await analyzeDirectory(absolutePath, {
        concurrency,
        enableCache,
        onProgress: (event: ProgressEvent) => {
          if (event.phase === "parsing" && event.total) {
            spinner.text = `Run ${run}/${runs}: Parsing ${event.current}/${event.total} files...`;
          } else if (event.phase === "analyzing") {
            spinner.text = `Run ${run}/${runs}: Analyzing graph...`;
          }
        },
      });

      const endTime = Date.now();
      const endMemory = getMemoryUsage();
      const duration = endTime - startTime;
      const filesAnalyzed = result.stats.totalFiles;
      const filesPerSecond = filesAnalyzed / (duration / 1000);
      const memoryUsedMB = endMemory - startMemory;
      const cacheStats = getParseCacheStats();

      results.push({
        run,
        duration,
        filesAnalyzed,
        filesPerSecond,
        memoryUsedMB: Math.max(0, memoryUsedMB),
        cacheHitRate: cacheStats.hitRate,
      });

      spinner.succeed(
        `Run ${run}/${runs}: ${formatNumber(filesAnalyzed)} files in ${formatDuration(duration)} (${filesPerSecond.toFixed(1)} files/sec)`
      );
    } catch (error) {
      spinner.fail(`Run ${run}/${runs}: Failed`);
      console.error(chalk.red(`  Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  }

  // Print summary
  console.log(chalk.blue(`\n${"=".repeat(60)}`));
  console.log(chalk.blue.bold(`Benchmark Summary`));
  console.log(chalk.blue(`${"=".repeat(60)}\n`));

  const stats = calculateStats(results);

  // Per-run results table
  console.log(chalk.white.bold("Per-Run Results:"));
  console.log(chalk.dim("-".repeat(80)));
  console.log(
    chalk.dim(
      "Run".padEnd(6) +
        "Duration".padEnd(12) +
        "Files".padEnd(10) +
        "Files/sec".padEnd(12) +
        "Memory".padEnd(12) +
        "Cache Hit"
    )
  );
  console.log(chalk.dim("-".repeat(80)));

  for (const result of results) {
    console.log(
      `${String(result.run).padEnd(6)}` +
        `${formatDuration(result.duration).padEnd(12)}` +
        `${formatNumber(result.filesAnalyzed).padEnd(10)}` +
        `${result.filesPerSecond.toFixed(1).padEnd(12)}` +
        `${result.memoryUsedMB.toFixed(1)} MB`.padEnd(12) +
        `${(result.cacheHitRate * 100).toFixed(1)}%`
    );
  }
  console.log(chalk.dim("-".repeat(80)));

  // Aggregate statistics
  console.log(chalk.white.bold("\nAggregate Statistics:"));
  console.log(`  Average duration:    ${formatDuration(stats.avgDuration)}`);
  console.log(`  Min duration:        ${formatDuration(stats.minDuration)}`);
  console.log(`  Max duration:        ${formatDuration(stats.maxDuration)}`);
  console.log(`  Avg files/second:    ${stats.avgFilesPerSecond.toFixed(1)}`);
  console.log(`  Avg memory delta:    ${stats.avgMemory.toFixed(1)} MB`);

  // Performance assessment
  const filesAnalyzed = results[0]?.filesAnalyzed || 0;
  const targetSeconds = getTargetSeconds(filesAnalyzed);
  const actualSeconds = stats.avgDuration / 1000;

  console.log(chalk.white.bold("\nPerformance Assessment:"));
  console.log(`  Files analyzed:      ${formatNumber(filesAnalyzed)}`);
  console.log(`  Target time:         ${targetSeconds.toFixed(1)}s`);
  console.log(`  Actual time:         ${actualSeconds.toFixed(2)}s`);

  if (actualSeconds <= targetSeconds) {
    console.log(chalk.green(`  Status:              PASS (${((targetSeconds / actualSeconds - 1) * 100).toFixed(0)}% faster than target)`));
  } else {
    console.log(chalk.red(`  Status:              FAIL (${((actualSeconds / targetSeconds - 1) * 100).toFixed(0)}% slower than target)`));
  }

  // Cache performance (if enabled)
  if (enableCache && runs > 1) {
    const cacheStats = getParseCacheStats();
    console.log(chalk.white.bold("\nCache Performance:"));
    console.log(`  Cached entries:      ${formatNumber(cacheStats.size)}`);
    console.log(`  Total hits:          ${formatNumber(cacheStats.hits)}`);
    console.log(`  Total misses:        ${formatNumber(cacheStats.misses)}`);
    console.log(`  Hit rate:            ${(cacheStats.hitRate * 100).toFixed(1)}%`);
  }

  console.log();
}

/**
 * Get target time in seconds based on file count
 * Performance targets:
 * - 1,000 files: < 3 seconds
 * - 5,000 files: < 15 seconds
 * - 10,000 files: < 30 seconds
 */
function getTargetSeconds(fileCount: number): number {
  if (fileCount <= 1000) {
    return 3;
  } else if (fileCount <= 5000) {
    // Linear interpolation between 1000->3s and 5000->15s
    return 3 + ((fileCount - 1000) / 4000) * 12;
  } else if (fileCount <= 10000) {
    // Linear interpolation between 5000->15s and 10000->30s
    return 15 + ((fileCount - 5000) / 5000) * 15;
  } else {
    // Beyond 10k files: extrapolate at 3 files/ms rate
    return fileCount / 333;
  }
}
