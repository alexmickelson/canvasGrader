import { createTRPCRouter, publicProcedure } from "../utils/trpc";
import z from "zod";
import fs from "fs";
import path from "path";
import { getSubmissionDirectory } from "./canvas/canvasStorageUtils";

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
      return "text/javascript";
    case ".json":
      return "application/json";
    case ".xml":
      return "application/xml";
    case ".md":
      return "text/markdown";
    default:
      return "application/octet-stream";
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

        // For text files, return the content directly
        if (mimeType.startsWith("text/") || mimeType === "application/json") {
          const content = fs.readFileSync(fullFilePath, "utf-8");
          return {
            type: "text",
            content,
            mimeType,
            fileName: path.basename(fullFilePath),
          };
        }

        // For binary files, return base64 encoded content
        const content = fs.readFileSync(fullFilePath);
        const base64Content = content.toString("base64");

        return {
          type: "binary",
          content: base64Content,
          mimeType,
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
        directoryInSubmission: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const { studentName, directoryInSubmission: directory = "" } = input;

      try {
        const basePath = getSubmissionDirectory({
          ...input,
        });

        if (!fs.existsSync(basePath)) {
          return { files: [], directories: [] };
        }

        const items = fs.readdirSync(basePath);
        const files: Array<{
          name: string;
          path: string;
          size: number;
          mimeType: string;
        }> = [];
        const directories: Array<{ name: string; path: string }> = [];

        for (const item of items) {
          const itemPath = path.join(basePath, item);
          const stats = fs.statSync(itemPath);
          const relativePath = directory ? path.join(directory, item) : item;

          if (stats.isDirectory()) {
            directories.push({
              name: item,
              path: relativePath,
            });
          } else {
            files.push({
              name: item,
              path: relativePath,
              size: stats.size,
              mimeType: getMimeType(itemPath),
            });
          }
        }

        const res = {
          files: files.sort((a, b) => a.name.localeCompare(b.name)),
          directories: directories.sort((a, b) => a.name.localeCompare(b.name)),
        };

        console.log("files for student ", studentName, res);

        return res;
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
