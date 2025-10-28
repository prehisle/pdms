# 文档类型配置说明

`doc-types/` 目录中的每个子目录都代表 YDMS 支持的一种文档类型。

```
doc-types/
  config.yaml          # 已启用类型及其元信息的总清单
  <type-id>/
    template.yaml|html # 配置引用的默认内容模板
    backend/           # （可选）该类型专属的后端钩子或资源
    frontend/          # （可选）该类型专属的前端钩子或资源
```

## 新增文档类型

1. 运行 `scripts/add-doc-type.sh <type-id> "<Label>" <format>` 生成目录与模板示例；也可以手动创建。
2. 在 `config.yaml` 中追加配置信息（id、label、format、template 等）。如需自动挂载钩子，可同时声明：
   ```yaml
   backend:
     hook_import: "github.com/yjxt/ydms/backend/internal/service/documents/types/<type-id>"
   frontend:
     hook_import: "../features/documents/typePlugins/<type-id>/register"
      themes:
        - id: "glass"
          label: "玻璃拟态"
          description: "可选，显示在主题下拉框中的备注"
          path: "../overview_themes/glass.css"   # 相对于 <type-id>/ 目录
   ```
3. 执行 `make generate-doc-types`，让前后端注册表同步最新配置。
4. 在 `backend.hook_import` 指向的模块中补充后端逻辑（例如调用 `service.RegisterDocumentTypeHooks`）；
   在 `frontend/src/features/documents/typePlugins/<type>/register.tsx`（或 `frontend.hook_import` 指向的模块）中实现前端预览/编辑逻辑，并在模块加载时完成注册。
5. 提交前务必运行 `go test ./...` 与 `npm run build`，确保构建通过。
