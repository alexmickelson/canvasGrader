import fs from "fs";
import path from "path";
import { rateLimitAwareGet } from "./canvasRequestUtils.js";
import { canvasRequestOptions } from "./canvasServiceUtils.js";
import { parseSchema } from "../parseSchema.js";
import type {
  CanvasSubmission,
  CanvasRubric,
} from "./canvasModels.js";
import { CanvasSubmissionSchema } from "./canvasModels.js";
import TurndownService from "turndown";
import {
  extractAttachmentsFromMarkdown,
  dowloadSubmissionAttachments,
  transcribeAndStoreSubmissionAttachments,
} from "./canvasSubmissionAttachmentUtils.js";

const canvasBaseUrl =
  process.env.CANVAS_BASE_URL || "https://snow.instructure.com";
const storageDirectory = process.env.STORAGE_DIRECTORY || "./storage";

export function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function getCourseDirectory({
  termName,
  courseName,
}: {
  termName: string;
  courseName: string;
}) {
  const baseDir = path.join(
    storageDirectory,
    sanitizeName(termName),
    sanitizeName(courseName)
  );
  ensureDir(baseDir);
  return baseDir;
}
export function getAssignmentDirectory({
  termName,
  courseName,
  assignmentId,
  assignmentName,
}: {
  termName: string;
  courseName: string;
  assignmentId: number;
  assignmentName: string;
}) {
  const baseDir = path.join(
    storageDirectory,
    sanitizeName(termName),
    sanitizeName(courseName)
  );
  const assignDir = path.join(
    baseDir,
    sanitizeName(`${assignmentId} - ${assignmentName}`)
  );
  ensureDir(assignDir);
  return assignDir;
}

export function getSubmissionDirectory({
  termName,
  courseName,
  assignmentId,
  assignmentName,
  studentName,
}: {
  termName: string;
  courseName: string;
  assignmentId: number;
  assignmentName: string;
  studentName: string;
}): string {
  const submissionDir = path.join(
    storageDirectory,
    sanitizeName(termName),
    sanitizeName(courseName),
    sanitizeName(`${assignmentId} - ${assignmentName}`),
    sanitizeName(studentName)
  );
  ensureDir(submissionDir);
  return submissionDir;
}

export function getMetadataSubmissionDirectory({
  termName,
  courseName,
  assignmentId,
  assignmentName,
  studentName,
}: {
  termName: string;
  courseName: string;
  assignmentId: number;
  assignmentName: string;
  studentName: string;
}): string {
  const submissionDir = path.join(
    storageDirectory,
    sanitizeName(termName),
    sanitizeName(courseName),
    sanitizeName(`${assignmentId} - ${assignmentName}`),
    sanitizeName(studentName) + "_metadata"
  );
  ensureDir(submissionDir);
  return submissionDir;
}

