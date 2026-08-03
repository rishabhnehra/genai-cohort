import "dotenv/config";
import { HARNESS_PROMPT } from "./config.js";
import OpenAI from "openai";

interface Message {
  role: "user" | "assistant" | "developer";
  content: string;
}

export interface Tool {
  name: string;
  description: string;
  executor: (input: string) => Promise<string>;
}

type Interceptor = (message: Message) => void;

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
    return this;
  }

  public build() {
    return new Agent(this);
  }
}

export class Agent {
  private instructions: string | undefined;
  private messages: Message[];
  private toolMap: Map<string, Tool>;
  private openAi: OpenAI;
  private interceptors: Interceptor[];

  private MAX_LOOP = 50;

  constructor(builder: AgentBuilder) {
    this.interceptors = [];
    this.toolMap = new Map();
    this.openAi = new OpenAI({
      apiKey: process.env.OpenAI,
      baseURL: "https://openrouter.ai/api/v1",
    });

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

  public attachInterceptor(interceptor: Interceptor) {
    this.interceptors.push(interceptor);
  }

  private notifyInterceptor(message: Message) {
    for (const interceptor of this.interceptors) {
      interceptor(message);
    }
  }

  public getInstruction() {
    return this.instructions || "";
  }

  public async run(query: string) {
    this.messages.push({
      role: "user",
      content: query,
    });
    for (let i = 0; i < this.MAX_LOOP; i++) {
      const llmResponse = await this.openAi.chat.completions.create({
        model: "gpt-4o",
        messages: [
          { role: "system", content: this.getInstruction() },
          ...this.messages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        ],
      });

      const rawLlmResponse = llmResponse.choices[0]?.message.content as string;

      this.notifyInterceptor({
        role: "assistant",
        content: rawLlmResponse,
      });
      this.messages.push({
        role: "assistant",
        content: rawLlmResponse,
      });

      const parsedResponse = JSON.parse(rawLlmResponse);

      if (parsedResponse.step.toLowerCase() === "output") {
        return this.messages;
      }

      if (parsedResponse.step.toLowerCase() === "tool_request") {
        const { functionName, input } = parsedResponse;

        if (!this.toolMap.has(functionName)) {
          this.messages.push({
            role: "developer",
            content: "Error: Tool not found",
          });
          continue;
        }

        const toolResult = await this.toolMap
          .get(functionName)
          ?.executor(input);

        this.notifyInterceptor({
          role: "developer",
          content: JSON.stringify({
            functionName,
            input,
            toolResult,
          }),
        });
        this.messages.push({
          role: "developer",
          content: JSON.stringify({
            functionName,
            input,
            toolResult,
          }),
        });
      }
    }
  }
}
