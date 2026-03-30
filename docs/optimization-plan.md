# 前端预览项目优化方案

> 基于项目架构分析，整理出的问题清单和解决方案。
> 创建时间：2026-03-22
> 最后更新：2026-03-23
> 状态：✅ 已完成

---

## 目录

1. [问题总览](#一问题总览)
2. [高优先级方案](#二高优先级方案)
3. [中优先级方案](#三中优先级方案)
4. [低优先级方案](#四低优先级方案)
5. [实施计划](#五实施计划)

---

## 一、问题总览

### 问题分布统计

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

### 关键文件索引

| 文件 | 职责 | 问题数 |
|------|------|--------|
| `client/src/lib/preview.ts` | 预览核心逻辑 | 12 |
| `client/src/pages/Gallery.tsx` | 画廊页面 | 3 |
| `server/src/services/zipParser.ts` | ZIP 解析 | 2 |
| `server/src/services/componentService.ts` | 数据服务 | 2 |
| `server/src/db/init.ts` | 数据库初始化 | 2 |

---

## 二、高优先级方案

### P1: 依赖路径分析不完整

**问题描述**

当前 import 正则只匹配 `./xxx` 格式，无法处理：
- 多级相对路径：`../utils`、`../../lib/helper`
- 别名路径：`@/components/Button`、`~/utils/api`

**当前代码**
```typescript
// preview.ts
const importRegex = /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]\.\/([^'"]+)['"]/g;
```

**解决方案**

```typescript
// 增强的 import 正则
const importRegex = /import\s+(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)\s+from\s+['"]([^'"]+)['"]/g;

// 路径解析函数
function resolveImportPath(importPath: string, currentFile: string, aliasConfig: Map<string, string>): string {
  // 处理别名
  for (const [alias, target] of aliasConfig) {
    if (importPath.startsWith(alias)) {
      return importPath.replace(alias, target);
    }
  }

  // 处理相对路径
  if (importPath.startsWith('.')) {
    const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/'));
    return normalizePath(`${currentDir}/${importPath}`);
  }

  // 处理上级路径 ../
  if (importPath.startsWith('..')) {
    const currentDir = currentFile.substring(0, currentFile.lastIndexOf('/'));
    let resolved = currentDir;
    const parts = importPath.split('/');

    for (const part of parts) {
      if (part === '..') {
        resolved = resolved.substring(0, resolved.lastIndexOf('/'));
      } else if (part !== '.') {
        resolved = `${resolved}/${part}`;
      }
    }
    return normalizePath(resolved);
  }

  return importPath;
}
```

**涉及文件**
- `client/src/lib/preview.ts`

---

### P2: 文件路径转换不一致

**问题描述**

ZIP 解析后路径格式为 `/components/Button.tsx`，但依赖分析使用 `./Button` 格式匹配，导致依赖关系解析失败。

**当前代码**
```typescript
// zipParser.ts
const relativePath = '/' + path.replace('src/', '');
sourceFiles[relativePath] = content;

// preview.ts 依赖分析
const importRegex = /import\s+...from\s+['"]\.\/([^'"]+)['"]/g;
```

**解决方案**

统一使用相对路径格式，建立路径映射表：

```typescript
interface FileInfo {
  path: string;           // 标准化路径: src/components/Button.tsx
  relativePath: string;   // 相对路径: ./components/Button
  name: string;           // 文件名: Button
  content: string;
}

function normalizeFilePaths(files: Record<string, string>): Map<string, FileInfo> {
  const fileMap = new Map<string, FileInfo>();

  for (const [originalPath, content] of Object.entries(files)) {
    // 统一转换为 src/ 开头的路径
    let normalizedPath = originalPath
      .replace(/^\//, '')
      .replace(/^src\//, 'src/');

    if (!normalizedPath.startsWith('src/')) {
      normalizedPath = `src/${normalizedPath}`;
    }

    const fileName = normalizedPath.split('/').pop() || '';
    const dirPath = normalizedPath.substring(0, normalizedPath.lastIndexOf('/'));

    fileMap.set(normalizedPath, {
      path: normalizedPath,
      relativePath: `./${normalizedPath.replace('src/', '')}`,
      name: fileName.replace(/\.(tsx?|jsx?)$/, ''),
      content
    });
  }

  return fileMap;
}
```

**涉及文件**
- `client/src/lib/preview.ts`
- `server/src/services/zipParser.ts`

---

### P3: 外部依赖处理缺失

**问题描述**

只为 `framer-motion` 的 `motion` 组件提供了 stub，其他常用库未处理，导致引用这些库的组件报错。

**当前代码**
```typescript
const motion = new Proxy({}, { get: (_, tag) => tag });
```

**解决方案**

扩展 stub 库，支持常用依赖：

```typescript
// 依赖 stub 配置
const DEPENDENCY_STUBS: Record<string, string> = `
// React 生态
const { Link, NavLink, Route, Routes, useParams, useNavigate, useLocation, useHistory, useMatch } = { Link: _stub, NavLink: _stub, Route: _stub, Routes: _stub };
const { Provider, useSelector, useDispatch, connect } = { Provider: _stub, useSelector: () => ({}), useDispatch: () => (() => {}), connect: () => ((c) => c) };

// 工具库
const _ = { debounce: (fn) => fn, throttle: (fn) => fn, cloneDeep: (obj) => JSON.parse(JSON.stringify(obj)), get: (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj) };
const axios = { get: () => Promise.resolve({ data: {} }), post: () => Promise.resolve({ data: {} }) };
const dayjs = (date) => ({ format: () => String(date), valueOf: () => Date.now() });

// UI 库
const motion = new Proxy({}, { get: (_, tag) => tag });
const { AnimatePresence } = { AnimatePresence: ({ children }) => children };

// 图标库
const Icon = _stub;
`;

// 注入到 helpers
const helpers = `
const { useState, useEffect, useRef, useMemo, useCallback, Fragment, createContext, useContext, useReducer, forwardRef, memo, lazy, Suspense, StrictMode, useId, useTransition, useDeferredValue, useImperativeHandle, useLayoutEffect, useSyncExternalStore } = React;
const { createRoot, createPortal } = ReactDOM;
const cn = (...args) => args.filter(Boolean).join(' ');
${DEPENDENCY_STUBS}
`;
```

**涉及文件**
- `client/src/lib/preview.ts`

---

### P4: 组件名称提取脆弱

**问题描述**

无法处理以下格式：
- `export default () => <div>...</div>` （箭头函数）
- `export default class Component extends React.Component` （类组件）
- `export default connect()(Component)` （高阶组件）

**当前代码**
```typescript
const exportMatch = processed.match(/export\s+default\s+function\s+(\w+)/);
const funcMatch = processed.match(/function\s+([A-Z]\w+)\s*[\(<]/);
```

**解决方案**

增加多种匹配模式：

```typescript
function extractComponentName(code: string): string | null {
  // 1. export default function ComponentName
  const funcMatch = code.match(/export\s+default\s+function\s+([A-Z]\w+)/);
  if (funcMatch) return funcMatch[1];

  // 2. function ComponentName ... export default ComponentName
  const namedFuncMatch = code.match(/function\s+([A-Z]\w+)\s*[\(<]/);
  if (namedFuncMatch) {
    const exportCheck = code.match(new RegExp(`export\\s+default\\s+${namedFuncMatch[1]}`));
    if (exportCheck) return namedFuncMatch[1];
  }

  // 3. const ComponentName = () => ... export default ComponentName
  const arrowMatch = code.match(/const\s+([A-Z]\w+)\s*=\s*(?:\([^)]*\)|[^=])*=>/);
  if (arrowMatch) {
    const exportCheck = code.match(new RegExp(`export\\s+default\\s+${arrowMatch[1]}`));
    if (exportCheck) return arrowMatch[1];
  }

  // 4. export default class ComponentName
  const classMatch = code.match(/export\s+default\s+class\s+([A-Z]\w+)/);
  if (classMatch) return classMatch[1];

  // 5. export { ComponentName as default } 或 export default ComponentName
  const exportDefaultMatch = code.match(/export\s+(?:\{|default\s+)([A-Z]\w+)/);
  if (exportDefaultMatch) return exportDefaultMatch[1];

  // 6. 最后尝试找任何大写开头的函数名
  const fallbackMatch = code.match(/(?:function|const)\s+([A-Z]\w+)/);
  if (fallbackMatch) return fallbackMatch[1];

  return null;
}

// 对于无法提取名称的情况，生成包装组件
function wrapAnonymousComponent(code: string): string {
  return `
function __PreviewWrapper() {
  ${code}
  // 尝试调用默认导出
  const DefaultExport = arguments[0];
  return typeof DefaultExport === 'function'
    ? React.createElement(DefaultExport)
    : DefaultExport;
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(__PreviewWrapper));
`;
}
```

**涉及文件**
- `client/src/lib/preview.ts`

---

### P5: postMessage 安全风险

**问题描述**

使用 `'*'` 通配符发送消息，可能被恶意页面监听。

**当前代码**
```typescript
window.parent.postMessage({ type: 'preview-rendered' }, '*');
window.parent.postMessage({ type: 'preview-capture', dataUrl }, '*');
```

**解决方案**

```typescript
// 获取父窗口源
function getParentOrigin(): string {
  try {
    // 尝试从 location.ancestorOrigins 获取
    if (window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
      return window.location.ancestorOrigins[0];
    }
  } catch {
    // 忽略跨域错误
  }

  // 回退到当前页面的源
  return window.location.origin || '*';
}

const parentOrigin = getParentOrigin();

// 使用确定的源发送消息
window.parent.postMessage({ type: 'preview-rendered' }, parentOrigin);
window.parent.postMessage({ type: 'preview-capture', dataUrl }, parentOrigin);
```

**涉及文件**
- `client/src/lib/preview.ts`

---

## 三、中优先级方案

### P6: import/export 处理不完整

**问题描述**

- 动态 `import()` 表达式未处理
- `export const`、`export { a, b }` 等格式处理不当
- `export = ` TypeScript 语法可能被错误匹配

**解决方案**

```typescript
function transformImportsExports(code: string): string {
  let result = code;

  // 1. 移除静态 import 语句
  result = result.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '');
  result = result.replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '');

  // 2. 移除动态 import（替换为空对象）
  result = result.replace(/import\s*\([^)]*\)/g, 'Promise.resolve({ default: function(){} })');

  // 3. 处理 export default
  result = result.replace(/export\s+default\s+function/g, 'function');
  result = result.replace(/export\s+default\s+class/g, 'class');
  result = result.replace(/export\s+default\s+/g, 'const __default__ = ');

  // 4. 处理命名导出
  result = result.replace(/export\s+const\s+/g, 'const ');
  result = result.replace(/export\s+let\s+/g, 'let ');
  result = result.replace(/export\s+var\s+/g, 'var ');
  result = result.replace(/export\s+function\s+/g, 'function ');
  result = result.replace(/export\s+class\s+/g, 'class ');

  // 5. 处理 export { a, b }
  result = result.replace(/export\s+\{[^}]*\}\s*;?/g, '');

  // 6. 处理 TypeScript export type
  result = result.replace(/export\s+type\s+\w+\s*=\s*[^;]+;?/g, '');
  result = result.replace(/export\s+interface\s+\w+\s*\{[^}]*\}/g, '');

  return result;
}
```

**涉及文件**
- `client/src/lib/preview.ts`

---

### P7: 循环依赖检测无处理

**问题描述**

检测到循环依赖后返回 `false`，但调用方没有检查，导致组件被静默忽略。

**解决方案**

```typescript
interface SortResult {
  sorted: { path: string; content: string }[];
  circularDependencies: string[][];
  warnings: string[];
}

function sortFilesByDependency(files: { path: string; content: string }[]): SortResult {
  const circularDependencies: string[][] = [];
  const warnings: string[] = [];
  const sorted: { path: string; content: string }[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const path = new Set<string>();

  function visit(fileName: string): boolean {
    if (visited.has(fileName)) return true;

    if (visiting.has(fileName)) {
      // 记录循环依赖
      const cycle = [...path, fileName].slice([...path].indexOf(fileName));
      circularDependencies.push(cycle);
      warnings.push(`检测到循环依赖: ${cycle.join(' → ')}`);
      return true; // 继续处理，而不是中断
    }

    visiting.add(fileName);
    path.add(fileName);

    const deps = dependencies.get(fileName);
    if (deps) {
      for (const dep of deps) {
        visit(dep);
      }
    }

    visiting.delete(fileName);
    path.delete(fileName);
    visited.add(fileName);

    const file = fileMap.get(fileName);
    if (file) sorted.push(file);
    return true;
  }

  // ... 排序逻辑

  return { sorted, circularDependencies, warnings };
}

// 在构建时显示警告
const sortResult = sortFilesByDependency(jsFiles);
if (sortResult.warnings.length > 0) {
  console.warn('依赖排序警告:', sortResult.warnings);
}
```

**涉及文件**
- `client/src/lib/preview.ts`

---

### P8: 依赖版本硬编码

**问题描述**

React 版本固定为 18.2.0，数据库中存储的 `dependencies` 字段完全未使用。

**解决方案**

```typescript
// 定义支持的依赖版本
const SUPPORTED_DEPENDENCIES = {
  react: { default: '18.2.0', versions: ['18.2.0', '18.0.0'] },
  'react-dom': { default: '18.2.0', versions: ['18.2.0', '18.0.0'] },
  tailwindcss: { default: '3.4.17', versions: ['3.4.17', '3.4.0'] }
};

function buildDependencyUrls(componentDeps?: Record<string, string>): string[] {
  const urls: string[] = [];

  // React
  const reactVersion = componentDeps?.react || SUPPORTED_DEPENDENCIES.react.default;
  urls.push(`https://registry.npmmirror.com/react/${reactVersion}/files/umd/react.production.min.js`);

  // ReactDOM
  const reactDomVersion = componentDeps?.['react-dom'] || SUPPORTED_DEPENDENCIES['react-dom'].default;
  urls.push(`https://registry.npmmirror.com/react-dom/${reactDomVersion}/files/umd/react-dom.production.min.js`);

  return urls;
}
```

**涉及文件**
- `client/src/lib/preview.ts`

---

### P9: 截图时机硬编码

**问题描述**

固定 800ms 延迟，复杂组件可能还未渲染完成。

**解决方案**

```typescript
// 使用 MutationObserver 监听 DOM 稳定
function waitForDomStable(root: HTMLElement, callback: () => void, timeout = 5000) {
  let timer: number;
  let mutationCount = 0;

  const observer = new MutationObserver(() => {
    mutationCount++;
    clearTimeout(timer);
    timer = setTimeout(() => {
      // 连续 300ms 无变化则认为稳定
      observer.disconnect();
      callback();
    }, 300);
  });

  observer.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true
  });

  // 超时保护
  setTimeout(() => {
    observer.disconnect();
    callback();
  }, timeout);
}

// 在渲染完成后调用
waitForDomStable(root, () => {
  window.parent.postMessage({ type: 'preview-rendered' }, parentOrigin);
});
```

**涉及文件**
- `client/src/lib/preview.ts`

---

### P10: 编译错误信息不友好

**问题描述**

仅显示错误消息，无位置和堆栈信息。

**解决方案**

```typescript
function handleBabelError(error: Error, code: string): void {
  // 解析 Babel 错误位置
  const lineMatch = error.message.match(/line\s+(\d+)/i);
  const colMatch = error.message.match(/column\s+(\d+)/i);

  const line = lineMatch ? parseInt(lineMatch[1]) : null;
  const col = colMatch ? parseInt(colMatch[1]) : null;

  // 构建错误信息
  let errorHtml = `
    <div style="font-family: monospace; white-space: pre-wrap; padding: 16px; background: #1a1a1a; color: #ff6b6b; border-radius: 8px;">
      <div style="color: #ff9f43; font-weight: bold; margin-bottom: 8px;">编译错误</div>
      <div style="color: #fff; margin-bottom: 16px;">${escapeHtml(error.message)}</div>
  `;

  // 显示错误位置代码
  if (line) {
    const codeLines = code.split('\n');
    const startLine = Math.max(0, line - 3);
    const endLine = Math.min(codeLines.length, line + 2);

    errorHtml += `<div style="background: #2a2a2a; padding: 8px; border-radius: 4px;">`;
    for (let i = startLine; i < endLine; i++) {
      const lineNum = i + 1;
      const isErrLine = lineNum === line;
      const lineStyle = isErrLine ? 'background: #ff000020; color: #ff6b6b;' : '';
      const prefix = isErrLine ? '>>> ' : '    ';

      errorHtml += `<div style="${lineStyle} padding: 0 8px;">${prefix}${lineNum} | ${escapeHtml(codeLines[i])}</div>`;

      if (isErrLine && col) {
        errorHtml += `<div style="color: #ff6b6b; padding-left: ${col + 12}ch;">^</div>`;
      }
    }
    errorHtml += `</div>`;
  }

  errorHtml += `</div>`;

  document.getElementById('root')!.innerHTML = errorHtml;
}
```

**涉及文件**
- `client/src/lib/preview.ts`

---

### P11: API 错误处理不统一

**问题描述**

未检查 HTTP 状态码，网络错误未统一处理。

**解决方案**

```typescript
// api.ts 统一错误处理
interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: unknown;
}

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });

    // 检查 HTTP 状态码
    if (!response.ok) {
      const error: ApiError = {
        code: 'HTTP_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status
      };

      // 尝试解析错误响应体
      try {
        const body = await response.json();
        error.message = body.message || error.message;
        error.details = body;
      } catch {
        // 忽略解析错误
      }

      return { success: false, error: error.message };
    }

    return response.json();
  } catch (error) {
    // 网络错误处理
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络请求失败'
    };
  }
}
```

**涉及文件**
- `client/src/lib/api.ts`

---

### P12: 无代码大小限制

**问题描述**

极大代码可能导致浏览器崩溃。

**解决方案**

```typescript
// 前端限制
const MAX_CODE_SIZE = 500 * 1024; // 500KB

