/**
 * 构建可在 iframe 中直接渲染的 HTML。
 * 使用 Tailwind CDN + Babel Standalone + React UMD，纯本地渲染。
 * 如果代码是纯 HTML，则直接渲染，不走 React 路径。
 *
 * 注意：此文件保留向后兼容性。
 * 新代码建议使用 PreviewManager 获得模块化架构支持。
 */

// 导出 PreviewManager 用于新代码
import { getPreviewManager } from './PreviewManager';
export { PreviewManager, getPreviewManager } from './PreviewManager';
export type { PreviewConfig, PreviewResult } from './PreviewManager';

export function buildPreviewHtml(
  code: string,
  files?: Record<string, string> | null,
  packageJson?: Record<string, unknown> | null,
): string {
  // 使用 PreviewManager 构建
  const manager = getPreviewManager();
  const result = manager.buildPreview(code, files, packageJson);
  return result.html;
}