export function sanitizeName(name: string): string {
  return (name || "")
    .replace(/[\n\r\t]/g, " ")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeImageTitle(title: string): string {
  return title.replace(/[^a-z0-9._-]/gi, "_");
}

export function convertHtmlToMarkdown(htmlContent: string): string {
  const turndownService = new TurndownService();
  return turndownService.turndown(htmlContent);
}

export async function getCourseMeta(courseId: number): Promise<{
  courseName: string;
  termName: string;
}> {
  try {
    const { data } = await rateLimitAwareGet<{
      name?: string;
      term?: { name?: string };
    }>(`${canvasBaseUrl}/api/v1/courses/${courseId}` as string, {
      headers: canvasRequestOptions.headers,
      params: { include: "term" },
    });
    const courseName: string = data?.name || `Course ${courseId}`;
    const rawTerm: string | undefined = data?.term?.name;
    const termName =
      rawTerm && rawTerm !== "The End of Time" ? rawTerm : "Unknown Term";
    return { courseName, termName };
  } catch {
    return { courseName: `Course ${courseId}`, termName: "Unknown Term" };
  }
}


// export async function persistSubmissionsToStorage(
//   courseId: number,
//   assignmentId: number,
//   submissions: CanvasSubmission[],
//   assignmentName: string
// ): Promise<void> {
//   const { courseName, termName } = await getCourseMeta(courseId);

//   await Promise.all(
//     submissions.map(async (submission) => {
//       const userName =
//         (typeof submission.user === "object" && submission.user?.name) ||
//         `User ${submission.user_id}`;
//       const parsedSubmission = parseSchema(
//         CanvasSubmissionSchema,
//         submission,
//         "CanvasSubmission"
//       );

//       storeSubmissionJson(parsedSubmission, {
//         termName,
//         courseName,
//         assignmentId,
//         assignmentName,
//         studentName: userName,
//       });

//       // Convert HTML to markdown and store as submission.md
//       storeSubmissionMarkdown(parsedSubmission, {
//         termName,
//         courseName,
//         assignmentId,
//         assignmentName,
//         studentName: userName,
//       });
//     })
//   );
// }
export async function transcribeSubmissionImages(
  courseId: number,
  assignmentId: number,
  submissions: CanvasSubmission[],
  assignmentName: string
): Promise<void> {
  try {
    const { courseName, termName } = await getCourseMeta(courseId);

    await Promise.all(
      submissions.map(async (submission) => {
        try {
          const userName =
            (typeof submission.user === "object" && submission.user?.name) ||
            `User ${submission.user_id}`;
          const parsedSubmission = parseSchema(
            CanvasSubmissionSchema,
            submission,
            "CanvasSubmission"
          );

          const markdown = convertHtmlToMarkdown(parsedSubmission.body);
          const images = extractAttachmentsFromMarkdown(markdown);
          const imagesWithPaths = await dowloadSubmissionAttachments(images, {
            termName,
            courseName,
            assignmentId,
            assignmentName,
            studentName: userName,
          });

          await transcribeAndStoreSubmissionAttachments(imagesWithPaths, {
            termName,
            courseName,
            assignmentId,
            assignmentName,
            studentName: userName,
          });
        } catch (err) {
          console.warn(
            "Failed to write submission.json for user",
            submission.user_id,
            err
          );
        }
      })
    );
  } catch (err) {
    console.warn("Failed to persist submissions to storage", err);
  }
}

export async function persistRubricToStorage(
  courseId: number,
  assignmentId: number,
  rubric: CanvasRubric
) {
  try {
    const { courseName, termName } = await getCourseMeta(courseId);
    const { data: assignment } = await rateLimitAwareGet<{ name?: string }>(
      `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}`,
      {
        headers: canvasRequestOptions.headers,
      }
    );
    const assignmentName = assignment?.name || `Assignment ${assignmentId}`;

    const assignmentDir = getAssignmentDirectory({
      termName,
      courseName,
      assignmentId,
      assignmentName,
    });

    const rubricJsonPath = path.join(assignmentDir, "rubric.json");
    fs.writeFileSync(rubricJsonPath, JSON.stringify(rubric, null, 2), "utf8");
    console.log("Saved rubric to:", rubricJsonPath);
  } catch (err) {
    console.warn("Failed to persist rubric to storage", err);
  }
}


// Convert HTML to markdown and store as submission.md
export function storeSubmissionMarkdown(
  submission: {
    id?: number;
    user?: { id: number; name: string };
    body?: string;
    attachments?: unknown[];
    [key: string]: unknown;
  },
  {
    termName,
    courseName,
    assignmentId,
    assignmentName,
    studentName,
  }: {
    termName: string;
    courseName: string;
    assignmentId: number;
    assignmentName: string;
    studentName: string;
  }
): string {
  if (!submission.body || !submission.body.trim()) {
    console.log("No submission body to convert to markdown");
    return "";
  }

  const submissionDir = getSubmissionDirectory({
    termName,
    courseName,
    assignmentId,
    assignmentName,
    studentName,
  });

  // Convert HTML to markdown
  const markdown = convertHtmlToMarkdown(submission.body);

  const submissionMdPath = path.join(submissionDir, "submission.md");
  fs.writeFileSync(submissionMdPath, markdown, "utf8");
  console.log("Saved submission.md to:", submissionMdPath);
  return markdown;
}
