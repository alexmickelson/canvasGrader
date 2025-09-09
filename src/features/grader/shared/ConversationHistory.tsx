import type { FC } from "react";

interface ConversationMessage {
  role: string;
  content?: string | unknown;
  tool_calls?: Array<{
    function?: {
      name?: string;
      arguments?: string;
    };
  }>;
}

export const ConversationHistory: FC<{
  conversation: ConversationMessage[];
  title?: string;
  maxHeight?: string;
}> = ({ conversation, title = "AI Conversation", maxHeight = "max-h-96" }) => {
  if (!conversation || conversation.length === 0) return null;

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <h4 className="font-semibold mb-3">{title}</h4>
      <div className={`space-y-3 ${maxHeight} overflow-auto`}>
        {conversation.map((message, index) => (
          <div
            key={index}
            className={`p-3 rounded ${
              message.role === "user"
                ? "bg-blue-600/20 border-l-4 border-blue-500"
                : message.role === "assistant"
                ? "bg-green-600/20 border-l-4 border-green-500"
                : "bg-gray-700 border-l-4 border-gray-500"
            }`}
          >
            <div className="text-xs text-gray-400 mb-1 capitalize">
              {message.role}
            </div>
            <div className="text-sm">
              {message.content ? (
                typeof message.content === "string" ? (
                  message.content.substring(0, 500) +
                  (message.content.length > 500 ? "..." : "")
                ) : (
                  JSON.stringify(message.content).substring(0, 500)
                )
              ) : message.tool_calls ? (
                <div className="text-gray-400">
                  Tool calls:{" "}
                  {message.tool_calls.map((tc) => tc.function?.name).join(", ")}
                  <div className="mt-2 space-y-1">
                    {message.tool_calls.map((tc, idx) => (
                      <div key={idx} className="text-xs text-gray-300">
                        <strong>{tc.function?.name}:</strong>{" "}
                        {tc.function?.arguments || "No args"}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-gray-400">No content</div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
