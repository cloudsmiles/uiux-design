import { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Copy, Check, Trash2, Columns, Rows } from 'lucide-react';
import hljs from 'highlight.js/lib/core';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import css from 'highlight.js/lib/languages/css';
import 'highlight.js/styles/github-dark.css';
import { api, type Component } from '../lib/api';
import { cn } from '../lib/utils';
import { buildPreviewHtml } from '../lib/preview';

hljs.registerLanguage('typescript', typescript);
hljs.registerLanguage('xml', xml);
hljs.registerLanguage('css', css);

export default function ComponentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [component, setComponent] = useState<Component | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [layout, setLayout] = useState<'side' | 'stack'>(() => {
    return (localStorage.getItem('detail-layout') as 'side' | 'stack') || 'side';
  });

  function toggleLayout() {
    const next = layout === 'side' ? 'stack' : 'side';
    setLayout(next);
    localStorage.setItem('detail-layout', next);
  }

  useEffect(() => {
    if (id) loadComponent(id);
  }, [id]);

  async function loadComponent(cid: string) {
    setIsLoading(true);
    try {
      const res = await api.getComponent(cid);
      if (res.success && res.data) setComponent(res.data);
    } catch (e) {
      console.error('Failed to load component:', e);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleDelete() {
    if (!component || !confirm('确定要删除这个组件吗？')) return;
    try {
      await api.deleteComponent(component.id);
      navigate('/');
    } catch (e) {
      console.error('Failed to delete:', e);
    }
  }

  const hasMultiFiles =
    !!component?.files && Object.keys(component.files).length > 0;

  /* ---- 预览 HTML ---- */
  const previewHtml = useMemo(() => {
    if (!component) return '';
    return buildPreviewHtml(component.code, component.files, component.dependencies);
  }, [component]);

  /* ---- 源代码文件列表（去重） ---- */
  const codeFileList = useMemo(() => {
    if (!component) return [];

    if (hasMultiFiles) {
      const seen = new Set<string>();
      const list: { name: string; code: string }[] = [];
      list.push({ name: 'App.tsx', code: component.code });
      seen.add('App.tsx');
      for (const [path, code] of Object.entries(component.files!)) {
        const name = path.split('/').pop() || path;
        if (seen.has(name)) continue;
        seen.add(name);
        list.push({ name, code });
      }
      return list;
    }

    return [{ name: 'Component.tsx', code: component.code }];
  }, [component, hasMultiFiles]);

  if (isLoading) {
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
        <Link to="/" className="text-indigo-600 hover:underline">返回画廊</Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <Link to="/" className="flex items-center space-x-2 text-zinc-600 hover:text-zinc-900 transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span>返回画廊</span>
        </Link>
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleLayout}
            className="flex items-center space-x-1.5 px-3 py-2 text-zinc-500 hover:text-zinc-700 hover:bg-zinc-100 rounded-lg transition-colors"
            title={layout === 'side' ? '切换为上下布局' : '切换为左右布局'}
          >
            {layout === 'side' ? <Rows className="w-4 h-4" /> : <Columns className="w-4 h-4" />}
            <span className="text-sm">{layout === 'side' ? '上下' : '左右'}</span>
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            <span>删除</span>
          </button>
        </div>
      </div>

      <div className={cn(
        'gap-6 lg:gap-8',
        layout === 'side'
          ? 'grid grid-cols-1 lg:grid-cols-2'
          : 'flex flex-col'
      )}>
        {/* 预览 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            'bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm',
            layout === 'side' && 'lg:sticky lg:top-4'
          )}
        >
          <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
            <h3 className="font-medium text-zinc-700">预览</h3>
            {component.category_name && (
              <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                {component.category_name}
              </span>
            )}
          </div>
          <iframe
            srcDoc={previewHtml}
            title="组件预览"
            className="w-full border-0"
            style={{ height: layout === 'stack' ? 600 : 700 }}
            sandbox="allow-scripts"
          />
        </motion.div>

        {/* 右侧 — 信息 & 代码 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-6"
        >
          {/* 组件信息 */}
          <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-zinc-900 mb-2">{component.name}</h1>
            <p className="text-zinc-600 mb-4">{component.description || '暂无描述'}</p>
            {component.tags && component.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {[...new Set(component.tags)].map((tag, i) => (
                  <span key={`${tag}-${i}`} className="px-2 py-1 bg-zinc-100 text-zinc-600 text-xs rounded-md">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* 源代码 */}
          <CodeViewer files={codeFileList} />
        </motion.div>
      </div>
    </div>
  );
}

/** 只读代码展示，带语法高亮和多文件 tab */
function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'css') return 'css';
  if (ext === 'html' || ext === 'htm') return 'xml';
  return 'typescript';
}

function CodeViewer({ files }: { files: { name: string; code: string }[] }) {
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const activeFile = files[activeTab] || files[0];

  const highlightedCode = useMemo(() => {
    if (!activeFile?.code) return '';
    const lang = getLanguage(activeFile.name);
    try {
      return hljs.highlight(activeFile.code, { language: lang }).value;
    } catch {
      return activeFile.code;
    }
  }, [activeFile]);

  async function handleCopy() {
    if (!activeFile) return;
    await navigator.clipboard.writeText(activeFile.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center justify-between">
        <h3 className="font-medium text-zinc-700">源代码</h3>
        <button
          onClick={handleCopy}
          className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-zinc-100 hover:bg-zinc-200 rounded-md transition-colors"
        >
          {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          <span>{copied ? '已复制' : '复制'}</span>
        </button>
      </div>

      {files.length > 1 && (
        <div className="flex border-b border-zinc-700 bg-zinc-900 overflow-x-auto">
          {files.map((file, i) => (
            <button
              key={`tab-${i}-${file.name}`}
              onClick={() => setActiveTab(i)}
              className={cn(
                'px-4 py-2 text-xs font-mono whitespace-nowrap transition-colors',
                i === activeTab
                  ? 'text-white bg-zinc-800 border-b-2 border-indigo-400'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50',
              )}
            >
              {file.name}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-auto max-h-[600px] bg-[#0d1117]">
        <pre className="p-4 text-sm leading-relaxed">
          <code
            className={`hljs language-${getLanguage(activeFile?.name || '')}`}
            dangerouslySetInnerHTML={{ __html: highlightedCode }}
          />
        </pre>
      </div>
    </div>
  );
}
