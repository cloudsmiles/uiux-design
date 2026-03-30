import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Upload, Code, FileArchive, Check, ChevronDown } from 'lucide-react';
import { api, type Category, type UploadResult } from '../lib/api';
import { cn } from '../lib/utils';

type UploadMode = 'code' | 'zip';

export default function UploadPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [mode, setMode] = useState<UploadMode>('zip');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadResult | null>(null);

  // 表单字段
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [tags, setTags] = useState('');
  const [zipFile, setZipFile] = useState<File | null>(null);

  useEffect(() => {
    loadCategories();
  }, []);

  async function loadCategories() {
    const res = await api.getCategories();
    if (res.success) setCategories(res.data || []);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      if (mode === 'code') {
        const res = await api.createComponent({
          name,
          category_id: categoryId,
          description,
          code,
          tags: tags ? tags.split(',').map((t) => t.trim()) : undefined,
        });
        if (res.success) {
          setResult({
            projectName: name,
            count: 1,
            ids: [res.data!.id],
            components: [{ name, description: description || '' }],
          });
          resetForm();
        } else {
          setError(res.message || '上传失败');
        }
      } else {
        if (!zipFile) {
          setError('请选择 ZIP 文件');
          setLoading(false);
          return;
        }
        const formData = new FormData();
        formData.append('file', zipFile);
        if (name) formData.append('name', name);
        if (categoryId) formData.append('category_id', String(categoryId));
        if (description) formData.append('description', description);

        const res = await api.uploadComponent(formData);
        if (res.success && res.data) {
          setResult(res.data);
          resetForm();
        } else {
          setError(res.message || '上传失败');
        }
      }
    } catch (err) {
      setError((err as Error).message || '网络错误');
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setName('');
    setCategoryId(undefined);
    setDescription('');
    setCode('');
    setTags('');
    setZipFile(null);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center space-x-2 mb-8">
        <Link
          to="/"
          className="flex items-center space-x-2 text-zinc-600 hover:text-zinc-900 transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回画廊</span>
        </Link>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl border border-zinc-200 shadow-sm"
      >
        <div className="px-6 py-4 border-b border-zinc-100 rounded-t-2xl">
          <h1 className="text-xl font-bold text-zinc-900">上传组件</h1>
          <p className="text-sm text-zinc-500 mt-1">支持 AI Studio 项目和普通组件包</p>
        </div>

        {/* Mode Selector */}
        <div className="px-6 py-4 border-b border-zinc-100">
          <div className="flex space-x-2">
            <button
              onClick={() => setMode('zip')}
              className={cn(
                'flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                mode === 'zip'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}
            >
              <FileArchive className="w-4 h-4" />
              <span>ZIP 上传</span>
            </button>
            <button
              onClick={() => setMode('code')}
              className={cn(
                'flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                mode === 'code'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
              )}
            >
              <Code className="w-4 h-4" />
              <span>代码粘贴</span>
            </button>
          </div>
        </div>

        {/* Success Result */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-green-50 border-b border-green-100 px-6 py-4"
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <Check className="w-5 h-5 text-green-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-green-800">
                    组件上传成功！
                  </h3>
                  <p className="text-sm text-green-700 mt-1">
                    共导入 {result.count} 个组件
                  </p>
                  {result.components.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {result.components.slice(0, 5).map((comp, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"
                        >
                          {comp.name}
                        </span>
                      ))}
                      {result.components.length > 5 && (
                        <span className="text-xs text-green-700">
                          +{result.components.length - 5} 更多
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <Link
                  to="/"
                  className="text-sm font-medium text-green-700 hover:text-green-800"
                >
                  查看画廊
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="bg-red-50 border-b border-red-100 px-6 py-4"
            >
              <p className="text-sm text-red-700">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form — 上传成功后隐藏 */}
        {!result && (
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {mode === 'zip' ? (
            <>
              {/* ZIP Upload */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  ZIP 文件 <span className="text-red-500">*</span>
                </label>
                <div className="border-2 border-dashed border-zinc-200 rounded-xl p-8 text-center hover:border-indigo-400 transition-colors cursor-pointer">
                  <input
                    type="file"
                    accept=".zip"
                    onChange={(e) => {
                      setZipFile(e.target.files?.[0] || null);
                      setError(null);
                      setResult(null);
                    }}
                    className="hidden"
                    id="zip-upload"
                    required
                  />
                  <label htmlFor="zip-upload" className="cursor-pointer">
                    <FileArchive className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
                    {zipFile ? (
                      <p className="text-sm text-zinc-600">{zipFile.name}</p>
                    ) : (
                      <>
                        <p className="text-sm text-zinc-600">点击上传 ZIP 文件</p>
                        <p className="text-xs text-zinc-400 mt-1">
                          支持 AI Studio 项目、普通组件包（最大 20MB）
                        </p>
                      </>
                    )}
                  </label>
                </div>
              </div>

              {/* 提示信息 */}
              <div className="bg-indigo-50 rounded-xl p-4">
                <h4 className="text-sm font-medium text-indigo-800 mb-2">支持的上传格式：</h4>
                <ul className="text-xs text-indigo-700 space-y-1">
                  <li>• <strong>AI Studio 项目</strong>：自动识别 metadata.json，提取所有组件</li>
                  <li>• <strong>普通组件包</strong>：查找 .tsx/.jsx 文件作为组件</li>
                </ul>
              </div>
            </>
          ) : (
            <>
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  组件名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="例如：闪亮按钮"
                  className="w-full px-4 py-2 border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
                  required
                />
              </div>

              {/* Code */}
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">
                  组件代码 <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder={`粘贴你的 React 组件代码...\n\n例如：\n<button className="px-4 py-2 bg-indigo-600 text-white rounded-lg">\n  点击我\n</button>`}
                  rows={12}
                  className="w-full px-4 py-3 border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 font-mono text-sm resize-none transition-all"
                  required
                />
              </div>
            </>
          )}

          {/* Category (optional) */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">分类（可选）</label>
            <CategorySelect
              categories={categories}
              value={categoryId}
              onChange={setCategoryId}
            />
          </div>

          {/* Submit */}
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={loading}
              className={cn(
                'flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-medium transition-colors',
                loading
                  ? 'bg-zinc-200 text-zinc-400 cursor-not-allowed'
                  : 'bg-indigo-600 text-white hover:bg-indigo-700'
              )}
            >
              <Upload className="w-4 h-4" />
              <span>{loading ? '上传中...' : '提交'}</span>
            </button>
          </div>
        </form>
        )}

        {/* 上传成功后显示"继续上传"按钮 */}
        {result && (
          <div className="p-6 flex justify-center">
            <button
              onClick={() => { setResult(null); resetForm(); }}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors"
            >
              继续上传
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

/** 自定义分类下拉选择 */
function CategorySelect({
  categories,
  value,
  onChange,
}: {
  categories: Category[];
  value: number | undefined;
  onChange: (v: number | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = categories.find((c) => c.id === value);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center justify-between px-4 py-2 border rounded-lg bg-white text-sm transition-all cursor-pointer',
          open
            ? 'border-indigo-500 ring-1 ring-indigo-500'
            : 'border-zinc-200 hover:border-zinc-300',
        )}
      >
        <span className={selected ? 'text-zinc-900' : 'text-zinc-400'}>
          {selected ? selected.name : '自动识别或选择分类'}
        </span>
        <ChevronDown className={cn('w-4 h-4 text-zinc-400 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 mt-1 w-full bg-white border border-zinc-200 rounded-lg shadow-lg py-1 max-h-60 overflow-auto"
          >
            <li>
              <button
                type="button"
                onClick={() => { onChange(undefined); setOpen(false); }}
                className={cn(
                  'w-full text-left px-4 py-2 text-sm transition-colors',
                  !value ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-600 hover:bg-zinc-50',
                )}
              >
                自动识别
              </button>
            </li>
            {categories.map((cat) => (
              <li key={cat.id}>
                <button
                  type="button"
                  onClick={() => { onChange(cat.id); setOpen(false); }}
                  className={cn(
                    'w-full text-left px-4 py-2 text-sm transition-colors',
                    value === cat.id ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-700 hover:bg-zinc-50',
                  )}
                >
                  {cat.name}
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
