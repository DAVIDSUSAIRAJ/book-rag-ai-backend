// generateEmbeddings.js
// One-time script: Generate embeddings using @google/genai (FREE!)

import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Read chunks
const chunks = JSON.parse(fs.readFileSync("./data/chunks.json", "utf-8"));

console.log("\n🚀 Starting Embedding Generation (Gemini FREE!)...\n");
console.log(`📊 Total chunks to process: ${chunks.length}`);
console.log(`🔑 Gemini API Key: ${process.env.GEMINI_API_KEY ? "✅ Found" : "❌ Missing!"}\n`);

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY not found in .env file!");
  process.exit(1);
}

/**
 * Generate embedding for a single text using @google/genai
 */
async function generateEmbedding(text) {
  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
  });
  
  // Response structure: response.embeddings[0].values OR response.embedding.values
  if (response.embeddings && response.embeddings[0]) {
    return response.embeddings[0].values;
  } else if (response.embedding) {
    return response.embedding.values;
  } else {
    console.log("Response structure:", JSON.stringify(response, null, 2));
    throw new Error("Unexpected response structure");
  }
}

/**
 * Process all chunks in batches
 */
async function generateAllEmbeddings() {
  const chunksWithEmbeddings = [];
  const batchSize = 10; // Process 10 at a time
  const totalBatches = Math.ceil(chunks.length / batchSize);

  console.log(`📦 Processing in ${totalBatches} batches (${batchSize} chunks each)\n`);

  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;

    console.log(`⏳ Batch ${batchNum}/${totalBatches} - Processing ${batch.length} chunks...`);

    // Process batch in parallel
    const batchPromises = batch.map(async (chunk) => {
      const embedding = await generateEmbedding(chunk.text);
      return {
        ...chunk,
        embedding: embedding,
      };
    });

    const batchResults = await Promise.all(batchPromises);
    chunksWithEmbeddings.push(...batchResults);

    console.log(`✅ Batch ${batchNum}/${totalBatches} complete!`);

    // Delay between batches to avoid rate limits
    if (i + batchSize < chunks.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return chunksWithEmbeddings;
}

// Main execution
async function main() {
  try {
    const startTime = Date.now();

    // Generate embeddings
    const chunksWithEmbeddings = await generateAllEmbeddings();

    // Save to file
    fs.writeFileSync(
      "./data/chunks-with-embeddings.json",
      JSON.stringify(chunksWithEmbeddings, null, 2),
      "utf-8"
    );

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log("\n" + "=".repeat(50));
    console.log("✅ EMBEDDING GENERATION COMPLETE!");
    console.log("=".repeat(50));
    console.log(`📊 Total chunks processed: ${chunksWithEmbeddings.length}`);
    console.log(`📁 Saved to: ./data/chunks-with-embeddings.json`);
    console.log(`⏱️  Time taken: ${duration} seconds`);
    console.log(`📏 Embedding dimension: 768 (Gemini)`);
    console.log("=".repeat(50) + "\n");

  } catch (error) {
    console.error("\n❌ Error generating embeddings:", error.message);
    if (error.message.includes("API key")) {
      console.error("   → Check your GEMINI_API_KEY in .env file");
    }
    process.exit(1);
  }
}

main();
