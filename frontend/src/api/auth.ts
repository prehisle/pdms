import { http } from "./http";

/**
 * 用户角色
 */
export type UserRole = "super_admin" | "course_admin" | "proofreader";

/**
 * 用户信息
 */
export interface User {
  id: number;
  username: string;
  display_name?: string;
  role: UserRole;
  created_at: string;
}

/**
 * 登录请求
 */
export interface LoginRequest {
  username: string;
  password: string;
}

/**
 * 登录响应
 */
export interface LoginResponse {
  token: string;
  user: User;
}

/**
 * 初始化请求
 */
export interface InitRequest {
  username: string;
  password: string;
}

/**
 * 初始化状态响应
 */
export interface InitStatusResponse {
  initialized: boolean;
}

/**
 * 修改密码请求
 */
export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

/**
 * 检查系统是否已初始化
 */
export async function checkInitStatus(): Promise<InitStatusResponse> {
  return http<InitStatusResponse>("/api/v1/init/status");
}

/**
 * 初始化系统（创建第一个 super_admin 用户）
 */
export async function initializeSystem(
  data: InitRequest,
): Promise<LoginResponse> {
  return http<LoginResponse>("/api/v1/init/setup", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 用户登录
 */
export async function login(data: LoginRequest): Promise<LoginResponse> {
  return http<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 用户登出
 */
export async function logout(): Promise<void> {
  return http<void>("/api/v1/auth/logout", {
    method: "POST",
  });
}

/**
 * 获取当前用户信息
 */
export async function getCurrentUser(): Promise<User> {
  return http<User>("/api/v1/auth/me");
}

/**
 * 修改密码
 */
export async function changePassword(
  data: ChangePasswordRequest,
): Promise<void> {
  return http<void>("/api/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify(data),
  });
}
