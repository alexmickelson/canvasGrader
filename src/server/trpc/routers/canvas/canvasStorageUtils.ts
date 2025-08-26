import fs from "fs";
import path from "path";
import { axiosClient } from "../../../../utils/axiosUtils";
import { canvasRequestOptions } from "./canvasServiceUtils";
import type {
  CanvasAssignment,
  CanvasCourse,
  CanvasSubmission,
  CanvasRubric,
} from "./canvasModels";

const canvasBaseUrl =
  process.env.CANVAS_BASE_URL || "https://snow.instructure.com";
const storageDirectory = process.env.STORAGE_DIRECTORY || "./storage";

export function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function sanitizeName(name: string): string {
  return (name || "")
    .replace(/[\n\r\t]/g, " ")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
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

export async function persistAssignmentsToStorage(
  courseId: number,
  assignments: CanvasAssignment[]
): Promise<void> {
  try {
    const { courseName, termName } = await getCourseMeta(courseId);
    const baseDir = path.join(
      storageDirectory,
      sanitizeName(termName),
      sanitizeName(courseName)
    );
    ensureDir(baseDir);

    await Promise.all(
      assignments.map(async (a) => {
        const assignDir = path.join(
          baseDir,
          sanitizeName(`${a.id} - ${a.name}`)
        );
        ensureDir(assignDir);
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

        const courseDir = path.join(
          storageDirectory,
          sanitizeName(termName),
          sanitizeName(courseName)
        );
        ensureDir(courseDir);

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
  submissions: CanvasSubmission[]
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

    await Promise.all(
      submissions.map(async (submission) => {
        try {
          const userName =
            (typeof submission.user === "object" && submission.user?.name) ||
            `User ${submission.user_id}`;
          const submissionDir = path.join(
            storageDirectory,
            sanitizeName(termName),
            sanitizeName(courseName),
            sanitizeName(`${assignmentId} - ${assignmentName}`),
            sanitizeName(userName)
          );
          ensureDir(submissionDir);

          const submissionJsonPath = path.join(
            submissionDir,
            "submission.json"
          );
          fs.writeFileSync(
            submissionJsonPath,
            JSON.stringify(submission, null, 2),
            "utf8"
          );
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

    const assignmentDir = path.join(
      storageDirectory,
      sanitizeName(termName),
      sanitizeName(courseName),
      sanitizeName(`${assignmentId} - ${assignmentName}`)
    );
    ensureDir(assignmentDir);

    const rubricJsonPath = path.join(assignmentDir, "rubric.json");
    fs.writeFileSync(rubricJsonPath, JSON.stringify(rubric, null, 2), "utf8");
    console.log("Saved rubric to:", rubricJsonPath);
  } catch (err) {
    console.warn("Failed to persist rubric to storage", err);
  }
}