function validateCodeSize(code: string, files?: Record<string, string>): { valid: boolean; message?: string } {
  let totalSize = code.length;

  if (files) {
    for (const content of Object.values(files)) {
      totalSize += content.length;
    }
  }

  if (totalSize > MAX_CODE_SIZE) {
    return {
      valid: false,
      message: `代码总大小 ${(totalSize / 1024).toFixed(1)}KB 超过限制 ${MAX_CODE_SIZE / 1024}KB`
    };
  }

  return { valid: true };
}

// 后端限制 (server/src/routes/components.ts)
const MAX_BODY_SIZE = 1024 * 1024; // 1MB
app.use(express.json({ limit: MAX_BODY_SIZE }));
```

**涉及文件**
- `client/src/lib/preview.ts`
- `server/src/index.ts`

---

### P13: 无代码缓存机制

**问题描述**

相同组件重复渲染时没有利用缓存。

**解决方案**

```typescript
// 使用 Map 缓存编译结果
const previewCache = new Map<string, { html: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟

function getCachedPreview(code: string, files?: Record<string, string> | null): string | null {
  const cacheKey = generateCacheKey(code, files);
  const cached = previewCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.html;
  }

  return null;
}

function setCachedPreview(code: string, files: Record<string, string> | null | undefined, html: string): void {
  const cacheKey = generateCacheKey(code, files);
  previewCache.set(cacheKey, { html, timestamp: Date.now() });

  // 清理过期缓存
  if (previewCache.size > 100) {
    const now = Date.now();
    for (const [key, value] of previewCache) {
      if (now - value.timestamp > CACHE_TTL) {
        previewCache.delete(key);
      }
    }
  }
}

