import sys
import queue
import threading
import sounddevice as sd
import numpy as np
from faster_whisper import WhisperModel
import json

def get_devices():
    devices = sd.query_devices()
    return [{"index": d["index"], "name": d["name"], "max_input_channels": d["max_input_channels"]} for d in devices if d["max_input_channels"] > 0]

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--list-devices":
        print(json.dumps(get_devices()))
        sys.exit(0)

    device_index = int(sys.argv[1]) if len(sys.argv) > 1 else None

    # Load model once on startup
    print("Loading model...", file=sys.stderr)
    model = WhisperModel("small", device="cpu", compute_type="int8")
    print("Model loaded.", file=sys.stderr)

    # Signal ready to node
    print("READY", flush=True)

    samplerate = 16000
    channels = 1
    
    stop_event = threading.Event()
    q = queue.Queue()
    audio_data = []
    
    def callback(indata, frames, time, status):
        if status:
            print(status, file=sys.stderr)
        q.put(indata.copy())

    def record_loop():
        with sd.InputStream(samplerate=samplerate, channels=channels, device=device_index, callback=callback):
            while not stop_event.is_set():
                try:
                    audio_data.append(q.get(timeout=0.1))
                except queue.Empty:
                    pass

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
                t.join()
                t = None
            
            print("Transcribing...", file=sys.stderr, flush=True)
            if not audio_data:
                print("No audio data", file=sys.stderr, flush=True)
                print("RESULT:", flush=True)
                continue
                
            print(f"Audio chunks: {len(audio_data)}", file=sys.stderr, flush=True)
            audio_np = np.concatenate(audio_data, axis=0).flatten().astype(np.float32)
            print(f"Audio length: {len(audio_np)} samples ({len(audio_np)/samplerate:.1f}s at {samplerate}Hz)", file=sys.stderr, flush=True)
            
            max_val = float(np.max(np.abs(audio_np)))
            print(f"Audio max absolute level: {max_val:.4f}", file=sys.stderr, flush=True)
            
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