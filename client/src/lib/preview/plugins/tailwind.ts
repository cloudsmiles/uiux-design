/**
 * Tailwind CSS plugin — CDN injection and CSS directive processing
 */

export const TAILWIND_V3_CDN = 'https://cdn.tailwindcss.com';
export const TAILWIND_V4_CDN = 'https://s4.zstatic.net/npm/@tailwindcss/browser@4.2.2/dist/index.global.js';

export const TAILWIND_CDN_FALLBACKS = [TAILWIND_V3_CDN, TAILWIND_V4_CDN];

/** Generate Tailwind v3 Play CDN script tag */
export function getTailwindCDNScript(version: '3' | '4' = '3'): string {
  const url = version === '4' ? TAILWIND_V4_CDN : TAILWIND_V3_CDN;
  return `<script src="${url}"><\/script>`;
}

/** Strip @import "tailwindcss" and @tailwind directives from user CSS */
export function processTailwindCSS(css: string): string {
  return css
    .replace(/@import\s+['"]tailwindcss['"];?/g, '')
    .replace(/@tailwind\s+\w+;?/g, '');
}
