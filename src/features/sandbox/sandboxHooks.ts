import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "../../server/trpc/trpcClient";
import { useCurrentCourse } from "../../components/contexts/CourseProvider";
import { useCurrentAssignment } from "../../components/contexts/AssignmentProvider";

export const useExecuteCommand = () => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  return useMutation(
    trpc.sandbox.executeCommand.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.sandbox.getOutput.queryKey(),
        });
      },
    })
  );
};

export const useGetTmuxOutput = ({
  refetchInterval,
}: {
  refetchInterval: number;
}) => {
  const trpc = useTRPC();
  return useQuery(
    trpc.sandbox.getOutput.queryOptions(undefined, {
      refetchInterval,
    })
  );
};

export const useLoadSubmissionToSandbox = () => {
  const trpcClient = useTRPCClient();
  const { courseName, termName } = useCurrentCourse();
  const { assignmentName, assignmentId } = useCurrentAssignment();
  return useMutation({
    mutationFn: async ({ studentName }: { studentName: string }) => {
      return trpcClient.sandbox.loadSubmissionToSandbox.mutate({
        studentName,
        assignmentId,
        assignmentName,
        termName,
        courseName,
      });
    },
  });
};
