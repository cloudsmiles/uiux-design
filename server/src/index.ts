import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import cors from 'cors';
import componentsRouter from './routes/components.js';
import { startCleanupScheduler } from './services/cleanupService.js';

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
// P12: 请求体大小限制 (1MB)
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// API 路由
app.use('/api', componentsRouter);

// 静态文件服务（生产环境）
if (process.env.NODE_ENV === 'production') {
  app.use('/design', express.static(path.join(__dirname, '../../client/dist')));
  app.get('/design/*', (_req, res) => {
    res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
  });
}

// 错误处理
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: err.message || '服务器错误' });
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  
  // 启动清理服务
  const uploadsDir = path.join(__dirname, '../uploads');
  const schedule = process.env.CLEANUP_SCHEDULE || '0 2 * * *'; // 默认每天凌晨 2 点
  const maxAgeHours = parseInt(process.env.CLEANUP_MAX_AGE_HOURS || '24', 10);
  startCleanupScheduler(uploadsDir, schedule, maxAgeHours);
});
