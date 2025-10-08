import { useEffect, useState, type FC } from "react";
import { SandboxView } from "../../sandbox/SandboxView";
import { useLoadSubmissionToSandbox } from "../../sandbox/sandboxHooks";

export const AiSandbox: FC<{
  assignmentName: string;
  assignmentId: number;
  studentName: string;
  termName: string;
  courseName: string;
}> = ({ termName, assignmentId, studentName, assignmentName, courseName }) => {
  const loadSubmission = useLoadSubmissionToSandbox();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (loaded) return;
    loadSubmission
      .mutateAsync({
        termName,
        courseName,
        assignmentId,
        assignmentName,
        studentName,
      })
      .then(() => setLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) {
    return <div>Loading submission into sandbox...</div>;
  }

  return <SandboxView />;
};