function generateCacheKey(code: string, files?: Record<string, string> | null): string {
  const filesStr = files ? JSON.stringify(files) : '';
  return `${code.length}:${code.slice(0, 100)}:${filesStr.length}`;
}
```

**涉及文件**
- `client/src/lib/preview.ts`

---

### P14: 批量数据库插入效率低

**问题描述**

循环执行单条 INSERT，性能较差。

**解决方案**

```typescript
// componentService.ts
async function createComponents(inputs: CreateComponentInput[], conn: PoolConnection): Promise<void> {
  if (inputs.length === 0) return;

  // 批量 INSERT
  const values = inputs.map(input => [
    input.id,
    input.name,
    input.category_id,
    input.description,
    input.code,
    JSON.stringify(input.files || {}),
    JSON.stringify(input.dependencies || {}),
    input.preview_image,
    JSON.stringify(input.tags || [])
  ]);

  const placeholders = values.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const sql = `
    INSERT INTO components (id, name, category_id, description, code, files, dependencies, preview_image, tags)
    VALUES ${placeholders}
  `;

  await conn.query(sql, values.flat());
}
```

**涉及文件**
- `server/src/services/componentService.ts`

---

## 四、低优先级方案

### P15: React Hook 遗漏

补全所有 React 18+ Hook：
```typescript
const { useState, useEffect, useRef, useMemo, useCallback, Fragment,
        createContext, useContext, useReducer, forwardRef, memo, lazy,
        Suspense, StrictMode, useId, useTransition, useDeferredValue,
        useImperativeHandle, useLayoutEffect, useSyncExternalStore,
        useInsertionEffect, useDebugValue } = React;
