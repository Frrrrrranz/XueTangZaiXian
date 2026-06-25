# 学堂在线刷课助手

> 一款基于 Chrome 扩展的学堂在线（xuetangx.com）刷课插件，接入 DeepSeek AI 自动回答课程题目，并支持将题目与答案导出为 Markdown 文件供复习使用。

---

## 功能介绍

- 🎓 **自动答题**：调用 DeepSeek API 对课程中的选择题、判断题等进行智能作答
- 🖥️ **浮动面板**：页面内嵌悬浮操作面板，随时触发、可拖拽定位
- 🔁 **自动连答**：开启后自动答题 → 提交 → 翻页，全程无需干预
- 📋 **题目收集**：手动点击"抓取当前题"，自动读取页面已展示的正确答案并记录
- ⬇️ **导出复习**：一键将收集的题目导出为带答案的 `题目_日期.md` 文件，支持多批次导出后手动合并

---

## 前置要求

| 依赖 | 说明 |
|------|------|
| Chrome 浏览器 | 版本 ≥ 88（支持 Manifest V3） |
| DeepSeek API Key | 前往 [platform.deepseek.com](https://platform.deepseek.com) 免费注册获取 |
| Node.js | 版本 ≥ 18（仅开发/构建时需要） |

---

## 使用方法

### 方式一：直接加载构建产物（推荐普通用户）

1. 下载本仓库 → 点击右上角 **Code → Download ZIP**，解压
2. 打开 Chrome，访问 `chrome://extensions/`
3. 右上角开启 **开发者模式**
4. 点击 **加载已解压的扩展程序**，选择解压后的 `dist` 文件夹
5. 扩展加载成功后，访问 [学堂在线](https://www.xuetangx.com) 即可看到浮动面板

> ⚠️ 首次使用需在插件设置中填入你的 DeepSeek API Key

---

### 方式二：本地开发构建

#### 1. 克隆仓库

```bash
git clone https://github.com/Frrrrrranz/-.git
cd -
```

#### 2. 安装依赖

```bash
npm install
```

#### 3. 配置 API Key

复制环境变量模板并填入你的 Key：

```bash
cp .env.example .env
```

编辑 `.env` 文件：

```env
VITE_DEEPSEEK_API_KEY=你的_API_Key_填在这里
```

> `.env` 文件已被 `.gitignore` 忽略，不会提交到仓库，请放心填写真实 Key。

#### 4. 构建扩展

```bash
npm run build
```

构建完成后，`dist/` 目录即为可加载的 Chrome 扩展。

#### 5. 加载到 Chrome

1. 打开 `chrome://extensions/`
2. 开启右上角 **开发者模式**
3. 点击 **加载已解压的扩展程序** → 选择项目根目录下的 `dist` 文件夹

---

## 题目收集 & 导出使用指南

> 适用场景：课程题目已做完、答案已显示，想批量导出为 Markdown 用于复习。

1. 打开学堂在线题目页面，确认页面已显示**正确答案**
2. 点击浮窗中的 **📋 抓取当前题** 按钮
   - 状态栏显示 `已收集，答案: A` → 抓取成功
   - 状态栏显示 `已收集，答案抓取失败请手填` → 答案区未渲染，需手动填写
3. 翻到下一题，重复点击抓取
4. 收集完一批后，点击 **⬇️ 导出 MD** → 浏览器自动下载 `题目_YYYY-MM-DD.md`
5. 多个章节可分批导出，最终手动合并各文件

**导出格式示例：**

```markdown
## 第 1 题

某超市研究消费纪录数据后发现，买啤酒的人很大概率也会购买尿布...

- A 关联规则发现
- B 聚类
- C 分类
- D 自然语言处理

> **答案：A**
```

---

## 环境变量说明

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `VITE_DEEPSEEK_API_KEY` | ✅ 必填 | DeepSeek API 密钥 |
| `VITE_DEEPSEEK_BASE_URL` | ❌ 可选 | API 地址，默认 `https://api.deepseek.com/chat/completions` |
| `VITE_DEEPSEEK_MODEL` | ❌ 可选 | 使用的模型，默认 `deepseek-v4-flash` |

---

## 技术栈

- **框架**：React + TypeScript
- **构建工具**：Vite
- **样式**：Tailwind CSS
- **AI 接口**：DeepSeek API

---

## 注意事项

- 本插件仅供学习交流使用，请遵守学堂在线用户协议
- API Key 请妥善保管，不要分享给他人或提交到公开仓库
- 插件运行需要消耗 DeepSeek API 额度，请留意用量

---

## License

MIT
