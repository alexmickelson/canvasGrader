import type { FC } from "react";
import { useState } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import * as styles from "react-syntax-highlighter/dist/esm/styles/prism";
import { marked } from "marked";
import DOMPurify from "dompurify";
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
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
}> = ({
  fileName,
  filePath,
  content,
  startLine,
  startColumn,
  endLine,
  endColumn,
}) => {
  const [showPreview, setShowPreview] = useState(true);
  const isMarkdown = isMarkdownFile(filePath);

  // Extract selected content based on line/column parameters
  const getSelectedContent = (fullContent: string): string => {
    if (!startLine && !endLine) {
      return fullContent;
    }

    const lines = fullContent.split("\n");
    const start = Math.max(0, (startLine || 1) - 1); // Convert to 0-based index
    const end = endLine ? Math.min(lines.length, endLine) : lines.length;

    if (start >= lines.length) {
      return "";
    }

    const selectedLines = lines.slice(start, end);

    // Handle column selection for the first and last lines
    if (startColumn && selectedLines.length > 0) {
      const firstLine = selectedLines[0];
      selectedLines[0] = firstLine.substring(Math.max(0, startColumn - 1));
    }

    if (endColumn && selectedLines.length > 0) {
      const lastLine = selectedLines[selectedLines.length - 1];
      selectedLines[selectedLines.length - 1] = lastLine.substring(
        0,
        endColumn
      );
    }

    return selectedLines.join("\n");
  };

  const selectedContent = getSelectedContent(content);

  return (
    <div className="flex flex-col h-full border border-gray-700 rounded w-full">
      <div className="bg-gray-800 px-3 py-2 text-xs text-gray-400 border-b border-gray-700 flex-shrink-0 flex items-center justify-between">
        <div className="flex flex-col">
          <span>{fileName}</span>
          {(startLine || endLine) && (
            <span className="text-xs text-blue-400">
              Lines {startLine || 1}-{endLine || "end"}
              {(startColumn || endColumn) &&
                ` (cols ${startColumn || 1}-${endColumn || "end"})`}
            </span>
          )}
        </div>
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
            dangerouslySetInnerHTML={{
              __html: DOMPurify.sanitize(
                marked(removeDescriptionOfImageTags(selectedContent)) as string
              ),
            }}
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
            startingLineNumber={startLine || 1}
          >
            {selectedContent}
          </SyntaxHighlighter>
        )}
      </div>
    </div>
  );
};

const removeDescriptionOfImageTags = (markdown: string): string => {
  return markdown.replace(
    /<descriptionOfImage>[\s\S]*?<\/descriptionOfImage>/g,
    ""
  );
};
