export interface Question {
  title: string;
  options: string[];
  optionElements: HTMLElement[];
}

/**
 * 触发双保险原生鼠标点击事件 (防沙盒环境崩溃，100% 模拟真实点击)
 */
function triggerNativeClick(el: HTMLElement) {
  if (!el) return;
  
  // 1. 派发原生 click 事件 (去除沙盒敏感的 view 属性以防类型错误崩溃)
  try {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  } catch (e) {
    console.error("【点击调试】派发 click 失败:", e);
  }
  
  // 2. 派发 mousedown / mouseup 事件组合 (双保险，确保 React 答题状态更新)
  try {
    el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
    el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true }));
  } catch (e) {
    console.error("【点击调试】派发 mousedown/mouseup 失败:", e);
  }
  
  // 3. 辅助触发获取焦点
  try {
    el.focus();
  } catch (e) {
    // 忽略不支持 focus 属性的元素报错
  }
}

/**
 * 抓取当前页面上的题目与选项 (针对学堂在线，兼容单选、多选和判断题)
 */
export function grabCurrentQuestion(doc: Document): Question | null {
  const leftQ = doc.querySelector(".leftQuestion");
  if (!leftQ) return null;
  
  // 1. 提取题干文本
  const stemEl = leftQ.querySelector(".fuwenben") as HTMLElement;
  if (!stemEl) return null;
  const title = stemEl.innerText.trim();
  
  // 2. 提取选项标签
  const allPs = Array.from(leftQ.querySelectorAll("p")) as HTMLElement[];
  // 过滤掉题干内部的 p 标签，只保留属于选项的 p 标签
  const optionPs = allPs.filter(p => !p.closest(".fuwenben"));
  
  const options: string[] = [];
  const optionElements: HTMLElement[] = [];
  
  // 选项包含重复的修饰节点，因此步进 2 进行提取与清洗
  for (let i = 0; i < optionPs.length; i += 2) {
    const el = optionPs[i];
    if (el) {
      // 清理多余换行，比如 "A\n\n数据清洗" -> "A 数据清洗"
      const text = el.innerText.trim().replace(/\n+/g, " ");
      options.push(text);
      optionElements.push(el);
    }
  }

  // 3. 判断题特殊处理：若左侧抓不到选项，但右侧作答区存在判断按钮 (radio_xtb)
  if (options.length === 0) {
    const radioElements = Array.from(doc.querySelectorAll(".answer .radio_xtb")) as HTMLElement[];
    if (radioElements.length === 2) {
      options.push("A. 正确");
      options.push("B. 错误");
      optionElements.push(radioElements[0]); // A 对应对 (√)
      optionElements.push(radioElements[1]); // B 对应错 (×)
    }
  }
  
  // 若题目和选项都为空，则认为抓取失败
  if (options.length === 0) {
    return null;
  }
  
  return {
    title,
    options,
    optionElements
  };
}

/**
 * 从页面"正确答案"区域直接抓取答案字母（无需调用 AI）。
 *
 * 真实 DOM 结构（由探针确认）：
 *   .answerList                          ← 外层作答区
 *     span.radio_xtb.active              ← 已选答案（用户作答，含 active 类）
 *     ...
 *     .answerList[style*=padding-top]    ← 内嵌的正确答案区
 *       p.myanswer                       ← 文本"正确答案"
 *       span.radio_xtb                   ← 正确答案字母（无 active 类）
 *
 * 策略优先级：
 *   1. p.myanswer → nextElementSibling（最精准，直接命中正确答案 span）
 *   2. .answerList[style*=padding-top] 内第一个 .radio_xtb（同上，容器级定位）
 *   3. 左侧题目区 .leftradio .radio_xtb.active（作答区高亮选项，兜底）
 *
 * 返回大写字母字符串（单选 "A"，多选 "AB"），无法抓取则返回 null。
 */
export function grabCorrectAnswer(doc: Document): string | null {
  // ── 策略 1：p.myanswer → nextElementSibling ─────────────────────────────
  // DOM: <p class="myanswer">正确答案</p><span class="radio_xtb ...">A</span>
  const myAnswerLabel = doc.querySelector("p.myanswer") as HTMLElement | null;
  if (myAnswerLabel) {
    let sibling = myAnswerLabel.nextElementSibling as HTMLElement | null;
    while (sibling) {
      // span 内文字可能含换行空白，需 replace 清洗
      const text = sibling.innerText?.trim().replace(/\s+/g, "");
      if (text && /^[A-Da-d正确错误]+$/.test(text)) {
        return normalizeAnswer(text);
      }
      sibling = sibling.nextElementSibling as HTMLElement | null;
    }
  }

  // ── 策略 2：含 padding-top 的内嵌 .answerList 容器（多选题可能有多个答案 span）
  // DOM: <div class="answerList" style="padding-top: 27px;">...</div>
  const correctBox = Array.from(
    doc.querySelectorAll(".answerList[style*='padding-top']")
  ).find((el) => el.querySelector("p.myanswer")) as HTMLElement | undefined;

  if (correctBox) {
    const spans = Array.from(correctBox.querySelectorAll(".radio_xtb")) as HTMLElement[];
    const letters = spans
      .map((el) => el.innerText?.trim().replace(/\s+/g, ""))
      .filter((t) => t && /^[A-D]$/.test(t))
      .sort();
    if (letters.length > 0) return letters.join("");
  }

  // ── 策略 3：左侧题目区已高亮选项（.leftradio .radio_xtb.active）─────────
  // 探针3 数据: class="radio_xtb unselectable active" 父class="leftradio showUntil"
  const leftActives = Array.from(
    doc.querySelectorAll(".leftradio .radio_xtb.active")
  ) as HTMLElement[];
  const leftLetters = leftActives
    .map((el) => el.innerText?.trim().replace(/\s+/g, ""))
    .filter((t) => t && /^[A-D]$/.test(t))
    .sort();
  if (leftLetters.length > 0) return leftLetters.join("");

  // 三种策略均失败
  return null;
}