```

---

### P16: Babel 配置扩展

按需添加实验性语法支持：
```typescript
Babel.transform(code, {
  presets: ['react', ['typescript', { allExtensions: true, isTSX: true }]],
  plugins: [
    // 按需添加
    // '@babel/plugin-proposal-decorators',
    // '@babel/plugin-proposal-class-properties'
  ]
});
```

---

### P17-18: 截图优化

- html2canvas 加载失败时显示降级提示
- 支持可配置的截图尺寸

---

### P19: sandbox 配置统一

统一 Gallery 和 ComponentDetail 的 sandbox 策略：
```typescript
// 配置文件
const IFRAME_SANDBOX = {
  preview: 'allow-scripts',                    // 仅预览
  capture: 'allow-scripts allow-same-origin'   // 需要截图
};
```

---

### P20: 截图存储优化

将 base64 截图改为文件存储：
```typescript
// 上传到 CDN 或本地文件系统
async function savePreviewImage(componentId: string, dataUrl: string): Promise<string> {
  const buffer = Buffer.from(dataUrl.split(',')[1], 'base64');
  const filename = `previews/${componentId}.webp`;

  // 存储到文件系统或 CDN
  await fs.writeFile(`uploads/${filename}`, buffer);

  // 返回 URL
  return `/uploads/${filename}`;
}
```

---

### P21: 数据库索引

```sql
-- 添加索引
CREATE INDEX idx_components_category ON components(category_id);
CREATE INDEX idx_components_name ON components(name);
CREATE INDEX idx_components_created ON components(created_at);
CREATE INDEX idx_components_views ON components(view_count);

