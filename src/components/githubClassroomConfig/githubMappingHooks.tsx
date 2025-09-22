import { useSuspenseQuery } from "@tanstack/react-query";
import {
  useSettingsQuery,
  useUpdateSettingsMutation,
} from "../../features/home/settingsHooks";
import { useTRPC } from "../../server/trpc/trpcClient";

export type CourseGithubMappingItem = {
  studentName: string;
  githubUsername: string;
};

export const useCourseGithubMapping = (canvasId: number) => {
  const { data: settings } = useSettingsQuery();
  const course = settings?.courses?.find((c) => c.canvasId === canvasId);
  return course?.githubUserMap as CourseGithubMappingItem[] | undefined;
};

export const useUpdateCourseGithubMapping = () => {
  const updateSettings = useUpdateSettingsMutation();
  return updateSettings;
};

export const useScanGithubClassroomQuery = (classroomAssignmentId: string) => {
  const trpc = useTRPC();
  return useSuspenseQuery(
    trpc.settings.scanGithubClassroom.queryOptions({ classroomAssignmentId })
  );
};
