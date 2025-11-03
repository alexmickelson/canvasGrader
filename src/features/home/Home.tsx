import { ManageSettings } from "./ManageSettings";
import { AiQueueStatus } from "./AiQueueStatus";

export const Home = () => {
  return (
    <div className="space-y-6 h-screen flex flex-col ">
      <AiQueueStatus />
      <ManageSettings />
    </div>
  );
};
