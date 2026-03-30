const API_BASE = import.meta.env.VITE_API_BASE || '/api';

/**
 * API 错误类型 (P11)
 */
export interface ApiError {
  code: string;
  message: string;
  status: number;
  details?: unknown;
}

/**
 * API 响应类型
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: ApiError;
}

/**
 * 统一的请求函数，包含错误处理 (P11)
 */
async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 秒超时

    const response = await fetch(`${API_BASE}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      signal: controller.signal,
      ...options,
    });

    clearTimeout(timeoutId);

    // 检查 HTTP 状态码
    if (!response.ok) {
      const error: ApiError = {
        code: 'HTTP_ERROR',
        message: `HTTP ${response.status}: ${response.statusText}`,
        status: response.status,
      };

      // 尝试解析错误响应体
      try {
        const body = await response.json();
        error.message = body.message || body.error || error.message;
        error.details = body;
      } catch {
        // 忽略解析错误
      }

      return {
        success: false,
        message: error.message,
        error,
      };
    }

    // 解析响应
    const data = await response.json();
    return data;
  } catch (error) {
    // 网络错误或超时处理
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          message: '请求超时，请检查网络连接',
          error: { code: 'TIMEOUT', message: '请求超时', status: 0 },
        };
      }

      return {
        success: false,
        message: error.message || '网络请求失败',
        error: { code: 'NETWORK_ERROR', message: error.message, status: 0 },
      };
    }

    return {
      success: false,
      message: '未知错误',
      error: { code: 'UNKNOWN', message: '未知错误', status: 0 },
    };
  }
}

// 类型定义
export interface Category {
  id: number;
  name: string;
  icon: string | null;
  sort_order: number;
  component_count: number;
}

export interface Component {
  id: string;
  name: string;
  category_id: number | null;
  category_name: string | null;
  description: string | null;
  code: string;
  files: Record<string, string> | null;  // 多文件支持
  dependencies: Record<string, string> | null;
  preview_image: string | null;
  tags: string[] | null;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface ComponentsResponse {
  components: Component[];
  total: number;
}

export interface UploadResult {
  projectName: string;
  count: number;
  ids: string[];
  components: { name: string; description: string }[];
}

// API 函数
export const api = {
  getCategories: () => request<Category[]>('/categories'),

  getComponents: (params?: { category?: string; search?: string; limit?: number; offset?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.offset) searchParams.set('offset', String(params.offset));
    const query = searchParams.toString();
    return request<ComponentsResponse>(`/components${query ? `?${query}` : ''}`);
  },

  getComponent: (id: string) => request<Component>(`/components/${id}`),

  createComponent: (data: {
    name: string;
    category_id?: number;
    description?: string;
    code: string;
    dependencies?: Record<string, string>;
    tags?: string[];
  }) =>
    request<{ id: string }>('/components', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  uploadComponent: async (formData: FormData): Promise<ApiResponse<UploadResult>> => {
    const response = await fetch(`${API_BASE}/components/upload`, {
      method: 'POST',
      body: formData,
    });
    return response.json();
  },

  updateComponent: (id: string, data: Partial<{
    name: string;
    category_id: number;
    description: string;
    code: string;
    dependencies: Record<string, string>;
    tags: string[];
  }>) =>
    request<void>(`/components/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteComponent: (id: string) =>
    request<void>(`/components/${id}`, { method: 'DELETE' }),

  savePreviewImage: (id: string, preview_image: string) =>
    request<void>(`/components/${id}/preview`, {
      method: 'PUT',
      body: JSON.stringify({ preview_image }),
    }),
};
