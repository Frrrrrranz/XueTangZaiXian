import { DEEPSEEK_CONFIG } from "../config";

// 监听前台 Content Script 发来的消息
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "ASK_DEEPSEEK") {
    const { prompt } = message as { prompt: string };
    
    // 使用 fetch 调用 DeepSeek API，通过后台代理可避开前台页面的跨域与 CSP 限制
    fetch(DEEPSEEK_CONFIG.baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${DEEPSEEK_CONFIG.apiKey}`
      },
      body: JSON.stringify({
        model: DEEPSEEK_CONFIG.model,
        messages: [
          {
            role: "system",
            content: "你是一个答题助手。请直接且仅给出题目对应的正确选项字母（如 A 或 B 或 C 或 D，如果是多选题直接给出多个字母如 AB）。绝对不要输出任何其他多余文本，不要有解释，不要有标点符号，只需要输出大写字母！"
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.1
      })
    })
    .then(res => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: 请求大模型服务失败`);
      }
      return res.json();
    })
    .then((data: any) => {
      // 提取 AI 返回的内容并清洗
      const answer = data.choices?.[0]?.message?.content?.trim() || "";
      sendResponse({ success: true, answer });
    })
    .catch(err => {
      console.error("DeepSeek API 请求失败:", err);
      sendResponse({ success: false, error: err.message });
    });
    
    // 返回 true，声明该 response 将会异步返回，防止消息连接被强制关闭
    return true;
  }

  // NOTE: DOWNLOAD_MD 消息由 content script 发出，携带 Markdown 文本。
  // background 作为代理调用 chrome.downloads，因为 content script 无法直接访问该 API。
  if (message.type === "DOWNLOAD_MD") {
    const { content, filename } = message as { content: string; filename: string };

    // 将 Markdown 字符串编码为 UTF-8 的 data URL，避免中文乱码
    const encoded = encodeURIComponent(content);
    const dataUrl = `data:text/markdown;charset=utf-8,${encoded}`;

    chrome.downloads.download(
      { url: dataUrl, filename, saveAs: false },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true, downloadId });
        }
      }
    );

    // 异步响应，必须返回 true
    return true;
  }
});

