import type { TuiPluginApi } from "@opencode-ai/plugin/dist/tui.js";
import { resolve } from "path";
import { dirname } from "path";

let isRecording = false;
let recorderProcess: any = null;
let currentTranscriptResolver: ((val: string) => void) | null = null;
let currentStartResolver: (() => void) | null = null;

// Plugin directory - use import.meta.url for Bun, fallback to __dirname
const pluginDir = dirname(fileURLToPath(import.meta.url));

// Configurable paths via KV store with sensible defaults
const getPythonPath = () => api.kv.get("python_path", "python3") as string;
const getModelSize = () => api.kv.get("model_size", "small") as string;
const getBackendPath = () => resolve(pluginDir, "voice_backend.py");

export default {
  id: "voice-input",
  tui: async (api: TuiPluginApi) => {
    const appendPrompt = (text: string) => {
      api.client.tui.publish({ body: { type: "tui.prompt.append", properties: { text } } });
    };

    // Ensure backend is started
    const ensureBackend = () => {
      if (recorderProcess) return;

      const deviceIndex = api.kv.get("voice_device_index", null);
      const pythonPath = getPythonPath();
      const args = [getBackendPath()];
      if (deviceIndex !== null) args.push(deviceIndex.toString());

      recorderProcess = Bun.spawn([pythonPath, ...args], {
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe"
      });

      const consumeStream = async (stream: ReadableStream, isStdout: boolean) => {
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
              const text = line.trim();
              if (isStdout && text === "READY") {
                // Backend model is loaded
              } else if (isStdout && text === "STARTED") {
                if (currentStartResolver) {
                  currentStartResolver();
                  currentStartResolver = null;
                }
              } else if (isStdout && text.startsWith("RESULT:")) {
                const result = text.slice(7).trim();
                if (currentTranscriptResolver) {
                  currentTranscriptResolver(result);
                  currentTranscriptResolver = null;
                }
              } else if (isStdout && text.startsWith("ERROR:")) {
                console.error("Backend error:", text.slice(6));
              }
            }
          }
        } catch (e) {
          console.error("Stream error:", e);
        }
      };

      consumeStream(recorderProcess.stdout, true);
      consumeStream(recorderProcess.stderr, false);
    };

    // Start backend in background as soon as plugin loads
    ensureBackend();

    api.command.register(() => [
      {
        title: "Voice input",
        value: "voice-input",
        category: "Input",
        keybind: "f4",
        onSelect: async () => {
          ensureBackend();

          if (isRecording) {
            isRecording = false;
            
            // Send STOP command
            recorderProcess.stdin.write("STOP\n");
            recorderProcess.stdin.flush();
            
            try {
              const transcript = await new Promise<string>((resolve) => {
                currentTranscriptResolver = resolve;
                // Add a timeout just in case it hangs
                setTimeout(() => resolve(""), 30000); 
              });
              
              if (transcript) {
                appendPrompt(transcript + " ");
                api.ui.toast({ message: "Transcription complete!", variant: "success" });
              } else {
                api.ui.toast({ message: "No speech detected.", variant: "warning" });
              }
            } catch (e) {
              const msg = e instanceof Error ? e.message : String(e);
              api.ui.toast({ message: "Error: " + msg, variant: "error" });
            }
            return;
          }

          isRecording = true;
          api.ui.toast({ message: "Starting voice input...", variant: "info" });

          // Wait for backend to be ready and start recording
          await new Promise<void>((resolve) => {
            currentStartResolver = resolve;
            recorderProcess.stdin.write("START\n");
            recorderProcess.stdin.flush();
            // Fallback resolve after 10 seconds if backend doesn't reply
            setTimeout(resolve, 10000);
          });

          api.ui.toast({ message: "Recording... (Press F4 to stop)", variant: "success", duration: 0 });
        }
      },
      {
        title: "Select speech provider",
        value: "voice-select-provider",
        category: "Input",
        keybind: "f5",
        onSelect: () => {
          api.ui.dialog.replace(() => api.ui.DialogSelect({
            title: "Select speech provider",
            options: [
              { title: "Local (faster-whisper)", description: "Local Model", value: "local" },
            ],
            onSelect: (opt) => {
              api.kv.set("voice_provider", opt.value);
              api.ui.dialog.clear();
            }
          }));
        }
      },
      {
        title: "Select microphone",
        value: "voice-select-mic",
        category: "Input",
        keybind: "f6",
        onSelect: async () => {
          api.ui.dialog.replace(() => api.ui.DialogAlert({
            title: "Loading...",
            message: "Fetching available microphones..."
          }));
          const pythonPath = getPythonPath();
          const proc = Bun.spawn([pythonPath, getBackendPath(), "--list-devices"], { stdout: "pipe" });
          const text = await new Response(proc.stdout).text();
          let devices;
          try {
            devices = JSON.parse(text);
          } catch {
            api.ui.dialog.replace(() => api.ui.DialogAlert({
              title: "Error",
              message: "Failed to fetch microphones. Is sounddevice installed?"
            }));
            return;
          }

          const options = devices.map((d: any) => ({
            title: d.name,
            value: d.index
          }));

          if (options.length === 0) {
            api.ui.dialog.replace(() => api.ui.DialogAlert({
              title: "No microphones found",
              message: "Please connect a microphone and try again."
            }));
            return;
          }

          api.ui.dialog.replace(() => api.ui.DialogSelect({
            title: "Select microphone",
            options: options,
            onSelect: (opt) => {
              api.kv.set("voice_device_index", opt.value);
              // Restart backend to apply new mic
              if (recorderProcess) {
                recorderProcess.kill();
                recorderProcess = null;
              }
              ensureBackend();
              api.ui.dialog.clear();
            }
          }));
        }
      },
      {
        title: "Configure voice settings",
        value: "voice-config",
        category: "Input",
        keybind: "f7",
        onSelect: () => {
          const currentModel = getModelSize();
          const currentPython = getPythonPath();
          
          api.ui.dialog.replace(() => api.ui.DialogPrompt({
            title: "Voice Settings",
            message: `Current model: ${currentModel}\nPython path: ${currentPython}\n\nEnter new values (leave blank to keep current):`,
            fields: [
              { name: "model_size", label: "Model size (tiny/small/medium/large)", defaultValue: currentModel },
              { name: "python_path", label: "Python executable path", defaultValue: currentPython }
            ],
            onSubmit: (values) => {
              if (values.model_size) api.kv.set("model_size", values.model_size);
              if (values.python_path) api.kv.set("python_path", values.python_path);
              // Restart backend to apply new settings
              if (recorderProcess) {
                recorderProcess.kill();
                recorderProcess = null;
              }
              ensureBackend();
              api.ui.dialog.clear();
              api.ui.toast({ message: "Voice settings updated. Restarting backend...", variant: "success" });
            }
          }));
        }
      }
    ]);
  }
};

// Helper for ESM __dirname equivalent
function fileURLToPath(url: string): string {
  if (typeof import.meta !== "undefined" && import.meta.url) {
    return new URL(url).pathname;
  }
  return url;
}
