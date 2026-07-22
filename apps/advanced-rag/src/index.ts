import "dotenv/config";
import { createSubtitleVectorStore } from "./documents-loader/vector-store.js";
import { fuseWithRrf } from "./orchestrator/rrf.js";
import { orchestrateRetrieval } from "./orchestrator/retrieve.js";

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is missing. Add it to apps/advanced-rag/.env",
    );
  }

  console.log("Loading SRT subtitles and building MemoryVectorStore...");
  const store = await createSubtitleVectorStore();

  const userQuery = "What is Expo?";
  console.log(`\nOrchestrating retrieval for: "${userQuery}"\n`);

  const {
    stepBackQuery,
    subQueries,
    executedQueries,
    results,
  } = await orchestrateRetrieval(store, userQuery);

  console.log("Step-back query:", stepBackQuery);
  console.log("Sub-queries:", subQueries);
  console.log(
    `\nExecuted ${executedQueries.length} queries; ${results.length} returned documents.\n`,
  );

  for (const { query, records } of results) {
    console.log(`=== Query: "${query}" (${records.length} hits) ===`);
    for (const [index, { document, score }] of records.entries()) {
      console.log(`--- Hit ${index + 1} (score: ${score}) ---`);
      console.log(`module: ${document.metadata.module}`);
      console.log(`lecture: ${document.metadata.lecture}`);
      console.log(`source: ${document.metadata.source}`);
      console.log(document.pageContent.slice(0, 300));
      console.log();
    }
  }

  const fused = fuseWithRrf(results, { limit: 3 });
  console.log(`=== Fused ranking (RRF, top ${fused.length}) ===\n`);

  for (const { document, rrfScore, rank, appearances } of fused) {
    const querySummary = appearances
      .map((appearance) => `"${appearance.query}"@${appearance.rank}`)
      .join(", ");

    console.log(
      `#${rank}  rrf=${rrfScore.toFixed(3)}  lists=${appearances.length}/${results.length}  module=${document.metadata.module} lecture=${document.metadata.lecture}`,
    );
    console.log(`    source: ${document.metadata.source}`);
    console.log(`    queries: ${querySummary}`);
    console.log(document.pageContent.slice(0, 300));
    console.log();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
