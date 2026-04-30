#!/usr/bin/env python3
import sys
import whisper

def transcribe_audio(audio_path, output_txt):
    """Transcribe audio file using Whisper and save segments to text file."""
    model = whisper.load_model("base")
    result = model.transcribe(audio_path)
    with open(output_txt, 'w', encoding='utf-8') as f:
        for segment in result['segments']:
            f.write(segment['text'] + '\n')

if __name__ == '__main__':
    if len(sys.argv) != 3:
        print("Usage: python transcribe.py <audio_path> <output_txt>")
        sys.exit(1)
    transcribe_audio(sys.argv[1], sys.argv[2])
