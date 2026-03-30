/**
 * 测试 ZIP 解析功能
 * 用法: npx tsx test/test-zip-parser.ts
 */

import { parseZipFile } from '../src/services/zipParser.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 测试文件路径
const testFiles = [
  '../uploads/1773973818897-135090839.zip',  // 普通组件
  '../uploads/1773973818965-240472054.zip',  // AI Studio 项目
];

console.log('='.repeat(60));
console.log('ZIP 文件解析测试');
console.log('='.repeat(60));

for (const file of testFiles) {
  const zipPath = path.join(__dirname, file);

  console.log('\n' + '-'.repeat(60));
  console.log(`测试文件: ${file}`);
  console.log('-'.repeat(60));

  try {
    const result = parseZipFile(zipPath);

    console.log(`\n项目名称: ${result.projectName}`);
    console.log(`发现组件数量: ${result.components.length}`);
    console.log(`依赖数量: ${Object.keys(result.dependencies).length}`);

    if (result.components.length > 0) {
      console.log('\n组件列表:');
      result.components.forEach((comp, index) => {
        console.log(`\n  [${index + 1}] ${comp.name}`);
        console.log(`      描述: ${comp.description || '(无)'}`);
        console.log(`      标签: ${comp.tags?.join(', ') || '(无)'}`);
        console.log(`      代码长度: ${comp.code?.length || 0} 字符`);
        if (comp.code) {
          // 显示代码前200字符
          const preview = comp.code.slice(0, 200).replace(/\n/g, '\\n');
          console.log(`      代码预览: ${preview}${comp.code.length > 200 ? '...' : ''}`);
        }
      });
    }

    if (Object.keys(result.dependencies).length > 0) {
      console.log('\n依赖:');
      for (const [name, version] of Object.entries(result.dependencies)) {
        console.log(`  - ${name}: ${version}`);
      }
    }

    // 显示原始文件列表
    console.log('\n原始文件列表:');
    for (const [filePath] of result.rawFiles) {
      console.log(`  - ${filePath}`);
    }

    console.log('\n✅ 解析成功');

  } catch (error) {
    console.log(`\n❌ 解析失败: ${(error as Error).message}`);
    console.log((error as Error).stack);
  }
}

console.log('\n' + '='.repeat(60));
console.log('测试完成');
console.log('='.repeat(60));
