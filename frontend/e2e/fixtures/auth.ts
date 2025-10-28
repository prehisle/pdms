import {
  test as base,
  expect as playwrightExpect,
  type APIRequestContext,
  type Locator,
  type Page,
  type Response,
} from '@playwright/test';

export { playwrightExpect as expect };

/**
 * 测试用户凭据
 */
export const TEST_USERS = {
  superAdmin: {
    username: 'super_admin',
    password: 'admin123456',
    role: 'super_admin',
    displayName: '超级管理员',
  },
  courseAdmin: {
    username: 'course_admin1',
    password: 'testpass123',
    role: 'course_admin',
    displayName: '课程管理员1',
  },
  proofreader: {
    username: 'proofreader_test',
    password: 'testpass123',
    role: 'proofreader',
    displayName: '测试校对员',
  },
};

const ensuredUsers = new Set<string>();
let superAdminToken: string | null = null;
const BACKEND_HEALTH_PATH = '/api/v1/healthz';

interface CategoryNode {
  id: number;
  name: string;
  parent_id?: number | null;
  children?: CategoryNode[];
}

async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function readErrorPayload(res: { json: () => Promise<unknown>; text: () => Promise<string> }): Promise<string> {
  try {
    const data = await res.json() as Record<string, unknown> | undefined;
    if (data && typeof data.error === 'string' && data.error.trim().length > 0) {
      return data.error;
    }
    if (data && typeof data.message === 'string' && data.message.trim().length > 0) {
      return data.message;
    }
    if (data) {
      return JSON.stringify(data);
    }
  } catch {
    // 忽略解析错误，继续读取纯文本
  }
  try {
    return await res.text();
  } catch {
    return '未知错误';
  }
}

async function waitForBackendReady(request: APIRequestContext, retries = 10): Promise<void> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const healthRes = await request.get(BACKEND_HEALTH_PATH, { timeout: 5000 });
      if (healthRes.ok()) {
        return;
      }
    } catch {
      // ignore and retry
    }
    await delay(300 * (attempt + 1));
  }
  throw new Error('后端健康检查失败，无法连接到 /api/v1/healthz');
}


async function getSuperAdminToken(request: APIRequestContext): Promise<string> {
  if (superAdminToken) {
    return superAdminToken;
  }

  await waitForBackendReady(request);

  const loginRes = await request.post('/api/v1/auth/login', {
    data: {
      username: TEST_USERS.superAdmin.username,
      password: TEST_USERS.superAdmin.password,
    },
  });
  if (!loginRes.ok()) {
    const payload = await readErrorPayload(loginRes);
    throw new Error(`超级管理员登录失败：${loginRes.status()} ${payload}`);
  }
  const loginData = await loginRes.json() as { token?: string } | undefined;
  if (!loginData?.token) {
    throw new Error('登录响应缺少 token');
  }

  superAdminToken = loginData.token;
  return superAdminToken;
}

