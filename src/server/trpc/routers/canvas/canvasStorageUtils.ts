import fs from "fs";
import path from "path";
import { axiosClient } from "../../../../utils/axiosUtils.js";
import { canvasRequestOptions } from "./canvasServiceUtils.js";
import { parseSchema } from "../parseSchema.js";
import type {
  CanvasAssignment,
  CanvasCourse,
  CanvasSubmission,
  CanvasRubric,
} from "./canvasModels.js";
import { CanvasCourseSchema, CanvasSubmissionSchema } from "./canvasModels.js";
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

export async function getCourseMeta(courseId: number): Promise<{
  courseName: string;
  termName: string;
}> {
  try {
    const { data } = await axiosClient.get(
      `${canvasBaseUrl}/api/v1/courses/${courseId}` as string,
      {
        headers: canvasRequestOptions.headers,
        params: { include: "term" },
      }
    );
    const courseName: string = data?.name || `Course ${courseId}`;
    const rawTerm: string | undefined = data?.term?.name;
    const termName =
      rawTerm && rawTerm !== "The End of Time" ? rawTerm : "Unknown Term";
    return { courseName, termName };
  } catch {
    return { courseName: `Course ${courseId}`, termName: "Unknown Term" };
  }
}

export function loadPersistedCourses(): CanvasCourse[] {
  try {
    if (!fs.existsSync(storageDirectory)) {
      return [];
    }

    const persistedCourses: CanvasCourse[] = [];

    // Walk through term directories
    const termDirs = fs
      .readdirSync(storageDirectory, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const termDir of termDirs) {
      const termPath = path.join(storageDirectory, termDir);

      // Walk through course directories in each term
      const courseDirs = fs
        .readdirSync(termPath, { withFileTypes: true })
        .filter((dirent) => dirent.isDirectory())
        .map((dirent) => dirent.name);

      for (const courseDir of courseDirs) {
        const courseJsonPath = path.join(termPath, courseDir, "course.json");

        if (fs.existsSync(courseJsonPath)) {
          try {
            const rawData = fs.readFileSync(courseJsonPath, "utf8");
            let courseData;
            try {
              courseData = JSON.parse(rawData);
            } catch (error) {
              console.error("Failed to parse course.json as JSON:", {
                courseJsonPath,
                error: error,
                rawData: rawData.substring(0, 500),
              });
              throw new Error(
                `Failed to parse course.json as JSON: ${courseJsonPath}. Error: ${error}. Data: ${rawData.substring(
                  0,
                  500
                )}...`
              );
            }

            const parsedCourse = parseSchema(
              CanvasCourseSchema,
              courseData,
              "CanvasCourse"
            );
            persistedCourses.push(parsedCourse);
          } catch (error) {
            console.warn(
              `Failed to parse course.json at ${courseJsonPath}:`,
              error
            );
          }
        }
      }
    }

    return persistedCourses;
  } catch (error) {
    console.warn("Error reading persisted courses:", error);
    return [];
  }
}

export async function persistAssignmentsToStorage(
  courseId: number,
  assignments: CanvasAssignment[]
): Promise<void> {
  try {
    const { courseName, termName } = await getCourseMeta(courseId);
    await Promise.all(
      assignments.map(async (a) => {
        const assignDir = getAssignmentDirectory({
          termName,
          courseName,
          assignmentId: a.id,
          assignmentName: a.name,
        });
        const filePath = path.join(assignDir, "assignment.json");
        try {
          fs.writeFileSync(filePath, JSON.stringify(a, null, 2), "utf8");
        } catch (err) {
          console.warn("Failed to write assignment.json for", a.id, err);
        }
      })
    );
  } catch (err) {
    console.warn("Failed to persist assignments to storage", err);
  }
}

export async function persistCoursesToStorage(
  courses: CanvasCourse[]
): Promise<void> {
  await Promise.all(
    courses.map(async (course) => {
      try {
        const courseName = course.name;
        const rawTerm = course.term?.name;
        const termName =
          rawTerm && rawTerm !== "The End of Time" ? rawTerm : "Unknown Term";

        const courseDir = getCourseDirectory({ termName, courseName });

        const courseJsonPath = path.join(courseDir, "course.json");
        fs.writeFileSync(
          courseJsonPath,
          JSON.stringify(course, null, 2),
          "utf8"
        );
      } catch (err) {
        console.warn("Failed to write course.json for", course.id, err);
      }
    })
  );
}

