import type z from "zod";
import type { AiTool } from "../../../../utils/aiUtils/createAiTool";
import { getAiCompletion } from "../../../../utils/aiUtils/getAiCompletion";
import type { ConversationMessage } from "./generalAiModels";
import { executeToolCall } from "../../../../utils/aiUtils/executeToolCall";

export async function* generalAiConversation(
  startingMessages: ConversationMessage[],
  tools: AiTool[],
  resultSchema?: z.ZodTypeAny | undefined,
): AsyncGenerator<ConversationMessage, ConversationMessage> {
  const conversationMessages: ConversationMessage[] = [...startingMessages];

  while (true) {
    const assistantMessage = await getAiCompletion({
      messages: conversationMessages,
      tools,
      responseFormat: resultSchema,
      temperature: 0.1,
    });
    conversationMessages.push(assistantMessage);
    yield assistantMessage;

    if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      const toolMessages = await handleToolCalls(assistantMessage, tools);

      for (const msg of toolMessages) {
        const toolMessage = {
          role: msg.role,
          content: msg.content,
          tool_call_id: msg.tool_call_id,
        };
        conversationMessages.push(toolMessage);
        yield toolMessage;
      }
    } else {
      // No tool calls, assume conversation is complete
      // last message will be double-represented
      return assistantMessage;
    }
  }
}

// Extracted tool call handler
async function handleToolCalls(
  assistantMessage: ConversationMessage,
  tools: AiTool[],
) {
  const toolMessages = await Promise.all(
    (assistantMessage.tool_calls ?? [])
      .filter((tc) => tc.id && tc.function?.name)
      .map((toolCall) => {
        const genericToolCall = {
          id: toolCall.id!,
          type: toolCall.type || "function",
          function: {
            name: toolCall.function!.name,
            arguments: toolCall.function!.arguments || "",
          },
        };
        return executeToolCall(genericToolCall, tools);
      }),
  );

  return toolMessages;
}
