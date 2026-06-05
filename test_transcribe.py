#!/usr/bin/env python3
"""Test transcription speed with real audio."""
import sys
import os
import time
import numpy as np
import sounddevice as sd
from faster_whisper import WhisperModel

print("Loading model...", flush=True)
t0 = time.time()
model = WhisperModel("small", device="cpu", compute_type="int8")
print(f"Model loaded in {time.time()-t0:.1f}s", flush=True)

# Record 3 seconds of audio
print("Recording 3 seconds of audio...", flush=True)
duration = 3
sample_rate = 16000
audio = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1, dtype='float32')
sd.wait()
print(f"Recorded {len(audio)} samples", flush=True)

# Transcribe
print("Transcribing...", flush=True)
t0 = time.time()
audio_flat = audio.flatten()
segments, info = model.transcribe(audio_flat, beam_size=5, language="en", vad_filter=True)
text = " ".join([seg.text for seg in segments])
elapsed = time.time() - t0
print(f"Transcription took {elapsed:.1f}s", flush=True)
print(f"Text: {text}", flush=True)
print(f"RESULT:{text}", flush=True)