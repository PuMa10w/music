#!/usr/bin/env python3
import sys
import json
import whisper

def transcribe_audio(audio_path, output_json):
    """Transcribe audio file using Whisper with timestamps and save as JSON."""
    model = whisper.load_model("base")
    result = model.transcribe(audio_path, word_timestamps=True)
    
    segments = []
    for segment in result['segments']:
        segments.append({
            'start': segment['start'],
            'end': segment['end'],
            'text': segment['text'].strip()
        })
    
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(segments, f, ensure_ascii=False, indent=2)

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python transcribe.py <audio_path> <output_json>")
        sys.exit(1)
    transcribe_audio(sys.argv[1], sys.argv[2])
