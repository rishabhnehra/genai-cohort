import { Codex } from "@openai/codex-sdk";

import type { LanguageModel, GenerateOptions } from "../model.js";

class CodexSdk implements LanguageModel {
  private readonly codex: Codex;

  constructor() {
    this.codex = new Codex();
  }

  async generate({ prompt, instructions }: GenerateOptions): Promise<string> {
    const PROMPT = `${instructions}\n\n${prompt}`;
    const thread = this.codex.startThread();

    const { finalResponse } = await thread.run(PROMPT);

    if (!finalResponse) {
      throw new Error("Codex SDK error: No response received.");
    }

    return finalResponse;
  }
}

export function codexSdk(): LanguageModel {
  return new CodexSdk();
}
