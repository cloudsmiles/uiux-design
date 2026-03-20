import AdmZip from 'adm-zip';
import type { ParsedZipResult, CreateComponentInput } from '../types/index.js';

/**
 * 解析 ZIP 文件，支持 AI Studio 项目和普通组件包
 */
export function parseZipFile(zipPath: string): ParsedZipResult {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  const files = new Map<string, string>();

  // 提取所有文件内容
  for (const entry of entries) {
    if (!entry.isDirectory) {
      const content = entry.getData().toString('utf8');
      files.set(entry.entryName, content);
    }
  }

  // 检测是否为 AI Studio 项目
  const isAIStudio = files.has('metadata.json') ||
                     hasFileMatching(files, 'src/data/components.');

  // 解析 metadata.json
  let projectName = 'Unknown Component';
  let projectDescription = '';
  const metadata: Record<string, unknown> = {};

  if (files.has('metadata.json')) {
    try {
      const metadataContent = files.get('metadata.json')!;
      Object.assign(metadata, JSON.parse(metadataContent));
      projectName = (metadata.name as string) || projectName;
      projectDescription = (metadata.description as string) || '';
    } catch {
      // 忽略解析错误
    }
  }

  // 提取依赖
  let dependencies: Record<string, string> = {};
  if (files.has('package.json')) {
    try {
      const pkg = JSON.parse(files.get('package.json')!);
      dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
    } catch {
      // 忽略解析错误
    }
  }

  // 解析组件
  let components: CreateComponentInput[] = [];

  if (isAIStudio) {
    // AI Studio 项目解析流程
    // 1. 优先从 src/data/components.tsx 提取（多组件集合格式）
    const componentsFile = findFile(files, 'src/data/components.');
    if (componentsFile) {
      components = parseAIStudioComponents(componentsFile);
    }

    // 2. 如果没有 components.tsx，检查是否为单文件项目（App.tsx 引用其他文件）
    if (components.length === 0 && files.has('src/App.tsx')) {
      // 提取所有源文件作为多文件组件
      const sourceFiles = extractSourceFiles(files);

      components.push({
        name: projectName,
        description: projectDescription,
        code: files.get('src/App.tsx')!,
        files: sourceFiles,
        tags: ['AI Studio'],
      });
    }

    // 3. 为组件添加项目信息
    components = components.map(comp => ({
      ...comp,
      description: comp.description || projectDescription,
      tags: [...new Set([...(comp.tags || []), 'AI Studio'])],
    }));
  } else {
    // 普通组件包 - 查找主要组件文件
    const mainComponent = findMainComponent(files);
    if (mainComponent) {
      components.push(mainComponent);
    }
  }

  return {
    isAIStudio,
    projectName,
    components,
    dependencies,
    rawFiles: files,
  };
}

/**
 * 提取所有源文件（用于多文件项目）
 */
function extractSourceFiles(files: Map<string, string>): Record<string, string> {
  const sourceFiles: Record<string, string> = {};
  const sourceExtensions = ['.tsx', '.ts', '.jsx', '.js', '.css'];

  for (const [path, content] of files) {
    // 只提取 src/ 目录下的源文件
    if (path.startsWith('src/')) {
      const ext = path.substring(path.lastIndexOf('.'));
      if (sourceExtensions.includes(ext)) {
        // 转换路径：src/components/Button.tsx -> /components/Button.tsx
        const relativePath = '/' + path.replace('src/', '');
        sourceFiles[relativePath] = content;
      }
    }
  }

  return sourceFiles;
}

/**
 * 解析 AI Studio 的 components.tsx 文件
 */
function parseAIStudioComponents(content: string): CreateComponentInput[] {
  const components: CreateComponentInput[] = [];

  // 方法1: 提取组件块并逐个解析
  const componentBlocks = extractComponentBlocks(content);

  for (const block of componentBlocks) {
    const component = parseComponentBlock(block);
    if (component) {
      components.push(component);
    }
  }

  // 方法2: 如果方法1失败，使用正则直接匹配
  if (components.length === 0) {
    const regexComponents = parseWithRegex(content);
    components.push(...regexComponents);
  }

  return components;
}

/**
 * 从 App.tsx 中提取内联的 COMPONENTS 数组
 */
