import { useQuery } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "../../server/trpc/trpcClient";
import { useState } from "react";
import type {
  ConversationMessage,
  StoredConversation,
} from "../../server/trpc/routers/generalAi/generalAiModels";

export const useAiChoiceQuery = ({
  prompt,
  options,
}: {
  prompt: string;
  options: string[];
}) => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.generalAi.getAiChoice.queryOptions({
      prompt,
      options,
    }),
    enabled: !!prompt && options.length > 0,
  });
};

export const useGetAiConversation = (conversationKey: string) => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.generalAi.getAiConversation.queryOptions({
      conversationKey,
    }),
  });
};

export const useUpdateAiConversationMessages = ({
  conversationKey,
  conversationType,
  relatedId,
  conversationMessages, //any old messages?
  // conversationResult,
}: StoredConversation) => {
  const trpcClient = useTRPCClient();
  const [messages, setMessages] =
    useState<ConversationMessage[]>(conversationMessages);
  const [lastMessage, setLastMessage] = useState<string>("");

  return {
    messages,
    lastMessage,
    mutate: async (newUserInput: string) => {
      const newMessage: ConversationMessage = {
        role: "user",
        content: newUserInput,
      };
      const messages = [...conversationMessages, newMessage];

      const stream = await trpcClient.generalAi.updateAiConversation.mutate({
        conversationKey,
        conversationType,
        relatedId,
        startingMessages: messages,
      });

      for await (const message of stream) {
        setMessages((prev) => [...prev, message]);
        if (
          message.role === "assistant" &&
          message.content &&
          typeof message.content === "string"
        ) {
          setLastMessage(message.content);
        }
      }
    },
  };
};
