#!/usr/bin/env node

import { Command } from "commander";
import { analyzeCommand } from "./commands/analyze.js";
import { benchmarkCommand } from "./commands/benchmark.js";

const program = new Command();

program
  .name("codecanvas")
  .description(
    "Visual circular dependency detection for TypeScript/JavaScript monorepos"
  )
  .version("0.1.0");

program
  .command("analyze")
  .description("Analyze a directory for circular dependencies")
  .argument("<path>", "Path to the directory to analyze")
  .option(
    "-o, --output <format>",
    "Output format (text, json)",
    "text"
  )
  .option(
    "-i, --ignore <patterns...>",
    "Glob patterns to ignore (in addition to defaults)"
  )
  .action(analyzeCommand);

program
  .command("benchmark")
  .description("Benchmark analysis performance on a directory")
  .argument("<path>", "Path to the directory to benchmark")
  .option(
    "-r, --runs <number>",
    "Number of benchmark runs",
    "3"
  )
  .option(
    "-c, --concurrency <number>",
    "Number of files to parse concurrently",
    "50"
  )
  .option(
    "--no-cache",
    "Disable parse caching"
  )
  .action((targetPath: string, options: { runs: string; concurrency: string; cache: boolean }) => {
    return benchmarkCommand(targetPath, {
      runs: parseInt(options.runs, 10),
      concurrency: parseInt(options.concurrency, 10),
      noCache: !options.cache,
    });
  });

program.parse();
