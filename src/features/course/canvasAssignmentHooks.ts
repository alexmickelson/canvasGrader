import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "../../server/trpc/trpcClient";


export const useAssignmentsQuery = (courseId: number) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.canvas.getAssignmentsInCourse.queryOptions({ courseId })
  );
}