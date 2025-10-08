import { parseSchema } from "../parseSchema.js";
import {
  canvasRequestOptions,
  paginatedRequest,
  isTestStudentSubmission,
} from "./canvasServiceUtils.js";
import {
  type CanvasSubmission,
  CanvasSubmissionSchema,
} from "./canvasModels.js";
import { rateLimitAwareGet } from "./canvasRequestUtils.js";

const canvasBaseUrl =
  process.env.CANVAS_BASE_URL || "https://snow.instructure.com";

export const fetchSingleSubmissionByIdFromCanvas = async (
  courseId: number,
  assignmentId: number,
  userId: number
): Promise<CanvasSubmission | null> => {
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

    // Filter out Test Student submissions
    if (isTestStudentSubmission(parsedSubmission)) {
      console.log(
        `Filtering out Test Student submission (ID: ${parsedSubmission.id})`
      );
      return null;
    }

    return parsedSubmission;
  } catch (error) {
    console.error(`Failed to fetch submission for user ID ${userId}:`, error);
    return null;
  }
};

export const fetchSubmissionsFromCanvas = async (
  courseId: number,
  assignmentId: number
): Promise<CanvasSubmission[]> => {
  // Fetch all submissions using the submissions endpoint
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
  const filteredSubmissions = parsedSubmissions.filter((submission) => {
    if (isTestStudentSubmission(submission)) {
      console.log(
        `Filtering out Test Student submission (ID: ${submission.id})`
      );
      return false;
    }
    return true;
  });

  const filteredCount = parsedSubmissions.length - filteredSubmissions.length;
  if (filteredCount > 0) {
    console.log(`Filtered out ${filteredCount} Test Student submission(s)`);
  }

  return filteredSubmissions;
};
