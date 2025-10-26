import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright 配置
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './e2e',

  /* 测试超时时间 */
  timeout: 60 * 1000, // 60秒

  /* Expect 超时时间 */
  expect: {
    timeout: 10 * 1000, // 10秒
  },

  /* 并行运行测试 */
  fullyParallel: true,

  /* 在 CI 上失败时重试 */
  retries: process.env.CI ? 2 : 1,

  /* 在 CI 上禁用并行 */
  workers: process.env.CI ? 1 : undefined,

  /* Reporter */
  reporter: 'html',

  /* 所有测试的共享设置 */
  use: {
    /* 基础 URL */
    baseURL: 'http://localhost:5174',

    /* 操作超时 */
    actionTimeout: 15 * 1000, // 15秒

    /* 导航超时 */
    navigationTimeout: 30 * 1000, // 30秒

    /* 收集失败测试的 trace */
    trace: 'on-first-retry',

    /* 截图设置 */
    screenshot: 'only-on-failure',

    /* 视频设置 */
    video: 'retain-on-failure',
  },

  /* 配置测试项目 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* 在测试开始前启动开发服务器 */
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
