/**
 * Preview system — modular architecture
 *
 * Flat module structure replacing the old monolithic preview.ts
 * and the over-engineered packages/* monorepo.
 */

// Types
export type * from './types';

// Core modules
export { Compiler, compiler, createCompiler } from './compiler';
export { Resolver, resolver, createResolver, CDN_REGISTRY } from './resolver';
export { generateCaptureScript } from './renderer';
export { PluginManager, pluginManager } from './pluginSystem';

// Plugins
export { isHtmlCode, buildHtmlPreview } from './plugins/html';
export {
  REACT_HOOKS, COMPONENT_STUB, DEFAULT_STUBS,
  REACT_CDN_VERSIONS, BABEL_CDN,
} from './plugins/react';
export {
  TAILWIND_V3_CDN, TAILWIND_V4_CDN, TAILWIND_CDN_FALLBACKS,
  getTailwindCDNScript, processTailwindCSS,
} from './plugins/tailwind';
