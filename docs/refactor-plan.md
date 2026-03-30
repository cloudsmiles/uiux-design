# 前端预览项目重构方案

> 结合架构优化与问题修复的完整重构计划
> 创建时间：2026-03-23
> 最后更新：2026-03-23
> 状态：✅ 已完成

---

## 目录

1. [现状分析](#一现状分析)
2. [目标架构](#二目标架构)
3. [核心模块设计](#三核心模块设计)
4. [插件系统](#四插件系统)
5. [Package.json 解析](#五packagejson-解析)
6. [问题修复映射](#六问题修复映射)
7. [文件结构](#七文件结构)
8. [实施计划](#八实施计划)

---

## 一、现状分析

### 1.1 架构问题

```
当前架构（单体文件）
┌─────────────────────────────────────────────────────────────┐
│                      preview.ts (600+ 行)                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ - HTML 模板构建 ──────────────────────────── 耦合       ││
│  │ - 代码转换 (正则替换) ────────────────────── 耦合       ││
│  │ - 依赖分析 (简单正则) ────────────────────── 耦合       ││
│  │ - 截图逻辑 (html2canvas) ─────────────────── 耦合       ││
│  │ - CDN 加载 ───────────────────────────────── 耦合       ││
│  │ - 错误处理 ────────────────────────────────── 耦合       ││
│  │ - 消息通信 ────────────────────────────────── 耦合       ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 1.2 问题汇总

| 类别 | 高优先级 | 中优先级 | 低优先级 | 合计 |
|------|----------|----------|----------|------|
| 编译转换 | 1 | 1 | 2 | 4 |
| 多文件处理 | 2 | 1 | 0 | 3 |
| 依赖管理 | 1 | 1 | 1 | 3 |
| 截图功能 | 0 | 1 | 2 | 3 |
| 错误处理 | 0 | 3 | 0 | 3 |
| 安全性 | 1 | 2 | 0 | 3 |
| 性能优化 | 0 | 3 | 0 | 3 |
| 数据库 | 0 | 1 | 2 | 3 |
| **合计** | **5** | **13** | **7** | **25** |

---

## 二、目标架构

### 2.1 整体架构

```
┌────────────────────────────────────────────────────────────────────────┐
│                           Preview System                                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   Compiler   │  │   Resolver   │  │   Runtime    │  │  Renderer  │ │
│  │   编译器      │  │   解析器      │  │   运行时      │  │   渲染器    │ │
│  │              │  │              │  │              │  │            │ │
│  │ P4:组件名称  │  │ P1:路径解析  │  │ P5:安全通信  │  │ P9:截图优化│ │
│  │ P6:导出处理  │  │ P2:路径格式  │  │ P8:版本管理  │  │ P17-18    │ │
│  │ P10:错误提示 │  │ P7:循环依赖  │  │ P12:大小限制 │  │            │ │
│  │ P15:Hook补全 │  │ P3:依赖stub  │  │ P19:sandbox │  │            │ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
│                                                                        │
│                         ┌─────────────────────┐                        │
│                         │    Plugin System    │                        │
│                         │      插件系统        │                        │
│                         └─────────────────────┘                        │
│                                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ React Plugin │  │  Vue Plugin  │  │  Svelte P.   │  │ HTML Plugin│ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │ Tailwind P.  │  │ TypeScript P.│  │  Sass P.     │  │ Less Plugin│ │
│  └──────────────┘  └──────────────┘  └──────────────┘  └────────────┘ │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────┐
│  ZIP Upload │────▶│   Parser    │────▶│   Resolver  │────▶│ Compiler │
│             │     │ package.json│     │ 依赖图构建   │     │ 代码转换  │
└─────────────┘     └─────────────┘     └─────────────┘     └────┬─────┘
                                                                   │
┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│   Preview   │◀────│   Runtime   │◀────│ HTML Builder│◀─────────┘
│   展示      │     │  执行环境    │     │  HTML生成    │
└─────────────┘     └─────────────┘     └─────────────┘
      │
      ▼
┌─────────────┐
│  Renderer   │
│   截图      │
└─────────────┘
```

---

## 三、核心模块设计

### 3.1 编译器 (Compiler)

**职责**：代码编译、转换、组件名称提取

```typescript
// packages/compiler/src/types.ts
export interface CompilerOptions {
  target: 'es5' | 'es2015' | 'es2017' | 'esnext';
  module: 'umd' | 'esm';
  plugins: CompilerPlugin[];
}

export interface CompileResult {
  code: string;
  componentName: string | null;
  errors: CompileError[];
  dependencies: string[];
}

export interface CompileError {
  message: string;
  line?: number;
  column?: number;
  snippet?: string;
}

// packages/compiler/src/index.ts
export class Compiler {
  private plugins: CompilerPlugin[];

  constructor(options: CompilerOptions) {
    this.plugins = options.plugins || [];
  }

  async compile(code: string, filename: string): Promise<CompileResult> {
    const errors: CompileError[] = [];
    let processed = code;

    try {
      // 1. 移除 import 语句 (P6)
      processed = this.removeImports(processed);

      // 2. 转换 export (P6)
      processed = this.transformExports(processed);

      // 3. 提取组件名称 (P4)
      const componentName = this.extractComponentName(processed);

      // 4. 使用插件链处理
      for (const plugin of this.plugins) {
        if (plugin.test.test(filename)) {
          const result = await plugin.transform(processed, filename);
          processed = result.code;
        }
      }

      return {
        code: processed,
        componentName,
        errors,
        dependencies: this.extractDependencies(code)
      };
    } catch (error) {
      // P10: 友好的错误提示
      errors.push(this.formatError(error as Error, code));
      return { code: '', componentName: null, errors, dependencies: [] };
    }
  }

  // P4: 增强的组件名称提取
  private extractComponentName(code: string): string | null {
    const patterns = [
      /export\s+default\s+function\s+([A-Z]\w+)/,
      /export\s+default\s+class\s+([A-Z]\w+)/,
      /function\s+([A-Z]\w+)\s*[\(<]/,
      /const\s+([A-Z]\w+)\s*=\s*(?:\([^)]*\)|[^=])*=>/,
      /class\s+([A-Z]\w+)\s+extends/
    ];

    for (const pattern of patterns) {
      const match = code.match(pattern);
      if (match) {
        // 验证是否被 export default
        if (!code.includes('export default')) {
          continue;
        }
        return match[1];
      }
    }
    return null;
  }

  // P6: 完整的 import/export 处理
  private removeImports(code: string): string {
    return code
      .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/import\s*\([^)]*\)/g, 'Promise.resolve({ default: function(){} })');
  }

  private transformExports(code: string): string {
    return code
      .replace(/export\s+default\s+function/g, 'function')
      .replace(/export\s+default\s+class/g, 'class')
      .replace(/export\s+default\s+/g, 'const __default__ = ')
      .replace(/export\s+(const|let|var|function|class)\s+/g, '$1 ')
      .replace(/export\s+\{[^}]*\}\s*;?/g, '')
      .replace(/export\s+type\s+\w+\s*=\s*[^;]+;?/g, '')
      .replace(/export\s+interface\s+\w+\s*\{[^}]*\}/g, '');
  }

  // P10: 格式化错误信息
  private formatError(error: Error, code: string): CompileError {
    const lineMatch = error.message.match(/line\s+(\d+)/i);
    const colMatch = error.message.match(/column\s+(\d+)/i);

    const result: CompileError = { message: error.message };

    if (lineMatch) {
      result.line = parseInt(lineMatch[1]);
      result.column = colMatch ? parseInt(colMatch[1]) : undefined;

      // 生成代码片段
      const lines = code.split('\n');
      const start = Math.max(0, result.line - 3);
      const end = Math.min(lines.length, result.line + 2);
      result.snippet = lines.slice(start, end)
        .map((l, i) => `${start + i + 1}: ${l}`)
        .join('\n');
    }

    return result;
  }
}
```

### 3.2 解析器 (Resolver)

**职责**：依赖解析、路径映射、package.json 解析

```typescript
// packages/resolver/src/types.ts
export interface ResolveOptions {
  rootDir: string;
  alias: Record<string, string>;
  extensions: string[];
}

export interface DependencyGraph {
  entry: string;
  files: Map<string, FileInfo>;
  dependencies: Map<string, string[]>;
  externalDeps: ExternalDependency[];
  sortedFiles: string[];
  circularDependencies: string[][]; // P7
  warnings: string[];
}

export interface ExternalDependency {
  name: string;
  version: string;
  cdnUrl?: string;
  globalName?: string;
  stub?: string; // P3: stub 代码
}

// packages/resolver/src/index.ts
export class Resolver {
  private aliasMap: Map<string, string>;

  constructor(options: ResolveOptions) {
    this.aliasMap = new Map(Object.entries(options.alias));
  }

  // P1: 增强的路径解析
  resolve(importPath: string, fromFile: string): string {
    // 1. 处理别名 @/xxx, ~/xxx
    for (const [alias, target] of this.aliasMap) {
      if (importPath.startsWith(alias)) {
        return importPath.replace(alias, target);
      }
    }

    // 2. 处理相对路径 ./xxx
    if (importPath.startsWith('./')) {
      const dir = fromFile.substring(0, fromFile.lastIndexOf('/'));
      return this.normalizePath(`${dir}/${importPath.slice(2)}`);
    }

    // 3. 处理上级路径 ../xxx
    if (importPath.startsWith('../')) {
      let dir = fromFile.substring(0, fromFile.lastIndexOf('/'));
      const parts = importPath.split('/');

      for (const part of parts) {
        if (part === '..') {
          dir = dir.substring(0, dir.lastIndexOf('/'));
        } else if (part !== '.') {
          dir = `${dir}/${part}`;
        }
      }
      return this.normalizePath(dir);
    }

    // 4. 外部依赖
    return importPath;
  }

  // P2: 路径格式标准化
  normalizePath(path: string): string {
    return path
      .replace(/\/+/g, '/')
      .replace(/\/\.\//g, '/')
      .replace(/\/[^/]+\/\.\.\//g, '/')
      .replace(/\.(tsx?|jsx?)$/, '') + '.tsx';
  }

  // P7: 依赖图构建（含循环检测）
  async buildDependencyGraph(
    files: Map<string, string>,
    entry: string
  ): Promise<DependencyGraph> {
    const dependencies = new Map<string, string[]>();
    const circularDependencies: string[][] = [];
    const warnings: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();
    const path: string[] = [];
    const sortedFiles: string[] = [];

    const visit = (filePath: string) => {
      if (visited.has(filePath)) return;

      if (visiting.has(filePath)) {
        // 检测到循环依赖
        const cycleStart = path.indexOf(filePath);
        const cycle = [...path.slice(cycleStart), filePath];
        circularDependencies.push(cycle);
        warnings.push(`循环依赖: ${cycle.join(' → ')}`);
        return;
      }

      visiting.add(filePath);
      path.push(filePath);

      const content = files.get(filePath);
      if (content) {
        const imports = this.parseImports(content);
        dependencies.set(filePath, []);

        for (const imp of imports) {
          const resolved = this.resolve(imp, filePath);
          if (files.has(resolved)) {
            dependencies.get(filePath)!.push(resolved);
            visit(resolved);
          }
        }
      }

      visiting.delete(filePath);
      path.pop();
      visited.add(filePath);
      sortedFiles.push(filePath);
    };

    visit(entry);

    return {
      entry,
      files: new Map(files.entries().map(([k, v]) => [k, { path: k, content: v }])),
      dependencies,
      externalDeps: [],
      sortedFiles,
      circularDependencies,
      warnings
    };
  }

  // 解析 import 语句
  private parseImports(code: string): string[] {
    const imports: string[] = [];
    const regex = /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;
    let match;
    while ((match = regex.exec(code)) !== null) {
      imports.push(match[1]);
    }
    return imports;
  }
}
```

### 3.3 运行时 (Runtime)

**职责**：执行环境管理、依赖加载、消息通信

```typescript
// packages/runtime/src/types.ts
export interface RuntimeOptions {
  container: HTMLElement;
  sandbox: SandboxOptions;
  onError: (error: Error) => void;
}

export interface SandboxOptions {
  permissions: ('scripts' | 'same-origin' | 'forms')[];
  globals: Record<string, unknown>;
}

// packages/runtime/src/index.ts
export class Runtime {
  private iframe: HTMLIFrameElement;

  constructor(options: RuntimeOptions) {
    this.iframe = this.createIframe(options);
  }

  // P3: 加载外部依赖（含 stub）
  async loadDependencies(deps: ExternalDependency[]): Promise<void> {
    for (const dep of deps) {
      if (dep.cdnUrl) {
        await this.loadScript(dep.cdnUrl);
      } else if (dep.stub) {
        this.injectStub(dep.stub);
      }
    }
  }

  // P3: 注入 stub 代码
  private injectStub(stubCode: string): void {
    const script = this.iframe.contentDocument?.createElement('script');
    if (script) {
      script.textContent = stubCode;
      this.iframe.contentDocument?.head.appendChild(script);
    }
  }

  // P5: 安全的消息通信
  sendMessage(type: string, data: unknown): void {
    const origin = this.getParentOrigin();
    this.iframe.contentWindow?.postMessage({ type, ...data }, origin);
  }

  private getParentOrigin(): string {
    try {
      if (window.location.ancestorOrigins?.length > 0) {
        return window.location.ancestorOrigins[0];
      }
    } catch {}
    return window.location.origin || '*';
  }

  // P5: 消息监听
  onMessage(type: string, handler: (data: unknown) => void): () => void {
    const listener = (e: MessageEvent) => {
      // 验证来源
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === type) {
        handler(e.data);
      }
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }
}
```

### 3.4 渲染器 (Renderer)

**职责**：截图、DOM 稳定检测

```typescript
// packages/renderer/src/index.ts
export class Renderer {
  // P9: 智能等待 DOM 稳定
  async waitForStable(element: HTMLElement, timeout = 5000): Promise<void> {
    return new Promise((resolve) => {
      let timer: number;
      const observer = new MutationObserver(() => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          observer.disconnect();
          resolve();
        }, 300) as unknown as number;
      });

      observer.observe(element, {
        childList: true,
        subtree: true,
        attributes: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, timeout);
    });
  }

  // 截图
  async capture(element: HTMLElement, options: CaptureOptions): Promise<string> {
    await this.waitForStable(element);
    // ... html2canvas 逻辑
  }
}
```

---

## 四、插件系统

### 4.1 插件接口

```typescript
// packages/plugin-system/src/types.ts
export interface Plugin {
  name: string;
  version: string;
  // 提供的能力
  provides: PluginCapability[];
  // 钩子函数
  hooks?: Partial<PluginHooks>;
  // 配置选项
  options?: PluginOption[];
}

export interface PluginCapability {
  type: 'compiler' | 'resolver' | 'runtime';
  test?: RegExp;
  handler: (...args: unknown[]) => unknown;
}

export interface PluginHooks {
  beforeCompile: (ctx: PluginContext) => Promise<void>;
  afterCompile: (ctx: PluginContext) => Promise<void>;
  beforeExecute: (ctx: PluginContext) => Promise<void>;
  afterExecute: (ctx: PluginContext) => Promise<void>;
  beforeCapture: (ctx: PluginContext) => Promise<void>;
  afterCapture: (ctx: PluginContext) => Promise<void>;
}
```

### 4.2 内置插件

#### React 插件（P15 Hook 补全）

```typescript
// packages/plugins/react/src/index.ts
export const ReactPlugin: Plugin = {
  name: '@preview/react',
  version: '1.0.0',

  provides: [
    {
      type: 'compiler',
      test: /\.(tsx|jsx)$/,
      handler: async (code: string, filename: string) => {
        const result = Babel.transform(code, {
          presets: ['react', 'typescript'],
          filename
        });
        return { code: result.code! };
      }
    },
    {
      type: 'runtime',
      handler: (runtime: Runtime) => {
        // P15: 补全所有 React 18+ Hooks
        const helpers = `
          const { useState, useEffect, useRef, useMemo, useCallback,
                  Fragment, createContext, useContext, useReducer,
                  forwardRef, memo, lazy, Suspense, StrictMode,
                  useId, useTransition, useDeferredValue,
                  useImperativeHandle, useLayoutEffect,
                  useSyncExternalStore, useInsertionEffect,
                  useDebugValue } = React;
          const { createRoot, createPortal } = ReactDOM;
        `;
        runtime.injectCode(helpers);
      }
    }
  ]
};
```

#### Tailwind 插件

```typescript
// packages/plugins/tailwind/src/index.ts
export const TailwindPlugin: Plugin = {
  name: '@preview/tailwind',
  version: '1.0.0',

  provides: [
    {
      type: 'runtime',
      handler: (runtime: Runtime) => {
        runtime.loadScript('https://cdn.tailwindcss.com');
      }
    }
  ],

  hooks: {
    afterCompile: async (ctx) => {
      // 处理 Tailwind 指令
      const css = ctx.state.files.get('style.css');
      if (css) {
        css.content = css.content
          .replace(/@import\s+['"]tailwindcss['"];?/g, '')
          .replace(/@tailwind\s+\w+;?/g, '');
      }
    }
  }
};
```

---

## 五、Package.json 解析

### 5.1 解析器设计

```typescript
// packages/resolver/src/package-parser.ts

export interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  main?: string;
  module?: string;
  // 自定义预览配置
  preview?: PreviewConfig;
}

export interface PreviewConfig {
  entry?: string;
  dependencies?: Record<string, string>;
  cdn?: Record<string, { url: string; global?: string }>;
  plugins?: string[];
}

export class PackageParser {
  // CDN 映射表
  private static readonly CDN_REGISTRY: Record<string, CDNMapping> = {
    'react': {
      url: 'https://registry.npmmirror.com/react@{version}/umd/react.production.min.js',
      global: 'React'
    },
    'react-dom': {
      url: 'https://registry.npmmirror.com/react-dom@{version}/umd/react-dom.production.min.js',
      global: 'ReactDOM'
    },
    'lodash': {
      url: 'https://registry.npmmirror.com/lodash@{version}/lodash.min.js',
      global: '_',
      stub: `const _ = { debounce: fn => fn, throttle: fn => fn, cloneDeep: obj => JSON.parse(JSON.stringify(obj)) };`
    },
    'axios': {
      url: 'https://registry.npmmirror.com/axios@{version}/dist/axios.min.js',
      global: 'axios',
      stub: `const axios = { get: () => Promise.resolve({data:{}}), post: () => Promise.resolve({data:{}}) };`
    },
    'framer-motion': {
      url: 'https://registry.npmmirror.com/framer-motion@{version}/dist/framer-motion.js',
      global: 'Motion',
      stub: `const motion = new Proxy({}, { get: (_, tag) => tag });`
    },
    'react-router-dom': {
      url: 'https://registry.npmmirror.com/react-router-dom@{version}/umd/react-router-dom.production.min.js',
      global: 'ReactRouterDOM',
      stub: `const { Link, NavLink, Route, Routes, useParams, useNavigate } = { Link: _stub, NavLink: _stub, Route: _stub, Routes: _stub };`
    },
    'dayjs': {
      url: 'https://registry.npmmirror.com/dayjs@{version}/dayjs.min.js',
      global: 'dayjs',
      stub: `const dayjs = (d) => ({ format: () => String(d) });`
    }
  };

  parse(content: string): ParsedPackage {
    const pkg: PackageJson = JSON.parse(content);

    return {
      name: pkg.name,
      version: pkg.version,
      entry: this.resolveEntry(pkg),
      dependencies: this.resolveDependencies(pkg),
      plugins: this.resolvePlugins(pkg)
    };
  }

  private resolveEntry(pkg: PackageJson): string {
    // 优先级：preview.entry > main.tsx > index.tsx > App.tsx > pkg.main
    const entries = [
      pkg.preview?.entry,
      'src/main.tsx', 'src/main.ts',
      'src/index.tsx', 'src/index.ts',
      'src/App.tsx', 'src/App.ts',
      pkg.main
    ].filter(Boolean);

    return entries[0] || 'src/App.tsx';
  }

  private resolveDependencies(pkg: PackageJson): ExternalDependency[] {
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.peerDependencies,
      ...pkg.preview?.dependencies
    };

    const deps: ExternalDependency[] = [];

    for (const [name, version] of Object.entries(allDeps)) {
      // 跳过构建工具
      if (this.isBuildTool(name)) continue;

      const cdnInfo = PackageParser.CDN_REGISTRY[name];
      const normalizedVersion = this.normalizeVersion(version);

      deps.push({
        name,
        version: normalizedVersion,
        cdnUrl: cdnInfo?.url.replace('{version}', normalizedVersion),
        globalName: cdnInfo?.global,
        stub: cdnInfo?.stub // P3: 使用预定义的 stub
      });
    }

    return deps;
  }

  private isBuildTool(name: string): boolean {
    const buildTools = [
      'typescript', 'vite', 'webpack', 'rollup', 'esbuild',
      '@types/', 'eslint', 'prettier', 'babel'
    ];
    return buildTools.some(tool => name.startsWith(tool));
  }

  private normalizeVersion(version: string): string {
    return version.replace(/^[\^~>=<]*/, '');
  }
}
```

---

## 六、问题修复映射

### 6.1 高优先级问题

| 问题 | 模块 | 解决方案 |
|------|------|----------|
| P1: 依赖路径分析 | Resolver | `resolve()` 方法支持 `./`、`../`、别名 |
| P2: 文件路径格式 | Resolver | `normalizePath()` 统一路径格式 |
| P3: 外部依赖 stub | Runtime + PackageParser | CDN_REGISTRY 预定义 stub |
| P4: 组件名称提取 | Compiler | `extractComponentName()` 多模式匹配 |
| P5: postMessage 安全 | Runtime | `getParentOrigin()` 验证来源 |

### 6.2 中优先级问题

| 问题 | 模块 | 解决方案 |
|------|------|----------|
| P6: import/export | Compiler | `removeImports()` + `transformExports()` |
| P7: 循环依赖 | Resolver | `buildDependencyGraph()` 检测并记录 |
| P8: 依赖版本 | PackageParser | 从 package.json 读取版本 |
| P9: 截图时机 | Renderer | `waitForStable()` 智能等待 |
| P10: 错误提示 | Compiler | `formatError()` 带位置信息 |
| P11: API 错误 | (保留原方案) | 统一错误处理中间件 |
| P12: 代码大小 | Runtime | 前后端大小验证 |
| P13: 代码缓存 | PreviewManager | Map 缓存编译结果 |
| P14: 批量插入 | (保留原方案) | 批量 SQL |

### 6.3 低优先级问题

| 问题 | 模块 | 解决方案 |
|------|------|----------|
| P15: Hook 补全 | ReactPlugin | 注入完整 Hook 列表 |
| P16: Babel 配置 | Compiler | 按需添加 plugins |
| P17-18: 截图优化 | Renderer | 降级提示、可配置尺寸 |
| P19: sandbox 配置 | Runtime | 统一配置策略 |
| P20: 截图存储 | (保留原方案) | 文件存储替代 base64 |
| P21: 数据库索引 | (保留原方案) | 添加必要索引 |

---

## 七、文件结构

```
uiux-design/
├── packages/                      # Monorepo 核心包
│   ├── compiler/                  # 编译器
│   │   ├── src/
│   │   │   ├── index.ts          # 入口
│   │   │   ├── types.ts          # 类型定义
│   │   │   ├── transformer.ts    # import/export 转换
│   │   │   └── extractor.ts      # 组件名称提取
│   │   ├── test/
│   │   └── package.json
│   │
│   ├── resolver/                  # 解析器
│   │   ├── src/
│   │   │   ├── index.ts          # 入口
│   │   │   ├── types.ts          # 类型定义
│   │   │   ├── package-parser.ts # package.json 解析
│   │   │   ├── path-resolver.ts  # 路径解析 (P1, P2)
│   │   │   └── dependency-graph.ts # 依赖图 (P7)
│   │   └── package.json
│   │
│   ├── runtime/                   # 运行时
│   │   ├── src/
│   │   │   ├── index.ts          # 入口
│   │   │   ├── types.ts          # 类型定义
│   │   │   ├── sandbox.ts        # 沙箱管理 (P19)
│   │   │   ├── messenger.ts      # 消息通信 (P5)
│   │   │   └── stubs.ts          # 依赖 stub (P3)
│   │   └── package.json
│   │
│   ├── renderer/                  # 渲染器
│   │   ├── src/
│   │   │   ├── index.ts          # 入口
│   │   │   ├── types.ts          # 类型定义
│   │   │   ├── stable.ts         # DOM 稳定检测 (P9)
│   │   │   └── capture.ts        # 截图逻辑 (P17-18)
│   │   └── package.json
│   │
│   ├── plugin-system/             # 插件系统
│   │   ├── src/
│   │   │   ├── index.ts          # 入口
│   │   │   ├── types.ts          # 类型定义
│   │   │   └── manager.ts        # 插件管理器
│   │   └── package.json
│   │
│   └── plugins/                   # 官方插件
│       ├── react/
│       │   ├── src/index.ts      # React 插件 (P15)
│       │   └── package.json
│       ├── tailwind/
│       │   ├── src/index.ts      # Tailwind 插件
│       │   └── package.json
│       ├── typescript/
│       │   ├── src/index.ts      # TypeScript 插件
│       │   └── package.json
│       └── html/
│           ├── src/index.ts      # HTML 插件
│           └── package.json
│
├── client/                        # 前端应用
│   └── src/
│       ├── lib/
│       │   ├── preview/
│       │   │   ├── index.ts      # 导出
│       │   │   ├── manager.ts    # 预览管理器 (P13)
│       │   │   └── legacy.ts     # 兼容层
│       │   └── api/
│       │       └── index.ts      # API (P11)
│       └── pages/
│
├── server/                        # 后端服务
│   └── src/
│       ├── services/
│       │   ├── component-service.ts # (P14)
│       │   └── zip-parser-v2.ts     # ZIP 解析升级
│       └── routes/
│
├── docs/                          # 文档
│   ├── preview-architecture.md    # 原架构文档
│   ├── optimization-plan.md       # 问题清单
│   ├── architecture-redesign.md   # 新架构设计
│   └── refactor-plan.md           # 本文档
│
├── pnpm-workspace.yaml           # Monorepo 配置
└── package.json
```

---

## 八、实施计划

### 阶段一：核心架构（3-4 天）

| 任务 | 解决问题 | 预估时间 |
|------|----------|----------|
| Monorepo 搭建 | - | 0.5 天 |
| 核心 Types 定义 | - | 0.5 天 |
| Plugin System | - | 1 天 |
| Compiler 实现 | P4, P6, P10, P15 | 1 天 |
| Resolver 实现 | P1, P2, P7 | 1 天 |

### 阶段二：运行时与插件（2-3 天）

| 任务 | 解决问题 | 预估时间 |
|------|----------|----------|
| Runtime 实现 | P3, P5, P19 | 1 天 |
| Renderer 实现 | P9, P17-18 | 0.5 天 |
| React 插件 | P15 | 0.5 天 |
| Tailwind 插件 | - | 0.5 天 |
| Package Parser | P8 | 0.5 天 |

### 阶段三：集成与迁移（2 天）

| 任务 | 解决问题 | 预估时间 |
|------|----------|----------|
| ZIP 解析升级 | P2 | 0.5 天 |
| Preview Manager | P13 | 1 天 |
| 兼容层 + 测试 | - | 0.5 天 |

### 阶段四：其他优化（1-2 天）

| 任务 | 解决问题 | 预估时间 |
|------|----------|----------|
| API 错误处理 | P11 | 0.5 天 |
| 代码大小限制 | P12 | 0.5 天 |
| 批量数据库优化 | P14 | 0.5 天 |
| 数据库索引 | P21 | 0.5 天 |

---

## 九、迁移策略

### 渐进式迁移

```typescript
// 1. 保留旧接口
export function buildPreviewHtml(code: string, files?: Record<string, string>): string {
  // 使用新架构实现
  const manager = PreviewManager.create({
    plugins: [ReactPlugin, TailwindPlugin]
  });
  return manager.buildPreview(code, files);
}

// 2. 新接口
export function createPreview(config: PreviewConfig): PreviewManager {
  return new PreviewManager(config);
}
```

### 兼容性保证

- ✅ 现有 API 不变
- ✅ 新增配置项可选
- ✅ 渐进式迁移内部实现
- ✅ 保留旧代码作为 fallback

---

## 十、参考项目

| 项目 | 参考价值 |
|------|----------|
| [CodeSandbox](https://github.com/codesandbox/codesandbox-client) | 依赖解析、沙箱设计 |
| [Sandpack](https://github.com/codesandbox/sandpack) | 插件系统、组件设计 |
| [Vite](https://github.com/vitejs/vite) | 插件系统设计 |
| [esm.sh](https://github.com/ije/esm.sh) | npm 包 CDN 方案 |

---

> 文档版本：v2.0
> 最后更新：2026-03-23
> 合并自：optimization-plan.md + architecture-redesign.md
