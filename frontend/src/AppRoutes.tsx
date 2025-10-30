import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Spin, Space, Typography } from "antd";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import { PrivateRoute } from "./components/PrivateRoute";
import { LoginPage } from "./features/auth";

const DocumentEditor = lazy(() =>
  import("./features/documents/components/DocumentEditor").then((module) => ({
    default: module.DocumentEditor,
  }))
);

const LoadingFallback = () => (
  <div
    style={{
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      height: "100vh",
    }}
  >
    <Space direction="vertical" align="center" size="middle">
      <Spin size="large" />
      <Typography.Text type="secondary">加载编辑器...</Typography.Text>
    </Space>
  </div>
);

export const AppRoutes = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* 公开路由 */}
          <Route path="/login" element={<LoginPage />} />
          {/* 受保护的路由 */}
          <Route
            path="/"
            element={
              <PrivateRoute>
                <App />
              </PrivateRoute>
            }
          />
          <Route
            path="/documents/new"
            element={
              <PrivateRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <DocumentEditor />
                </Suspense>
              </PrivateRoute>
            }
          />
          <Route
            path="/documents/:docId/edit"
            element={
              <PrivateRoute>
                <Suspense fallback={<LoadingFallback />}>
                  <DocumentEditor />
                </Suspense>
              </PrivateRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
};
