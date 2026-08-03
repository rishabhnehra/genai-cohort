import { HARNESS_PROMPT } from "./config.js";

interface Message {
  role: "USER" | "ASSISTANT" | "DEVELOPER";
  content: string;
}

class AgentBuilder {
  public instructions: string | undefined;

  public setInstructions(instructions: string) {
    this.instructions = instructions;
    return this;
  }

  public build() {
    return new Agent(this);
  }
}

class Agent {
  private instructions: string | undefined;
  private messages: Message[];

  constructor(builder: AgentBuilder) {
    this.instructions = `
        ${HARNESS_PROMPT}\n\n

        System Prompt:
        ${this.instructions}
    `;
    this.messages = [];
  }

  static builder() {
    return new AgentBuilder();
  }

  public run() {
    return `From Agent class -> Instruction ${this.instructions}`;
  }
}

async function main() {
  const agent = Agent.builder()
    .setInstructions(
      "You are a helpful assistant that can answer questions and help with tasks.",
    )
    .build();

  const response = agent.run();
  console.log(response);
}

main();