async function ensureTestUserAccount(request: APIRequestContext, user: typeof TEST_USERS[keyof typeof TEST_USERS]): Promise<void> {
  await waitForBackendReady(request);

  if (user.username === TEST_USERS.superAdmin.username) {
    const loginAttempt = await attemptLogin(request, user);
    if (loginAttempt.status !== 'success') {
      throw new Error(
        `默认超级管理员无法登录，请确认数据库已存在账号 ${user.username}，错误信息：${loginAttempt.message ?? '未知错误'}`,
      );
    }
    ensuredUsers.add(user.username);
    return;
  }

  if (ensuredUsers.has(user.username)) {
    return;
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const loginAttempt = await attemptLogin(request, user);
    if (loginAttempt.status === 'success') {
      ensuredUsers.add(user.username);
      return;
    }

    if (loginAttempt.status === 'role-mismatch') {
      throw new Error(
        `测试账号 ${user.username} 的角色与预期不符：${loginAttempt.message ?? '角色不匹配'}`,
      );
    }

    const token = await getSuperAdminToken(request);
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    let existingId: number | null = null;
    const listRes = await request.get('/api/v1/users', { headers });
    if (!listRes.ok()) {
      const payload = await readErrorPayload(listRes);
      throw new Error(`获取用户列表失败：${listRes.status()} ${payload}`);
    }
    const listData = await listRes.json() as { users?: Array<{ id: number; username: string }> } | undefined;
    const existing = listData?.users?.find((item) => item.username === user.username);
    if (existing) {
      existingId = existing.id;
    }

    const createRes = await request.post('/api/v1/users', {
      headers,
      data: {
        username: user.username,
        password: user.password,
        role: user.role,
      },
    });
    if (createRes.ok()) {
      ensuredUsers.add(user.username);
      return;
    }

    const payload = await readErrorPayload(createRes);
    const duplicate = createRes.status() === 400 &&
      /username already exists|duplicate key value/i.test(payload);

    if (duplicate) {
      for (let retry = 0; retry < 3; retry++) {
        await delay(300 * (retry + 1));
        const retryLogin = await attemptLogin(request, user);
        if (retryLogin.status === 'success') {
          ensuredUsers.add(user.username);
          return;
        }
        if (retryLogin.status === 'role-mismatch') {
          throw new Error(
            `测试账号 ${user.username} 的角色与预期不符：${retryLogin.message ?? '角色不匹配'}`,
          );
        }
      }

      if (existingId === null) {
        const listAgain = await request.get('/api/v1/users', { headers });
        if (listAgain.ok()) {
          const listAgainData = await listAgain.json() as { users?: Array<{ id: number; username: string }> } | undefined;
          const existingAgain = listAgainData?.users?.find((item) => item.username === user.username);
          existingId = existingAgain?.id ?? null;
        }
      }

      if (existingId !== null) {
        const deleteRes = await request.delete(`/api/v1/users/${existingId}`, { headers });
        if (!deleteRes.ok()) {
          const deletePayload = await readErrorPayload(deleteRes);
          throw new Error(`删除已存在用户失败：${deleteRes.status()} ${deletePayload}`);
        }
        await delay(300);
        continue;
      }

      if (attempt === 2) {
        throw new Error(`创建测试用户失败：账号已存在但无法登录，最后一次错误：${payload}`);
      }

      await delay(500);
      continue;
    }

    if (attempt === 2) {
      throw new Error(`创建测试用户失败：${createRes.status()} ${payload}`);
    }

    await delay(500);
  }
}

type LoginStatus = 'success' | 'role-mismatch' | 'invalid';

async function attemptLogin(
  request: APIRequestContext,
  user: typeof TEST_USERS[keyof typeof TEST_USERS],
): Promise<{ status: LoginStatus; message?: string }> {
  const res = await request.post('/api/v1/auth/login', {
    data: {
      username: user.username,
      password: user.password,
    },
  });

  if (res.ok()) {
    const data = await res.json() as { user?: { role?: string } } | undefined;
    if (data?.user?.role === user.role) {
      return { status: 'success' };
    }
    const role = data?.user?.role ?? '未知';
    return {
      status: 'role-mismatch',
      message: `实际角色为 ${role}，期望角色为 ${user.role}`,
    };
  }

  const message = await readErrorPayload(res).catch(() => undefined);
  return {
    status: 'invalid',
    message,
  };
}

async function isUserAlreadyLoggedIn(page: Page, expectedUser: typeof TEST_USERS[keyof typeof TEST_USERS]): Promise<boolean> {
  const meRes = await page.request.get('/api/v1/auth/me');
  if (!meRes.ok()) {
    return false;
  }
  const meData = await meRes.json() as { username?: string } | undefined;
  return meData?.username === expectedUser.username;
}

async function ensureLoggedOut(page: Page): Promise<void> {
  await page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => undefined);
  await page.evaluate(() => {
    try {
      window.localStorage?.clear?.();
      window.sessionStorage?.clear?.();
    } catch {
      // 忽略清理错误
    }
  }).catch(() => undefined);
  try {
    await page.context().clearCookies();
  } catch {
    // 忽略清理失败
  }
}

async function openUserManagementDrawer(page: Page): Promise<Locator> {
  for (let attempt = 0; attempt < 3; attempt++) {
    const trigger = page.locator('.ant-dropdown-trigger').first();
    await trigger.waitFor({ state: 'visible', timeout: 10000 });

    try {
      await trigger.click({ timeout: 5000 });
      const overlay = page.locator('.ant-dropdown');
      await overlay.waitFor({ state: 'visible', timeout: 5000 }).catch(() => undefined);
    } catch (error) {
      if (attempt === 2) {
        throw error;
      }
      await delay(200 * (attempt + 1));
      continue;
    }

    const menuItem = page.locator('li:has-text("用户管理")').first();
    try {
      await menuItem.click({ timeout: 5000 });
    } catch {
      if (attempt === 2) {
        throw new Error('未能点击用户管理菜单项');
      }
      await delay(200 * (attempt + 1));
      continue;
    }

    const drawer = page.locator('.ant-drawer:has-text("用户管理")');
    await drawer.waitFor({ state: 'visible', timeout: 10000 });
    return drawer;
  }

  throw new Error('未能打开用户管理抽屉');
}

