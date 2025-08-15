import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
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

export const usePreviewPdfQuery = ({
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
    trpc.canvas.buildPreviewPdf.queryOptions({
      courseId,
      assignmentId,
      userId,
    })
  );
};
