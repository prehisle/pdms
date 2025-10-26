import { test, expect } from './fixtures/auth';

/**
 * 文档测试数据准备
 * 此测试会：
 * 1. 检查并创建测试用户（course_admin1, proofreader_test）
 * 2. 检查并创建测试分类
 * 3. 检查并创建测试文档
 */
test.describe.configure({ mode: 'serial' });

test.describe('文档测试环境准备', () => {
  test('准备测试用户', async ({ page, loginAs, createTestUser }) => {
    await loginAs('superAdmin');
    await page.goto('/');

    // 打开用户管理 Drawer
    await page.click('.ant-dropdown-trigger');
    await page.click('li:has-text("用户管理")');

    // 等待 Drawer 打开
    const drawer = page.locator('.ant-drawer:has-text("用户管理")');
    await drawer.waitFor({ state: 'visible', timeout: 10000 });

    // 检查 course_admin1 是否存在
    let courseAdminExists = await drawer.locator('text=course_admin1').count() > 0;
    if (!courseAdminExists) {
      console.log('创建课程管理员测试用户...');
      try {
        await createTestUser('course_admin1', 'testpass123', 'course_admin', '课程管理员1');
        console.log('✓ 课程管理员创建成功');
        courseAdminExists = true; // 标记为已创建
      } catch (e) {
        console.log('课程管理员创建失败或已存在');
      }
    } else {
      console.log('✓ 课程管理员已存在');
    }

    // 检查 proofreader_test 是否存在（在当前可见的Drawer中）
    let proofreaderExists = await drawer.locator('text=proofreader_test').count() > 0;
    if (!proofreaderExists) {
      console.log('创建校对员测试用户...');
      try {
        await createTestUser('proofreader_test', 'testpass123', 'proofreader', '测试校对员');
        console.log('✓ 校对员创建成功');
      } catch (e) {
        console.log('校对员创建失败或已存在');
      }
    } else {
      console.log('✓ 校对员已存在');
    }

    // 关闭 Drawer
    await page.keyboard.press('Escape');
  });

  test('准备测试分类和文档', async ({ page, loginAs }) => {
    await loginAs('superAdmin');
    await page.goto('/');

    // 等待页面加载
    await page.waitForTimeout(1000);

    // 检查是否已有名为"测试分类"的节点
    const testCategoryExists = await page.locator('.ant-tree-treenode:has-text("测试分类")').count() > 0;

    if (!testCategoryExists) {
      console.log('创建测试分类...');

      // 点击新建根目录按钮
      const createButton = page.locator('button[aria-label="新建根目录"]');
      await createButton.waitFor({ state: 'visible' });
      await createButton.click();

      // 等待 Modal 出现
      const modal = page.locator('.ant-modal:has-text("新建根目录")');
      await modal.waitFor({ state: 'visible' });

      // 填写表单
      const input = modal.locator('input');
      await input.fill('测试分类');

      // 提交
      const okButton = modal.locator('button:has-text("OK")');
      await okButton.click();

      // 等待新节点出现（这比等待成功消息更可靠）
      await expect(page.locator('.ant-tree-treenode:has-text("测试分类")')).toBeVisible({ timeout: 10000 });

      console.log('✓ 测试分类创建成功');
    } else {
      console.log('✓ 测试分类已存在');
    }

    // 点击测试分类节点
    const testCategory = page.locator('.ant-tree-treenode:not([aria-hidden="true"]):has-text("测试分类")').first();
    await testCategory.click();

    // 等待文档面板加载
    await expect(page.locator('text=文档列表')).toBeVisible();

    // 等待一下确保数据加载
    await page.waitForTimeout(1000);

    // 检查是否已有文档
    const noDataRow = page.locator('.ant-table-tbody tr:has-text("暂无数据")');
    const hasNoData = await noDataRow.count() > 0;

    if (hasNoData) {
      console.log('创建测试文档...');

      // 点击新增文档按钮
      const addDocButton = page.locator('button[aria-label="新增文档"]');
      await addDocButton.click();

      // 等待创建文档 Modal
      const docModal = page.locator('.ant-modal:has-text("新建文档")');
      await docModal.waitFor({ state: 'visible' });

      // 填写标题
      const titleInput = docModal.locator('input[placeholder*="标题"]');
      await titleInput.fill('测试文档');

      // 选择文档类型（选第一个）
      const typeSelect = docModal.locator('.ant-select').first();
      await typeSelect.click();
      await page.locator('.ant-select-dropdown .ant-select-item').first().click();

      // 提交
      const docOkButton = docModal.locator('button:has-text("OK")');
      await docOkButton.click();

      // 等待文档出现在列表中
      await expect(page.locator('.ant-table-tbody tr:has-text("测试文档")')).toBeVisible({ timeout: 10000 });

      console.log('✓ 测试文档创建成功');
    } else {
      console.log('✓ 测试文档已存在');
    }
  });
});
