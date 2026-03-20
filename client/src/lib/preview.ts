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
  <script src="https://cdn.jsdelivr.net/npm/tailwindcss-cdn@3.4.10/tailwindcss.js"><\/script>
  <script src="https://cdn.bootcdn.net/ajax/libs/react/18.2.0/umd/react.production.min.js"><\/script>
  <script src="https://cdn.bootcdn.net/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"><\/script>
  <script src="https://cdn.bootcdn.net/ajax/libs/babel-standalone/7.23.9/babel.min.js"><\/script>
  <script>
    function showError(msg) {
      var el = document.getElementById('error-overlay');
      el.textContent = msg;
      el.className = 'show';
    }
    // 全局 stub：任何未定义的大写开头变量自动变成 SVG 占位组件
    var _iconStub = function(props) {
      return React.createElement('svg', {
        width: (props && props.size) || 24, height: (props && props.size) || 24,
        viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
        strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
        className: (props && props.className) || '', style: props && props.style
      });
    };
    // Proxy on window: 访问未定义的大写开头属性时返回 _iconStub
    window.__origGet = Window.prototype.__lookupGetter__ ? undefined : undefined;
    var _proxyHandler = {
      get: function(target, prop, receiver) {
        if (typeof prop === 'string' && prop.length > 0 && prop[0] >= 'A' && prop[0] <= 'Z' && !(prop in target)) {
          return _iconStub;
        }
        return Reflect.get(target, prop, receiver);
      }
    };
    try {
      // 不能直接 proxy window，但可以用 with + Proxy 的方式
      // 更简单的方案：编译后扫描未定义变量并注入
    } catch(e) {}
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
        // 扫描编译后代码中引用的未定义大写变量，自动注入 stub
        var _defined = new Set(Object.keys(window));
        _defined.add('React'); _defined.add('ReactDOM'); _defined.add('Babel');
        var _varMatch = output.match(/\\b([A-Z][A-Za-z0-9_]*)\\b/g);
        if (_varMatch) {
          var _seen = new Set();
          _varMatch.forEach(function(v) {
            if (!_seen.has(v) && !_defined.has(v)) {
              _seen.add(v);
              try { if (typeof window[v] === 'undefined') window[v] = _iconStub; } catch(e) {}
            }
          });
        }
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
  // 删除所有 import 语句（支持多行）
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
const { useState, useEffect, useRef, useMemo, useCallback, Fragment, createContext, useContext, useReducer, forwardRef, memo, lazy, Suspense, StrictMode } = React;
const { createRoot } = ReactDOM;
const { createPortal } = ReactDOM;
const cn = (...args) => args.filter(Boolean).join(' ');
const motion = new Proxy({}, { get: (_, tag) => tag });
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
