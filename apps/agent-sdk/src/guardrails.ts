import * as z from "zod";
import { Agent } from "./agent.js";

export const GuardrailDecisionSchema = z.object({
  allowd: z.boolean(),
  reason: z.string().optional(),
});

const inputGuardrail = Agent.builder()
  .setName("input_guardrail")
  .setModel("gpt-5.4-nano")
  .setInstructions(
    `
    You are a helpful agent that works as a security guard.
    Your job is to check the input query from the user and evaluate if the query can be processed or throw an error

    Below are the restriction list
    - No weather data for Delhi city.

    Always output in JSON format. Refer below structure
    {'step': 'OUTPUT', 'allowed': <boolean>, 'reason': <string>}
    `,
  )
  .build();
