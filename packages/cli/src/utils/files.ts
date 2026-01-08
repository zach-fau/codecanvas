import fg from "fast-glob";
import path from "node:path";
import fs from "node:fs/promises";

/**
 * Default patterns to always ignore when discovering files.
 */
const DEFAULT_IGNORE_PATTERNS = [
  "**/node_modules/**",
  "**/.git/**",
  "**/dist/**",
  "**/build/**",
  "**/coverage/**",
  "**/*.d.ts",
];

/**
 * File extensions to include in the analysis.
 */
const SUPPORTED_EXTENSIONS = ["ts", "tsx", "js", "jsx"];

/**
 * Parse .gitignore file and convert patterns to glob ignore patterns.
 */
async function parseGitignore(dirPath: string): Promise<string[]> {
  const gitignorePath = path.join(dirPath, ".gitignore");

  try {
    const content = await fs.readFile(gitignorePath, "utf-8");
    const lines = content.split("\n");

    return lines
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((pattern) => {
        // Convert gitignore patterns to glob patterns
        if (pattern.startsWith("/")) {
          // Anchored to root - remove leading slash
          return pattern.slice(1);
        }
        // Match anywhere in the tree
        return `**/${pattern}`;
      });
  } catch {
    // .gitignore doesn't exist or can't be read
    return [];
  }
}

/**
 * Discover all TypeScript and JavaScript files in a directory.
 *
 * @param dirPath - Absolute path to the directory to scan
 * @param additionalIgnore - Additional glob patterns to ignore
 * @returns Array of absolute file paths
 */
export async function discoverFiles(
  dirPath: string,
  additionalIgnore?: string[]
): Promise<string[]> {
  // Verify the directory exists
  try {
    const stat = await fs.stat(dirPath);
    if (!stat.isDirectory()) {
      throw new Error(`Not a directory: ${dirPath}`);
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(`Directory not found: ${dirPath}`);
    }
    throw error;
  }

  // Build glob pattern for supported extensions
  const extensionPattern = `**/*.{${SUPPORTED_EXTENSIONS.join(",")}}`;

  // Collect all ignore patterns
  const gitignorePatterns = await parseGitignore(dirPath);
  const ignorePatterns = [
    ...DEFAULT_IGNORE_PATTERNS,
    ...gitignorePatterns,
    ...(additionalIgnore || []),
  ];

  // Use fast-glob to find files
  const files = await fg(extensionPattern, {
    cwd: dirPath,
    absolute: true,
    ignore: ignorePatterns,
    onlyFiles: true,
    followSymbolicLinks: false,
  });

  // Sort files for consistent output
  return files.sort();
}

/**
 * Get the list of default ignore patterns.
 * Useful for testing and documentation.
 */
export function getDefaultIgnorePatterns(): string[] {
  return [...DEFAULT_IGNORE_PATTERNS];
}

/**
 * Get the list of supported file extensions.
 * Useful for testing and documentation.
 */
export function getSupportedExtensions(): string[] {
  return [...SUPPORTED_EXTENSIONS];
}
