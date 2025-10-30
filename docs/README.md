 # 文档索引（Docs Index）

 这是 YDMS 的文档入口与导航。建议按“入门 → 开发 → API/架构 → 运维”的顺序阅读。

 ## 入门（Getting Started）
 - 后端入门与命令：`../backend/README.md`
 - 前端入门与命令：`../frontend/README.md`
 - 文档类型配置与代码生成：`../doc-types/README.md`
 - 常用命令与一键帮助：在项目根目录执行 `make help`

 ## 开发（Development）
 - 进度与迭代计划：`backend/当前进度与待办.md`
 - 项目规划与技术方案：`backend/项目规划与方案.md`

## API（OpenAPI 与用法）
- OpenAPI 规范（JSON）：`backend/openapi.json`
- API 使用指南（cURL 示例与鉴权）：`api/usage.md`
- 在线预览（Redoc）：`api/index.html`

## 架构（Architecture）
- 文档类型系统与扩展点：`../doc-types/README.md`
- 服务结构与模块说明：`../backend/README.md`
- 架构概览与关键流程：`architecture/overview.md`
- 权限矩阵与请求头：`architecture/permissions.md`

## 运维（Operations）
- Docker 部署指南：`DOCKER_DEPLOYMENT.md`
- 生产环境部署：`../deploy/production/README.md`
- 维护与巡检：`MAINTENANCE_GUIDE.md`
- 数据库重置与故障排除：`../DATABASE_RESET.md`

## 文档工具
- 检查 Markdown 内部链接：在项目根目录执行 `make docs-check`
- 运行 markdownlint（若已安装）：`make docs-lint`

## 指南（Guides）
- API Keys 指南（权威）：`guides/api-keys.md`
- 历史与实现文档：
  - `API_KEY_GUIDE.md`
  - `API_KEY_FRONTEND_GUIDE.md`
  - `API_KEY_COMPLETE_GUIDE.md`
  - `API_KEY_IMPLEMENTATION_SUMMARY.md`
- 文档引用功能说明（前端）：`../frontend/文档引用功能使用说明.md`

 ## 汇报与问题（Reports & Issues）
 - 进展报告：`PROGRESS_REPORT.md`
 - 当前问题清单：`CURRENT_ISSUES.md`

 —— 如需新增文档，请按以上分组放置并在此处添加索引。
