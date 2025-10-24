import { type FC, useMemo } from "react";
import yaml from "js-yaml";
import { Alert, Card, Descriptions, Divider, Empty, List, Tag, Typography } from "antd";

import type {
  CaseAnalysisDocumentYaml,
  CaseAnalysisQuestion,
  ComprehensiveChoiceBlank,
  ComprehensiveChoiceDocumentYaml,
  DictationDocumentYaml,
  EssayCriterion,
  EssayDocumentYaml,
} from "../types";

const { Title, Paragraph, Text } = Typography;

interface YAMLPreviewProps {
  content: string;
  documentType?: string;
}

type ParsedYamlState =
  | { kind: "empty" }
  | { kind: "error"; message: string }
  | { kind: "dictation"; data: DictationDocumentYaml }
  | { kind: "comprehensive_choice"; data: ComprehensiveChoiceDocumentYaml }
  | { kind: "case_analysis"; data: CaseAnalysisDocumentYaml }
  | { kind: "essay"; data: EssayDocumentYaml }
  | { kind: "unknown"; data: unknown };

export const YAMLPreview: FC<YAMLPreviewProps> = ({ content, documentType }) => {
  const parsed = useMemo(() => parseYamlContent(content, documentType), [content, documentType]);

  switch (parsed.kind) {
    case "empty":
      return (
        <div style={{ padding: "24px" }}>
          <Empty description="暂无内容，请在左侧编辑器中输入YAML代码" />
        </div>
      );
    case "error":
      return (
        <div style={{ padding: "24px" }}>
          <Alert type="error" message="YAML解析错误" description={parsed.message} showIcon />
        </div>
      );
    case "dictation":
      return <DictationPreview data={parsed.data} />;
    case "comprehensive_choice":
      return <ComprehensiveChoicePreview data={parsed.data} />;
    case "case_analysis":
      return <CaseAnalysisPreview data={parsed.data} />;
    case "essay":
      return <EssayPreview data={parsed.data} />;
    default:
      return <GenericYAMLPreview data={parsed.data} />;
  }
};

const DictationPreview: FC<{ data: DictationDocumentYaml }> = ({ data }) => (
  <div style={{ padding: "24px", overflow: "auto", height: "100%" }}>
    <Title level={3}>{data.title || "默写题"}</Title>
    <Divider />

    <Card size="small" title="题目信息" style={{ marginBottom: 16 }}>
      <Descriptions column={2} size="small">
        <Descriptions.Item label="类型">{renderDictationType(data.type)}</Descriptions.Item>
        <Descriptions.Item label="难度">{renderDifficultyTag(data.difficulty)}</Descriptions.Item>
        <Descriptions.Item label="分值">{renderNumber(data.points, "分")}</Descriptions.Item>
        <Descriptions.Item label="时限">{renderNumber(data.time_limit, "秒")}</Descriptions.Item>
      </Descriptions>
    </Card>

    <Card size="small" title="默写内容" style={{ marginBottom: 16 }}>
      <Paragraph strong>{data.content?.text || "暂无正文"}</Paragraph>
      {data.content?.pinyin ? <Paragraph type="secondary">拼音/音标：{data.content.pinyin}</Paragraph> : null}
    </Card>

    {Array.isArray(data.hints) && data.hints.length > 0 ? (
      <Card size="small" title="提示" style={{ marginBottom: 16 }}>
        <List
          size="small"
          dataSource={data.hints}
          renderItem={(hint, index) => (
            <List.Item>
              <Text>提示 {index + 1}：{hint}</Text>
            </List.Item>
          )}
        />
      </Card>
    ) : null}

    <Card size="small" title="标准答案">
      <Paragraph code>{data.answer_key || "暂无答案"}</Paragraph>
    </Card>

    {renderTagGroup(data.tags)}
  </div>
);

