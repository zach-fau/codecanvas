#!/usr/bin/env node

import { Command } from "commander";
import { analyzeCommand } from "./commands/analyze.js";

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

program.parse();
