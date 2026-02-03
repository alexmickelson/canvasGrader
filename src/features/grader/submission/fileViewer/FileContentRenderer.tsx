import type { FC } from "react";
import Spinner from "../../../../utils/Spinner";
import { TextFileRenderer } from "./TextFileRenderer";

const TranscriptionDisplay: FC<{ transcription: string }> = ({
  transcription,
}) => (
  <div className="mt-4 p-4 border border-gray-700 bg-gray-800 rounded">
    <h3 className="text-sm font-medium mb-2">AI Transcription</h3>
    <div className="text-sm whitespace-pre-wrap text-gray-300">
      {transcription}
    </div>
  </div>
);

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
  transcription?: string;
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
  transcription,
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
        <Spinner className="text-gray-400" />
        <span className="ml-2 text-gray-400">{loadingMessage}</span>
      </div>
    );
  }

  if (fileType === "image" && fileData?.type === "binary") {
    return (
      <div>
        <div className="text-center">
          <img
            src={`data:${fileData.mimeType};base64,${fileData.content}`}
            alt={fileName}
            className="max-w-full mx-auto rounded border border-gray-700"
          />
        </div>
        {transcription && (
          <TranscriptionDisplay transcription={transcription} />
        )}
      </div>
    );
  }

  if (fileType === "pdf" && fileData?.type === "binary") {
    return (
      <div className="h-full flex flex-col">
        <div className="border border-gray-700 rounded flex-1 min-h-0">
          <iframe
            src={`data:${fileData.mimeType};base64,${fileData.content}`}
            className="w-full h-full rounded"
            title={fileName}
          />
        </div>
        {transcription && (
          <TranscriptionDisplay transcription={transcription} />
        )}
      </div>
    );
  }

  if (fileType === "text" && fileData?.type === "text") {
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

  if (fileType === "unknown") {
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