const ComprehensiveChoicePreview: FC<{ data: ComprehensiveChoiceDocumentYaml }> = ({ data }) => (
  <div style={{ padding: "24px", overflow: "auto", height: "100%" }}>
    <Title level={3}>{data.title || "综合选择题"}</Title>
    <Divider />

    {data.description ? (
      <Card size="small" title="题目描述" style={{ marginBottom: 16 }}>
        <Paragraph>{data.description}</Paragraph>
      </Card>
    ) : null}

    {data.stem ? (
      <Card size="small" title="题干" style={{ marginBottom: 16 }}>
        <Paragraph strong style={{ fontSize: "16px" }}>{data.stem}</Paragraph>
      </Card>
    ) : null}

    {Array.isArray(data.blanks) && data.blanks.length > 0 ? data.blanks.map((blank, index) => (
      <Card key={index} size="small" title={renderBlankTitle(blank)} style={{ marginBottom: 16 }}>
        {blank.question ? <Paragraph strong>{blank.question}</Paragraph> : null}
        {Array.isArray(blank.options) ? (
          <List
            size="small"
            dataSource={blank.options}
            renderItem={(option) => (
              <List.Item
                style={{
                  background: option.is_correct ? "#f6ffed" : "transparent",
                  padding: "8px 12px",
                  borderRadius: "4px",
                  marginBottom: "4px",
                }}
              >
                <Text strong={Boolean(option.is_correct)}>
                  {option.id ? `${option.id}. ` : ""}
                  {option.content ?? "选项"}
                  {option.is_correct ? <Tag color="success" style={{ marginLeft: 8 }}>正确答案</Tag> : null}
                </Text>
              </List.Item>
            )}
          />
        ) : null}
      </Card>
    )) : null}

    <Card size="small" title="正确答案" style={{ marginBottom: 16 }}>
      <Paragraph code strong style={{ fontSize: "16px" }}>{data.correct_answer || "未提供"}</Paragraph>
    </Card>

    {data.explanation ? (
      <Card size="small" title="解析">
        <Paragraph style={{ whiteSpace: "pre-wrap" }}>{data.explanation}</Paragraph>
      </Card>
    ) : null}

    <div style={{ marginTop: 16 }}>
      {renderDifficultyTag(data.difficulty)}
      <Tag color="green" style={{ marginLeft: 8 }}>{renderNumber(data.points, "分")}</Tag>
      {renderTagGroup(data.tags, { inline: true })}
    </div>
  </div>
);

