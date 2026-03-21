/**
 * 测试清理服务脚本
 * 
 * 使用方法：
 * npm run test:cleanup
 */

import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { cleanupUploads } from '../src/services/cleanupService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, '../../uploads');

console.log('=== 测试清理服务 ===\n');

// 创建一些测试文件
console.log('1. 创建测试文件...');
const testFiles = [
  { name: 'test-old-file.txt', age: 25 }, // 25 小时前
  { name: 'test-new-file.txt', age: 2 },  // 2 小时前
  { name: 'test-very-old-file.txt', age: 48 }, // 48 小时前
];

testFiles.forEach(({ name, age }) => {
  const filePath = path.join(uploadsDir, name);
  fs.writeFileSync(filePath, `测试文件 - ${name}`);
  
  // 修改文件时间戳，模拟旧文件
  const oldTime = new Date(Date.now() - (age * 60 * 60 * 1000));
  fs.utimesSync(filePath, oldTime, oldTime);
  
  console.log(`   ✓ 创建文件：${name} (模拟存在 ${age} 小时)`);
});

console.log('\n2. 当前 uploads 目录文件：');
const beforeFiles = fs.readdirSync(uploadsDir);
beforeFiles.forEach(f => console.log(`   - ${f}`));

// 执行清理（保留 24 小时内的文件）
console.log('\n3. 执行清理（保留 24 小时内的文件）...');
cleanupUploads(uploadsDir, 24);

console.log('\n4. 清理后 uploads 目录文件：');
const afterFiles = fs.readdirSync(uploadsDir);
afterFiles.forEach(f => console.log(`   - ${f}`));

console.log('\n=== 测试完成 ===');
console.log(`预期结果：只保留 test-new-file.txt (2 小时前的文件)`);
console.log(`实际结果：剩余 ${afterFiles.length} 个文件`);
