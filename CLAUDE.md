# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A full-stack React component gallery application for previewing and managing UI components. Users can browse components, view live previews via Sandpack, upload ZIP packages, and paste code directly.

**Tech Stack**: React 19 + Vite + Tailwind CSS 4 (frontend), Express + TypeScript (backend), MySQL (database)

**Node.js**: Requires Node.js 20+ (uses ES2022, Vite 6, React 19). Use nvm to switch:

```bash
nvm install 22     # Install Node.js 22 LTS if not present
nvm use 22         # Switch to Node.js 22
node -v            # Verify version
```

## Commands

```bash
npm install           # Install all dependencies (root)
npm run dev           # Start both server and client in development
npm run dev:server    # Start backend only (port 3000)
npm run dev:client    # Start frontend only (port 5173)
npm run build         # Build client then server for production
npm start             # Start production server
npm run db:init       # Initialize MySQL database (creates tables, default categories)
```

## Architecture

**Monorepo structure** using npm workspaces:

- `server/` - Express backend with TypeScript
  - `src/index.ts` - Entry point, Express setup
  - `src/routes/components.ts` - All API routes
  - `src/services/` - Business logic (componentService, zipParser)
  - `src/db/` - MySQL connection and initialization
  - `.env` - Database credentials (copy from .env.example)

- `client/` - React frontend with Vite
  - `src/pages/` - Route pages (Gallery, ComponentDetail, Upload)
  - `src/components/` - Shared UI components
  - `src/lib/api.ts` - API client
  - `src/lib/preview.ts` - Sandpack preview utilities
  - `vite.config.ts` - Vite config with `/api` proxy to backend

**Production routing**: Client served at `/design/`, API at `/api`. The server statically serves the built client.

## Database Schema

- `categories` - id, name, icon, sort_order
- `components` - id (UUID), name, category_id, description, code (LONGTEXT), files (JSON), dependencies (JSON), preview_image (base64 LONGTEXT), tags (JSON), view_count

## Key Patterns

- **Smart category detection**: When creating/uploading components without a category, the system uses keyword matching against component name, description, and code to auto-assign a category.
- **ZIP upload parsing**: Supports AI Studio project format (`src/data/components.tsx`) and standard component packages (`.tsx/.jsx` files).
- **Sandpack preview**: Client uses `@codesandbox/sandpack-react` for live React component rendering with customizable dependencies.

## Related Documentation

- `README.md` - 项目介绍、快速开始、API 接口列表
- `docs/preview-architecture.md` - 前端预览原理详解（iframe + Babel Standalone 方案）
- `server/.env.example` - 环境变量配置模板
