import fs from "fs";
import path from "path";

// Folders to ignore during file listing
export const IGNORED_FOLDERS = new Set([
  "bin",
  "obj",
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "target",
  ".next",
  "coverage",
  ".nuxt",
  ".cache",
  "temp",
  "tmp",
  "__pycache__",
  ".pytest_cache",
  ".mypy_cache",
]);

// Helper function to recursively get all file paths
export function getAllFilePaths(
  dirPath: string,
  basePath: string,
  relativePath = ""
): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dirPath)) {
    return files;
  }

  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const itemPath = path.join(dirPath, item);
    const itemRelativePath = relativePath
      ? path.join(relativePath, item)
      : item;

    try {
      const stats = fs.statSync(itemPath);

      if (stats.isDirectory()) {
        // Skip ignored folders
        if (!IGNORED_FOLDERS.has(item)) {
          files.push(...getAllFilePaths(itemPath, basePath, itemRelativePath));
        }
      } else {
        files.push(itemRelativePath);
      }
    } catch (error) {
      console.warn(`Error accessing ${itemPath}:`, error);
    }
  }

  files.sort();
  return files;
}
