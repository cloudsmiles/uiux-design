import mysql from 'mysql2/promise';
import 'dotenv/config';

async function initDatabase() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  });

  console.log('Connected to MySQL server');

  const dbName = process.env.DB_NAME || 'uiux_design';

  // 创建数据库
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  console.log(`Database '${dbName}' created or already exists`);

  await connection.changeUser({ database: dbName });

  // 创建分类表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      icon VARCHAR(50),
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('Table "categories" created or already exists');

  // 创建组件表
  await connection.query(`
    CREATE TABLE IF NOT EXISTS components (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      category_id INT,
      description TEXT,
      code LONGTEXT NOT NULL,
      files JSON,
      dependencies JSON,
      preview_image LONGTEXT,
      tags JSON,
      view_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  console.log('Table "components" created or already exists');

  // 如果表已存在，检查并添加 files 字段
  try {
    await connection.query(`ALTER TABLE components ADD COLUMN files JSON AFTER code`);
    console.log('Added "files" column to components table');
  } catch {
    // 字段已存在，忽略错误
  }

  // 将 preview_image 字段改为 LONGTEXT 以存储 base64 截图
  try {
    await connection.query(`ALTER TABLE components MODIFY COLUMN preview_image LONGTEXT`);
    console.log('Updated "preview_image" column to LONGTEXT');
  } catch {
    // 忽略错误
  }

  // 插入默认分类
  const defaultCategories = [
    { name: '按钮', icon: 'MousePointer', sort_order: 1 },
    { name: '表单', icon: 'ClipboardList', sort_order: 2 },
    { name: '展示', icon: 'Table', sort_order: 3 },
    { name: '反馈', icon: 'MessageCircle', sort_order: 4 },
    { name: '导航', icon: 'Navigation', sort_order: 5 },
    { name: '布局', icon: 'Layout', sort_order: 6 },
    { name: '动效', icon: 'Zap', sort_order: 7 },
    { name: '其他', icon: 'Package', sort_order: 99 },
  ];

  for (const cat of defaultCategories) {
    await connection.query(
      'INSERT IGNORE INTO categories (name, icon, sort_order) VALUES (?, ?, ?)',
      [cat.name, cat.icon, cat.sort_order]
    );
  }
  console.log('Default categories inserted');

  await connection.end();
  console.log('Database initialization completed!');
}

initDatabase().catch((err) => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});
