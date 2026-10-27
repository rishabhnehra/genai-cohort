import type { LanguageModel } from "./model.js";

export class Agent {
  private readonly name: string;
  private readonly instructions: string;
  private readonly model: LanguageModel;

  constructor({
    name,
    instructions,
    model,
  }: {
    name?: string;
    instructions: string;
    model: LanguageModel;
  }) {
    this.name = name || `unnamed_agent:${crypto.randomUUID()}`;
    this.instructions = instructions;
    this.model = model;
  }

  async run(input: string) {
    return this.model.generate({
      prompt: input,
      instructions: this.instructions,
    });
  }
}
