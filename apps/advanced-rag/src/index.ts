import "dotenv/config";
import { createSubtitleVectorStore } from "./documents-loader/vector-store.js";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to apps/advanced-rag/.env",
    );
  }

  console.log("Loading SRT subtitles and building MemoryVectorStore...");
  const store = await createSubtitleVectorStore();

  const query = "What is Expo?";
  console.log(`\nSimilarity search: "${query}"\n`);

  const results = await store.similaritySearch(query, 5);
  for (const [index, doc] of results.entries()) {
    console.log(`--- Hit ${index + 1} ---`);
    console.log(`module: ${doc.metadata.module}`);
    console.log(`lecture: ${doc.metadata.lecture}`);
    console.log(`source: ${doc.metadata.source}`);
    console.log(doc.pageContent.slice(0, 300));
    console.log();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
