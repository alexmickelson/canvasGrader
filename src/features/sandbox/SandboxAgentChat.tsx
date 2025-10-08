import { useState, useRef, type FormEvent, type FC } from "react";
import { useAiTask } from "./sandboxHooks";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export const SandboxAgentChat: FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
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

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    try {
      const result = await aiTask.mutateAsync({
        task: input.trim(),
      });

      const assistantMessage: Message = {
        role: "assistant",
        content: result.result,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      const errorMessage: Message = {
        role: "assistant",
        content: `Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    }

    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 space-y-4 bg-gray-950 rounded">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center">
            Ask the AI agent to help with tasks in /live_project
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  msg.role === "user"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-200"
                }`}
              >
                <div className="text-xs opacity-70 mb-1">
                  {msg.role === "user" ? "You" : "AI Agent"}
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))
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
