/**
 * 题目采集模块：维护一个内存中的题目列表，支持添加、清空和导出为 Markdown。
 * NOTE: 数据仅存活于当前页面会话，刷新后清空——这是有意设计，防止积累脏数据。
 */

export interface CollectedQuestion {
  /** 题目序号（自增） */
  index: number;
  /** 题干文本 */
  title: string;
  /** 选项列表，如 ["A. 均值", "B. 中位数"] */
  options: string[];
  /** AI 给出的答案字母，如 "A" 或 "AB"；抓不到则为 undefined */
  aiAnswer?: string;
  /** 抓取时间戳 */
  capturedAt: string;
}

// 内存题库，模块级单例
const collectedQuestions: CollectedQuestion[] = [];
let autoIndex = 1;

/**
 * 向内存列表追加一道题目
 */
export function addQuestion(
  title: string,
  options: string[],
  aiAnswer?: string
): CollectedQuestion {
  const q: CollectedQuestion = {
    index: autoIndex++,
    title,
    options,
    aiAnswer,
    capturedAt: new Date().toLocaleString("zh-CN"),
  };
  collectedQuestions.push(q);
  return q;
}

/**
 * 返回当前已收集的题目数量
 */
export function getCount(): number {
  return collectedQuestions.length;
}

/**
 * 清空内存中所有已收集题目，同时重置序号
 */
export function clearAll(): void {
  collectedQuestions.length = 0;
  autoIndex = 1;
}

/**
 * 将已收集题目序列化为 Markdown 字符串。
 * 格式：每题为二级标题，含题干、选项列表，以及可选的答案提示块。
 */
export function exportToMarkdown(): string {
  if (collectedQuestions.length === 0) {
    return "# 复习题目\n\n> 暂无已收集题目。\n";
  }

  const exportTime = new Date().toLocaleString("zh-CN");
  const lines: string[] = [
    "# 复习题目",
    "",
    `> 导出时间：${exportTime}　共 ${collectedQuestions.length} 道题`,
    "",
    "---",
    "",
  ];

  for (const q of collectedQuestions) {
    // 题目标题行
    lines.push(`## 第 ${q.index} 题`);
    lines.push("");

    // 题干（原样保留，可能有换行）
    lines.push(q.title);
    lines.push("");

    // 选项列表
    for (const opt of q.options) {
      lines.push(`- ${opt}`);
    }
    lines.push("");

    // 答案块：有 AI 答案则记录，否则留空方便手动填写
    if (q.aiAnswer) {
      lines.push(`> **答案：${q.aiAnswer}**`);
    } else {
      // 留一个空的答案占位符，方便手动填写
      lines.push(`> **答案：**`);
    }
    lines.push("");
    lines.push("---");
    lines.push("");
  }

  return lines.join("\n");
}
