import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "../../server/trpc/trpcClient";
import { useUpdateSubmissionsMutation } from "./graderHooks";

export const useGradeSubmissionMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const updateSubmissionsMutation = useUpdateSubmissionsMutation();

  return useMutation(
    trpc.canvas.gradeSubmissionWithRubric.mutationOptions({
      onSuccess: async (_, variables) => {
        await updateSubmissionsMutation.mutateAsync({
          courseId: variables.courseId,
          assignmentId: variables.assignmentId,
          assignmentName: variables.assignmentName,
          studentId: variables.studentId,
          studentName: variables.studentName,
        });

        queryClient.invalidateQueries({
          queryKey: trpc.canvas.getAssignmentSubmissions.queryKey({
            courseId: variables.courseId,
            assignmentId: variables.assignmentId,
          }),
        });
      },
    })
  );
};

export const useSubmitCommentMutation = () => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  return useMutation(
    trpc.canvas.submitComment.mutationOptions({
      onSuccess: (_result, variables) => {
        // Invalidate related queries to refresh the UI
        queryClient.invalidateQueries({
          queryKey: trpc.canvas.getAssignmentSubmissions.queryKey({
            courseId: variables.courseId,
            assignmentId: variables.assignmentId,
          }),
        });
      },
      onError: (error) => {
        console.error("❌ Failed to submit comment:", error);
        alert(
          `❌ Failed to Submit Comment!\n\n${error.message}\n\nCheck the console for more details.`
        );
      },
    })
  );
};
