import { HARNESS_PROMPT } from "./config.js";

interface Message {
  role: "USER" | "ASSISTANT" | "DEVELOPER";
  content: string;
}

interface Tool {
  name: string;
  description: string;
  executor: (input: string) => Promise<string>;
}

class AgentBuilder {
  public instructions: string | undefined;
  public tools: Tool[];

  // Addressed one error where TS explicitly added undefined to "tools"
  constructor() {
    this.tools = [];
  }

  public setInstructions(instructions: string) {
    this.instructions = instructions;
    return this;
  }

  public tool(t: Tool) {
    this.tools.push(t);
  }

  public build() {
    return new Agent(this);
  }
}

export class Agent {
  private instructions: string | undefined;
  private messages: Message[];
  private toolMap: Map<string, Tool>;

  constructor(builder: AgentBuilder) {
    this.toolMap = new Map();

    for (const t of builder.tools) {
      this.toolMap.set(t.name, t);
    }

    this.instructions = `
        ${HARNESS_PROMPT}\n\n

        System Prompt:
        ${builder.instructions}

        Tools:
        ${builder.tools.map((t) => JSON.stringify({ name: t.name, description: t.description }))}
    `;
    this.messages = [];
  }

  static builder() {
    return new AgentBuilder();
  }

  public getInstruction() {
    return this.instructions;
  }

  public run() {
    return `From Agent class -> Instruction ${this.instructions}`;
  }
}
