import { describe, expect, it } from "vitest";
import type { UIMessage } from "ai";

import { messageRowToUIMessage } from "./chat-ui-message";
import { stripTrailingAssistantMessages } from "./chat-store";

function textMessage(
  id: string,
  role: "user" | "assistant",
  text: string,
): UIMessage {
  return {
    id,
    role,
    parts: [{ type: "text", text }],
  };
}

describe("messageRowToUIMessage", () => {
  it("maps assistant rows with citation metadata", () => {
    const message = messageRowToUIMessage({
      id: "msg-1",
      role: "ASSISTANT",
      content: "Answer with [1]",
      parts: [{ type: "text", text: "Answer with [1]" }],
      metadata: {
        citations: [
          {
            index: 1,
            chunkId: "chunk-1",
            sourceId: "source-1",
            sourceType: "PDF",
            sourceTitle: "Doc",
            locator: { kind: "pdf", page: 1 },
          },
        ],
      },
      status: "COMPLETE",
    });

    expect(message.role).toBe("assistant");
    expect(message.parts).toEqual([{ type: "text", text: "Answer with [1]" }]);
    expect(message.metadata).toMatchObject({
      citations: [{ index: 1, sourceId: "source-1" }],
    });
  });

  it("falls back to content when parts are empty", () => {
    const message = messageRowToUIMessage({
      id: "msg-2",
      role: "USER",
      content: "What is this?",
      parts: null,
      metadata: null,
      status: "COMPLETE",
    });

    expect(message.role).toBe("user");
    expect(message.parts).toEqual([{ type: "text", text: "What is this?" }]);
  });

  it("marks failed rows in metadata", () => {
    const message = messageRowToUIMessage({
      id: "msg-3",
      role: "ASSISTANT",
      content: "Error",
      parts: null,
      metadata: null,
      status: "FAILED",
    });

    expect(message.metadata).toMatchObject({ failed: true });
  });
});

describe("stripTrailingAssistantMessages", () => {
  it("reuses the most recent assistant id so regenerate can update that row", () => {
    const messages = [
      textMessage("u1", "user", "Hey"),
      textMessage("a1", "assistant", "Hello! How can I assist you today?"),
    ];

    const result = stripTrailingAssistantMessages(messages);

    expect(result.messages).toEqual([textMessage("u1", "user", "Hey")]);
    expect(result.replaceAssistantId).toBe("a1");
    expect(result.orphanAssistantIds).toEqual([]);
  });

  it("marks older trailing assistants as orphans when duplicates already exist", () => {
    const messages = [
      textMessage("u1", "user", "Hey"),
      textMessage("a1", "assistant", "Hello! How can I assist you today?"),
      textMessage("a2", "assistant", "Hello! How can I assist you today?"),
    ];

    const result = stripTrailingAssistantMessages(messages);

    expect(result.messages).toEqual([textMessage("u1", "user", "Hey")]);
    expect(result.replaceAssistantId).toBe("a2");
    expect(result.orphanAssistantIds).toEqual(["a1"]);
  });

  it("leaves history unchanged when the last message is not an assistant", () => {
    const messages = [textMessage("u1", "user", "Hey")];

    const result = stripTrailingAssistantMessages(messages);

    expect(result.messages).toEqual(messages);
    expect(result.replaceAssistantId).toBeUndefined();
    expect(result.orphanAssistantIds).toEqual([]);
  });
});
