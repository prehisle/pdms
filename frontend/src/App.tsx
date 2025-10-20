import { Layout, Typography, Space, Button } from "antd";

const { Header, Content, Footer } = Layout;

const App = () => {
  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header>
        <Typography.Title level={3} style={{ color: "#fff", margin: 0 }}>
          YDMS Frontend Skeleton
        </Typography.Title>
      </Header>
      <Content style={{ padding: "2rem" }}>
        <Space direction="vertical" size="large">
          <Typography.Title level={2}>Hello from Ant Design!</Typography.Title>
          <Typography.Paragraph>
            这是前端骨架的初始页面，后续会扩展为题库管理界面。
          </Typography.Paragraph>
          <Button type="primary" size="large">
            点击体验 Hello World
          </Button>
        </Space>
      </Content>
      <Footer style={{ textAlign: "center" }}>
        YDMS © {new Date().getFullYear()}
      </Footer>
    </Layout>
  );
};

export default App;
