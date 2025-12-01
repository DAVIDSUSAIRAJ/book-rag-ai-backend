// server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import fs from "fs";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ========================================
// STEP 1: Server start ஆகும்போது chunks load
// ========================================
let chunksWithEmbeddings = [];

try {
  const data = fs.readFileSync("./data/chunks-with-embeddings.json", "utf-8");
  chunksWithEmbeddings = JSON.parse(data);
  console.log(`✅ Loaded ${chunksWithEmbeddings.length} chunks`);
} catch (error) {
  console.error("❌ Error:", error.message);
}

// ========================================
// STEP 2: User question → Embedding
// ========================================
async function generateEmbedding(text) {
  const response = await ai.models.embedContent({
    model: "text-embedding-004",
    contents: text,
  });

  return response.embeddings[0].values; // 768 numbers
}

// ========================================
// STEP 3: Cosine Similarity
// ========================================
function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0;  // A·B
  let normA = 0;       // |A|
  let normB = 0;       // |B|

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  // Formula: cos(θ) = (A·B) / (|A| × |B|)
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ========================================
// STEP 4: Find Similar Chunks
// ========================================
function findSimilarChunks(questionEmbedding, language, topK = 10) {
  // Filter chunks by selected language
  const languageChunks = chunksWithEmbeddings.filter(
    (chunk) => chunk.language === language
  );

  console.log(`📚 Searching in ${languageChunks.length} ${language} chunks`);

  // Calculate similarity for each chunk
  const chunksWithScore = languageChunks.map((chunk) => ({
    ...chunk,
    score: cosineSimilarity(questionEmbedding, chunk.embedding),
  }));

  // Sort by score (highest first) and get top K
  const topChunks = chunksWithScore
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return topChunks;
}

// ========================================
// STEP 5: Get LLM Response
// ========================================
async function getLLMResponse(context, question, language) {
  const languageNames = {
    tamil: "Tamil (தமிழ்)",
    english: "English",
    hindi: "Hindi (हिन्दी)",
    telugu: "Telugu (తెలుగు)",
    malayalam: "Malayalam (മലയാളം)",
    german: "German (Deutsch)",
  };

  const prompt = `You are a helpful assistant that answers questions based on a book.

CONTEXT FROM THE BOOK:
${context}

USER'S QUESTION: ${question}

IMPORTANT INSTRUCTIONS:
1. Answer ONLY based on the context provided above.
2. Answer in ${languageNames[language] || language} language.
3. If the answer is not in the context, say "I don't have information about this in the book."
4. Keep your answer helpful and concise.

YOUR ANSWER:`;

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: prompt,
  });

  return response.text;
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  return res.send("HI ChatBot is running");
});

// ========================================
// STEP 6: POST /chat - Main API Endpoint
// ========================================
app.post("/chat", async (req, res) => {
  try {
    const { text, language } = req.body;

    // Validation
    if (!text || !language) {
      return res.status(400).json({
        error: "Missing required fields: text and language",
      });
    }

    const validLanguages = ["tamil", "english", "hindi", "telugu", "malayalam", "german"];
    if (!validLanguages.includes(language)) {
      return res.status(400).json({
        error: `Invalid language. Choose from: ${validLanguages.join(", ")}`,
      });
    }

    console.log(`\n${"=".repeat(50)}`);
    console.log(`📝 Question: ${text}`);
    console.log(`🌐 Language: ${language}`);

    // Step A: Generate embedding for user's question
    console.log("🔄 Generating question embedding...");
    const questionEmbedding = await generateEmbedding(text);

    // Step B: Find similar chunks
    console.log("🔍 Finding similar chunks...");
    const similarChunks = findSimilarChunks(questionEmbedding, language);

    console.log(`✅ Found top ${similarChunks.length} similar chunks`);

    // Step C: Create context from similar chunks
    const context = similarChunks.map((chunk) => chunk.text).join("\n\n---\n\n");

    // Step D: Get LLM response
    console.log("🤖 Getting LLM response...");
    const answer = await getLLMResponse(context, text, language);

    console.log(`✅ Response generated!`);
    console.log(`${"=".repeat(50)}\n`);

    // Return response
    return res.json({
      success: true,
      question: text,
      language: language,
      answer: answer,
    });

  } catch (error) {
    console.error("❌ Error:", error.message);
    return res.status(500).json({
      error: "Something went wrong",
      details: error.message,
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
