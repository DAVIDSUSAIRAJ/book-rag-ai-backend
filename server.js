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

// Get LLM response
async function getLLMResponse(bookContent, question, language) {
  const prompt = `You are a helpful assistant that answers questions based on a book.

BOOK CONTENT:
${bookContent}

USER'S QUESTION: ${question}

INSTRUCTIONS:
1. Answer ONLY based on the book content above.
2. User may type in Tanglish/Hinglish/spelling mistakes - understand their intent.
3. Answer in ${language} language.
4. If not in book, say "I don't have information about this in the book."

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
    const { text, language } = req.body;

    if (!text || !language) {
      return res.status(400).json({ error: "Missing required fields: text and language" });
    }

    const validLanguages = ["tamil", "english", "hindi", "telugu", "malayalam", "german"];
    if (!validLanguages.includes(language)) {
      return res.status(400).json({ error: `Invalid language. Choose from: ${validLanguages.join(", ")}` });
    }

    const bookContent = getBookContent(language);
    const answer = await getLLMResponse(bookContent, text, language);

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
