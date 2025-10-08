import { useState, useRef, type FormEvent, type FC } from "react";
import { useAiTask } from "./sandboxHooks";
import type {
  BaseMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { marked } from "marked";
import DOMPurify from "dompurify";

export const SandboxAgentChat: FC = () => {
  const [conversation, setConversation] = useState<{
    summary: string;
    messages: BaseMessage[];
  } | null>(null);
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const aiTask = useAiTask();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || aiTask.isPending) return;

    const userInput = input.trim();
    setInput("");

    const result = await aiTask.mutateAsync({
      task: userInput,
    });

    console.log("got result:", result);
    setConversation(result);
    setTimeout(scrollToBottom, 100);

    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 space-y-4 bg-gray-950 rounded">
        {!conversation ? (
          <div className="text-gray-500 text-center">
            Ask the AI agent to help with tasks in /live_project
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {conversation.messages.map((msg, msgIdx) => {
                const msgData = msg as {
                  type?: string;
                  id?: string[];
                  role?: string;
                  content?: string;
                  kwargs?: {
                    type?: string;
                    content?: string;
                    name?: string;
                    tool_call_id?: string;
                    tool_calls?: Array<{ name: string; args: unknown }>;
                  };
                };
                const msgType = msgData.kwargs?.type || msg.type;
                const msgClass = msgData.id?.[msgData.id.length - 1];
                const msgRole = msgData.role;

                // Handle "constructor" type by using the class name
                const actualType =
                  msgData.type === "constructor" ? msgClass : msgType;

                // Map role to type if needed
                const finalType =
                  actualType ||
                  (msgRole === "user"
                    ? "human"
                    : msgRole === "assistant"
                    ? "ai"
                    : msgRole === "system"
                    ? "system"
                    : msgType);

                // System messages
                if (finalType === "SystemMessage" || finalType === "system") {
                  const content =
                    msgData.kwargs?.content || msgData.content || msg.content;
                  return (
                    <div key={msgIdx} className="flex justify-center">
                      <div className="max-w-[80%] rounded-lg p-3 bg-gray-900 text-gray-400 border border-gray-700">
                        <div className="text-xs opacity-70 mb-1">System</div>
                        <div className="text-xs whitespace-pre-wrap">
                          {content?.toString()}
                        </div>
                      </div>
                    </div>
                  );
                }

                // User message
                if (finalType === "HumanMessage" || finalType === "human") {
                  const content =
                    msgData.kwargs?.content || msgData.content || msg.content;
                  return (
                    <div key={msgIdx} className="flex justify-end">
                      <div className="max-w-[80%] rounded-lg p-3 bg-slate-900 text-white">
                        <div className="text-xs opacity-70 mb-1">You</div>
                        <div className="whitespace-pre-wrap">
                          {content?.toString()}
                        </div>
                      </div>
                    </div>
                  );
                }

                // AI tool calls and messages
                if (finalType === "AIMessage" || finalType === "ai") {
                  const aiMsg = msg as AIMessage;
                  const toolCalls =
                    msgData.kwargs?.tool_calls || aiMsg.tool_calls;

                  if (toolCalls && toolCalls.length > 0) {
                    return (
                      <div key={msgIdx} className="flex justify-start">
                        <div className="max-w-[80%] rounded-lg p-3 bg-gray-700 text-gray-300">
                          <div className="text-xs opacity-70 mb-1">
                            🔧 Tool Call
                          </div>
                          {toolCalls.map((call, callIdx) => (
                            <div key={callIdx} className="font-mono text-sm">
                              {call.name}({JSON.stringify(call.args)})
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  // AI response
                  const content = msgData.kwargs?.content || aiMsg.content;
                  if (content) {
                    return (
                      <div key={msgIdx} className="flex justify-start">
                        <div className="max-w-[80%] rounded-lg p-3 bg-gray-800 text-gray-200">
                          <div className="text-xs opacity-70 mb-1">
                            AI Agent
                          </div>
                          <div
                            className="prose prose-invert prose-sm max-w-none"
                            dangerouslySetInnerHTML={{
                              __html: DOMPurify.sanitize(
                                marked(content.toString()) as string
                              ),
                            }}
                          />
                        </div>
                      </div>
                    );
                  }

                  // Check if it's a stop message
                  const responseMetadata = (
                    msgData.kwargs as {
                      response_metadata?: { finish_reason?: string };
                    }
                  )?.response_metadata;
                  const finishReason = responseMetadata?.finish_reason;

                  if (finishReason === "stop") {
                    return (
                      <div key={msgIdx} className="flex justify-start">
                        <div className="max-w-[80%] rounded-lg p-3 bg-gray-800 text-gray-400">
                          end of conversation
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={msgIdx} className="flex justify-start">
                      <div className="max-w-[80%] rounded-lg p-3 bg-gray-900 text-gray-500 text-xs border border-gray-800">
                        <div className="opacity-70 mb-2">
                          AI message - tool_calls: {toolCalls?.length || 0},
                          content: {content ? "exists" : "empty"},
                          finish_reason: {finishReason || "unknown"}
                        </div>
                        <pre className="text-xs overflow-x-auto bg-black p-2 rounded whitespace-pre-wrap break-words">
                          {JSON.stringify(msg, null, 2)}
                        </pre>
                      </div>
                    </div>
                  );
                }

                // Tool result
                if (finalType === "ToolMessage" || finalType === "tool") {
                  const toolName =
                    msgData.kwargs?.name || (msg as ToolMessage).name;
                  const content = (
                    msgData.kwargs?.content || (msg as ToolMessage).content
                  )?.toString();
                  const displayContent =
                    content && content.length > 500
                      ? content.substring(0, 500) + "..."
                      : content;
                  return (
                    <div key={msgIdx} className="flex justify-start">
                      <div className="max-w-[80%] rounded-lg p-3 bg-gray-800 text-gray-300">
                        <div className="text-xs opacity-70 mb-1">
                          ✓ Tool Result: {toolName}
                        </div>
                        <div
                          className="font-mono text-xs whitespace-pre-wrap overflow-x-auto"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(displayContent || ""),
                          }}
                        />
                      </div>
                    </div>
                  );
                }

                // Unknown message type
                return (
                  <div key={msgIdx} className="flex justify-center">
                    <div className="w-full rounded-lg p-3 bg-gray-900 text-gray-500 text-xs border border-gray-800">
                      <div className="opacity-70 mb-2">
                        Unknown - type: {msgType || "(empty)"}, actualType:{" "}
                        {actualType || "(empty)"}, class:{" "}
                        {msgClass || "(empty)"}, role: {msgRole || "(empty)"},
                        finalType: {finalType || "(empty)"}
                      </div>
                      <pre className="text-xs overflow-x-auto bg-black p-2 rounded whitespace-pre-wrap break-words">
                        {JSON.stringify(msg, null, 2)}
                      </pre>
                    </div>
                  </div>
                );
              })}

              {conversation.summary && (
                <div className="rounded-lg p-4 bg-blue-950/30 border border-blue-900">
                  <div className="text-xs opacity-70 mb-2 text-blue-400">
                    Summary
                  </div>
                  <div
                    className="text-sm text-slate-400 prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(
                        marked(conversation.summary) as string
                      ),
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask AI to run tests, check files, etc..."
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 text-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-600"
          disabled={aiTask.isPending}
        />
        <button
          type="submit"
          disabled={aiTask.isPending || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {aiTask.isPending ? "Thinking..." : "Send"}
        </button>
      </form>
    </div>
  );
};
