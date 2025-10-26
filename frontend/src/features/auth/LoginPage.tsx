import { useState } from "react";
import { Form, Input, Button, Card, Typography, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import { useAuth } from "../../contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";

const { Title } = Typography;

/**
 * 登录表单数据
 */
interface LoginFormValues {
  username: string;
  password: string;
}

/**
 * 登录页面
 */
export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form] = Form.useForm();

  // 获取重定向目标，默认为首页
  const from = (location.state as { from?: string })?.from || "/";

  const handleSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    try {
      await login({
        username: values.username,
        password: values.password,
      });
      message.success("登录成功！");
      navigate(from, { replace: true });
    } catch (error) {
      message.error(
        error instanceof Error ? error.message : "登录失败，请检查用户名和密码",
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
          <Title level={2}>YDMS 题库管理系统</Title>
        </div>

        <Form
          form={form}
          name="login"
          onFinish={handleSubmit}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="用户名"
              autoComplete="username"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
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
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
