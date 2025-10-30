# 数据库重置指南（已合并）

本内容已并入维护文档：`docs/MAINTENANCE_GUIDE.md` 的“数据库重置与恢复”章节。

快速指令：

```bash
make quick-reset   # 清空数据保留结构
make reset-init    # 重建数据库与结构
```

如需进阶（备份/恢复/手动清表）示例，请参考维护文档；后续更新将以维护文档为准。

---

## 📂 相关文件

- [scripts/quick-reset.sh](scripts/quick-reset.sh) - 快速重置脚本
- [scripts/reset-and-init.sh](scripts/reset-and-init.sh) - 完整重置脚本
- [backend/cmd/reset-db/main.go](backend/cmd/reset-db/main.go) - Go 重置工具
- [scripts/README.md](scripts/README.md) - 详细文档
- [Makefile](Makefile) - 项目命令定义

---

## 💡 推荐工作流

日常开发：

```bash
# 早上开始
make quick-reset      # 清理昨天的测试数据
make dev-backend      # 启动后端
make dev-frontend     # 启动前端

# 开发中...

# 测试前
make quick-reset      # 重置到干净状态
make test-e2e         # 运行测试

# 下班前
# 无需清理，明天再重置
```

---

如有问题，请查看 [scripts/README.md](scripts/README.md) 了解更多详情。
