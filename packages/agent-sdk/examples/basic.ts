import { z } from "zod";

import { Agent } from "../src/";
import { openai } from "../src/providers/openai.js";
import { codexCli } from "../src/providers/codex-cli.js";
import { codexSdk } from "../src/providers/codex-sdk.js";
import { tool } from "../src/tool.js";

const calculator = tool({
  name: "add_numbers",
  description: "Adds two numbers together",

  parameters: z.object({
    a: z.number(),
    b: z.number(),
  }),

  execute: ({ a, b }) => {
    return a + b;
  },
});

async function main() {
  const weatherAgent = new Agent({
    name: "WeatherAgent",
    instructions:
      "You're an expert in providing Weather related data. Provide weather information based on user queries.",
    model: codexSdk(),
  });

  console.log(await calculator.execute({ a: 5, b: 10 }));

  console.log(
    await weatherAgent.run(
      "Hello, whats the annual average temparature of Jamnagar ?",
    ),
  );
}

main().catch((err) => {
  console.error("Something went wrong\n", err);
});
