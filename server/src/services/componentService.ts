import { v4 as uuidv4 } from 'uuid';
import pool from '../db/index.js';
import type { Component, Category, CreateComponentInput } from '../types/index.js';

export async function getCategories(): Promise<Category[]> {
  const [rows] = await pool.query(`
    SELECT c.*, COUNT(cm.id) as component_count
    FROM categories c
    LEFT JOIN components cm ON c.id = cm.category_id
    GROUP BY c.id
    ORDER BY c.sort_order ASC
  `);
  return rows as Category[];
}

export async function getComponents(options: {
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ components: Component[]; total: number }> {
  let query = `
    SELECT c.id, c.name, c.category_id, c.description, c.code, c.files,
           c.dependencies, c.preview_image, c.tags, c.view_count,
           c.created_at, c.updated_at, cat.name as category_name
    FROM components c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE 1=1
  `;
  const params: (string | number)[] = [];

  if (options.category && options.category !== '全部') {
    query += ' AND cat.name = ?';
    params.push(options.category);
  }

  if (options.search) {
    query += ' AND (c.name LIKE ? OR c.description LIKE ?)';
    const searchTerm = `%${options.search}%`;
    params.push(searchTerm, searchTerm);
  }

  // 获取总数
  const [countRows] = await pool.query(
    `SELECT COUNT(*) as total FROM (${query}) as t`,
    params
  );
  const total = (countRows as { total: number }[])[0].total;

  // 分页
  query += ' ORDER BY c.created_at DESC';
  if (options.limit) {
    query += ' LIMIT ? OFFSET ?';
    params.push(options.limit, options.offset || 0);
  }

  const [rows] = await pool.query(query, params);
  return { components: rows as Component[], total };
}

export async function getComponentById(id: string): Promise<Component | null> {
  const [rows] = await pool.query(
    `
    SELECT c.*, cat.name as category_name
    FROM components c
    LEFT JOIN categories cat ON c.category_id = cat.id
    WHERE c.id = ?
    `,
    [id]
  );
  const components = rows as Component[];
  return components[0] || null;
}

export async function createComponent(input: CreateComponentInput): Promise<string> {
  const id = uuidv4();
  await pool.query(
    `INSERT INTO components (id, name, category_id, description, code, files, dependencies, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.name,
      input.category_id || null,
      input.description || null,
      input.code,
      JSON.stringify(input.files || {}),
      JSON.stringify(input.dependencies || {}),
      JSON.stringify(input.tags || []),
    ]
  );
  return id;
}

export async function createComponentsBatch(inputs: CreateComponentInput[]): Promise<string[]> {
  if (inputs.length === 0) return [];

  const ids: string[] = [];
  const conn = await pool.getConnection();

  try {
    await conn.beginTransaction();

    for (const input of inputs) {
      const id = uuidv4();
      await conn.query(
        `INSERT INTO components (id, name, category_id, description, code, files, dependencies, tags)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          input.name,
          input.category_id || null,
          input.description || null,
          input.code,
          JSON.stringify(input.files || {}),
          JSON.stringify(input.dependencies || {}),
          JSON.stringify(input.tags || []),
        ]
      );
      ids.push(id);
    }

    await conn.commit();
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }

  return ids;
}

export async function updateComponent(
  id: string,
  input: Partial<CreateComponentInput>
): Promise<boolean> {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (input.name !== undefined) {
    fields.push('name = ?');
    values.push(input.name);
  }
  if (input.category_id !== undefined) {
    fields.push('category_id = ?');
    values.push(input.category_id);
  }
  if (input.description !== undefined) {
    fields.push('description = ?');
    values.push(input.description);
  }
  if (input.code !== undefined) {
    fields.push('code = ?');
    values.push(input.code);
  }
  if (input.files !== undefined) {
    fields.push('files = ?');
    values.push(JSON.stringify(input.files));
  }
  if (input.dependencies !== undefined) {
    fields.push('dependencies = ?');
    values.push(JSON.stringify(input.dependencies));
  }
  if (input.tags !== undefined) {
    fields.push('tags = ?');
    values.push(JSON.stringify(input.tags));
  }
  if (input.preview_image !== undefined) {
    fields.push('preview_image = ?');
    values.push(input.preview_image);
  }

  if (fields.length === 0) return false;

  values.push(id);
  await pool.query(
    `UPDATE components SET ${fields.join(', ')} WHERE id = ?`,
    values
  );
  return true;
}

export async function deleteComponent(id: string): Promise<boolean> {
  const [result] = await pool.query('DELETE FROM components WHERE id = ?', [id]);
  return (result as { affectedRows: number }).affectedRows > 0;
}

export async function incrementViewCount(id: string): Promise<void> {
  await pool.query(
    'UPDATE components SET view_count = view_count + 1 WHERE id = ?',
    [id]
  );
}
