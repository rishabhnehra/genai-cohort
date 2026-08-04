import { Agent, type Tool } from "./agent.js";
import { cliAccessTool, weatherTool } from "./tools.js";

async function main() {
  const weatherAgent = Agent.builder()
    .setName("weather_agent")
    .setInstructions(
      "You are an weather assistant that can answer questions related to weather",
    )
    .tool(weatherTool)
    .build();

  const agent = Agent.builder()
    .setName("main")
    .setInstructions(
      "You are a helpful assistant that can answer questions and help with tasks.",
    )
    .tool(cliAccessTool)
    .handoffAgent(weatherAgent)
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

  const response = await agent.run("Whats the weather of Jamnagar ?");
  // console.log(response);
}

main();
