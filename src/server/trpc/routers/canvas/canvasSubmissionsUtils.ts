import { parseSchema } from "../parseSchema.js";
import {
  canvasRequestOptions,
  paginatedRequest,
  downloadAllAttachmentsUtil,
  downloadCommentAttachments,
  downloadEmbeddedAttachments,
} from "./canvasServiceUtils.js";
import {
  type CanvasSubmission,
  CanvasSubmissionSchema,
} from "./canvasModels.js";
import { rateLimitAwareGet } from "./canvasRequestUtils.js";
import { ensureDir, getSubmissionDirectory } from "./canvasStorageUtils.js";
import path from "path";
import {
  storeAttachments,
  storeSubmissions,
} from "./course/assignment/assignmentDbUtils.js";

const canvasBaseUrl =
  process.env.CANVAS_BASE_URL || "https://snow.instructure.com";

async function storeSubmissionAttachments({
  courseId,
  assignmentId,
  termName,
  courseName,
  assignmentName,
  submission,
}: {
  courseId: number;
  assignmentId: number;
  termName: string;
  courseName: string;
  assignmentName: string;
  submission: CanvasSubmission;
}) {
  const submissionDir = getSubmissionDirectory({
    termName,
    courseName,
    assignmentId,
    assignmentName,
    studentName: submission.user.name,
  });

  const attachmentsDir = path.join(submissionDir, "attachments");
  ensureDir(attachmentsDir);

  const [submissionAttachments, commentAttachments, embeddedFiles] =
    await Promise.all([
      downloadAllAttachmentsUtil({
        courseId: courseId,
        assignmentId: assignmentId,
        userId: submission.user_id,
        attachmentsDir,
      }),
      downloadCommentAttachments(submission, attachmentsDir),
      downloadEmbeddedAttachments(submission, attachmentsDir),
    ]);

  await Promise.all([
    storeAttachments(submissionAttachments, "uploaded"),
    storeAttachments(commentAttachments, "comment"),
    storeAttachments(embeddedFiles, "embedded"),
  ]);
}

export const fetchAndStoreSingleSubmissionByIdFromCanvas = async (
  courseId: number,
  assignmentId: number,
  userId: number
): Promise<CanvasSubmission> => {
  console.log(`Fetching submission for user ID ${userId}`);

  // Fetch the specific submission using the single submission endpoint
  const submissionUrl = `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`;

  try {
    const { data: submission } = await rateLimitAwareGet(submissionUrl, {
      headers: canvasRequestOptions.headers,
      params: {
        include: ["user", "submission_comments", "rubric_assessment"],
      },
    });

    const parsedSubmission = parseSchema(
      CanvasSubmissionSchema,
      submission,
      "CanvasSubmission"
    );

    return parsedSubmission;
  } catch (error) {
    console.error(`Failed to fetch submission for user ID ${userId}:`, error);
    throw error;
  }
};

export const fetchAndStoreSubmissionsFromCanvas = async ({
  courseId,
  assignmentId,
  courseName,
  assignmentName,
  termName,
}: {
  courseId: number;
  assignmentId: number;
  courseName: string;
  assignmentName: string;
  termName: string;
}): Promise<CanvasSubmission[]> => {
  const url = `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`;
  const submissions = await paginatedRequest<CanvasSubmission[]>({
    url,
    params: {
      include: ["user", "submission_comments", "rubric_assessment"],
    },
  });

  const parsedSubmissions = submissions.map((submission) =>
    parseSchema(CanvasSubmissionSchema, submission, "CanvasSubmission")
  );

  // Filter out submissions from Test Student
  const filteredSubmissions = parsedSubmissions.filter(
    (s) => s.user?.name !== "Test Student"
  );

  await storeSubmissions(filteredSubmissions);

  await Promise.all(
    submissions.map(async (submission) => {
      await storeSubmissionAttachments({
        courseId,
        assignmentId,
        termName,
        courseName,
        assignmentName,
        submission,
      });
    })
  );
  return filteredSubmissions;
};
