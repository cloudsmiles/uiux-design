/**
 * Dependency resolver and package.json parser
 */

import type {
  FileInfo, ExternalDependency, DependencyGraph,
  PackageJson, PackagePreviewConfig, CDNMapping,
} from './types';

const DEFAULT_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js', '.json', '.css'];

/** CDN Registry for common packages (China-accessible mirrors) */
export const CDN_REGISTRY: Record<string, CDNMapping> = {
  'react': {
    url: 'https://registry.npmmirror.com/react@{version}/umd/react.production.min.js',
    global: 'React',
  },
  'react-dom': {
    url: 'https://registry.npmmirror.com/react-dom@{version}/umd/react-dom.production.min.js',
    global: 'ReactDOM',
  },
  'zustand': { url: 'https://registry.npmmirror.com/zustand@{version}/umd/react.production.min.js', global: 'zustand', stub: 'const zustand = {};' },
  'jotai': { url: 'https://registry.npmmirror.com/jotai@{version}/umd/jotai.min.js', global: 'jotai', stub: 'const jotai = {};' },
  'react-router-dom': {
    url: 'https://registry.npmmirror.com/react-router-dom@{version}/umd/react-router-dom.production.min.js',
    global: 'ReactRouterDOM',
    stub: `const { Link, NavLink, Route, Routes, useParams, useNavigate, useLocation } = { Link: _stub, NavLink: _stub, Route: _stub, Routes: _stub, useParams: () => ({}), useNavigate: () => (() => {}), useLocation: () => ({ pathname: '/' }) };`,
  },
  'framer-motion': {
    url: 'https://registry.npmmirror.com/framer-motion@{version}/dist/framer-motion.js',
    global: 'Motion',
    stub: 'const motion = new Proxy({}, { get: (_, tag) => tag }); const AnimatePresence = ({ children }) => children;',
  },
  'lucide-react': { url: 'https://registry.npmmirror.com/lucide-react@{version}/dist/umd/lucide-react.min.js', global: 'lucide', stub: 'const lucide = {};' },
  'lodash': {
    url: 'https://registry.npmmirror.com/lodash@{version}/lodash.min.js', global: '_',
    stub: 'const _ = { debounce: fn => fn, throttle: fn => fn, cloneDeep: obj => JSON.parse(JSON.stringify(obj)), get: (obj, path) => path.split(".").reduce((o, k) => o?.[k], obj) };',
  },
  'axios': {
    url: 'https://registry.npmmirror.com/axios@{version}/dist/axios.min.js', global: 'axios',
    stub: 'const axios = { get: () => Promise.resolve({ data: {} }), post: () => Promise.resolve({ data: {} }), put: () => Promise.resolve({ data: {} }), delete: () => Promise.resolve({ data: {} }) };',
  },
  'dayjs': {
    url: 'https://registry.npmmirror.com/dayjs@{version}/dayjs.min.js', global: 'dayjs',
    stub: 'const dayjs = (d) => ({ format: () => String(d), valueOf: () => Date.now() });',
  },
  '@headlessui/react': { url: '', stub: 'const HeadlessUI = {};' },
  '@radix-ui/react-dialog': { url: '', stub: 'const RadixDialog = {};' },
};

const BUILD_TOOLS = [
  'typescript', 'vite', 'webpack', 'rollup', 'esbuild', 'babel', 'eslint', 'prettier',
  '@types/', '@babel/', 'tailwindcss', 'autoprefixer', 'postcss', 'sass', 'less',
];

export class Resolver {
  private aliasMap: Map<string, string>;
  private extensions: string[];

  constructor(options?: { alias?: Record<string, string>; extensions?: string[] }) {
    this.aliasMap = new Map(Object.entries(options?.alias || {}));
    this.extensions = options?.extensions || DEFAULT_EXTENSIONS;
  }

  parsePackageJson(content: string): {
    name: string; version: string; entry: string;
    dependencies: ExternalDependency[]; previewConfig?: PackagePreviewConfig;
  } {
    const pkg: PackageJson = JSON.parse(content);
    return {
      name: pkg.name || 'unknown',
      version: pkg.version || '0.0.0',
      entry: this.resolveEntry(pkg),
      dependencies: this.resolveDependencies(pkg),
      previewConfig: pkg.preview,
    };
  }

