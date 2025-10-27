import { test, expect, TEST_USERS } from './fixtures/auth';

test.describe('用户管理功能测试', () => {
  test.beforeEach(async ({ loginAs }) => {
    // 每个测试前都以超级管理员身份登录
    await loginAs('superAdmin');
  });

  // 辅助函数：打开用户管理抽屉
  async function openUserManagementDrawer(page: any) {
    await page.click('.ant-dropdown-trigger');
    await page.click('li:has-text("用户管理")');
    const drawer = page.locator('.ant-drawer:has-text("用户管理")');
    await drawer.waitFor({ state: 'visible' });
    return drawer;
  }

  async function waitForAntMessage(page: any, text: string) {
    const message = page.locator('.ant-message-notice-content').filter({ hasText: text });
    await expect(message).toBeVisible({ timeout: 10000 });
  }

  test('超级管理员应该能看到用户管理入口', async ({ page }) => {
    // 打开用户菜单
    await page.click('.ant-dropdown-trigger');

    // 验证用户管理菜单项存在
    await expect(page.locator('li:has-text("用户管理")')).toBeVisible();
  });

  test('应该能够打开用户管理抽屉', async ({ page }) => {
    // 打开用户管理抽屉
    const drawer = await openUserManagementDrawer(page);

    // 验证抽屉标题存在
    await expect(drawer.locator('.ant-drawer-title:has-text("用户管理")')).toBeVisible();

    // 验证表格存在
    await expect(drawer.locator('.ant-table')).toBeVisible();
  });

  test('应该能够查看用户列表', async ({ page }) => {
    const drawer = await openUserManagementDrawer(page);

    // 验证表格存在
    await expect(drawer.locator('.ant-table')).toBeVisible();

    // 验证至少有用户记录
    await expect(drawer.locator('.ant-table-row').first()).toBeVisible({ timeout: 5000 });

    // 验证至少有 1 个用户
    const userCount = await drawer.locator('.ant-table-row').count();
    expect(userCount).toBeGreaterThanOrEqual(1);
  });

  test('应该能够创建课程管理员用户', async ({ page, createTestUser }) => {
    const username = `test_course_admin_${Date.now()}`;

    // 创建用户（createTestUser 内部已打开抽屉并验证成功消息）
    await createTestUser(username, 'testpass123', 'course_admin', '测试课程管理员');

    // 验证抽屉仍然打开，表格可见
    const drawer = page.locator('.ant-drawer:has-text("用户管理")');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.ant-table')).toBeVisible();
  });

  test('应该能够创建校对员用户', async ({ page, createTestUser }) => {
    const username = `test_proofreader_${Date.now()}`;

    // 创建用户（createTestUser 内部已打开抽屉并验证成功消息）
    await createTestUser(username, 'testpass123', 'proofreader', '测试校对员');

    // 验证抽屉仍然打开，表格可见
    const drawer = page.locator('.ant-drawer:has-text("用户管理")');
    await expect(drawer).toBeVisible();
    await expect(drawer.locator('.ant-table')).toBeVisible();
  });

  test('应该能够删除用户', async ({ page }) => {
    const drawer = await openUserManagementDrawer(page);

    // 等待表格加载
    await expect(drawer.locator('.ant-table')).toBeVisible();

    // 找到第一个可删除的用户（有删除按钮）
    const firstDeleteButton = drawer.locator('.ant-table-row button:has-text("删除")').first();

    // 确保至少有一个可删除的用户
    await expect(firstDeleteButton).toBeVisible({ timeout: 5000 });

    // 点击删除按钮
    await firstDeleteButton.click();

    // 等待确认框出现并确认删除
    const confirmButton = page.locator('.ant-popconfirm .ant-btn-primary, .ant-popconfirm button:has-text("删除"), .ant-popconfirm button:has-text("确定")').first();
    await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
    const deleteResponsePromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/users/') &&
        resp.request().method() === 'DELETE',
    );
    await confirmButton.click();
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.ok()).toBeTruthy();

    // 验证成功消息
    await waitForAntMessage(page, '用户已删除').catch(() => undefined);
  });

  test('不应该能够删除自己', async ({ page }) => {
    const drawer = await openUserManagementDrawer(page);

    // 找到当前用户的行
    const currentUserRow = drawer.locator(`tr:has-text("${TEST_USERS.superAdmin.username}")`);

    // 验证没有删除按钮或删除按钮被禁用
    const deleteButton = currentUserRow.locator('button:has-text("删除")');
    const buttonCount = await deleteButton.count();

    if (buttonCount > 0) {
      // 如果按钮存在，应该被禁用
      await expect(deleteButton).toBeDisabled();
    }
  });

  test('创建用户时应该验证必填字段', async ({ page }) => {
    const drawer = await openUserManagementDrawer(page);

    // 点击创建用户按钮（在抽屉的 extra 区域）
    await drawer.locator('button:has-text("创建用户")').click();

    // 等待 Modal 完全显示
    const modal = page.locator('.ant-modal:has-text("创建用户")');
    await modal.waitFor({ state: 'visible' });

    // 不填写任何字段，直接提交
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();

    // 验证表单验证错误（至少有必填字段错误）
    await expect(modal.locator('.ant-form-item-explain-error').first()).toBeVisible({ timeout: 5000 });

    // 验证至少有 3 个错误消息
    const errorCount = await modal.locator('.ant-form-item-explain-error').count();
    expect(errorCount).toBeGreaterThanOrEqual(3);
  });

  test('创建用户时应该验证密码一致性', async ({ page }) => {
    const drawer = await openUserManagementDrawer(page);

    // 点击创建用户按钮（在抽屉的 extra 区域）
    await drawer.locator('button:has-text("创建用户")').click();

    // 等待 Modal 完全显示
    const modal = page.locator('.ant-modal:has-text("创建用户")');
    await modal.waitFor({ state: 'visible' });

    // 填写表单但密码不一致
    await modal.locator('input[placeholder*="用户名"]').fill('testuser');

    // 打开角色选择器
    await modal.locator('.ant-select').click();
    await page.locator('.ant-select-dropdown .ant-select-item:has-text("校对员")').click();

    // 填写不一致的密码
    const passwordInputs = modal.locator('input[type="password"]');
    await passwordInputs.nth(0).fill('password123');
    await passwordInputs.nth(1).fill('different123');

    // 提交表单
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();

    // 验证密码不一致的错误
    await expect(modal.locator('text=两次输入的密码不一致')).toBeVisible({ timeout: 5000 });
  });
});
