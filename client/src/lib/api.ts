const API_BASE = import.meta.env.VITE_API_BASE || '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });
  return response.json();
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
  isAIStudio: boolean;
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
