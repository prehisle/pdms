# YDMS Frontend Skeleton

A minimal Vite + React + Ant Design setup for the YDMS admin interface.

## Getting started

1. Ensure Node.js 18+ and pnpm/npm/yarn are available.
2. Install dependencies:

```bash
npm install
```

3. Start the dev server:

```bash
npm run dev
```

4. Visit http://localhost:5173 to see the Ant Design hello world page.

### Drag & Drop Debugging

When troubleshooting category拖拽排序, you can enable verbose前端日志:

```bash
VITE_DEBUG_DRAG=1 npm run dev
```

This emits `[drag-debug]` logs in the browser控制台, showing父节点、目标顺序等信息,便于定位拖拽行为。

### Bulk Operations

- 回收站支持多选批量恢复与彻底删除，操作按钮位于列表上方。

The project structure mirrors the planned architecture so additional pages,
components and API hooks can be layered on during subsequent iterations.
