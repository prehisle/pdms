# YDMS 重构计划

> 基于代码库全面分析的重构和优化建议

## 📋 目录

- [执行摘要](#执行摘要)
- [高优先级问题](#高优先级问题)
- [中优先级问题](#中优先级问题)
- [低优先级问题](#低优先级问题)
- [详细问题分析](#详细问题分析)

---

## 执行摘要

### 代码统计

**后端：**
- `handler.go`: 924 行 ⚠️ 过大
- `category.go`: 1,053 行 ⚠️ 过大
- `handler_test.go`: 1,536 行 ⚠️ 过大

**前端：**
- `App.tsx`: 1,186 行 ⚠️ 严重超大
- `DocumentEditor.tsx`: 766 行 ⚠️ 非常大
- `CategoryTreePanel.tsx`: 764 行 ⚠️ 非常大

### 关键问题概览

| 类别 | 问题数 | 严重程度 |
|------|--------|---------|
| 代码重复 | 8+ | 🔴 高 |
| 组件过大 | 6 | 🔴 高 |
| 类型定义不完整 | 10+ | 🟡 中 |
| 硬编码值 | 15+ | 🟡 中 |
| 文档缺失 | 多处 | 🟢 低 |

---

## 高优先级问题

> 需要在 1 个月内完成，对代码质量和可维护性有重大影响

### 1. 权限检查代码重复 🔴

**影响范围：** `backend/internal/api/handler.go` (5 处重复)

**问题描述：**
```go
// 在 5 个不同的处理器中重复
user, err := h.getCurrentUser(r)
if err != nil {
    respondError(w, http.StatusUnauthorized, err)
    return
}
if user.Role == "proofreader" {
    respondError(w, http.StatusForbidden, errors.New("proofreaders cannot XXX"))
    return
}
```

**影响：**
- 维护困难：修改权限逻辑需要改 5 处
- 容易出错：可能遗漏某些地方
- 不一致性：错误消息和状态码可能不一致

**重构方案：**

```go
// 创建 backend/internal/api/middleware.go
package api

import (
    "fmt"
    "net/http"
)

// requirePermission 创建权限检查中间件
func (h *Handler) requirePermission(allowedRoles ...string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            user, err := h.getCurrentUser(r)
            if err != nil {
                respondError(w, http.StatusUnauthorized, err)
                return
            }

            for _, role := range allowedRoles {
                if user.Role == role {
                    next.ServeHTTP(w, r)
                    return
                }
            }

            respondError(w, http.StatusForbidden,
                fmt.Errorf("role '%s' is not permitted to perform this action", user.Role))
        })
    }
}

// requireNotProofreader 专门的校对员检查
func (h *Handler) requireNotProofreader(action string) func(http.Handler) http.Handler {
    return func(next http.Handler) http.Handler {
        return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
            user, err := h.getCurrentUser(r)
            if err != nil {
                respondError(w, http.StatusUnauthorized, err)
                return
            }

            if user.Role == "proofreader" {
                respondError(w, http.StatusForbidden,
                    fmt.Errorf("proofreaders cannot %s", action))
                return
            }

            next.ServeHTTP(w, r)
        })
    }
}
```

**使用示例：**
```go
// 在 router.go 中
mux.Handle("/api/v1/documents",
    h.requireNotProofreader("create documents")(http.HandlerFunc(h.Documents)))

mux.Handle("/api/v1/categories",
    h.requirePermission("super_admin", "course_admin")(http.HandlerFunc(h.Categories)))
```

**工作量估算：** 2-3 小时
**收益：** 减少 100+ 行重复代码，提高一致性

---

### 2. App.tsx 状态管理混乱 🔴

**影响范围：** `frontend/src/App.tsx` (1,186 行)

**问题描述：**
- 30+ 个状态变量在同一个组件中
- 状态之间的依赖关系不清晰
- 任何状态变化都会导致整个组件重渲染
- 难以测试和维护

**当前状态列表：**
```tsx
const [selectedIds, setSelectedIds] = useState<number[]>([]);
const [selectionParentId, setSelectionParentId] = useState<...>();
const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
const [trashModalOpen, setTrashModalOpen] = useState(false);
const [changePasswordOpen, setChangePasswordOpen] = useState(false);
const [userManagementOpen, setUserManagementOpen] = useState(false);
const [documentFilters, setDocumentFilters] = useState<...>();
const [includeDescendants, setIncludeDescendants] = useState(true);
const [documentTrashParams, setDocumentTrashParams] = useState<...>();
const [categoryTrashParams, setCategoryTrashParams] = useState<...>();
// ... 还有 20+ 个
```

**重构方案：**

**步骤 1：创建分类状态 Context**

```tsx
// frontend/src/contexts/CategoryContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';

interface CategoryState {
  selectedIds: number[];
  selectionParentId: number | null | undefined;
  lastSelectedId: number | null;
}

interface CategoryActions {
  setSelectedIds: (ids: number[]) => void;
  setSelectionParentId: (id: number | null | undefined) => void;
  setLastSelectedId: (id: number | null) => void;
  clearSelection: () => void;
}

interface CategoryContextValue extends CategoryState, CategoryActions {}

const CategoryContext = createContext<CategoryContextValue | undefined>(undefined);

export function CategoryProvider({ children }: { children: ReactNode }) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectionParentId, setSelectionParentId] = useState<number | null | undefined>(undefined);
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);

  const clearSelection = () => {
    setSelectedIds([]);
    setSelectionParentId(undefined);
    setLastSelectedId(null);
  };

  const value: CategoryContextValue = {
    // State
    selectedIds,
    selectionParentId,
    lastSelectedId,
    // Actions
    setSelectedIds,
    setSelectionParentId,
    setLastSelectedId,
    clearSelection,
  };

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategorySelection() {
  const context = useContext(CategoryContext);
  if (!context) {
    throw new Error('useCategorySelection must be used within CategoryProvider');
  }
  return context;
}
```

**步骤 2：创建文档状态 Context**

```tsx
// frontend/src/contexts/DocumentContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';
import type { DocumentFilterFormValues } from '@/features/documents/types';

interface DocumentState {
  filters: DocumentFilterFormValues;
  includeDescendants: boolean;
  trashParams: { page: number; size: number };
  historyParams: { page: number; size: number };
}

interface DocumentActions {
  setFilters: (filters: DocumentFilterFormValues) => void;
  setIncludeDescendants: (include: boolean) => void;
  setTrashParams: (params: { page: number; size: number }) => void;
  setHistoryParams: (params: { page: number; size: number }) => void;
  resetFilters: () => void;
}

interface DocumentContextValue extends DocumentState, DocumentActions {}

const DocumentContext = createContext<DocumentContextValue | undefined>(undefined);

const defaultFilters: DocumentFilterFormValues = {
  type: [],
  metadata: {},
  searchText: '',
};

export function DocumentProvider({ children }: { children: ReactNode }) {
  const [filters, setFilters] = useState<DocumentFilterFormValues>(defaultFilters);
  const [includeDescendants, setIncludeDescendants] = useState(true);
  const [trashParams, setTrashParams] = useState({ page: 1, size: 20 });
  const [historyParams, setHistoryParams] = useState({ page: 1, size: 10 });

  const resetFilters = () => setFilters(defaultFilters);

  const value: DocumentContextValue = {
    // State
    filters,
    includeDescendants,
    trashParams,
    historyParams,
    // Actions
    setFilters,
    setIncludeDescendants,
    setTrashParams,
    setHistoryParams,
    resetFilters,
  };

  return (
    <DocumentContext.Provider value={value}>
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocumentState() {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocumentState must be used within DocumentProvider');
  }
  return context;
}
```

**步骤 3：创建 UI 状态 Context**

```tsx
// frontend/src/contexts/UIContext.tsx
import { createContext, useContext, useState, ReactNode } from 'react';

interface UIState {
  trashModalOpen: boolean;
  changePasswordOpen: boolean;
  userManagementOpen: boolean;
  documentHistoryOpen: boolean;
  documentHistoryDocId: number | null;
}

interface UIActions {
  openTrashModal: () => void;
  closeTrashModal: () => void;
  openChangePassword: () => void;
  closeChangePassword: () => void;
  openUserManagement: () => void;
  closeUserManagement: () => void;
  openDocumentHistory: (docId: number) => void;
  closeDocumentHistory: () => void;
}

interface UIContextValue extends UIState, UIActions {}

const UIContext = createContext<UIContextValue | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
  const [trashModalOpen, setTrashModalOpen] = useState(false);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [userManagementOpen, setUserManagementOpen] = useState(false);
  const [documentHistoryOpen, setDocumentHistoryOpen] = useState(false);
  const [documentHistoryDocId, setDocumentHistoryDocId] = useState<number | null>(null);

  const value: UIContextValue = {
    // State
    trashModalOpen,
    changePasswordOpen,
    userManagementOpen,
    documentHistoryOpen,
    documentHistoryDocId,
    // Actions
    openTrashModal: () => setTrashModalOpen(true),
    closeTrashModal: () => setTrashModalOpen(false),
    openChangePassword: () => setChangePasswordOpen(true),
    closeChangePassword: () => setChangePasswordOpen(false),
    openUserManagement: () => setUserManagementOpen(true),
    closeUserManagement: () => setUserManagementOpen(false),
    openDocumentHistory: (docId: number) => {
      setDocumentHistoryDocId(docId);
      setDocumentHistoryOpen(true);
    },
    closeDocumentHistory: () => {
      setDocumentHistoryOpen(false);
      setDocumentHistoryDocId(null);
    },
  };

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI() {
  const context = useContext(UIContext);
  if (!context) {
    throw new Error('useUI must be used within UIProvider');
  }
  return context;
}
```

**步骤 4：重构 App.tsx**

```tsx
// frontend/src/App.tsx (重构后 ~300 行)
import { CategoryProvider } from '@/contexts/CategoryContext';
import { DocumentProvider } from '@/contexts/DocumentContext';
import { UIProvider } from '@/contexts/UIContext';
import { AppLayout } from '@/components/AppLayout';

function App() {
  return (
    <UIProvider>
      <CategoryProvider>
        <DocumentProvider>
          <AppLayout />
        </DocumentProvider>
      </CategoryProvider>
    </UIProvider>
  );
}

export default App;
```

```tsx
// frontend/src/components/AppLayout.tsx
import { Layout } from 'antd';
import { CategoryTreePanel } from '@/features/categories';
import { DocumentPanel } from '@/features/documents';
import { TrashModal } from '@/features/trash';
import { ChangePasswordModal } from '@/features/auth';
import { UserManagementDrawer } from '@/features/users';
import { useCategorySelection } from '@/contexts/CategoryContext';
import { useUI } from '@/contexts/UIContext';

export function AppLayout() {
  const { selectedIds } = useCategorySelection();
  const {
    trashModalOpen,
    closeTrashModal,
    changePasswordOpen,
    closeChangePassword,
    userManagementOpen,
    closeUserManagement
  } = useUI();

  const selectedNodeId = selectedIds.length === 1 ? selectedIds[0] : null;

  return (
    <Layout style={{ height: '100vh' }}>
      <Layout.Sider width={350} theme="light" style={{ borderRight: '1px solid #d9d9d9' }}>
        <CategoryTreePanel />
      </Layout.Sider>

      <Layout.Content>
        <DocumentPanel selectedNodeId={selectedNodeId} />
      </Layout.Content>

      <TrashModal open={trashModalOpen} onClose={closeTrashModal} />
      <ChangePasswordModal open={changePasswordOpen} onClose={closeChangePassword} />
      <UserManagementDrawer open={userManagementOpen} onClose={closeUserManagement} />
    </Layout>
  );
}
```

**工作量估算：** 1-2 天
**收益：**
- 代码从 1,186 行减少到 ~300 行
- 状态管理清晰，易于维护
- 提高组件可测试性
- 减少不必要的重渲染

---

### 3. 错误处理不一致 🔴

**影响范围：** 整个后端 API 层

**问题描述：**
- 所有错误都返回 502 Bad Gateway，不区分错误类型
- 错误消息格式不一致
- 缺少错误代码用于前端处理

**当前代码：**
```go
// ❌ 所有错误都是 502
if err != nil {
    respondError(w, http.StatusBadGateway, err)
    return
}
```

**重构方案：**

```go
// backend/internal/api/errors.go
package api

import (
    "errors"
    "fmt"
    "net/http"
)

// ErrorCode 定义错误代码
type ErrorCode string

const (
    ErrCodeValidation     ErrorCode = "VALIDATION_ERROR"
    ErrCodeNotFound       ErrorCode = "NOT_FOUND"
    ErrCodeUnauthorized   ErrorCode = "UNAUTHORIZED"
    ErrCodeForbidden      ErrorCode = "FORBIDDEN"
    ErrCodeConflict       ErrorCode = "CONFLICT"
    ErrCodeUpstream       ErrorCode = "UPSTREAM_ERROR"
    ErrCodeInternal       ErrorCode = "INTERNAL_ERROR"
)

// APIError 统一的错误结构
type APIError struct {
    Code       ErrorCode `json:"code"`
    Message    string    `json:"message"`
    Details    string    `json:"details,omitempty"`
    StatusCode int       `json:"-"`
}

func (e *APIError) Error() string {
    return e.Message
}

// 预定义的错误
var (
    ErrCategoryNotFound = &APIError{
        Code:       ErrCodeNotFound,
        Message:    "分类不存在",
        StatusCode: http.StatusNotFound,
    }

    ErrCategoryHasChildren = &APIError{
        Code:       ErrCodeConflict,
        Message:    "无法删除包含子分类的分类",
        StatusCode: http.StatusConflict,
    }

    ErrInvalidDocumentType = func(docType string) *APIError {
        return &APIError{
            Code:       ErrCodeValidation,
            Message:    "无效的文档类型",
            Details:    fmt.Sprintf("文档类型 '%s' 不支持", docType),
            StatusCode: http.StatusBadRequest,
        }
    }

    ErrProofreaderCannotCreate = &APIError{
        Code:       ErrCodeForbidden,
        Message:    "校对员无法创建内容",
        Details:    "只有编辑员和管理员可以创建文档和分类",
        StatusCode: http.StatusForbidden,
    }
)

// respondAPIError 统一的错误响应
func respondAPIError(w http.ResponseWriter, err error) {
    var apiErr *APIError

    if errors.As(err, &apiErr) {
        writeJSON(w, apiErr.StatusCode, apiErr)
        return
    }

    // 未知错误，返回 500
    genericErr := &APIError{
        Code:       ErrCodeInternal,
        Message:    "服务器内部错误",
        StatusCode: http.StatusInternalServerError,
    }
    writeJSON(w, genericErr.StatusCode, genericErr)
}

// wrapUpstreamError 包装上游服务错误
func wrapUpstreamError(err error) *APIError {
    return &APIError{
        Code:       ErrCodeUpstream,
        Message:    "上游服务错误",
        Details:    err.Error(),
        StatusCode: http.StatusBadGateway,
    }
}
```

**使用示例：**
```go
// 在处理器中
if err != nil {
    if errors.Is(err, service.ErrNotFound) {
        respondAPIError(w, ErrCategoryNotFound)
        return
    }
    respondAPIError(w, wrapUpstreamError(err))
    return
}

// 权限检查
if user.Role == "proofreader" {
    respondAPIError(w, ErrProofreaderCannotCreate)
    return
}
```

**前端处理：**
```tsx
// frontend/src/api/http.ts
interface APIError {
  code: string;
  message: string;
  details?: string;
}

// 在响应拦截器中
if (!response.ok) {
  const error: APIError = await response.json();

  // 根据错误代码显示不同的消息
  switch (error.code) {
    case 'VALIDATION_ERROR':
      message.error(`验证失败: ${error.message}`);
      break;
    case 'NOT_FOUND':
      message.error(error.message);
      break;
    case 'FORBIDDEN':
      message.error(error.message);
      if (error.details) {
        console.info(error.details);
      }
      break;
    default:
      message.error('操作失败，请重试');
  }

  throw error;
}
```

**工作量估算：** 4-6 小时
**收益：**
- 更好的错误处理用户体验
- 前端可以根据错误代码做特定处理
- 便于调试和监控

---

## 中优先级问题

> 建议在 3 个月内完成

### 4. 路由逻辑过于复杂 🟡

**影响范围：** `backend/internal/api/router.go` 和 `handler.go`

**问题描述：**
手动字符串解析路由，难以维护：

```go
func (h *Handler) CategoryRoutes(w http.ResponseWriter, r *http.Request) {
    relPath := strings.TrimPrefix(r.URL.Path, "/api/v1/categories/")

    if relPath == "" {
        h.Categories(w, r)
        return
    }

    if relPath == "reorder" {
        h.reorderCategories(w, r, h.metaFromRequest(r))
        return
    }

    // 多层嵌套的 if-else...
}
```

**重构方案：**

使用 `chi` 路由库（轻量级，与标准库兼容）：

```bash
# 添加依赖
cd backend
go get github.com/go-chi/chi/v5
```

```go
// backend/internal/api/router.go
package api

import (
    "github.com/go-chi/chi/v5"
    "github.com/go-chi/chi/v5/middleware"
)

func NewRouter(handler *Handler, authMiddleware *auth.Middleware) *chi.Mux {
    r := chi.NewRouter()

    // 全局中间件
    r.Use(middleware.Logger)
    r.Use(middleware.Recoverer)
    r.Use(middleware.RequestID)

    // 公开路由
    r.Group(func(r chi.Router) {
        r.Post("/api/v1/auth/login", handler.Login)
    })

    // 需要认证的路由
    r.Group(func(r chi.Router) {
        r.Use(authMiddleware.Authenticate)

        // 分类路由
        r.Route("/api/v1/categories", func(r chi.Router) {
            r.Get("/", handler.ListCategories)
            r.Post("/", handler.CreateCategory)
            r.Get("/tree", handler.GetCategoryTree)
            r.Get("/trash", handler.ListDeletedCategories)
            r.Post("/reorder", handler.ReorderCategories)

            // 批量操作
            r.Route("/bulk", func(r chi.Router) {
                r.Post("/check", handler.BulkCheckCategories)
                r.Post("/restore", handler.BulkRestoreCategories)
                r.Post("/delete", handler.BulkDeleteCategories)
                r.Post("/purge", handler.BulkPurgeCategories)
                r.Post("/copy", handler.BulkCopyCategories)
                r.Post("/move", handler.BulkMoveCategories)
            })

            // 单个分类操作
            r.Route("/{id}", func(r chi.Router) {
                r.Get("/", handler.GetCategory)
                r.Put("/", handler.UpdateCategory)
                r.Delete("/", handler.DeleteCategory)
                r.Patch("/reposition", handler.RepositionCategory)
                r.Post("/restore", handler.RestoreCategory)
                r.Delete("/purge", handler.PurgeCategory)
            })
        })

        // 文档路由
        r.Route("/api/v1/documents", func(r chi.Router) {
            r.Get("/", handler.ListDocuments)
            r.Post("/", handler.CreateDocument)
            r.Get("/trash", handler.ListDeletedDocuments)

            r.Route("/{id}", func(r chi.Router) {
                r.Get("/", handler.GetDocument)
                r.Put("/", handler.UpdateDocument)
                r.Delete("/", handler.DeleteDocument)
                r.Post("/restore", handler.RestoreDocument)
                r.Delete("/purge", handler.PurgeDocument)
                r.Get("/history", handler.GetDocumentHistory)
            })
        })

        // 节点文档关系
        r.Route("/api/v1/nodes/{node_id}", func(r chi.Router) {
            r.Get("/documents", handler.GetNodeDocuments)
            r.Get("/subtree-documents", handler.GetSubtreeDocuments)

            r.Route("/documents/{doc_id}", func(r chi.Router) {
                r.Post("/", handler.BindDocument)
                r.Delete("/", handler.UnbindDocument)
            })
        })

        // 用户管理（仅超级管理员）
        r.Route("/api/v1/users", func(r chi.Router) {
            r.Use(handler.requirePermission("super_admin"))

            r.Get("/", handler.ListUsers)
            r.Post("/", handler.CreateUser)

            r.Route("/{id}", func(r chi.Router) {
                r.Get("/", handler.GetUser)
                r.Delete("/", handler.DeleteUser)

                r.Route("/courses", func(r chi.Router) {
                    r.Get("/", handler.GetUserCourses)
                    r.Post("/", handler.GrantCoursePermission)
                    r.Delete("/{node_id}", handler.RevokeCoursePermission)
                })
            })
        })
    })

    return r
}
```

```go
// backend/cmd/server/main.go
func main() {
    // ... 初始化代码

    router := api.NewRouter(handler, authMiddleware)

    log.Printf("backend listening on :%s", config.HTTPPort)
    if err := http.ListenAndServe(":"+config.HTTPPort, router); err != nil {
        log.Fatal(err)
    }
}
```

**优势：**
- 路由定义清晰易读
- 支持路由组和子路由
- 内置中间件支持
- URL 参数自动解析
- RESTful 设计更规范

**工作量估算：** 2-3 天
**收益：** 大幅提高路由代码可读性和可维护性

---

### 5. DocumentEditor 组件过大 🟡

**影响范围：** `frontend/src/features/documents/components/DocumentEditor.tsx` (766 行)

**问题描述：**
组件职责过多，包含：
- 表单状态管理
- 内容编辑（Monaco Editor）
- 元数据编辑
- 预览逻辑
- 保存/删除操作
- 文档绑定/解绑

**重构方案：**

将组件分解为多个子组件：

```tsx
// frontend/src/features/documents/components/DocumentEditor/index.tsx
import { DocumentFormSection } from './DocumentFormSection';
import { DocumentContentEditor } from './DocumentContentEditor';
import { DocumentMetadataEditor } from './DocumentMetadataEditor';
import { DocumentPreview } from './DocumentPreview';
import { useDocumentForm } from './useDocumentForm';

export function DocumentEditor({ documentId, nodeId, onSave, onClose }: Props) {
  const {
    form,
    content,
    setContent,
    metadata,
    setMetadata,
    isLoading,
    handleSubmit,
  } = useDocumentForm(documentId, onSave);

  return (
    <div className="document-editor">
      <DocumentFormSection form={form} />

      <DocumentContentEditor
        type={form.getFieldValue('type')}
        content={content}
        onChange={setContent}
      />

      <DocumentMetadataEditor
        metadata={metadata}
        onChange={setMetadata}
      />

      <DocumentPreview
        type={form.getFieldValue('type')}
        content={content}
      />

      <div className="editor-actions">
        <Button onClick={onClose}>取消</Button>
        <Button type="primary" onClick={handleSubmit} loading={isLoading}>
          保存
        </Button>
      </div>
    </div>
  );
}
```

```tsx
// frontend/src/features/documents/components/DocumentEditor/useDocumentForm.ts
import { useState, useEffect } from 'react';
import { Form } from 'antd';
import type { Document } from '@/api/documents';

export function useDocumentForm(documentId: number | null, onSave: () => void) {
  const [form] = Form.useForm();
  const [content, setContent] = useState('');
  const [metadata, setMetadata] = useState<Record<string, unknown>>({});
  const [isLoading, setIsLoading] = useState(false);

  // 加载文档数据
  useEffect(() => {
    if (documentId) {
      loadDocument(documentId);
    }
  }, [documentId]);

  const loadDocument = async (id: number) => {
    // 加载逻辑
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      const values = await form.validateFields();
      // 保存逻辑
      onSave();
    } catch (error) {
      console.error('保存失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    form,
    content,
    setContent,
    metadata,
    setMetadata,
    isLoading,
    handleSubmit,
  };
}
```

**工作量估算：** 3-4 小时
**收益：**
- 每个子组件职责单一，易于理解
- 提高组件复用性
- 便于单独测试

---

### 6. 类型定义不完整 🟡

**影响范围：** 整个前端 API 层

**问题描述：**
```tsx
// ❌ 类型过于宽泛
export interface Document {
  content?: Record<string, unknown>;
  metadata: Record<string, unknown>;
}
```

**重构方案：**

```tsx
// frontend/src/api/documents/types.ts

// 文档类型枚举
export type DocumentType =
  | 'overview'
  | 'dictation'
  | 'comprehensive_choice'
  | 'case_analysis'
  | 'essay';

// 内容格式
export type ContentFormat = 'html' | 'yaml';

// 文档内容结构
export interface DocumentContent {
  format: ContentFormat;
  data: string;
}

// 文档元数据（根据文档类型有不同的字段）
export interface DocumentMetadata {
  difficulty?: 1 | 2 | 3 | 4 | 5;
  tags?: string[];
  [key: string]: unknown; // 允许扩展字段
}

// 听写练习的元数据
export interface DictationMetadata extends DocumentMetadata {
  word_count?: number;
  duration_minutes?: number;
}

// 选择题的元数据
export interface ComprehensiveChoiceMetadata extends DocumentMetadata {
  question_count?: number;
  time_limit_minutes?: number;
}

// 完整的文档接口
export interface Document {
  id: number;
  title: string;
  version_number?: number | null;
  type: DocumentType;
  position: number;
  content: DocumentContent;
  metadata: DocumentMetadata;
  created_by: string;
  updated_by: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// 类型守卫
export function isDictation(doc: Document): doc is Document & { metadata: DictationMetadata } {
  return doc.type === 'dictation';
}

export function isComprehensiveChoice(doc: Document): doc is Document & { metadata: ComprehensiveChoiceMetadata } {
  return doc.type === 'comprehensive_choice';
}
```

**使用示例：**
```tsx
// 在组件中使用类型守卫
function DocumentMetadataForm({ document }: { document: Document }) {
  if (isDictation(document)) {
    // TypeScript 知道这里的 metadata 是 DictationMetadata
    return (
      <div>
        <Input
          label="词数"
          value={document.metadata.word_count}
        />
        <Input
          label="时长（分钟）"
          value={document.metadata.duration_minutes}
        />
      </div>
    );
  }

  if (isComprehensiveChoice(document)) {
    // TypeScript 知道这里的 metadata 是 ComprehensiveChoiceMetadata
    return (
      <div>
        <Input
          label="题目数量"
          value={document.metadata.question_count}
        />
      </div>
    );
  }

  // 通用元数据表单
  return <GenericMetadataForm metadata={document.metadata} />;
}
```

**工作量估算：** 6-8 小时
**收益：**
- 更好的类型安全
- IDE 自动补全更准确
- 减少类型相关的 bug

---

## 低优先级问题

> 作为持续改进的一部分

### 7. 硬编码值 🟢

**问题位置：**
- 分页默认值：多处硬编码为 `20`
- NDR 请求大小：硬编码为 `100`
- 超时时间：未配置

**重构方案：**

```go
// backend/internal/config/defaults.go
package config

type Defaults struct {
    Pagination PaginationDefaults
    NDR        NDRDefaults
    Timeouts   TimeoutDefaults
}

type PaginationDefaults struct {
    DefaultPage int
    DefaultSize int
    MaxSize     int
}

type NDRDefaults struct {
    FetchSize int
}

type TimeoutDefaults struct {
    ReadTimeout  int // 秒
    WriteTimeout int // 秒
}

func DefaultConfig() Defaults {
    return Defaults{
        Pagination: PaginationDefaults{
            DefaultPage: 1,
            DefaultSize: 20,
            MaxSize:     100,
        },
        NDR: NDRDefaults{
            FetchSize: 100,
        },
        Timeouts: TimeoutDefaults{
            ReadTimeout:  30,
            WriteTimeout: 30,
        },
    }
}
```

**前端配置：**
```tsx
// frontend/src/config/constants.ts
export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_SIZE: 20,
  MAX_SIZE: 100,

  DOCUMENT_TRASH_SIZE: 20,
  DOCUMENT_HISTORY_SIZE: 10,
  CATEGORY_TRASH_SIZE: 20,
} as const;

export const API = {
  BASE_URL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  TIMEOUT: 30000, // 30秒
} as const;

export const EDITOR = {
  MONACO_THEME: 'vs-dark',
  TAB_SIZE: 2,
  AUTO_SAVE_DELAY: 1000, // 毫秒
} as const;
```

**工作量估算：** 2-3 小时
**收益：** 配置集中管理，易于调整

---

### 8. 文档不足 🟢

**需要添加文档的地方：**

1. **权限系统文档**
   - 角色权限矩阵
   - 课程权限继承规则
   - API 权限要求

2. **复杂算法文档**
   - 分类树聚合逻辑
   - 拖拽排序算法
   - 文档筛选逻辑

3. **API 文档**
   - OpenAPI 规范
   - 请求/响应示例
   - 错误代码说明

**示例：**

```go
// backend/internal/service/permission.go

/*
GetDocumentPermission 获取用户对文档的权限

权限计算规则：
1. super_admin: 对所有文档有完全权限
2. course_admin: 对授权课程下的所有文档有完全权限
3. proofreader: 对授权课程下的所有文档有只读权限
4. editor: 对所有文档有编辑权限

课程权限继承：
- 课程权限以根节点 ID 标识
- 用户对根节点有权限，则对该节点下的所有子节点和文档都有权限
- 文档绑定到节点，通过节点判断文档所属课程

参数：
- ctx: 上下文
- userID: 用户 ID
- role: 用户角色
- nodeID: 文档所在节点 ID

返回：
- *DocumentPermission: 文档权限对象
- error: 错误信息

示例：
    perm, err := service.GetDocumentPermission(ctx, 123, "course_admin", 456)
    if err != nil {
        return err
    }
    if perm.CanWrite {
        // 用户可以编辑文档
    }
*/
func (s *PermissionService) GetDocumentPermission(
    ctx context.Context,
    userID uint,
    role string,
    nodeID int64,
) (*DocumentPermission, error) {
    // 实现...
}
```

**工作量估算：** 持续进行
**收益：** 降低新人上手难度

---

## 实施计划

### 第一阶段（1 周内）- 高优先级

- [ ] 重构权限检查代码（2-3 小时）
- [ ] 统一错误处理机制（4-6 小时）

### 第二阶段（1 个月内）- 高优先级

- [ ] 重构 App.tsx 状态管理（1-2 天）
  - [ ] 创建 CategoryContext
  - [ ] 创建 DocumentContext
  - [ ] 创建 UIContext
  - [ ] 重构 App.tsx

### 第三阶段（3 个月内）- 中优先级

- [ ] 引入 chi 路由库（2-3 天）
- [ ] 分解 DocumentEditor 组件（3-4 小时）
- [ ] 完善 TypeScript 类型定义（6-8 小时）

### 第四阶段（持续进行）- 低优先级

- [ ] 提取硬编码值到配置
- [ ] 补充代码文档和注释
- [ ] 编写开发者指南

---

## 监控和评估

### 代码质量指标

**重构前：**
- 平均文件大小：650 行
- 代码重复率：~15%
- 组件平均 props 数量：12
- 类型覆盖率：~60%

**重构后目标：**
- 平均文件大小：< 400 行
- 代码重复率：< 5%
- 组件平均 props 数量：< 8
- 类型覆盖率：> 90%

### 性能指标

- 首次渲染时间
- 组件重渲染次数
- API 响应时间
- 构建时间

---

## 附录

### 相关文档

- [CLAUDE.md](./CLAUDE.md) - 项目开发指南
- [REFACTORING_SUMMARY.md](./REFACTORING_SUMMARY.md) - 文档类型重构总结
- `docs/MAINTENANCE_GUIDE.md` - 数据库重置与维护

### 参考资源

- [Go 最佳实践](https://golang.org/doc/effective_go)
- [React 组件设计模式](https://reactpatterns.com/)
- [TypeScript 类型系统](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)
- [chi 路由库文档](https://github.com/go-chi/chi)
