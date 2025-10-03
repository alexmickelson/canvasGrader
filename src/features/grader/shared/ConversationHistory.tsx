import { useEffect, useRef, type FC } from "react";
import type {
  ConversationMessage,
  ToolCall,
} from "../../../server/trpc/routers/rubricAI/rubricAiReportModels";
import hljs from "highlight.js/lib/core";
import { HighlightJson } from "../../../utils/HighlightJson";

export const ConversationHistory: FC<{
  conversation: ConversationMessage[];
  maxHeight?: string;
}> = ({ conversation, maxHeight = "max-h-96" }) => {
  if (!conversation || conversation.length === 0) return null;

  return (
    <div className=" border-l-4 border-l-violet-900/60 rounded-lg ps-2 p-4 ">
      <div className={`space-y-3 ${maxHeight} overflow-auto pr-2`}>
        {conversation.map((message, index) => {
          switch (message.role) {
            case "user":
              return <UserMessage key={index} content={message.content} />;
            case "assistant":
              if (message.tool_calls) {
                return (
                  <ToolCallsMessage
                    key={index}
                    toolCalls={message.tool_calls}
                  />
                );
              }
              return <AssistantMessage key={index} content={message.content} />;
            case "system":
              return <SystemMessage key={index} content={message.content} />;
            case "tool":
              return (
                <ToolResultMessage
                  key={index}
                  content={message.content}
                  toolCallId={message.tool_call_id}
                />
              );
            default:
              return null;
          }
        })}
      </div>
    </div>
  );
};

const SHARED_CLASSES = {
  messageContainer: "border-l-2 rounded-r-lg p-3 transition-colors",
  badge:
    "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mb-2",
  content: "text-sm text-slate-200 leading-relaxed",
  codeBlock: "text-xs bg-slate-800 p-2 rounded overflow-x-auto",
} as const;

const UserMessage: FC<{
  content: ConversationMessage["content"];
}> = ({ content }) => {
  return (
    <div
      className={`
      bg-slate-800/50 border-l-slate-400
      ${SHARED_CLASSES.messageContainer}
    `}
    >
      <div
        className={`
        bg-slate-600 text-slate-200
        ${SHARED_CLASSES.badge}
      `}
      >
        user
      </div>

      <div className={SHARED_CLASSES.content}>
        {typeof content === "string" ? (
          <div className="whitespace-pre-wrap">
            {content.substring(0, 500)}
            {content.length > 500 && (
              <span className="text-slate-400">...</span>
            )}
          </div>
        ) : (
          <pre className={SHARED_CLASSES.codeBlock}>
            {JSON.stringify(content, null, 2).substring(0, 500)}
          </pre>
        )}
      </div>
    </div>
  );
};

const AssistantMessage: FC<{
  content: ConversationMessage["content"];
}> = ({ content }) => {
  return (
    <div
      className={`
      bg-emerald-900/20 border-l-emerald-500
      ${SHARED_CLASSES.messageContainer}
    `}
    >
      <div
        className={`
        bg-emerald-950 text-emerald-100 border border-emerald-700
        ${SHARED_CLASSES.badge}
      `}
      >
        assistant
      </div>

      <div className={SHARED_CLASSES.content}>
        {typeof content === "string" ? (
          <HighlightJson content={content} />
        ) : (
          <pre className={SHARED_CLASSES.codeBlock}>
            {JSON.stringify(content, null, 2).substring(0, 500)}
          </pre>
        )}
      </div>
    </div>
  );
};

const ToolCallItem: FC<{
  toolCall: ToolCall;
}> = ({ toolCall }) => {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !toolCall.function?.arguments) return;
    el.textContent = toolCall.function.arguments;

    // Clear previous highlighting to allow re-highlighting
    delete el.dataset.highlighted;
    hljs.highlightElement(el);
  }, [toolCall.function?.arguments]);

  return (
    <div className="flex">
      <div className="text-slate-300 font-mono text-xs flex-1">
        {toolCall.function?.name}
      </div>
      {toolCall.function?.arguments && (
        <div className="flex-1">
          <pre className="unstyled">
            <code ref={ref} className="unstyled language-json">
              {toolCall.function.arguments}
            </code>
          </pre>
        </div>
      )}
    </div>
  );
};

