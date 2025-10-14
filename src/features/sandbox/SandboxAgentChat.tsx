import { useState, useRef, type FormEvent, type FC } from "react";
import type {
  BaseMessage,
  AIMessage,
  ToolMessage,
} from "@langchain/core/messages";
import { marked } from "marked";
import DOMPurify from "dompurify";
import { useTRPCClient } from "../../server/trpc/trpcClient";

// Component to render ANSI escape codes as colored JSX
const AnsiText: FC<{ text: string }> = ({ text }) => {
  const ESC = "\x1B";

  // Remove cursor movement and control sequences
  const cleaned = text
    .replace(new RegExp(`${ESC}\\[\\?25[lh]`, "g"), "") // Show/hide cursor
    .replace(new RegExp(`${ESC}\\[\\d*[ABCDEFGJKST]`, "g"), "") // Cursor movement
    .replace(new RegExp(`${ESC}\\[\\d*;\\d*[Hf]`, "g"), "") // Cursor position
    .replace(new RegExp(`${ESC}\\[0G`, "g"), ""); // Cursor to column 0

  // Color map for ANSI codes
  const colorMap: Record<string, string> = {
    "30": "#000000",
    "31": "#cd3131",
    "32": "#0dbc79",
    "33": "#e5e510",
    "34": "#2472c8",
    "35": "#bc3fbc",
    "36": "#11a8cd",
    "37": "#e5e5e5",
    "90": "#666666",
    "91": "#f14c4c",
    "92": "#23d18b",
    "93": "#f5f543",
    "94": "#3b8eea",
    "95": "#d670d6",
    "96": "#29b8db",
    "97": "#ffffff",
  };

  // Parse text into segments with color info
  const segments: Array<{ text: string; color?: string }> = [];
  let currentColor: string | undefined;
  let currentText = "";

  const colorRegex = new RegExp(`${ESC}\\[(\\d+;)*\\d+m`, "g");
  let lastIndex = 0;
  let match;

  while ((match = colorRegex.exec(cleaned)) !== null) {
    // Add text before this match
    if (match.index > lastIndex) {
      currentText += cleaned.substring(lastIndex, match.index);
    }

    // Push current segment if we have text
    if (currentText) {
      segments.push({ text: currentText, color: currentColor });
      currentText = "";
    }

    // Extract color codes
    const codes = match[0].match(/\d+/g);
    if (codes) {
      const lastCode = codes[codes.length - 1];
      if (lastCode === "0") {
        currentColor = undefined;
      } else {
        currentColor = colorMap[lastCode];
      }
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < cleaned.length) {
    currentText += cleaned.substring(lastIndex);
  }
  if (currentText) {
    segments.push({ text: currentText, color: currentColor });
  }

  return (
    <>
      {segments.map((segment, idx) => (
        <span key={idx} style={segment.color ? { color: segment.color } : {}}>
          {segment.text}
        </span>
      ))}
    </>
  );
};

export const SandboxAgentChat: FC = () => {
  const [messages, setMessages] = useState<BaseMessage[]>([]);
  const [summary, setSummary] = useState<string>("");
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const trpcClient = useTRPCClient();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userInput = input.trim();
    setInput("");
    setIsProcessing(true);
    setSummary("");
    setMessages([]);

    try {
      const stream = await trpcClient.sandbox.aiTask.mutate({
        task: userInput,
        messageLimit: 50
      });

      const messageBuffer: BaseMessage[] = [];

      for await (const message of stream) {
        if (message && typeof message === "object" && "summary" in message) {
          // Final result
          const result = message as unknown as {
            summary: string;
            messages: BaseMessage[];
          };
          setSummary(result.summary);
          setMessages(result.messages);
        } else {
          // Streaming message chunk
          const chunk = message as BaseMessage & {
            kwargs?: {
              content?: string;
              tool_call_chunks?: Array<{
                name: string;
                args: string;
                id: string;
                index: number;
              }>;
            };
          };

          // Check if this is a chunk that should be merged with the previous message
          const lastMessage = messageBuffer[
            messageBuffer.length - 1
          ] as BaseMessage & {
            kwargs?: {
              content?: string;
              tool_call_chunks?: Array<{
                name: string;
                args: string;
                id: string;
                index: number;
              }>;
            };
          };

          const chunkType =
            (chunk as { type?: string }).type === "constructor"
              ? (chunk as { id?: string[] }).id?.[2]
              : (chunk as { type?: string }).type;

          const lastType = lastMessage
            ? (lastMessage as { type?: string }).type === "constructor"
              ? (lastMessage as { id?: string[] }).id?.[2]
              : (lastMessage as { type?: string }).type
            : null;

          // Merge AIMessageChunk with previous AIMessage/AIMessageChunk
          if (
            chunkType === "AIMessageChunk" &&
            (lastType === "AIMessage" || lastType === "AIMessageChunk")
          ) {
            const mergedContent =
              (lastMessage.kwargs?.content || "") +
              (chunk.kwargs?.content || "");

            // Merge tool call chunks by index
            const existingChunks = lastMessage.kwargs?.tool_call_chunks || [];
            const newChunks = chunk.kwargs?.tool_call_chunks || [];
            const mergedToolCallChunks = [...existingChunks];

            newChunks.forEach((newChunk) => {
              const existingChunkIndex = mergedToolCallChunks.findIndex(
                (c) => c.index === newChunk.index
              );

              if (existingChunkIndex >= 0) {
                // Merge with existing chunk at same index
                const existing = mergedToolCallChunks[existingChunkIndex];
                mergedToolCallChunks[existingChunkIndex] = {
                  ...existing,
                  name: existing.name || newChunk.name,
                  args: (existing.args || "") + (newChunk.args || ""),
                  id: existing.id || newChunk.id,
                  index: existing.index,
                };
              } else {
                // Add new chunk
                mergedToolCallChunks.push(newChunk);
              }
            });

            messageBuffer[messageBuffer.length - 1] = {
              ...lastMessage,
              kwargs: {
                ...lastMessage.kwargs,
                content: mergedContent,
                tool_call_chunks: mergedToolCallChunks,
              },
            } as unknown as BaseMessage;
          } else {
            // Add as new message
            messageBuffer.push(chunk);
          }

          setMessages([...messageBuffer]);
          setTimeout(scrollToBottom, 0);
        }
      }
    } catch (error) {
      console.error("AI task error:", error);
      setSummary(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setIsProcessing(false);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 space-y-4 bg-gray-950 rounded">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center">
            Ask the AI agent to help with tasks in /live_project
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {messages.map((msg, msgIdx) => {
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
                    tool_call_chunks?: Array<{
                      name: string;
                      args: string;
                      id: string;
                      index: number;
                    }>;
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
                if (
                  finalType === "AIMessage" ||
                  finalType === "ai" ||
                  finalType === "AIMessageChunk"
                ) {
                  const aiMsg = msg as AIMessage;
                  const toolCalls =
                    msgData.kwargs?.tool_calls || aiMsg.tool_calls;
                  const toolCallChunks = msgData.kwargs?.tool_call_chunks;

                  // Handle tool call chunks (streaming)
                  if (toolCallChunks && toolCallChunks.length > 0) {
                    return (
                      <div key={msgIdx} className="flex justify-start">
                        <div className="max-w-[80%] rounded-lg p-3 bg-gray-700 text-gray-300">
                          <div className="text-xs opacity-70 mb-1">
                            🔧 Tool Call
                          </div>
                          {toolCallChunks.map((chunk, chunkIdx) => (
                            <div key={chunkIdx} className="font-mono text-sm">
                              {chunk.name}({chunk.args})
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  }

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

                  // Skip empty AIMessageChunk (metadata only)
                  if (
                    finalType === "AIMessageChunk" &&
                    !content &&
                    (!toolCalls || toolCalls.length === 0) &&
                    (!toolCallChunks || toolCallChunks.length === 0)
                  ) {
                    return null;
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
                        <div className="font-mono text-xs whitespace-pre-wrap overflow-x-auto">
                          <AnsiText text={displayContent || ""} />
                        </div>
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

              {summary && (
                <div className="rounded-lg p-4 bg-blue-950/30 border border-blue-900">
                  <div className="text-xs opacity-70 mb-2 text-blue-400">
                    Summary
                  </div>
                  <div
                    className="text-sm text-slate-400 prose prose-invert prose-sm max-w-none"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(marked(summary) as string),
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
          disabled={isProcessing}
        />
        <button
          type="submit"
          disabled={isProcessing || !input.trim()}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isProcessing ? "Thinking..." : "Send"}
        </button>
      </form>
    </div>
  );
};
