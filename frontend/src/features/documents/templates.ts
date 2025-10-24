/**
 * Document content templates for different document types
 */

export const DOCUMENT_TEMPLATES = {
  overview: {
    format: "html",
    data: `<div class="overview">
  <h2>题目概览</h2>

  <section class="description">
    <h3>题目描述</h3>
    <p>在此添加题目的整体说明和背景信息...</p>
  </section>

  <section class="knowledge-points">
    <h3>涉及知识点</h3>
    <ul>
      <li>知识点 1</li>
      <li>知识点 2</li>
      <li>知识点 3</li>
    </ul>
  </section>

  <section class="difficulty">
    <h3>难度等级</h3>
    <p>中等</p>
  </section>

  <section class="notes">
    <h3>备注</h3>
    <p>其他需要说明的内容...</p>
  </section>
</div>`,
  },

  dictation: {
    format: "yaml",
    data: `title: "默写题目标题"
type: "word"  # word(单词), phrase(短语), sentence(句子), paragraph(段落)
content:
  text: "需要默写的内容"
  pinyin: "nǐ hǎo shì jiè"  # 可选：拼音或音标提示
hints:
  - "提示1：可以提供部分字母或偏旁"
  - "提示2：可以提供词义解释"
answer_key: "标准答案（如有多种写法可用/分隔）"
difficulty: 3  # 1-5，1最简单，5最难
time_limit: 60  # 建议完成时间（秒）
tags:
  - "词汇"
  - "基础"
points: 5  # 分值`,
  },

  comprehensive_choice: {
    format: "yaml",
    data: `title: "综合选择题标题"
description: "题目描述和背景信息，可以包含图表、材料等"
stem: "题干：____是世界上最____的____语言之一。"
# 在题干中使用____表示空位，按顺序对应下面的blanks

blanks:
  - blank_id: 1
    position: 0  # 对应题干中第1个空位
    question: "第1空：选择合适的主语"
    options:
      - id: A
        content: "Python"
        is_correct: true
      - id: B
        content: "Java"
        is_correct: false
      - id: C
        content: "C++"
        is_correct: false
      - id: D
        content: "JavaScript"
        is_correct: false

  - blank_id: 2
    position: 1  # 对应题干中第2个空位
    question: "第2空：选择合适的形容词"
    options:
      - id: A
        content: "流行"
        is_correct: true
      - id: B
        content: "复杂"
        is_correct: false
      - id: C
        content: "简单"
        is_correct: false
      - id: D
        content: "强大"
        is_correct: false

  - blank_id: 3
    position: 2  # 对应题干中第3个空位
    question: "第3空：选择合适的名词"
    options:
      - id: A
        content: "编程"
        is_correct: true
      - id: B
        content: "脚本"
        is_correct: false
      - id: C
        content: "开发"
        is_correct: false
      - id: D
        content: "应用"
        is_correct: false

correct_answer: "A-A-A"  # 正确答案组合
explanation: |
  解析说明：
  1. 第1空选A的原因...
  2. 第2空选A的原因...
  3. 第3空选A的原因...

difficulty: 3  # 1-5
points: 15  # 总分值
tags:
  - "综合选择"
  - "知识点标签"`,
  },

  case_analysis: {
    format: "yaml",
    data: `title: "案例分析题标题"
case_background: |
  【案例背景】
  某公司在实施新项目时遇到了以下情况：

  1. 项目背景描述...
  2. 当前面临的问题...
  3. 相关数据和资料...

  【补充信息】
  - 信息点1
  - 信息点2
  - 信息点3

questions:
  - question_id: 1
    content: "问题1：请分析该案例中存在的主要问题。（10分）"
    points: 10
    reference_answer: |
      【参考答案】
      主要问题包括：
      1. 问题点1的分析
      2. 问题点2的分析
      3. 问题点3的分析
    grading_criteria:
      - "准确识别问题点1得3分"
      - "准确识别问题点2得3分"
      - "准确识别问题点3得4分"

  - question_id: 2
    content: "问题2：针对以上问题，请提出合理的解决方案。（15分）"
    points: 15
    reference_answer: |
      【参考答案】
      建议采取以下措施：
      1. 解决方案1...
      2. 解决方案2...
      3. 实施步骤...
    grading_criteria:
      - "方案的针对性和合理性10分"
      - "方案的可行性和完整性5分"

  - question_id: 3
    content: "问题3：预测实施该方案可能产生的影响。（10分）"
    points: 10
    reference_answer: |
      【参考答案】
      预期影响：
      1. 积极影响...
      2. 潜在风险...
      3. 应对措施...
    grading_criteria:
      - "分析积极影响得4分"
      - "识别潜在风险得3分"
      - "提出应对措施得3分"

total_points: 35
difficulty: 4  # 1-5
time_limit: 45  # 建议完成时间（分钟）
tags:
  - "案例分析"
  - "综合应用"
  - "实践能力"`,
  },

  essay: {
    format: "yaml",
    data: `title: "论文题标题"
topic: "请围绕以下主题进行论述"
description: |
  论文主题说明：
  在此描述论文的主题、背景和要求...

requirements: |
  【写作要求】
  1. 围绕主题展开论述，观点明确
  2. 论据充分，论证严密
  3. 结构清晰，层次分明
  4. 语言流畅，表达准确
  5. 引用规范，注明出处

word_limit:
  min: 800
  max: 1200

outline_suggestion:
  - "一、引言（提出问题或论点）"
  - "二、理论分析（分析问题的原因、背景等）"
  - "三、实证分析（举例说明、数据支撑）"
  - "四、对策建议（提出解决方案）"
  - "五、结论（总结全文，升华主题）"

grading_criteria:
  - criterion: "论点明确性"
    points: 20
    description: "论点是否明确、新颖、有价值"
  - criterion: "论据充分性"
    points: 25
    description: "论据是否充分、准确、有说服力"
  - criterion: "逻辑严密性"
    points: 20
    description: "论证过程是否严密、推理是否合理"
  - criterion: "结构完整性"
    points: 15
    description: "结构是否完整、层次是否清晰"
  - criterion: "语言表达"
    points: 15
    description: "语言是否流畅、准确、规范"
  - criterion: "格式规范"
    points: 5
    description: "格式是否符合要求、引用是否规范"

total_points: 100
difficulty: 5  # 1-5
time_limit: 120  # 建议完成时间（分钟）
tags:
  - "论文"
  - "写作"
  - "综合分析"

reference_materials:
  - "参考资料1：XXX"
  - "参考资料2：XXX"
  - "推荐阅读：XXX"

evaluation_focus:
  - "创新性"
  - "实用性"
  - "学术性"`,
  },
} as const;

export type DocumentTemplateType = keyof typeof DOCUMENT_TEMPLATES;

/**
 * Get template content for a document type
 */
export function getDocumentTemplate(type: string): { format: string; data: string } | null {
  if (type in DOCUMENT_TEMPLATES) {
    return DOCUMENT_TEMPLATES[type as DocumentTemplateType];
  }
  return null;
}
