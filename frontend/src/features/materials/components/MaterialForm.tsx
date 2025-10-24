import React, { useEffect, useState } from "react";
import {
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  Button,
  Space,
  Checkbox,
  message,
  Row,
  Col,
} from "antd";
import { PlusOutlined, MinusCircleOutlined } from "@ant-design/icons";
import {
  Material,
  MaterialType,
  QuestionType,
  MaterialCreatePayload,
  MaterialUpdatePayload,
  createMaterial,
  updateMaterial,
  QuestionOption,
  BlankConfig,
} from "../../../api/materials";

const { TextArea } = Input;

interface MaterialFormProps {
  visible: boolean;
  material?: Material;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const MaterialForm: React.FC<MaterialFormProps> = ({
  visible,
  material,
  onSuccess,
  onCancel,
}) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [resourceType, setResourceType] = useState<MaterialType>("question");
  const [questionType, setQuestionType] = useState<QuestionType | undefined>();

  useEffect(() => {
    if (visible && material) {
      form.setFieldsValue({
        title: material.title,
        resource_type: material.metadata.resource_type,
        question_type: material.metadata.question_type,
        difficulty: material.metadata.difficulty,
        tags: material.metadata.tags?.join(", "),
        options: material.metadata.options || [],
        blanks: material.metadata.blanks || [],
        answer: material.metadata.answer,
        analysis: material.metadata.analysis,
      });
      setResourceType(material.metadata.resource_type);
      setQuestionType(material.metadata.question_type);
    } else if (visible) {
      form.resetFields();
      setResourceType("question");
      setQuestionType(undefined);
    }
  }, [visible, material, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const tags = values.tags
        ? values.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
        : [];

      const metadata: any = {
        resource_type: values.resource_type,
        tags,
      };

      if (values.resource_type === "question") {
        metadata.question_type = values.question_type;
        metadata.difficulty = values.difficulty;
        metadata.answer = values.answer;
        metadata.analysis = values.analysis;

        if (
          values.question_type === "single_choice" ||
          values.question_type === "multi_choice" ||
          values.question_type === "multi_blank_choice"
        ) {
          metadata.options = values.options || [];
        }

        if (
          values.question_type === "fill_blank" ||
          values.question_type === "multi_blank_choice"
        ) {
          metadata.blanks = values.blanks || [];
        }
      }

      if (material) {
        const payload: MaterialUpdatePayload = {
          title: values.title,
          metadata,
        };
        await updateMaterial(material.id, payload);
        message.success("更新成功");
      } else {
        const payload: MaterialCreatePayload = {
          title: values.title,
          metadata,
        };
        await createMaterial(payload);
        message.success("创建成功");
      }

      onSuccess?.();
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(`保存失败: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  const renderQuestionFields = () => {
    if (resourceType !== "question" || !questionType) return null;

    const hasOptions =
      questionType === "single_choice" ||
      questionType === "multi_choice" ||
      questionType === "multi_blank_choice";
    const hasBlanks =
      questionType === "fill_blank" || questionType === "multi_blank_choice";

    return (
      <>
        <Form.Item
          label="难度"
          name="difficulty"
          rules={[{ required: true, message: "请输入难度" }]}
        >
          <InputNumber min={1} max={5} style={{ width: "100%" }} />
        </Form.Item>

        {hasOptions && (
          <Form.Item label="选项">
            <Form.List name="options">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space
                      key={key}
                      style={{ display: "flex", marginBottom: 8 }}
                      align="baseline"
                    >
                      <Form.Item
                        {...restField}
                        name={[name, "label"]}
                        rules={[{ required: true, message: "请输入选项标签" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <Input placeholder="选项标签 (如 A, B, C)" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, "content"]}
                        rules={[{ required: true, message: "请输入选项内容" }]}
                        style={{ marginBottom: 0, flex: 1 }}
                      >
                        <Input placeholder="选项内容" />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, "is_correct"]}
                        valuePropName="checked"
                        style={{ marginBottom: 0 }}
                      >
                        <Checkbox>正确答案</Checkbox>
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} />
                    </Space>
                  ))}
                  <Form.Item>
                    <Button
                      type="dashed"
                      onClick={() => add()}
                      block
                      icon={<PlusOutlined />}
                    >
                      添加选项
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
        )}

        {hasBlanks && (
          <Form.Item label="填空配置">
            <Form.List name="blanks">
              {(fields, { add, remove }) => (
                <>
                  {fields.map(({ key, name, ...restField }) => (
                    <Space
                      key={key}
                      style={{ display: "flex", marginBottom: 8 }}
                      align="baseline"
                    >
                      <Form.Item
                        {...restField}
                        name={[name, "index"]}
                        rules={[{ required: true, message: "请输入空格序号" }]}
                        style={{ marginBottom: 0 }}
                      >
                        <InputNumber
                          placeholder="空格序号"
                          min={1}
                          style={{ width: 100 }}
                        />
                      </Form.Item>
                      <Form.Item
                        {...restField}
                        name={[name, "acceptable_answers"]}
                        rules={[{ required: true, message: "请输入可接受答案" }]}
                        style={{ marginBottom: 0, flex: 1 }}
                      >
                        <Select
                          mode="tags"
                          placeholder="可接受答案 (多个)"
                          style={{ width: "100%" }}
                        />
                      </Form.Item>
                      <MinusCircleOutlined onClick={() => remove(name)} />
                    </Space>
                  ))}
                  <Form.Item>
                    <Button
                      type="dashed"
                      onClick={() => add()}
                      block
                      icon={<PlusOutlined />}
                    >
                      添加空格
                    </Button>
                  </Form.Item>
                </>
              )}
            </Form.List>
          </Form.Item>
        )}

        <Form.Item
          label="答案"
          name="answer"
          rules={[{ required: true, message: "请输入答案" }]}
        >
          <TextArea rows={2} placeholder="答案" />
        </Form.Item>

        <Form.Item label="解析" name="analysis">
          <TextArea rows={4} placeholder="题目解析（可选）" />
        </Form.Item>
      </>
    );
  };

  return (
    <Modal
      title={material ? "编辑资料" : "新建资料"}
      open={visible}
      onOk={handleSubmit}
      onCancel={onCancel}
      confirmLoading={loading}
      width={800}
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          label="标题"
          name="title"
          rules={[{ required: true, message: "请输入标题" }]}
        >
          <Input placeholder="资料标题" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="资料类型"
              name="resource_type"
              rules={[{ required: true, message: "请选择资料类型" }]}
            >
              <Select
                placeholder="选择资料类型"
                onChange={(value) => {
                  setResourceType(value);
                  if (value !== "question") {
                    setQuestionType(undefined);
                    form.setFieldValue("question_type", undefined);
                  }
                }}
              >
                <Select.Option value="question">题目</Select.Option>
                <Select.Option value="overview">概览</Select.Option>
                <Select.Option value="dictation">默写</Select.Option>
                <Select.Option value="reference">参考资料</Select.Option>
              </Select>
            </Form.Item>
          </Col>

          {resourceType === "question" && (
            <Col span={12}>
              <Form.Item
                label="题目类型"
                name="question_type"
                rules={[{ required: true, message: "请选择题目类型" }]}
              >
                <Select
                  placeholder="选择题目类型"
                  onChange={(value) => setQuestionType(value)}
                >
                  <Select.Option value="single_choice">单选题</Select.Option>
                  <Select.Option value="multi_choice">多选题</Select.Option>
                  <Select.Option value="multi_blank_choice">
                    多空选择题
                  </Select.Option>
                  <Select.Option value="fill_blank">填空题</Select.Option>
                  <Select.Option value="essay">问答题</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          )}
        </Row>

        <Form.Item label="标签" name="tags">
          <Input placeholder="标签，用逗号分隔" />
        </Form.Item>

        {renderQuestionFields()}
      </Form>
    </Modal>
  );
};
