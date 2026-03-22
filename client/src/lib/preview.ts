/**
 * 构建可在 iframe 中直接渲染的 HTML。
 * 使用 Tailwind CDN + Babel Standalone + React UMD，纯本地渲染。
 * 如果代码是纯 HTML，则直接渲染，不走 React 路径。
 */
export function buildPreviewHtml(
  code: string,
  files?: Record<string, string> | null,
): string {
  // 检测是否为纯 HTML 代码
  if (isHtmlCode(code, files)) {
    return buildHtmlPreview(code, files);
  }

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
    *, *::before, *::after { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; width: 100%; min-height: 100%; }
    body { font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background: #fff; }
    #root { width: 100%; min-height: 100%; }
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
            // 动态加载 html2canvas
            if (typeof html2canvas === 'undefined') {
              var s = document.createElement('script');
              s.src = 'https://registry.npmmirror.com/html2canvas/1.4.1/files/dist/html2canvas.min.js';
              s.onload = function() { doCapture(); };
              s.onerror = function() {
                var s2 = document.createElement('script');
                s2.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
                s2.onload = function() { doCapture(); };
                s2.onerror = function() { console.warn('html2canvas 加载失败'); };
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
                  }).catch(function(err) {
                    console.warn('Capture error:', err);
                  });
                } catch(err) { console.warn('Capture error:', err); }
              }, 500);
            }
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


/**
 * 检测代码是否为纯 HTML（而非 React/JSX 组件）
 */
function isHtmlCode(code: string, files?: Record<string, string> | null): boolean {
  const trimmed = code.trim();
  // 以 <!DOCTYPE 或 <html 开头的是纯 HTML
  if (/^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return true;
  // 文件列表中有 .html 文件
  if (files) {
    for (const name of Object.keys(files)) {
      if (name.endsWith('.html') || name.endsWith('.htm')) return true;
    }
  }
  // 包含典型 HTML 标签但没有 React 特征
  const hasHtmlTags = /<(?:div|section|header|footer|main|article|nav|body|head|meta|link)\b/i.test(trimmed);
  const hasReactFeatures = /(?:import\s+.*(?:react|React)|export\s+default\s+function|useState|useEffect|React\.createElement|createRoot)\b/.test(trimmed);
  if (hasHtmlTags && !hasReactFeatures && !trimmed.startsWith('import ')) return true;
  return false;
}

/**
 * 为纯 HTML 代码构建预览，直接渲染，不走 React/Babel
 */
function buildHtmlPreview(code: string, files?: Record<string, string> | null): string {
  let htmlContent = code;
  let cssCode = '';
  let jsCode = '';

  // 如果有多文件，合并 HTML/CSS/JS
  if (files && Object.keys(files).length > 0) {
    let htmlParts: string[] = [];
    for (const [name, content] of Object.entries(files)) {
      if (name.endsWith('.css')) {
        cssCode += content + '\n';
      } else if (name.endsWith('.js')) {
        jsCode += content + '\n';
      } else if (name.endsWith('.html') || name.endsWith('.htm')) {
        htmlParts.push(content);
      }
    }
    if (htmlParts.length > 0) {
      htmlContent = htmlParts.join('\n');
    }
  }

  const trimmed = htmlContent.trim();

  // 如果已经是完整 HTML 文档，注入 Tailwind 和额外的 CSS/JS
  if (/^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    let result = trimmed;
    // 在 </head> 前注入 Tailwind 和 CSS
    const inject = `<script src="https://s4.zstatic.net/npm/@tailwindcss/browser@4.2.2/dist/index.global.js"><\/script>\n`
      + (cssCode ? `<style>${cssCode}</style>\n` : '');
    if (result.includes('</head>')) {
      result = result.replace('</head>', inject + '</head>');
    } else if (result.includes('<body')) {
      result = result.replace('<body', inject + '<body');
    }
    // 在 </body> 前注入 JS
    if (jsCode) {
      if (result.includes('</body>')) {
        result = result.replace('</body>', `<script>${jsCode}<\/script>\n</body>`);
      } else {
        result += `<script>${jsCode}<\/script>`;
      }
    }
    // 注入截图和消息通信脚本
    const captureScript = buildCaptureScript();
    if (result.includes('</body>')) {
      result = result.replace('</body>', captureScript + '\n</body>');
    } else {
      result += captureScript;
    }
    return result;
  }

  // 不是完整 HTML 文档，包装成完整页面
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="https://cdn.tailwindcss.com"><\/script>
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
  ${buildCaptureScript()}
</body>
</html>`;
}

/**
 * 生成截图通信脚本（HTML 预览和 React 预览共用）
 * 使用 html2canvas 库实现截图
 */
function buildCaptureScript(): string {
  return `<script>
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
            s2.onerror = function() { console.warn('html2canvas 加载失败'); };
            document.head.appendChild(s2);
          };
          document.head.appendChild(s);
        } else {
          doCapture();
        }
        function doCapture() {
          setTimeout(function() {
            try {
              var root = document.body;
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
              }).catch(function(err) {
                console.warn('Capture error:', err);
              });
            } catch(err) { console.warn('Capture error:', err); }
          }, 500);
        }
      }
    });
  <\/script>`;
}
