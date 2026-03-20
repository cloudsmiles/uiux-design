/**
 * 构建可在 iframe 中直接渲染的 HTML。
 * 使用 Tailwind CDN + Babel Standalone + React UMD，纯本地渲染。
 */
export function buildPreviewHtml(
  code: string,
  files?: Record<string, string> | null,
): string {
  let cssCode = '';
  let jsCode = code;

  if (files && Object.keys(files).length > 0) {
    const jsParts: string[] = [];
    let filesHaveApp = false;
    for (const [path, content] of Object.entries(files)) {
      if (path.endsWith('.css')) {
        cssCode += content
          .replace(/@import\s+['"]tailwindcss['"];?/g, '')
          .replace(/@tailwind\s+\w+;?/g, '')
          + '\n';
      } else {
        jsParts.push(content);
        const fileName = path.split('/').pop() || '';
        if (fileName === 'App.tsx' || fileName === 'App.jsx') {
          filesHaveApp = true;
        }
      }
    }
    if (!filesHaveApp) {
      jsParts.push(code);
    }
    jsCode = jsParts.join('\n');
  }

  const scriptCode = buildComponentScript(jsCode);

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; }
    #error-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.85);
      color: #ff6b6b; padding: 20px; font-family: monospace; font-size: 14px;
      white-space: pre-wrap; overflow: auto; z-index: 9999; }
    #error-overlay.show { display: block; }
    #loading { display: flex; align-items: center; justify-content: center;
      height: 100vh; color: #999; font-size: 14px; }
    ${cssCode}
  </style>
</head>
<body>
  <div id="root"><div id="loading">加载预览中...</div></div>
  <div id="error-overlay"></div>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <script>
    function showError(msg) {
      var el = document.getElementById('error-overlay');
      el.textContent = msg;
      el.className = 'show';
    }
    try {
      if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
        showError('React 加载失败，请检查网络连接。');
      } else if (typeof Babel === 'undefined') {
        showError('Babel 加载失败，请检查网络连接。');
      } else {
        var code = ${JSON.stringify(scriptCode)};
        var output = Babel.transform(code, {
          presets: ['react', ['typescript', { allExtensions: true, isTSX: true }]],
          filename: 'component.tsx'
        }).code;
        var script = document.createElement('script');
        script.textContent = output;
        document.body.appendChild(script);
        // 通知父窗口渲染完成
        setTimeout(function() {
          window.parent.postMessage({ type: 'preview-rendered' }, '*');
        }, 500);
      }
    } catch(e) {
      showError('组件渲染错误:\\n' + e.message);
    }
  <\/script>
</body>
</html>`;
}

function buildComponentScript(code: string): string {
  // 提取 import 中的命名导入，用于生成 stub
  const importedNames: string[] = [];
  const importRegex = /^import\s+\{([^}]+)\}\s+from\s+['"][^'"]+['"];?\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = importRegex.exec(code)) !== null) {
    m[1].split(',').forEach(s => {
      const name = s.trim().split(/\s+as\s+/).pop()?.trim();
      if (name) importedNames.push(name);
    });
  }
  // 也提取 default import
  const defaultImportRegex = /^import\s+(\w+)\s+from\s+['"][^'"]+['"];?\s*$/gm;
  while ((m = defaultImportRegex.exec(code)) !== null) {
    importedNames.push(m[1]);
  }

  let processed = code
    .replace(/^import\s+.*?from\s+['"][^'"]+['"];?\s*$/gm, '')
    .replace(/^import\s+['"][^'"]+['"];?\s*$/gm, '');

  const exportMatch = processed.match(/export\s+default\s+function\s+(\w+)/);
  const componentName = exportMatch ? exportMatch[1] : null;

  processed = processed
    .replace(/export\s+default\s+function/g, 'function')
    .replace(/export\s+default\s+/g, '')
    .replace(/export\s+/g, '');

  // React hooks 和内置变量不需要 stub
  const builtins = new Set([
    'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback', 'Fragment',
    'createContext', 'useContext', 'useReducer', 'forwardRef', 'memo', 'lazy',
    'Suspense', 'StrictMode', 'createRoot', 'createPortal', 'React', 'ReactDOM',
    'cn', 'motion',
  ]);
  const stubs = importedNames
    .filter(n => !builtins.has(n))
    .map(n => `if (typeof ${n} === 'undefined') var ${n} = _iconStub;`)
    .join('\n');

  const helpers = `
const { useState, useEffect, useRef, useMemo, useCallback, Fragment, createContext, useContext, useReducer, forwardRef, memo, lazy, Suspense, StrictMode } = React;
const { createRoot } = ReactDOM;
const { createPortal } = ReactDOM;
const cn = (...args) => args.filter(Boolean).join(' ');
const motion = new Proxy({}, { get: (_, tag) => tag });
// 兜底：任何未定义的变量（如 lucide 图标）渲染为空 SVG 占位
const _iconStub = (props) => React.createElement('svg', { width: props?.size || 24, height: props?.size || 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', className: props?.className || '', style: props?.style });
`;

  if (componentName) {
    return `${helpers}\n${stubs}\n${processed}\n\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${componentName}));`;
  }

  const funcMatch = processed.match(/function\s+([A-Z]\w+)\s*[\(<]/);
  if (funcMatch) {
    return `${helpers}\n${stubs}\n${processed}\n\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(${funcMatch[1]}));`;
  }

  return `${helpers}\n${stubs}\nfunction Preview() {\n  return React.createElement('div', {className: 'min-h-screen bg-zinc-100 flex items-center justify-center p-8'}, ${JSON.stringify(processed)});\n}\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Preview));`;
}
