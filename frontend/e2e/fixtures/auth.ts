import { test as base, expect as playwrightExpect } from '@playwright/test';

export { playwrightExpect as expect };

/**
 * 测试用户凭据
 */
export const TEST_USERS = {
  superAdmin: {
    username: 'super_admin',
    password: 'admin123456',
    role: 'super_admin',
    displayName: '超级管理员'
  },
  courseAdmin: {
    username: 'course_admin1',
    password: 'testpass123',
    role: 'course_admin',
    displayName: '课程管理员1'
  },
  proofreader: {
    username: 'proofreader_test',
    password: 'testpass123',
    role: 'proofreader',
    displayName: '测试校对员'
  }
};

/**
 * 扩展的测试 fixture，包含认证辅助函数
 */
export const test = base.extend<{
  loginAs: (userType: keyof typeof TEST_USERS) => Promise<void>;
  createTestUser: (username: string, password: string, role: string, displayName?: string) => Promise<void>;
}>({
  loginAs: async ({ page }, use) => {
    const login = async (userType: keyof typeof TEST_USERS) => {
      const user = TEST_USERS[userType];

      await page.goto('/login');
      await page.fill('input[placeholder*="用户名"]', user.username);
      await page.fill('input[type="password"]', user.password);
      await page.click('button[type="submit"]');

      // 等待登录成功，跳转到主页
      await page.waitForURL('/');
      await playwrightExpect(page.locator('text=' + user.displayName).or(page.locator('text=' + user.username))).toBeVisible();
    };

    await use(login);
  },

  createTestUser: async ({ page }, use) => {
    const create = async (username: string, password: string, role: string, displayName?: string) => {
      // 打开用户管理抽屉
      await page.goto('/');
      await page.click('.ant-dropdown-trigger');
      await page.click('li:has-text("用户管理")');

      // 等待抽屉打开
      const drawer = page.locator('.ant-drawer:has-text("用户管理")');
      await drawer.waitFor({ state: 'visible' });

      // 点击创建用户按钮（在抽屉的 extra 区域）
      await page.click('.ant-drawer button:has-text("创建用户")');

      // 等待 Modal 完全显示并稳定
      const modal = page.locator('.ant-modal:has-text("创建用户")');
      await modal.waitFor({ state: 'visible' });

      // 等待表单输入框可交互
      const usernameInput = modal.locator('input[placeholder*="用户名"]');
      await usernameInput.waitFor({ state: 'visible' });
      await page.waitForTimeout(300); // 等待 Modal 动画完成

      // 在 Modal 上下文中填写表单
      await usernameInput.fill(username);

      if (displayName) {
        await modal.locator('input[placeholder*="显示名称"]').fill(displayName);
      }

      // 打开角色选择器（在 Modal 内）
      await modal.locator('.ant-select').click();

      // 等待下拉菜单出现并选择角色
      await page.locator(`.ant-select-dropdown .ant-select-item:has-text("${getRoleLabel(role)}")`).click();

      // 填写密码（使用 first() 避免歧义）
      const passwordInputs = modal.locator('input[type="password"]');
      await passwordInputs.nth(0).fill(password);  // 新密码
      await passwordInputs.nth(1).fill(password);  // 确认密码

      // 点击 Modal 内的确定按钮
      await modal.locator('.ant-modal-footer .ant-btn-primary').click();

      // 等待成功消息
      await playwrightExpect(page.locator('.ant-message-success')).toBeVisible({ timeout: 10000 });
    };

    await use(create);
  }
});

/**
 * 获取角色的中文标签
 */
function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    'super_admin': '超级管理员',
    'course_admin': '课程管理员',
    'proofreader': '校对员'
  };
  return labels[role] || role;
}
