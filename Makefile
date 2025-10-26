.PHONY: help quick-reset reset-db reset-init test-e2e dev clean

help: ## 显示帮助信息
	@echo "YDMS 项目命令"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

quick-reset: ## 快速重置（仅清空数据，推荐）
	@./scripts/quick-reset.sh

reset-db: ## 重置数据库（删除所有数据）
	@./scripts/reset-db.sh

reset-init: ## 完整重置并初始化（重建数据库）
	@./scripts/reset-and-init.sh

dev-backend: ## 启动后端开发服务器
	@cd backend && go run ./cmd/server --watch

dev-frontend: ## 启动前端开发服务器
	@cd frontend && npm run dev

test-backend: ## 运行后端测试
	@cd backend && go test ./... -cover

test-e2e: ## 运行 E2E 测试
	@cd frontend && npx playwright test --reporter=list

test-e2e-ui: ## 运行 E2E 测试（UI 模式）
	@cd frontend && npx playwright test --ui

clean: ## 清理临时文件
	@rm -rf backend/tmp backend/server.log
	@rm -rf frontend/dist frontend/node_modules/.vite
	@echo "清理完成"

install-frontend: ## 安装前端依赖
	@cd frontend && npm install

install-backend: ## 安装后端依赖
	@cd backend && go mod tidy

install: install-backend install-frontend ## 安装所有依赖
