import type { FC } from "react";
import { useState, useMemo } from "react";
import { ViewFileComponent } from "./ViewFileComponent";
import { useListStudentFilesQuery } from "./fileViewerHooks";
import Spinner from "../../../../utils/Spinner";

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

// Helper function to build tree structure from file paths
interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
  level: number;
}

const buildFileTree = (filePaths: string[]): TreeNode[] => {
  const root: TreeNode[] = [];

  filePaths.forEach((filePath) => {
    const parts = filePath.split("/");
    let currentLevel = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const isFile = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      let existingNode = currentLevel.find((node) => node.name === part);

      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          isFile,
          children: [],
          level: i,
        };
        currentLevel.push(existingNode);
      }

      if (!isFile) {
        currentLevel = existingNode.children;
      }
    }
  });

  // Sort directories first, then files
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes
      .sort((a, b) => {
        if (a.isFile !== b.isFile) {
          return a.isFile ? 1 : -1; // directories first
        }
        if (a.isFile) {
          // For files, prioritize main files
          const aIsMain = isLikelyMainFile(a.name);
          const bIsMain = isLikelyMainFile(b.name);
          if (aIsMain !== bIsMain) {
            return aIsMain ? -1 : 1;
          }
        }
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({
        ...node,
        children: sortNodes(node.children),
      }));
  };

  return sortNodes(root);
};

// Tree node component
const TreeNodeComponent: FC<{
  node: TreeNode;
  expandedNodes: Set<string>;
  selectedFile: string | null;
  onToggleExpand: (path: string) => void;
  onSelectFile: (path: string) => void;
}> = ({ node, expandedNodes, selectedFile, onToggleExpand, onSelectFile }) => {
  const isExpanded = expandedNodes.has(node.path);
  const hasChildren = node.children.length > 0;

  if (node.isFile) {
    return (
      <div
        className={`flex items-center gap-2 py-1 px-2 rounded text-sm cursor-pointer hover:bg-gray-800 transition-colors ${
          selectedFile === node.path
            ? "bg-gray-800 text-indigo-300"
            : "text-gray-200"
        } ${isLikelyMainFile(node.name) ? "border-l-2 border-yellow-500" : ""}`}
        style={{ paddingLeft: `${node.level * 20 + 8}px` }}
        onClick={() => onSelectFile(node.path)}
      >
        <span>{getFileIcon(node.name)}</span>
        <span>{node.name}</span>
        {isLikelyMainFile(node.name) && (
          <span className="text-xs bg-yellow-500 text-black px-1 rounded">
            main
          </span>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1 px-2 rounded text-sm cursor-pointer hover:bg-gray-800 transition-colors text-gray-200"
        style={{ paddingLeft: `${node.level * 20 + 8}px` }}
        onClick={() => hasChildren && onToggleExpand(node.path)}
      >
        {hasChildren && (
          <span
            className={`
                inline-block w-0 h-0 
                border-l-[4px] border-l-gray-400 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent 
                transition-transform duration-200 ${
                  isExpanded ? "rotate-90" : ""
                }`}
          />
        )}
        <span>📁</span>
        <span>{node.name}</span>
        <span className="text-xs text-gray-400">
          ({node.children.filter((c) => c.isFile).length} files)
        </span>
      </div>
      {hasChildren && isExpanded && (
        <div>
          {node.children.map((child) => (
            <TreeNodeComponent
              key={child.path}
              node={child}
              expandedNodes={expandedNodes}
              selectedFile={selectedFile}
              onToggleExpand={onToggleExpand}
              onSelectFile={onSelectFile}
            />
          ))}
        </div>
      )}
    </div>
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
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const {
    data: allFilePaths,
    isLoading,
    error,
  } = useListStudentFilesQuery({
    assignmentId,
    assignmentName,
    studentName,
    termName,
    courseName,
  });

  const fileTree = useMemo(() => {
    if (!allFilePaths) return [];
    return buildFileTree(allFilePaths);
  }, [allFilePaths]);

  const handleToggleExpand = (path: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedNodes(newExpanded);
  };

  const handleSelectFile = (path: string) => {
    setSelectedFile(path);
  };

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
    <div className={`space-y-4 ${className} flex flex-row w-full`}>
      <div className="space-y-2 w-[400px]">
        {allFilePaths && (
          <div className="flex items-center gap-4 text-xs text-gray-400">
            <span> {allFilePaths.length} files</span>
            <button
              onClick={() => setExpandedNodes(new Set())}
              className="unstyled text-indigo-400 hover:text-indigo-300 cursor-pointer"
            >
              Collapse All
            </button>
            <button
              onClick={() => {
                const allDirs = new Set<string>();
                const findAllDirs = (nodes: TreeNode[]) => {
                  nodes.forEach((node) => {
                    if (!node.isFile && node.children.length > 0) {
                      allDirs.add(node.path);
                      findAllDirs(node.children);
                    }
                  });
                };
                findAllDirs(fileTree);
                setExpandedNodes(allDirs);
              }}
              className="unstyled text-indigo-400 hover:text-indigo-300 cursor-pointer"
            >
              Expand All
            </button>
          </div>
        )}

        {/* File tree */}
        <div className="">
          {fileTree.length > 0 ? (
            <div className="p-2">
              {fileTree.map((node) => (
                <TreeNodeComponent
                  key={node.path}
                  node={node}
                  expandedNodes={expandedNodes}
                  selectedFile={selectedFile}
                  onToggleExpand={handleToggleExpand}
                  onSelectFile={handleSelectFile}
                />
              ))}
            </div>
          ) : (
            <div className="p-3 text-center text-gray-400 text-sm">
              No files found
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto w-96">
        {/* File preview */}
        {selectedFile && (
          <ViewFileComponent
            assignmentId={assignmentId}
            assignmentName={assignmentName}
            studentName={studentName}
            termName={termName}
            courseName={courseName}
            filePath={selectedFile}
          />
        )}
      </div>
    </div>
  );
};
