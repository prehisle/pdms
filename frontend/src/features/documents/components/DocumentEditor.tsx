import { type FC, useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams, useParams } from "react-router-dom";
import Editor from "@monaco-editor/react";
import {
  Button,
  Input,
  InputNumber,
  Select,
  Space,
  message,
  Spin,
  Typography,
  Layout,
  Result,
} from "antd";
import {
  SaveOutlined,
  CloseOutlined,
  FullscreenExitOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { DOCUMENT_TYPES } from "../constants";
import { getDocumentTemplate } from "../templates";
import { HTMLPreview } from "./HTMLPreview";
import { YAMLPreview } from "./YAMLPreview";
import {
  bindDocument,
  createDocument,
  getDocument,
  updateDocument,
  type Document,
  type DocumentCreatePayload,
  type DocumentUpdatePayload,
} from "../../../api/documents";

const { Header, Content } = Layout;
const { Title } = Typography;

interface DocumentEditorProps {
  mode?: "create" | "edit";
  docId?: number;
  nodeId?: number;
  onClose?: () => void;
}

function extractDocumentContent(content?: Record<string, unknown> | null): string {
  if (!content) {
    return "";
  }
  const maybeData = (content as { data?: unknown }).data;
  if (typeof maybeData === "string") {
    return maybeData;
  }
  const maybePreview = (content as { preview?: unknown }).preview;
  if (typeof maybePreview === "string") {
    return maybePreview;
  }
  return "";
}

export const DocumentEditor: FC<DocumentEditorProps> = ({ mode, docId: docIdProp, nodeId: nodeIdProp, onClose }) => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { docId: docIdParam } = useParams<{ docId: string }>();
  const queryClient = useQueryClient();

  const parsedDocIdFromRoute = docIdParam ? Number.parseInt(docIdParam, 10) : undefined;
  const effectiveDocId = docIdProp ?? parsedDocIdFromRoute;
  const resolvedMode: "create" | "edit" = mode ?? (effectiveDocId ? "edit" : "create");
  const isEditMode = resolvedMode === "edit";

  const nodeIdQuery = searchParams.get("nodeId");
  const parsedNodeIdFromQuery = nodeIdQuery ? Number.parseInt(nodeIdQuery, 10) : undefined;
  const effectiveNodeId = nodeIdProp ?? parsedNodeIdFromQuery;

  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState<string>("overview");
  const [position, setPosition] = useState<number | undefined>();
  const [content, setContent] = useState("");

  const closeEditor = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    navigate(-1);
  }, [navigate, onClose]);

  const {
    data: existingDoc,
    isLoading: isLoadingDoc,
    error: loadError,
  } = useQuery<Document | null>({
    queryKey: ["document-detail", effectiveDocId],
    queryFn: async () => {
      if (!effectiveDocId) {
        return null;
      }
      return getDocument(effectiveDocId);
    },
    enabled: isEditMode && typeof effectiveDocId === "number",
  });

  useEffect(() => {
    if (!isEditMode || !existingDoc) {
      return;
    }
    setTitle(existingDoc.title ?? "");
    setDocumentType(existingDoc.type || "overview");
    setPosition(existingDoc.position);
    setContent(extractDocumentContent(existingDoc.content));
  }, [isEditMode, existingDoc]);

  useEffect(() => {
    if (isEditMode) {
      return;
    }
    const template = getDocumentTemplate(documentType);
    if (template) {
      setContent(template.data);
    } else {
      setContent("");
    }
  }, [isEditMode, documentType]);

  useEffect(() => {
    if (!isEditMode || !loadError) {
      return;
    }
    const errorMessage = loadError instanceof Error ? loadError.message : "文档加载失败";
    message.error(errorMessage);
    closeEditor();
  }, [isEditMode, loadError, closeEditor]);

  const editorLanguage = useMemo(() => {
    return documentType === "overview" ? "html" : "yaml";
  }, [documentType]);

  const handleTypeChange = useCallback((value: string) => {
    setDocumentType(value);
  }, []);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) {
        throw new Error("请输入文档标题");
      }
      if (effectiveNodeId == null) {
        throw new Error("缺少节点ID参数");
      }

      const template = getDocumentTemplate(documentType);
      const payload: DocumentCreatePayload = {
        title: title.trim(),
        type: documentType,
        position,
        content: template
          ? {
              format: template.format,
              data: content,
            }
          : undefined,
      };

      const doc = await createDocument(payload);
      await bindDocument(effectiveNodeId, doc.id);
      return doc;
    },
    onSuccess: async (_doc) => {
      message.success("文档创建成功");
      if (effectiveNodeId != null) {
        await queryClient.invalidateQueries({ queryKey: ["node-documents", effectiveNodeId] });
      }
      closeEditor();
    },
    onError: (error: Error) => {
      message.error(error.message || "创建失败");
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) {
        throw new Error("请输入文档标题");
      }
      if (!effectiveDocId) {
        throw new Error("文档ID不存在");
      }

      const template = getDocumentTemplate(documentType);
      const payload: DocumentUpdatePayload = {
        title: title.trim(),
        type: documentType,
        position,
        content: template
          ? {
              format: template.format,
              data: content,
            }
          : undefined,
      };

      return updateDocument(effectiveDocId, payload);
    },
    onSuccess: async () => {
      message.success("文档更新成功");
      if (effectiveDocId) {
        await queryClient.invalidateQueries({ queryKey: ["document-detail", effectiveDocId] });
      }
      if (effectiveNodeId != null) {
        await queryClient.invalidateQueries({ queryKey: ["node-documents", effectiveNodeId] });
      } else {
        await queryClient.invalidateQueries({ queryKey: ["node-documents"] });
      }
      closeEditor();
    },
    onError: (error: Error) => {
      message.error(error.message || "更新失败");
    },
  });

  const handleSave = useCallback(() => {
    if (isEditMode) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }, [isEditMode, createMutation, updateMutation]);

  const handleCancel = useCallback(() => {
    closeEditor();
  }, [closeEditor]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave();
      }
      if (e.key === "Escape") {
        handleCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSave, handleCancel]);

  if (isEditMode && isLoadingDoc) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%" }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (isEditMode && !isLoadingDoc && !existingDoc && !loadError) {
    return (
      <Result
        status="warning"
        title="未找到文档"
        subTitle="文档可能已被删除或暂不可用"
        extra={
          <Button type="primary" onClick={handleCancel}>
            返回
          </Button>
        }
      />
    );
  }

  return (
    <Layout style={{ height: "100%", overflow: "hidden" }}>
      <Header
        style={{
          background: "#fff",
          borderBottom: "1px solid #f0f0f0",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "64px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", flex: 1 }}>
          <Title level={5} style={{ margin: 0 }}>
            {isEditMode ? "编辑文档" : "新建文档"}
          </Title>

          <Input
            placeholder="请输入文档标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: "300px" }}
          />

          <Select
            value={documentType}
            onChange={handleTypeChange}
            options={DOCUMENT_TYPES}
            style={{ width: "160px" }}
            disabled={isEditMode}
          />

          <InputNumber
            placeholder="位置"
            value={position}
            onChange={(val) => setPosition(val ?? undefined)}
            min={1}
            style={{ width: "100px" }}
          />
        </div>

        <Space>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={createMutation.isPending || updateMutation.isPending}
          >
            保存 (Ctrl+S)
          </Button>
          <Button icon={<CloseOutlined />} onClick={handleCancel}>
            取消 (Esc)
          </Button>
          <Button icon={<FullscreenExitOutlined />} onClick={handleCancel} type="text" />
        </Space>
      </Header>

      <Content style={{ display: "flex", height: "calc(100% - 64px)" }}>
        <div
          style={{
            width: "50%",
            borderRight: "1px solid #f0f0f0",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              padding: "8px 16px",
              background: "#fafafa",
              borderBottom: "1px solid #f0f0f0",
              fontWeight: 500,
            }}
          >
            源码编辑
          </div>
          <div style={{ flex: 1, overflow: "hidden" }}>
            <Editor
              language={editorLanguage}
              value={content}
              onChange={(value) => setContent(value || "")}
              theme="vs-dark"
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                lineNumbers: "on",
                wordWrap: "on",
                automaticLayout: true,
                scrollBeyondLastLine: false,
                tabSize: 2,
                insertSpaces: true,
              }}
            />
          </div>
        </div>

        <div style={{ width: "50%", display: "flex", flexDirection: "column", background: "#fff" }}>
          <div
            style={{
              padding: "8px 16px",
              background: "#fafafa",
              borderBottom: "1px solid #f0f0f0",
              fontWeight: 500,
            }}
          >
            实时预览
          </div>
          <div style={{ flex: 1, overflow: "auto" }}>
            {documentType === "overview" ? (
              <HTMLPreview content={content} />
            ) : (
              <YAMLPreview content={content} documentType={documentType} />
            )}
          </div>
        </div>
      </Content>
    </Layout>
  );
};
