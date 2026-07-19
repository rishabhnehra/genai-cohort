import {
  loadChatMessages,
  saveChatMessages,
} from "@/features/ai/actions/chat-store";
import { getChatModel } from "@/features/ai/utils";
import { requiredUser } from "@/features/auth/actions/required-user";
import { prisma } from "@/lib/db";
import {
  convertToModelMessages,
  createIdGenerator,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";

export async function POST(request: Request) {
  //   await auth.protect();
  const user = await requiredUser();

  const { id, message }: { id: string; message: UIMessage } =
    await request.json();

  if (!message || !id) {
    throw new Response("Message or Id is not found", { status: 400 });
  }

  const conversation = await prisma.conversation.findFirst({
    where: {
      id,
      userId: user.id,
    },
  });

  if (!conversation) {
    throw new Response("Conversation doesn't exists", { status: 404 });
  }

  const previousMessages = await loadChatMessages(id);

  const alreadySave = previousMessages.some((msg) => msg.id === id);

  const messages = alreadySave
    ? previousMessages
    : [...previousMessages, message];

  if (!alreadySave) {
    await saveChatMessages(conversation.id, [message]);
  }

  const result = streamText({
    model: getChatModel(),
    system:
      conversation.systemPrompt ??
      "You're MochaGPT. A helpful assistant that gives answers in short and easy to understand manner.",
    messages: await convertToModelMessages(messages),
  });

  result.consumeStream();

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      originalMessages: messages,
      generateMessageId: createIdGenerator({ prefix: "msg", size: 16 }),
      onEnd: async ({ messages: finalMessages }) => {
        try {
          await saveChatMessages(conversation.id, finalMessages, {
            updateTitle: false,
          });
        } catch (error) {
          console.error(error);
        }
      },
    }),
  });
}
