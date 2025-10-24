import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Spin } from "antd";
import App from "./App";

const DocumentEditor = lazy(() =>
  import("./features/documents/components/DocumentEditor").then((module) => ({
    default: module.DocumentEditor,
  }))
);

const LoadingFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
    <Spin size="large" tip="加载编辑器..." />
  </div>
);

export const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route
          path="/documents/new"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <DocumentEditor />
            </Suspense>
          }
        />
        <Route
          path="/documents/:docId/edit"
          element={
            <Suspense fallback={<LoadingFallback />}>
              <DocumentEditor />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
};
