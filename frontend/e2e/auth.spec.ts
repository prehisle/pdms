import { test, expect, TEST_USERS } from './fixtures/auth';

test.describe('认证功能测试', () => {
  const waitForAntMessage = async (page: any, text: string) => {
    const message = page.locator('.ant-message-notice-content').filter({ hasText: text });
    await expect(message).toBeVisible({ timeout: 10000 });
  };

  test('应该能够成功登录', async ({ page, loginAs }) => {
    await loginAs('superAdmin');

    // 验证登录成功
    await expect(page).toHaveURL('/');
    await expect(page.locator('text=' + TEST_USERS.superAdmin.displayName).or(page.locator('text=' + TEST_USERS.superAdmin.username))).toBeVisible();
  });

  test('登录失败应该显示错误信息', async ({ page }) => {
    await page.goto('/login');

    // 填写错误的凭据
    await page.fill('input[placeholder*="用户名"]', 'wronguser');
    await page.fill('input[type="password"]', 'wrongpass');
    await page.click('button[type="submit"]');

    // 验证错误消息
    await expect(page.locator('.ant-message-error, .ant-notification-notice-error')).toBeVisible();
  });

  test('未登录用户应该被重定向到登录页面', async ({ page }) => {
    await page.goto('/');

    // 验证被重定向到登录页面
    await expect(page).toHaveURL(/\/login/);
  });

  test('应该能够成功登出', async ({ page, loginAs }) => {
    await loginAs('superAdmin');

    // 点击用户菜单
    await page.click('.ant-dropdown-trigger');

    // 点击退出登录
    await page.click('li:has-text("退出登录")');

    // 验证跳转到登录页面
    await expect(page).toHaveURL(/\/login/);
  });

  test('应该能够修改密码', async ({ page, loginAs }) => {
    await loginAs('superAdmin');

    // 打开用户菜单
    await page.click('.ant-dropdown-trigger');

    // 点击修改密码
    await page.click('li:has-text("修改密码")');

    // 等待对话框打开
    const modal = page.locator('.ant-modal:has-text("修改密码")');
    await modal.waitFor({ state: 'visible' });

    // 填写密码修改表单（在 Modal 上下文中）
    const passwordInputs = modal.locator('input[type="password"]');
    await passwordInputs.nth(0).fill(TEST_USERS.superAdmin.password);  // 旧密码
    await passwordInputs.nth(1).fill('newpassword123');  // 新密码
    await passwordInputs.nth(2).fill('newpassword123');  // 确认新密码

    // 点击 Modal 内的确定按钮
    await modal.locator('.ant-modal-footer .ant-btn-primary').click();

    // 验证成功消息
    await waitForAntMessage(page, '密码修改成功！');

    // 改回原密码以便后续测试
    await page.click('.ant-dropdown-trigger');
    await page.click('li:has-text("修改密码")');

    const modal2 = page.locator('.ant-modal:has-text("修改密码")');
    await modal2.waitFor({ state: 'visible' });

    const passwordInputs2 = modal2.locator('input[type="password"]');
    await passwordInputs2.nth(0).fill('newpassword123');
    await passwordInputs2.nth(1).fill(TEST_USERS.superAdmin.password);
    await passwordInputs2.nth(2).fill(TEST_USERS.superAdmin.password);

    await modal2.locator('.ant-modal-footer .ant-btn-primary').click();
    await waitForAntMessage(page, '密码修改成功！');
  });
});
