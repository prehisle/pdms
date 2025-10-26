import { useState } from "react";
import { Form, Input, Button, Card, Typography, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate } from "react-router-dom";

const { Title, Paragraph } = Typography;

/**
 * 初始化表单数据
 */
interface InitFormValues {
  username: string;
  password: string;
  confirmPassword: string;
}

/**
 * 系统初始化页面
 */
export function InitializePage() {
  const [loading, setLoading] = useState(false);
  const { initialize } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const handleSubmit = async (values: InitFormValues) => {
    setLoading(true);
    try {
      await initialize({
        username: values.username,
        password: values.password,
      });
      message.success("系统初始化成功！");
      navigate("/");
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "初始化失败，请重试",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "100vh",
        background: "#f0f2f5",
      }}
    >
      <Card style={{ width: 400 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <Title level={2}>系统初始化</Title>
          <Paragraph type="secondary">
            欢迎使用 YDMS 题库管理系统
            <br />
            请创建超级管理员账号
          </Paragraph>
        </div>

        <Form
          form={form}
          name="initialize"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: "请输入用户名" },
              { min: 3, message: "用户名至少 3 个字符" },
              {
                pattern: /^[a-zA-Z0-9_-]+$/,
                message: "用户名只能包含字母、数字、下划线和连字符",
              },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: "请输入密码" },
              { min: 8, message: "密码至少 8 个字符" },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={["password"]}
            rules={[
              { required: true, message: "请确认密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="确认密码"
              autoComplete="new-password"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              block
              size="large"
            >
              创建管理员账号
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
