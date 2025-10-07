import { VncScreen } from "react-vnc";

export const SandboxChat = () => {
  return (
    <div>
      <VncScreen
        url="ws://localhost:3903"
        scaleViewport
        background="#000000"
        style={{
          width: "1280px",
          height: "720px",
        }}
      />
    </div>
  );
};
