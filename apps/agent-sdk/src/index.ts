import { Agent, type Tool } from "./agent.js";
import { cliAccessTool, weatherTool } from "./tools.js";

async function main() {
  const agent = Agent.builder()
    .setInstructions(
      "You are a helpful assistant that can answer questions and help with tasks.",
    )
    .tool(weatherTool)
    .tool(cliAccessTool)
    .build();

  agent.attachInterceptor((message) => {
    const { role, content } = message;
    let emoji;

    switch (role) {
      case "assistant":
        emoji = "🤖";
        break;

      case "developer":
        emoji = "💻";
        break;

      case "user":
        emoji = "🥸";
        break;

      default:
        emoji = "🤔";
        break;
    }

    console.info(`${emoji}: ${content}`);
  });

  const response = await agent.run(
    "Create a simple hello world program in cpp in current directory",
  );
  // console.log(response);
}

main();
