import { Card, Col, Row, Statistic } from "antd";
import {
  KeyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  StopOutlined,
} from "@ant-design/icons";
import type { APIKeyStats } from "../../../api/apikeys";

interface APIKeyStatsCardsProps {
  stats: APIKeyStats | undefined;
  loading: boolean;
}

export function APIKeyStatsCards({ stats, loading }: APIKeyStatsCardsProps) {
  return (
    <Row gutter={16} style={{ marginBottom: 16 }}>
      <Col span={6}>
        <Card>
          <Statistic
            title="总计"
            value={stats?.total ?? 0}
            prefix={<KeyOutlined />}
            loading={loading}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="活跃"
            value={stats?.active ?? 0}
            prefix={<CheckCircleOutlined />}
            valueStyle={{ color: "#3f8600" }}
            loading={loading}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="已过期"
            value={stats?.expired ?? 0}
            prefix={<ClockCircleOutlined />}
            valueStyle={{ color: "#cf1322" }}
            loading={loading}
          />
        </Card>
      </Col>
      <Col span={6}>
        <Card>
          <Statistic
            title="已撤销"
            value={stats?.revoked ?? 0}
            prefix={<StopOutlined />}
            valueStyle={{ color: "#8c8c8c" }}
            loading={loading}
          />
        </Card>
      </Col>
    </Row>
  );
}
