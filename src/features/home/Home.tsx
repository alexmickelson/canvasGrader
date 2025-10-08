import { ManageSettings } from "./ManageSettings";
import { AiQueueStatus } from "./AiQueueStatus";
import { SandboxView } from "../sandbox/SandboxView";

export const Home = () => {
  return (
    <div className="space-y-6">
      <AiQueueStatus />
      <ManageSettings />
      <SandboxView />
    </div>
  );
};
