import mysql from 'mysql2/promise';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// 确保从 server/.env 加载配置
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

console.log('DB connecting to:', process.env.DB_HOST || 'localhost', 'port:', process.env.DB_PORT || '3306', 'user:', process.env.DB_USER || 'root', 'db:', process.env.DB_NAME || 'uiux_design');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'uiux_design',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export default pool;
