import { z } from "zod";

export interface ITool<TSchema extends z.ZodType, TOutput> {
  name: string;
  description: string;
  doc?: string;
  parameters: TSchema;
  execute: (input: z.infer<TSchema>) => TOutput | Promise<TOutput>;
}

export function tool<TSchema extends z.ZodType, TOutput>(
  config: ITool<TSchema, TOutput>,
) {
  return config;
}
