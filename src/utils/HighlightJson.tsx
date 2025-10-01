import { useEffect, useRef, type FC } from "react";
import hljs from "highlight.js/lib/core";
import json from "highlight.js/lib/languages/json";

hljs.registerLanguage("json", json);
import "highlight.js/styles/tokyo-night-dark.css";

// Shared component for JSON highlighting
export const HighlightJson: FC<{ content: string }> = ({ content }) => {
  const ref = useRef<HTMLElement>(null);

  const isJsonString = (str: string): boolean => {
    try {
      JSON.parse(str);
      return true;
    } catch {
      return false;
    }
  };

  const formatJson = (str: string): string => {
    try {
      const parsed = JSON.parse(str);
      const formatted = JSON.stringify(parsed, null, 2);

      // Replace escaped newlines with actual newlines for better readability
      return formatted.replace(/\\n/g, "\n");
    } catch {
      return str;
    }
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (isJsonString(content)) {
      el.textContent = formatJson(content);

      // Clear previous highlighting to allow re-highlighting
      delete el.dataset.highlighted;
      hljs.highlightElement(el);
    }
  }, [content]);

  if (!isJsonString(content)) {
    return (
      <div className="">
        {content.substring(0, 500)}
        {content.length > 500 && <span className="text-slate-400">...</span>}
      </div>
    );
  }

  return (
    <pre className="unstyled">
      <code
        ref={ref}
        className="unstyled language-json"
        style={{ whiteSpace: "pre-wrap" }}
      >
        {formatJson(content)}
      </code>
    </pre>
  );
};
