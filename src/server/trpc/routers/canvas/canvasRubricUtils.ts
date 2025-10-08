import { parseSchema } from "../parseSchema.js";
import { canvasRequestOptions } from "./canvasServiceUtils.js";
import { persistRubricToStorage } from "./canvasStorageUtils.js";
import { type CanvasRubric, CanvasRubricSchema } from "./canvasModels.js";
import { rateLimitAwareGet } from "./canvasRequestUtils.js";

const canvasBaseUrl =
  process.env.CANVAS_BASE_URL || "https://snow.instructure.com";

export const fetchAssignmentRubric = async (
  courseId: number,
  assignmentId: number
): Promise<CanvasRubric> => {
  console.log(
    `Fetching rubric for assignment ${assignmentId} in course ${courseId}`
  );

  try {
    // First, get the assignment to find the rubric association ID
    const { data: assignment } = await rateLimitAwareGet<{
      rubric_settings?: { id?: string };
    }>(
      `${canvasBaseUrl}/api/v1/courses/${courseId}/assignments/${assignmentId}`,
      {
        headers: canvasRequestOptions.headers,
      }
    );

    const rubricId = assignment?.rubric_settings?.id;
    if (!rubricId) {
      throw new Error(
        `No rubric found for assignment ${assignmentId}. Please ensure the assignment has a rubric attached.`
      );
    }

    console.log(`Found rubric ID ${rubricId} for assignment ${assignmentId}`);

    // Fetch the actual rubric data
    const { data: rubric } = await rateLimitAwareGet(
      `${canvasBaseUrl}/api/v1/courses/${courseId}/rubrics/${rubricId}`,
      {
        headers: canvasRequestOptions.headers,
      }
    );

    if (!rubric) {
      throw new Error(
        `Failed to fetch rubric data for rubric ID ${rubricId}. The rubric may have been deleted or access permissions may be insufficient.`
      );
    }

    console.log(`Successfully fetched rubric data for ID ${rubricId}`);

    // Parse and validate the rubric data
    const normalizedRubric = parseSchema(
      CanvasRubricSchema,
      rubric,
      "CanvasRubric"
    );

    // Persist rubric to storage
    await persistRubricToStorage(courseId, assignmentId, normalizedRubric);

    console.log(`Rubric persisted to storage for assignment ${assignmentId}`);

    return normalizedRubric;
  } catch (error) {
    console.error(
      `Error fetching rubric for assignment ${assignmentId}:`,
      error
    );

    // Re-throw with more context if it's our custom error
    if (error instanceof Error && error.message.includes("No rubric found")) {
      throw error;
    }

    // Handle axios errors
    if (error && typeof error === "object" && "response" in error) {
      const axiosError = error as {
        response: { status?: number; data?: unknown };
      };
      throw new Error(
        `Canvas API error (${
          axiosError.response.status
        }): Failed to fetch rubric for assignment ${assignmentId}. ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    throw new Error(
      `Failed to fetch rubric for assignment ${assignmentId}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
};
