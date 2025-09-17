import {
  useQuery,
  useSuspenseQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useTRPC } from "../../server/trpc/trpcClient";

export const useSubmissionsQuery = (courseId: number, assignmentId: number) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.canvas.getAssignmentSubmissions.queryOptions({
      courseId,
      assignmentId,
    })
  );
};

export const useDownloadAttachmentsQuery = ({
  courseId,
  assignmentId,
  userId,
}: {
  courseId: number;
  assignmentId: number;
  userId: number;
}) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.canvas.downloadAllAttachments.queryOptions({
      courseId,
      assignmentId,
      userId,
    })
  );
};

export const useRubricQuery = (courseId: number, assignmentId: number) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.canvas.getAssignmentRubric.queryOptions({
      courseId,
      assignmentId,
    })
  );
};

export const useGitHubClassroomMutation = () => {
  const trpc = useTRPC();
  return useMutation(
    trpc.canvas.downloadAndOrganizeRepositories.mutationOptions({
      onSuccess: (result) => {
        console.log("=== GitHub Classroom Download Success ===");
        console.log("Result:", result);
        console.log(
          `Successfully organized ${result.successCount} repositories`
        );
        if (result.errorCount > 0) {
          console.log(
            `${result.errorCount} repositories had errors:`,
            result.errors
          );
        }
        if (result.processedRepositories) {
          console.log("Processed repositories:", result.processedRepositories);
        }

        // Show success message
        alert(
          `✅ GitHub Classroom Download Complete!\n\n${result.message}\n\nThe page will refresh to show the new submissions.`
        );

        // Refresh submissions after successful download
        window.location.reload();
      },
      onError: (error) => {
        console.error("=== GitHub Classroom Download Failed ===");
        console.error("Error details:", error);

        // Show error message
        alert(
          `❌ GitHub Classroom Download Failed!\n\n${error.message}\n\nCheck the console for more details.`
        );
      },
    })
  );
};

export const useAiAnalysisMutation = () => {
  const trpc = useTRPC();
 
  const queryClient = useQueryClient();
  return useMutation(
    trpc.rubricAiReport.analyzeRubricCriterion.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.rubricAiReport.getAllEvaluations.queryKey(),
        });
      },
    })
  );
};

export const useAllEvaluationsQuery = ({
  assignmentId,
  assignmentName,
  courseName,
  termName,
  studentName,
}: {
  assignmentId: number;
  assignmentName: string;
  courseName: string;
  termName: string;
  studentName: string;
}) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.rubricAiReport.getAllEvaluations.queryOptions({
      assignmentId,
      assignmentName,
      courseName,
      termName,
      studentName,
    })
  );
};

// GitHub Classroom hooks
export const useGitHubClassroomsQuery = () => {
  const trpc = useTRPC();
  return useQuery(trpc.canvas.getGitHubClassrooms.queryOptions());
};

export const useGitHubClassroomAssignmentsQuery = (
  classroomId: string | null
) => {
  const trpc = useTRPC();
  return useQuery({
    ...trpc.canvas.getGitHubClassroomAssignments.queryOptions({
      classroomId: classroomId || "",
    }),
    enabled: !!classroomId,
  });
};
