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
    html, body { width: 100%; min-height: 100vh; }
    body { font-family: ui-sans-serif, system-ui, sans-serif; display: flex; align-items: center; justify-content: center; }
    #root { width: 100%; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
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
  <script src="https://s4.zstatic.net/npm/@tailwindcss/browser@4.2.2/dist/index.global.js"><\/script>
  <script>
    // CDN fallback 加载器
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
        loadScript(list[idx], function(err) {
          if (err) { done(err); return; }
          idx++; next();
        });
      }
      next();
    }
    loadAll([
      [
        'https://registry.npmmirror.com/react/18.2.0/files/umd/react.production.min.js',
        'https://cdn.bootcdn.net/ajax/libs/react/18.2.0/umd/react.production.min.js',
        'https://unpkg.com/react@18.2.0/umd/react.production.min.js'
      ],
      [
        'https://registry.npmmirror.com/react-dom/18.2.0/files/umd/react-dom.production.min.js',
        'https://cdn.bootcdn.net/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
        'https://unpkg.com/react-dom@18.2.0/umd/react-dom.production.min.js'
      ],
      [
        'https://registry.npmmirror.com/@babel/standalone/7.23.9/files/babel.min.js',
        'https://cdn.bootcdn.net/ajax/libs/babel-standalone/7.23.9/babel.min.js',
        'https://unpkg.com/@babel/standalone@7.23.9/babel.min.js'
      ]
    ], function(err) {
      if (err) { showError('依赖加载失败，请检查网络连接。'); return; }
      runPreview();
    });
  <\/script>
  <script>
    function showError(msg) {
      var el = document.getElementById('error-overlay');
      el.textContent = msg;
      el.className = 'show';
    }
    function runPreview() {
    try {
      if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
        showError('React 加载失败，请检查网络连接。');
      } else if (typeof Babel === 'undefined') {
        showError('Babel 加载失败，请检查网络连接。');
      } else {
        var _stub = function(props) {
          return React.createElement('svg', {
            width: (props && props.size) || 24, height: (props && props.size) || 24,
            viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
            strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round',
            className: (props && props.className) || '', style: props && props.style
          });
        };
        var code = ${JSON.stringify(scriptCode)};
        var output = Babel.transform(code, {
          presets: ['react', ['typescript', { allExtensions: true, isTSX: true }]],
          filename: 'component.tsx'
        }).code;
        // 扫描编译后代码中大写开头的标识符，为未定义的生成 var 声明
        // 自动收集已声明的变量名，避免重复声明
        var _skip = {'React':1,'ReactDOM':1,'Babel':1,'Object':1,'Array':1,'String':1,'Number':1,'Boolean':1,'Date':1,'Math':1,'JSON':1,'Promise':1,'Error':1,'TypeError':1,'RangeError':1,'Map':1,'Set':1,'WeakMap':1,'WeakSet':1,'Symbol':1,'Proxy':1,'Reflect':1,'RegExp':1,'Int8Array':1,'Uint8Array':1,'Float32Array':1,'Float64Array':1,'ArrayBuffer':1,'DataView':1,'URL':1,'URLSearchParams':1,'FormData':1,'Headers':1,'Request':1,'Response':1,'Event':1,'CustomEvent':1,'Node':1,'Element':1,'HTMLElement':1,'Document':1,'Window':1,'Navigator':1,'Infinity':1,'NaN':1,'SVGElement':1,'Fragment':1,'StrictMode':1,'Suspense':1};
        // 也从编译后代码中提取已有的 const/let/var/function 声明
        var _declMatches = output.match(/(?:const|let|var|function)\\s+([A-Z][A-Za-z0-9_]*)/g) || [];
        for (var d = 0; d < _declMatches.length; d++) {
          var dn = _declMatches[d].replace(/^(?:const|let|var|function)\\s+/, '');
          _skip[dn] = 1;
        }
        var _matches = output.match(/\\b([A-Z][A-Za-z0-9_]*)\\b/g) || [];
        var _seen = {};
        var _stubs = '';
        for (var i = 0; i < _matches.length; i++) {
          var v = _matches[i];
          if (!_seen[v] && !_skip[v]) {
            _seen[v] = 1;
            _stubs += 'var ' + v + ' = typeof ' + v + ' !== "undefined" ? ' + v + ' : _stub;\\n';
          }
        }
        var script = document.createElement('script');
        script.textContent = 'var _stub = window._stub;\\n' + _stubs + output;
        window._stub = _stub;
        document.body.appendChild(script);
        setTimeout(function() {
          window.parent.postMessage({ type: 'preview-rendered' }, '*');
        }, 800);
        // 监听父窗口的截图请求
        window.addEventListener('message', function(e) {
          if (e.data && e.data.type === 'capture-request') {
            setTimeout(function() {
              try {
                var root = document.getElementById('root');
                if (!root) return;
                var rect = root.getBoundingClientRect();
                var w = Math.min(rect.width || document.documentElement.scrollWidth, 1200);
                var h = Math.min(rect.height || document.documentElement.scrollHeight, 800);
                var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '">' +
                  '<foreignObject width="100%" height="100%">' +
                  new XMLSerializer().serializeToString(document.documentElement) +
                  '</foreignObject></svg>';
                var img = new Image();
                img.onload = function() {
                  var canvas = document.createElement('canvas');
                  canvas.width = w * 2;
                  canvas.height = h * 2;
                  var ctx = canvas.getContext('2d');
                  ctx.scale(2, 2);
                  ctx.drawImage(img, 0, 0);
                  var dataUrl = canvas.toDataURL('image/webp', 0.85);
                  window.parent.postMessage({ type: 'preview-capture', dataUrl: dataUrl }, '*');
                };
                img.onerror = function() {};
                img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
              } catch(err) { console.warn('Capture error:', err); }
            }, 1000);
          }
        });
      }
    } catch(e) {
      showError('组件渲染错误:\\n' + e.message);
    }
    } // end runPreview
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
