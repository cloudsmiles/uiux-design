import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import * as componentService from '../services/componentService.js';
import { parseZipFile } from '../services/zipParser.js';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 配置文件上传
const storage = multer.diskStorage({
  destination: path.join(__dirname, '../../uploads'),
  filename: (_req, _file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '.zip');
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.zip') {
      cb(null, true);
    } else {
      cb(new Error('只支持 ZIP 文件'));
    }
  },
});

// 分类名称到 ID 的映射缓存
let categoryMap: Map<string, number> | null = null;

async function getCategoryMap(): Promise<Map<string, number>> {
  if (!categoryMap) {
    const categories = await componentService.getCategories();
    categoryMap = new Map(categories.map(c => [c.name, c.id]));
  }
  return categoryMap;
}

async function resolveCategoryId(categoryName: string | undefined): Promise<number | null> {
  if (!categoryName) return null;
  const map = await getCategoryMap();
  return map.get(categoryName) || null;
}

// 获取分类列表
router.get('/categories', async (_req: Request, res: Response) => {
  try {
    const categories = await componentService.getCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    console.error('获取分类失败:', error);
    res.status(500).json({ success: false, message: '获取分类失败' });
  }
});

// 获取组件列表
router.get('/components', async (req: Request, res: Response) => {
  try {
    const { category, search, limit = 20, offset = 0 } = req.query;
    const result = await componentService.getComponents({
      category: category as string,
      search: search as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('获取组件列表失败:', error);
    res.status(500).json({ success: false, message: '获取组件列表失败' });
  }
});

// 获取单个组件
router.get('/components/:id', async (req: Request, res: Response) => {
  try {
    const component = await componentService.getComponentById(req.params.id);
    if (!component) {
      return res.status(404).json({ success: false, message: '组件不存在' });
    }
    await componentService.incrementViewCount(req.params.id);
    res.json({ success: true, data: component });
  } catch (error) {
    console.error('获取组件详情失败:', error);
    res.status(500).json({ success: false, message: '获取组件详情失败' });
  }
});

// 创建组件（代码粘贴）
router.post('/components', async (req: Request, res: Response) => {
  try {
    const { name, category_id, description, code, dependencies, tags } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, message: '名称和代码不能为空' });
    }

    const id = await componentService.createComponent({
      name,
      category_id,
      description,
      code,
      dependencies,
      tags,
    });

    res.status(201).json({ success: true, data: { id } });
  } catch (error) {
    console.error('创建组件失败:', error);
    res.status(500).json({ success: false, message: '创建组件失败' });
  }
});

// 上传 ZIP 包（支持 AI Studio 项目）
router.post('/components/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '请上传 ZIP 文件' });
    }

    // 解析 ZIP 文件
    const result = parseZipFile(req.file.path);

    if (result.components.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ZIP 包中未找到有效的 React 组件。支持的格式：\n' +
                 '- AI Studio 项目 (包含 src/data/components.tsx)\n' +
                 '- 普通组件包 (包含 .tsx/.jsx 文件)'
      });
    }

    // 解析分类 ID
    const categories = await componentService.getCategories();
    const categoryMap = new Map(categories.map(c => [c.name, c.id]));

    // 为组件添加分类 ID
    const componentsWithCategory = result.components.map(comp => {
      const tags = comp.tags || [];
      // 从 tags 中查找分类名
      const categoryName = tags.find(t => categoryMap.has(t));
      const category_id = categoryName ? categoryMap.get(categoryName) || null : null;
      return { ...comp, category_id };
    });

    // 批量创建组件
    const ids = await componentService.createComponentsBatch(componentsWithCategory);

    res.status(201).json({
      success: true,
      data: {
        isAIStudio: result.isAIStudio,
        projectName: result.projectName,
        count: ids.length,
        ids,
        components: componentsWithCategory.map(c => ({ name: c.name, description: c.description })),
      },
    });
  } catch (error) {
    console.error('上传组件失败:', error);
    res.status(500).json({ success: false, message: '上传组件失败: ' + (error as Error).message });
  }
});

// 更新组件
router.put('/components/:id', async (req: Request, res: Response) => {
  try {
    const updated = await componentService.updateComponent(req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: '组件不存在或无更新' });
    }
    res.json({ success: true, message: '更新成功' });
  } catch (error) {
    console.error('更新组件失败:', error);
    res.status(500).json({ success: false, message: '更新组件失败' });
  }
});

// 删除组件
router.delete('/components/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await componentService.deleteComponent(req.params.id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: '组件不存在' });
    }
    res.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除组件失败:', error);
    res.status(500).json({ success: false, message: '删除组件失败' });
  }
});

export default router;
