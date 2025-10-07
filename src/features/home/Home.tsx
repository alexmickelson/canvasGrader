import { ManageSettings } from "./ManageSettings";
import { AiQueueStatus } from "./AiQueueStatus";
import { SandboxChat } from "./SandboxChat";

export const Home = () => {
  return (
    <div className="space-y-6">
      <AiQueueStatus />
      <ManageSettings />
      <SandboxChat />
    </div>
  );
};
