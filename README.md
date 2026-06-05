<div align="center">
  <h3 align="center">OpenCode Voice Mode Plugin</h3>
  <p align="center">
    A local, privacy-first voice dictation plugin built specifically for OpenCode, powered by faster-whisper.
    <br />
    <a href="https://github.com/notdevank/voice-mode-plugin/issues">Report Bug</a>
    ·
    <a href="https://github.com/notdevank/voice-mode-plugin/issues">Request Feature</a>
  </p>
</div>

![Version](https://img.shields.io/github/package-json/v/notdevank/voice-mode-plugin?color=blue&style=flat-square)
![License](https://img.shields.io/github/license/notdevank/voice-mode-plugin?color=green&style=flat-square)

<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About The Project</a></li>
    <li><a href="#features">Features</a></li>
    <li><a href="#getting-started">Getting Started</a></li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
  </ol>
</details>

## About The Project

The Voice Mode Plugin enables dictation within the OpenCode terminal UI. Instead of typing out long prompts or commands, simply use your voice! This plugin offloads speech-to-text processing to a local Python backend running `faster-whisper`, keeping your voice data private and secure on your own machine. It integrates directly with the `@opencode-ai/plugin` API.

## Features
* **Local Processing:** Utilizes `faster-whisper` for fast, accurate, and completely local transcription.
* **Microphone Selection:** Built-in UI dialog to choose your preferred input device.
* **Seamless TUI Integration:** Appends transcribed text directly to the OpenCode prompt.
* **Keyboard Shortcuts:** Start and stop recording with a quick press of `F4`.

## Getting Started

### Prerequisites

You need Python installed and the required Python packages for the backend:

```bash
pip install sounddevice numpy faster-whisper
```

*Note: You may also need `ffmpeg` installed on your system for audio processing.*

### Installation

Clone this repository into your OpenCode plugins directory:

```bash
cd ~/.opencode/plugins/
git clone https://github.com/notdevank/voice-mode-plugin.git
```

Make sure the Python executable paths in `voice.tsx` (currently configured for `.venv/bin/python`) match your local environment.

## Usage

Once loaded into OpenCode, you can access the voice controls via the command menu:

- **Voice input** (`F4`): Toggles recording. Start speaking, then press `F4` again to transcribe and append to your prompt.
- **Select microphone** (`F6`): Opens a dialog to select the active microphone.
- **Select speech provider** (`F5`): Opens a dialog to select the provider (currently local faster-whisper).

## Contributing
Contributions are what make the open source community such an amazing place to learn, inspire, and create. Any contributions you make are **greatly appreciated**.

If you have a suggestion that would make this better, please fork the repo and create a pull request. You can also simply open an issue with the tag "enhancement".

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License
Distributed under the MIT License. See `LICENSE` for more information.