/**
 * 将抓取到的答案文本标准化为大写字母。
 * 支持 "正确" -> "A"（判断题），"错误" -> "B"（判断题），其他直接大写。
 */
function normalizeAnswer(raw: string): string {
  if (raw === "正确") return "A";
  if (raw === "错误") return "B";
  return raw.toUpperCase().replace(/[^A-D]/g, "");
}

/**
 * 根据 AI 返回的答案（如 A、B、C、D、AB 等），模拟勾选页面选项
 */
export function selectOptionByAnswer(q: Question, answer: string): boolean {
  if (!q) return false;
  
  let success = false;
  // 提取答案文本中的所有大写字母选项 (支持多选和判断)
  const letters = answer.toUpperCase().match(/[A-D]/g);
  
  if (letters) {
    const doc = document;
    letters.forEach(letter => {
      // 1. 点击左侧题目里的选项 (起展示高亮作用)
      if (q.optionElements && q.optionElements.length > 0) {
        const idx = letter.charCodeAt(0) - 65; // A -> 0, B -> 1, C -> 2, D -> 3
        const el = q.optionElements[idx];
        if (el) {
          triggerNativeClick(el);
          success = true;
        }
      }
      
      // 2. 核心：点击右侧作答区的对应字母按钮 (真正激活 React 答题状态)
      const rightBtns = Array.from(doc.querySelectorAll(".answer *")) as HTMLElement[];
      const rightLetterBtn = rightBtns.find(
        el => el.innerText && el.innerText.trim() === letter && el.children.length === 0
      );
      if (rightLetterBtn) {
        triggerNativeClick(rightLetterBtn);
        success = true;
        console.log(`%c【自动勾选调试】成功点击右侧作答区按钮 [${letter}]`, "color: #10b981;");
      }
    });
  }
  return success;
}

/**
 * 寻找并模拟点击“提交”按钮
 */
export function clickSubmitQuestion(doc: Document): boolean {
  // 1. 超级优先：寻找页面上的真实 button 标签，且文字包含 "提交" 或 "确认"
  const buttons = Array.from(doc.querySelectorAll("button")) as HTMLElement[];
  let submitBtn = buttons.find(btn => {
    const text = btn.innerText ? btn.innerText.trim() : "";
    return text.includes("提交") || text === "确认";
  });
  
  // 2. 兜底方案：如果找不到 button，则在其他标签中找，但必须过滤掉含有 Con/container/List 等容器类名的盒子
  if (!submitBtn) {
    const elements = Array.from(doc.querySelectorAll("div, span")) as HTMLElement[];
    submitBtn = elements.find(el => {
      const text = el.innerText ? el.innerText.trim() : "";
      const className = el.className || "";
      const isContainer = className.includes("Con") || className.includes("container") || className.includes("List");
      return (text.includes("提交") || text === "确认") && !isContainer;
    });
  }
  
  if (submitBtn) {
    console.log(
      "%c【自动提交调试】成功定位到按钮，开始派发双保险鼠标事件...",
      "color: #3b82f6; font-weight: bold;"
    );
    triggerNativeClick(submitBtn);
    return true;
  }
  
  console.warn(
    "%c【自动提交调试】警告：未在页面上找到任何有效提交按钮。",
    "color: #ef4444; font-weight: bold;"
  );
  return false;
}

/**
 * 寻找并模拟点击“下一题”按钮以实现连答 (优化版：基于 total 标签定位右侧翻页箭头，全线接入双保险点击)
 */
export function clickNextQuestion(doc: Document): boolean {
  const elements = Array.from(doc.querySelectorAll("button, div, span")) as HTMLElement[];
  
  // 1. 优先寻找文本是 "下一题"、"下一步" 的实体按钮
  const nextBtn = elements.find(el => {
    const text = el.innerText ? el.innerText.trim() : "";
    return text === "下一题" || text === "下一步" || text === "下一单元";
  });
  
  if (nextBtn) {
    console.log("%c【连答跳转调试】找到‘下一题’按钮，执行双保险点击...", "color: #3b82f6;");
    triggerNativeClick(nextBtn);
    return true;
  }
  
  // 2. 兜底方案：寻找类名包含 "total" 且带有斜杠的页码总数 span，点击它的右侧兄弟节点
  const totalEl = elements.find(el => {
    const className = el.className;
    return typeof className === "string" && className.includes("total") && el.innerText.includes("/");
  });
  
  if (totalEl && totalEl.nextElementSibling) {
    console.log("%c【连答跳转调试】未找到文字按钮，通过页码指示器定位到右箭头 (>)，执行双保险点击...", "color: #3b82f6;");
    triggerNativeClick(totalEl.nextElementSibling as HTMLElement);
    return true;
  }
  
  return false;
}
