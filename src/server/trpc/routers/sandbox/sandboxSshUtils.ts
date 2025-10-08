import { Client } from "ssh2";

const SSH_HOST = "playwright_mcp";
const SSH_PORT = 22;
const SSH_USER = "root";
const SSH_PASS = "password";

let sshClient: Client | null = null;
let isConnected = false;

export function ansiToHtml(str: string): string {
  const ansiColorMap: Record<string, string> = {
    // Foreground colors
    "30": "color: #000",
    "31": "color: #e06c75",
    "32": "color: #98c379",
    "33": "color: #e5c07b",
    "34": "color: #61afef",
    "35": "color: #c678dd",
    "36": "color: #56b6c2",
    "37": "color: #abb2bf",
    "90": "color: #5c6370",
    "91": "color: #e06c75",
    "92": "color: #98c379",
    "93": "color: #e5c07b",
    "94": "color: #61afef",
    "95": "color: #c678dd",
    "96": "color: #56b6c2",
    "97": "color: #fff",
    // Background colors
    "40": "background-color: #000",
    "41": "background-color: #e06c75",
    "42": "background-color: #98c379",
    "43": "background-color: #e5c07b",
    "44": "background-color: #61afef",
    "45": "background-color: #c678dd",
    "46": "background-color: #56b6c2",
    "47": "background-color: #abb2bf",
    // Text styles
    "1": "font-weight: bold",
    "3": "font-style: italic",
    "4": "text-decoration: underline",
  };

  let html = str;
  const styles: string[] = [];

  // eslint-disable-next-line no-control-regex
  html = html.replace(/\x1b\[([0-9;]*)m/g, (_match, codes) => {
    if (codes === "0" || codes === "") {
      // Reset
      if (styles.length > 0) {
        styles.length = 0;
        return "</span>";
      }
      return "";
    }

    const codeList = codes.split(";");
    const newStyles = codeList
      .map((code: string) => ansiColorMap[code])
      .filter(Boolean);

    if (newStyles.length > 0) {
      styles.push(...newStyles);
      return `<span style="${styles.join("; ")}">`;
    }

    return "";
  });

  // Close any unclosed spans
  if (styles.length > 0) {
    html += "</span>";
  }

  return html;
}

export async function getSSHConnection(): Promise<Client> {
  if (sshClient && isConnected) {
    return sshClient;
  }

  return new Promise((resolve, reject) => {
    const conn = new Client();

    conn.on("ready", () => {
      console.log("SSH connection established");
      sshClient = conn;
      isConnected = true;
      resolve(conn);
    });

    conn.on("error", (err) => {
      console.error("SSH connection error:", err);
      isConnected = false;
      reject(err);
    });

    conn.on("close", () => {
      console.log("SSH connection closed");
      isConnected = false;
      sshClient = null;
    });

    conn.connect({
      host: SSH_HOST,
      port: SSH_PORT,
      username: SSH_USER,
      password: SSH_PASS,
    });
  });
}

export async function sshExec(
  command: string
): Promise<{ stdout: string; stderr: string }> {
  const conn = await getSSHConnection();

  return new Promise((resolve, reject) => {
    // Prepend cd command to ensure we're in /live_project
    const fullCommand = `cd /live_project && ${command}`;

    conn.exec(fullCommand, { pty: true }, (err, stream) => {
      if (err) return reject(err);

      let stdout = "";
      let stderr = "";

      stream.on("data", (data: Buffer) => {
        stdout += data.toString();
      });

      stream.stderr.on("data", (data: Buffer) => {
        stderr += data.toString();
      });

      stream.on("close", () => {
        resolve({ stdout, stderr });
      });
    });
  });
}

export function disconnectSSH(): void {
  if (sshClient && isConnected) {
    sshClient.end();
    sshClient = null;
    isConnected = false;
  }
}
