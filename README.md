# 组件画廊 (UI/UX Design)

一个用于预览和管理 React 组件的全栈应用。

## 功能特性

- 组件画廊展示，支持搜索和分类过滤
- Sandpack 实时预览 React 组件
- 代码粘贴和 ZIP 包上传
- MySQL 数据持久化

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 19 + Vite + Tailwind CSS 4 + Sandpack |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | MySQL |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置数据库

创建 MySQL 数据库并配置环境变量：

```bash
cp server/.env.example server/.env
# 编辑 server/.env 填入你的数据库配置
```

### 3. 初始化数据库

```bash
npm run db:init
```

### 4. 启动开发服务器

```bash
npm run dev
```

- 前端：http://localhost:5173
- 后端 API：http://localhost:3000

### 5. 生产部署

```bash
npm run build
npm start
```

## 项目结构

```
uiux-design/
├── server/                 # 后端
│   ├── src/
│   │   ├── index.ts       # 入口
│   │   ├── routes/        # API 路由
│   │   ├── services/      # 业务逻辑
│   │   ├── db/            # 数据库
│   │   └── types/         # 类型定义
│   ├── uploads/           # 上传文件
│   └── .env               # 环境变量
├── client/                 # 前端
│   ├── src/
│   │   ├── components/    # UI 组件
│   │   ├── pages/         # 页面
│   │   └── lib/           # 工具函数
│   └── public/            # 静态资源
└── package.json           # Monorepo 配置
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/categories | 获取分类列表 |
| GET | /api/components | 获取组件列表 |
| GET | /api/components/:id | 获取组件详情 |
| POST | /api/components | 创建组件 |
| POST | /api/components/upload | 上传 ZIP 包 |
| PUT | /api/components/:id | 更新组件 |
| DELETE | /api/components/:id | 删除组件 |

## 组件数据结构

```typescript
interface Component {
  id: string;
  name: string;
  category_id: number | null;
  description: string | null;
  code: string;
  dependencies: Record<string, string> | null;
  tags: string[] | null;
  view_count: number;
  created_at: Date;
  updated_at: Date;
}
```
