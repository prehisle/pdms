import { Card, Divider, List, Tag, Typography } from "antd";
import type { FC } from "react";
import yaml from "js-yaml";

import { registerYamlPreview } from "../../previewRegistry";
import type { YamlPreviewRenderResult } from "../../previewRegistry";
import type { CaseAnalysisDocumentYaml, CaseAnalysisQuestion } from "../../types";
import { renderDifficultyTag, renderNumber, renderTagGroup } from "../shared";

const { Title, Paragraph, Text } = Typography;

registerYamlPreview("case_analysis", {
  render(content) {
    return renderCaseAnalysisContent(content);
  },
});

function renderCaseAnalysisContent(content: string): YamlPreviewRenderResult {
  if (!content || !content.trim()) {
    return { type: "empty" };
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return { type: "error", message };
  }

  if (!isCaseAnalysisDocument(parsed)) {
    return { type: "fallback", payload: parsed };
  }

  return {
    type: "component",
    node: <CaseAnalysisPreview data={parsed} />,
  };
}

const CaseAnalysisPreview: FC<{ data: CaseAnalysisDocumentYaml }> = ({ data }) => (
  <div style={{ padding: "24px", overflow: "auto", height: "100%" }}>
    <Title level={3}>{data.title || "案例分析题"}</Title>
    <Divider />

    {data.case_background ? (
      <Card size="small" title="案例背景" style={{ marginBottom: 16 }}>
        <Paragraph style={{ whiteSpace: "pre-wrap" }}>{data.case_background}</Paragraph>
      </Card>
    ) : null}

    {Array.isArray(data.questions) && data.questions.length > 0
      ? data.questions.map((question, index) => <CaseQuestionCard key={index} question={question} />)
      : null}

    <div style={{ marginTop: 16 }}>
      {renderDifficultyTag(data.difficulty)}
      <Tag color="green" style={{ marginLeft: 8 }}>{renderNumber(data.total_points, "分")}</Tag>
      <Tag color="orange" style={{ marginLeft: 8 }}>{renderNumber(data.time_limit, "分钟")}</Tag>
      {renderTagGroup(data.tags, { inline: true })}
    </div>
  </div>
);

const CaseQuestionCard: FC<{ question: CaseAnalysisQuestion }> = ({ question }) => (
  <Card
    size="small"
    title={(
      <div>
        {question.question_id != null ? `问题 ${question.question_id}` : "问题"}
        {question.points != null ? <Tag color="blue" style={{ marginLeft: 8 }}>{question.points} 分</Tag> : null}
      </div>
    )}
    style={{ marginBottom: 16 }}
  >
    {question.content ? <Paragraph strong>{question.content}</Paragraph> : null}

    {question.reference_answer ? (
      <>
        <Divider orientation="left" plain style={{ margin: "12px 0" }}>
          参考答案
        </Divider>
        <Paragraph style={{ whiteSpace: "pre-wrap", background: "#fafafa", padding: "12px", borderRadius: "4px" }}>
          {question.reference_answer}
        </Paragraph>
      </>
    ) : null}

    {Array.isArray(question.grading_criteria) && question.grading_criteria.length > 0 ? (
      <>
        <Divider orientation="left" plain style={{ margin: "12px 0" }}>
          评分标准
        </Divider>
        <List
          size="small"
          dataSource={question.grading_criteria}
          renderItem={(criteria) => (
            <List.Item>
              <Text>• {criteria}</Text>
            </List.Item>
          )}
        />
      </>
    ) : null}
  </Card>
);

function isCaseAnalysisDocument(value: unknown): value is CaseAnalysisDocumentYaml {
  if (!isRecord(value)) {
    return false;
  }
  const record = value;

  if (!isOptionalString(record.title) || !isOptionalString(record.case_background)) {
    return false;
  }
  if (!isOptionalNumber(record.difficulty) || !isOptionalNumber(record.total_points) || !isOptionalNumber(record.time_limit)) {
    return false;
  }
  if (!isOptionalStringArray(record.tags)) {
    return false;
  }
  const questions = record.questions;
  if (questions !== undefined) {
    if (!Array.isArray(questions)) {
      return false;
    }
    for (const question of questions) {
      if (!isRecord(question)) {
        return false;
      }
      if (!isOptionalNumber(question.question_id) || !isOptionalNumber(question.points)) {
        return false;
      }
      if (!isOptionalString(question.content) || !isOptionalString(question.reference_answer)) {
        return false;
      }
      if (!isOptionalStringArray(question.grading_criteria)) {
        return false;
      }
    }
  }
  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isOptionalNumber(value: unknown): value is number | undefined {
  return value === undefined || (typeof value === "number" && Number.isFinite(value));
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}
