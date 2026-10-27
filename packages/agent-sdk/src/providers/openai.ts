import "dotenv/config";
import OpenAI from "openai";
import type { GenerateOptions, LanguageModel } from "../model.js";
import type { ResponsesModel } from "openai/resources";

class OpenAIModel implements LanguageModel {
  private readonly model: ResponsesModel;
  private readonly client: OpenAI;

  constructor(model: ResponsesModel) {
    this.model = model;
    this.client = new OpenAI();
  }

  async generate({ prompt, instructions }: GenerateOptions): Promise<string> {
    const response = await this.client.responses.create({
      model: this.model,
      input: prompt,
      instructions,
    });

    return response.output_text;
  }
}

export function openai(model: ResponsesModel): LanguageModel {
  return new OpenAIModel(model);
}
