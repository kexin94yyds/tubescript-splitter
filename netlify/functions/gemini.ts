import { Handler } from '@netlify/functions';
import { GoogleGenerativeAI } from "@google/generative-ai";

const handler: Handler = async (event, context) => {
  // 只允许 POST 请求
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { videoTitle } = JSON.parse(event.body || '{}');

    if (!videoTitle) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Video title is required' }) };
    }

    // 从环境变量获取 API Key (服务器端安全)
    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error("Server API Key missing");
      return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration error' }) };
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
      },
    });
    
    const prompt = `
      You are an expert transcriber and editor.
      I have a YouTube video titled "${videoTitle}". 
      
      Please generate a comprehensive, highly detailed, verbatim-style transcript of this video, broken down into logical chapters.
      
      IMPORTANT INSTRUCTIONS:
      1. Language: If the title is in Chinese, the content MUST be in Chinese. If the title is English, use English.
      2. Detail Level: The 'content' must NOT be a summary. It should look like a full book chapter or a detailed lecture transcript. Include dialogue, explanations, examples, and technical details mentioned in such a video.
      3. Length: Each chapter's content should be substantial (at least 5-6 paragraphs).
      4. Structure: Divide the video into 5-10 chapters.
      
      Return a JSON ARRAY of objects. Do not wrap it in any other object.
      Schema: Array<{ title: string, content: string (Markdown format) }>
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    if (!text) throw new Error("No response from Gemini");

    return {
      statusCode: 200,
      body: text,
      headers: {
        'Content-Type': 'application/json'
      }
    };

  } catch (error: any) {
    console.error("Gemini Function Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message || "Internal Server Error" })
    };
  }
};

export { handler };
