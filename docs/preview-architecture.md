# 前端预览原理

本文档详细说明组件画廊中 React 组件实时预览的实现原理。

## 整体架构

预览系统采用 **iframe + Babel Standalone** 方案，在浏览器端实时编译和渲染 React 组件，无需后端参与。

```
┌─────────────────────────────────────────────────────────────┐
│  父页面 (ComponentDetail.tsx)                                │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  iframe                                                  ││
│  │  sandbox="allow-scripts"                                ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │  buildPreviewHtml() 生成的完整 HTML                  │││
│  │  │  ├── Tailwind CSS 4 CDN                            │││
│  │  │  ├── React 18 UMD (多 CDN 降级)                     │││
│  │  │  ├── ReactDOM 18 UMD                                │││
│  │  │  ├── Babel Standalone (浏览器端编译)                 │││
│  │  │  └── 用户组件代码 (编译后执行)                        │││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
│                                                             │
│  postMessage 通信                                           │
│  ├── preview-rendered  ← iframe 通知渲染完成                │
│  ├── capture-request   → iframe 请求截图                    │
│  └── preview-capture   ← iframe 返回截图数据                │
└─────────────────────────────────────────────────────────────┘
```

## 核心流程

### 1. HTML 构建 (`buildPreviewHtml`)

`client/src/lib/preview.ts` 中的 `buildPreviewHtml()` 函数负责生成完整的预览 HTML。

**输入**:
- `code`: 主组件代码 (App.tsx)
- `files`: 多文件组件的附加文件 (CSS、子组件等)

**处理步骤**:

```typescript
// 1. 分离 CSS 和 JS 文件
for (const [path, content] of Object.entries(files)) {
  if (path.endsWith('.css')) {
    cssCode += content;  // 合并所有 CSS
  } else {
    jsParts.push(content);  // 合并所有 JS/TSX
  }
}

// 2. 处理代码（移除 import、export）
const scriptCode = buildComponentScript(jsCode);
```

### 2. 代码转换 (`buildComponentScript`)

将用户的 TSX 代码转换为可在浏览器直接执行的形式：

```typescript
// a) 移除所有 import 语句
code.replace(/^import\s+[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')

// b) 移除 export 关键字
code.replace(/export\s+default\s+function/g, 'function')
    .replace(/export\s+default\s+/g, '')
    .replace(/export\s+/g, '')

// c) 注入 React 常用 Hook 解构
const helpers = `
const { useState, useEffect, useRef, useMemo, useCallback, Fragment,
        createContext, useContext, useReducer, forwardRef, memo, lazy,
        Suspense, StrictMode } = React;
const { createRoot, createPortal } = ReactDOM;
const cn = (...args) => args.filter(Boolean).join(' ');
`;

// d) 自动渲染组件
ReactDOM.createRoot(document.getElementById('root')).render(
  React.createElement(ComponentName)
);
```

### 3. CDN 加载策略

采用多 CDN 降级机制确保国内访问稳定：

```javascript
// 每个库配置多个 CDN 源
loadAll([
  [
    'https://registry.npmmirror.com/react/18.2.0/files/umd/react.production.min.js',
    'https://cdn.bootcdn.net/ajax/libs/react/18.2.0/umd/react.production.min.js',
    'https://unpkg.com/react@18.2.0/umd/react.production.min.js'
  ],
  // ReactDOM, Babel 同理...
], callback);
```

加载器依次尝试每个 URL，失败则切换到下一个源。

### 4. Babel 编译

在 iframe 中使用 Babel Standalone 实时编译 TSX：

```javascript
var output = Babel.transform(code, {
  presets: ['react', ['typescript', { allExtensions: true, isTSX: true }]],
  filename: 'component.tsx'
}).code;
```

### 5. 未定义组件的 Stub 处理

组件可能引用未导入的子组件（如 `<Icon />`），系统自动生成占位符：

```javascript
// 扫描编译后代码中的大写标识符
var _matches = output.match(/\b([A-Z][A-Za-z0-9_]*)\b/g);

// 为未定义的组件生成 stub
var _stub = function(props) {
  return React.createElement('svg', { /* 默认 SVG 占位 */ });
};
for (var v of _matches) {
  if (!isDefined(v)) {
    _stubs += `var ${v} = _stub;`;
  }
}
```

这样 `<Icon name="check" />` 会渲染为一个空白 SVG 占位，避免报错。

### 6. 预览截图

通过 postMessage 实现父子窗口通信：

**流程**:
1. iframe 渲染完成后发送 `preview-rendered` 消息
2. 父窗口检测到组件无预览图时，发送 `capture-request`
3. iframe 使用 SVG foreignObject + Canvas 生成 base64 截图
4. iframe 将截图数据通过 `preview-capture` 返回

```javascript
// iframe 内截图逻辑
var svg = '<svg xmlns="http://www.w3.org/2000/svg">' +
  '<foreignObject>' + document.documentElement.innerHTML + '</foreignObject></svg>';
var img = new Image();
img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
img.onload = function() {
  var canvas = document.createElement('canvas');
  ctx.drawImage(img, 0, 0);
  var dataUrl = canvas.toDataURL('image/webp', 0.85);
  window.parent.postMessage({ type: 'preview-capture', dataUrl }, '*');
};
```

## 安全隔离

iframe 使用 `sandbox="allow-scripts"` 属性，仅允许脚本执行：

- 禁止表单提交
- 禁止弹窗
- 禁止同源访问
- 禁止导航

这确保用户上传的组件代码不会影响父页面。

## Tailwind CSS 支持

预览环境使用 Tailwind CSS 4 CDN 版本：

```html
<script src="https://s4.zstatic.net/npm/@tailwindcss/browser@4.2.2/dist/index.global.js"></script>
```

用户代码中的 Tailwind 类名可直接生效，无需额外配置。

## 局限性

1. **不支持外部依赖**: `import { motion } from 'framer-motion'` 无法工作
   - 解决方案：为常用库注入 stub（如 `motion` 已处理）

2. **不支持 Node.js API**: `fs`, `path` 等不可用

3. **不支持 CSS Modules**: `.module.css` 导入无效

4. **不支持服务端渲染**: 仅客户端组件
