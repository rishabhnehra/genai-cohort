import { Agent } from "../src/";
import { openai } from "../src/providers/openai.js";
import { codexCli } from "../src/providers/codex-cli.js";
import { codexSdk } from "../src/providers/codex-sdk.js";

async function main() {
  const weatherAgent = new Agent({
    name: "WeatherAgent",
    instructions:
      "You're an expert in providing Weather related data. Provide weather information based on user queries.",
    model: codexSdk(),
  });

  console.log(
    await weatherAgent.run(
      "Hello, whats the annual average temparature of Jamnagar ?",
    ),
  );
}

main().catch((err) => {
  console.error("Something went wrong\n", err);
});