  private resolveEntry(pkg: PackageJson): string {
    const candidates = [
      pkg.preview?.entry, 'src/main.tsx', 'src/main.ts', 'src/index.tsx', 'src/index.ts',
      'src/App.tsx', 'src/App.ts', 'index.tsx', 'index.ts', pkg.main,
    ].filter(Boolean) as string[];
    return candidates[0] || 'src/App.tsx';
  }

  private resolveDependencies(pkg: PackageJson): ExternalDependency[] {
    const allDeps = { ...pkg.dependencies, ...pkg.peerDependencies, ...pkg.preview?.dependencies };
    const deps: ExternalDependency[] = [];
    for (const [name, version] of Object.entries(allDeps)) {
      if (this.isBuildTool(name)) continue;
      const normalizedVersion = this.normalizeVersion(version);
      const cdnInfo = this.getCDNInfo(name, normalizedVersion, pkg.preview?.cdn);
      deps.push({
        name, version: normalizedVersion,
        type: pkg.dependencies?.[name] ? 'production' : pkg.peerDependencies?.[name] ? 'peer' : 'dev',
        ...cdnInfo,
      });
    }
    return deps;
  }

  private isBuildTool(name: string): boolean {
    return BUILD_TOOLS.some(tool => name.startsWith(tool) || name === tool);
  }

  private normalizeVersion(version: string): string {
    return version.replace(/^[\^~>=<]+/, '');
  }

  private getCDNInfo(
    name: string, version: string,
    customCdn?: Record<string, { url: string; global?: string }>
  ): { cdnUrl?: string; globalName?: string; stub?: string } {
    if (customCdn?.[name]) {
      return { cdnUrl: customCdn[name].url.replace('{version}', version), globalName: customCdn[name].global };
    }
    const registry = CDN_REGISTRY[name];
    if (registry) {
      return { cdnUrl: registry.url?.replace('{version}', version), globalName: registry.global, stub: registry.stub };
    }
    return { cdnUrl: `https://esm.sh/${name}@${version}`, globalName: name.replace(/[-/](\w)/g, (_, c) => c.toUpperCase()) };
  }

  resolve(importPath: string, fromFile: string): string {
    for (const [alias, target] of this.aliasMap) {
      if (importPath.startsWith(alias)) return this.normalizePath(importPath.replace(alias, target));
    }
    if (importPath.startsWith('./')) {
      const dir = fromFile.substring(0, fromFile.lastIndexOf('/'));
      return this.normalizePath(`${dir}/${importPath.slice(2)}`);
    }
    if (importPath.startsWith('../')) {
      let dir = fromFile.substring(0, fromFile.lastIndexOf('/'));
      for (const part of importPath.split('/')) {
        if (part === '..') dir = dir.substring(0, dir.lastIndexOf('/'));
        else if (part !== '.') dir = `${dir}/${part}`;
      }
      return this.normalizePath(dir);
    }
    return importPath;
  }

