import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "../../server/trpc/trpcClient";

export const useCanvasCoursesQuery = () => {
  const trpc = useTRPC();
  return useSuspenseQuery(trpc.canvas.getCourses.queryOptions());
};
