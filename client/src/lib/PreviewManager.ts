/**
 * PreviewManager - 模块化预览管理器
 * 集成 @preview/* 包，提供统一的预览接口
 *
 * 支持通过 esm.sh 动态加载 npm 包，尽可能还原原始效果
 */

import type {
  CompileResult,
  DependencyGraph,
  Plugin,
} from './preview/types';

/**
 * 预览配置
 */
export interface PreviewConfig {
  /** Tailwind CDN 地址 */
  tailwindCdn?: string;
  /** React CDN 地址 */
  reactCdn?: string;
  /** React DOM CDN 地址 */
  reactDomCdn?: string;
  /** Babel CDN 地址 */
  babelCdn?: string;
  /** 是否启用中国 CDN 镜像 */
  useChinaCdn?: boolean;
  /** 自定义 CDN 映射 */
  cdnOverrides?: Record<string, string>;
}

/**
 * 预览结果
 */
export interface PreviewResult {
  /** 生成的 HTML */
  html: string;
  /** 依赖图 */
  dependencyGraph: DependencyGraph | null;
  /** 编译结果 */
  compileResult: CompileResult | null;
  /** 是否为 HTML 模式 */
  isHtml: boolean;
  /** 验证错误 */
  validationError?: string;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: Required<Omit<PreviewConfig, 'cdnOverrides'>> = {
  tailwindCdn: 'https://cdn.tailwindcss.com',
  reactCdn: 'https://registry.npmmirror.com/react/18.2.0/files/umd/react.production.min.js',
  reactDomCdn: 'https://registry.npmmirror.com/react-dom/18.2.0/files/umd/react-dom.production.min.js',
  babelCdn: 'https://registry.npmmirror.com/@babel/standalone/7.23.9/files/babel.min.js',
  useChinaCdn: true,
};

/**
 * 代码大小限制 (P12)
 */
const MAX_CODE_SIZE = 500 * 1024; // 500KB

/**
 * 缓存配置 (P13)
 */
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟
const MAX_CACHE_SIZE = 100;

/**
 * 缓存项
 */
interface CacheItem {
  html: string;
  timestamp: number;
}

/**
 * 预览缓存 (P13)
 */
const previewCache = new Map<string, CacheItem>();

/**
 * 生成缓存 key
 */
function generateCacheKey(code: string, files?: Record<string, string> | null): string {
  const filesStr = files ? JSON.stringify(Object.keys(files).sort().map(k => `${k}:${files[k].length}`)) : '';
  let hash = 0;
  const str = code + filesStr;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `${code.length}:${hash}`;
}

/**
 * 清理过期缓存
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, item] of previewCache) {
    if (now - item.timestamp > CACHE_TTL) {
      previewCache.delete(key);
    }
  }
}

/**
 * 外部依赖的 ESM CDN 配置
 * 使用 esm.sh 支持大多数 npm 包
 */
const ESM_CDN = 'https://esm.sh';

/**
 * 需要特殊处理的包（无法通过 esm.sh 直接使用的）
 * 这些包提供 stub 实现
 */
const SPECIAL_PACKAGES: Record<string, { stub: string; priority: number }> = {
  // 路由相关 - 提供 stub
  'react-router-dom': {
    priority: 10,
    stub: `const Link = ({ children, to, ...props }) => React.createElement('a', { href: to || '#', ...props }, children);
const NavLink = ({ children, to, ...props }) => React.createElement('a', { href: to || '#', ...props }, children);
const Route = ({ children }) => children;
const Routes = ({ children }) => React.createElement('div', {}, children);
const useParams = () => ({});
const useNavigate = () => (() => {});
const useLocation = () => ({ pathname: '/', search: '', hash: '' });
const useSearchParams = () => [new URLSearchParams(), () => {}];
const Outlet = () => null;`,
  },
  // 状态管理 - 提供 stub
  'zustand': {
    priority: 10,
    stub: `const create = (init) => { const state = init({}); return () => state; };`,
  },
  'jotai': {
    priority: 10,
    stub: `const atom = (v) => [v, () => {}];
const useAtom = (a) => a;`,
  },
  'redux': {
    priority: 10,
    stub: `const Provider = ({ children }) => children;
const useSelector = (fn) => fn({});
const useDispatch = () => (() => {});
const connect = (map) => (Comp) => Comp;`,
  },
  'react-redux': {
    priority: 10,
    stub: `const Provider = ({ children }) => children;
const useSelector = (fn) => fn({});
const useDispatch = () => (() => {});
const connect = (map) => (Comp) => Comp;`,
  },
  // Framer Motion - 提供 stub（esm.sh 版本可能有问题）
  'framer-motion': {
    priority: 5,
    stub: `const motion = new Proxy({}, {
  get: (_, tag) => {
    const tagName = typeof tag === 'string' ? tag : 'div';
    return React.forwardRef((props, ref) => React.createElement(tagName, { ...props, ref }));
  }
});
const AnimatePresence = ({ children }) => children;
const useAnimation = () => ({ start: () => Promise.resolve(), stop: () => {} });
const useMotionValue = (v) => ({ get: () => v, set: () => {} });
const useTransform = () => ({ get: () => 0 });
const LayoutGroup = ({ children }) => children;`,
  },
  // motion/react (新版 framer-motion)
  'motion/react': {
    priority: 5,
    stub: `const motion = new Proxy({}, {
  get: (_, tag) => {
    const tagName = typeof tag === 'string' ? tag : 'div';
    return React.forwardRef((props, ref) => React.createElement(tagName, { ...props, ref }));
  }
});
const AnimatePresence = ({ children }) => children;
const useAnimation = () => ({ start: () => Promise.resolve(), stop: () => {} });
const useMotionValue = (v) => ({ get: () => v, set: () => {} });
const useTransform = () => ({ get: () => 0 });
const LayoutGroup = ({ children }) => children;`,
  },
  // lucide-react 图标库 - 使用 Proxy 动态创建图标组件
  // 原因：esm.sh 加载的 lucide-react 使用自己的 React 实例，导致 hooks 错误
  'lucide-react': {
    priority: 10,
    stub: `// 图标 stub 工厂函数
var _createIconStub = function(name) {
  return React.forwardRef(function(props, ref) {
    return React.createElement('svg', {
      ref: ref,
      width: (props && props.size) || 24,
      height: (props && props.size) || 24,
      viewBox: '0 0 24 24',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: (props && props.strokeWidth) || 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      className: (props && props.className) || '',
      style: props && props.style
    }, React.createElement('circle', { cx: 12, cy: 12, r: 10, opacity: 0.3 }));
  });
};
// 使用 Proxy 动态响应任意图标名称，并暴露到 window
var _lucideReactHandler = {
  get: function(target, prop) {
    if (prop === 'default') return target;
    if (typeof prop === 'string' && prop[0] === prop[0].toUpperCase()) {
      var icon = _createIconStub(prop);
      window[prop] = icon;  // 自动暴露到 window
      return icon;
    }
    return target[prop];
  }
};
var lucideReact = new Proxy({ createLucideIcon: _createIconStub }, _lucideReactHandler);
// 预先暴露常用图标到 window
window.ChevronRight = _createIconStub('ChevronRight');
window.ChevronLeft = _createIconStub('ChevronLeft');
window.Box = _createIconStub('Box');
window.Circle = _createIconStub('Circle');
window.Triangle = _createIconStub('Triangle');
window.Square = _createIconStub('Square');
window.Settings = _createIconStub('Settings');
window.Settings2 = _createIconStub('Settings2');
window.Adjust = _createIconStub('Adjust');
window.Speed = _createIconStub('Speed');
window.Stay = _createIconStub('Stay');
window.Duration = _createIconStub('Duration');
window.Accent = _createIconStub('Accent');
window.Color = _createIconStub('Color');
window.Play = _createIconStub('Play');
window.Pause = _createIconStub('Pause');
window.Resume = _createIconStub('Resume');
window.Restart = _createIconStub('Restart');
window.RotateCcw = _createIconStub('RotateCcw');
window.Star = _createIconStub('Star');
window.Paused = _createIconStub('Paused');`,
  },
};

/**
 * 从代码中提取外部依赖
 */
function extractDependencies(code: string): Set<string> {
  const deps = new Set<string>();

  // 匹配 import ... from 'package' 或 import ... from "@org/package"
  const importRegex = /import\s+(?:[\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g;
  let match;
  while ((match = importRegex.exec(code)) !== null) {
    const pkg = match[1];
    // 只处理外部依赖（不是相对路径）
    if (!pkg.startsWith('.') && !pkg.startsWith('/')) {
      // 提取包名（处理 @org/package 和 package/subpath）
      const parts = pkg.split('/');
      const pkgName = parts[0].startsWith('@') ? `${parts[0]}/${parts[1]}` : parts[0];
      deps.add(pkgName);
    }
  }

  return deps;
}

/**
 * 预览管理器
 */
export class PreviewManager {
  private config: Required<Omit<PreviewConfig, 'cdnOverrides'>> & { cdnOverrides?: Record<string, string> };

  constructor(config: PreviewConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 注册自定义插件（占位，待完整实现）
   */
  registerPlugin(_plugin: Plugin): void {
    // TODO: 待插件系统集成后实现
  }

  /**
   * 获取缓存的预览 (P13)
   */
  getCachedPreview(code: string, files?: Record<string, string> | null): string | null {
    const cacheKey = generateCacheKey(code, files);
    const cached = previewCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.html;
    }
    return null;
  }

  /**
   * 设置预览缓存 (P13)
   */
  setCachedPreview(code: string, files: Record<string, string> | null | undefined, html: string): void {
    if (previewCache.size >= MAX_CACHE_SIZE) {
      cleanExpiredCache();
    }
    if (previewCache.size >= MAX_CACHE_SIZE) {
      let oldestKey: string | null = null;
      let oldestTime = Infinity;
      for (const [key, item] of previewCache) {
        if (item.timestamp < oldestTime) {
          oldestTime = item.timestamp;
          oldestKey = key;
        }
      }
      if (oldestKey) {
        previewCache.delete(oldestKey);
      }
    }
    const cacheKey = generateCacheKey(code, files);
    previewCache.set(cacheKey, { html, timestamp: Date.now() });
  }

  /**
   * 清除所有缓存 (P13)
   */
  clearCache(): void {
    previewCache.clear();
  }

  /**
   * 验证代码大小 (P12)
   */
  validateCodeSize(code: string, files?: Record<string, string> | null): { valid: boolean; message?: string } {
    let totalSize = code.length;
    if (files) {
      for (const content of Object.values(files)) {
        totalSize += content.length;
      }
    }
    if (totalSize > MAX_CODE_SIZE) {
      return {
        valid: false,
        message: `代码总大小 ${(totalSize / 1024).toFixed(1)}KB 超过限制 ${MAX_CODE_SIZE / 1024}KB`,
      };
    }
    return { valid: true };
  }

  /**
   * 构建预览 HTML
   * @param code 主代码
   * @param files 多文件
   * @param packageJson 依赖信息
   * @param useCache 是否使用缓存
   */
  buildPreview(
    code: string,
    files?: Record<string, string> | null,
    packageJson?: Record<string, unknown> | null,
    useCache = true,
  ): PreviewResult {
    if (useCache) {
      const cachedHtml = this.getCachedPreview(code, files);
      if (cachedHtml) {
        return { html: cachedHtml, dependencyGraph: null, compileResult: null, isHtml: false };
      }
    }

    const sizeValidation = this.validateCodeSize(code, files);
    if (!sizeValidation.valid) {
      return {
        html: this.buildErrorHtml(sizeValidation.message || '代码大小超限'),
        dependencyGraph: null,
        compileResult: null,
        isHtml: false,
        validationError: sizeValidation.message,
      };
    }

    if (this.isHtmlCode(code, files)) {
      const result = this.buildHtmlPreviewResult(code, files);
      if (useCache) this.setCachedPreview(code, files, result.html);
      return result;
    }

    const result = this.buildReactPreview(code, files, packageJson);
    if (useCache) this.setCachedPreview(code, files, result.html);
    return result;
  }

  /**
   * 构建错误页面 HTML
   */
  private buildErrorHtml(message: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
    .error-container { background: white; padding: 32px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); max-width: 400px; text-align: center; }
    .error-icon { width: 48px; height: 48px; margin: 0 auto 16px; color: #ef4444; }
    .error-title { font-size: 18px; font-weight: 600; color: #111827; margin-bottom: 8px; }
    .error-message { font-size: 14px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="error-container">
    <svg class="error-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
    <div class="error-title">预览错误</div>
    <div class="error-message">${message}</div>
  </div>
</body>
</html>`;
  }

  /**
   * 检测代码是否为纯 HTML
   */
  private isHtmlCode(code: string, files?: Record<string, string> | null): boolean {
    const trimmed = code.trim();
    if (/^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return true;
    if (files) {
      for (const name of Object.keys(files)) {
        if (name.endsWith('.html') || name.endsWith('.htm')) return true;
      }
    }
    const hasHtmlTags = /<(?:div|section|header|footer|main|article|nav|body|head|meta|link)\b/i.test(trimmed);
    const hasReactFeatures = /(?:import\s+.*(?:react|React)|export\s+default\s+function|useState|useEffect|React\.createElement|createRoot)\b/.test(trimmed);
    if (hasHtmlTags && !hasReactFeatures && !trimmed.startsWith('import ')) return true;
    return false;
  }

  /**
   * 构建 HTML 预览结果
   */
  private buildHtmlPreviewResult(code: string, files?: Record<string, string> | null): PreviewResult {
    const html = this.buildHtmlPreview(code, files);
    return { html, dependencyGraph: null, compileResult: null, isHtml: true };
  }

  /**
   * 构建 HTML 预览
   */
  private buildHtmlPreview(code: string, files?: Record<string, string> | null): string {
    let htmlContent = code;
    let cssCode = '';
    let jsCode = '';

    if (files && Object.keys(files).length > 0) {
      const htmlParts: string[] = [];
      for (const [name, content] of Object.entries(files)) {
        if (name.endsWith('.css')) cssCode += content + '\n';
        else if (name.endsWith('.js')) jsCode += content + '\n';
        else if (name.endsWith('.html') || name.endsWith('.htm')) htmlParts.push(content);
      }
      if (htmlParts.length > 0) htmlContent = htmlParts.join('\n');
    }

    const trimmed = htmlContent.trim();
    if (/^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
      let result = trimmed;
      const inject = `<script src="${this.config.tailwindCdn}"><\/script>\n${cssCode ? `<style>${cssCode}</style>\n` : ''}`;
      if (result.includes('</head>')) result = result.replace('</head>', inject + '</head>');
      else if (result.includes('<body')) result = result.replace('<body', inject + '<body');
      if (jsCode && result.includes('</body>')) result = result.replace('</body>', `<script>${jsCode}<\/script>\n</body>`);
      return result;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="${this.config.tailwindCdn}"><\/script>
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; min-height: 100%; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background: #fff; }
    ${cssCode}
  </style>
</head>
<body>
  ${htmlContent}
  ${jsCode ? `<script>${jsCode}<\/script>` : ''}
</body>
</html>`;
  }

  /**
   * 构建 React 预览（支持外部依赖）
   * @param code 主代码
   * @param files 多文件
   * @param dependencies 依赖信息
   */
  private buildReactPreview(
    code: string,
    files?: Record<string, string> | null,
    dependencies?: Record<string, unknown> | null,
  ): PreviewResult {
    let cssCode = '';
    let jsCode = code;

    // 收集所有代码中的依赖
    const allDeps = new Set<string>();

    // 解析 package.json 中的依赖（包含版本信息）
    const packageDeps: Record<string, string> = {};
    if (dependencies && typeof dependencies === 'object') {
      for (const [name, version] of Object.entries(dependencies)) {
        packageDeps[name] = typeof version === 'string' ? version : String(version);
      }
    }

    if (files && Object.keys(files).length > 0) {
      const jsFiles: { path: string; content: string }[] = [];
      for (const [path, content] of Object.entries(files)) {
        if (path.endsWith('.css')) {
          cssCode += content.replace(/@import\s+['"]tailwindcss['"];?/g, '').replace(/@tailwind\s+\w+;?/g, '') + '\n';
        } else if (/\.(tsx?|jsx?)$/.test(path)) {
          jsFiles.push({ path, content });
          // 提取该文件的依赖
          const fileDeps = extractDependencies(content);
          fileDeps.forEach(d => allDeps.add(d));
        }
      }

      const sortedJsFiles = this.sortFilesByDependency(jsFiles, code);
      const jsParts: string[] = [];
      let hasAppFile = false;

      for (const file of sortedJsFiles) {
        const fileName = file.path.split('/').pop() || '';
        if (fileName === 'App.tsx' || fileName === 'App.jsx') hasAppFile = true;
        jsParts.push(`// --- ${file.path} ---\n${file.content}`);
      }

      if (!hasAppFile) jsParts.push(`// --- App.tsx ---\n${code}`);
      jsCode = jsParts.join('\n\n');
    }

    // 提取主代码的依赖
    const mainDeps = extractDependencies(jsCode);
    mainDeps.forEach(d => allDeps.add(d));

    const scriptCode = this.buildComponentScript(jsCode);
    const html = this.generatePreviewHtmlWithDeps(scriptCode, cssCode, allDeps, packageDeps);

    return {
      html,
      dependencyGraph: null,
      compileResult: { code: scriptCode, componentName: null, errors: [], dependencies: [...allDeps] },
      isHtml: false,
    };
  }

  /**
   * 根据依赖关系对文件进行拓扑排序
   */
  private sortFilesByDependency(
    files: { path: string; content: string }[],
    _entryCode: string,
  ): { path: string; content: string }[] {
    const getPriority = (fileName: string): number => {
      const name = fileName.toLowerCase();
      if (name === 'main.ts' || name === 'main.tsx' || name === 'index.ts' || name === 'index.tsx') return 0;
      if (name.includes('util') || name.includes('hook') || name.includes('type') || name.includes('constant')) return 1;
      if (name.includes('component') || name.endsWith('.tsx') || name.endsWith('.jsx')) {
        if (name === 'app.tsx' || name === 'app.jsx') return 3;
        return 2;
      }
      return 2;
    };

    const getFileName = (path: string): string => path.split('/').pop() || path;
    const dependencies = new Map<string, Set<string>>();
    const fileMap = new Map<string, { path: string; content: string }>();

    for (const file of files) {
      const fileName = getFileName(file.path);
      fileMap.set(fileName, file);
      dependencies.set(fileName, new Set());

      const importRegex = /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]\.\/([^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(file.content)) !== null) {
        const depPath = match[1].replace(/\.(tsx?|jsx?)$/, '');
        for (const [name] of fileMap) {
          if (name.replace(/\.(tsx?|jsx?)$/, '') === depPath) {
            dependencies.get(fileName)?.add(name);
          }
        }
      }
    }

    const sorted: { path: string; content: string }[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (fileName: string): boolean => {
      if (visited.has(fileName)) return true;
      if (visiting.has(fileName)) return false;
      visiting.add(fileName);
      const deps = dependencies.get(fileName);
      if (deps) {
        for (const dep of deps) {
          if (!visit(dep)) return false;
        }
      }
      visiting.delete(fileName);
      visited.add(fileName);
      const file = fileMap.get(fileName);
      if (file) sorted.push(file);
      return true;
    };

    const sortedNames = [...fileMap.keys()].sort((a, b) => {
      const priorityA = getPriority(a);
      const priorityB = getPriority(b);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return a.localeCompare(b);
    });

    for (const fileName of sortedNames) visit(fileName);
    return sorted;
  }

  /**
   * 构建组件脚本
   */
  private buildComponentScript(code: string): string {
    let processed = code
      .replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
      .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '');

    const exportMatch = processed.match(/export\s+default\s+function\s+(\w+)/);
    const componentName = exportMatch ? exportMatch[1] : null;

    processed = processed
      .replace(/export\s+default\s+function/g, 'function')
      .replace(/export\s+default\s+/g, '')
      .replace(/export\s+/g, '');

    const helpers = `
const { useState, useEffect, useRef, useMemo, useCallback, Fragment, createContext, useContext, useReducer, forwardRef, memo, lazy, Suspense, StrictMode, useId, useTransition, useDeferredValue, useImperativeHandle, useLayoutEffect } = React;
const { createRoot, createPortal } = ReactDOM;
const cn = (...args) => args.filter(Boolean).join(' ');
`;

    if (componentName) {
      return `${helpers}\n${processed}\n\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${componentName}));`;
    }

    const funcMatch = processed.match(/function\s+([A-Z]\w+)\s*[\(<]/);
    if (funcMatch) {
      return `${helpers}\n${processed}\n\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${funcMatch[1]}));`;
    }

    return `${helpers}\nfunction Preview() {\n  return React.createElement('div', {className: 'min-h-screen bg-zinc-100 flex items-center justify-center p-8'}, ${JSON.stringify(processed)});\n}\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Preview));`;
  }

  /**
   * 规范化版本号（移除 ^ ~ 等前缀）
   */
  private normalizeVersion(version: string): string {
    return version.replace(/^[\^~>=<]+/, '').split(' ').pop() || version;
  }

  /**
   * 生成支持外部依赖的预览 HTML
   * @param scriptCode 编译后的脚本代码
   * @param cssCode CSS 代码
   * @param deps 从代码中提取的依赖集合
   * @param packageDeps package.json 中的依赖版本信息
   */
  private generatePreviewHtmlWithDeps(
    scriptCode: string,
    cssCode: string,
    deps: Set<string>,
    packageDeps: Record<string, string> = {},
  ): string {
    // 分类依赖：需要 stub 的和需要从 esm.sh 加载的
    const stubDeps: string[] = [];
    const esmDeps: string[] = [];

    for (const dep of deps) {
      if (SPECIAL_PACKAGES[dep]) {
        // 有专门的 stub 实现
        stubDeps.push(dep);
      } else if (!['react', 'react-dom'].includes(dep)) {
        // 尝试从 ESM 加载
        esmDeps.push(dep);
      }
    }

    // 生成 stub 代码
    let stubCode = '';
    for (const dep of stubDeps) {
      stubCode += `\n// ${dep} stub\n${SPECIAL_PACKAGES[dep].stub}\n`;
    }

    // 生成 esm.sh 导入映射，使用 package.json 中的版本（如果有）
    const importMap: Record<string, string> = {};
    for (const dep of esmDeps) {
      const version = packageDeps[dep];
      const versionSpec = version ? this.normalizeVersion(version) : 'latest';
      // 使用 external=react,react-dom 确保使用同一个 React 实例
      // 这是关键：external 参数让 esm.sh 不打包 React，而是使用外部提供的
      importMap[dep] = `${ESM_CDN}/${dep}@${versionSpec}?target=es2020&external=react,react-dom`;
    }

    // 生成 ESM 导入语句
    const esmImports = esmDeps.map(dep => {
      const safeName = dep.replace(/[^a-zA-Z0-9]/g, '_');
      return `import * as ${safeName} from '${dep}';`;
    }).join('\n');

    // 生成将模块暴露到全局的代码
    // 核心思想：将 ESM 模块的命名导出直接暴露到 window，供 Babel 编译后的代码使用
    const exposeToGlobal = esmDeps.map(dep => {
      const safeName = dep.replace(/[^a-zA-Z0-9]/g, '_');

      return `window.${safeName} = ${safeName};
(function() {
  var mod = ${safeName};
  var readonly = {Infinity:1,NaN:1,undefined:1,eval:1,isFinite:1,isNaN:1,parseFloat:1,parseInt:1,decodeURI:1,decodeURIComponent:1,encodeURI:1,encodeURIComponent:1,Object:1,Function:1,Boolean:1,Symbol:1,Error:1,Number:1,BigInt:1,Math:1,Date:1,String:1,RegExp:1,Array:1,Map:1,Set:1,WeakMap:1,WeakSet:1,ArrayBuffer:1,JSON:1,Promise:1,Proxy:1,Reflect:1,console:1,window:1,document:1,React:1,ReactDOM:1,Babel:1};
  Object.keys(mod).forEach(function(k) {
    if (readonly[k]) return;
    try {
      var val = mod[k];
      if (val !== null && val !== undefined && (typeof val === 'function' || typeof val === 'object')) {
        window[k] = val;
      }
    } catch(e) {}
  });
})();`;
    }).join('\n');

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; min-height: 100%; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background: #fff; }
    #root { width: 100%; min-height: 100%; }
    #error-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85); color: #ff6b6b; padding: 20px; font-family: monospace; font-size: 14px; white-space: pre-wrap; overflow: auto; z-index: 9999; }
    #error-overlay.show { display: block; }
    #loading { display: flex; align-items: center; justify-content: center; height: 100vh; color: #999; font-size: 14px; }
    ${cssCode}
  </style>
</head>
<body>
  <div id="root"><div id="loading">加载预览中...</div></div>
  <div id="error-overlay"></div>
  <script src="${this.config.tailwindCdn}"><\/script>
  ${esmDeps.length > 0 ? `<script type="importmap">${JSON.stringify({ imports: importMap })}<\/script>` : ''}
  <script>
    var showError, runPreview;
    (function() {
    function loadScript(urls, cb) {
      var i = 0;
      function tryNext() {
        if (i >= urls.length) { cb(new Error('All CDN sources failed')); return; }
        var s = document.createElement('script');
        s.src = urls[i];
        s.onload = function() { cb(null); };
        s.onerror = function() { i++; tryNext(); };
        document.head.appendChild(s);
      }
      tryNext();
    }
    function loadAll(list, done) {
      var idx = 0;
      function next() {
        if (idx >= list.length) { done(null); return; }
        loadScript(list[idx], function(err) { if (err) { done(err); return; } idx++; next(); });
      }
      next();
    }
    showError = function(msg) {
      var el = document.getElementById('error-overlay');
      el.textContent = msg;
      el.className = 'show';
    };
    runPreview = function() {
      try {
        if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
          showError('React 加载失败');
        } else if (typeof Babel === 'undefined') {
          showError('Babel 加载失败');
        } else {
          ${stubCode}
          var code = ${JSON.stringify(scriptCode)};
          var output = Babel.transform(code, {
            presets: ['react', ['typescript', { allExtensions: true, isTSX: true }]],
            filename: 'component.tsx'
          }).code;

          // 解析编译后代码中需要绑定的标识符
          // 核心思想：找出所有大写开头的标识符，为未定义的生成 stub
          var _skip = {
            // 内置对象
            React:1, ReactDOM:1, Babel:1, Object:1, Array:1, String:1, Number:1, Boolean:1,
            Date:1, Math:1, JSON:1, Promise:1, Error:1, Map:1, Set:1, Symbol:1, Proxy:1,
            Reflect:1, RegExp:1, URL:1, SVGElement:1, Fragment:1, StrictMode:1, Suspense:1,
            // React Hooks
            useState:1, useEffect:1, useRef:1, useMemo:1, useCallback:1, useContext:1,
            useReducer:1, forwardRef:1, memo:1, lazy:1, createContext:1, createRoot:1, createPortal:1,
            // 辅助函数
            cn:1,
            // ESM 模块名（不作为组件）
            ${esmDeps.map(d => `${d.replace(/[^a-zA-Z0-9_]/g, '_')}:1`).join(',')}
          };

          // 跳过代码中声明的变量（这些是用户定义的组件）
          var _declMatches = output.match(/(?:const|let|var|function)\\s+([A-Z][A-Za-z0-9_]*)/g) || [];
          for (var d = 0; d < _declMatches.length; d++) {
            var dn = _declMatches[d].replace(/^(?:const|let|var|function)\\s+/, '');
            _skip[dn] = 1;
          }

          // 收集所有大写标识符
          var _matches = output.match(/\\b([A-Z][A-Za-z0-9_]*)\\b/g) || [];
          var _seen = {};
          var _bindings = '';

          for (var i = 0; i < _matches.length; i++) {
            var v = _matches[i];
            if (!_seen[v] && !_skip[v]) {
              _seen[v] = 1;
              // 检查 window 上是否有该组件（由 ESM 模块暴露）
              // 注意：React 组件可能是 function（函数组件）或 object（forwardRef 结果）
              var winVal = window[v];
              if (winVal !== null && winVal !== undefined && (typeof winVal === 'function' || typeof winVal === 'object')) {
                _bindings += 'var ' + v + ' = window.' + v + ';\\n';
              } else {
                // 生成占位组件
                _bindings += 'var ' + v + ' = function(props) {\\n' +
                  '  console.warn(\\"Component ' + v + ' not available, showing placeholder\\");\\n' +
                  '  return React.createElement(\\"svg\\", {\\n' +
                  '    width: (props && props.size) || 24,\\n' +
                  '    height: (props && props.size) || 24,\\n' +
                  '    viewBox: \\"0 0 24 24\\", fill: \\"none\\",\\n' +
                  '    stroke: \\"currentColor\\", strokeWidth: 2,\\n' +
                  '    className: (props && props.className) || \\"\\"\\n' +
                  '  }, React.createElement(\\"circle\\", { cx: 12, cy: 12, r: 10 }));\\n' +
                  '};\\n';
              }
            }
          }

          var script = document.createElement('script');
          script.textContent = _bindings + output;
          document.body.appendChild(script);
          setTimeout(function() {
            window.parent.postMessage({ type: 'preview-rendered' }, '*');
          }, 800);
          window.addEventListener('message', function(e) {
            if (e.data && e.data.type === 'capture-request') {
              if (typeof html2canvas === 'undefined') {
                var s = document.createElement('script');
                s.src = 'https://registry.npmmirror.com/html2canvas/1.4.1/files/dist/html2canvas.min.js';
                s.onload = function() { doCapture(); };
                s.onerror = function() {
                  var s2 = document.createElement('script');
                  s2.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                  s2.onload = function() { doCapture(); };
                  document.head.appendChild(s2);
                };
                document.head.appendChild(s);
              } else {
                doCapture();
              }
              function doCapture() {
                setTimeout(function() {
                  try {
                    var root = document.getElementById('root');
                    if (!root) return;
                    html2canvas(root, {
                      scale: 2,
                      useCORS: false,
                      allowTaint: true,
                      backgroundColor: '#ffffff',
                      logging: false,
                      width: Math.min(root.scrollWidth || 800, 1200),
                      height: Math.min(root.scrollHeight || 600, 800),
                      onclone: function(clonedDoc) {
                        var imgs = clonedDoc.querySelectorAll('img');
                        imgs.forEach(function(img) {
                          if (img.crossOrigin || (img.src && img.src.indexOf('http') === 0)) {
                            img.style.background = '#e5e7eb';
                            img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="%23e5e7eb" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="%239ca3af" font-size="12">图片</text></svg>');
                          }
                        });
                      }
                    }).then(function(canvas) {
                      var dataUrl = canvas.toDataURL('image/webp', 0.85);
                      window.parent.postMessage({ type: 'preview-capture', dataUrl: dataUrl }, '*');
                    }).catch(function(err) { console.warn('Capture error:', err); });
                  } catch(err) { console.warn('Capture error:', err); }
                }, 500);
              }
            }
          });
        }
      } catch(e) {
        showError('组件渲染错误:\\n' + e.message);
      }
    };
    loadAll([
      ${this.config.useChinaCdn ? `[
        'https://registry.npmmirror.com/react/18.2.0/files/umd/react.production.min.js',
        'https://unpkg.com/react@18.2.0/umd/react.production.min.js'
      ],
      [
        'https://registry.npmmirror.com/react-dom/18.2.0/files/umd/react-dom.production.min.js',
        'https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js'
      ],
      [
        'https://registry.npmmirror.com/@babel/standalone/7.23.9/files/babel.min.js',
        'https://unpkg.com/@babel/standalone@7.23.9/babel.min.js'
      ]` : `[
        'https://unpkg.com/react@18.2.0/umd/react.production.min.js'
      ],
      [
        'https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js'
      ],
      [
        'https://unpkg.com/@babel/standalone@7.23.9/babel.min.js'
      ]`}
    ], function(err) {
      if (err) { showError('核心依赖加载失败'); return; }
      ${esmDeps.length > 0 ? `
      if (!window.__esmLoaded) {
        window.__runPreviewAfterEsm = runPreview;
      } else {
        runPreview();
      }` : `runPreview();`}
    });
    })();
  <\/script>
  ${esmDeps.length > 0 ? `
  <script type="module">
    ${esmImports}
    ${exposeToGlobal}
    window.__esmLoaded = true;
    if (window.__runPreviewAfterEsm) window.__runPreviewAfterEsm();
  <\/script>
  ` : ''}
</body>
</html>`;
  }

  /**
   * 销毁资源
   */
  destroy(): void {
    // 清理资源
  }
}

// 导出单例
let defaultManager: PreviewManager | null = null;

export function getPreviewManager(config?: PreviewConfig): PreviewManager {
  if (!defaultManager) {
    defaultManager = new PreviewManager(config);
  }
  return defaultManager;
}
