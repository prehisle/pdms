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
      const firstNode = page.locator('.ant-tree-treenode').first();
      const nodeCount = await firstNode.count();

      if (nodeCount > 0) {
        await firstNode.click({ button: 'right' });

        // 验证右键菜单中的所有选项
        await expect(page.locator('.ant-dropdown-menu li:has-text("新建子目录")')).toBeVisible();
        await expect(page.locator('.ant-dropdown-menu li:has-text("重命名目录")')).toBeVisible();
        await expect(page.locator('.ant-dropdown-menu li:has-text("删除目录")')).toBeVisible();
      }
    });
  });

  test.describe('课程管理员权限', () => {
    test.beforeEach(async ({ loginAs }) => {
      // 直接以课程管理员身份登录（假设该用户已存在）
      // 如果不存在，测试会失败并提示需要先创建该用户
      await loginAs('courseAdmin');
    });

    test('应该能看到用户管理入口', async ({ page }) => {
      await page.click('.ant-dropdown-trigger');
      await expect(page.locator('li:has-text("用户管理")')).toBeVisible();
    });

    test('应该只能创建校对员用户', async ({ page }) => {
      await page.goto('/users');

      // 点击创建用户
      await page.click('button:has-text("创建用户")');

      // 等待 Modal 显示
      const modal = page.locator('.ant-modal:has-text("创建用户")');
      await modal.waitFor({ state: 'visible' });

      // 打开角色选择器（在 Modal 内）
      await modal.locator('.ant-select').click();

      // 验证只有校对员选项（下拉菜单在 body 级别）
      await expect(page.locator('.ant-select-dropdown .ant-select-item:has-text("校对员")')).toBeVisible();
      await expect(page.locator('.ant-select-dropdown .ant-select-item:has-text("超级管理员")')).not.toBeVisible();
      await expect(page.locator('.ant-select-dropdown .ant-select-item:has-text("课程管理员")')).not.toBeVisible();
    });

    test('应该能看到新建根目录按钮', async ({ page }) => {
      await page.goto('/');
      await expect(page.locator('button[aria-label="新建根目录"]')).toBeVisible();
    });
  });

  test.describe('校对员权限限制', () => {
    test.beforeEach(async ({ loginAs }) => {
      // 直接以校对员身份登录（假设该用户已存在）
      // 如果不存在，测试会失败并提示需要先创建该用户
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
      const firstNode = page.locator('.ant-tree-treenode').first();
      const nodeCount = await firstNode.count();

      if (nodeCount > 0) {
        await firstNode.click({ button: 'right' });

        // 验证只有复制选项可见
        await expect(page.locator('.ant-dropdown-menu li:has-text("复制所选")')).toBeVisible();

        // 验证不应该看到写操作
        await expect(page.locator('.ant-dropdown-menu li:has-text("新建子目录")')).not.toBeVisible();
        await expect(page.locator('.ant-dropdown-menu li:has-text("重命名目录")')).not.toBeVisible();
        await expect(page.locator('.ant-dropdown-menu li:has-text("删除目录")')).not.toBeVisible();
        await expect(page.locator('.ant-dropdown-menu li:has-text("剪切所选")')).not.toBeVisible();
      }
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
    test('校对员通过URL直接访问用户管理页面应该能访问但无操作权限', async ({ page, loginAs }) => {
      await loginAs('proofreader');

      // 直接访问用户管理URL
      await page.goto('/users');

      // 页面应该加载（因为路由没有限制）
      await expect(page.locator('h3:has-text("用户管理")')).toBeVisible();

      // 但不应该看到创建用户按钮
      await expect(page.locator('button:has-text("创建用户")')).not.toBeVisible();
    });
  });
});