const CaseAnalysisPreview: FC<{ data: CaseAnalysisDocumentYaml }> = ({ data }) => (
  <div style={{ padding: "24px", overflow: "auto", height: "100%" }}>
    <Title level={3}>{data.title || "案例分析题"}</Title>
    <Divider />

    {data.case_background ? (
      <Card size="small" title="案例背景" style={{ marginBottom: 16 }}>
        <Paragraph style={{ whiteSpace: "pre-wrap" }}>{data.case_background}</Paragraph>
      </Card>
    ) : null}

    {Array.isArray(data.questions) && data.questions.length > 0 ? data.questions.map((question, index) => (
      <CaseQuestionCard key={index} question={question} />
    )) : null}

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
        <Divider orientation="left" plain style={{ margin: "12px 0" }}>参考答案</Divider>
        <Paragraph style={{ whiteSpace: "pre-wrap", background: "#fafafa", padding: "12px", borderRadius: "4px" }}>
          {question.reference_answer}
        </Paragraph>
      </>
    ) : null}

    {Array.isArray(question.grading_criteria) && question.grading_criteria.length > 0 ? (
      <>
        <Divider orientation="left" plain style={{ margin: "12px 0" }}>评分标准</Divider>
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

const EssayPreview: FC<{ data: EssayDocumentYaml }> = ({ data }) => (
  <div style={{ padding: "24px", overflow: "auto", height: "100%" }}>
    <Title level={3}>{data.title || "论文题"}</Title>
    <Divider />

    <Card size="small" title="论文主题" style={{ marginBottom: 16 }}>
      {data.topic ? <Paragraph strong style={{ fontSize: "16px" }}>{data.topic}</Paragraph> : null}
      {data.description ? (
        <Paragraph style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
          {data.description}
        </Paragraph>
      ) : null}
    </Card>

    {data.requirements ? (
      <Card size="small" title="写作要求" style={{ marginBottom: 16 }}>
        <Paragraph style={{ whiteSpace: "pre-wrap" }}>{data.requirements}</Paragraph>
      </Card>
    ) : null}

    {data.word_limit ? (
      <Card size="small" title="字数要求" style={{ marginBottom: 16 }}>
        <Paragraph>
          最少 <Text strong>{renderNumber(data.word_limit.min)}</Text> 字，
          最多 <Text strong>{renderNumber(data.word_limit.max)}</Text> 字
        </Paragraph>
      </Card>
    ) : null}

    {Array.isArray(data.outline_suggestion) && data.outline_suggestion.length > 0 ? (
      <Card size="small" title="结构建议" style={{ marginBottom: 16 }}>
        <List
          size="small"
          dataSource={data.outline_suggestion}
          renderItem={(item) => (
            <List.Item>
              <Text>{item}</Text>
            </List.Item>
          )}
        />
      </Card>
    ) : null}

    {Array.isArray(data.grading_criteria) && data.grading_criteria.length > 0 ? (
      <Card size="small" title="评分标准" style={{ marginBottom: 16 }}>
        {data.grading_criteria.map((criteria, index) => (
          <EssayCriterionItem key={index} criteria={criteria} />
        ))}
      </Card>
    ) : null}

    {Array.isArray(data.reference_materials) && data.reference_materials.length > 0 ? (
      <Card size="small" title="参考资料" style={{ marginBottom: 16 }}>
        <List
          size="small"
          dataSource={data.reference_materials}
          renderItem={(material) => (
            <List.Item>
              <Text>• {material}</Text>
            </List.Item>
          )}
        />
      </Card>
    ) : null}

    <div style={{ marginTop: 16 }}>
      {renderDifficultyTag(data.difficulty)}
      <Tag color="green" style={{ marginLeft: 8 }}>{renderNumber(data.total_points, "分")}</Tag>
      <Tag color="orange" style={{ marginLeft: 8 }}>{renderNumber(data.time_limit, "分钟")}</Tag>
      {renderTagGroup(data.tags, { inline: true })}
    </div>
  </div>
);

const EssayCriterionItem: FC<{ criteria: EssayCriterion }> = ({ criteria }) => (
  <div style={{ marginBottom: 12 }}>
    <Text strong>{criteria.criterion || "评分项"}</Text>
    {criteria.points != null ? <Tag color="blue" style={{ marginLeft: 8 }}>{criteria.points} 分</Tag> : null}
    {criteria.description ? (
      <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>
        {criteria.description}
      </Paragraph>
    ) : null}
  </div>
);

const GenericYAMLPreview: FC<{ data: unknown }> = ({ data }) => {
  let serialized = "";
  if (typeof data === "string") {
    serialized = data;
  } else {
    try {
      serialized = JSON.stringify(data, null, 2);
    } catch (error) {
      serialized = `无法序列化的数据: ${(error as Error).message}`;
    }
  }

  return (
    <div style={{ padding: "24px", overflow: "auto", height: "100%" }}>
      <Title level={4}>YAML 数据结构预览</Title>
      <Divider />
      <pre
        style={{
          background: "#f5f5f5",
          padding: "16px",
          borderRadius: "4px",
          overflow: "auto",
          fontSize: "13px",
          lineHeight: 1.6,
        }}
      >
        {serialized}
      </pre>
    </div>
  );
};

function parseYamlContent(content: string, documentType?: string): ParsedYamlState {
  if (!content || !content.trim()) {
    return { kind: "empty" };
  }

  let parsed: unknown;
  try {
    parsed = yaml.load(content);
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return { kind: "error", message };
  }

  if (documentType === "dictation" && isDictationDocument(parsed)) {
    return { kind: "dictation", data: parsed };
  }
  if (documentType === "comprehensive_choice" && isComprehensiveChoiceDocument(parsed)) {
    return { kind: "comprehensive_choice", data: parsed };
  }
  if (documentType === "case_analysis" && isCaseAnalysisDocument(parsed)) {
    return { kind: "case_analysis", data: parsed };
  }
  if (documentType === "essay" && isEssayDocument(parsed)) {
    return { kind: "essay", data: parsed };
  }

  return { kind: "unknown", data: parsed };
}

function isDictationDocument(value: unknown): value is DictationDocumentYaml {
  if (!isRecord(value)) {
    return false;
  }
  const record = value;

  if (!isOptionalString(record.title) || !isOptionalString(record.type)) {
    return false;
  }
  if (!isOptionalNumber(record.difficulty) || !isOptionalNumber(record.points) || !isOptionalNumber(record.time_limit)) {
    return false;
  }
  if (!isOptionalString(record.answer_key)) {
    return false;
  }
  if (!isOptionalStringArray(record.hints) || !isOptionalStringArray(record.tags)) {
    return false;
  }
  const content = record.content;
  if (content !== undefined) {
    if (!isRecord(content)) {
      return false;
    }
    if (!isOptionalString(content.text) || !isOptionalString(content.pinyin)) {
      return false;
    }
  }
  return true;
}

function isComprehensiveChoiceDocument(value: unknown): value is ComprehensiveChoiceDocumentYaml {
  if (!isRecord(value)) {
    return false;
  }
  const record = value;

  if (!isOptionalString(record.title) || !isOptionalString(record.description) || !isOptionalString(record.stem)) {
    return false;
  }
  if (!isOptionalString(record.correct_answer) || !isOptionalString(record.explanation)) {
    return false;
  }
  if (!isOptionalNumber(record.difficulty) || !isOptionalNumber(record.points)) {
    return false;
  }
  if (!isOptionalStringArray(record.tags)) {
    return false;
  }
  const blanks = record.blanks;
  if (blanks !== undefined) {
    if (!Array.isArray(blanks)) {
      return false;
    }
    for (const blank of blanks) {
      if (!isRecord(blank)) {
        return false;
      }
      if (!isOptionalNumber(blank.blank_id) || !isOptionalNumber(blank.position)) {
        return false;
      }
      if (!isOptionalString(blank.question)) {
        return false;
      }
      const options = blank.options;
      if (options !== undefined) {
        if (!Array.isArray(options)) {
          return false;
        }
        for (const option of options) {
          if (!isRecord(option)) {
            return false;
          }
          if (!isOptionalString(option.id) || !isOptionalString(option.content)) {
            return false;
          }
          if (!isOptionalBoolean(option.is_correct)) {
            return false;
          }
        }
      }
    }
  }
  return true;
}

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

function isEssayDocument(value: unknown): value is EssayDocumentYaml {
  if (!isRecord(value)) {
    return false;
  }
  const record = value;

  if (!isOptionalString(record.title) || !isOptionalString(record.topic) || !isOptionalString(record.description) || !isOptionalString(record.requirements)) {
    return false;
  }
  if (!isOptionalNumber(record.difficulty) || !isOptionalNumber(record.total_points) || !isOptionalNumber(record.time_limit)) {
    return false;
  }
  if (!isOptionalStringArray(record.outline_suggestion) || !isOptionalStringArray(record.reference_materials) || !isOptionalStringArray(record.tags)) {
    return false;
  }
  const wordLimit = record.word_limit;
  if (wordLimit !== undefined) {
    if (!isRecord(wordLimit)) {
      return false;
    }
    if (!isOptionalNumber(wordLimit.min) || !isOptionalNumber(wordLimit.max)) {
      return false;
    }
  }
  const grading = record.grading_criteria;
  if (grading !== undefined) {
    if (!Array.isArray(grading)) {
      return false;
    }
    for (const criterion of grading) {
      if (!isRecord(criterion)) {
        return false;
      }
      if (!isOptionalString(criterion.criterion) || !isOptionalNumber(criterion.points) || !isOptionalString(criterion.description)) {
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

function isOptionalBoolean(value: unknown): value is boolean | undefined {
  return value === undefined || typeof value === "boolean";
}

function isOptionalStringArray(value: unknown): value is string[] | undefined {
  return value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}

function renderDictationType(value: string | undefined): string {
  switch (value) {
    case "word":
      return "单词";
    case "phrase":
      return "短语";
    case "sentence":
      return "句子";
    case "paragraph":
      return "段落";
    default:
      return value || "-";
  }
}

function renderBlankTitle(blank: ComprehensiveChoiceBlank): string {
  if (blank.blank_id != null) {
    return `第 ${blank.blank_id} 空`;
  }
  return "空位";
}

function renderDifficultyTag(difficulty?: number) {
  if (typeof difficulty !== "number") {
    return <Tag color="default">难度：-</Tag>;
  }
  const color = difficulty >= 4 ? "red" : difficulty >= 3 ? "orange" : "green";
  return <Tag color={color}>难度：{difficulty}/5</Tag>;
}

function renderNumber(value?: number, suffix?: string) {
  if (typeof value !== "number") {
    return "-";
  }
  return suffix ? `${value} ${suffix}` : String(value);
}

function renderTagGroup(tags: string[] | undefined, options?: { inline?: boolean }) {
  if (!Array.isArray(tags) || tags.length === 0) {
    return null;
  }
  const style = options?.inline ? { marginLeft: 8 } : {};
  return (
    <div style={{ marginTop: options?.inline ? 0 : 16 }}>
      {tags.map((tag, index) => (
        <Tag key={`${tag}-${index}`} color="blue" style={style}>
          {tag}
        </Tag>
      ))}
    </div>
  );
}
