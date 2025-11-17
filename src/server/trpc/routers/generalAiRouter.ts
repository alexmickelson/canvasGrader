import z from "zod";
import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import { getAiCompletion } from "../../../utils/aiUtils/getAiCompletion";
import { parseSchema } from "./parseSchema";

export const generalAiRouter = createTRPCRouter({
  getAiChoice: publicProcedure
    .input(
      z.object({
        prompt: z.string(),
        options: z.array(z.string()),
      })
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
        "getAiChoice"
      );
      return parsedResult;
    }),
});
