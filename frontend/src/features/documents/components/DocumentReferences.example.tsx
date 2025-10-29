/**
 * 文档引用功能集成示例
 *
 * 本文件展示如何在文档编辑器和文档详情页中集成引用管理功能
 */

import { useState } from "react";
import { Col, Row } from "antd";
import type { Document } from "../../../api/documents";
import { DocumentReferenceManager } from "./DocumentReferenceManager";

/**
 * 示例 1: 在文档编辑器中集成引用管理
 *
 * 在 DocumentEditor.tsx 中，可以在布局中添加引用管理器：
 */
export function DocumentEditorWithReferences() {
  const [document, setDocument] = useState<Document | null>(null);
  const canEdit = true; // 根据用户权限判断

  if (!document) {
    return null;
  }

  return (
    <Row gutter={16}>
      {/* 主编辑区域 */}
      <Col span={16}>
        {/* 现有的编辑器组件 */}
        <div>编辑器内容...</div>
      </Col>

      {/* 右侧侧边栏 */}
      <Col span={8}>
        {/* 引用管理器 */}
        <DocumentReferenceManager
          document={document}
          canEdit={canEdit}
          onDocumentUpdated={(updatedDoc) => {
            setDocument(updatedDoc);
            // 可选：更新其他相关状态
          }}
        />

        {/* 其他侧边栏内容 */}
        <div style={{ marginTop: 16 }}>
          {/* 元数据、版本历史等 */}
        </div>
      </Col>
    </Row>
  );
}

/**
 * 示例 2: 在文档详情页中显示引用关系
 *
 * 在文档详情页中同样使用 DocumentReferenceManager 组件
 */
export function DocumentDetailWithReferences() {
  const [document, setDocument] = useState<Document | null>(null);
  const canEdit = false; // 详情页通常只读

  if (!document) {
    return null;
  }

  return (
    <div>
      {/* 文档基本信息 */}
      <div>
        <h2>{document.title}</h2>
        {/* 其他文档信息 */}
      </div>

      {/* 文档内容 */}
      <div style={{ marginTop: 16, marginBottom: 16 }}>
        {/* 文档内容渲染 */}
      </div>

      {/* 引用关系 */}
      <DocumentReferenceManager
        document={document}
        canEdit={canEdit}
        onDocumentUpdated={setDocument}
      />
    </div>
  );
}

/**
 * 集成步骤：
 *
 * 1. 导入组件：
 *    import { DocumentReferenceManager } from "./components/DocumentReferenceManager";
 *
 * 2. 在合适的位置添加组件：
 *    <DocumentReferenceManager
 *      document={currentDocument}
 *      canEdit={hasEditPermission}
 *      onDocumentUpdated={handleDocumentUpdated}
 *    />
 *
 * 3. 权限控制：
 *    - canEdit 属性根据用户角色和权限设置
 *    - 管理员和课程管理员可以编辑引用
 *    - 校对员只能查看引用
 *
 * 4. 状态同步：
 *    - 通过 onDocumentUpdated 回调更新文档状态
 *    - 确保引用变更后UI正确更新
 */

// 导出单独的组件供使用
export { DocumentReferenceManager } from "./DocumentReferenceManager";
export { DocumentReferenceList } from "./DocumentReferenceList";
export { DocumentTreeSelector } from "./DocumentTreeSelector";
