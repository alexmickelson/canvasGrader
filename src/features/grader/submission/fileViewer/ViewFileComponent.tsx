import type { FC } from "react";
import { useFileContentQuery } from "./fileViewerHooks";
import { FileContentRenderer } from "./FileContentRenderer";

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

export const ViewFileComponent: FC<{
  assignmentId: number;
  assignmentName: string;
  studentName: string;
  termName: string;
  courseName: string;
  filePath: string;
}> = ({
  assignmentId,
  assignmentName,
  studentName,
  termName,
  courseName,
  filePath,
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

  return (
    <FileContentRenderer
      fileType={fileType}
      fileName={fileName}
      filePath={filePath}
      fileData={fileData}
      isLoading={isLoading}
      error={error}
    />
  );
};
