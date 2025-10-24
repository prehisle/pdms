import { type FC, useMemo } from "react";
import yaml from "js-yaml";
import { Alert, Card, Descriptions, Empty, Tag, Typography, Divider, List } from "antd";

const { Title, Paragraph, Text } = Typography;

interface YAMLPreviewProps {
  content: string;
  documentType?: string;
}

export const YAMLPreview: FC<YAMLPreviewProps> = ({ content, documentType }) => {
  const parsedData = useMemo(() => {
    if (!content || !content.trim()) {
      return null;
    }

    try {
      return yaml.load(content);
    } catch (error) {
      return { error: error instanceof Error ? error.message : '未知错误' };
    }
  }, [content]);

  if (!content || !content.trim()) {
    return (
      <div style={{ padding: '24px' }}>
        <Empty description="暂无内容，请在左侧编辑器中输入YAML代码" />
      </div>
    );
  }

  if (!parsedData || (parsedData as any).error) {
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          type="error"
          message="YAML解析错误"
          description={(parsedData as any)?.error || '无法解析YAML内容，请检查格式'}
          showIcon
        />
      </div>
    );
  }

  // Render based on document type
  if (documentType === 'dictation') {
    return <DictationPreview data={parsedData} />;
  } else if (documentType === 'comprehensive_choice') {
    return <ComprehensiveChoicePreview data={parsedData} />;
  } else if (documentType === 'case_analysis') {
    return <CaseAnalysisPreview data={parsedData} />;
  } else if (documentType === 'essay') {
    return <EssayPreview data={parsedData} />;
  }

  // Generic YAML preview
  return <GenericYAMLPreview data={parsedData} />;
};

// Dictation preview
const DictationPreview: FC<{ data: any }> = ({ data }) => (
  <div style={{ padding: '24px', overflow: 'auto', height: '100%' }}>
    <Title level={3}>{data.title || '默写题'}</Title>
    <Divider />

    <Card size="small" title="题目信息" style={{ marginBottom: 16 }}>
      <Descriptions column={2} size="small">
        <Descriptions.Item label="类型">
          {data.type === 'word' ? '单词' :
           data.type === 'phrase' ? '短语' :
           data.type === 'sentence' ? '句子' :
           data.type === 'paragraph' ? '段落' : data.type}
        </Descriptions.Item>
        <Descriptions.Item label="难度">
          <Tag color={data.difficulty >= 4 ? 'red' : data.difficulty >= 3 ? 'orange' : 'green'}>
            {data.difficulty}/5
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="分值">{data.points} 分</Descriptions.Item>
        <Descriptions.Item label="时限">{data.time_limit} 秒</Descriptions.Item>
      </Descriptions>
    </Card>

    <Card size="small" title="默写内容" style={{ marginBottom: 16 }}>
      <Paragraph strong>{data.content?.text}</Paragraph>
      {data.content?.pinyin && (
        <Paragraph type="secondary">拼音/音标：{data.content.pinyin}</Paragraph>
      )}
    </Card>

    {data.hints && data.hints.length > 0 && (
      <Card size="small" title="提示" style={{ marginBottom: 16 }}>
        <List
          size="small"
          dataSource={data.hints}
          renderItem={(hint: string, index: number) => (
            <List.Item>
              <Text>提示 {index + 1}：{hint}</Text>
            </List.Item>
          )}
        />
      </Card>
    )}

    <Card size="small" title="标准答案">
      <Paragraph code>{data.answer_key}</Paragraph>
    </Card>

    {data.tags && data.tags.length > 0 && (
      <div style={{ marginTop: 16 }}>
        {data.tags.map((tag: string, index: number) => (
          <Tag key={index} color="blue">{tag}</Tag>
        ))}
      </div>
    )}
  </div>
);

// Comprehensive choice preview
const ComprehensiveChoicePreview: FC<{ data: any }> = ({ data }) => (
  <div style={{ padding: '24px', overflow: 'auto', height: '100%' }}>
    <Title level={3}>{data.title || '综合选择题'}</Title>
    <Divider />

    {data.description && (
      <Card size="small" title="题目描述" style={{ marginBottom: 16 }}>
        <Paragraph>{data.description}</Paragraph>
      </Card>
    )}

    <Card size="small" title="题干" style={{ marginBottom: 16 }}>
      <Paragraph strong style={{ fontSize: '16px' }}>{data.stem}</Paragraph>
    </Card>

    {data.blanks && data.blanks.map((blank: any, index: number) => (
      <Card
        key={index}
        size="small"
        title={`第 ${blank.blank_id} 空`}
        style={{ marginBottom: 16 }}
      >
        <Paragraph strong>{blank.question}</Paragraph>
        <List
          size="small"
          dataSource={blank.options}
          renderItem={(option: any) => (
            <List.Item style={{
              background: option.is_correct ? '#f6ffed' : 'transparent',
              padding: '8px 12px',
              borderRadius: '4px',
              marginBottom: '4px',
            }}>
              <Text strong={option.is_correct}>
                {option.id}. {option.content}
                {option.is_correct && <Tag color="success" style={{ marginLeft: 8 }}>正确答案</Tag>}
              </Text>
            </List.Item>
          )}
        />
      </Card>
    ))}

    <Card size="small" title="正确答案" style={{ marginBottom: 16 }}>
      <Paragraph code strong style={{ fontSize: '16px' }}>{data.correct_answer}</Paragraph>
    </Card>

    {data.explanation && (
      <Card size="small" title="解析">
        <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{data.explanation}</Paragraph>
      </Card>
    )}

    <div style={{ marginTop: 16 }}>
      <Tag color="blue">难度：{data.difficulty}/5</Tag>
      <Tag color="green">总分：{data.points} 分</Tag>
      {data.tags && data.tags.map((tag: string, index: number) => (
        <Tag key={index}>{tag}</Tag>
      ))}
    </div>
  </div>
);