  normalizePath(path: string): string {
    let normalized = path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/\.\//g, '/');
    while (normalized.includes('/../')) normalized = normalized.replace(/\/[^/]+\/\.\.\//, '/');
    if (normalized.startsWith('./')) normalized = normalized.slice(2);
    return normalized;
  }

  resolveExtension(path: string, availableFiles: Set<string> | Map<string, unknown>): string {
    if (/\.\w+$/.test(path) && availableFiles.has(path)) return path;
    for (const ext of this.extensions) {
      if (availableFiles.has(path + ext)) return path + ext;
      if (availableFiles.has(`${path}/index${ext}`)) return `${path}/index${ext}`;
    }
    return path;
  }

  parseImports(code: string): string[] {
    const imports: string[] = [];
    const regex = /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(code)) !== null) imports.push(match[1]);
    return imports;
  }

  buildDependencyGraph(files: Map<string, string>, entry: string): DependencyGraph;
  buildDependencyGraph(files: FileInfo[], entryCode: string, packageJson?: Record<string, unknown> | null): DependencyGraph;
  buildDependencyGraph(
    files: Map<string, string> | FileInfo[], entryOrCode: string,
    packageJson?: Record<string, unknown> | null
  ): DependencyGraph {
    let fileMap: Map<string, string>;
    let entry: string;

    if (Array.isArray(files)) {
      fileMap = new Map();
      for (const f of files) fileMap.set(f.path, f.content);
      entry = this.findEntryPoint(fileMap);
    } else {
      fileMap = files;
      entry = entryOrCode;
    }

    const dependencies = new Map<string, string[]>();
    const circularDependencies: string[][] = [];
    const warnings: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const pathStack: string[] = [];
    const sortedFiles: string[] = [];
    const fileInfoMap = new Map<string, FileInfo>();
    const externalDeps: ExternalDependency[] = [];

    for (const [filePath, content] of fileMap) {
      fileInfoMap.set(filePath, {
        path: filePath, originalPath: filePath, content,
        name: filePath.split('/').pop()?.replace(/\.\w+$/, '') || '',
        ext: filePath.split('.').pop() || '',
      });
    }

    if (packageJson && typeof packageJson === 'object') {
      const deps = (packageJson as PackageJson).dependencies || {};
      for (const [name, version] of Object.entries(deps)) {
        if (!this.isBuildTool(name)) {
          externalDeps.push({ name, version: this.normalizeVersion(version), type: 'production' });
        }
      }
    }

    const visit = (filePath: string): void => {
      if (visited.has(filePath)) return;
      if (visiting.has(filePath)) {
        const cycleStart = pathStack.indexOf(filePath);
        const cycle = [...pathStack.slice(cycleStart), filePath];
        circularDependencies.push(cycle);
        warnings.push(`Circular dependency: ${cycle.join(' → ')}`);
        return;
      }
      visiting.add(filePath);
      pathStack.push(filePath);

      const content = fileMap.get(filePath);
      if (content) {
        const imports = this.parseImports(content);
        dependencies.set(filePath, []);
        for (const imp of imports) {
          const resolved = this.resolve(imp, filePath);
          const withExt = this.resolveExtension(resolved, fileMap);
          if (fileMap.has(withExt)) {
            dependencies.get(filePath)!.push(withExt);
            visit(withExt);
          } else if (!imp.startsWith('.') && !imp.startsWith('/')) {
            if (!externalDeps.find(d => d.name === imp)) {
              externalDeps.push({ name: imp, version: 'latest', type: 'production' });
            }
          }
        }
      }
      visiting.delete(filePath);
      pathStack.pop();
      visited.add(filePath);
      sortedFiles.push(filePath);
    };

    visit(entry);

    return { entry, files: fileInfoMap, dependencies, externalDeps, sortedFiles, circularDependencies, warnings };
  }

  private findEntryPoint(files: Map<string, string>): string {
    const candidates = [
      'src/main.tsx', 'src/main.ts', 'src/index.tsx', 'src/index.ts',
      'main.tsx', 'main.ts', 'index.tsx', 'index.ts',
      'src/App.tsx', 'src/App.ts', 'App.tsx', 'App.ts',
    ];
    for (const c of candidates) { if (files.has(c)) return c; }
    for (const [p] of files) { if (p.endsWith('.tsx') || p.endsWith('.ts')) return p; }
    return files.keys().next().value || 'App.tsx';
  }

  resolveCDN(dep: ExternalDependency | string): string[] | null {
    const name = typeof dep === 'string' ? dep : dep.name;
    const version = typeof dep === 'string' ? 'latest' : dep.version;
    const registry = CDN_REGISTRY[name];
    if (registry?.url) return [registry.url.replace('{version}', version || 'latest')];
    return [`https://esm.sh/${name}@${version}`];
  }
}

export function createResolver(options?: { alias?: Record<string, string>; extensions?: string[] }): Resolver {
  return new Resolver(options);
}

export const resolver = new Resolver();
