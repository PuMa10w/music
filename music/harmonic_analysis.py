#!/usr/bin/env python3
import sys
import json
import librosa
import numpy as np

def analyze_harmonic(audio_path):
    y, sr = librosa.load(audio_path, sr=None)
    
    # Detect key using chroma features
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key_index = np.argmax(np.sum(chroma, axis=1))
    keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    key = keys[key_index]
    
    # Simplified mode detection (major/minor)
    # Compare major and minor key profiles
    major_profile = np.array([1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 0, 1])  # Major scale intervals
    minor_profile = np.array([1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0])  # Minor scale intervals
    
    major_corr = np.corrcoef(np.sum(chroma, axis=1), major_profile)[0, 1]
    minor_corr = np.corrcoef(np.sum(chroma, axis=1), minor_profile)[0, 1]
    mode = 'major' if major_corr > minor_corr else 'minor'
    
    # Detect tempo
    tempo = librosa.beat.tempo(y=y, sr=sr)[0]
    
    result = {
        'key': key,
        'mode': mode,
        'tempo': float(tempo),
        'time_signature': '4/4'  # Placeholder for future implementation
    }
    
    print(json.dumps(result))

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Missing audio path argument'}))
        sys.exit(1)
    analyze_harmonic(sys.argv[1])
