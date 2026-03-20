import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Upload, Code, FileArchive, Check, Sparkles } from 'lucide-react';
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
            isAIStudio: false,
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
        className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm"
      >
        <div className="px-6 py-4 border-b border-zinc-100">
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
                  {result.isAIStudio ? (
                    <Sparkles className="w-5 h-5 text-green-600" />
                  ) : (
                    <Check className="w-5 h-5 text-green-600" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-green-800">
                    {result.isAIStudio ? `AI Studio 项目「${result.projectName}」` : '组件'}上传成功！
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

        {/* Form */}
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
                  className="w-full px-4 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
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
                  className="w-full px-4 py-3 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all font-mono text-sm resize-none"
                  required
                />
              </div>
            </>
          )}

          {/* Category (optional) */}
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">分类（可选）</label>
            <select
              value={categoryId || ''}
              onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
              className="w-full px-4 py-2 border border-zinc-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
            >
              <option value="">自动识别或选择分类</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
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
      </motion.div>
    </div>
  );
}
