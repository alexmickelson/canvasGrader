import { ManageSettings } from "./ManageSettings";
import { AiQueueStatus } from "./AiQueueStatus";
import { SandboxChat } from "../sandbox/SandboxChat";

export const Home = () => {
  return (
    <div className="space-y-6">
      <AiQueueStatus />
      <ManageSettings />
      <SandboxChat />
    </div>
  );
};
