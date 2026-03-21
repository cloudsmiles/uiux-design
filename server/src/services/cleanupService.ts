import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

/**
 * 清理 uploads 目录的旧文件
 * @param dirPath 目录路径
 * @param maxAge 文件最大保留时间（小时），默认 24 小时
 */
export function cleanupUploads(dirPath: string, maxAgeHours: number = 24): void {
  try {
    if (!fs.existsSync(dirPath)) {
      console.log(`[清理服务] 目录不存在：${dirPath}`);
      return;
    }

    const files = fs.readdirSync(dirPath);
    const now = Date.now();
    const maxAgeMs = maxAgeHours * 60 * 60 * 1000;
    let cleanedCount = 0;

    files.forEach((file) => {
      const filePath = path.join(dirPath, file);
      
      try {
        const stats = fs.statSync(filePath);
        
        // 只处理文件，不处理子目录
        if (stats.isFile()) {
          const fileAge = now - stats.mtimeMs;
          
          if (fileAge > maxAgeMs) {
            fs.unlinkSync(filePath);
            console.log(`[清理服务] 已删除文件：${file} (存在 ${(fileAge / (60 * 60 * 1000)).toFixed(1)} 小时)`);
            cleanedCount++;
          }
        }
      } catch (err) {
        console.error(`[清理服务] 处理文件失败 ${file}:`, err);
      }
    });

    if (cleanedCount > 0) {
      console.log(`[清理服务] 本次清理完成，共删除 ${cleanedCount} 个文件`);
    } else {
      console.log(`[清理服务] 无需清理`);
    }
  } catch (err) {
    console.error('[清理服务] 执行失败:', err);
  }
}

/**
 * 启动定时清理任务
 * @param uploadsDir uploads 目录路径
 * @param cronExpression cron 表达式，默认每天凌晨 2 点执行
 * @param maxAgeHours 文件最大保留时间（小时）
 */
export function startCleanupScheduler(
  uploadsDir: string,
  cronExpression: string = '0 2 * * *',
  maxAgeHours: number = 24
): void {
  // 启动时立即执行一次
  console.log('[清理服务] 启动初始化清理...');
  cleanupUploads(uploadsDir, maxAgeHours);

  // 设置定时任务
  cron.schedule(cronExpression, () => {
    console.log(`[清理服务] 开始定时清理 (${new Date().toLocaleString('zh-CN')})`);
    cleanupUploads(uploadsDir, maxAgeHours);
  });

  console.log(`[清理服务] 已启动，计划：${cronExpression}, 保留时间：${maxAgeHours}小时`);
}
