import type { FC } from "react";

// Tree node component
export const FileTreeNodeComponent: FC<{
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
        <span className="truncate">{node.name}</span>
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
            <FileTreeNodeComponent
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
}; // Helper function to get file icon based on extension

export const getFileIcon = (fileName: string): string => {
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

export const isLikelyMainFile = (fileName: string): boolean => {
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

export interface TreeNode {
  name: string;
  path: string;
  isFile: boolean;
  children: TreeNode[];
  level: number;
}
