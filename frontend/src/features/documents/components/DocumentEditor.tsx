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
  List,
  Empty,
} from "antd";
import {
  SaveOutlined,
  CloseOutlined,
  FullscreenExitOutlined,
  PlusOutlined,
  MinusCircleOutlined,
  LinkOutlined,
  FileTextOutlined,
} from "@ant-design/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_MAP,
  DOCUMENT_TYPE_KEYS,
} from "../constants";
import { getDocumentTemplate } from "../templates";
import { HTMLPreview } from "./HTMLPreview";
import { YAMLPreview } from "./YAMLPreview";
import { resolveYamlPreview } from "../previewRegistry";
import {
  bindDocument,
  createDocument,
  getDocumentDetail,
  updateDocument,
  type Document,
  type DocumentCreatePayload,
  type DocumentUpdatePayload,
} from "../../../api/documents";
import type { MetadataValueType } from "../types";
import { DocumentReferenceManager } from "./DocumentReferenceManager";
import { DocumentTreeSelector } from "./DocumentTreeSelector";

const { Header, Content } = Layout;
const { Title, Text } = Typography;

// 新建文档时的待添加引用管理器
interface PendingReferencesManagerProps {
  references: Array<{ document_id: number; title: string }>;
  onAdd: (doc: Document) => void;
  onRemove: (docId: number) => void;
}

