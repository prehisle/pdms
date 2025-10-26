import { http } from "./http";
import type { User, UserRole } from "./auth";

// Re-export types for convenience
export type { User, UserRole } from "./auth";

/**
 * 创建用户请求
 */
export interface CreateUserRequest {
  username: string;
  password: string;
  role: UserRole;
  display_name?: string;
}

/**
 * 用户列表响应
 */
export interface UsersListResponse {
  users: User[];
  total: number;
}

/**
 * 课程权限
 */
export interface CoursePermission {
  id: number;
  user_id: number;
  root_node_id: number;
  created_at: string;
}

/**
 * 获取用户列表
 */
export async function listUsers(): Promise<UsersListResponse> {
  return http<UsersListResponse>("/api/v1/users");
}

/**
 * 获取单个用户信息
 */
export async function getUser(userId: number): Promise<User> {
  return http<User>(`/api/v1/users/${userId}`);
}

/**
 * 创建用户（仅 super_admin 和 course_admin）
 */
export async function createUser(data: CreateUserRequest): Promise<User> {
  return http<User>("/api/v1/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 删除用户
 */
export async function deleteUser(userId: number): Promise<void> {
  return http<void>(`/api/v1/users/${userId}`, {
    method: "DELETE",
  });
}

/**
 * 获取用户的课程权限列表
 */
export async function getUserCourses(
  userId: number,
): Promise<{ course_ids: number[] }> {
  return http<{ course_ids: number[] }>(`/api/v1/users/${userId}/courses`);
}

/**
 * 授予用户课程权限
 */
export async function grantCoursePermission(
  userId: number,
  rootNodeId: number,
): Promise<void> {
  return http<void>(`/api/v1/users/${userId}/courses`, {
    method: "POST",
    body: JSON.stringify({ root_node_id: rootNodeId }),
  });
}

/**
 * 撤销用户课程权限
 */
export async function revokeCoursePermission(
  userId: number,
  rootNodeId: number,
): Promise<void> {
  return http<void>(`/api/v1/users/${userId}/courses/${rootNodeId}`, {
    method: "DELETE",
  });
}
