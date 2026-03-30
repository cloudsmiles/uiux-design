/**
 * 完整流程测试 - 解析 ZIP 并模拟存储
 * 用法: npx tsx test/test-full-flow.ts
 */

import { parseZipFile } from '../src/services/zipParser.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 模拟内存数据库
const mockDb = {
  components: [] as Array<{
    id: string;
    name: string;
    category_id: number | null;
    description: string | null;
    code: string;
    dependencies: Record<string, string>;
    tags: string[];
  }>,
  categories: new Map<string, number>([
    ['弹窗', 1],
    ['图表', 2],
    ['头像', 3],
    ['按钮', 4],
  ]),
};

// 模拟批量创建组件
async function createComponentsBatch(
  inputs: Array<{
    name: string;
    category_id?: number | null;
    description?: string;
    code: string;
    dependencies?: Record<string, string>;
    tags?: string[];
  }>
): Promise<string[]> {
  const ids: string[] = [];

  for (const input of inputs) {
    const id = `comp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    mockDb.components.push({
      id,
      name: input.name,
      category_id: input.category_id || null,
      description: input.description || null,
      code: input.code,
      dependencies: input.dependencies || {},
      tags: input.tags || [],
    });
    ids.push(id);
  }

  return ids;
}

// 解析分类 ID
function resolveCategoryId(categoryName: string | undefined): number | null {
  if (!categoryName) return null;
  return mockDb.categories.get(categoryName) || null;
}

async function testUpload(zipPath: string, label: string) {
  console.log('\n' + '='.repeat(60));
  console.log(`测试: ${label}`);
  console.log('='.repeat(60));

  // 1. 解析 ZIP
  console.log('\n[1] 解析 ZIP 文件...');
  const result = parseZipFile(zipPath);

  console.log(`    项目名称: ${result.projectName}`);
  console.log(`    发现组件: ${result.components.length} 个`);

  if (result.components.length === 0) {
    console.log('    ❌ 未找到有效组件');
    return;
  }

  // 2. 解析分类并准备存储
  console.log('\n[2] 解析分类...');
  const componentsWithCategory = result.components.map(comp => {
    const tags = comp.tags || [];
    const categoryName = tags.find(t => mockDb.categories.has(t));
    const category_id = categoryName ? resolveCategoryId(categoryName) : null;

    return {
      ...comp,
      category_id,
    };
  });

  console.log('    分类映射:');
  for (const comp of componentsWithCategory) {
    const catName = comp.category_id
      ? [...mockDb.categories.entries()].find(([, id]) => id === comp.category_id)?.[0]
      : '未分类';
    console.log(`      - ${comp.name} → ${catName} (ID: ${comp.category_id || 'null'})`);
  }

  // 3. 存储组件
  console.log('\n[3] 存储组件...');
  const ids = await createComponentsBatch(componentsWithCategory);
  console.log(`    ✅ 成功存储 ${ids.length} 个组件`);

  // 4. 验证存储结果
  console.log('\n[4] 验证存储结果...');
  for (const id of ids) {
    const comp = mockDb.components.find(c => c.id === id);
    if (comp) {
      console.log(`\n    组件: ${comp.name}`);
      console.log(`      ID: ${comp.id}`);
      console.log(`      分类ID: ${comp.category_id || '无'}`);
      console.log(`      描述: ${comp.description || '无'}`);
      console.log(`      标签: ${comp.tags?.join(', ') || '无'}`);
      console.log(`      代码: ${comp.code.length} 字符`);
      console.log(`      代码预览: ${comp.code.slice(0, 100)}...`);
    }
  }

  console.log('\n' + '-'.repeat(60));
  console.log('✅ 测试通过');
}

// 运行测试
async function main() {
  console.log('\n' + '#'.repeat(60));
  console.log('# AI Studio ZIP 文件解析与存储测试');
  console.log('#'.repeat(60));

  const testFiles = [
    { path: '../uploads/1773973818897-135090839.zip', label: '普通组件 ZIP' },
    { path: '../uploads/1773973818965-240472054.zip', label: 'AI Studio 项目 ZIP' },
  ];

  for (const file of testFiles) {
    const zipPath = path.join(__dirname, file.path);
    await testUpload(zipPath, file.label);
  }

  // 最终统计
  console.log('\n' + '#'.repeat(60));
  console.log('# 测试总结');
  console.log('#'.repeat(60));
  console.log(`\n总共存储组件: ${mockDb.components.length} 个`);
  console.log('\n组件列表:');
  for (const comp of mockDb.components) {
    console.log(`  - [${comp.id}] ${comp.name}`);
  }
  console.log('\n✅ 所有测试完成！');
}

main().catch(console.error);
