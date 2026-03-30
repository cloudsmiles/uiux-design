# 前端预览项目架构重构方案

> 参考 CodeSandbox、StackBlitz、Sandpack 等主流项目
> 创建时间：2026-03-23
> 状态：设计方案

---

## 一、现状问题分析

### 当前架构的局限性

```
┌─────────────────────────────────────────────────────────────┐
│                      preview.ts (单体文件)                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ - HTML 模板构建                                          ││
│  │ - 代码转换 (正则替换)                                     ││
│  │ - 依赖分析 (简单正则)                                     ││
│  │ - 截图逻辑 (html2canvas)                                 ││
│  │ - CDN 加载                                               ││
│  │ - 错误处理                                               ││
│  │ - 消息通信                                               ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**问题**：
1. **耦合度高** - 所有逻辑集中在一个文件，难以维护和扩展
2. **扩展性差** - 新增依赖、框架支持需要修改核心代码
3. **不可配置** - 编译选项、运行时环境硬编码
4. **无插件机制** - 无法动态扩展功能
5. **依赖解析简陋** - 不支持 package.json、别名、monorepo

---

## 二、目标架构设计

### 整体架构图

```
┌────────────────────────────────────────────────────────────────────────┐
│                           Preview System                                │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │
│  │   Compiler   │  │   Resolver   │  │   Runtime    │  │  Renderer  │ │
│  │   编译器      │  │   解析器      │  │   运行时      │  │   渲染器    │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └─────┬──────┘ │
│         │                 │                 │                 │        │
│         └─────────────────┴─────────────────┴─────────────────┘        │
│                                    │                                   │
│                         ┌──────────▼──────────┐                        │
│                         │     Plugin System   │                        │
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

### 核心模块职责

| 模块 | 职责 | 输入 | 输出 |
|------|------|------|------|
| **Compiler** | 代码编译、转换 | 源代码 | 可执行代码 |
| **Resolver** | 依赖解析、路径映射 | import/export | 依赖图 |
| **Runtime** | 运行时环境管理 | 编译后代码 | 执行环境 |
| **Renderer** | UI 渲染、截图 | 运行时状态 | 可视化输出 |
| **Plugin System** | 功能扩展 | 插件配置 | 增强功能 |

---

## 三、核心模块设计

### 3.1 编译器 (Compiler)

```typescript
// packages/compiler/src/types.ts
export interface CompilerOptions {
  // 目标环境
  target: 'es5' | 'es2015' | 'es2017' | 'esnext';
  // 模块格式
  module: 'umd' | 'esm' | 'cjs';
  // Source Map
  sourceMap: boolean;
  // 压缩
  minify: boolean;
  // 插件
  plugins: CompilerPlugin[];
}

export interface CompilerPlugin {
  name: string;
  // 文件类型匹配
  test: RegExp;
  // 转换函数
  transform(code: string, filename: string): Promise<TransformResult>;
}

export interface TransformResult {
  code: string;
  map?: string;
  dependencies?: string[];
}

// packages/compiler/src/index.ts
export class Compiler {
  private plugins: Map<string, CompilerPlugin> = new Map();

  constructor(options: Partial<CompilerOptions>) {
    this.loadDefaultPlugins();
    this.loadCustomPlugins(options.plugins || []);
  }

  async compile(code: string, filename: string): Promise<TransformResult> {
    const ext = path.extname(filename);
    const plugin = this.findPlugin(ext);

    if (!plugin) {
      return { code };
    }

    return plugin.transform(code, filename);
  }
}
```

### 3.2 解析器 (Resolver)

