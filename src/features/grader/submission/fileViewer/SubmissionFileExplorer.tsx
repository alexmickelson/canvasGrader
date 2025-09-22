import type { FC } from "react";
import { useState, useMemo } from "react";
import { useListStudentFilesQuery } from "./fileViewerHooks";
import Spinner from "../../../../utils/Spinner";
import { useViewingItem } from "../../shared/viewingItemContext/ViewingItemContext";
import {
  FileTreeNodeComponent,
  isLikelyMainFile,
  type TreeNode,
} from "./FileTreeNodeComponent";

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

export const SubmissionFileExplorer: FC<{
  assignmentId: number;
  assignmentName: string;
  studentName: string;
  termName: string;
  courseName: string;
}> = ({ assignmentId, assignmentName, studentName, termName, courseName }) => {
  const { viewingItem, setViewingFile } = useViewingItem();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const selectedFile = viewingItem?.type === "file" ? viewingItem.name : null;

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
    setViewingFile(path);
  };

  if (isLoading) {
    return (
      <div className={`flex items-center gap-2 `}>
        <Spinner className="text-gray-400" />
        <span className="text-gray-400">Loading files...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className={`p-4 border border-red-700 bg-red-900/20 rounded text-red-300 `}
      >
        Error loading files: {error.message}
      </div>
    );
  }

  return (
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
              <FileTreeNodeComponent
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
  );
};
