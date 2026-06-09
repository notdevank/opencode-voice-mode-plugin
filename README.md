# OpenCode Voice Mode Plugin

A local, privacy-first voice dictation plugin for [OpenCode](https://github.com/opencode-ai/opencode), powered by `faster-whisper`.

## Features

- **Local Processing** — All transcription runs locally using `faster-whisper`. No data leaves your machine.
- **Microphone Selection** — Built-in UI to choose your preferred input device.
- **Model Size Options** — Choose between `tiny`, `small`, `medium`, or `large` Whisper models.
- **Seamless TUI Integration** — Appends transcribed text directly to the OpenCode prompt.
- **Keyboard Shortcuts** — Start/stop recording with `F4`, select microphone with `F6`, configure with `F7`.

## Prerequisites

1. **Python 3.8+** with the following packages:

```bash
pip install sounddevice numpy faster-whisper
```

2. **ffmpeg** — Required for audio processing:

```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# macOS
brew install ffmpeg

# Windows (with scoop)
scoop install ffmpeg
```

## Installation

### Option 1: Clone directly into OpenCode plugins directory

```bash
cd ~/.opencode/plugins/
git clone https://github.com/notdevank/voice-mode-plugin.git
```

### Option 2: For development

```bash
git clone https://github.com/notdevank/voice-mode-plugin.git
cd voice-mode-plugin
npm install
```

## Configuration

After installation, configure the plugin via the in-app settings (`F7`):

| Setting | Default | Description |
|---------|---------|-------------|
| Python executable | `python3` | Path to your Python interpreter |
| Model size | `small` | Whisper model: `tiny`, `small`, `medium`, `large` |
| Microphone | System default | Selected input device |

### Model Size Guide

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| `tiny` | ~75 MB | Fastest | Baseline |
| `small` | ~244 MB | Fast | Good |
| `medium` | ~769 MB | Medium | Better |
| `large` | ~1550 MB | Slow | Best |

## Usage

| Shortcut | Action |
|----------|--------|
| `F4` | Toggle voice recording (start/stop) |
| `F5` | Select speech provider |
| `F6` | Select microphone |
| `F7` | Configure voice settings |

### Workflow

1. Press `F4` to start recording
2. Speak your command or text
3. Press `F4` again to stop and transcribe
4. Your transcribed text is appended to the prompt

## Troubleshooting

### "Failed to fetch microphones"
- Ensure `sounddevice` is installed: `pip install sounddevice`
- Check that your microphone is connected and working

### "Model loading failed"
- Ensure `faster-whisper` is installed: `pip install faster-whisper`
- Try downloading the model manually or use a smaller model size

### "No speech detected"
- Check your microphone is selected correctly (`F6`)
- Ensure audio input volume is not too low
- Try speaking closer to the microphone

### Backend won't start
- Verify Python path in settings (`F7`)
- Run manually to see errors:
```bash
python3 voice_backend.py
```

## Architecture

```
voice.tsx          → OpenCode plugin frontend (TypeScript/Bun)
voice_backend.py   → Python backend (faster-whisper + sounddevice)
```

The plugin spawns the Python backend as a subprocess and communicates via stdin/stdout.

## Contributing

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

Distributed under the MIT License. See `LICENSE` for more information.
