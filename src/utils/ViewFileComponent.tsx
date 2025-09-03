import type { FC } from "react";
import Spinner from "./Spinner";
import { useFileContentQuery } from "./fileViewerHooks";

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
      "toml",
      "ini",
      "cfg",
      "conf",
      "log",
      "gitignore",
      "dockerfile",
      "makefile",
    ].includes(ext)
  ) {
    return "text";
  }

  // For unknown extensions, default to text to attempt loading as text
  return "text";
};

// Get syntax highlighting class based on file extension
const getSyntaxClass = (path: string): string => {
  const ext = getFileExtension(path);

  const syntaxMap: Record<string, string> = {
    js: "language-javascript",
    jsx: "language-javascript",
    ts: "language-typescript",
    tsx: "language-typescript",
    html: "language-html",
    css: "language-css",
    json: "language-json",
    py: "language-python",
    java: "language-java",
    c: "language-cpp",
    cpp: "language-cpp",
    h: "language-cpp",
    hpp: "language-cpp",
    cs: "language-csharp",
    xml: "language-xml",
    md: "language-markdown",
    yml: "language-yaml",
    yaml: "language-yaml",
    php: "language-php",
    rb: "language-ruby",
    go: "language-go",
    rs: "language-rust",
    sh: "language-bash",
    bat: "language-bash",
    sql: "language-sql",
  };

  return syntaxMap[ext] || "language-text";
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
  const fileType = getFileType(filePath);
  const fileName = filePath.split("/").pop() || "Unknown file";

  const {
    data: fileData,
    isLoading,
    error,
  } = useFileContentQuery({
    assignmentId,
    assignmentName,
    studentName,
    termName,
    courseName,
    filePath,
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