```typescript
// packages/resolver/src/types.ts
export interface ResolveOptions {
  // 项目根目录
  rootDir: string;
  // 路径别名
  alias: Record<string, string>;
  // 扩展名
  extensions: string[];
  // 外部依赖（不打包）
  externals: string[];
  // package.json 内容
  packageJson: PackageJson;
}

export interface DependencyGraph {
  // 入口文件
  entry: string;
  // 所有文件
  files: Map<string, FileInfo>;
  // 依赖关系
  dependencies: Map<string, string[]>;
  // 外部依赖
  externalDeps: ExternalDependency[];
  // 拓扑排序结果
  sortedFiles: string[];
}

export interface ExternalDependency {
  name: string;
  version: string;
  // CDN URL
  cdnUrl?: string;
  // 全局变量名
  globalName?: string;
}

// packages/resolver/src/index.ts
export class Resolver {
  private aliasMap: Map<string, string>;
  private packageJson: PackageJson;

  constructor(options: ResolveOptions) {
    this.aliasMap = new Map(Object.entries(options.alias));
    this.packageJson = options.packageJson;
  }

  // 解析 package.json 中的依赖
  parseDependencies(): ExternalDependency[] {
    const deps: ExternalDependency[] = [];
    const allDeps = {
      ...this.packageJson.dependencies,
      ...this.packageJson.peerDependencies,
      ...this.packageJson.devDependencies
    };

    for (const [name, version] of Object.entries(allDeps)) {
      const cdnInfo = this.getCDNInfo(name, version);
      deps.push({
        name,
        version: this.normalizeVersion(version),
        ...cdnInfo
      });
    }

    return deps;
  }

  // 解析 import 路径
  resolve(importPath: string, fromFile: string): string {
    // 1. 处理别名 @/xxx, ~/xxx
    if (this.isAlias(importPath)) {
      return this.resolveAlias(importPath);
    }

    // 2. 处理相对路径 ./xxx, ../xxx
    if (this.isRelative(importPath)) {
      return this.resolveRelative(importPath, fromFile);
    }

    // 3. 处理包导入 react, lodash
    return importPath; // 外部依赖
  }

  // 构建依赖图
  async buildDependencyGraph(entry: string): Promise<DependencyGraph> {
    const files = new Map<string, FileInfo>();
    const dependencies = new Map<string, string[]>();
    const visited = new Set<string>();

    const visit = async (filePath: string) => {
      if (visited.has(filePath)) return;
      visited.add(filePath);

      const content = await this.readFile(filePath);
      const imports = this.parseImports(content);

      files.set(filePath, {
        path: filePath,
        content,
        imports
      });

      dependencies.set(filePath, []);

      for (const imp of imports) {
        const resolved = this.resolve(imp.source, filePath);

        if (this.isExternal(resolved)) {
          // 外部依赖
        } else {
          dependencies.get(filePath)!.push(resolved);
          await visit(resolved);
        }
      }
    };

    await visit(entry);

    return {
      entry,
      files,
      dependencies,
      externalDeps: this.parseDependencies(),
      sortedFiles: this.topologicalSort(files, dependencies)
    };
  }
}
```

### 3.3 运行时 (Runtime)

```typescript
// packages/runtime/src/types.ts
export interface RuntimeOptions {
  // 容器元素
  container: HTMLElement;
  // 沙箱配置
  sandbox: SandboxOptions;
  // 错误处理
  onError: (error: Error) => void;
  // 日志处理
  onLog: (log: LogEntry) => void;
}

export interface SandboxOptions {
  // 允许的权限
  permissions: ('scripts' | 'same-origin' | 'forms' | 'popups')[];
  // 全局变量注入
  globals: Record<string, unknown>;
  // 禁止访问的 API
  forbiddenAPIs: string[];
}

// packages/runtime/src/index.ts
export class Runtime {
  private iframe: HTMLIFrameElement;
  private sandbox: SandboxOptions;
  private loadedDeps: Map<string, unknown> = new Map();

  constructor(options: RuntimeOptions) {
    this.sandbox = options.sandbox;
    this.iframe = this.createIframe(options.container);
  }

  // 加载外部依赖
  async loadDependency(dep: ExternalDependency): Promise<void> {
    if (this.loadedDeps.has(dep.name)) return;

    // 根据依赖类型选择加载方式
    if (dep.cdnUrl) {
      await this.loadScript(dep.cdnUrl);
      if (dep.globalName) {
        this.loadedDeps.set(dep.name, this.getGlobal(dep.globalName));
      }
    } else {
      // 从 npm 加载
      const moduleUrl = this.getModuleUrl(dep);
      await this.loadScript(moduleUrl);
    }
  }

  // 执行编译后的代码
  async execute(code: string, deps: ExternalDependency[]): Promise<void> {
    // 1. 加载所有依赖
    await Promise.all(deps.map(dep => this.loadDependency(dep)));

    // 2. 注入全局变量
    this.injectGlobals();

    // 3. 执行代码
    this.runCode(code);
  }

  // 消息通信
  onMessage(type: string, handler: (data: unknown) => void): void {
    window.addEventListener('message', (e) => {
      if (e.data?.type === type) {
        handler(e.data);
      }
    });
  }

  sendMessage(type: string, data: unknown): void {
    this.iframe.contentWindow?.postMessage({ type, ...data }, '*');
  }
}
```

