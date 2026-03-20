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

// 关键词 → 分类名映射，用于智能分类检测
const categoryKeywords: [string, string[]][] = [
  ['按钮', ['button', 'btn', '按钮', 'click', 'submit']],
  ['表单', ['input', 'textarea', 'search', 'form', 'checkbox', 'radio', 'switch', 'select', 'picker', 'toggle', 'slider', 'range', 'field', '输入', '搜索', '表单']],
  ['展示', ['card', 'table', 'list', 'tree', 'badge', 'tag', 'chip', 'label', 'avatar', 'icon', 'chart', 'graph', 'statistic', 'timeline', 'step', '卡片', '表格', '列表', '标签', '头像', '图标', '图表', '时间线', '步骤']],
  ['反馈', ['toast', 'alert', 'notification', 'message', 'modal', 'dialog', 'drawer', 'popup', 'overlay', 'tooltip', 'loading', 'spinner', 'skeleton', 'loader', 'progress', '提示', '通知', '弹窗', '加载']],
  ['导航', ['nav', 'menu', 'sidebar', 'breadcrumb', 'tab', 'header', 'footer', '导航', '菜单']],
  ['布局', ['layout', 'grid', 'flex', 'container', 'divider', 'section', '布局']],
  ['动效', ['animation', 'animate', 'transition', 'motion', 'effect', 'particle', 'canvas', '动画', '动效']],
];

/**
 * 根据组件名称、代码内容、描述智能检测分类
 */
async function detectCategory(name: string, code: string, description?: string): Promise<number | null> {
  const map = await getCategoryMap();
  const text = `${name} ${description || ''} ${code}`.toLowerCase();

  // 按匹配关键词数量排序，取最佳匹配
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const [category, keywords] of categoryKeywords) {
    let score = 0;
    for (const kw of keywords) {
      // 名称匹配权重更高
      if (name.toLowerCase().includes(kw)) score += 3;
      // 描述匹配
      if (description?.toLowerCase().includes(kw)) score += 2;
      // 代码匹配
      if (text.includes(kw)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = category;
    }
  }

  // 至少要有 1 分才算匹配到
  if (bestMatch && bestScore >= 1) {
    return map.get(bestMatch) || null;
  }

  // 兜底：归到"其他"
  return map.get('其他') || null;
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
router.get('/components/:id', async (req: Request<{ id: string }>, res: Response) => {
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

    // 如果没有指定分类，智能检测
    const finalCategoryId = category_id || await detectCategory(name, code, description);

    const id = await componentService.createComponent({
      name,
      category_id: finalCategoryId,
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

    // 为组件智能匹配分类
    const componentsWithCategory = await Promise.all(result.components.map(async comp => {
      const tags = comp.tags || [];
      const map = await getCategoryMap();
      // 先从 tags 中查找分类名
      const categoryName = tags.find(t => map.has(t));
      let category_id = categoryName ? map.get(categoryName) || null : null;
      // 如果 tags 没匹配到，用智能检测
      if (!category_id) {
        category_id = await detectCategory(comp.name, comp.code, comp.description);
      }
      return { ...comp, category_id };
    }));

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
router.put('/components/:id', async (req: Request<{ id: string }>, res: Response) => {
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

// 保存预览截图
router.put('/components/:id/preview', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { preview_image } = req.body;
    if (!preview_image) {
      return res.status(400).json({ success: false, message: '缺少预览图数据' });
    }
    await componentService.updateComponent(req.params.id, { preview_image });
    res.json({ success: true });
  } catch (error) {
    console.error('保存预览图失败:', error);
    res.status(500).json({ success: false, message: '保存预览图失败' });
  }
});

// 删除组件
router.delete('/components/:id', async (req: Request<{ id: string }>, res: Response) => {
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
