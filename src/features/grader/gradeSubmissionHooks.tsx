import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../../server/trpc/trpcClient";

export const useGradeSubmissionMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.canvas.gradeSubmissionWithRubric.mutationOptions({
      onSuccess: (result, variables) => {

        // Invalidate related queries to refresh the UI
        queryClient.invalidateQueries({
          queryKey: trpc.canvas.getAssignmentSubmissions.queryKey({
            courseId: variables.courseId,
            assignmentId: variables.assignmentId,
          }),
        });
      },
      onError: (error) => {
        console.error("❌ Failed to grade submission:", error);
        alert(
          `❌ Failed to Grade Submission!\n\n${error.message}\n\nCheck the console for more details.`
        );
      },
    })
  );
};