### 3.4 渲染器 (Renderer)

```typescript
// packages/renderer/src/types.ts
export interface RendererOptions {
  // 截图配置
  capture: CaptureOptions;
  // 主题
  theme: 'light' | 'dark';
  // 尺寸
  viewport: { width: number; height: number };
}

export interface CaptureOptions {
  // 是否启用截图
  enabled: boolean;
  // 截图格式
  format: 'webp' | 'png' | 'jpeg';
  // 质量
  quality: number;
  // 缩放
  scale: number;
  // 延迟
  delay: number;
  // 等待策略
  waitFor: 'timeout' | 'stable' | 'manual';
}

// packages/renderer/src/index.ts
export class Renderer {
  private canvas: HTMLCanvasElement;
  private options: RendererOptions;

  constructor(options: RendererOptions) {
    this.options = options;
  }

  // 截图
  async capture(element: HTMLElement): Promise<string> {
    // 等待渲染稳定
    await this.waitForStable(element);

    // 使用 html2canvas 或原生截图
    const result = await this.renderToCanvas(element);

    // 导出为指定格式
    return this.toDataURL(result);
  }

  private async waitForStable(element: HTMLElement): Promise<void> {
    const { waitFor, delay } = this.options.capture;

    switch (waitFor) {
      case 'timeout':
        await new Promise(r => setTimeout(r, delay));
        break;

      case 'stable':
        await this.waitForDOMStable(element);
        break;

      case 'manual':
        // 等待外部调用 capture()
        break;
    }
  }

  private waitForDOMStable(element: HTMLElement): Promise<void> {
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

      // 超时保护
      setTimeout(() => {
        observer.disconnect();
        resolve();
      }, 5000);
    });
  }
}
```

---

## 四、插件系统设计

### 4.1 插件接口定义

```typescript
// packages/plugin-system/src/types.ts

// 插件生命周期
export type PluginHook =
  | 'beforeCompile'      // 编译前
  | 'afterCompile'       // 编译后
  | 'beforeResolve'      // 解析前
  | 'afterResolve'       // 解析后
  | 'beforeExecute'      // 执行前
  | 'afterExecute'       // 执行后
  | 'beforeCapture'      // 截图前
  | 'afterCapture';      // 截图后

// 插件定义
export interface Plugin {
  // 插件名称
  name: string;
  // 插件版本
  version: string;
  // 依赖的其他插件
  dependencies?: string[];
  // 提供的能力
  provides?: PluginCapability[];
  // 配置选项
  options?: PluginOptions;
  // 生命周期钩子
  hooks: Partial<Record<PluginHook, PluginHookHandler>>;
}

export interface PluginCapability {
  // 能力类型
  type: 'compiler' | 'resolver' | 'runtime' | 'renderer';
  // 文件匹配
  test?: RegExp;
  // 处理函数
  handler: (...args: unknown[]) => unknown;
}

export interface PluginContext {
  // 当前预览状态
  state: PreviewState;
  // 配置
  config: PreviewConfig;
  // 工具函数
  utils: PluginUtils;
  // 其他插件
  plugins: Map<string, Plugin>;
}

// 插件管理器
export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private hooks: Map<PluginHook, PluginHookHandler[]> = new Map();

  // 注册插件
  register(plugin: Plugin): void {
    this.validatePlugin(plugin);
    this.plugins.set(plugin.name, plugin);

    // 注册钩子
    for (const [hook, handler] of Object.entries(plugin.hooks)) {
      if (!this.hooks.has(hook as PluginHook)) {
        this.hooks.set(hook as PluginHook, []);
      }
      this.hooks.get(hook as PluginHook)!.push(handler);
    }
  }

  // 执行钩子
  async runHook(hook: PluginHook, context: PluginContext): Promise<void> {
    const handlers = this.hooks.get(hook) || [];
    for (const handler of handlers) {
      await handler(context);
    }
  }

  // 获取能力
  getCapability(type: string, test: string): PluginCapability | undefined {
    for (const plugin of this.plugins.values()) {
      const cap = plugin.provides?.find(
        c => c.type === type && (!c.test || c.test.test(test))
      );
      if (cap) return cap;
    }
    return undefined;
  }
}
```

