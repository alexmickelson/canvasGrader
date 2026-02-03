import { parseSchema } from "../../../parseSchema.js";
import {
  canvasRequestOptions,
  paginatedRequest,
} from "../../canvasServiceUtils.js";
import {
  type CanvasSubmission,
  CanvasSubmissionSchema,
} from "../../canvasModels.js";
import { rateLimitAwareGet } from "../../canvasRequestUtils.js";
import {
  ensureDir,
  getSubmissionDirectory,
  storeSubmissionMarkdown,
} from "../../canvasStorageUtils.js";
import path from "path";
import {
  deleteOtherSubmissions,
  storeAttachments,
  storeSubmissions,
} from "./assignmentDbUtils.js";
import {
  downloadAllAttachmentsUtil,
  downloadCommentAttachments,
  downloadEmbeddedAttachments,
} from "./canvasSubmissionAttachmentUtils.js";

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

  console.log("embedded attachments", submission.user.name, embeddedFiles);

  await Promise.all([
    storeAttachments(submissionAttachments),
    storeAttachments(commentAttachments),
    storeAttachments(embeddedFiles),
  ]);
}

export const fetchAndStoreSingleSubmissionByIdFromCanvas = async (
  courseId: number,
  assignmentId: number,
  userId: number,
  termName: string,
  courseName: string,
  assignmentName: string,
  studentName: string,
): Promise<CanvasSubmission> => {
  const submissionUrl = `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions/${userId}`;

  const { data: submission } = await rateLimitAwareGet(submissionUrl, {
    headers: canvasRequestOptions.headers,
    params: {
      include: ["user", "submission_comments", "rubric_assessment"],
    },
  });

  const parsedSubmission = parseSchema(
    CanvasSubmissionSchema,
    submission,
    "CanvasSubmission",
  );
  await storeSubmissions([parsedSubmission]);
  storeSubmissionMarkdown(parsedSubmission, {
    termName,
    courseName,
    assignmentId,
    assignmentName,
    studentName,
  });

  return parsedSubmission;
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
    parseSchema(CanvasSubmissionSchema, submission, "CanvasSubmission"),
  );

  // Filter out submissions from Test Student
  const filteredSubmissions = parsedSubmissions.filter(
    (s) => s.user?.name !== "Test Student",
  );

  await storeSubmissions(filteredSubmissions);
  await deleteOtherSubmissions(filteredSubmissions); // if somebody has dropped the class, don't show their submission

  filteredSubmissions.map((s) =>
    storeSubmissionMarkdown(s, {
      termName,
      courseName,
      assignmentId,
      assignmentName,
      studentName: s.user.name,
    }),
  );

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
    }),
  );
  return filteredSubmissions;
};
