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
  createDocument,
  updateDocument,
  bindDocument,
  type Document,
  type DocumentCreatePayload,
  type DocumentUpdatePayload,
} from "../../../api/documents";

const { Header, Content } = Layout;
const { Title } = Typography;

interface DocumentEditorProps {}

export const DocumentEditor: FC<DocumentEditorProps> = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { docId } = useParams<{ docId: string }>();
  const queryClient = useQueryClient();

  const isEditMode = Boolean(docId);
  const nodeId = searchParams.get("nodeId");

  const [title, setTitle] = useState("");
  const [documentType, setDocumentType] = useState<string>("overview");
  const [position, setPosition] = useState<number | undefined>();
  const [content, setContent] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Load existing document for edit mode
  const { data: existingDoc, isLoading: isLoadingDoc } = useQuery({
    queryKey: ["document", docId],
    queryFn: async () => {
      // This would be a real API call to fetch a single document
      // For now we'll return null as we don't have the endpoint yet
      return null as Document | null;
    },
    enabled: isEditMode && Boolean(docId),
  });

  // Initialize editor with template or existing content
  useEffect(() => {
    if (isEditMode && existingDoc) {
      // Edit mode: load existing document
      setTitle(existingDoc.title);
      setDocumentType(existingDoc.type || "overview");
      setPosition(existingDoc.position);

      // Extract content data
      if (existingDoc.content) {
        if (typeof existingDoc.content === 'object' && 'data' in existingDoc.content) {
          setContent(existingDoc.content.data as string);
        } else if (typeof existingDoc.content === 'object' && 'preview' in existingDoc.content) {
          setContent(existingDoc.content.preview as string);
        }
      }
    } else if (!isEditMode && documentType) {
      // Create mode: load template
      const template = getDocumentTemplate(documentType);
      if (template && !content) {
        setContent(template.data);
      }
    }
  }, [isEditMode, existingDoc, documentType, content]);

  const editorLanguage = useMemo(() => {
    return documentType === "overview" ? "html" : "yaml";
  }, [documentType]);

  const handleTypeChange = (value: string) => {
    setDocumentType(value);
    const template = getDocumentTemplate(value);
    if (template) {
      setContent(template.data);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!title.trim()) {
        throw new Error("请输入文档标题");
      }
      if (!nodeId) {
        throw new Error("缺少节点ID参数");
      }

      const template = getDocumentTemplate(documentType);
      const payload: DocumentCreatePayload = {
        title: title.trim(),
        type: documentType,
        position,
        content: template ? {
          format: template.format,
          data: content,
        } : undefined,
      };

      const doc = await createDocument(payload);
      await bindDocument(parseInt(nodeId), doc.id);
      return doc;
    },
    onSuccess: () => {
      message.success("文档创建成功");
      if (nodeId) {
        queryClient.invalidateQueries({ queryKey: ["node-documents", parseInt(nodeId)] });
      }
      navigate(-1);
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
      if (!docId) {
        throw new Error("文档ID不存在");
      }

      const template = getDocumentTemplate(documentType);
      const payload: DocumentUpdatePayload = {
        title: title.trim(),
        type: documentType,
        position,
        content: template ? {
          format: template.format,
          data: content,
        } : undefined,
      };

      return updateDocument(parseInt(docId), payload);
    },
    onSuccess: () => {
      message.success("文档更新成功");
      queryClient.invalidateQueries({ queryKey: ["node-documents"] });
      navigate(-1);
    },
    onError: (error: Error) => {
      message.error(error.message || "更新失败");
    },
  });

  const handleSave = useCallback(() => {
    setIsSaving(true);
    if (isEditMode) {
      updateMutation.mutate();
    } else {
      createMutation.mutate();
    }
  }, [isEditMode, createMutation, updateMutation]);

  const handleCancel = useCallback(() => {
    navigate(-1);
  }, [navigate]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Esc to cancel
      if (e.key === 'Escape') {
        handleCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave, handleCancel]);

  if (isLoadingDoc) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Header
        style={{
          background: '#fff',
          borderBottom: '1px solid #f0f0f0',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '64px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: 1 }}>
          <Title level={5} style={{ margin: 0 }}>
            {isEditMode ? "编辑文档" : "新建文档"}
          </Title>

          <Input
            placeholder="请输入文档标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{ width: '300px' }}
          />

          <Select
            value={documentType}
            onChange={handleTypeChange}
            options={DOCUMENT_TYPES}
            style={{ width: '160px' }}
            disabled={isEditMode} // Can't change type in edit mode
          />

          <InputNumber
            placeholder="位置"
            value={position}
            onChange={(val) => setPosition(val || undefined)}
            min={1}
            style={{ width: '100px' }}
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
          <Button
            icon={<CloseOutlined />}
            onClick={handleCancel}
          >
            取消 (Esc)
          </Button>
          <Button
            icon={<FullscreenExitOutlined />}
            onClick={handleCancel}
            type="text"
          />
        </Space>
      </Header>

      <Content style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
        <div style={{
          width: '50%',
          borderRight: '1px solid #f0f0f0',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{
            padding: '8px 16px',
            background: '#fafafa',
            borderBottom: '1px solid #f0f0f0',
            fontWeight: 500,
          }}>
            源码编辑
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <Editor
              language={editorLanguage}
              value={content}
              onChange={(value) => setContent(value || "")}
              theme="vs-dark"
              options={{
                minimap: { enabled: true },
                fontSize: 14,
                lineNumbers: 'on',
                wordWrap: 'on',
                automaticLayout: true,
                scrollBeyondLastLine: false,
                tabSize: 2,
                insertSpaces: true,
              }}
            />
          </div>
        </div>

        <div style={{ width: '50%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
          <div style={{
            padding: '8px 16px',
            background: '#fafafa',
            borderBottom: '1px solid #f0f0f0',
            fontWeight: 500,
          }}>
            实时预览
          </div>
          <div style={{ flex: 1, overflow: 'auto' }}>
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
