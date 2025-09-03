import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import z from "zod";
import fs from "fs";
import path from "path";
import { getSubmissionDirectory } from "./canvas/canvasStorageUtils";
import { getAllFilePaths } from "../utils/fileUtils";

// Helper function to get MIME type based on file extension
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();

  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".gif":
      return "image/gif";
    case ".bmp":
      return "image/bmp";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".txt":
      return "text/plain";
    case ".html":
      return "text/html";
    case ".css":
      return "text/css";
    case ".js":
    case ".jsx":
      return "text/javascript";
    case ".ts":
    case ".tsx":
      return "text/typescript";
    case ".json":
      return "application/json";
    case ".xml":
      return "application/xml";
    case ".md":
      return "text/markdown";
    case ".yml":
    case ".yaml":
      return "text/yaml";
    case ".py":
      return "text/x-python";
    case ".java":
      return "text/x-java";
    case ".c":
    case ".h":
      return "text/x-c";
    case ".cpp":
    case ".hpp":
      return "text/x-c++";
    case ".cs":
      return "text/x-csharp";
    case ".php":
      return "text/x-php";
    case ".rb":
      return "text/x-ruby";
    case ".go":
      return "text/x-go";
    case ".rs":
      return "text/x-rust";
    case ".sh":
      return "text/x-shellscript";
    case ".sql":
      return "text/x-sql";
    default:
      return "text/plain"; // Default to text instead of binary
  }
}

export const fileViewerRouter = createTRPCRouter({
  getFileContent: publicProcedure
    .input(
      z.object({
        assignmentId: z.number(),
        assignmentName: z.string(),
        studentName: z.string(),
        termName: z.string(),
        courseName: z.string(),
        filePath: z.string(),
      })
    )
    .query(async ({ input }) => {
      const { filePath } = input;

      try {
        const basePath = getSubmissionDirectory({
          ...input,
        });

        const fullFilePath = path.join(basePath, filePath);

        // Check if file exists
        if (!fs.existsSync(fullFilePath)) {
          throw new Error("File not found");
        }

        // Check if it's actually a file (not a directory)
        const stats = fs.statSync(fullFilePath);
        if (!stats.isFile()) {
          throw new Error("Path is not a file");
        }

        const mimeType = getMimeType(fullFilePath);

        // For text files and unknown files, try to load as text first
        if (
          mimeType.startsWith("text/") ||
          mimeType === "application/json" ||
          mimeType === "application/xml"
        ) {
          try {
            const content = fs.readFileSync(fullFilePath, "utf-8");
            return {
              type: "text",
              content,
              mimeType,
              fileName: path.basename(fullFilePath),
            };
          } catch (error) {
            // If text reading fails, fall back to binary
            console.warn(
              `Failed to read ${fullFilePath} as text, falling back to binary:`,
              error
            );
          }
        }

        // For binary files (images, PDFs) or fallback from failed text reading
        const content = fs.readFileSync(fullFilePath);
        const base64Content = content.toString("base64");

        return {
          type: "binary",
          content: base64Content,
          mimeType:
            mimeType === "text/plain" ? "application/octet-stream" : mimeType, // Use binary mime type if we fell back
          fileName: path.basename(fullFilePath),
        };
      } catch (error) {
        console.error("Error reading file:", error);
        throw new Error(
          `Failed to read file: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }),

  listStudentFiles: publicProcedure
    .input(
      z.object({
        assignmentId: z.number(),
        assignmentName: z.string(),
        studentName: z.string(),
        termName: z.string(),
        courseName: z.string(),
      })
    )
    .query(async ({ input }) => {
      const { studentName } = input;

      try {
        const basePath = getSubmissionDirectory({
          ...input,
        });

        if (!fs.existsSync(basePath)) {
          return [];
        }

        const allFiles = getAllFilePaths(basePath, basePath);

        console.log("files for student ", studentName, allFiles);

        return allFiles.sort();
      } catch (error) {
        console.error("Error listing files:", error);
        throw new Error(
          `Failed to list files: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }),
});
