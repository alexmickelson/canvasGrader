import z from "zod";

export const ToolCallSchema = z.object({
  id: z.string().optional(),
  type: z.string().optional(),
  function: z
    .object({
      name: z.string(),
      arguments: z.string().optional(),
    })
    .optional(),
});
export type ToolCall = z.infer<typeof ToolCallSchema>;

export const ConversationMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant", "tool"]),
  content: z
    .union([
      z.string(),
      z.array(
        z.object({
          type: z.enum(["text", "image_url"]),
          text: z.string().optional(),
          image_url: z
            .object({
              base64: z.string().describe("Base64 encoded image data"),
              mediaType: z
                .string()
                .optional()
                .describe("MIME type of the image (e.g., 'image/png')"),
            })
            .nullable()
            .optional(),
        }),
      ),
    ])
    .nullable()
    .optional(),
  tool_calls: z.array(ToolCallSchema).optional(),
  tool_call_id: z.string().optional(),
});

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;


export const StoredConversationSchema = z.object({
  conversationKey: z.string(),
  conversationType: z.string(),
  relatedId: z.number().nullable().optional(),
  conversationMessages: z.array(ConversationMessageSchema),
  conversationResult: z.any().nullable().optional(),
});

export type StoredConversation = z.infer<typeof StoredConversationSchema>;