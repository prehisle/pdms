import { http } from "./http";

/**
 * 课程（对应 NDR 的根节点）
 */
export interface Course {
  id: number;
  name: string;
  slug?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 课程列表响应
 */
export interface CoursesListResponse {
  courses: Course[];
  total: number;
}

/**
 * 创建课程请求
 */
export interface CreateCourseRequest {
  name: string;
  slug?: string;
}

/**
 * 获取课程列表（根据用户权限过滤）
 */
export async function listCourses(): Promise<CoursesListResponse> {
  return http<CoursesListResponse>("/api/v1/courses");
}

/**
 * 创建课程（仅 super_admin）
 */
export async function createCourse(
  data: CreateCourseRequest,
): Promise<Course> {
  return http<Course>("/api/v1/courses", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/**
 * 删除课程（仅 super_admin）
 */
export async function deleteCourse(courseId: number): Promise<void> {
  return http<void>(`/api/v1/courses/${courseId}`, {
    method: "DELETE",
  });
}
