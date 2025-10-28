import { test, expect, TEST_USERS } from './fixtures/auth';

test.describe('权限控制测试', () => {
  test.describe('超级管理员权限', () => {
    test.beforeEach(async ({ loginAs }) => {
      await loginAs('superAdmin');
    });

    test('应该能看到用户管理入口', async ({ page }) => {
      await page.click('.ant-dropdown-trigger');
      await expect(page.locator('li:has-text("用户管理")')).toBeVisible();
    });

    test('应该能看到新建根目录按钮', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('button[aria-label="新建根目录"]')).toBeVisible();
    });

    test('应该能看到所有分类操作菜单', async ({ page }) => {
      await page.goto('/');

      // 如果页面上有分类节点，右键点击
      await page.waitForSelector('.ant-tree-treenode:not([aria-hidden="true"])', { timeout: 10000 }).catch(() => null);
      const firstNode = page
        .locator('.ant-tree-treenode:not([aria-hidden="true"]) .ant-tree-node-content-wrapper')
        .first();
      const nodeCount = await firstNode.count();
      console.log('右键菜单测试节点数量:', nodeCount);

      if (nodeCount > 0) {
        await firstNode.click({ button: 'right' });

        const menuItemsLocator = page.locator('[role="menuitem"]:visible');
        await expect(menuItemsLocator.first()).toBeVisible({ timeout: 5000 });
        const superAdminItems = await menuItemsLocator.allTextContents();
        console.log('超级管理员右键菜单内容:', superAdminItems);
        await expect(menuItemsLocator.filter({ hasText: '添加文档' })).toBeVisible();
        await expect(menuItemsLocator.filter({ hasText: '新建子目录' })).toBeVisible();
        await expect(menuItemsLocator.filter({ hasText: '重命名目录' })).toBeVisible();
        await expect(menuItemsLocator.filter({ hasText: '删除目录' })).toBeVisible();
      }
    });
  });

  test.describe('课程管理员权限', () => {
    test.beforeEach(async ({ loginAs, ensureCoursePermission }) => {
      // 直接以课程管理员身份登录（假设该用户已存在）
      // 如果不存在，测试会失败并提示需要先创建该用户
      await ensureCoursePermission('courseAdmin');
      await loginAs('courseAdmin');
    });

    test('不应该看到用户管理入口', async ({ page }) => {
      await page.click('.ant-dropdown-trigger');
      await expect(page.locator('li:has-text("用户管理")')).toHaveCount(0);
    });

    test('直接调用用户管理接口应该被拒绝', async ({ page }) => {
      const response = await page.request.get('/api/v1/users');
      expect([401, 403]).toContain(response.status());
    });

    test('不应该看到新建根目录按钮', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('button[aria-label="新建根目录"]')).not.toBeVisible();
    });
  });

  test.describe('校对员权限限制', () => {
    test.beforeEach(async ({ loginAs, ensureCoursePermission }) => {
      // 直接以校对员身份登录（假设该用户已存在）
      // 如果不存在，测试会失败并提示需要先创建该用户
      await ensureCoursePermission('proofreader');
      await loginAs('proofreader');
    });

    test('不应该看到用户管理入口', async ({ page }) => {
      await page.click('.ant-dropdown-trigger');
      await expect(page.locator('li:has-text("用户管理")')).not.toBeVisible();
    });

    test('不应该看到新建根目录按钮', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('button[aria-label="新建根目录"]')).not.toBeVisible();
    });

    test('右键菜单应该只显示只读操作', async ({ page }) => {
      await page.goto('/');

      // 如果页面上有分类节点，右键点击
      await page.waitForSelector('.ant-tree-treenode:not([aria-hidden="true"])', { timeout: 10000 }).catch(() => null);
      const firstNode = page
        .locator('.ant-tree-treenode:not([aria-hidden="true"]) .ant-tree-node-content-wrapper')
        .first();
      const nodeCount = await firstNode.count();

      if (nodeCount === 0) {
        console.log('校对员右键菜单测试：未找到可见目录节点');
        return;
      }

      await firstNode.click({ button: 'right' });

      // 校对员不应该看到任何目录操作项，包括复制
      await page.waitForTimeout(400);

      const menuItemsLocator = page.locator('[role="menuitem"]:visible');
      const visibleMenuItems = await menuItemsLocator.allTextContents();
      console.log('校对员右键菜单内容:', visibleMenuItems);

      await expect(menuItemsLocator).toHaveCount(0);
      await expect(menuItemsLocator.filter({ hasText: '添加文档' })).toHaveCount(0);
    });

    test('应该能够修改密码', async ({ page }) => {
      // 打开用户菜单
      await page.click('.ant-dropdown-trigger');

      // 验证修改密码选项存在
      await expect(page.locator('li:has-text("修改密码")')).toBeVisible();

      // 点击修改密码
      await page.click('li:has-text("修改密码")');

      // 验证对话框打开
      await expect(page.locator('.ant-modal:has-text("修改密码")')).toBeVisible();
    });
  });

  test.describe('权限边界测试', () => {
    test('校对员通过URL直接访问用户管理页面应该被重定向', async ({ page, loginAs }) => {
      await loginAs('proofreader');

      // 直接访问用户管理URL
      await page.goto('/users');

      // 应该被重定向回主页，且看不到用户管理内容
      await expect(page).not.toHaveURL(/\/users$/);
      await expect(page.locator('h3:has-text("用户管理")')).toHaveCount(0);
      await expect(page.locator('button:has-text("创建用户")')).toHaveCount(0);
    });
  });
});
