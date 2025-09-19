import { ManageSettings } from "./ManageSettings";
import { AiQueueStatus } from "./AiQueueStatus";

export const Home = () => {
  return (
    <div className="space-y-6">
      <AiQueueStatus />
      <ManageSettings />
    </div>
  );
};
