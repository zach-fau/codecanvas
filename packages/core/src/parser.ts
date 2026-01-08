/**
 * Tree-sitter based parser for extracting imports from TypeScript/JavaScript files
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import Parser from 'tree-sitter';
import TypeScript from 'tree-sitter-typescript';
import JavaScript from 'tree-sitter-javascript';
import type { ImportInfo, SupportedLanguage } from './types.js';
import { extensionToLanguage } from './types.js';

// Tree-sitter parser instance
let parser: Parser | null = null;

// Cached language instances
const languages: Record<string, Parser.Language> = {};

/**
 * Initialize the tree-sitter parser with TypeScript and JavaScript grammars
 */
export function initParser(): Parser {
  if (parser) {
    return parser;
  }

  parser = new Parser();

  // Cache language instances
  // tree-sitter-typescript exports both TypeScript and TSX
  languages['typescript'] = TypeScript.typescript as unknown as Parser.Language;
  languages['tsx'] = TypeScript.tsx as unknown as Parser.Language;
  languages['javascript'] = JavaScript as unknown as Parser.Language;
  languages['jsx'] = JavaScript as unknown as Parser.Language;

  return parser;
}

/**
 * Get the appropriate language for a file based on its extension
 */
export function getLanguageForFile(filePath: string): SupportedLanguage | null {
  const ext = path.extname(filePath).toLowerCase();
  return extensionToLanguage[ext] || null;
}

/**
 * Set the parser language based on file type
 */
function setParserLanguage(parser: Parser, language: SupportedLanguage): void {
  const lang = languages[language];
  if (!lang) {
    throw new Error(`Unsupported language: ${language}`);
  }
  parser.setLanguage(lang);
}

/**
 * Extract import specifiers from an import clause node
 */
function extractImportSpecifiers(node: Parser.SyntaxNode): string[] {
  const specifiers: string[] = [];

  // Walk through the import clause to find specifiers
  const traverse = (n: Parser.SyntaxNode) => {
    switch (n.type) {
      case 'identifier':
        // Default import
        if (n.parent?.type === 'import_clause') {
          specifiers.push(n.text);
        }
        break;
      case 'import_specifier':
        // Named import: could be `foo` or `foo as bar`
        const aliasNode = n.childForFieldName('alias');
        const nameNode = n.childForFieldName('name');
        if (aliasNode) {
          specifiers.push(aliasNode.text);
        } else if (nameNode) {
          specifiers.push(nameNode.text);
        } else {
          // Fallback: just get the text of first identifier child
          const idChild = n.children.find(c => c.type === 'identifier');
          if (idChild) {
            specifiers.push(idChild.text);
          }
        }
        break;
      case 'namespace_import':
        // `* as name`
        const asName = n.children.find(c => c.type === 'identifier');
        if (asName) {
          specifiers.push(`* as ${asName.text}`);
        }
        break;
    }

    for (const child of n.children) {
      traverse(child);
    }
  };

  traverse(node);
  return specifiers;
}

/**
 * Extract the module source string from a string node
 */
function extractStringValue(node: Parser.SyntaxNode): string {
  // Remove quotes from the string
  const text = node.text;
  if ((text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1);
  }
  // Handle template literals
  if (text.startsWith('`') && text.endsWith('`')) {
    return text.slice(1, -1);
  }
  return text;
}

/**
 * Extract all imports from a parsed syntax tree
 */