async function deleteExistingUser(page: Page, username: string): Promise<void> {
  const drawer = page.locator('.ant-drawer:has-text("用户管理")');
  const row = drawer.locator(`.ant-table-row:has-text("${username}")`).first();
  const deleteButton = row.locator('button:has-text("删除")');

  if (await deleteButton.count() === 0) {
    throw new Error(`无法删除用户：${username}`);
  }

  await deleteButton.click();

  const confirmButton = page.locator('.ant-popconfirm button:has-text("删除"), .ant-popconfirm .ant-btn-primary').first();
  await confirmButton.waitFor({ state: 'visible', timeout: 5000 });
  await confirmButton.click();

  await waitForAntMessage(page, '用户已删除');
  await playwrightExpect(drawer.locator(`.ant-table-row:has-text("${username}")`)).toHaveCount(0, { timeout: 10000 });
}

async function openUserCreateModal(page: Page): Promise<Locator> {
  const drawer = page.locator('.ant-drawer:has-text("用户管理")');
  await drawer.locator('button:has-text("创建用户")').click();
  const modal = page.locator('.ant-modal:has-text("创建用户")');
  await modal.waitFor({ state: 'visible' });
  await page.waitForTimeout(300);
  return modal;
}

async function submitCreateUserForm(
  page: Page,
  modal: Locator,
  username: string,
  password: string,
  role: string,
  displayName?: string,
): Promise<Response> {
  const usernameInput = modal.locator('input[placeholder*="用户名"]');
  await usernameInput.fill(username);

  const displayNameInput = modal.locator('input[placeholder*="显示名称"]');
  if (displayName) {
    await displayNameInput.fill(displayName);
  } else {
    await displayNameInput.fill('');
  }

  await modal.locator('.ant-select').click();
  await page.locator(`.ant-select-dropdown .ant-select-item:has-text("${getRoleLabel(role)}")`).click();

  const passwordInputs = modal.locator('input[type="password"]');
  await passwordInputs.nth(0).fill(password);
  await passwordInputs.nth(1).fill(password);

  const responsePromise = page.waitForResponse(
    (resp) =>
      resp.url().includes('/api/v1/users') &&
      resp.request().method() === 'POST',
    { timeout: 10000 },
  );

  await modal.locator('.ant-modal-footer .ant-btn-primary').click();
  return await responsePromise;
}

async function ensureUserCoursePermissions(
  request: APIRequestContext,
  user: typeof TEST_USERS[keyof typeof TEST_USERS],
  options?: { rootNames?: string[] },
): Promise<void> {
  await ensureTestUserAccount(request, user);

  const token = await getSuperAdminToken(request);
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };

  const usersRes = await request.get('/api/v1/users', { headers });
  if (!usersRes.ok()) {
    const payload = await readErrorPayload(usersRes);
    throw new Error(`获取用户列表失败：${usersRes.status()} ${payload}`);
  }
  const usersData = await usersRes.json() as { users?: Array<{ id: number; username: string }> } | undefined;
  const targetUser = usersData?.users?.find((entry) => entry.username === user.username);
  if (!targetUser) {
    throw new Error(`无法找到用户 ${user.username}，请确认其已创建`);
  }

  const categoriesRes = await request.get('/api/v1/categories/tree', { headers });
  if (!categoriesRes.ok()) {
    const payload = await readErrorPayload(categoriesRes);
    throw new Error(`获取课程分类失败：${categoriesRes.status()} ${payload}`);
  }
  const categoriesData = await categoriesRes.json() as CategoryNode[] | undefined;
  const rootNodes = (categoriesData ?? []).filter((node) => node.parent_id === null || node.parent_id === undefined);

  let targetRoots: CategoryNode[];
  const desiredNames = options?.rootNames?.filter((name) => name.trim().length > 0);

  if (desiredNames && desiredNames.length > 0) {
    targetRoots = rootNodes.filter((node) => desiredNames.includes(node.name));
    if (targetRoots.length === 0) {
      throw new Error(`未找到指定的根目录：${desiredNames.join(', ')}，请先创建这些课程`);
    }
  } else {
    targetRoots = rootNodes;
  }

  if (targetRoots.length === 0) {
    throw new Error('系统中没有可用的根目录，无法为用户授予课程权限');
  }

  const userCoursesRes = await request.get(`/api/v1/users/${targetUser.id}/courses`, { headers });
  if (!userCoursesRes.ok()) {
    const payload = await readErrorPayload(userCoursesRes);
    throw new Error(`获取用户课程权限失败：${userCoursesRes.status()} ${payload}`);
  }
  const courseData = await userCoursesRes.json() as { course_ids?: number[] } | undefined;
  const existingCourseIds = new Set(courseData?.course_ids ?? []);

  for (const root of targetRoots) {
    if (existingCourseIds.has(root.id)) {
      continue;
    }

    const grantRes = await request.post(`/api/v1/users/${targetUser.id}/courses`, {
      headers,
      data: { root_node_id: root.id },
    });

    if (!grantRes.ok()) {
      const payload = await readErrorPayload(grantRes);
      throw new Error(`授予用户 ${user.username} 课程 (${root.name}) 权限失败：${grantRes.status()} ${payload}`);
    }
  }
}