function parseAppTsx(content: string): CreateComponentInput[] {
  const components: CreateComponentInput[] = [];

  // 尝试找到内联的 COMPONENTS 定义
  // 可能的格式：
  // const COMPONENTS = [...]
  // const COMPONENTS: ComponentItem[] = [...]
  // export const COMPONENTS = [...]

  const arrayMatch = content.match(/(?:export\s+)?const\s+COMPONENTS\s*(?::\s*\w+(?:<[^>]+>)?)?\s*=\s*\[([\s\S]*?)\n\];?/);
  if (arrayMatch) {
    const arrayContent = arrayMatch[1];
    return parseComponentsArray(arrayContent);
  }

  // 如果没有找到 COMPONENTS 数组，尝试提取单个组件
  // 检查是否有默认导出的组件
  const defaultExportMatch = content.match(/export\s+default\s+function\s+(\w+)/);
  if (defaultExportMatch) {
    components.push({
      name: defaultExportMatch[1],
      code: content,
      tags: ['AI Studio'],
    });
  }

  return components;
}

/**
 * 解析组件数组内容
 */
function parseComponentsArray(arrayContent: string): CreateComponentInput[] {
  const components: CreateComponentInput[] = [];
  const blocks = extractComponentBlocksFromArray(arrayContent);

  for (const block of blocks) {
    const component = parseComponentBlock(block);
    if (component) {
      components.push(component);
    }
  }

  return components;
}

/**
 * 从文件内容中提取组件块
 */
function extractComponentBlocks(content: string): string[] {
  const blocks: string[] = [];

  // 找到 COMPONENTS 数组的起始位置
  const arrayStartMatch = content.match(/COMPONENTS\s*(?::\s*[^=]+)?\s*=\s*\[/);
  if (!arrayStartMatch) return blocks;

  const startIndex = arrayStartMatch.index! + arrayStartMatch[0].length;

  // 手动匹配括号，找到数组结束位置
  let depth = 1;
  let currentPos = startIndex;
  let blockStart = startIndex;

  while (currentPos < content.length && depth > 0) {
    const char = content[currentPos];

    if (char === '[' || char === '{') {
      if (depth === 1 && char === '{') {
        // 新的组件块开始
        blockStart = currentPos;
      }
      depth++;
    } else if (char === ']' || char === '}') {
      depth--;
      if (depth === 1 && char === '}') {
        // 组件块结束
        const block = content.slice(blockStart, currentPos + 1);
        if (block.includes('id:') && block.includes('name:')) {
          blocks.push(block);
        }
      }
    } else if (char === ',' && depth === 1) {
      // 组件之间的分隔符
    }
    currentPos++;
  }

  return blocks;
}

/**
 * 从数组内容中提取组件块
 */
function extractComponentBlocksFromArray(arrayContent: string): string[] {
  const blocks: string[] = [];
  let depth = 0;
  let blockStart = 0;
  let inString = false;
  let stringChar = '';

  for (let i = 0; i < arrayContent.length; i++) {
    const char = arrayContent[i];
    const prevChar = i > 0 ? arrayContent[i - 1] : '';

    // 处理字符串
    if ((char === '"' || char === "'" || char === '`') && prevChar !== '\\') {
      if (!inString) {
        inString = true;
        stringChar = char;
      } else if (char === stringChar) {
        inString = false;
      }
    }

    if (inString) continue;

    if (char === '{') {
      if (depth === 0) {
        blockStart = i;
      }
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) {
        blocks.push(arrayContent.slice(blockStart, i + 1));
      }
    }
  }

  return blocks;
}

/**
 * 解析单个组件块
 */
