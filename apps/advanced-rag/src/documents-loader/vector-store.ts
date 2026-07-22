import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";
import { MemoryVectorStore } from "@langchain/classic/vectorstores/memory";
import { loadSubtitleDocuments } from "./loader.js";

export async function createSubtitleVectorStore(): Promise<MemoryVectorStore> {
  const documents = await loadSubtitleDocuments();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const chunks = await splitter.splitDocuments(documents);

  const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-small",
    configuration: {
      baseURL: "https://openrouter.ai/api/v1",
    },
  });

  return MemoryVectorStore.fromDocuments(chunks, embeddings);
}
