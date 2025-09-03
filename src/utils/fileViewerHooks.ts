import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "../server/trpc/trpcClient";

// Updated to align with fileViewerRouter which now expects names + term data instead of courseId
export const useFileContentQuery = ({
  assignmentId,
  assignmentName,
  studentName,
  termName,
  courseName,
  filePath,
}: {
  assignmentId: number;
  assignmentName: string;
  studentName: string;
  termName: string;
  courseName: string;
  filePath: string;
  enabled?: boolean;
}) => {
  const trpc = useTRPC();

  return useQuery(
    trpc.fileViewer.getFileContent.queryOptions({
      assignmentId,
      assignmentName,
      studentName,
      termName,
      courseName,
      filePath,
    })
  );
};

export const useListStudentFilesQuery = ({
  assignmentId,
  assignmentName,
  studentName,
  termName,
  courseName,
}: {
  assignmentId: number;
  assignmentName: string;
  studentName: string;
  termName: string;
  courseName: string;
}) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.fileViewer.listStudentFiles.queryOptions({
      assignmentId,
      assignmentName,
      studentName,
      termName,
      courseName,
    })
  );
};
