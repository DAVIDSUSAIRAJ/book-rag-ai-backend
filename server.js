import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Load chunks on server start
let allChunks = [];
try {
  const data = fs.readFileSync("./data/chunks.json", "utf-8");
  allChunks = JSON.parse(data);
  console.log(`✅ Loaded ${allChunks.length} chunks`);
} catch (error) {
  console.error("❌ Failed to load chunks:", error.message);
}

// Get all chunks for a specific language
function getBookContent(language) {
  const languageChunks = allChunks.filter((chunk) => chunk.language === language);
  return languageChunks.map((chunk) => chunk.text).join("\n\n---\n\n");
}

// Format chat history for prompt
function formatChatHistory(history) {
  if (!history || history.length === 0) return "";

  const formatted = history
    .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content}`)
    .join("\n");

  return `\nPREVIOUS CONVERSATION:\n${formatted}\n`;
}

// Get LLM response
async function getLLMResponse(bookContent, question, language, history) {
  const languageMap = {
    tamil: "Tamil (தமிழ்)",
    english: "English",
    hindi: "Hindi (हिंदी)",
    telugu: "Telugu (తెలుగు)",
    malayalam: "Malayalam (മലയാളം)",
    german: "German (Deutsch)",
  };

  const targetLang = languageMap[language] || language;
  const chatHistory = formatChatHistory(history);

  const prompt = `You are a helpful assistant that answers questions based on a book.

BOOK CONTENT:
${bookContent}
${chatHistory}
CURRENT USER'S QUESTION: ${question}

UNDERSTANDING USER INPUT:
Users may type in various ways - you MUST understand their intent:

1. TAMIL users may type:
   - Pure Tamil: "காதல் பற்றி சொல்லு"
   - Tanglish (Tamil + English): "kadhal patri sollu", "appa amma about sollu"
   - Mixed: "love பற்றி சொல்லு"

2. ENGLISH users may type:
   - Normal English: "Tell me about love"
   - With typos: "tel me abot love"

3. HINDI users may type:
   - Pure Hindi: "प्यार के बारे में बताओ"
   - Hinglish (Hindi + English): "pyaar ke baare mein batao", "love ke baare mein bolo"

4. TELUGU users may type:
   - Pure Telugu: "ప్రేమ గురించి చెప్పు"
   - Tenglish (Telugu + English): "prema gurinchi cheppu", "love gurinchi cheppu"

5. MALAYALAM users may type:
   - Pure Malayalam: "സ്നേഹത്തെ കുറിച്ച് പറയൂ"
   - Manglish (Malayalam + English): "sneham kurichu parayoo", "love ne patti para"

6. GERMAN users may type:
   - Pure German: "Erzähl mir von der Liebe"
   - With English mix: "Tell me about Liebe"

STRICT RESPONSE RULES:
1. Answer ONLY based on the book content above.
2. Understand user intent regardless of spelling mistakes or language mixing.
3. Use PREVIOUS CONVERSATION context if available (user may ask follow-up questions like "அது பற்றி மேலும் சொல்லு", "tell me more", etc.)
4. DEFAULT language is ${targetLang}. Use ${targetLang} script for answers.
5. EXCEPTION: If user explicitly asks for translation (e.g., "English la sollu", "translate to Hindi", "German-ல சொல்லு"), respond in that requested language.
6. If answer not in book, say "I don't have information about this in the book" (in appropriate language).

YOUR ANSWER:`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });

  return response.text;
}

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  return res.send("ChatBot is running");
});

app.post("/chat", async (req, res) => {
  try {
    const { text, language, history } = req.body;

    if (!text || !language) {
      return res.status(400).json({ error: "Missing required fields: text and language" });
    }

    const validLanguages = ["tamil", "english", "hindi", "telugu", "malayalam", "german"];
    if (!validLanguages.includes(language)) {
      return res.status(400).json({ error: `Invalid language. Choose from: ${validLanguages.join(", ")}` });
    }

    const bookContent = getBookContent(language);
    const answer = await getLLMResponse(bookContent, text, language, history || []);

    return res.json({
      success: true,
      question: text,
      language: language,
      answer: answer,
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
    return res.status(500).json({ error: "Something went wrong", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
