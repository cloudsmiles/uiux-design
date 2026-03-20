import { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LayoutGrid, Upload } from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-zinc-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <LayoutGrid className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">组件画廊</span>
          </Link>

          <nav className="flex items-center space-x-4">
            <Link
              to="/upload"
              className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-full hover:bg-indigo-700 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>上传组件</span>
            </Link>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="bg-white border-t border-zinc-200 py-12 mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <LayoutGrid className="w-5 h-5 text-indigo-600" />
            <span className="text-lg font-bold tracking-tight">组件画廊</span>
          </div>
          <p className="text-sm text-zinc-500 max-w-md mx-auto">
            精选的美观前端组件集，支持交互式预览。为热爱简洁 UI 的开发者打造。
          </p>
        </div>
      </footer>
    </div>
  );
}
