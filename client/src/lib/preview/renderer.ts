/**
 * Renderer module — DOM rendering and screenshot capture
 */

import type { CaptureOptions } from './types';

const DEFAULT_CAPTURE_OPTIONS: CaptureOptions = {
  enabled: true,
  format: 'webp',
  quality: 0.85,
  scale: 2,
  maxWidth: 1200,
  maxHeight: 800,
  waitFor: 'stable',
  timeout: 5000,
};

/** Generate capture + communication script for injection into iframe */
export function generateCaptureScript(options?: Partial<CaptureOptions>): string {
  const opts = { ...DEFAULT_CAPTURE_OPTIONS, ...options };

  return `
(function() {
  function notifyReady() {
    window.parent.postMessage({ type: 'preview-rendered' }, '*');
  }
  function waitForStable(callback, timeout) {
    var timer = null;
    var observer = new MutationObserver(function() {
      clearTimeout(timer);
      timer = setTimeout(function() { observer.disconnect(); callback(); }, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });
    setTimeout(function() { observer.disconnect(); callback(); }, timeout || 5000);
  }
  function doCapture() {
    var root = document.getElementById('root') || document.body;
    var w = Math.min(root.scrollWidth || 800, ${opts.maxWidth});
    var h = Math.min(root.scrollHeight || 600, ${opts.maxHeight});
    html2canvas(root, {
      scale: ${opts.scale}, useCORS: false, allowTaint: true,
      backgroundColor: '#ffffff', logging: false, width: w, height: h,
      onclone: function(clonedDoc) {
        clonedDoc.querySelectorAll('img').forEach(function(img) {
          if (img.src && (img.src.startsWith('http') || img.crossOrigin)) {
            img.style.background = '#e5e7eb';
            img.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#e5e7eb" width="100" height="100"/><text x="50" y="50" text-anchor="middle" dy=".3em" fill="#9ca3af" font-size="12">图片</text></svg>');
          }
        });
      }
    }).then(function(canvas) {
      window.parent.postMessage({ type: 'preview-capture', dataUrl: canvas.toDataURL('image/${opts.format}', ${opts.quality}) }, '*');
    }).catch(function(err) { console.warn('Capture error:', err); });
  }
  function loadHtml2canvas(callback) {
    if (typeof html2canvas !== 'undefined') { callback(); return; }
    var urls = [
      'https://registry.npmmirror.com/html2canvas/1.4.1/files/dist/html2canvas.min.js',
      'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js'
    ];
    var i = 0;
    function tryLoad() {
      if (i >= urls.length) { console.warn('html2canvas 加载失败'); return; }
      var s = document.createElement('script');
      s.src = urls[i]; s.onload = callback;
      s.onerror = function() { i++; tryLoad(); };
      document.head.appendChild(s);
    }
    tryLoad();
  }
  setTimeout(notifyReady, 800);
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'capture-request') {
      loadHtml2canvas(function() { waitForStable(doCapture, ${opts.timeout}); });
    }
  });
})();`;
}
