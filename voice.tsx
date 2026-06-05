import type { TuiPluginApi } from "@opencode-ai/plugin/dist/tui.js";

let isRecording = false;
let recorderProcess: any = null;
let currentTranscriptResolver: ((val: string) => void) | null = null;
let currentStartResolver: (() => void) | null = null;

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
      const args = ["/home/devank/Vault/AriaOS/.opencode/plugins/voice_backend.py"];
      if (deviceIndex !== null) args.push(deviceIndex.toString());

      recorderProcess = Bun.spawn(["/home/devank/Vault/AriaOS/.opencode/plugins/.venv/bin/python", ...args], {
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
              }
            }
          }
        } catch (e) {}
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
          const proc = Bun.spawn(["/home/devank/Vault/AriaOS/.opencode/plugins/.venv/bin/python", "/home/devank/Vault/AriaOS/.opencode/plugins/voice_backend.py", "--list-devices"], { stdout: "pipe" });
          const text = await new Response(proc.stdout).text();
          const devices = JSON.parse(text);

          const options = devices.map((d: any) => ({
            title: d.name,
            value: d.index
          }));

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
      }
    ]);
  }
};