### 4.2 内置插件示例

#### React 插件

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
        // 使用 Babel 编译 React/TypeScript
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
        // 注入 React 全局变量
        runtime.registerGlobal('React', React);
        runtime.registerGlobal('ReactDOM', ReactDOM);
      }
    }
  ],

  hooks: {
    beforeExecute: async (ctx) => {
      // 注入 React Helper
      ctx.state.globals.__react_helpers__ = {
        useState, useEffect, useRef, useMemo, useCallback,
        createContext, useContext, useReducer, forwardRef, memo,
        useId, useTransition, useDeferredValue
      };
    }
  },

  options: {
    // React 版本
    version: {
      type: 'string',
      default: '18.2.0'
    },
    // 是否启用 Fast Refresh
    fastRefresh: {
      type: 'boolean',
      default: true
    }
  }
};
```

#### Tailwind 插件

```typescript
// packages/plugins/tailwind/src/index.ts
export const TailwindPlugin: Plugin = {
  name: '@preview/tailwind',
  version: '1.0.0',
  dependencies: ['@preview/react'],

  provides: [
    {
      type: 'runtime',
      handler: (runtime: Runtime) => {
        // 注入 Tailwind CDN
        runtime.loadScript('https://cdn.tailwindcss.com');
      }
    }
  ],

  hooks: {
    afterCompile: async (ctx) => {
      // 处理 Tailwind 指令
      const css = ctx.state.files.get('style.css')?.content;
      if (css) {
        ctx.state.files.set('style.css', {
          content: css
            .replace(/@import\s+['"]tailwindcss['"];?/g, '')
            .replace(/@tailwind\s+\w+;?/g, '')
        });
      }
    }
  },

  options: {
    version: {
      type: 'string',
      default: '3.4.17'
    },
    config: {
      type: 'object',
      default: {}
    }
  }
};
```

#### TypeScript 插件

```typescript
// packages/plugins/typescript/src/index.ts
export const TypeScriptPlugin: Plugin = {
  name: '@preview/typescript',
  version: '1.0.0',

  provides: [
    {
      type: 'compiler',
      test: /\.tsx?$/,
      handler: async (code: string, filename: string) => {
        // 使用 TypeScript Compiler API 或 Babel
        const result = Babel.transform(code, {
          presets: [['typescript', { isTSX: true, allExtensions: true }]],
          filename
        });
        return { code: result.code! };
      }
    }
  ],

  options: {
    target: {
      type: 'string',
      enum: ['es5', 'es2015', 'es2017', 'esnext'],
      default: 'es2017'
    },
    strict: {
      type: 'boolean',
      default: false
    }
  }
};
```

---

## 五、Package.json 解析方案

### 5.1 解析器设计

```typescript
// packages/resolver/src/package-parser.ts

export interface PackageJson {
  name: string;
  version: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  main?: string;
  module?: string;
  types?: string;
  // 自定义预览配置
  preview?: PreviewConfig;
}

export interface PreviewConfig {
  // 入口文件
  entry?: string;
  // 额外依赖
  dependencies?: Record<string, string>;
  // CDN 映射
  cdn?: Record<string, { url: string; global?: string }>;
  // 插件
  plugins?: string[];
  // 运行时配置
  runtime?: {
    sandbox?: string[];
    globals?: Record<string, unknown>;
  };
}

export class PackageParser {
  // 标准 CDN 映射
  private static readonly CDN_REGISTRY: Record<string, CDNMapping> = {
    // React 生态
    'react': {
      url: 'https://cdn.jsdelivr.net/npm/react@{version}/umd/react.production.min.js',
      global: 'React'
    },
    'react-dom': {
      url: 'https://cdn.jsdelivr.net/npm/react-dom@{version}/umd/react-dom.production.min.js',
      global: 'ReactDOM'
    },

    // 工具库
    'lodash': {
      url: 'https://cdn.jsdelivr.net/npm/lodash@{version}/lodash.min.js',
      global: '_'
    },
    'dayjs': {
      url: 'https://cdn.jsdelivr.net/npm/dayjs@{version}/dayjs.min.js',
      global: 'dayjs'
    },
    'axios': {
      url: 'https://cdn.jsdelivr.net/npm/axios@{version}/dist/axios.min.js',
      global: 'axios'
    },

    // 状态管理
    'zustand': {
      url: 'https://cdn.jsdelivr.net/npm/zustand@{version}/umd/react.production.min.js',
      global: 'zustand'
    },
    'jotai': {
      url: 'https://cdn.jsdelivr.net/npm/jotai@{version}/umd/jotai.min.js',
      global: 'jotai'
    },

    // 路由
    'react-router-dom': {
      url: 'https://cdn.jsdelivr.net/npm/react-router-dom@{version}/umd/react-router-dom.production.min.js',
      global: 'ReactRouterDOM'
    },

    // UI 组件库
    'framer-motion': {
      url: 'https://cdn.jsdelivr.net/npm/framer-motion@{version}/dist/framer-motion.js',
      global: 'Motion'
    },

    // 图标
    'lucide-react': {
      url: 'https://cdn.jsdelivr.net/npm/lucide-react@{version}/dist/umd/lucide-react.min.js',
      global: 'lucide'
    }
  };

  // 解析 package.json
  parse(content: string): ParsedPackage {
    const pkg: PackageJson = JSON.parse(content);

    return {
      name: pkg.name,
      version: pkg.version,
      entry: this.resolveEntry(pkg),
      dependencies: this.resolveDependencies(pkg),
      cdnMappings: this.resolveCDNMappings(pkg),
      plugins: this.resolvePlugins(pkg),
      runtime: this.resolveRuntime(pkg)
    };
  }

  // 解析入口文件
  private resolveEntry(pkg: PackageJson): string {
    // 优先使用 preview.entry
    if (pkg.preview?.entry) {
      return pkg.preview.entry;
    }

    // 常见入口文件
    const entries = [
      'src/main.tsx',
      'src/main.ts',
      'src/index.tsx',
      'src/index.ts',
      'src/App.tsx',
      'src/App.ts',
      pkg.main || 'index.js'
    ];

    // 返回第一个存在的入口
    return entries[0];
  }

  // 解析依赖
  private resolveDependencies(pkg: PackageJson): ResolvedDependency[] {
    const allDeps = {
      ...pkg.dependencies,
      ...pkg.peerDependencies,
      ...pkg.preview?.dependencies
    };

    const resolved: ResolvedDependency[] = [];

    for (const [name, version] of Object.entries(allDeps)) {
      // 跳过开发依赖中的构建工具
      if (this.isBuildTool(name)) continue;

      resolved.push({
        name,
        version: this.normalizeVersion(version),
        type: this.getDependencyType(name, pkg),
        cdn: this.getCDNUrl(name, version)
      });
    }

    return resolved;
  }

  // 获取 CDN URL
  private getCDNUrl(name: string, version: string): CDNInfo | null {
    // 1. 检查自定义 CDN 配置
    // 2. 检查内置 CDN 映射
    const mapping = PackageParser.CDN_REGISTRY[name];
    if (mapping) {
      return {
        url: mapping.url.replace('{version}', version),
        global: mapping.global
      };
    }

    // 3. 生成默认 esm.sh URL
    return {
      url: `https://esm.sh/${name}@${version}`,
      global: name.replace(/-/g, '').replace(/^(.)/, c => c.toUpperCase())
    };
  }

  // 判断是否为构建工具（不注入运行时）
  private isBuildTool(name: string): boolean {
    const buildTools = [
      'typescript', 'vite', 'webpack', 'rollup', 'esbuild',
      '@types/', 'eslint', 'prettier', 'babel', 'tsc'
    ];
    return buildTools.some(tool => name.startsWith(tool));
  }
}
```

### 5.2 ZIP 包处理流程

```typescript
// server/src/services/zip-parser-v2.ts

export class EnhancedZipParser {
  private packageParser: PackageParser;

  async parse(buffer: Buffer): Promise<ParsedProject> {
    const zip = await JSZip.loadAsync(buffer);

    // 1. 查找并解析 package.json
    const packageJson = await this.findAndParsePackageJson(zip);

    // 2. 解析项目结构
    const files = await this.extractFiles(zip);

    // 3. 构建依赖图
    const dependencyGraph = await this.buildDependencyGraph(files, packageJson);

    // 4. 检测框架和插件
    const framework = this.detectFramework(files, packageJson);
    const plugins = this.detectPlugins(files, packageJson);

    return {
      packageJson,
      files,
      dependencyGraph,
      framework,
      plugins,
      config: this.generatePreviewConfig(packageJson, framework)
    };
  }

  private async findAndParsePackageJson(zip: JSZip): Promise<ParsedPackage | null> {
    const packageFile = zip.file('package.json');
    if (!packageFile) return null;

    const content = await packageFile.async('string');
    return this.packageParser.parse(content);
  }

  private detectFramework(files: Map<string, string>, pkg: ParsedPackage | null): Framework {
    const deps = pkg?.dependencies || [];

    // 检测 React
    if (deps.some(d => d.name === 'react')) {
      // 检测 Next.js
      if (deps.some(d => d.name === 'next')) {
        return { type: 'next', plugins: ['@preview/react', '@preview/next'] };
      }
      // 检测 Remix
      if (deps.some(d => d.name === '@remix-run/react')) {
        return { type: 'remix', plugins: ['@preview/react', '@preview/remix'] };
      }
      return { type: 'react', plugins: ['@preview/react'] };
    }

    // 检测 Vue
    if (deps.some(d => d.name === 'vue')) {
      return { type: 'vue', plugins: ['@preview/vue'] };
    }

    // 检测 Svelte
    if (deps.some(d => d.name === 'svelte')) {
      return { type: 'svelte', plugins: ['@preview/svelte'] };
    }

    // 检测纯 HTML
    if (files.has('index.html')) {
      return { type: 'html', plugins: ['@preview/html'] };
    }

    return { type: 'unknown', plugins: [] };
  }
}
```

---

## 六、文件结构设计

```
uiux-design/
├── packages/                      # Monorepo 结构
│   ├── core/                      # 核心模块
│   │   ├── compiler/              # 编译器
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── types.ts
│   │   │   │   └── transformer.ts
│   │   │   └── package.json
│   │   │
│   │   ├── resolver/              # 解析器
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── types.ts
│   │   │   │   ├── package-parser.ts
│   │   │   │   └── dependency-graph.ts
│   │   │   └── package.json
│   │   │
│   │   ├── runtime/               # 运行时
│   │   │   ├── src/
│   │   │   │   ├── index.ts
│   │   │   │   ├── types.ts
│   │   │   │   ├── sandbox.ts
│   │   │   │   └── message.ts
│   │   │   └── package.json
│   │   │
│   │   └── renderer/              # 渲染器
│   │       ├── src/
│   │       │   ├── index.ts
│   │       │   ├── types.ts
│   │       │   └── capture.ts
│   │       └── package.json
│   │
│   ├── plugin-system/             # 插件系统
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── types.ts
│   │   │   └── plugin-manager.ts
│   │   └── package.json
│   │
│   ├── plugins/                   # 官方插件
│   │   ├── react/
│   │   ├── vue/
│   │   ├── svelte/
│   │   ├── typescript/
│   │   ├── tailwind/
│   │   ├── sass/
│   │   └── html/
│   │
│   └── shared/                    # 共享代码
│       ├── types/
│       └── utils/
│
├── client/                        # 前端应用
│   └── src/
│       ├── lib/
│       │   ├── preview/           # 预览入口
│       │   │   ├── index.ts
│       │   │   └── preview-manager.ts
│       │   └── api/
│       └── pages/
│
├── server/                        # 后端服务
│   └── src/
│       ├── services/
│       │   ├── component-service.ts
│       │   └── zip-parser-v2.ts
│       └── routes/
│
├── docs/                          # 文档
│   ├── architecture.md            # 架构文档
│   ├── optimization-plan.md       # 优化方案
│   ├── architecture-redesign.md   # 重构方案（本文档）
│   └── plugin-development.md      # 插件开发指南
│
└── package.json                   # Monorepo 配置
```

---

## 七、实施计划

### 阶段一：核心架构（1 周）

| 任务 | 描述 | 预估 |
|------|------|------|
| 搭建 Monorepo | 使用 pnpm workspace 或 turborepo | 0.5 天 |
| 核心 Types | 定义所有接口和类型 | 0.5 天 |
| Plugin System | 实现插件管理器 | 1 天 |
| Package Parser | 实现 package.json 解析 | 1 天 |
| Dependency Resolver | 实现依赖解析和图构建 | 2 天 |

### 阶段二：基础插件（3 天）

| 任务 | 描述 | 预估 |
|------|------|------|
| React 插件 | React/TypeScript 编译支持 | 1 天 |
| HTML 插件 | 纯 HTML 预览支持 | 0.5 天 |
| Tailwind 插件 | Tailwind CDN 集成 | 0.5 天 |
| 测试 | 插件单元测试 | 1 天 |

### 阶段三：运行时集成（2 天）

| 任务 | 描述 | 预估 |
|------|------|------|
| Runtime 核心 | iframe 沙箱管理 | 1 天 |
| 消息通信 | postMessage 封装 | 0.5 天 |
| Renderer | 截图功能迁移 | 0.5 天 |

### 阶段四：前后端集成（2 天）

| 任务 | 描述 | 预估 |
|------|------|------|
| ZIP 解析升级 | 使用新的解析器 | 1 天 |
| API 调整 | 适配新数据结构 | 0.5 天 |
| 前端集成 | Preview Manager 集成 | 0.5 天 |

---

## 八、迁移策略

### 渐进式迁移

```typescript
// 1. 保留旧接口，内部使用新实现
export function buildPreviewHtml(code: string, files?: Record<string, string>): string {
  // 使用新架构
  const manager = new PreviewManager({
    plugins: [ReactPlugin, TailwindPlugin]
  });

  return manager.buildPreview(code, files);
}

// 2. 新接口，完全模块化
export function createPreview(config: PreviewConfig): PreviewManager {
  return new PreviewManager(config);
}
```

### 兼容性保证

- 保持现有 API 不变
- 新增配置项可选
- 逐步迁移内部实现

---

## 九、参考项目

| 项目 | 架构特点 | 参考价值 |
|------|----------|----------|
| [CodeSandbox](https://github.com/codesandbox/codesandbox-client) | 完整的在线 IDE，强大的包管理 | 依赖解析、沙箱设计 |
| [Sandpack](https://github.com/codesandbox/sandpack) | 轻量级预览组件，React 生态 | 插件系统、组件设计 |
| [StackBlitz](https://stackblitz.com/) | WebContainer 技术，完整 Node 环境 | 运行时设计 |
| [Vite](https://github.com/vitejs/vite) | 插件化构建工具 | 插件系统设计 |
| [Babel](https://github.com/babel/babel) | 可插拔编译器 | 编译器架构 |
| [esm.sh](https://github.com/ije/esm.sh) | npm 包 CDN 服务 | 依赖 CDN 方案 |

---

> 文档版本：v1.0
> 最后更新：2026-03-23
