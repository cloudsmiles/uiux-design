/**
 * HTML plugin — detection and preview building for pure HTML components
 */

/** Check if code is pure HTML (not React/JSX) */
export function isHtmlCode(code: string, files?: Record<string, string> | null): boolean {
  const trimmed = code.trim();
  if (/^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) return true;
  if (files) {
    for (const name of Object.keys(files)) {
      if (name.endsWith('.html') || name.endsWith('.htm')) return true;
    }
  }
  const hasHtmlTags = /<(?:div|section|header|footer|main|article|nav|body|head|meta|link)\b/i.test(trimmed);
  const hasReactFeatures = /(?:import\s+.*(?:react|React)|export\s+default\s+function|useState|useEffect|React\.createElement|createRoot)\b/.test(trimmed);
  return hasHtmlTags && !hasReactFeatures && !trimmed.startsWith('import ');
}

/** Build HTML preview — injects Tailwind CDN and capture script */
export function buildHtmlPreview(
  code: string,
  files?: Record<string, string> | null,
  options?: { tailwindCdn?: string; captureScript?: string }
): string {
  const tailwindCdn = options?.tailwindCdn || 'https://cdn.tailwindcss.com';
  const captureScript = options?.captureScript || '';
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

  // Complete HTML document — inject into existing structure
  if (/^<!doctype\s+html/i.test(trimmed) || /^<html[\s>]/i.test(trimmed)) {
    let result = trimmed;
    const inject = `<script src="${tailwindCdn}"><\/script>\n${cssCode ? `<style>${cssCode}</style>\n` : ''}`;
    if (result.includes('</head>')) result = result.replace('</head>', inject + '</head>');
    else if (result.includes('<body')) result = result.replace('<body', inject + '<body');
    if (jsCode && result.includes('</body>')) result = result.replace('</body>', `<script>${jsCode}<\/script>\n</body>`);
    if (captureScript) {
      if (result.includes('</body>')) result = result.replace('</body>', `<script>${captureScript}<\/script>\n</body>`);
      else result += `<script>${captureScript}<\/script>`;
    }
    return result;
  }

  // HTML fragment — wrap as complete page
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <script src="${tailwindCdn}"><\/script>
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
  ${captureScript ? `<script>${captureScript}<\/script>` : ''}
</body>
</html>`;
}
