import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Filter, Eye, Play } from 'lucide-react';
import { api, type Category, type Component } from '../lib/api';
import { buildPreviewHtml } from '../lib/preview';
import { cn } from '../lib/utils';

export default function Gallery() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [components, setComponents] = useState<Component[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('全部');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [categoriesRes, componentsRes] = await Promise.all([
        api.getCategories(),
        api.getComponents({ limit: 100 }),
      ]);
      if (categoriesRes.success) setCategories(categoriesRes.data || []);
      if (componentsRes.success) setComponents(componentsRes.data?.components || []);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredComponents = useMemo(() => {
    return components.filter((c) => {
      const matchesSearch =
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.description?.toLowerCase().includes(searchQuery.toLowerCase()) ?? false);
      const matchesCategory = selectedCategory === '全部' || c.category_name === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [components, searchQuery, selectedCategory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Mobile Search */}
      <div className="mb-6 md:hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="搜索组件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-xl text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="flex items-center space-x-2 mb-8 overflow-x-auto pb-2 scrollbar-hide">
        <Filter className="w-4 h-4 text-zinc-400 mr-2 shrink-0" />
        <button
          onClick={() => setSelectedCategory('全部')}
          className={cn(
            'px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
            selectedCategory === '全部'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
              : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
          )}
        >
          全部
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.name)}
            className={cn(
              'px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-all',
              selectedCategory === cat.name
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                : 'bg-white text-zinc-600 hover:bg-zinc-100 border border-zinc-200'
            )}
          >
            {cat.name} ({cat.component_count})
          </button>
        ))}
      </div>

      {/* Desktop Search */}
      <div className="hidden md:flex justify-end mb-6">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="搜索组件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-full text-sm placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {filteredComponents.map((component) => (
            <ComponentCard key={component.id} component={component} />
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {filteredComponents.length === 0 && (
        <div className="text-center py-20">
          <div className="w-16 h-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="w-8 h-8 text-zinc-300" />
          </div>
          <h3 className="text-lg font-semibold text-zinc-900">未找到相关组件</h3>
          <p className="text-zinc-500">请尝试调整搜索关键词或分类筛选。</p>
          <Link to="/upload" className="inline-block mt-4 px-6 py-2 bg-indigo-600 text-white rounded-full text-sm font-medium hover:bg-indigo-700 transition-colors">
            上传新组件
          </Link>
        </div>
      )}
    </div>
  );
}

/** 组件卡片 — 有截图直接展示，没有才 hover 加载 iframe */
function ComponentCard({ component }: { component: Component }) {
  const hasPreview = !!component.preview_image;
  const [hovered, setHovered] = useState(false);

  // 只有没截图的组件才在 hover 时构建预览
  const previewHtml = useMemo(() => {
    if (hasPreview || !hovered) return '';
    return buildPreviewHtml(component.code, component.files);
  }, [hasPreview, hovered, component.code, component.files]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      whileHover={{ y: -4 }}
      onMouseEnter={() => !hasPreview && setHovered(true)}
      onMouseLeave={() => !hasPreview && setHovered(false)}
      className="group relative bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
    >
      {/* Preview Area */}
      <div className="aspect-[4/3] bg-zinc-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] opacity-50" />

        {/* 有截图 — 始终显示静态图 */}
        {hasPreview && (
          <img
            src={component.preview_image!}
            alt={component.name}
            className="absolute inset-0 w-full h-full object-cover object-top z-10"
            loading="lazy"
          />
        )}

        {/* 没截图 + 未 hover — 占位 */}
        {!hasPreview && !hovered && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold shadow-lg">
              {component.name.charAt(0)}
            </div>
            <span className="text-xs text-zinc-400 flex items-center gap-1">
              <Play className="w-3 h-3" /> 悬停预览
            </span>
          </div>
        )}

        {/* 没截图 + hover — 加载 iframe */}
        {!hasPreview && hovered && previewHtml && (
          <div className="absolute inset-0 z-10 overflow-hidden">
            <iframe
              srcDoc={previewHtml}
              title="预览"
              sandbox="allow-scripts"
              className="w-[300%] h-[300%] origin-top-left border-0 pointer-events-none"
              style={{ transform: 'scale(0.3333)' }}
            />
          </div>
        )}

        {/* Overlay Actions */}
        <Link
          to={`/component/${component.id}`}
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20"
        >
          <div className="p-3 bg-white rounded-full text-zinc-900 hover:bg-indigo-50 hover:text-indigo-600 transition-all">
            <Eye className="w-5 h-5" />
          </div>
        </Link>
      </div>

      {/* Info Area */}
      <Link to={`/component/${component.id}`} className="block p-4 border-t border-zinc-100 bg-white">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-semibold text-zinc-900 truncate">{component.name}</h3>
          {component.category_name && (
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded shrink-0 ml-2">
              {component.category_name}
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-500 line-clamp-1">{component.description || '暂无描述'}</p>
        <div className="flex items-center space-x-3 mt-2 text-xs text-zinc-400">
          <span className="flex items-center space-x-1">
            <Eye className="w-3 h-3" />
            <span>{component.view_count}</span>
          </span>
        </div>
      </Link>
    </motion.div>
  );
}
