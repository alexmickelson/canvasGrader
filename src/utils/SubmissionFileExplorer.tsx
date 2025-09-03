import type { FC } from "react";
import { useState } from "react";
import { ViewFileComponent } from "./ViewFileComponent";
import { useListStudentFilesQuery } from "./fileViewerHooks";
import Spinner from "./Spinner";

// Helper function to get file icon based on extension
const getFileIcon = (fileName: string): string => {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";

  if (ext === "pdf") return "📄";
  if (["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"].includes(ext))
    return "🖼️";
  if (["js", "jsx", "ts", "tsx"].includes(ext)) return "⚙️";
  if (["py"].includes(ext)) return "🐍";
  if (["java"].includes(ext)) return "☕";
  if (["html", "htm"].includes(ext)) return "🌐";
  if (["css"].includes(ext)) return "🎨";
  if (["json"].includes(ext)) return "📋";
  if (["txt", "md"].includes(ext)) return "📝";
  if (["zip", "rar", "7z", "tar", "gz"].includes(ext)) return "📦";
  if (["mp4", "avi", "mov", "wmv"].includes(ext)) return "🎬";
  if (["mp3", "wav", "ogg"].includes(ext)) return "🎵";

  return "📄";
};

// Helper function to determine if file is likely a main submission file
const isLikelyMainFile = (fileName: string): boolean => {
  const name = fileName.toLowerCase();
  return (
    name.includes("main") ||
    name.includes("index") ||
    name.includes("app") ||
    name.includes("assignment") ||
    name.includes("homework") ||
    name.includes("project")
  );
};

export const SubmissionFileExplorer: FC<{
  assignmentId: number;
  assignmentName: string;
  studentName: string;
  termName: string;
  courseName: string;
  className?: string;
}> = ({
  assignmentId,
  assignmentName,
  studentName,
  termName,
  courseName,
  className = "",
}) => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [currentDirectory, setCurrentDirectory] = useState("");

  const {
    data: fileList,
    isLoading,
    error,
  } = useListStudentFilesQuery({
    assignmentId,
    assignmentName,
    studentName,
    termName,
    courseName,
    directoryInSubmission: currentDirectory,
  });

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Spinner size={16} className="text-gray-400" />
        <span className="text-gray-400">Loading files...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`p-4 border border-red-700 bg-red-900/20 rounded text-red-300 ${className}`}
      >
        Error loading files: {error.message}
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-200">
            Submission Files
          </h3>
          <div className="text-xs text-gray-400">
            {termName} · {courseName} · Student: {studentName}
          </div>
        </div>

        {/* Quick stats */}
        {fileList && (
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span>📁 {fileList.directories?.length || 0} folders</span>
            <span>📄 {fileList.files?.length || 0} files</span>
            {fileList.files && fileList.files.length > 0 && (
              <span>
                💾{" "}
                {(
                  fileList.files.reduce((acc, f) => acc + f.size, 0) / 1024
                ).toFixed(1)}{" "}
                KB total
              </span>
            )}
          </div>
        )}

        {/* Breadcrumb navigation */}
        {currentDirectory && (
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <button
              onClick={() => setCurrentDirectory("")}
              className="text-indigo-400 hover:text-indigo-300"
            >
              📁 Root
            </button>
            <span>/</span>
            <span>{currentDirectory}</span>
          </div>
        )}

        {/* File and directory listing */}
        <div className="border border-gray-700 rounded bg-gray-900">
          {fileList?.directories && fileList.directories.length > 0 && (
            <div className="p-3 border-b border-gray-700">
              <div className="text-xs text-gray-400 mb-2">Directories:</div>
              <div className="space-y-1">
                {fileList.directories.map((dir) => (
                  <button
                    key={dir.path}
                    onClick={() => setCurrentDirectory(dir.path)}
                    className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300"
                  >
                    📁 {dir.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {fileList?.files && fileList.files.length > 0 ? (
            <div className="p-3">
              <div className="text-xs text-gray-400 mb-2">
                Files ({fileList.files.length}):
              </div>
              <div className="space-y-1">
                {fileList.files
                  .sort((a, b) => {
                    // Sort main files first, then alphabetically
                    const aIsMain = isLikelyMainFile(a.name);
                    const bIsMain = isLikelyMainFile(b.name);
                    if (aIsMain && !bIsMain) return -1;
                    if (!aIsMain && bIsMain) return 1;
                    return a.name.localeCompare(b.name);
                  })
                  .map((file) => (
                    <button
                      key={file.path}
                      onClick={() => setSelectedFile(file.path)}
                      className={`flex items-center justify-between w-full text-left p-2 rounded text-sm hover:bg-gray-800 transition-colors ${
                        selectedFile === file.path
                          ? "bg-gray-800 text-indigo-300"
                          : "text-gray-200"
                      } ${
                        isLikelyMainFile(file.name)
                          ? "border-l-2 border-yellow-500"
                          : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{getFileIcon(file.name)}</span>
                        <span>{file.name}</span>
                        {isLikelyMainFile(file.name) && (
                          <span className="text-xs bg-yellow-500 text-black px-1 rounded">
                            main
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-400">
                        {(file.size / 1024).toFixed(1)} KB
                      </span>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            !fileList?.directories?.length && (
              <div className="p-3 text-center text-gray-400 text-sm">
                No files found in this directory
              </div>
            )
          )}
        </div>
      </div>

      {/* File preview */}
      {selectedFile && (
        <div className="border-t border-gray-700 pt-4">
          <ViewFileComponent
            assignmentId={assignmentId}
            assignmentName={assignmentName}
            studentName={studentName}
            termName={termName}
            courseName={courseName}
            filePath={selectedFile}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
};
