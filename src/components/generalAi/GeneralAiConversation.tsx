import { useState, type FC } from "react";
import { useUpdateAiConversationMessages } from "../../features/grader/generalAiHooks";
import type { StoredConversation } from "../../server/trpc/routers/generalAi/generalAiModels";

export const GeneralAiConversation: FC<{
  conversation: StoredConversation;
}> = ({ conversation }) => {
  const [userInput, setUserInput] = useState("");
  const { messages, lastMessage, mutate } =
    useUpdateAiConversationMessages(conversation);
  return (
    <div>
      {messages.map((message, index) => (
        <div key={index + (message.content ?? "").toString()}>
          {typeof message.content === "string" && (
            <>
              <strong>{message.role}:</strong>
              <span>{message.content}</span>
            </>
          )}
          |
        </div>
      ))}

      <form onSubmit={(e ) => {
        e.preventDefault();
        mutate(userInput);
      }}>
        <label>Write a message</label>
        <input
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
        />
      </form>
    </div>
  );
};
