/**
 * Tests for the tree-sitter parser
 */

import { describe, it, expect } from 'vitest';
import { parseSource, isSupportedFile, getLanguageForFile } from './parser.js';

describe('parseSource', () => {
  describe('ES Module imports', () => {
    it('should parse default import', () => {
      const source = `import foo from 'foo-module';`;
      const imports = parseSource(source);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: 'foo-module',
        specifiers: ['foo'],
        type: 'esm',
      });
    });

    it('should parse named imports', () => {
      const source = `import { foo, bar } from 'my-module';`;
      const imports = parseSource(source);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: 'my-module',
        specifiers: expect.arrayContaining(['foo', 'bar']),
        type: 'esm',
      });
    });

    it('should parse aliased named imports', () => {
      const source = `import { foo as myFoo } from 'my-module';`;
      const imports = parseSource(source);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: 'my-module',
        specifiers: ['myFoo'],
        type: 'esm',
      });
    });

    it('should parse namespace imports', () => {
      const source = `import * as utils from './utils';`;
      const imports = parseSource(source);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: './utils',
        specifiers: ['* as utils'],
        type: 'esm',
      });
    });

    it('should parse side-effect imports', () => {
      const source = `import 'polyfill';`;
      const imports = parseSource(source);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: 'polyfill',
        specifiers: [],
        type: 'esm',
      });
    });

    it('should parse combined default and named imports', () => {
      const source = `import React, { useState, useEffect } from 'react';`;
      const imports = parseSource(source);

      expect(imports).toHaveLength(1);
      expect(imports[0].source).toBe('react');
      expect(imports[0].type).toBe('esm');
      expect(imports[0].specifiers).toContain('React');
      expect(imports[0].specifiers).toContain('useState');
      expect(imports[0].specifiers).toContain('useEffect');
    });

    it('should parse relative path imports', () => {
      const source = `import { helper } from '../utils/helper';`;
      const imports = parseSource(source);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: '../utils/helper',
        type: 'esm',
      });
    });
  });

  describe('CommonJS requires', () => {
    it('should parse simple require', () => {
      const source = `const foo = require('foo-module');`;
      const imports = parseSource(source);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: 'foo-module',
        specifiers: ['foo'],
        type: 'cjs',
      });
    });

    it('should parse destructured require', () => {
      const source = `const { foo, bar } = require('my-module');`;
      const imports = parseSource(source);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: 'my-module',
        type: 'cjs',
      });
      expect(imports[0].specifiers).toContain('foo');
      expect(imports[0].specifiers).toContain('bar');
    });

    it('should parse require without assignment', () => {
      const source = `require('side-effect');`;
      const imports = parseSource(source);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: 'side-effect',
        specifiers: [],
        type: 'cjs',
      });
    });
  });

  describe('Export from statements', () => {
    it('should parse export from', () => {
      const source = `export { foo, bar } from './module';`;
      const imports = parseSource(source);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: './module',
        type: 'esm',
      });
    });

    it('should parse export * from', () => {
      const source = `export * from './module';`;
      const imports = parseSource(source);

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: './module',
        specifiers: ['*'],
        type: 'esm',
      });
    });
  });

  describe('Multiple imports', () => {
    it('should parse multiple import statements', () => {
      const source = `
import foo from 'foo';
import { bar } from 'bar';
const baz = require('baz');
export { qux } from 'qux';
`;
      const imports = parseSource(source);

      expect(imports).toHaveLength(4);
      expect(imports.map(i => i.source)).toEqual(['foo', 'bar', 'baz', 'qux']);
    });
  });

  describe('Line numbers', () => {
    it('should include correct line numbers', () => {
      const source = `
import foo from 'foo';

import bar from 'bar';
`;
      const imports = parseSource(source);

      expect(imports).toHaveLength(2);
      expect(imports[0].line).toBe(2);
      expect(imports[1].line).toBe(4);
    });
  });

  describe('TypeScript specific', () => {
    it('should parse type imports', () => {
      const source = `import type { MyType } from './types';`;
      const imports = parseSource(source, 'typescript');

      expect(imports).toHaveLength(1);
      expect(imports[0]).toMatchObject({
        source: './types',
        type: 'esm',
      });
    });
  });

  describe('JavaScript', () => {
    it('should parse JavaScript files', () => {
      const source = `
import defaultExport from 'module-name';
const { named } = require('another-module');
`;
      const imports = parseSource(source, 'javascript');

      expect(imports).toHaveLength(2);
      expect(imports[0].source).toBe('module-name');
      expect(imports[1].source).toBe('another-module');
    });
  });
});

describe('isSupportedFile', () => {
  it('should return true for TypeScript files', () => {
    expect(isSupportedFile('foo.ts')).toBe(true);
    expect(isSupportedFile('foo.tsx')).toBe(true);
    expect(isSupportedFile('foo.mts')).toBe(true);
    expect(isSupportedFile('foo.cts')).toBe(true);
  });

  it('should return true for JavaScript files', () => {
    expect(isSupportedFile('foo.js')).toBe(true);
    expect(isSupportedFile('foo.jsx')).toBe(true);
    expect(isSupportedFile('foo.mjs')).toBe(true);
    expect(isSupportedFile('foo.cjs')).toBe(true);
  });

  it('should return false for unsupported files', () => {
    expect(isSupportedFile('foo.json')).toBe(false);
    expect(isSupportedFile('foo.css')).toBe(false);
    expect(isSupportedFile('foo.md')).toBe(false);
  });
});

describe('getLanguageForFile', () => {
  it('should return correct language for extensions', () => {
    expect(getLanguageForFile('foo.ts')).toBe('typescript');
    expect(getLanguageForFile('foo.tsx')).toBe('tsx');
    expect(getLanguageForFile('foo.js')).toBe('javascript');
    expect(getLanguageForFile('foo.jsx')).toBe('jsx');
  });

  it('should return null for unsupported extensions', () => {
    expect(getLanguageForFile('foo.py')).toBeNull();
    expect(getLanguageForFile('foo.rs')).toBeNull();
  });
});
