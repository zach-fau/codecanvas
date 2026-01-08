import chalk from "chalk";
import path from "node:path";
import { discoverFiles } from "../utils/files.js";

interface AnalyzeOptions {
  output: "text" | "json";
  ignore?: string[];
}

export async function analyzeCommand(
  targetPath: string,
  options: AnalyzeOptions
): Promise<void> {
  const absolutePath = path.resolve(targetPath);

  console.log(chalk.blue(`\nAnalyzing: ${absolutePath}\n`));

  try {
    const files = await discoverFiles(absolutePath, options.ignore);

    if (files.length === 0) {
      console.log(chalk.yellow("No TypeScript/JavaScript files found."));
      return;
    }

    if (options.output === "json") {
      console.log(JSON.stringify({ files, count: files.length }, null, 2));
    } else {
      console.log(chalk.green(`Found ${files.length} files:\n`));

      for (const file of files) {
        // Display relative path for readability
        const relativePath = path.relative(absolutePath, file);
        console.log(`  ${relativePath}`);
      }

      console.log(chalk.blue(`\nTotal: ${files.length} files`));
      console.log(
        chalk.dim("\n(Circular dependency analysis will be added soon)")
      );
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
