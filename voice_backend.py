#!/usr/bin/env python3
"""Voice backend for OpenCode plugin - faster-whisper based transcription."""
import sys
import queue
import threading
import os

try:
    import sounddevice as sd
except ImportError:
    print("ERROR: sounddevice not installed. Run: pip install sounddevice", file=sys.stderr)
    sys.exit(1)

try:
    import numpy as np
except ImportError:
    print("ERROR: numpy not installed. Run: pip install numpy", file=sys.stderr)
    sys.exit(1)

try:
    from faster_whisper import WhisperModel
except ImportError:
    print("ERROR: faster-whisper not installed. Run: pip install faster-whisper", file=sys.stderr)
    sys.exit(1)


def get_devices():
    """List all available audio input devices."""
    try:
        devices = sd.query_devices()
        return [{"index": d["index"], "name": d["name"], "max_input_channels": d["max_input_channels"]} 
                for d in devices if d["max_input_channels"] > 0]
    except Exception as e:
        print(f"ERROR listing devices: {e}", file=sys.stderr)
        return []


def main():
    # Parse arguments
    device_index = None
    model_size = "small"
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "--list-devices":
            print(json.dumps(get_devices()))
            sys.exit(0)
        elif sys.argv[1] == "--help":
            print("Usage: voice_backend.py [device_index] [model_size]")
            print("  --list-devices  List available microphones")
            print("  device_index    Audio device index (optional)")
            print("  model_size      Model size: tiny, small, medium, large (default: small)")
            sys.exit(0)
        else:
            try:
                device_index = int(sys.argv[1])
            except ValueError:
                print(f"ERROR: Invalid device index: {sys.argv[1]}", file=sys.stderr)
                sys.exit(1)
    
    if len(sys.argv) > 2:
        model_size = sys.argv[2].lower()
        if model_size not in ("tiny", "small", "medium", "large"):
            print(f"ERROR: Unknown model size: {model_size}", file=sys.stderr)
            sys.exit(1)

    # Load model
    print(f"Loading {model_size} model...", file=sys.stderr)
    try:
        model = WhisperModel(model_size, device="cpu", compute_type="int8")
        print("Model loaded.", file=sys.stderr)
    except Exception as e:
        print(f"ERROR loading model: {e}", file=sys.stderr)
        sys.exit(1)

    # Signal ready
    print("READY", flush=True)

    samplerate = 16000
    channels = 1
    
    stop_event = threading.Event()
    q = queue.Queue()
    audio_data = []
    
    def callback(indata, frames, time, status):
        if status:
            print(f"Audio callback status: {status}", file=sys.stderr)
        q.put(indata.copy())

    def record_loop():
        try:
            with sd.InputStream(samplerate=samplerate, channels=channels, device=device_index, callback=callback):
                while not stop_event.is_set():
                    try:
                        audio_data.append(q.get(timeout=0.1))
                    except queue.Empty:
                        pass
        except Exception as e:
            print(f"ERROR in record loop: {e}", file=sys.stderr)

    t = None

    while True:
        line = sys.stdin.readline()
        if not line:
            break
        
        cmd = line.strip()
        if cmd == "START":
            # Start recording
            audio_data = []
            while not q.empty():
                try:
                    q.get_nowait()
                except queue.Empty:
                    break
            
            stop_event.clear()
            t = threading.Thread(target=record_loop)
            t.start()
            print("STARTED", flush=True)
            
        elif cmd == "STOP":
            if t is not None and t.is_alive():
                stop_event.set()
                t.join(timeout=5)
                t = None
            
            print("Transcribing...", file=sys.stderr, flush=True)
            if not audio_data:
                print("No audio data", file=sys.stderr, flush=True)
                print("RESULT:", flush=True)
                continue
                
            print(f"Audio chunks: {len(audio_data)}", file=sys.stderr, flush=True)
            try:
                audio_np = np.concatenate(audio_data, axis=0).flatten().astype(np.float32)
            except Exception as e:
                print(f"ERROR concatenating audio: {e}", file=sys.stderr, flush=True)
                print("RESULT:", flush=True)
                continue
                
            print(f"Audio length: {len(audio_np)} samples ({len(audio_np)/samplerate:.1f}s at {samplerate}Hz)", file=sys.stderr, flush=True)
            
            max_val = float(np.max(np.abs(audio_np)))
            print(f"Audio max absolute level: {max_val:.4f}", file=sys.stderr, flush=True)
            
            if max_val < 0.0001:
                print("Audio level too low - possibly no microphone input", file=sys.stderr, flush=True)
                print("RESULT:", flush=True)
                continue
            
            if 0.0001 < max_val < 0.5:
                print("Normalizing audio volume...", file=sys.stderr, flush=True)
                audio_np = audio_np / max_val

            print("Starting transcribe...", file=sys.stderr, flush=True)
            try:
                segments, info = model.transcribe(
                    audio_np,
                    beam_size=5,
                    language="en",
                    vad_filter=True,
                    vad_parameters={"min_silence_duration_ms": 500},
                    condition_on_previous_text=False,
                )
                print(f"Language: {info.language}, prob: {info.language_probability:.2f}", file=sys.stderr, flush=True)
                
                texts = []
                for segment in segments:
                    print(f"Segment: {segment.text}", file=sys.stderr, flush=True)
                    texts.append(segment.text)
                transcript = " ".join(texts).strip()
                print("RESULT:" + transcript, flush=True)
            except Exception as e:
                print("ERROR: " + str(e), file=sys.stderr, flush=True)
                print("RESULT:", flush=True)


if __name__ == "__main__":
    import json
    main()
