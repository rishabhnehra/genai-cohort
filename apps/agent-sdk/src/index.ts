import { Agent } from "./agent.js";

async function main() {
  const agent = Agent.builder()
    .setInstructions(
      "You are a helpful assistant that can answer questions and help with tasks.",
    )
    .build();

  const response = agent.getInstruction();
  console.log(response);
}

main();
