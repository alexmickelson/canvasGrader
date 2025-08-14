import { useSuspenseQuery } from "@tanstack/react-query";
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
