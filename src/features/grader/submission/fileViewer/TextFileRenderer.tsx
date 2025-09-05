import type { FC } from "react";
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import * as styles from "react-syntax-highlighter/dist/esm/styles/prism";
import { marked } from "marked";
import { languageMap } from "./languageMap";

// Get file extension and determine file type
const getFileExtension = (path: string): string => {
  return path.split(".").pop()?.toLowerCase() || "";
};

// Get syntax highlighting language based on file extension
const getLanguage = (path: string): string => {
  const ext = getFileExtension(path);
  return languageMap[ext] || "text";
};

// Check if file is markdown
const isMarkdownFile = (path: string): boolean => {
  const ext = getFileExtension(path);
  return ext === "md" || ext === "markdown";
};

export const TextFileRenderer: FC<{
  fileName: string;
  filePath: string;
  content: string;
}> = ({ fileName, filePath, content }) => {
  const [showPreview, setShowPreview] = useState(true);
  const isMarkdown = isMarkdownFile(filePath);

  return (
    <div className="flex flex-col h-full min-h-[1000px] border border-gray-700 rounded w-full">
      <div className="bg-gray-800 px-3 py-2 text-xs text-gray-400 border-b border-gray-700 flex-shrink-0 flex items-center justify-between">
        <span>{fileName}</span>
        {isMarkdown && (
          <button
            onClick={() => setShowPreview(!showPreview)}
            className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
          >
            {showPreview ? "Raw" : "Preview"}
          </button>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        {isMarkdown && showPreview ? (
          <div
            className="p-4 text-gray-100"
            dangerouslySetInnerHTML={{ __html: marked(content) }}
          />
        ) : (
          <SyntaxHighlighter
            language={getLanguage(filePath)}
            style={styles.coldarkDark}
            lineProps={{
              style: {
                minWidth: "100%",
                display: "inline-block",
              },
            }}
            customStyle={{
              margin: 0,
              background: "transparent",
            }}
            showLineNumbers={true}
          >
            {content}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
};