function extractImportsFromTree(tree: Parser.Tree): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const rootNode = tree.rootNode;

  const traverse = (node: Parser.SyntaxNode) => {
    // ES Module imports
    if (node.type === 'import_statement') {
      const sourceNode = node.childForFieldName('source') ||
        node.children.find(c => c.type === 'string');

      if (sourceNode) {
        const source = extractStringValue(sourceNode);
        const importClause = node.children.find(c => c.type === 'import_clause');
        const specifiers = importClause ? extractImportSpecifiers(importClause) : [];

        // Handle side-effect imports (import 'module')
        imports.push({
          source,
          specifiers,
          type: 'esm',
          line: node.startPosition.row + 1,
        });
      }
    }

    // Dynamic imports: import('module')
    if (node.type === 'call_expression') {
      const functionNode = node.childForFieldName('function');
      if (functionNode?.type === 'import') {
        const args = node.childForFieldName('arguments');
        const firstArg = args?.children.find(c => c.type === 'string');
        if (firstArg) {
          imports.push({
            source: extractStringValue(firstArg),
            specifiers: [],
            type: 'esm',
            line: node.startPosition.row + 1,
          });
        }
      }
    }

    // CommonJS require
    if (node.type === 'call_expression') {
      const functionNode = node.childForFieldName('function');
      if (functionNode?.type === 'identifier' && functionNode.text === 'require') {
        const args = node.childForFieldName('arguments');
        const firstArg = args?.children.find(c => c.type === 'string');
        if (firstArg) {
          // Try to find if this is a destructured require
          const specifiers: string[] = [];
          let parent = node.parent;

          // Check for: const { a, b } = require('module')
          if (parent?.type === 'variable_declarator') {
            const nameNode = parent.childForFieldName('name');
            if (nameNode?.type === 'object_pattern') {
              for (const child of nameNode.children) {
                if (child.type === 'shorthand_property_identifier_pattern' ||
                    child.type === 'shorthand_property_identifier') {
                  specifiers.push(child.text);
                } else if (child.type === 'pair_pattern') {
                  const value = child.childForFieldName('value');
                  if (value?.type === 'identifier') {
                    specifiers.push(value.text);
                  }
                }
              }
            } else if (nameNode?.type === 'identifier') {
              // const foo = require('module')
              specifiers.push(nameNode.text);
            }
          }

          imports.push({
            source: extractStringValue(firstArg),
            specifiers,
            type: 'cjs',
            line: node.startPosition.row + 1,
          });
        }
      }
    }

    // Export from statements: export { foo } from 'module'
    if (node.type === 'export_statement') {
      const sourceNode = node.childForFieldName('source') ||
        node.children.find(c => c.type === 'string');

      if (sourceNode) {
        const source = extractStringValue(sourceNode);
        const exportClause = node.children.find(c => c.type === 'export_clause');
        const specifiers: string[] = [];

        if (exportClause) {
          for (const child of exportClause.children) {
            if (child.type === 'export_specifier') {
              const nameNode = child.childForFieldName('name');
              if (nameNode) {
                specifiers.push(nameNode.text);
              }
            }
          }
        }

        // Check for `export * from 'module'`
        const hasNamespaceExport = node.children.some(c => c.text === '*');
        if (hasNamespaceExport) {
          specifiers.push('*');
        }

        imports.push({
          source,
          specifiers,
          type: 'esm',
          line: node.startPosition.row + 1,
        });
      }
    }

    // Recurse into children
    for (const child of node.children) {
      traverse(child);
    }
  };

  traverse(rootNode);
  return imports;
}

/**
 * Parse a file and extract all import information
 *
 * @param filePath - Path to the file to parse
 * @returns Array of import information found in the file
 */
export async function parseFile(filePath: string): Promise<ImportInfo[]> {
  const p = initParser();

  // Determine language from file extension
  const language = getLanguageForFile(filePath);
  if (!language) {
    throw new Error(`Unsupported file type: ${path.extname(filePath)}`);
  }

  // Set the appropriate language
  setParserLanguage(p, language);

  // Read and parse the file
  const content = await fs.readFile(filePath, 'utf-8');
  const tree = p.parse(content);

  // Extract imports from the AST
  return extractImportsFromTree(tree);
}

/**
 * Parse source code directly (useful for testing)
 *
 * @param source - Source code to parse
 * @param language - Language of the source code
 * @returns Array of import information found in the source
 */
export function parseSource(source: string, language: SupportedLanguage = 'typescript'): ImportInfo[] {
  const p = initParser();
  setParserLanguage(p, language);
  const tree = p.parse(source);
  return extractImportsFromTree(tree);
}

/**
 * Check if a file is a supported source file
 */
export function isSupportedFile(filePath: string): boolean {
  return getLanguageForFile(filePath) !== null;
}
