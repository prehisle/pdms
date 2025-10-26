# 文档类型重构总结

## ✅ 已完成的工作

### 后端重构
1. ✅ 创建新的文档类型系统 (`document_types.go`)
   - 定义5种文档类型：overview, dictation, comprehensive_choice, case_analysis, essay
   - 定义内容格式：HTML 和 YAML
   - 实现完整的验证逻辑

2. ✅ 扩展 documents.go
   - CreateDocument 添加类型和内容验证
   - UpdateDocument 添加类型和内容验证

3. ✅ 删除 materials 和 relationships
   - 删除 materials.go (396行)
   - 删除 relationships.go (135行)
   - 从 handler.go 删除 Materials 和 Relationships handlers (168行)
   - 从 router.go 删除相关路由 (3条)

### 前端重构
1. ✅ 删除 materials 模块
   - 删除 src/api/materials.ts
   - 删除 src/api/relationships.ts
   - 删除 src/features/materials/ 整个目录

2. ✅ 更新 documents.ts
   - 定义新的文档类型常量 (DOCUMENT_TYPES)
   - 定义内容格式常量 (CONTENT_FORMATS)
   - 定义 DocumentContent 结构

3. ✅ 更新 App.tsx
   - 移除 Tabs 组件
   - 移除 MaterialPanel
   - 恢复简单的文档管理界面

## ✅ 测试状态

所有后端测试已通过，包括：
- API 处理器测试（`internal/api/*_test.go`）
- 服务层测试（`internal/service/*_test.go`）
- NDR 客户端测试（`internal/ndrclient/*_test.go`）

所有测试已更新为使用新的文档类型系统（overview, dictation, comprehensive_choice, case_analysis, essay）。

## 📋 待办任务

### 2. 前端表单组件扩展 (已规划，未实现)
由于时间限制，DocumentForm 组件尚未扩展以支持新的文档类型。需要：
- 根据文档类型动态渲染表单字段
- HTML 编辑器（for overview）
- YAML 编辑器（for dictation, comprehensive_choice, case_analysis, essay）
- 元数据编辑（difficulty, tags等）

### 3. 文档预览组件 (已规划，未实现)
需要扩展 DocumentPreview 组件以正确显示不同格式的内容。

## 🎯 下一步行动

1. **实现前端表单组件**: 扩展 DocumentForm 以支持不同文档类型的动态表单渲染
2. **实现前端预览组件**: 扩展 DocumentPreview 以正确显示不同格式的内容
3. **用户体验优化**: 完善文档类型切换和编辑体验

## 📊 代码统计

**删除代码:**
- 后端：~700行 (materials.go + relationships.go + handlers)
- 前端：~1000行 (整个 materials 模块)

**新增代码:**
- 后端：~150行 (document_types.go + 验证逻辑)
- 前端：~40行 (新类型定义)

**净减少：** ~1500行代码

## 🐛 Bug 修复记录

### 2025-10-26: 课程权限管理 Bug 修复

**问题描述：**
1. 超级管理员无法给校对员（proofreader）授权课程
2. 不同用户的课程权限在 UI 上互相干扰
3. 每次打开课程权限模态框时，已授权课程显示为空

**根本原因：**
1. 前端仅为 `course_admin` 角色显示"课程权限"按钮，排除了 `proofreader`
2. `UserPermissionsModal` 组件的 `useEffect` 依赖不完整，导致切换用户时状态未重置
3. 后端 API 返回字段名 `courses` 与前端期待的 `course_ids` 不匹配

**修复方案：**

1. **前端修复** ([UserManagementDrawer.tsx:141-145](frontend/src/features/users/UserManagementDrawer.tsx#L141-L145))
   ```typescript
   // 扩展权限检查以包含 proofreader
   const canManagePermissions =
     currentUser?.role === "super_admin" &&
     (record.role === "course_admin" || record.role === "proofreader");
   ```

2. **前端修复** ([UserPermissionsModal.tsx:77-90](frontend/src/features/users/components/UserPermissionsModal.tsx#L77-L90))
   ```typescript
   // 增强 useEffect 依赖和状态重置逻辑
   useEffect(() => {
     if (!open || userId === null) {
       setTargetKeys([]);
       return;
     }

     if (userCourses?.course_ids) {
       setTargetKeys(userCourses.course_ids.map(String));
     } else {
       setTargetKeys([]);
     }
   }, [userCourses, userId, open]); // 添加 open 和 userId 到依赖
   ```

3. **后端修复** ([user_handler.go:337](backend/internal/api/user_handler.go#L337))
   ```go
   // 统一 API 响应字段名
   writeJSON(w, http.StatusOK, map[string]interface{}{
       "course_ids": courses, // 之前是 "courses"
   })
   ```

**影响范围：**
- ✅ 超级管理员现在可以给校对员授权课程
- ✅ 切换不同用户时，课程权限正确隔离显示
- ✅ 已授权课程正确加载和显示

**测试验证：**
- 手动测试通过，课程权限功能正常工作
