export interface Component {
  id: string;
  name: string;
  category_id: number | null;
  category_name?: string;
  description: string | null;
  code: string;
  dependencies: Record<string, string> | null;
  preview_image: string | null;
  tags: string[] | null;
  view_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface Category {
  id: number;
  name: string;
  icon: string | null;
  sort_order: number;
  component_count?: number;
}

export interface CreateComponentInput {
  name: string;
  category_id?: number | null;
  description?: string;
  code: string;
  dependencies?: Record<string, string>;
  tags?: string[];
}

// AI Studio 组件结构
export interface AIStudioComponent {
  id: string;
  name: string;
  category: string;
  description: string;
  code: string;
}

// ZIP 解析结果
export interface ParsedZipResult {
  isAIStudio: boolean;
  projectName: string;
  components: CreateComponentInput[];
  dependencies: Record<string, string>;
  rawFiles: Map<string, string>;
}
