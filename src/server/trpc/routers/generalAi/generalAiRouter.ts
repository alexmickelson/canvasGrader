import z from "zod";
import { createTRPCRouter, publicProcedure } from "../../utils/trpc";
import { getAiCompletion } from "../../../../utils/aiUtils/getAiCompletion";
import { parseSchema } from "../parseSchema";
import { generalAiConversation } from "./generalAiUtils";
import { getAiConversation, storeAiConversation } from "./generalAiDbUtils";
import { ConversationMessageSchema } from "./generalAiModels";

export const generalAiRouter = createTRPCRouter({
  getAiChoice: publicProcedure
    .input(
      z.object({
        prompt: z.string(),
        options: z.array(z.string()),
      }),
    )
    .query(async ({ input: { prompt, options } }) => {
      const responseFormat = z.object({ choice: z.string() });
      const optionsString = options
        .map((opt, idx) => `${idx + 1}. ${opt}`)
        .join(", ");
      const completion = await getAiCompletion({
        messages: [
          {
            role: "user",
            content:
              `Given the following prompt: "${prompt}", ` +
              `choose the best option from the following list: ${optionsString}. ` +
              `Respond with only the option in { "choice": "optiontext" }`,
          },
        ],
        responseFormat,
      });

      if (typeof completion.content !== "string") {
        throw new Error("Expected string content from AI completion");
      }
      const parsedContent = JSON.parse(completion.content);
      const parsedResult = parseSchema(
        responseFormat,
        parsedContent,
        "getAiChoice",
      );
      return parsedResult;
    }),

  updateAiConversation: publicProcedure
    .input(
      z.object({
        conversationKey: z.string(),
        conversationType: z.string(),
        relatedId: z.number().nullable().optional(),
        startingMessages: z.array(ConversationMessageSchema),
      }),
    )
    .mutation(async function* ({
      input: { conversationKey, conversationType, relatedId, startingMessages },
    }) {
      const generator = generalAiConversation(startingMessages, []);
      const messages = [...startingMessages];

      let finalResult: unknown;

      while (true) {
        const { value, done } = await generator.next();
        messages.push(value);
        yield value;

        if (done) {
          finalResult = value;
          break;
        }

        if (value && "role" in value) {
          console.log(`📤 Processing message: ${value.role}`);
        }
      }

      await storeAiConversation({
        conversationKey,
        conversationType: conversationType,
        relatedId: relatedId,
        conversationMessages: messages,
        conversationResult: finalResult,
      });

      return finalResult;
    }),

  getAiConversation: publicProcedure
    .input(
      z.object({
        conversationKey: z.string(),
      }),
    )
    .query(async ({ input: { conversationKey } }) => {
      const conversation = await getAiConversation(conversationKey);
      return conversation;
    }),
});