/**
 * 扩展的测试 fixture，包含认证辅助函数
 */
export const test = base.extend<{
  loginAs: (userType: keyof typeof TEST_USERS) => Promise<void>;
  createTestUser: (username: string, password: string, role: string, displayName?: string) => Promise<void>;
  ensureCoursePermission: (userType: keyof typeof TEST_USERS, options?: { rootNames?: string[] }) => Promise<void>;
}>({
  loginAs: async ({ page }, use) => {
    const login = async (userType: keyof typeof TEST_USERS) => {
      const user = TEST_USERS[userType];

      await waitForBackendReady(page.request);
      await ensureTestUserAccount(page.request, user);

      if (await isUserAlreadyLoggedIn(page, user)) {
        return;
      }

      for (let attempt = 0; attempt < 2; attempt++) {
        await ensureLoggedOut(page);

        if (page.isClosed()) {
          if (attempt === 1) {
            throw new Error('浏览器上下文已关闭，无法继续登录');
          }
          continue;
        }

        try {
          await page.goto('/login', { waitUntil: 'domcontentloaded' });
        } catch (navError) {
          if (attempt === 1) {
            throw navError;
          }
          continue;
        }

        try {
          await page.waitForSelector('input[placeholder*="用户名"]', { timeout: 10000 });
          await page.fill('input[placeholder*="用户名"]', user.username);
          await page.fill('input[type="password"]', user.password);

          await Promise.all([
            page.waitForURL('**/', { timeout: 60000 }).catch(() => null),
            page.click('button[type="submit"]'),
          ]);

          const toast = page.locator('.ant-message-error').first();
          const toastVisible = await toast.isVisible({ timeout: 3000 }).catch(() => false);
          if (toastVisible) {
            const text = await toast.textContent();
            if (text && text.trim().length > 0) {
              throw new Error(`登录失败：${text.trim()}`);
            }
          }

          await page.waitForSelector('.ant-dropdown-trigger', { timeout: 60000 }).catch(() => null);
          await playwrightExpect(
            page.locator(`text=${user.displayName}`).or(page.locator(`text=${user.username}`)),
          ).toBeVisible({ timeout: 15000 });
          return;
        } catch (error) {
          if (attempt === 1) {
            throw error;
          }
        }
      }
    };

    await use(login);
  },

  createTestUser: async ({ page }, use) => {
    const create = async (username: string, password: string, role: string, displayName?: string) => {
      await page.goto('/');
      await openUserManagementDrawer(page);
      let modal = await openUserCreateModal(page);

      for (let attempt = 0; attempt < 2; attempt++) {
        const response = await submitCreateUserForm(page, modal, username, password, role, displayName);

        if (response.ok()) {
          await waitForAntMessage(page, '用户创建成功！');
          await modal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
          return;
        }

        const payload = await readErrorPayload(response);
        const duplicate = response.status() === 400 && /username already exists/i.test(payload);

        if (duplicate) {
          await modal.locator('.ant-modal-close').click();
          await deleteExistingUser(page, username);
          modal = await openUserCreateModal(page);
          continue;
        }

        throw new Error(`创建用户失败：${payload}（状态码 ${response.status()}）`);
      }

      throw new Error('创建用户失败：重试两次后仍未成功');
    };

    await use(create);
  },

  ensureCoursePermission: async ({ page }, use) => {
    const ensurePermission = async (
      userType: keyof typeof TEST_USERS,
      options?: { rootNames?: string[] },
    ) => {
      const user = TEST_USERS[userType];
      await ensureUserCoursePermissions(page.request, user, options);
    };

    await use(ensurePermission);
  },
});

async function waitForAntMessage(page: Page, text: string, timeout = 10000): Promise<void> {
  const message = page.locator('.ant-message-notice-content').filter({ hasText: text });
  await playwrightExpect(message).toBeVisible({ timeout });
}

/**
 * 获取角色的中文标签
 */
function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    super_admin: '超级管理员',
    course_admin: '课程管理员',
    proofreader: '校对员',
  };
  return labels[role] || role;
}
