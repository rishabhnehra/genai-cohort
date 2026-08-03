import { Agent, type Tool } from "./agent.js";
import { promisify } from "node:util";
import { exec as execCallback } from "node:child_process";

const exec = promisify(execCallback);

const weatherTool: Tool = {
  name: "fetchWeather",
  description: "Tool that returns weather data of given input string",
  async executor(city: string) {
    const result = await fetch(
      `https://wttr.in/${city.toLowerCase()}?format=%C+%t`,
    ).then((res) => res.text());

    return JSON.stringify({ city, weather: result });
  },
};

const cliAccessTool: Tool = {
  name: "cliAccess",
  description: "Access to CLI commands",
  async executor(command: string) {
    const { stderr, stdout } = await exec(command);
    if (stderr) {
      return `Something went wrong. Reason -> ${stderr}`;
    }

    return stdout;
  },
};

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
    "Create a simple hello world program in nodejs in current directory",
  );
  // console.log(response);
}

main();
