// NOTE: API Key 必须通过环境变量注入，禁止在此处硬编码
// 本地开发时请复制 .env.example 为 .env 并填写真实 Key
const apiKey = import.meta.env.VITE_DEEPSEEK_API_KEY;

if (!apiKey) {
  throw new Error(
    "[config] VITE_DEEPSEEK_API_KEY 未配置。请复制 .env.example 为 .env 并填写 API Key。"
  );
}

export const DEEPSEEK_CONFIG = {
  apiKey,
  baseUrl: import.meta.env.VITE_DEEPSEEK_BASE_URL ?? "https://api.deepseek.com/chat/completions",
  model: import.meta.env.VITE_DEEPSEEK_MODEL ?? "deepseek-v4-flash",
};