const ToolCallsMessage: FC<{
  toolCalls: ToolCall[];
}> = ({ toolCalls }) => {
  return (
    <div
      className={`bg-gray-800/50 border-l-gray-500 ${SHARED_CLASSES.messageContainer} flex flex-col`}
    >
      <div>
        <div
          className={`
          bg-gray-900 text-gray-100 border border-gray-600
          ${SHARED_CLASSES.badge}
          `}
        >
          tool call
        </div>
      </div>
      <div className={SHARED_CLASSES.content + " space-y-2"}>
        {toolCalls.map((tc, idx) => (
          <ToolCallItem key={idx} toolCall={tc} />
        ))}
      </div>
    </div>
  );
};

const SystemMessage: FC<{
  content: ConversationMessage["content"];
}> = ({ content }) => {
  return (
    <div
      className={`
      bg-purple-900/20 border-l-purple-500
      ${SHARED_CLASSES.messageContainer}
    `}
    >
      <div
        className={`
        bg-purple-700 text-purple-100 border-purple-600
        ${SHARED_CLASSES.badge}
      `}
      >
        system
      </div>

      <div className={SHARED_CLASSES.content}>
        {typeof content === "string" ? (
          <HighlightJson content={content} />
        ) : (
          <pre className={SHARED_CLASSES.codeBlock}>
            {JSON.stringify(content, null, 2).substring(0, 500)}
          </pre>
        )}
      </div>
    </div>
  );
};

const ToolResultMessage: FC<{
  content: ConversationMessage["content"];
  toolCallId?: string;
}> = ({ content, toolCallId }) => {
  const isJsonString = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  const renderContent = (content: string) => {
    if (isJsonString(content)) {
      return <HighlightJson content={content} />;
    } else {
      // Check if content has line numbers (pattern: number followed by colon and space)
      const hasLineNumbers = /^\d+:\s/.test(content.trim());

      if (hasLineNumbers) {
        // Split into lines and render each line separately to handle wrapping properly
        const lines = content.split("\n");
        return (
          <div className="font-mono text-sm">
            {lines.map((line, index) => {
              const match = line.match(/^(\d+:\s*)(.*)$/);
              if (match) {
                const [, lineNumber, lineContent] = match;
                return (
                  <div key={index} className="flex items-start">
                    <span className="text-slate-400 shrink-0 select-none  min-w-[2rem] text-right">
                      {lineNumber.replace(":", ":")}
                    </span>
                    <span
                      className="whitespace-pre-wrap break-words flex-1 min-w-0"
                      style={{
                        textIndent: "-2rem",
                        paddingLeft: "2rem",
                      }}
                    >
                      {lineContent}
                    </span>
                  </div>
                );
              } else {
                return (
                  <div key={index} className="flex items-start">
                    <span className="shrink-0 select-none pr-3 min-w-[4rem]"></span>
                    <span
                      className="whitespace-pre-wrap break-words flex-1 min-w-0"
                      style={{
                        textIndent: "-2rem",
                        paddingLeft: "2rem",
                      }}
                    >
                      {line}
                    </span>
                  </div>
                );
              }
            })}
          </div>
        );
      } else {
        return (
          <pre
            className="font-mono text-sm unstyled"
            style={{ whiteSpace: "pre-wrap" }}
          >
            {content}
          </pre>
        );
      }
    }
  };

  return (
    <div
      className={`
        bg-orange-900/20 border-l-orange-500
        ${SHARED_CLASSES.messageContainer}
      `}
    >
      <div
        className={`
          bg-orange-950 text-orange-100 border-orange-900 border
          ${SHARED_CLASSES.badge}
        `}
      >
        tool result {toolCallId && `(${toolCallId.substring(0, 8)}...)`}
      </div>

      <div className={SHARED_CLASSES.content}>
        {typeof content === "string" ? (
          renderContent(content)
        ) : (
          <pre className={SHARED_CLASSES.codeBlock}>
            {JSON.stringify(content, null, 2).substring(0, 500)}
          </pre>
        )}
      </div>
    </div>
  );
};
