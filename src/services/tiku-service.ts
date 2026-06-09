export interface SearchResult {
  source: string;
  answer: string;
}

export interface TikuTokens {
  thtoken: string;
  yztoken: string;
  enncytoken: string;
}

/**
 * 前台 Content Script 消息发送器，通过 background 代理查询避免跨域及 CSP 报错
 */
export async function queryAllTiku(
  question: string,
  tokens: TikuTokens,
  type: number = 0
): Promise<SearchResult | null> {
  const cleanQuestion = question.trim();
  if (!cleanQuestion) return null;

  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(
        {
          type: "QUERY_TIKU",
          question: cleanQuestion,
          tokens,
          questionType: type,
        },
        (response: SearchResult | null) => {
          if (chrome.runtime.lastError) {
            console.error("题库查询代理消息发送失败:", chrome.runtime.lastError.message);
            resolve(null);
          } else {
            resolve(response);
          }
        }
      );
    } else {
      console.warn("未检测到 Chrome 插件环境，消息代理不可用");
      resolve(null);
    }
  });
}
