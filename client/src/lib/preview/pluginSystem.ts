/**
 * Plugin management system
 */

import type {
  Plugin, PluginHook, PluginHookHandler, PluginCapability,
  PluginContext, PluginUtils, PreviewState, PreviewConfig,
} from './types';

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private hooks: Map<PluginHook, PluginHookHandler[]> = new Map();
  private capabilityIndex: Map<string, PluginCapability[]> = new Map();

  register(plugin: Plugin): void {
    if (!plugin.name) throw new Error('Plugin must have a name');
    if (this.plugins.has(plugin.name)) console.warn(`Plugin "${plugin.name}" already registered, replacing...`);
    this.plugins.set(plugin.name, plugin);

    if (plugin.hooks) {
      for (const [hook, handler] of Object.entries(plugin.hooks)) {
        const hookName = hook as PluginHook;
        if (!this.hooks.has(hookName)) this.hooks.set(hookName, []);
        this.hooks.get(hookName)!.push(handler as PluginHookHandler);
      }
    }
    if (plugin.provides) {
      for (const cap of plugin.provides) {
        if (!this.capabilityIndex.has(cap.type)) this.capabilityIndex.set(cap.type, []);
        this.capabilityIndex.get(cap.type)!.push(cap);
      }
    }
  }

  registerAll(plugins: Plugin[]): void {
    for (const p of plugins) this.register(p);
  }

  async runHook(hook: PluginHook, context: PluginContext): Promise<void> {
    for (const handler of this.hooks.get(hook) || []) {
      try { await handler(context); } catch (e) { console.error(`Hook "${hook}" failed:`, e); }
    }
  }

  getCapability(type: string, filename?: string): PluginCapability | undefined {
    for (const cap of this.capabilityIndex.get(type) || []) {
      if (!cap.test || !filename) return cap;
      if (cap.test.test(filename)) return cap;
    }
    return undefined;
  }

  createContext(state: PreviewState, config: PreviewConfig): PluginContext {
    const utils: PluginUtils = {
      log: (message, level = 'info') => console[level](`[Preview] ${message}`),
      resolve: (path: string) => path,
      readFile: (path: string) => state.files.get(path)?.content || null,
    };
    return { state, config, utils };
  }

  clear(): void {
    this.plugins.clear();
    this.hooks.clear();
    this.capabilityIndex.clear();
  }
}

export const pluginManager = new PluginManager();
