import type { FC } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import * as styles from "react-syntax-highlighter/dist/esm/styles/prism";
import Spinner from "../../../../utils/Spinner";
import { languageMap } from "./languageMap";

interface FileContentRendererProps {
  fileType: "pdf" | "image" | "text" | "unknown";
  fileName: string;
  filePath: string;
  fileData:
    | {
        type: string;
        content: string;
        mimeType: string;
        fileName: string;
      }
    | undefined;
  isLoading: boolean;
  error: { message: string } | null;
}

// Get file extension and determine file type
const getFileExtension = (path: string): string => {
  return path.split(".").pop()?.toLowerCase() || "";
};

// Get syntax highlighting language based on file extension
const getLanguage = (path: string): string => {
  const ext = getFileExtension(path);

  return languageMap[ext] || "text";
};

export const FileContentRenderer: FC<FileContentRendererProps> = ({
  fileType,
  fileName,
  filePath,
  fileData,
  isLoading,
  error,
}) => {
  if (error) {
    return (
      <div className="p-4 border border-red-700 bg-red-900/20 rounded text-red-300">
        Error: {error.message}
      </div>
    );
  }

  switch (fileType) {
    case "image":
      if (isLoading) {
        return (
          <div className="flex items-center justify-center py-8">
            <Spinner size={24} className="text-gray-400" />
            <span className="ml-2 text-gray-400">Loading image...</span>
          </div>
        );
      }

      if (fileData?.type === "binary") {
        return (
          <div className="text-center">
            <img
              src={`data:${fileData.mimeType};base64,${fileData.content}`}
              alt={fileName}
              className="max-w-full max-h-96 mx-auto rounded border border-gray-700"
            />
          </div>
        );
      }
      break;

    case "pdf":
      if (isLoading) {
        return (
          <div className="flex items-center justify-center py-8">
            <Spinner size={24} className="text-gray-400" />
            <span className="ml-2 text-gray-400">Loading PDF...</span>
          </div>
        );
      }

      if (fileData?.type === "binary") {
        return (
          <div className="h-96 border border-gray-700 rounded">
            <iframe
              src={`data:${fileData.mimeType};base64,${fileData.content}`}
              className="w-full h-full rounded"
              title={fileName}
            />
          </div>
        );
      }
      break;

    case "text":
      if (isLoading) {
        return (
          <div className="flex items-center justify-center py-8">
            <Spinner size={24} className="text-gray-400" />
            <span className="ml-2 text-gray-400">Loading file content...</span>
          </div>
        );
      }

      if (fileData?.type === "text") {
        return (
          <div className="flex flex-col h-full min-h-[1000px] border border-gray-700 rounded">
            <div className="bg-gray-800 px-3 py-2 text-xs text-gray-400 border-b border-gray-700 flex-shrink-0">
              {fileName}
            </div>
            <div className="flex-1 overflow-auto">
              <SyntaxHighlighter
                language={getLanguage(filePath)}
                style={styles.coldarkDark}
                customStyle={{
                  margin: 0,
                  padding: "1rem",
                  background: "transparent",
                  fontSize: "0.875rem",
                  height: "100%",
                  overflow: "visible",
                }}
                showLineNumbers={true}
              >
                {fileData.content}
              </SyntaxHighlighter>
            </div>
          </div>
        );
      }
      break;

    case "unknown":
    default:
      if (isLoading) {
        return (
          <div className="flex items-center justify-center py-8">
            <Spinner size={24} className="text-gray-400" />
            <span className="ml-2 text-gray-400">Loading file...</span>
          </div>
        );
      }

      return (
        <div className="p-4 border border-gray-700 bg-gray-800 rounded text-center">
          <div className="text-gray-400 mb-2">
            File type not supported for preview
          </div>
          <div className="text-sm text-gray-500">
            {fileName} ({getFileExtension(filePath).toUpperCase()})
          </div>
        </div>
      );
  }

  return (
    <div className="p-4 border border-gray-700 bg-gray-800 rounded text-center text-gray-400 w-full">
      Failed to load file content
    </div>
  );
};
