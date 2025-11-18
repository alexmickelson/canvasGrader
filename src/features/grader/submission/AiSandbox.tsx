import { useEffect, useState, type FC } from "react";
import { SandboxView } from "../../sandbox/SandboxView";
import { useLoadSubmissionToSandboxMutation } from "../../sandbox/sandboxHooks";

export const AiSandbox: FC<{
  studentName: string;
}> = ({ studentName }) => {
  const loadSubmission = useLoadSubmissionToSandboxMutation();
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    if (loaded) return;
    loadSubmission
      .mutateAsync({
        studentName: studentName,
      })
      .then(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!loaded) {
    return <div>Loading submission into sandbox...</div>;
  }

  return <SandboxView />;
};
