import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Sandpack } from '@codesandbox/sandpack-react';
import { motion } from 'framer-motion';
import { ArrowLeft, Copy, Check, Trash2 } from 'lucide-react';
import { api, type Component } from '../lib/api';

const defaultDependencies = {
  react: '^19.0.0',
  'react-dom': '^19.0.0',
  'framer-motion': '^12.0.0',
  'lucide-react': '^0.483.0',
  clsx: '^2.1.1',
  'tailwind-merge': '^3.0.2',
};

export default function ComponentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [component, setComponent] = useState<Component | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (id) loadComponent(id);
  }, [id]);

  async function loadComponent(id: string) {
    setLoading(true);
    try {
      const res = await api.getComponent(id);
      if (res.success && res.data) {
        setComponent(res.data);
      }
    } catch (error) {
      console.error('Failed to load component:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    if (!component || !confirm('确定要删除这个组件吗？')) return;
    try {
      await api.deleteComponent(component.id);
      navigate('/');
    } catch (error) {
      console.error('Failed to delete component:', error);
    }
  }

  async function copyCode() {
    if (!component) return;
    await navigator.clipboard.writeText(component.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!component) {
    return (
      <div className="text-center py-20">
        <h2 className="text-xl font-semibold mb-4">组件不存在</h2>
        <Link to="/" className="text-indigo-600 hover:underline">
          返回画廊
        </Link>
      </div>
    );
  }

  const dependencies = {
    ...defaultDependencies,
    ...(component.dependencies || {}),
  };

  // 构建预览代码
  const previewCode = `import React from 'react';
${component.code.includes('framer-motion') ? "import { motion } from 'framer-motion';\n" : ''}${component.code.includes('lucide-react') ? "import { Search, X, Maximize2, Code, LayoutGrid, Filter, ChevronRight, ArrowLeft, Copy, Check, Trash2, Eye, Loader } from 'lucide-react';\n" : ''}${component.code.includes('clsx') || component.code.includes('cn') ? "import { clsx } from 'clsx';\nimport { twMerge } from 'tailwind-merge';\n\nconst cn = (...inputs) => twMerge(clsx(inputs));\n" : ''}
export default function App() {
  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center p-8">
      ${component.code}
    </div>
  );
}`;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link
          to="/"
          className="flex items-center space-x-2 text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回画廊</span>
        </Link>
        <button
          onClick={handleDelete}
          className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span>删除</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Preview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm"
        >
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="font-medium text-zinc-700">实时预览</h3>
            {component.category_name && (
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                {component.category_name}
              </span>
            )}
          </div>
          <div className="h-[500px]">
            <Sandpack
              template="react-ts"
              theme="light"
              files={{
                '/App.tsx': previewCode,
              }}
              customSetup={{
                dependencies,
              }}
              options={{
                showNavigator: false,
                showTabs: false,
                showLineNumbers: true,
                showInlineErrors: true,
                wrapContent: true,
                editorHeight: 0,
                classes: {
                  'sp-layout': '!h-full',
                  'sp-preview': '!h-full',
                  'sp-preview-container': '!h-full',
                  'sp-preview-iframe': '!h-full',
                },
              }}
            />
          </div>
        </motion.div>

        {/* Info & Code */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {/* Info */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-zinc-900 mb-2">{component.name}</h1>
            <p className="text-zinc-600 mb-4">{component.description || '暂无描述'}</p>
            {component.tags && component.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {component.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2 py-1 bg-zinc-100 text-zinc-600 text-xs rounded-md"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Code */}
          <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-medium text-zinc-700">源代码</h3>
              <button
                onClick={copyCode}
                className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? '已复制' : '复制'}</span>
              </button>
            </div>
            <div className="h-[400px]">
              <Sandpack
                template="react-ts"
                theme="dark"
                files={{
                  '/Component.tsx': component.code,
                }}
                customSetup={{
                  dependencies,
                }}
                options={{
                  showNavigator: false,
                  showTabs: false,
                  showLineNumbers: true,
                  showInlineErrors: true,
                  wrapContent: true,
                  showPreview: false,
                  classes: {
                    'sp-layout': '!h-full',
                    'sp-code-editor': '!h-full',
                  },
                }}
              />
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
