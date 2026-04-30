#!/usr/bin/env python3
"""
Replace audio track in video file using ffmpeg.
Usage: python replace_audio.py <input_video> <new_audio> <output_video>
"""
import sys
import os
import json
import subprocess

def replace_audio(video_path, audio_path, output_path):
    try:
        # Check if files exist
        if not os.path.exists(video_path):
            return {"error": f"Video file not found: {video_path}"}
        if not os.path.exists(audio_path):
            return {"error": f"Audio file not found: {audio_path}"}

        # ffmpeg command: replace audio, copy video stream
        cmd = [
            'ffmpeg', '-y',
            '-i', video_path,
            '-i', audio_path,
            '-c:v', 'copy',  # Copy video stream without re-encoding
            '-c:a', 'aac',  # Re-encode audio to AAC
            '-map', '0:v:0',  # Take video from first input
            '-map', '1:a:0',  # Take audio from second input
            '-shortest',  # Finish at shortest input
            output_path
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            return {"error": f"ffmpeg failed: {result.stderr}"}

        return {"success": True, "output": output_path}
    
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: python replace_audio.py <video> <audio> <output>"}))
        sys.exit(1)
    
    video = sys.argv[1]
    audio = sys.argv[2]
    output = sys.argv[3]
    
    result = replace_audio(video, audio, output)
    print(json.dumps(result))