function parseComponentBlock(block: string): CreateComponentInput | null {
  try {
    // 提取 name
    const nameMatch = block.match(/name:\s*['"`]([^'"`]+)['"`]/);
    const name = nameMatch ? nameMatch[1] : null;
    if (!name) return null;

    // 提取 category
    const categoryMatch = block.match(/category:\s*['"`]([^'"`]+)['"`]/);
    const category = categoryMatch ? categoryMatch[1] : null;

    // 提取 description
    const descMatch = block.match(/description:\s*['"`]([^'"`]+)['"`]/);
    const description = descMatch ? descMatch[1] : '';

    // 提取 code (支持模板字符串和普通字符串)
    // 优先匹配模板字符串 `...`
    let codeMatch = block.match(/code:\s*`([\s\S]*?)`/);
    let code = codeMatch ? codeMatch[1] : '';

    // 如果没有找到模板字符串，尝试匹配普通字符串 "..." 或 '...'
    if (!code) {
      // 匹配 code: "..." 格式，需要处理转义引号和换行符
      const doubleQuoteMatch = block.match(/code:\s*"((?:[^"\\]|\\.)*)"/);
      if (doubleQuoteMatch) {
        // 解码转义字符
        code = decodeEscapedString(doubleQuoteMatch[1]);
      } else {
        // 尝试单引号
        const singleQuoteMatch = block.match(/code:\s*'((?:[^'\\]|\\.)*)'/);
        if (singleQuoteMatch) {
          code = decodeEscapedString(singleQuoteMatch[1]);
        }
      }
    }

    // 清理代码缩进
    code = cleanCodeIndent(code);

    return {
      name,
      description,
      code,
      tags: category ? [category] : [],
    };
  } catch {
    return null;
  }
}

/**
 * 使用正则表达式解析组件（备用方法）
 */
function parseWithRegex(content: string): CreateComponentInput[] {
  const components: CreateComponentInput[] = [];

  // 更宽松的正则，逐步匹配
  const nameRegex = /name:\s*['"`]([^'"`]+)['"`]/g;
  const names: string[] = [];
  let nameMatch;
  while ((nameMatch = nameRegex.exec(content)) !== null) {
    names.push(nameMatch[1]);
  }

  // 如果找到了名字，尝试配对提取其他字段
  for (const name of names) {
    // 找到包含这个名字的区域
    const nameIndex = content.indexOf(`name: '${name}'`) !== -1
      ? content.indexOf(`name: '${name}'`)
      : content.indexOf(`name: "${name}"`);

    if (nameIndex === -1) continue;

    // 找到这个组件块的边界（到下一个 id 或数组结束）
    const blockStart = Math.max(0, content.lastIndexOf('{', nameIndex));
    const nextId = content.indexOf('id:', nameIndex + name.length);
    const blockEnd = nextId !== -1 ? content.lastIndexOf('}', nextId) : content.length;

    const block = content.slice(blockStart, blockEnd);
    const component = parseComponentBlock(block);

    if (component && component.name === name) {
      // 避免重复
      if (!components.find(c => c.name === name)) {
        components.push(component);
      }
    }
  }

  return components;
}

/**
 * 清理代码缩进
 */
function cleanCodeIndent(code: string): string {
  if (!code) return '';

  const lines = code.split('\n');

  // 找到最小缩进（非空行）
  let minIndent = Infinity;
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    const indent = line.match(/^\s*/)?.[0].length || 0;
    minIndent = Math.min(minIndent, indent);
  }

  // 移除公共缩进
  if (minIndent > 0 && minIndent !== Infinity) {
    return lines
      .map(line => line.slice(minIndent))
      .join('\n')
      .trim();
  }

  return code.trim();
}

/**
 * 查找普通 ZIP 包中的主组件文件
 */
function findMainComponent(files: Map<string, string>): CreateComponentInput | null {
  const componentFiles: { path: string; content: string; priority: number }[] = [];

  for (const [path, content] of files) {
    const fileName = path.toLowerCase();
    if (fileName.endsWith('.tsx') || fileName.endsWith('.jsx')) {
      let priority = 0;

      // 优先级判断
      if (fileName.includes('index')) priority += 10;
      if (fileName.includes('component')) priority += 5;
      if (fileName.includes('app')) priority += 3;
      if (fileName.endsWith('.tsx')) priority += 2;

      componentFiles.push({ path, content, priority });
    }
  }

  if (componentFiles.length === 0) return null;

  // 选择优先级最高的文件
  componentFiles.sort((a, b) => b.priority - a.priority);
  const mainFile = componentFiles[0];

  // 提取组件名称
  let name = extractComponentName(mainFile.content) ||
             mainFile.path.split('/').pop()?.replace(/\.(tsx|jsx)$/, '') ||
             'Component';

  return {
    name,
    code: mainFile.content,
    tags: ['Uploaded'],
  };
}

/**
 * 从代码中提取组件名称
 */
function extractComponentName(content: string): string | null {
  // 匹配 export default function ComponentName
  const match = content.match(/export\s+default\s+function\s+(\w+)/);
  return match ? match[1] : null;
}

/**
 * 解码字符串中的转义字符
 */
function decodeEscapedString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
}

/**
 * 辅助函数：检查是否存在匹配的文件
 */
function hasFileMatching(files: Map<string, string>, prefix: string): boolean {
  for (const path of files.keys()) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

/**
 * 辅助函数：查找文件
 */
function findFile(files: Map<string, string>, prefix: string): string | null {
  for (const [path, content] of files) {
    if (path.startsWith(prefix)) return content;
  }
  return null;
}
