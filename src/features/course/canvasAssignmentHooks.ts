import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useTRPC } from "../../server/trpc/trpcClient";

export const useAssignmentsQuery = (courseId: number) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.canvas.assignments.getAssignmentsInCourse.queryOptions({ courseId })
  );
};

export const useRefreshAssignmentsMutation = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  return useMutation(
    trpc.canvas.assignments.refreshAssignmentsInCourse.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.canvas.assignments.getAssignmentsInCourse.queryKey(),
        });
      },
    })
  );
};
