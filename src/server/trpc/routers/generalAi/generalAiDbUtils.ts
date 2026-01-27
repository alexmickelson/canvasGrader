import { db } from "../../../services/dbUtils";
import { parseSchema } from "../parseSchema";
import { StoredConversationSchema, type StoredConversation } from "./generalAiModels";

export async function storeAiConversation({
  conversationKey,
  conversationType,
  relatedId,
  conversationMessages,
  conversationResult,
}: StoredConversation) {
  return await db.one(
    `
      INSERT INTO ai_conversations (
        conversation_key, conversation_type, related_id, conversation_messages, conversation_result
      ) VALUES (
        $<conversationKey>, $<conversationType>, $<relatedId>, $<conversationMessages>, $<conversationResult>
      )
      ON CONFLICT (conversation_key) DO UPDATE SET
        conversation_type = EXCLUDED.conversation_type,
        related_id = EXCLUDED.related_id,
        conversation_messages = EXCLUDED.conversation_messages,
        conversation_result = EXCLUDED.conversation_result
      RETURNING conversation_key
    `,
    {
      conversationKey,
      conversationType,
      relatedId: relatedId ?? null,
      conversationMessages,
      conversationResult: conversationResult ?? null,
    },
  );
}

export async function getAiConversation(conversationKey: string) {
  const result = await db.oneOrNone(
    `
      SELECT conversation_key, conversation_type, related_id, conversation_messages, conversation_result
      FROM ai_conversations
      WHERE conversation_key = $<conversationKey>
    `,
    { conversationKey },
  );
  return parseSchema(StoredConversationSchema, result, "StoredConversation from DB");
}
