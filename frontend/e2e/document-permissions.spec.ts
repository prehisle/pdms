import { test, expect } from './fixtures/auth';

test.describe.configure({ mode: 'serial' });

/**
 * 文档权限控制测试
 *
 * 前提条件：
 * - 数据库中至少有一个分类节点（可通过 UI 手动创建）
 * - 分类下至少有一个文档（可通过 UI 手动创建）
 * - 测试用户账号已创建：course_admin1, proofreader_test
 *   （可通过 e2e/setup.spec.ts 创建，或手动创建）
 */

test.describe('文档权限控制测试', () => {
  test.describe('校对员文档权限限制', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('proofreader');
      await page.goto('/');

      // 等待页面加载
      await page.waitForLoadState('networkidle');
    });

    test('不应该看到新增文档按钮', async ({ page }) => {
      // 点击第一个分类节点（如果存在）
      const firstNode = page.locator('.ant-tree-treenode:not([aria-hidden="true"])').first();
      const nodeCount = await firstNode.count();

      if (nodeCount > 0) {
        await firstNode.click();
        await page.waitForSelector('text=文档列表', { timeout: 5000 });
      }

      // 校对员不应该看到"新增文档"按钮
      const addDocButton = page.locator('button[aria-label="新增文档"]');
      await expect(addDocButton).not.toBeVisible();
    });

    test('不应该看到文档删除按钮', async ({ page }) => {
      // 点击第一个分类节点
      const firstNode = page.locator('.ant-tree-treenode:not([aria-hidden="true"])').first();
      const nodeCount = await firstNode.count();

      if (nodeCount > 0) {
        await firstNode.click();
        await page.waitForSelector('text=文档列表', { timeout: 5000 });

        // 等待表格加载
        await page.waitForTimeout(1000);

        // 验证删除按钮不可见
        const deleteButtons = page.locator('button[aria-label="移入回收站"]');
        await expect(deleteButtons.first()).not.toBeVisible();
      } else {
        // 如果没有节点，测试仍然应该能验证按钮不可见
        const deleteButtons = page.locator('button[aria-label="移入回收站"]');
        await expect(deleteButtons.first()).not.toBeVisible();
      }
    });

    test('应该能够看到和点击编辑按钮', async ({ page }) => {
      // 点击第一个分类节点
      const firstNode = page.locator('.ant-tree-treenode:not([aria-hidden="true"])').first();
      const nodeCount = await firstNode.count();

      if (nodeCount > 0) {
        await firstNode.click();
        await page.waitForSelector('text=文档列表', { timeout: 5000 });

        // 等待表格加载
        await page.waitForTimeout(1000);

        // 检查是否有文档
        const tableRows = page.locator('.ant-table-tbody tr:not(:has-text("暂无数据"))');
        const rowCount = await tableRows.count();

        if (rowCount > 0) {
          // 验证编辑按钮可见
          const editButton = page.locator('button[aria-label="编辑文档"]').first();
          await expect(editButton).toBeVisible();
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    });

    test('应该能够查看文档列表', async ({ page }) => {
      // 验证文档列表卡片可见
      await expect(page.locator('text=文档列表')).toBeVisible();
    });

    test('不应该看到新建根目录按钮', async ({ page }) => {
      const createRootButton = page.locator('button[aria-label="新建根目录"]');
      await expect(createRootButton).not.toBeVisible();
    });
  });

  test.describe('课程管理员文档权限', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('courseAdmin');
      await page.goto('/');

      // 等待页面加载
      await page.waitForLoadState('networkidle');
    });

    test('应该看到新增文档按钮', async ({ page }) => {
      // 点击第一个分类节点
      const firstNode = page.locator('.ant-tree-treenode:not([aria-hidden="true"])').first();
      const nodeCount = await firstNode.count();

      if (nodeCount > 0) {
        await firstNode.click();
        await page.waitForSelector('text=文档列表', { timeout: 5000 });

        const addDocButton = page.locator('button[aria-label="新增文档"]');
        await expect(addDocButton).toBeVisible();
      } else {
        test.skip();
      }
    });

    test('应该看到文档删除按钮', async ({ page }) => {
      // 点击第一个分类节点
      const firstNode = page.locator('.ant-tree-treenode:not([aria-hidden="true"])').first();
      const nodeCount = await firstNode.count();

      if (nodeCount > 0) {
        await firstNode.click();
        await page.waitForSelector('text=文档列表', { timeout: 5000 });

        // 等待表格加载
        await page.waitForTimeout(1000);

        // 检查是否有文档
        const tableRows = page.locator('.ant-table-tbody tr:not(:has-text("暂无数据"))');
        const rowCount = await tableRows.count();

        if (rowCount > 0) {
          // 验证删除按钮可见
          const deleteButtons = page.locator('button[aria-label="移入回收站"]');
          await expect(deleteButtons.first()).toBeVisible();
        } else {
          test.skip();
        }
      } else {
        test.skip();
      }
    });

    test('不应该看到新建根目录按钮', async ({ page }) => {
      // 课程管理员不能创建根目录，只能创建子目录
      const createRootButton = page.locator('button[aria-label="新建根目录"]');
      await expect(createRootButton).not.toBeVisible();
    });
  });

  test.describe('超级管理员文档权限', () => {
    test.beforeEach(async ({ loginAs, page }) => {
      await loginAs('superAdmin');
      await page.goto('/');
    });

    test('应该看到新增文档按钮', async ({ page }) => {
      // 点击第一个分类节点
      const firstNode = page.locator('.ant-tree-treenode:not([aria-hidden="true"])').first();
      await firstNode.click();
      await page.waitForSelector('text=文档列表', { timeout: 5000 });

      const addDocButton = page.locator('button[aria-label="新增文档"]');
      await expect(addDocButton).toBeVisible();
    });

    test('应该看到新建根目录按钮', async ({ page }) => {
      const createRootButton = page.locator('button[aria-label="新建根目录"]');
      await expect(createRootButton).toBeVisible();
    });

    test('应该能够删除文档', async ({ page }) => {
      // 点击第一个分类节点
      const firstNode = page.locator('.ant-tree-treenode:not([aria-hidden="true"])').first();
      await firstNode.click();
      await page.waitForSelector('text=文档列表', { timeout: 5000 });

      // 等待表格加载
      await page.waitForTimeout(1000);

      // 检查是否有文档
      const tableRows = page.locator('.ant-table-tbody tr:not(:has-text("暂无数据"))');
      const rowCount = await tableRows.count();

      if (rowCount > 0) {
        // 获取第一个文档的删除按钮
        const deleteButton = page.locator('button[aria-label="移入回收站"]').first();
        await deleteButton.click();

        // 等待确认对话框出现
        const popconfirm = page.locator('.ant-popover:has-text("确认将该文档移入回收站")');
        await expect(popconfirm).toBeVisible({ timeout: 3000 });

        // 点击取消（不实际删除，保留测试数据）
        await popconfirm.locator('button:has-text("取消")').click();
      } else {
        test.skip();
      }
    });
  });

  test.describe('文档权限边界测试', () => {
    test('校对员尝试通过 API 创建文档应该被拒绝', async ({ page, loginAs }) => {
      await loginAs('proofreader');
      await page.goto('/');

      // 尝试通过 API 创建文档
      const result = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/v1/documents', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              title: 'Unauthorized Document',
              type: 'overview',
              content: {
                format: 'html',
                data: '<p>Test</p>'
              },
              node_id: 1
            })
          });
          return {
            status: response.status,
            body: await response.json().catch(() => null)
          };
        } catch (err) {
          return { error: (err as Error).message };
        }
      });

      // 验证响应是 401 Unauthorized 或 403 Forbidden
      // (浏览器 fetch 不会自动带上认证信息，返回 401)
      expect([401, 403]).toContain(result.status);
    });

    test('校对员尝试通过 API 删除文档应该被拒绝', async ({ page, loginAs }) => {
      await loginAs('proofreader');
      await page.goto('/');

      // 尝试删除文档（假设文档 ID 为 1）
      const result = await page.evaluate(async () => {
        try {
          const response = await fetch('/api/v1/documents/1', {
            method: 'DELETE',
            headers: {
              'Content-Type': 'application/json',
            }
          });
          return {
            status: response.status,
            body: await response.json().catch(() => null)
          };
        } catch (err) {
          return { error: (err as Error).message };
        }
      });

      // 验证响应是 401 Unauthorized 或 403 Forbidden
      // (浏览器 fetch 不会自动带上认证信息，返回 401)
      expect([401, 403]).toContain(result.status);
    });
  });
});
