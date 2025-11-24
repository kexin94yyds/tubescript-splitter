import { Chapter } from "../types";

// Helper to simulate "watching" the video and getting chapters
export const generateMockChapters = async (videoTitle: string): Promise<Chapter[]> => {
  try {
    console.log("Requesting chapters from backend API...");
    
    // Call our secure backend function
    // In development (Vite), this is proxied to the Netlify Function
    // In production, this hits the same domain
    const response = await fetch('/.netlify/functions/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoTitle }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.warn("Backend API returned error:", response.status, errorData);
      throw new Error(errorData.error || `API Request failed: ${response.status}`);
    }

    const rawChapters = await response.json();
    
    return rawChapters.map((ch: any, idx: number) => ({
      index: idx + 1,
      title: ch.title,
      content: ch.content
    }));

  } catch (error) {
    console.error("Chapter Generation Error:", error);
    console.warn("Falling back to mock data due to API failure");
    return getFallbackChapters(videoTitle);
  }
};

const getFallbackChapters = (title: string): Chapter[] => [
  { index: 1, title: "前言：视频介绍", content: `# 前言：视频介绍\n\n欢迎大家来到本期视频。今天我们要深入探讨的主题是 "${title}"。这是一个非常关键的话题，特别是在当前的各种技术趋势下。\n\n我们将从基础概念开始，逐步深入到核心逻辑。无论你是初学者还是专家，相信本期内容都会对你有所启发。请准备好笔记，我们马上开始。\n\n在视频的第一部分，我们先来回顾一下背景知识。` },
  { index: 2, title: "核心概念解析", content: `# 核心概念解析\n\n让我们进入正题。这个概念的核心在于理解其背后的运作机制。\n\n通常人们会误解这一点，认为它只是表面上看起来那样。但实际上，如果你仔细分析数据流，你会发现其中隐藏着更深层的逻辑。\n\n举个例子，当我们处理大规模并发时，系统不仅仅是增加了负载，更是改变了交互模式。这就像交通堵塞，不是车多了那么简单，而是整个路网的效率发生了非线性的变化。` },
  { index: 3, title: "实战演示", content: `# 实战演示\n\n现在，我们通过一个具体的案例来演示。\n\n大家看屏幕，这里我打开了演示环境。首先，我们需要配置初始化参数。这一步非常关键，很多错误都是因为这里没有设置对导致的。\n\n**步骤一：** 打开配置文件。\n**步骤二：** 修改变量 X 为 Y。\n\n看到没有？一旦我们应用了这个更改，系统的响应速度立刻提升了 30%。这就是优化带来的直接效果。` },
  { index: 4, title: "常见问题与解决方案", content: `# 常见问题与解决方案\n\n在实际操作中，大家可能会遇到几个常见的问题。\n\n第一个问题是：为什么我的输出结果和预期不一致？这通常是因为数据类型转换的问题。务必检查你的输入源。\n\n第二个问题涉及到兼容性。在旧版本的系统中，这个 API 的行为是不同的。你需要查看官方文档的迁移指南。\n\n最后，关于安全性，永远不要在生产环境中硬编码密钥。这是大忌。` },
  { index: 5, title: "总结与展望", content: `# 总结与展望\n\n好了，今天的视频就到这里。我们总结一下。\n\n我们讨论了 "${title}" 的方方面面，从理论到实践，再到故障排查。希望这些内容能帮助你在工作中更得心应手。\n\n技术的更新换代很快，保持学习的心态是最重要的。如果你觉得本期视频有帮助，请点赞订阅。\n\n下期视频，我们将讨论更高级的进阶技巧，敬请期待！` },
];