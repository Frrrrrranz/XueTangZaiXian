import React from "react";
import { createRoot } from "react-dom/client";
import { FloatingPanel } from "../components/FloatingPanel";
import cssText from "../index.css?inline";

function init() {
  // 检查是否已经注入，避免重复注入
  if (document.getElementById("answers-helper-extension-root")) {
    return;
  }

  // 若在子 iframe 中运行且检测不到任何题目容器，则不渲染浮窗，避免重叠干扰
  if (window !== window.top && !document.querySelector(".leftQuestion") && !document.querySelector(".question")) {
    return;
  }

  const container = document.createElement("div");
  container.id = "answers-helper-extension-root";
  
  // 附加 Shadow Root
  const shadowRoot = container.attachShadow({ mode: "open" });
  
  // 创建 React 容器
  const appRoot = document.createElement("div");
  appRoot.id = "answers-helper-app";
  shadowRoot.appendChild(appRoot);
  
  // 引入内联的 Tailwind 样式，防止因域名匹配或 CSP 限制加载失败
  const style = document.createElement("style");
  style.textContent = cssText;
  shadowRoot.appendChild(style);

  document.body.appendChild(container);
  
  // 渲染 React 应用
  const root = createRoot(appRoot);
  root.render(
    <React.StrictMode>
      <FloatingPanel />
    </React.StrictMode>
  );
}

// 监听页面加载状态进行注入
if (document.readyState === "complete" || document.readyState === "interactive") {
  init();
} else {
  window.addEventListener("DOMContentLoaded", init);
}
