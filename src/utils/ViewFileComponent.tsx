import type { FC } from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../server/trpc/trpcClient";
import Spinner from "./Spinner";

interface ViewFileComponentProps {
  assignmentId: number;
  assignmentName: string;
  studentName: string;
  termName: string;
  courseName: string;
  filePath: string;
  className?: string;
}

// Get file extension and determine file type
const getFileExtension = (path: string): string => {
  return path.split(".").pop()?.toLowerCase() || "";
};

const getFileType = (path: string): "pdf" | "image" | "text" | "unknown" => {
  const ext = getFileExtension(path);

  if (ext === "pdf") return "pdf";

  if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(ext)) {
    return "image";
  }

  if (
    [
      "txt",
      "md",
      "js",
      "ts",
      "tsx",
      "jsx",
      "html",
      "css",
      "json",
      "xml",
      "yml",
      "yaml",
      "py",
      "java",
      "c",
      "cpp",
      "h",
      "hpp",
      "cs",
      "php",
      "rb",
      "go",
      "rs",
      "sh",
      "bat",
      "sql",
      "r",
      "scala",
      "kt",
      "swift",
      "dart",
      "vue",
      "svelte",
    ].includes(ext)
  ) {
    return "text";
  }

  return "unknown";
};

// Get syntax highlighting class based on file extension
const getSyntaxClass = (path: string): string => {
  const ext = getFileExtension(path);

  switch (ext) {
    case "js":
    case "jsx":
      return "language-javascript";
    case "ts":
    case "tsx":
      return "language-typescript";
    case "html":
      return "language-html";
    case "css":
      return "language-css";
    case "json":
      return "language-json";
    case "py":
      return "language-python";
    case "java":
      return "language-java";
    case "c":
    case "cpp":
    case "h":
    case "hpp":
      return "language-cpp";
    case "cs":
      return "language-csharp";
    case "xml":
      return "language-xml";
    case "md":
      return "language-markdown";
    default:
      return "language-text";
  }
};

export const ViewFileComponent: FC<ViewFileComponentProps> = ({
  assignmentId,
  assignmentName,
  studentName,
  termName,
  courseName,
  filePath,
  className = "",
}) => {
  const [shouldLoadContent, setShouldLoadContent] = useState(false);
  const trpc = useTRPC();

  const fileType = getFileType(filePath);
  const fileName = filePath.split("/").pop() || "Unknown file";

  // Use tRPC query to get file content
  const fileContentQuery = trpc.fileViewer.getFileContent.queryOptions({
    assignmentId,
    assignmentName,
    studentName,
    termName,
    courseName,
    filePath,
  });

  const {
    data: fileData,
    isLoading,
    error,
  } = useQuery({
    ...fileContentQuery,
    enabled: shouldLoadContent || fileType !== "text",
  });

  const renderFileContent = () => {
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
                onError={() => {
                  // Handle image load error
                }}
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
        if (!shouldLoadContent) {
          return (
            <button
              onClick={() => setShouldLoadContent(true)}
              className="w-full py-3 px-4 border border-gray-700 rounded bg-gray-800 hover:bg-gray-700 text-gray-100 transition-colors"
            >
              Load file content
            </button>
          );
        }

        if (isLoading) {
          return (
            <div className="flex items-center justify-center py-8">
              <Spinner size={24} className="text-gray-400" />
              <span className="ml-2 text-gray-400">
                Loading file content...
              </span>
            </div>
          );
        }

        if (fileData?.type === "text") {
          return (
            <div className="border border-gray-700 rounded">
              <div className="bg-gray-800 px-3 py-2 text-xs text-gray-400 border-b border-gray-700">
                {fileName}
              </div>
              <pre
                className={`p-4 bg-gray-900 text-gray-100 text-sm overflow-auto max-h-96 ${getSyntaxClass(
                  filePath
                )}`}
              >
                <code>{fileData.content}</code>
              </pre>
            </div>
          );
        }
        break;

      case "unknown":
      default:
        return (
          <div className="p-4 border border-gray-700 bg-gray-800 rounded text-center">
            <div className="text-gray-400 mb-2">
              File type not supported for preview
            </div>
            <div className="text-sm text-gray-500">
              {fileName} ({getFileExtension(filePath).toUpperCase()})
            </div>
            <button
              onClick={() => setShouldLoadContent(true)}
              disabled={isLoading}
              className="inline-flex items-center mt-3 px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs rounded transition-colors"
            >
              {isLoading ? "Loading..." : "Download file"}
            </button>
          </div>
        );
    }

    return (
      <div className="p-4 border border-gray-700 bg-gray-800 rounded text-center text-gray-400">
        Failed to load file content
      </div>
    );
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wide text-gray-400">
          File Preview
        </div>
        <div className="text-xs text-gray-500">{fileName}</div>
      </div>

      {renderFileContent()}

      <div className="text-xs text-gray-500">
        {termName} · {courseName} · {assignmentName} (#{assignmentId}) ·{" "}
        {studentName}
      </div>
    </div>
  );
};
