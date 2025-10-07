import { ManageSettings } from "./ManageSettings";
import { AiQueueStatus } from "./AiQueueStatus";
import { VncScreen } from 'react-vnc';

export const Home = () => {
  return (
    <div className="space-y-6">
      <AiQueueStatus />
      <ManageSettings />

      <VncScreen
        url="ws://localhost:3903"
        scaleViewport
        background="#000000"
        style={{
          // width: "100%",
          width: "auto",
          height: "200px",
        }}
      />
    </div>
  );
};
