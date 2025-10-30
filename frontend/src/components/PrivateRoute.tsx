import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Spin, Space, Typography } from "antd";
import { useAuth } from "../contexts/AuthContext";

/**
 * PrivateRoute props
 */
interface PrivateRouteProps {
  children: ReactNode;
}

/**
 * 私有路由组件，需要认证才能访问
 */
export function PrivateRoute({ children }: PrivateRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 正在加载用户信息
  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <Space direction="vertical" align="center" size="middle">
          <Spin size="large" />
          <Typography.Text type="secondary">加载中...</Typography.Text>
        </Space>
      </div>
    );
  }

  // 未登录，重定向到登录页面
  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // 已认证，渲染子组件
  return <>{children}</>;
}