export async function persistSubmissionsToStorage(
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

          storeSubmissionJson(parsedSubmission, {
            termName,
            courseName,
            assignmentId,
            assignmentName,
            studentName: userName,
          });

          // Convert HTML to markdown and store as submission.md
          const markdown = storeSubmissionMarkdown(parsedSubmission, {
            termName,
            courseName,
            assignmentId,
            assignmentName,
            studentName: userName,
          });

          const images = extractAttachmentsFromMarkdown(markdown);
          const imagesWithPaths = await dowloadSubmissionAttachments(images, {
            termName,
            courseName,
            assignmentId,
            assignmentName,
            studentName: userName,
          });

          // Transcribe the downloaded images
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

          storeSubmissionJson(parsedSubmission, {
            termName,
            courseName,
            assignmentId,
            assignmentName,
            studentName: userName,
          });

          // Convert HTML to markdown and store as submission.md
          const markdown = storeSubmissionMarkdown(parsedSubmission, {
            termName,
            courseName,
            assignmentId,
            assignmentName,
            studentName: userName,
          });

          const images = extractAttachmentsFromMarkdown(markdown);
          const imagesWithPaths = await dowloadSubmissionAttachments(images, {
            termName,
            courseName,
            assignmentId,
            assignmentName,
            studentName: userName,
          });

          // Transcribe the downloaded images
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
): Promise<void> {
  try {
    const { courseName, termName } = await getCourseMeta(courseId);
    const { data: assignment } = await axiosClient.get(
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

// Store submission.json in the original submission directory
export function storeSubmissionJson(
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
): void {
  try {
    const originalDir = getMetadataSubmissionDirectory({
      termName,
      courseName,
      assignmentId,
      assignmentName,
      studentName,
    });

    const submissionJsonPath = path.join(originalDir, "submission.json");
    fs.writeFileSync(
      submissionJsonPath,
      JSON.stringify(submission, null, 2),
      "utf8"
    );
    console.log("Saved submission.json to:", submissionJsonPath);
  } catch (err) {
    console.warn("Failed to store submission.json in original directory", err);
  }
}

// Load submissions from storage
export async function loadSubmissionsFromStorage(
  courseId: number,
  assignmentId: number
): Promise<CanvasSubmission[] | null> {
  try {
    const { courseName, termName } = await getCourseMeta(courseId);
    const { data: assignment } = await axiosClient.get(
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

    if (!fs.existsSync(assignmentDir)) {
      console.log(`Assignment directory does not exist: ${assignmentDir}`);
      return null;
    }

    const submissions: CanvasSubmission[] = [];
    const entries = fs.readdirSync(assignmentDir, { withFileTypes: true });

    console.log(
      `Found ${entries.length} entries in assignment directory: ${assignmentDir}`
    );

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name.endsWith("_metadata")) {
        const metadataDir = path.join(assignmentDir, entry.name);
        const submissionJsonPath = path.join(metadataDir, "submission.json");


        if (fs.existsSync(submissionJsonPath)) {
          try {
            const submissionData = fs.readFileSync(submissionJsonPath, "utf8");
            const submission = JSON.parse(submissionData);
            const parsedSubmission = parseSchema(
              CanvasSubmissionSchema,
              submission,
              "CanvasSubmission"
            );
            submissions.push(parsedSubmission);
         
          } catch (err) {
            console.warn(
              `Failed to parse submission file: ${submissionJsonPath}`,
              err
            );
          }
        } else {
          console.log(`submission.json not found at: ${submissionJsonPath}`);
        }
      }
    }

    console.log(`Loaded ${submissions.length} submissions from storage`);
    return submissions.length > 0 ? submissions : null;
  } catch (err) {
    console.warn("Failed to load submissions from storage", err);
    return null;
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
  const turndownService = new TurndownService();
  const markdown = turndownService.turndown(submission.body);

  const submissionMdPath = path.join(submissionDir, "submission.md");
  fs.writeFileSync(submissionMdPath, markdown, "utf8");
  console.log("Saved submission.md to:", submissionMdPath);
  return markdown;
}
