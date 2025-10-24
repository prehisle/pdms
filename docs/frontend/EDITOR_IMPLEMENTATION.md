# 文档编辑器实现说明

## 功能概览

已成功实现基于 Monaco Editor 的全屏文档编辑器，支持实时预览。

## 技术架构

### 核心依赖
- `@monaco-editor/react` - VSCode 级别的代码编辑器
- `js-yaml` - YAML 解析库
- `dompurify` - HTML 安全净化
- `react-router-dom` - 路由管理

### 组件结构

```
DocumentEditor (全屏编辑页面)
├── Header (顶部操作栏)
│   ├── 文档标题输入
│   ├── 类型选择器
│   ├── 位置输入
│   └── 保存/取消按钮
│
├── 左侧: Monaco Editor
│   ├── HTML 语法高亮 (overview)
│   ├── YAML 语法高亮 (其他类型)
│   ├── 自动补全
│   └── Minimap
│
└── 右侧: 实时预览
    ├── HTMLPreview (概览类型)
    └── YAMLPreview (其他类型)
        ├── DictationPreview (默写)
        ├── ComprehensiveChoicePreview (综合选择题)
        ├── CaseAnalysisPreview (案例分析)
        └── EssayPreview (论文题)
```

## 路由配置

- `/` - 主界面（文档列表）
- `/documents/new?nodeId=xxx` - 新建文档
- `/documents/:docId/edit` - 编辑文档

## 使用方式

### 新建文档
1. 在主界面选择节点
2. 点击"新增文档"按钮
3. 自动跳转到全屏编辑器
4. 选择文档类型后自动填充模板
5. 编辑内容，右侧实时预览
6. 按 `Ctrl+S` 或点击保存按钮

### 编辑文档
1. 在文档列表点击编辑图标
2. 自动加载文档内容
3. 修改后保存
4. 按 `Esc` 或点击取消返回

## 快捷键

- `Ctrl+S` / `Cmd+S` - 保存文档
- `Esc` - 取消并返回

## 预览功能

### HTML 预览（概览类型）
- 自动净化 HTML，防止 XSS
- 支持样式渲染
- 支持常用 HTML 标签

### YAML 预览（其他类型）

#### 默写题
- 显示题目信息、难度、分值
- 显示默写内容和拼音
- 显示提示信息
- 显示标准答案

#### 综合选择题
- 显示题干和题目描述
- 分空显示选项
- 高亮正确答案
- 显示解析

#### 案例分析题
- 显示案例背景
- 按问题分组展示
- 显示参考答案和评分标准

#### 论文题
- 显示主题和要求
- 显示字数限制
- 显示结构建议
- 显示评分标准

## 性能优化

### 代码分割
通过 Vite 配置实现了智能代码分割：

**优化前：**
- 单一 bundle: ~1.27MB (gzip: 404KB)

**优化后：**
- monaco-editor: 23.21KB (gzip: 8.23KB)
- yaml-parser: 39.77KB (gzip: 13.48KB)
- html-sanitizer: 22.56KB (gzip: 8.74KB)
- react-vendor: 168.06KB (gzip: 55.52KB)
- antd-vendor: 911.48KB (gzip: 284KB)
- DocumentEditor: 16.10KB (gzip: 5.57KB) - **懒加载**

### 懒加载
- 编辑器组件使用 `React.lazy()` 懒加载
- 只在访问编辑页面时加载 Monaco Editor
- 主界面加载速度不受影响

### 防抖优化
- 编辑器内容变化防抖（可选，已在代码中预留）
- 避免频繁触发预览更新

## 安全性

### HTML 净化
使用 DOMPurify 过滤危险标签和属性：
- 白名单机制
- 防止 XSS 攻击
- 允许安全的样式和属性

### YAML 解析
- 捕获解析错误
- 友好的错误提示
- 避免恶意 YAML 注入

## 数据格式

### 创建/更新文档
```typescript
{
  title: "文档标题",
  type: "overview" | "dictation" | "comprehensive_choice" | "case_analysis" | "essay",
  position: 1,
  content: {
    format: "html" | "yaml",
    data: "实际内容"
  }
}
```

## 后续优化建议

### 短期优化
1. ✅ 添加自动保存草稿（localStorage）
2. ✅ 添加撤销/重做功能（Monaco 已内置）
3. ⬜ 添加模板快捷插入侧边栏
4. ⬜ 添加 YAML 语法校验提示

### 中期优化
1. ⬜ 实现文档版本对比（Monaco diff editor）
2. ⬜ 添加协作编辑（WebSocket）
3. ⬜ 添加导入/导出功能（Markdown, Word）
4. ⬜ 添加图片上传和管理

### 长期优化
1. ⬜ AI 辅助内容生成
2. ⬜ 智能题目推荐
3. ⬜ 批量导入题库
4. ⬜ 多人实时协作

## 文件清单

### 新增文件
- `frontend/src/features/documents/components/DocumentEditor.tsx` - 编辑器主页面
- `frontend/src/features/documents/components/HTMLPreview.tsx` - HTML 预览
- `frontend/src/features/documents/components/YAMLPreview.tsx` - YAML 预览
- `frontend/src/AppRoutes.tsx` - 路由配置
- `frontend/src/features/documents/templates.ts` - 文档模板（已有）

### 修改文件
- `frontend/src/main.tsx` - 使用路由包装
- `frontend/src/App.tsx` - 修改新建/编辑逻辑，使用路由跳转
- `frontend/vite.config.ts` - 添加代码分割配置

## 总结

✅ 已完成所有功能：
1. ✅ Monaco Editor 集成
2. ✅ 全屏编辑界面
3. ✅ 实时预览（HTML + YAML）
4. ✅ 5种文档类型的专业预览
5. ✅ 路由配置
6. ✅ 代码分割优化
7. ✅ 快捷键支持
8. ✅ 安全防护

构建结果：
- ✅ 前端构建成功
- ✅ 代码分割生效
- ✅ 包体积优化显著
