import { describe, expect, it } from "vitest";

import { shouldShowAssistantTypingIndicator } from "./assistant-typing-indicator";

describe("shouldShowAssistantTypingIndicator", () => {
  it("shows while submitted even with no messages yet", () => {
    expect(shouldShowAssistantTypingIndicator([], "submitted")).toBe(true);
  });

  it("shows while submitted after the user message is added", () => {
    expect(
      shouldShowAssistantTypingIndicator(
        [{ id: "1", role: "user", parts: [{ type: "text", text: "Hi" }] }],
        "submitted",
      ),
    ).toBe(true);
  });

  it("hides once the assistant has streamed text", () => {
    expect(
      shouldShowAssistantTypingIndicator(
        [
          { id: "1", role: "user", parts: [{ type: "text", text: "Hi" }] },
          { id: "2", role: "assistant", parts: [{ type: "text", text: "Hello" }] },
        ],
        "streaming",
      ),
    ).toBe(false);
  });

  it("shows for an empty assistant placeholder during streaming", () => {
    expect(
      shouldShowAssistantTypingIndicator(
        [
          { id: "1", role: "user", parts: [{ type: "text", text: "Hi" }] },
          { id: "2", role: "assistant", parts: [{ type: "text", text: "" }] },
        ],
        "streaming",
      ),
    ).toBe(true);
  });

  it("shows for an empty assistant placeholder when status is already ready", () => {
    expect(
      shouldShowAssistantTypingIndicator(
        [
          { id: "1", role: "user", parts: [{ type: "text", text: "Hi" }] },
          { id: "2", role: "assistant", parts: [{ type: "text", text: "" }] },
        ],
        "ready",
      ),
    ).toBe(true);
  });
});
