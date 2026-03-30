/**
 * Core type definitions for the preview system
 */

// ============================================================================
// File System Types
// ============================================================================

export interface FileInfo {
  path: string;
  originalPath: string;
  content: string;
  name: string;
  ext: string;
}

// ============================================================================
// Dependency Types
// ============================================================================

export interface ExternalDependency {
  name: string;
  version: string;
  cdnUrl?: string;
  globalName?: string;
  stub?: string;
  type: 'production' | 'peer' | 'dev';
}

export interface DependencyGraph {
  entry: string;
  files: Map<string, FileInfo>;
  dependencies: Map<string, string[]>;
  externalDeps: ExternalDependency[];
  sortedFiles: string[];
  circularDependencies: string[][];
  warnings: string[];
}

// ============================================================================
// Compiler Types
// ============================================================================

export interface CompilerOptions {
  target: 'es5' | 'es2015' | 'es2017' | 'esnext';
  module: 'umd' | 'esm';
  sourceMap: boolean;
  minify: boolean;
}

export interface CompileResult {
  code: string;
  map?: string;
  componentName: string | null;
  errors: CompileError[];
  dependencies: string[];
}

export interface CompileError {
  message: string;
  line?: number;
  column?: number;
  snippet?: string;
  code?: string;
}

// ============================================================================
// Runtime Types
// ============================================================================

export interface RuntimeOptions {
  container?: HTMLElement;
  sandbox: SandboxPermissions;
  globals?: Record<string, unknown>;
}

export type SandboxPermissions = (
  | 'allow-scripts'
  | 'allow-same-origin'
  | 'allow-forms'
  | 'allow-popups'
  | 'allow-modals'
)[];

export interface RuntimeState {
  ready: boolean;
  loadedDeps: Set<string>;
  error: Error | null;
}

// ============================================================================
// Renderer Types
// ============================================================================

export interface CaptureOptions {
  enabled: boolean;
  format: 'webp' | 'png' | 'jpeg';
  quality: number;
  scale: number;
  maxWidth: number;
  maxHeight: number;
  waitFor: 'timeout' | 'stable' | 'manual';
  timeout: number;
}

export interface CaptureResult {
  dataUrl: string;
  width: number;
  height: number;
  format: string;
}

// ============================================================================
// Plugin Types
// ============================================================================

export type PluginHook =
  | 'beforeCompile'
  | 'afterCompile'
  | 'beforeResolve'
  | 'afterResolve'
  | 'beforeExecute'
  | 'afterExecute'
  | 'beforeCapture'
  | 'afterCapture';

export interface PluginCapability {
  type: 'compiler' | 'resolver' | 'runtime' | 'renderer';
  test?: RegExp;
  handler: (...args: unknown[]) => unknown;
}

export interface Plugin {
  name: string;
  version: string;
  dependencies?: string[];
  provides?: PluginCapability[];
  hooks?: Partial<Record<PluginHook, PluginHookHandler>>;
  options?: PluginOption[];
}

export type PluginHookHandler = (context: PluginContext) => Promise<void> | void;

export interface PluginContext {
  state: PreviewState;
  config: PreviewConfig;
  utils: PluginUtils;
}

export interface PluginOption {
  name: string;
  type: 'string' | 'boolean' | 'number' | 'object' | 'array';
  default?: unknown;
  description?: string;
  required?: boolean;
}

export interface PluginUtils {
  log: (message: string, level?: 'info' | 'warn' | 'error') => void;
  resolve: (path: string) => string;
  readFile: (path: string) => string | null;
}

// ============================================================================
// Preview Manager Types
// ============================================================================

export interface PreviewConfig {
  entry?: string;
  compiler?: Partial<CompilerOptions>;
  runtime?: Partial<RuntimeOptions>;
  capture?: Partial<CaptureOptions>;
  plugins?: Plugin[];
  alias?: Record<string, string>;
  extensions?: string[];
}

export interface PreviewState {
  files: Map<string, FileInfo>;
  compiledCode: string | null;
  componentName: string | null;
  html: string | null;
  previewUrl: string | null;
  errors: CompileError[];
  warnings: string[];
  ready: boolean;
}

export interface PreviewManager {
  init(code: string, files?: Record<string, string>): Promise<void>;
  buildPreview(): Promise<string>;
  capture(): Promise<CaptureResult | null>;
  getState(): PreviewState;
  destroy(): void;
}

// ============================================================================
// Package.json Types
// ============================================================================

export interface PackageJson {
  name?: string;
  version?: string;
  main?: string;
  module?: string;
  types?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  preview?: PackagePreviewConfig;
}

export interface PackagePreviewConfig {
  entry?: string;
  dependencies?: Record<string, string>;
  cdn?: Record<string, { url: string; global?: string }>;
  plugins?: string[];
  runtime?: {
    sandbox?: string[];
    globals?: Record<string, unknown>;
  };
}

// ============================================================================
// Message Types (iframe communication)
// ============================================================================

export type MessageType =
  | 'preview-rendered'
  | 'preview-error'
  | 'capture-request'
  | 'preview-capture'
  | 'console-log'
  | 'console-error';

export interface PreviewMessage {
  type: MessageType;
  [key: string]: unknown;
}

// ============================================================================
// CDN Registry Types
// ============================================================================

export interface CDNMapping {
  url: string;
  global?: string;
  stub?: string;
}

export type CDNRegistry = Record<string, CDNMapping>;
