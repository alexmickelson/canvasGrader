import type { FC } from "react";
import Spinner from "../../../../utils/Spinner";
import { TextFileRenderer } from "./TextFileRenderer";

export const FileContentRenderer: FC<{
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
  startLine?: number;
  startColumn?: number;
  endLine?: number;
  endColumn?: number;
}> = ({
  fileType,
  fileName,
  filePath,
  fileData,
  isLoading,
  error,
  startLine,
  startColumn,
  endLine,
  endColumn,
}) => {
  if (error) {
    return (
      <div className="p-4 border border-red-700 bg-red-900/20 rounded text-red-300">
        Error: {error.message}
      </div>
    );
  }

  if (isLoading) {
    const loadingMessage =
      fileType === "image"
        ? "Loading image..."
        : fileType === "pdf"
        ? "Loading PDF..."
        : fileType === "text"
        ? "Loading file content..."
        : "Loading file...";

    return (
      <div className="flex items-center justify-center py-8">
        <Spinner  className="text-gray-400" />
        <span className="ml-2 text-gray-400">{loadingMessage}</span>
      </div>
    );
  }

  switch (fileType) {
    case "image":
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
      if (fileData?.type === "binary") {
        return (
          <div className="border border-gray-700 rounded h-full">
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
      if (fileData?.type === "text") {
        return (
          <TextFileRenderer
            fileName={fileName}
            filePath={filePath}
            content={fileData.content}
            startLine={startLine}
            startColumn={startColumn}
            endLine={endLine}
            endColumn={endColumn}
          />
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
        </div>
      );
  }

  return (
    <div className="p-4 border border-gray-700 bg-gray-800 rounded text-center text-gray-400 w-full">
      Failed to load file content
    </div>
  );
};
const getFileExtension = (path: string): string => {
  return path.split(".").pop()?.toLowerCase() || "";
};
