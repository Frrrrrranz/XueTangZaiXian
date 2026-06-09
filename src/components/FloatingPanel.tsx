import React, { useState, useEffect, useRef } from "react";
import { grabCurrentQuestion, selectOptionByAnswer, clickSubmitQuestion, clickNextQuestion, type Question } from "../utils/dom-grabber";

export const FloatingPanel: React.FC = () => {
  // 状态显示文本与连答状态
  const [statusText, setStatusText] = useState("待答题");
  const [autoNext, setAutoNext] = useState(false);
  
  // 记录最后一次回答的题目，避免在连答轮询中重复提交相同题目
  const lastQuestionTitle = useRef("");
  
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

  // 4. 拖拽定位处理
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

        {/* 控制操作区 (全文字无图标按钮) */}
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
      </div>
    </div>
  );
};
