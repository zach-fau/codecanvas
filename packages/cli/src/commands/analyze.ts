import chalk from "chalk";
import path from "node:path";
import ora from "ora";
import cliProgress from "cli-progress";
import { analyzeDirectory, type AnalysisResult, type CircularDependency, type CycleSuggestion, type DependencyEdge, type ProgressEvent } from "@codecanvas/core";

interface AnalyzeOptions {
  output: "text" | "json";
  ignore?: string[];
}

function formatCyclePath(cycle: CircularDependency, basePath: string): string {
  const relativePath = cycle.chain.map((p: string) => path.relative(basePath, p));
  // The chain already includes the closing node, so just join them
  return relativePath.join(" → ");
}

function formatSuggestions(suggestions: CycleSuggestion[] | undefined, basePath: string): string[] {
  if (!suggestions || suggestions.length === 0) {
    return [];
  }

  return suggestions.map(suggestion => {
    let line = `• ${suggestion.description}`;
    if (suggestion.targetEdge) {
      const from = path.relative(basePath, suggestion.targetEdge.from);
      const to = path.relative(basePath, suggestion.targetEdge.to);
      // Only add edge info if not already in the description
      if (!suggestion.description.includes(path.basename(suggestion.targetEdge.from))) {
        line += chalk.dim(` (target: ${from} → ${to})`);
      }
    }
    return line;
  });
}

function getGraphEdges(graph: AnalysisResult["graph"]): DependencyEdge[] {
  const edges: DependencyEdge[] = [];
  for (const [from, node] of graph.nodes) {
    for (const to of node.dependencies) {
      edges.push({ from, to });
    }
  }
  return edges;
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
}

function printTextOutput(result: AnalysisResult, basePath: string, duration: number): void {
  const { stats, cycles, errors } = result;

  // Header
  console.log(chalk.blue(`\n📊 Analysis Results\n`));

  // Stats
  console.log(chalk.white(`Files analyzed: ${formatNumber(stats.totalFiles)}`));
  console.log(chalk.white(`Dependencies: ${formatNumber(stats.totalDependencies)}`));
  console.log(chalk.white(`Circular dependencies: ${stats.circularDependencies}`));

  // Cycles
  if (cycles.length === 0) {
    console.log(chalk.green(`\n✅ No circular dependencies found!\n`));
  } else {
    console.log(
      chalk.red(`\n❌ Found ${cycles.length} circular dependency chain${cycles.length > 1 ? "s" : ""}:\n`)
    );

    cycles.forEach((cycle, index) => {
      console.log(chalk.yellow(`\n  ${index + 1}. ${formatCyclePath(cycle, basePath)}`));
      console.log(chalk.dim(`     Files involved: ${cycle.length}`));

      // Display suggestions
      const suggestions = formatSuggestions(cycle.suggestions, basePath);
      if (suggestions.length > 0) {
        console.log(chalk.cyan(`\n     💡 Suggestions to break this cycle:`));
        suggestions.forEach(suggestion => {
          console.log(chalk.white(`        ${suggestion}`));
        });
      }
    });

    console.log();
  }

  // Errors
  if (errors.length > 0) {
    console.log(chalk.yellow(`\n⚠️  ${errors.length} file(s) had parsing errors:\n`));
    errors.slice(0, 5).forEach((err) => {
      const relativePath = path.relative(basePath, err.file);
      console.log(chalk.dim(`  ${relativePath}: ${err.error}`));
    });
    if (errors.length > 5) {
      console.log(chalk.dim(`  ... and ${errors.length - 5} more`));
    }
  }

  // Duration
  console.log(chalk.green(`\n✅ Analysis completed in ${formatDuration(duration)}\n`));
}

function printJsonOutput(result: AnalysisResult, basePath: string): void {
  // Convert to relative paths for JSON output
  const edges = getGraphEdges(result.graph);

  const output = {
    stats: result.stats,
    cycles: result.cycles.map((cycle) => ({
      chain: cycle.chain.map((p: string) => path.relative(basePath, p)),
      length: cycle.length,
      suggestions: cycle.suggestions?.map(s => ({
        type: s.type,
        description: s.description,
        targetEdge: s.targetEdge ? {
          from: path.relative(basePath, s.targetEdge.from),
          to: path.relative(basePath, s.targetEdge.to),
        } : undefined,
      })),
    })),
    graph: {
      nodes: Array.from(result.graph.nodes.keys()).map((n: string) => path.relative(basePath, n)),
      edges: edges.map((e) => ({
        from: path.relative(basePath, e.from),
        to: path.relative(basePath, e.to),
      })),
    },
    errors: result.errors.map((e) => ({
      file: path.relative(basePath, e.file),
      error: e.error,
    })),
  };

  console.log(JSON.stringify(output, null, 2));
}

