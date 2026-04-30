#!/usr/bin/env python3
"""
Denoise audio file using noisereduce library.
Usage: python denoise.py <input_path> <output_path> [strength]
"""
import sys
import numpy as np
try:
    import soundfile as sf
    import noisereduce as nr
except ImportError as e:
    print(f"ERROR: Missing dependency - {e}. Install with: pip install noisereduce soundfile numpy", file=sys.stderr)
    sys.exit(1)

def reduce_noise(input_path, output_path, strength=0.5):
    try:
        data, rate = sf.read(input_path)
        print(f"[Denoise] Processing {input_path}... Strength: {strength}")
        
        # Apply noise reduction
        # prop_decrease controls how much noise to reduce (0.0 to 1.0)
        reduced_noise = nr.reduce_noise(y=data, sr=rate, prop_decrease=strength)
        
        sf.write(output_path, reduced_noise, rate)
        print(f"[Denoise] Success! Saved to {output_path}")
        return True
    except Exception as e:
        print(f"ERROR: {str(e)}", file=sys.stderr)
        return False

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python denoise.py <input> <output> [strength]")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    strength = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5
    
    success = reduce_noise(input_path, output_path, strength)
    sys.exit(0 if success else 1)