// Case analysis preview
const CaseAnalysisPreview: FC<{ data: any }> = ({ data }) => (
  <div style={{ padding: '24px', overflow: 'auto', height: '100%' }}>
    <Title level={3}>{data.title || '案例分析题'}</Title>
    <Divider />

    <Card size="small" title="案例背景" style={{ marginBottom: 16 }}>
      <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{data.case_background}</Paragraph>
    </Card>

    {data.questions && data.questions.map((question: any, index: number) => (
      <Card
        key={index}
        size="small"
        title={
          <div>
            问题 {question.question_id}
            <Tag color="blue" style={{ marginLeft: 8 }}>{question.points} 分</Tag>
          </div>
        }
        style={{ marginBottom: 16 }}
      >
        <Paragraph strong>{question.content}</Paragraph>

        {question.reference_answer && (
          <>
            <Divider orientation="left" plain style={{ margin: '12px 0' }}>参考答案</Divider>
            <Paragraph style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: '12px', borderRadius: '4px' }}>
              {question.reference_answer}
            </Paragraph>
          </>
        )}

        {question.grading_criteria && question.grading_criteria.length > 0 && (
          <>
            <Divider orientation="left" plain style={{ margin: '12px 0' }}>评分标准</Divider>
            <List
              size="small"
              dataSource={question.grading_criteria}
              renderItem={(criteria: string) => (
                <List.Item>
                  <Text>• {criteria}</Text>
                </List.Item>
              )}
            />
          </>
        )}
      </Card>
    ))}

    <div style={{ marginTop: 16 }}>
      <Tag color="blue">难度：{data.difficulty}/5</Tag>
      <Tag color="green">总分：{data.total_points} 分</Tag>
      <Tag color="orange">建议用时：{data.time_limit} 分钟</Tag>
      {data.tags && data.tags.map((tag: string, index: number) => (
        <Tag key={index}>{tag}</Tag>
      ))}
    </div>
  </div>
);

// Essay preview
const EssayPreview: FC<{ data: any }> = ({ data }) => (
  <div style={{ padding: '24px', overflow: 'auto', height: '100%' }}>
    <Title level={3}>{data.title || '论文题'}</Title>
    <Divider />

    <Card size="small" title="论文主题" style={{ marginBottom: 16 }}>
      <Paragraph strong style={{ fontSize: '16px' }}>{data.topic}</Paragraph>
      {data.description && (
        <Paragraph style={{ whiteSpace: 'pre-wrap', marginTop: 12 }}>
          {data.description}
        </Paragraph>
      )}
    </Card>

    {data.requirements && (
      <Card size="small" title="写作要求" style={{ marginBottom: 16 }}>
        <Paragraph style={{ whiteSpace: 'pre-wrap' }}>{data.requirements}</Paragraph>
      </Card>
    )}

    {data.word_limit && (
      <Card size="small" title="字数要求" style={{ marginBottom: 16 }}>
        <Paragraph>
          最少 <Text strong>{data.word_limit.min}</Text> 字，
          最多 <Text strong>{data.word_limit.max}</Text> 字
        </Paragraph>
      </Card>
    )}

    {data.outline_suggestion && data.outline_suggestion.length > 0 && (
      <Card size="small" title="结构建议" style={{ marginBottom: 16 }}>
        <List
          size="small"
          dataSource={data.outline_suggestion}
          renderItem={(item: string) => (
            <List.Item>
              <Text>{item}</Text>
            </List.Item>
          )}
        />
      </Card>
    )}

    {data.grading_criteria && data.grading_criteria.length > 0 && (
      <Card size="small" title="评分标准" style={{ marginBottom: 16 }}>
        {data.grading_criteria.map((criteria: any, index: number) => (
          <div key={index} style={{ marginBottom: 12 }}>
            <Text strong>{criteria.criterion}</Text>
            <Tag color="blue" style={{ marginLeft: 8 }}>{criteria.points} 分</Tag>
            <Paragraph type="secondary" style={{ marginTop: 4, marginBottom: 0 }}>
              {criteria.description}
            </Paragraph>
          </div>
        ))}
      </Card>
    )}

    {data.reference_materials && data.reference_materials.length > 0 && (
      <Card size="small" title="参考资料" style={{ marginBottom: 16 }}>
        <List
          size="small"
          dataSource={data.reference_materials}
          renderItem={(material: string) => (
            <List.Item>
              <Text>• {material}</Text>
            </List.Item>
          )}
        />
      </Card>
    )}

    <div style={{ marginTop: 16 }}>
      <Tag color="blue">难度：{data.difficulty}/5</Tag>
      <Tag color="green">总分：{data.total_points} 分</Tag>
      <Tag color="orange">建议用时：{data.time_limit} 分钟</Tag>
      {data.tags && data.tags.map((tag: string, index: number) => (
        <Tag key={index}>{tag}</Tag>
      ))}
    </div>
  </div>
);

// Generic YAML preview (fallback)
const GenericYAMLPreview: FC<{ data: any }> = ({ data }) => (
  <div style={{ padding: '24px', overflow: 'auto', height: '100%' }}>
    <Title level={4}>YAML 数据结构预览</Title>
    <Divider />
    <pre style={{
      background: '#f5f5f5',
      padding: '16px',
      borderRadius: '4px',
      overflow: 'auto',
      fontSize: '13px',
      lineHeight: 1.6,
    }}>
      {JSON.stringify(data, null, 2)}
    </pre>
  </div>
);
