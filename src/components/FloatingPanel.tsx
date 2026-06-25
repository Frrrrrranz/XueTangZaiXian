import React, { useState, useEffect, useRef } from "react";
import { grabCurrentQuestion, grabCorrectAnswer, selectOptionByAnswer, clickSubmitQuestion, clickNextQuestion, type Question } from "../utils/dom-grabber";
import { addQuestion, clearAll, exportToMarkdown } from "../utils/question-collector";

export const FloatingPanel: React.FC = () => {
  // 状态显示文本与连答状态
  const [statusText, setStatusText] = useState("待答题");
  const [autoNext, setAutoNext] = useState(false);

  // 题目收集计数（用于触发 UI 重渲染）
  const [collectedCount, setCollectedCount] = useState(0);

  // 记录最后一次回答的题目，避免在连答轮询中重复提交相同题目
  const lastQuestionTitle = useRef("");

  // 连续抓取状态
  const [autoCaptureRunning, setAutoCaptureRunning] = useState(false);
  // 连续抓取时记录上一题题干，防止在翻页期间重复抓取同一道题
  const lastCaptureTitleRef = useRef("");
  // 本次连续抓取计数（用于在闭包回调中读取最新值，避免 stale closure）
  const captureCountRef = useRef(0);

  // 悬浮面板位置状态 (基于屏幕右下角定位)
  const [position, setPosition] = useState({ x: 30, y: 100 });
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const positionStart = useRef({ x: 0, y: 0 });

  // 1. 全自动连答监听器：开启连答后，每秒轮询页面，一旦检测到题干变化，立即触发自动答题
  useEffect(() => {
    if (!autoNext) return;

    const intervalId = setInterval(() => {
      const q = grabCurrentQuestion(document);
      if (q && q.title && q.title !== lastQuestionTitle.current) {
        // 发现新题，自动执行答题流程
        runAnswerFlow(q);
      }
    }, 1000);

    return () => clearInterval(intervalId);
  }, [autoNext]);

  // 连续抓取监听器：开启后每 1.2 秒轮询，检测到新题立即抓取并自动翻页，直到末尾
  useEffect(() => {
    if (!autoCaptureRunning) return;
    // 重置本次计数
    captureCountRef.current = 0;

    const intervalId = setInterval(() => {
      const q = grabCurrentQuestion(document);
      // 题目未加载、或题干与上一次相同（翻页还未完成）则跳过本次轮询
      if (!q?.title || q.title === lastCaptureTitleRef.current) return;

      // 检测到新题：先抓取
      const domAnswer = grabCorrectAnswer(document);
      addQuestion(q.title, q.options, domAnswer ?? undefined);
      captureCountRef.current += 1;
      // 函数式更新防止异步闭包捕获旧值
      setCollectedCount((prev) => prev + 1);
      lastCaptureTitleRef.current = q.title;
      setStatusText(`连续抓取 [${domAnswer ?? "待手填"}]`);

      // 抓完后延迟 1 秒再翻页，给 DOM 留出稳定时间
      setTimeout(() => {
        const nextClicked = clickNextQuestion(document);
        if (!nextClicked) {
          // 无下一题 → 已到末尾，自动停止
          setStatusText(`✅ 完成！本次 ${captureCountRef.current} 道`);
          setAutoCaptureRunning(false);
        }
      }, 1000);
    }, 1200);

    return () => clearInterval(intervalId);
  }, [autoCaptureRunning]);

  // 2. 执行答题流程：提取、请求 API、勾选、决定是否连答
  const runAnswerFlow = async (q: Question) => {
    setStatusText("AI 思考中...");
    lastQuestionTitle.current = q.title;

    // 拼装 Prompt
    const prompt = `题目: ${q.title}\n选项:\n${q.options.join("\n")}`;

    // 通过 chrome.runtime 将消息发送到 background proxy 绕过跨域限制
    chrome.runtime.sendMessage(
      { type: "ASK_DEEPSEEK", prompt },
      (response) => {
        if (chrome.runtime.lastError) {
          setStatusText("扩展通信失败");
          setAutoNext(false);
          return;
        }

        if (response && response.success) {
          const answer = response.answer;
          // 执行页面勾选
          const clickSuccess = selectOptionByAnswer(q, answer);

          if (clickSuccess) {
            setStatusText(`已勾选 [${answer}]`);

            // 如果开启了自动连答，严格执行：先自动提交成功 -> 延时 2 秒 -> 再翻页
            if (autoNext) {
              // 1. 延迟 1000 毫秒执行自动提交
              setTimeout(() => {
                try {
                  const submitClicked = clickSubmitQuestion(document);

                  if (submitClicked) {
                    setStatusText("已提交，准备跳转...");

                    // 2. 只有在成功点击提交后，才在 2000 毫秒后自动执行翻页
                    setTimeout(() => {
                      try {
                        const nextClicked = clickNextQuestion(document);
                        if (nextClicked) {
                          setStatusText("正在加载下一题...");
                        } else {
                          setStatusText("已到最后一题或未找到下一题");
                          setAutoNext(false);
                        }
                      } catch (err: any) {
                        console.error("【连答出错】自动翻页逻辑执行异常:", err);
                        setStatusText("翻页逻辑异常");
                        setAutoNext(false);
                      }
                    }, 2000);

                  } else {
                    // 若点击提交失败，中断连答，保护现场不跳页
                    setStatusText("自动提交失败，停止连答。");
                    setAutoNext(false);
                  }
                } catch (err: any) {
                  console.error("【连答出错】自动提交逻辑执行异常:", err);
                  setStatusText("提交逻辑异常");
                  setAutoNext(false);
                }
              }, 1000);
            }
          } else {
            setStatusText(`匹配失败 [${answer}]`);
            setAutoNext(false); // 选项匹配失败，停止连答以防无限循环
          }
        } else {
          setStatusText(`API 错误: ${response?.error || "未知异常"}`);
          setAutoNext(false);
        }
      }
    );
  };

  // 3. 手动触发单次自动答题
  const handleManualAnswer = () => {
    const q = grabCurrentQuestion(document);
    if (!q) {
      setStatusText("未检测到题目区域");
      return;
    }
    runAnswerFlow(q);
  };

  // 4. 抓取当前题目并追加到内存列表（直接读取页面 DOM 中已展示的"正确答案"）
  const handleCaptureQuestion = () => {
    const q = grabCurrentQuestion(document);
    if (!q) {
      setStatusText("未检测到题目");
      return;
    }

    // 直接从 DOM 中尝试抓取已展示的正确答案，无需调用 AI
    const domAnswer = grabCorrectAnswer(document);

    addQuestion(q.title, q.options, domAnswer ?? undefined);
    // 函数式更新防止异步闭包捕获旧值
    setCollectedCount((prev) => prev + 1);

    if (domAnswer) {
      setStatusText(`已收集，答案: ${domAnswer}`);
    } else {
      // 抓取失败：告知用户需要手动在导出的 MD 里填写答案
      setStatusText("已收集，答案抓取失败请手填");
    }
  };

  // 连续抓取开关：开启时重置抓取标记确保当前题也会被纳入
  const handleToggleAutoCapture = () => {
    if (!autoCaptureRunning) {
      // 重置上次题干记录，保证当前页的题目会被立即捕获
      lastCaptureTitleRef.current = "";
    }
    setAutoCaptureRunning((prev) => !prev);
  };

  // 5. 导出已收集的题目为 Markdown 文件，通过 background 代理触发下载
  const handleExportMd = () => {
    if (collectedCount === 0) {
      setStatusText("暂无题目可导出");
      return;
    }

    const mdContent = exportToMarkdown();
    // 文件名加时间戳避免与历史文件冲突，方便后续手动合并
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `题目_${timestamp}.md`;

    chrome.runtime.sendMessage(
      { type: "DOWNLOAD_MD", content: mdContent, filename },
      (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          setStatusText("导出失败，请检查权限");
        } else {
          setStatusText(`已下载 ${collectedCount} 道题`);
        }
      }
    );
  };

  // 6. 清空内存中的收集列表
  const handleClearCollected = () => {
    clearAll();
    setCollectedCount(0);
    setStatusText("列表已清空");
  };

  // 7. 拖拽定位处理
  const handleDragStart = (e: React.MouseEvent) => {
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    positionStart.current = { ...position };
    document.addEventListener("mousemove", handleDragMove);
    document.addEventListener("mouseup", handleDragEnd);
    e.preventDefault();
  };

  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging.current) return;
    const dx = dragStart.current.x - e.clientX;
    const dy = dragStart.current.y - e.clientY;

    const newX = Math.max(10, Math.min(window.innerWidth - 320, positionStart.current.x + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 80, positionStart.current.y + dy));

    setPosition({ x: newX, y: newY });
  };

  const handleDragEnd = () => {
    isDragging.current = false;
    document.removeEventListener("mousemove", handleDragMove);
    document.removeEventListener("mouseup", handleDragEnd);
  };

  return (
    <div
      className="fixed z-[999999] font-sans antialiased text-white select-none"
      style={{
        right: `${position.x}px`,
        bottom: `${position.y}px`,
        width: "300px",
      }}
    >
      {/* 极简半透明磨砂面板 */}
      <div className="flex flex-col gap-2 rounded-xl border border-slate-700/50 bg-slate-900/90 p-3 shadow-2xl backdrop-blur-md">

        {/* 头部拖拽手柄区 */}
        <div
          onMouseDown={handleDragStart}
          className="flex cursor-move items-center justify-between border-b border-slate-700/60 pb-1.5 text-xs text-slate-400 font-bold"
        >
          <span>学堂在线 AI 助手</span>
          <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded font-mono text-emerald-400">
            {statusText}
          </span>
        </div>

        {/* 答题操作区 */}
        <div className="flex gap-2 text-xs">
          <button
            onClick={handleManualAnswer}
            disabled={autoNext}
            className="flex-1 rounded bg-indigo-600 px-3 py-1.5 font-bold hover:bg-indigo-500 active:scale-95 disabled:bg-slate-800 disabled:text-slate-500 disabled:scale-100 transition-all cursor-pointer"
          >
            自动答当前题
          </button>

          <button
            onClick={() => setAutoNext(!autoNext)}
            className={`flex-1 rounded px-3 py-1.5 font-bold active:scale-95 transition-all cursor-pointer ${
              autoNext
                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                : "bg-slate-800 hover:bg-slate-700 text-slate-300"
            }`}
          >
            {autoNext ? "停止自动连答" : "开启自动连答"}
          </button>
        </div>

        {/* 分割线 */}
        <div className="border-t border-slate-700/60" />

        {/* 题目收集区 */}
        <div className="flex flex-col gap-1.5">
          {/* 收集状态行 */}
          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>题目收集</span>
            {collectedCount > 0 && (
              <span className="bg-amber-600/30 text-amber-400 px-1.5 py-0.5 rounded font-mono">
                已收集 {collectedCount} 道
              </span>
            )}
          </div>

          {/* 抓取按钮行：单题抓取 + 连续抓取 */}
          <div className="flex gap-2 text-xs">
            <button
              onClick={handleCaptureQuestion}
              disabled={autoCaptureRunning}
              className="flex-1 rounded bg-amber-600 px-3 py-1.5 font-bold hover:bg-amber-500 active:scale-95 disabled:bg-slate-800 disabled:text-slate-500 disabled:scale-100 transition-all cursor-pointer"
            >
              📋 抓取当前题
            </button>
            <button
              onClick={handleToggleAutoCapture}
              className={`flex-1 rounded px-3 py-1.5 font-bold active:scale-95 transition-all cursor-pointer ${
                autoCaptureRunning
                  ? "bg-rose-600 hover:bg-rose-500 text-white"
                  : "bg-amber-800 hover:bg-amber-700 text-amber-200"
              }`}
            >
              {autoCaptureRunning ? "⏹ 停止" : "⏩ 连续抓取"}
            </button>
          </div>

          {/* 导出与清空（仅在有数据时显示） */}
          {collectedCount > 0 && (
            <div className="flex gap-2 text-xs">
              <button
                onClick={handleExportMd}
                className="flex-1 rounded bg-teal-700 px-3 py-1.5 font-bold hover:bg-teal-600 active:scale-95 transition-all cursor-pointer"
              >
                ⬇️ 导出 MD
              </button>
              <button
                onClick={handleClearCollected}
                className="flex-1 rounded bg-slate-700 px-3 py-1.5 font-bold hover:bg-slate-600 text-slate-300 active:scale-95 transition-all cursor-pointer"
              >
                🗑️ 清空列表
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
