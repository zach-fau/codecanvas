import chalk from "chalk";
import path from "node:path";
import { analyzeDirectory, type AnalysisResult, type CircularDependency, type DependencyEdge } from "@codecanvas/core";

interface AnalyzeOptions {
  output: "text" | "json";
  ignore?: string[];
}

function formatCyclePath(cycle: CircularDependency, basePath: string): string {
  const relativePath = cycle.chain.map((p: string) => path.relative(basePath, p));
  return relativePath.join(" → ") + " → " + relativePath[0];
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

function printTextOutput(result: AnalysisResult, basePath: string): void {
  const { stats, cycles, errors } = result;

  // Header
  console.log(chalk.blue(`\n📊 Analysis Results\n`));

  // Stats
  console.log(chalk.white(`Files analyzed: ${stats.totalFiles}`));
  console.log(chalk.white(`Dependencies: ${stats.totalDependencies}`));
  console.log(chalk.white(`Circular dependencies: ${stats.circularDependencies}`));

  // Cycles
  if (cycles.length === 0) {
    console.log(chalk.green(`\n✅ No circular dependencies found!\n`));
  } else {
    console.log(
      chalk.red(`\n❌ Found ${cycles.length} circular dependency chain${cycles.length > 1 ? "s" : ""}:\n`)
    );

    cycles.forEach((cycle, index) => {
      console.log(chalk.yellow(`  ${index + 1}. ${formatCyclePath(cycle, basePath)}`));
      console.log(chalk.dim(`     Files involved: ${cycle.length}`));
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
}

function printJsonOutput(result: AnalysisResult, basePath: string): void {
  // Convert to relative paths for JSON output
  const edges = getGraphEdges(result.graph);

  const output = {
    stats: result.stats,
    cycles: result.cycles.map((cycle) => ({
      chain: cycle.chain.map((p: string) => path.relative(basePath, p)),
      length: cycle.length,
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

export async function analyzeCommand(
  targetPath: string,
  options: AnalyzeOptions
): Promise<void> {
  const absolutePath = path.resolve(targetPath);

  if (options.output === "text") {
    console.log(chalk.blue(`\nAnalyzing: ${absolutePath}\n`));
  }

  try {
    const result = await analyzeDirectory(absolutePath, {
      ignorePatterns: options.ignore,
    });

    if (result.stats.totalFiles === 0) {
      if (options.output === "text") {
        console.log(chalk.yellow("No TypeScript/JavaScript files found."));
      } else {
        console.log(JSON.stringify({ stats: result.stats, cycles: [], graph: { nodes: [], edges: [] }, errors: [] }));
      }
      return;
    }

    if (options.output === "json") {
      printJsonOutput(result, absolutePath);
    } else {
      printTextOutput(result, absolutePath);
    }

    // Exit with error code if cycles found
    if (result.cycles.length > 0) {
      process.exit(1);
    }
  } catch (error) {
    if (error instanceof Error) {
      console.error(chalk.red(`Error: ${error.message}`));
    } else {
      console.error(chalk.red("An unknown error occurred"));
    }
    process.exit(1);
  }
}