function getErrorSuggestion(error: Error, targetPath: string): string {
  const message = error.message.toLowerCase();

  if (message.includes("enoent") || message.includes("no such file")) {
    return `The path "${targetPath}" does not exist. Please check the path and try again.`;
  }

  if (message.includes("eacces") || message.includes("permission denied")) {
    return `Permission denied when accessing "${targetPath}". Try running with elevated permissions.`;
  }

  if (message.includes("not a directory")) {
    return `"${targetPath}" is not a directory. Please provide a directory path.`;
  }

  if (message.includes("tree-sitter") || message.includes("parser")) {
    return `Parser initialization failed. Try reinstalling dependencies with: pnpm install`;
  }

  if (message.includes("memory") || message.includes("heap")) {
    return `Out of memory. Try analyzing a smaller directory or increase Node.js memory limit with: NODE_OPTIONS="--max-old-space-size=4096"`;
  }

  return error.message;
}

export async function analyzeCommand(
  targetPath: string,
  options: AnalyzeOptions
): Promise<void> {
  const absolutePath = path.resolve(targetPath);
  const startTime = Date.now();
  const isTextOutput = options.output === "text";

  if (isTextOutput) {
    console.log(chalk.blue(`\nAnalyzing: ${absolutePath}\n`));
  }

  // Create progress indicators (only for text output)
  // Use wrapper objects to help TypeScript with control flow
  const progress = {
    spinner: null as ReturnType<typeof ora> | null,
    bar: null as cliProgress.SingleBar | null,
    discoveredFiles: 0,
  };

  if (isTextOutput) {
    progress.spinner = ora({
      text: "Discovering files...",
      color: "cyan",
    }).start();
  }

  // Progress callback handler
  const handleProgress = (event: ProgressEvent): void => {
    if (!isTextOutput) return;

    switch (event.phase) {
      case "discovering":
        // Spinner is already started
        break;

      case "parsing":
        // Stop spinner on first parsing event
        if (progress.spinner?.isSpinning) {
          progress.discoveredFiles = event.total || 0;
          progress.spinner.succeed(`Found ${formatNumber(progress.discoveredFiles)} files`);
          progress.spinner = null;

          // Create and start progress bar
          console.log();
          progress.bar = new cliProgress.SingleBar({
            format: `Parsing ${chalk.cyan("{bar}")} {percentage}% | {value}/{total} files`,
            barCompleteChar: "█",
            barIncompleteChar: "░",
            hideCursor: true,
          });
          progress.bar.start(event.total || 0, 0);
        }

        // Update progress bar
        if (progress.bar && event.current !== undefined) {
          progress.bar.update(event.current);
        }
        break;

      case "analyzing":
        // Stop progress bar
        if (progress.bar) {
          progress.bar.stop();
          progress.bar = null;
          console.log();
        }
        break;
    }
  };

  try {
    const result = await analyzeDirectory(absolutePath, {
      ignorePatterns: options.ignore,
      onProgress: handleProgress,
    });

    // Clean up any remaining UI elements
    if (progress.spinner?.isSpinning) {
      progress.spinner.stop();
    }
    if (progress.bar) {
      progress.bar.stop();
      console.log();
    }

    const duration = Date.now() - startTime;

    if (result.stats.totalFiles === 0) {
      if (isTextOutput) {
        console.log(chalk.yellow("\n⚠️  No TypeScript/JavaScript files found.\n"));
        console.log(chalk.dim("Suggestions:"));
        console.log(chalk.dim("  - Check that the directory contains .ts, .tsx, .js, or .jsx files"));
        console.log(chalk.dim("  - Use --ignore to exclude directories if needed"));
        console.log(chalk.dim(`  - Make sure ${absolutePath} is the correct path\n`));
      } else {
        console.log(JSON.stringify({ stats: result.stats, cycles: [], graph: { nodes: [], edges: [] }, errors: [] }));
      }
      return;
    }

    if (options.output === "json") {
      printJsonOutput(result, absolutePath);
    } else {
      printTextOutput(result, absolutePath, duration);
    }

    // Exit with error code if cycles found
    if (result.cycles.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    // Clean up any remaining UI elements
    if (progress.spinner?.isSpinning) {
      progress.spinner.fail("Analysis failed");
    }
    if (progress.bar) {
      progress.bar.stop();
    }

    console.log();

    if (error instanceof Error) {
      const suggestion = getErrorSuggestion(error, absolutePath);
      console.error(chalk.red(`❌ Error: ${suggestion}`));

      // Show stack trace in debug mode
      if (process.env.DEBUG) {
        console.error(chalk.dim(`\nStack trace:\n${error.stack}`));
      }
    } else {
      console.error(chalk.red("❌ An unknown error occurred"));
    }

    console.log();
    process.exit(1);
  }
}
