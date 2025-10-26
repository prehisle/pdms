import { test, expect, TEST_USERS } from './fixtures/auth';

/**
 * 设置测试 - 创建必要的测试用户
 * 这个测试应该在其他测试之前运行
 */
test.describe.configure({ mode: 'serial' });

test.describe('测试环境设置', () => {
  test('创建课程管理员测试用户', async ({ page, loginAs, createTestUser }) => {
    await loginAs('superAdmin');

    try {
      await createTestUser(
        TEST_USERS.courseAdmin.username,
        TEST_USERS.courseAdmin.password,
        TEST_USERS.courseAdmin.role,
        TEST_USERS.courseAdmin.displayName
      );
      console.log('✓ 课程管理员用户创建成功');
    } catch (e) {
      console.log('创建用户失败，可能已存在，跳过...');
      // 用户可能已存在，测试可以继续（在 permissions.spec.ts 中会验证登录）
    }
  });

  test('创建校对员测试用户', async ({ page, loginAs, createTestUser }) => {
    await loginAs('superAdmin');

    try {
      await createTestUser(
        TEST_USERS.proofreader.username,
        TEST_USERS.proofreader.password,
        TEST_USERS.proofreader.role,
        TEST_USERS.proofreader.displayName
      );
      console.log('✓ 校对员用户创建成功');
    } catch (e) {
      console.log('创建用户失败，可能已存在，跳过...');
      // 用户可能已存在，测试可以继续（在 permissions.spec.ts 中会验证登录）
    }
  });
});