function PendingReferencesManager({ references, onAdd, onRemove }: PendingReferencesManagerProps) {
  const [selectorOpen, setSelectorOpen] = useState(false);

  const excludeDocIds = references.map(ref => ref.document_id);

  return (
    <div>
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Space>
            <LinkOutlined />
            <Typography.Text strong>引用的文档 ({references.length})</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              （文档创建后生效）
            </Typography.Text>
          </Space>
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setSelectorOpen(true)}
          >
            添加引用
          </Button>
        </div>

        {references.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="暂无引用文档"
            style={{ padding: "20px 0" }}
          />
        ) : (
          <List
            size="small"
            dataSource={references}
            renderItem={(ref) => (
              <List.Item
                actions={[
                  <Button
                    key="delete"
                    type="text"
                    size="small"
                    danger
                    icon={<MinusCircleOutlined />}
                    onClick={() => onRemove(ref.document_id)}
                  />
                ]}
              >
                <List.Item.Meta
                  avatar={<FileTextOutlined style={{ fontSize: 16 }} />}
                  title={<Text>{ref.title}</Text>}
                  description={
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      待添加
                    </Text>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Space>

      <DocumentTreeSelector
        open={selectorOpen}
        onCancel={() => setSelectorOpen(false)}
        onSelect={(doc) => {
          onAdd(doc);
          setSelectorOpen(false);
          message.success(`已选择：${doc.title}`);
        }}
        excludeDocIds={excludeDocIds}
        title="选择要引用的文档"
      />
    </div>
  );
}

function getDocumentTypeDefinition(type: string) {
  return DOCUMENT_TYPE_MAP[type as keyof typeof DOCUMENT_TYPE_MAP];
}

function getDocumentContentFormat(type: string): "html" | "yaml" {
  const definition = getDocumentTypeDefinition(type);
  return definition?.contentFormat === "html" ? "html" : "yaml";
}

interface DocumentEditorProps {
  mode?: "create" | "edit";
  docId?: number;
  nodeId?: number;
  onClose?: () => void;
}

interface MetadataEntry {
  id: string;
  key: string;
  type: MetadataValueType;
  value: string | string[];
}

function generateMetadataEntryId() {
  return `meta-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

function createEmptyEntry(): MetadataEntry {
  return {
    id: generateMetadataEntryId(),
    key: "",
    type: "string",
    value: "",
  };
}

function buildMetadataEntriesFromObject(source: Record<string, unknown>): MetadataEntry[] {
  return Object.entries(source).map(([key, value]) => {
    if (typeof value === "boolean") {
      return {
        id: generateMetadataEntryId(),
        key,
        type: "boolean",
        value: value ? "true" : "false",
      };
    }
    if (typeof value === "number") {
      return {
        id: generateMetadataEntryId(),
        key,
        type: "number",
        value: value.toString(),
      };
    }
    if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
      return {
        id: generateMetadataEntryId(),
        key,
        type: "string[]",
        value: value as string[],
      };
    }
    return {
      id: generateMetadataEntryId(),
      key,
      type: "string",
      value: typeof value === "string" ? value : JSON.stringify(value),
    };
  });
}

function getDefaultValueForType(
  type: MetadataValueType,
  previous?: string | string[],
): string | string[] {
  switch (type) {
    case "number": {
      if (typeof previous === "string" && previous.trim() && !Number.isNaN(Number(previous))) {
        return previous;
      }
      return "";
    }
    case "boolean": {
      if (previous === "true" || previous === "false") {
        return previous;
      }
      return "true";
    }
    case "string[]": {
      if (Array.isArray(previous)) {
        return previous;
      }
      if (typeof previous === "string" && previous.trim().length > 0) {
        return [previous.trim()];
      }
      return [];
    }
    case "string":
    default: {
      if (typeof previous === "string") {
        return previous;
      }
      return "";
    }
  }
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

  const defaultDocumentType = DOCUMENT_TYPE_KEYS[0] ?? "overview";
  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState<string>(defaultDocumentType);
  const [position, setPosition] = useState<number | undefined>();
  const [content, setContent] = useState("");
  const [metadataDifficulty, setMetadataDifficulty] = useState<number | null>(null);
  const [metadataTags, setMetadataTags] = useState<string[]>([]);
  const [metadataEntries, setMetadataEntries] = useState<MetadataEntry[]>([]);
  const [pendingReferences, setPendingReferences] = useState<Array<{ document_id: number; title: string }>>([]);

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
	return getDocumentDetail(effectiveDocId);
    },
    enabled: isEditMode && typeof effectiveDocId === "number",
  });

  useEffect(() => {
    if (!isEditMode || !existingDoc) {
      return;
    }
    setTitle(existingDoc.title ?? "");
    const nextType =
      existingDoc.type && getDocumentTypeDefinition(existingDoc.type)
        ? existingDoc.type
        : defaultDocumentType;
    setDocumentType(nextType);
    setPosition(existingDoc.position);
    setContent(extractDocumentContent(existingDoc.content));
    const metadata = (existingDoc.metadata ?? {}) as Record<string, unknown>;
    const difficultyValue = metadata.difficulty;
    setMetadataDifficulty(typeof difficultyValue === "number" ? difficultyValue : null);
    const tagsValue = metadata.tags;
    if (Array.isArray(tagsValue)) {
      setMetadataTags(tagsValue.map((tag) => String(tag)).filter((tag) => tag.trim().length > 0));
    } else {
      setMetadataTags([]);
    }
    const restMetadata = { ...metadata };
    delete restMetadata.difficulty;
    delete restMetadata.tags;
    setMetadataEntries(buildMetadataEntriesFromObject(restMetadata));
  }, [isEditMode, existingDoc, defaultDocumentType]);

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
    if (!isEditMode) {
      setMetadataDifficulty(null);
      setMetadataTags([]);
      setMetadataEntries([]);
    }
  }, [isEditMode]);

  useEffect(() => {
    if (!isEditMode || !loadError) {
      return;
    }
    const errorMessage = loadError instanceof Error ? loadError.message : "文档加载失败";
    message.error(errorMessage);
    closeEditor();
  }, [isEditMode, loadError, closeEditor]);

  const hasCustomPreview = useMemo(() => resolveYamlPreview(documentType) != null, [documentType]);

  const editorLanguage = useMemo(() => {
    return getDocumentContentFormat(documentType);
  }, [documentType]);

  const handleTypeChange = useCallback((value: string) => {
    setDocumentType(value);
  }, []);

  const buildMetadataPayload = useCallback((): Record<string, any> => {
    const payload: Record<string, any> = {};

    // 处理引用字段
    if (isEditMode && existingDoc?.metadata?.references) {
      // 编辑模式：保留原文档中的 references 字段（由 DocumentReferenceManager 管理）
      payload.references = existingDoc.metadata.references;
    } else if (!isEditMode && pendingReferences.length > 0) {
      // 新建模式：使用待添加的引用
      payload.references = pendingReferences.map(ref => ({
        document_id: ref.document_id,
        title: ref.title,
        added_at: new Date().toISOString(),
      }));
    }

    if (metadataDifficulty != null) {
      payload.difficulty = metadataDifficulty;
    }
    if (metadataTags.length > 0) {
      const trimmedTags = Array.from(
        new Set(metadataTags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)),
      );
      if (trimmedTags.length > 0) {
        payload.tags = trimmedTags;
      }
    }
    metadataEntries.forEach((entry) => {
      const key = entry.key.trim();
      if (!key || key === "difficulty" || key === "tags" || key === "references") {
        return;
      }
      switch (entry.type) {
        case "string": {
          const value = (entry.value as string).trim();
          if (value.length > 0) {
            payload[key] = value;
          }
          break;
        }
        case "number": {
          const raw = (entry.value as string).trim();
          if (!raw) {
            break;
          }
          const numeric = Number(raw);
          if (Number.isNaN(numeric)) {
            throw new Error(`元数据字段"${key}"的值必须是数字`);
          }
          payload[key] = numeric;
          break;
        }
        case "boolean": {
          const boolValue = entry.value as string;
          if (boolValue === "true" || boolValue === "false") {
            payload[key] = boolValue === "true";
          } else {
            throw new Error(`元数据字段"${key}"的布尔值只能为 true 或 false`);
          }
          break;
        }
        case "string[]": {
          const items = Array.isArray(entry.value) ? entry.value : [];
          const normalized = Array.from(
            new Set(items.map((item) => item.trim()).filter((item) => item.length > 0)),
          );
          if (normalized.length > 0) {
            payload[key] = normalized;
          }
          break;
        }
        default:
          break;
      }
    });
    return payload;
  }, [metadataDifficulty, metadataEntries, metadataTags, isEditMode, existingDoc, pendingReferences]);

  const renderMetadataValueControl = useCallback(
    (entry: MetadataEntry) => {
      switch (entry.type) {
        case "string":
          return (
            <Input
              placeholder="值"
              value={typeof entry.value === "string" ? entry.value : ""}
              onChange={(event) =>
                setMetadataEntries((prev) =>
                  prev.map((item) =>
                    item.id === entry.id ? { ...item, value: event.target.value } : item,
                  ),
                )
              }
              style={{ minWidth: 200 }}
            />
          );
        case "number":
          return (
            <Input
              placeholder="数值"
              value={typeof entry.value === "string" ? entry.value : ""}
              onChange={(event) =>
                setMetadataEntries((prev) =>
                  prev.map((item) =>
                    item.id === entry.id ? { ...item, value: event.target.value } : item,
                  ),
                )
              }
              style={{ minWidth: 160 }}
              inputMode="decimal"
            />
          );
        case "boolean":
          return (
            <Select
              value={entry.value as string}
              options={[
                { value: "true", label: "true" },
                { value: "false", label: "false" },
              ]}
              onChange={(value: string) =>
                setMetadataEntries((prev) =>
                  prev.map((item) => (item.id === entry.id ? { ...item, value } : item)),
                )
              }
              style={{ width: 120 }}
            />
          );
        case "string[]":
          return (
            <Select
              mode="tags"
              allowClear
              placeholder="输入多个值"
              value={Array.isArray(entry.value) ? entry.value : []}
              onChange={(values: string[]) =>
                setMetadataEntries((prev) =>
                  prev.map((item) =>
                    item.id === entry.id ? { ...item, value: values } : item,
                  ),
                )
              }
              style={{ minWidth: 220 }}
            />
          );
        default:
          return null;
      }
    },
    [setMetadataEntries],
  );

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
      const metadataPayload = buildMetadataPayload();
      if (Object.keys(metadataPayload).length > 0) {
        payload.metadata = metadataPayload;
      }

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
        metadata: buildMetadataPayload(),
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

  const isEmbedded = typeof onClose === "function";
  const containerHeight = isEmbedded ? "100%" : "100vh";
  const contentHeight = isEmbedded ? "calc(100% - 64px)" : "calc(100vh - 64px)";

  if (isEditMode && isLoadingDoc) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: containerHeight }}>
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
    <Layout style={{ height: containerHeight, overflow: "hidden" }}>
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

          <Select
            mode="tags"
            allowClear
            placeholder="标签"
            value={metadataTags}
            onChange={(values) =>
              setMetadataTags(
                Array.from(new Set(values.map((val) => val.trim()).filter((val) => val.length > 0))),
              )
            }
            style={{ minWidth: "220px" }}
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

      <Content style={{ display: "flex", height: contentHeight }}>
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
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #f0f0f0",
            }}
          >
            <Space direction="vertical" style={{ width: "100%" }} size="middle">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <Typography.Text strong>额外元数据</Typography.Text>
                <Button
                  type="dashed"
                  icon={<PlusOutlined />}
                  onClick={() => setMetadataEntries((prev) => [...prev, createEmptyEntry()])}
                >
                  添加字段
                </Button>
              </div>
              <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                可为文档增加自定义键值对，支持字符串、数字、布尔值和字符串数组类型。
              </Typography.Paragraph>
              {metadataEntries.length === 0 ? (
                <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                  尚未添加额外元数据。
                </Typography.Paragraph>
              ) : (
                <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                  {metadataEntries.map((entry) => (
                    <Space
                      key={entry.id}
                      wrap
                      align="start"
                      style={{
                        width: "100%",
                        padding: "12px",
                        border: "1px solid #f0f0f0",
                        borderRadius: 6,
                        background: "#fafafa",
                      }}
                    >
                      <Input
                        placeholder="字段名"
                        value={entry.key}
                        onChange={(event) =>
                          setMetadataEntries((prev) =>
                            prev.map((item) =>
                              item.id === entry.id ? { ...item, key: event.target.value } : item,
                            ),
                          )
                        }
                        style={{ minWidth: 160 }}
                      />
                      <Select
                        value={entry.type}
                        options={[
                          { value: "string", label: "字符串" },
                          { value: "number", label: "数字" },
                          { value: "boolean", label: "布尔" },
                          { value: "string[]", label: "字符串数组" },
                        ]}
                        onChange={(value: MetadataValueType) =>
                          setMetadataEntries((prev) =>
                            prev.map((item) =>
                              item.id === entry.id
                                ? {
                                    ...item,
                                    type: value,
                                    value: getDefaultValueForType(value, item.value),
                                  }
                                : item,
                            ),
                          )
                        }
                        style={{ width: 140 }}
                      />
                      {renderMetadataValueControl(entry)}
                      <Button
                        icon={<MinusCircleOutlined />}
                        onClick={() =>
                          setMetadataEntries((prev) => prev.filter((item) => item.id !== entry.id))
                        }
                      />
                    </Space>
                  ))}
                </Space>
              )}
            </Space>
          </div>

          {/* 文档引用管理区域 */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid #f0f0f0",
              maxHeight: "300px",
              overflow: "auto",
            }}
          >
            {isEditMode && existingDoc ? (
              <DocumentReferenceManager
                document={existingDoc}
                canEdit={true}
                onDocumentUpdated={(updatedDoc) => {
                  // 更新缓存中的文档数据
                  queryClient.setQueryData(["document-detail", effectiveDocId], updatedDoc);
                }}
              />
            ) : (
              <PendingReferencesManager
                references={pendingReferences}
                onAdd={(doc) => {
                  setPendingReferences(prev => [...prev, { document_id: doc.id, title: doc.title }]);
                }}
                onRemove={(docId) => {
                  setPendingReferences(prev => prev.filter(ref => ref.document_id !== docId));
                }}
              />
            )}
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
            {hasCustomPreview ? (
              <YAMLPreview content={content} documentType={documentType} />
            ) : getDocumentContentFormat(documentType) === "html" ? (
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
