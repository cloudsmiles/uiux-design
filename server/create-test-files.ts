/**
 * 简单测试：创建测试文件并验证清理功能
 */

import fs from 'fs';
import path from 'path';

const uploadsDir = path.join(process.cwd(), 'uploads');

console.log('=== 创建测试文件 ===\n');

// 创建测试文件
const testFiles = [
  { name: 'old-file.txt', content: '这是一个旧文件' },
  { name: 'new-file.txt', content: '这是一个新文件' },
];

testFiles.forEach(({ name, content }) => {
  const filePath = path.join(uploadsDir, name);
  fs.writeFileSync(filePath, content);
  
  // 对于旧文件，修改时间戳为 25 小时前
  if (name === 'old-file.txt') {
    const oldTime = new Date(Date.now() - (25 * 60 * 60 * 1000));
    fs.utimesSync(filePath, oldTime, oldTime);
    console.log(`✓ 创建文件：${name} (时间设置为 25 小时前)`);
  } else {
    console.log(`✓ 创建文件：${name} (当前时间)`);
  }
});

console.log('\n当前 uploads 目录中的文件:');
const files = fs.readdirSync(uploadsDir);
files.forEach(f => {
  const stats = fs.statSync(path.join(uploadsDir, f));
  const age = ((Date.now() - stats.mtimeMs) / (60 * 60 * 1000)).toFixed(1);
  console.log(`  - ${f} (存在 ${age} 小时)`);
});

console.log('\n提示：现在可以运行清理服务来删除超过 24 小时的文件');
console.log('在另一个终端执行：npm run test:cleanup');
