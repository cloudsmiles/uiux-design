/**
 * Code compilation and transformation module
 */

import type { CompilerOptions, CompileResult, CompileError } from './types';

const DEFAULT_OPTIONS: CompilerOptions = {
  target: 'es2017',
  module: 'umd',
  sourceMap: false,
  minify: false,
};

const REACT_HOOKS = [
  'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'Fragment',
  'createContext', 'useContext', 'useReducer', 'forwardRef', 'memo', 'lazy',
  'Suspense', 'StrictMode', 'useId', 'useTransition', 'useDeferredValue',
  'useImperativeHandle', 'useLayoutEffect', 'useSyncExternalStore',
  'useInsertionEffect', 'useDebugValue',
].join(', ');

const DEFAULT_HELPERS = `
const { ${REACT_HOOKS} } = React;
const { createRoot, createPortal } = ReactDOM;
const cn = (...args) => args.filter(Boolean).join(' ');
`;

export class Compiler {
  private options: CompilerOptions;

  constructor(options?: Partial<CompilerOptions>) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  compile(code: string, _options?: { filename?: string }): CompileResult {
    const errors: CompileError[] = [];
    try {
      let processed = this.removeImports(code);
      processed = this.transformExports(processed);
      const componentName = this.extractComponentName(code);
      processed = this.injectHelpers(processed);
      processed = this.addRenderCall(processed, componentName);
      const dependencies = this.extractDependencies(code);
      return { code: processed, componentName, errors, dependencies };
    } catch (error) {
      errors.push(this.formatError(error as Error, code));
      return { code: '', componentName: null, errors, dependencies: [] };
    }
  }

  private removeImports(code: string): string {
    return code
      .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/import\s*\([^)]*\)/g, 'Promise.resolve({ default: function(){} })');
  }

  private transformExports(code: string): string {
    return code
      .replace(/export\s+default\s+function(\s+)/g, 'function$1')
      .replace(/export\s+default\s+class(\s+)/g, 'class$1')
      .replace(/export\s+default\s+/g, 'const __default__ = ')
      .replace(/export\s+(const|let|var|function|class)\s+/g, '$1 ')
      .replace(/export\s+\{[^}]*\}\s*;?/g, '')
      .replace(/export\s+type\s+\w+\s*=\s*[^;]+;?/g, '')
      .replace(/export\s+interface\s+\w+\s*\{[^}]*\}/g, '');
  }

  extractComponentName(code: string): string | null {
    const funcMatch = code.match(/export\s+default\s+function\s+([A-Z]\w+)/);
    if (funcMatch) return funcMatch[1];

    const classMatch = code.match(/export\s+default\s+class\s+([A-Z]\w+)/);
    if (classMatch) return classMatch[1];

    const namedFuncMatch = code.match(/function\s+([A-Z]\w+)\s*[\(<]/);
    if (namedFuncMatch) {
      if (new RegExp(`export\\s+default\\s+${namedFuncMatch[1]}\\b`).test(code)) {
        return namedFuncMatch[1];
      }
    }

    const arrowMatch = code.match(/const\s+([A-Z]\w+)\s*=\s*(?:\([^)]*\)\s*)?=>/);
    if (arrowMatch) {
      if (new RegExp(`export\\s+default\\s+${arrowMatch[1]}\\b`).test(code)) {
        return arrowMatch[1];
      }
    }

    const defaultExportMatch = code.match(/export\s+default\s+([A-Z]\w+)\s*;?\s*$/m);
    if (defaultExportMatch) return defaultExportMatch[1];

    const fallbackMatch = code.match(/(?:function|const)\s+([A-Z]\w+)\s*[=\(]/);
    if (fallbackMatch) return fallbackMatch[1];

    return null;
  }

  private injectHelpers(code: string): string {
    return DEFAULT_HELPERS + '\n' + code;
  }

  private addRenderCall(code: string, componentName: string | null): string {
    if (componentName) {
      return `${code}\n\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${componentName}));`;
    }
    return `${code}
(function() {
  var __comp = typeof __default__ !== 'undefined' ? __default__ : null;
  if (__comp) {
    ReactDOM.createRoot(document.getElementById('root')).render(
      typeof __comp === 'function' ? React.createElement(__comp) : __comp
    );
  }
})();`;
  }

  private extractDependencies(code: string): string[] {
    const deps: string[] = [];
    const regex = /import\s+[\s\S]*?from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(code)) !== null) {
      const dep = match[1];
      if (!dep.startsWith('.') && !dep.startsWith('/')) deps.push(dep);
    }
    return [...new Set(deps)];
  }

  private formatError(error: Error, code: string): CompileError {
    const result: CompileError = { message: error.message };
    const lineMatch = error.message.match(/line\s+(\d+)/i);
    const colMatch = error.message.match(/column\s+(\d+)/i);
    if (lineMatch) {
      result.line = parseInt(lineMatch[1], 10);
      result.column = colMatch ? parseInt(colMatch[1], 10) : undefined;
      const lines = code.split('\n');
      const start = Math.max(0, result.line - 3);
      const end = Math.min(lines.length, result.line + 2);
      result.snippet = lines.slice(start, end).map((line, i) => {
        const num = start + i + 1;
        const marker = num === result.line ? '>>>' : '   ';
        return `${marker} ${num.toString().padStart(4)} | ${line}`;
      }).join('\n');
    }
    return result;
  }
}

export function createCompiler(options?: Partial<CompilerOptions>): Compiler {
  return new Compiler(options);
}

export const compiler = new Compiler();
