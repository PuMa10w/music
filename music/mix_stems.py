#!/usr/bin/env python3
"""
Mix stems with adjustable vocal removal level.
Usage: python mix_stems.py <instrumental> <vocals> <output> <vocal_level>
vocal_level: 0.0 (full vocals) to 1.0 (full removal)
"""
import sys
import os
from pydub import AudioSegment

def mix_stems(instrumental_path, vocals_path, output_path, vocal_level=1.0):
    # Load audio
    instrumental = AudioSegment.from_file(instrumental_path)
    vocals = AudioSegment.from_file(vocals_path)
    
    # Adjust vocal volume based on level (lower level = quieter vocals)
    # vocal_level=1.0 means vocals at full volume (no removal)
    # vocal_level=0.0 means vocals silenced
    vocal_gain_db = (vocal_level - 1.0) * 60  # -60dB when level=0
    adjusted_vocals = vocals + vocal_gain_db
    
    # Mix: instrumental + adjusted vocals
    mixed = instrumental.overlay(adjusted_vocals)
    
    # Export
    mixed.export(output_path, format="wav")
    print(f"Mixed: {output_path} (vocal_level={vocal_level})")

if __name__ == '__main__':
    if len(sys.argv) < 5:
        print("Usage: python mix_stems.py <instrumental> <vocals> <output> <vocal_level>")
        sys.exit(1)
    
    instrumental_path = sys.argv[1]
    vocals_path = sys.argv[2]
    output_path = sys.argv[3]
    vocal_level = float(sys.argv[4])
    
    mix_stems(instrumental_path, vocals_path, output_path, vocal_level)
