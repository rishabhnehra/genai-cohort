export type GenerateOptions = {
  prompt: string;
  instructions: string;
};

export interface LanguageModel {
  generate({ prompt, instructions }: GenerateOptions): Promise<string>;
}