-- 全文索引（如果支持）
CREATE FULLTEXT INDEX idx_components_search ON components(name, description);
```

---

## 五、实施计划

### 阶段一：核心修复（预计 2-3 天）

| 任务 | 优先级 | 预估时间 |
|------|--------|----------|
| P1: 依赖路径分析增强 | 高 | 4h |
| P2: 文件路径格式统一 | 高 | 2h |
| P3: 外部依赖 stub 扩展 | 高 | 2h |
| P4: 组件名称提取改进 | 高 | 3h |
| P5: postMessage 安全修复 | 高 | 1h |

### 阶段二：体验优化（预计 2 天）

| 任务 | 优先级 | 预估时间 |
|------|--------|----------|
| P6: import/export 处理完善 | 中 | 2h |
| P7: 循环依赖处理 | 中 | 2h |
| P9: 截图时机优化 | 中 | 3h |
| P10: 错误信息优化 | 中 | 2h |
| P11: API 错误处理 | 中 | 2h |

### 阶段三：性能优化（预计 1-2 天）

| 任务 | 优先级 | 预估时间 |
|------|--------|----------|
| P12: 代码大小限制 | 中 | 1h |
| P13: 代码缓存机制 | 中 | 3h |
| P14: 批量数据库优化 | 中 | 2h |
| P21: 数据库索引 | 低 | 1h |

### 阶段四：持续优化（根据需求）

| 任务 | 优先级 | 预估时间 |
|------|--------|----------|
| P8: 依赖版本动态配置 | 中 | 2h |
| P15-19: 低优先级修复 | 低 | 4h |
| P20: 截图存储优化 | 低 | 3h |

---

## 附录：测试用例

### 依赖路径测试

```typescript
// 测试用例
describe('resolveImportPath', () => {
  it('should resolve ./relative path', () => {
    expect(resolveImportPath('./Button', 'src/components/Card.tsx', new Map()))
      .toBe('src/components/Button.tsx');
  });

  it('should resolve ../parent path', () => {
    expect(resolveImportPath('../utils', 'src/components/Card.tsx', new Map()))
      .toBe('src/utils.tsx');
  });

  it('should resolve alias path', () => {
    const aliases = new Map([['@/', 'src/']]);
    expect(resolveImportPath('@/components/Button', 'src/main.tsx', aliases))
      .toBe('src/components/Button.tsx');
  });
});
```

### 组件名称提取测试

```typescript
describe('extractComponentName', () => {
  it('should extract from export default function', () => {
    expect(extractComponentName('export default function Button() {}'))
      .toBe('Button');
  });

  it('should extract from arrow function', () => {
    expect(extractComponentName('const Button = () => <div/>; export default Button;'))
      .toBe('Button');
  });

  it('should extract from class', () => {
    expect(extractComponentName('export default class Button extends React.Component {}'))
      .toBe('Button');
  });

  it('should return null for anonymous export', () => {
    expect(extractComponentName('export default () => <div/>'))
      .toBe(null);
  });
});
```

---

> 文档版本：v1.0
> 最后更新：2026-03-22
