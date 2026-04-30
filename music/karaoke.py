#!/usr/bin/env python3
"""
Karaoke video generator.
Overlays lyrics on video with basic timing.
Usage: python karaoke.py <input_video> <lyrics_file> <output_video> [duration_per_line]
"""
import sys
import os
import json

def create_karaoke(input_video, lyrics_file, output_video, duration_per_line=5):
    try:
        if not os.path.exists(input_video):
            return {"error": f"Video not found: {input_video}"}
        if not os.path.exists(lyrics_file):
            return {"error": f"Lyrics file not found: {lyrics_file}"}

        # Read lyrics
        with open(lyrics_file, 'r', encoding='utf-8') as f:
            lyrics = f.read().strip().split('\n')

        # Build ffmpeg filter for drawtext
        # This is a simplified version: shows each line for duration_per_line seconds
        filter_complex = []
        start_time = 0
        for i, line in enumerate(lyrics):
            escaped_line = line.replace("'", "'").replace(":", "\\:")
            filter_complex.append(
                f"drawtext=text='{escaped_line}':fontsize=48:fontcolor=white:x=(w-text_w)/2:y=h-100:enable='between(t,{start_time},{start_time+duration_per_line})'"
            )
            start_time += duration_per_line

        filter_string = ','.join(filter_complex)

        cmd = [
            'ffmpeg', '-y',
            '-i', input_video,
            '-vf', filter_string,
            '-c:a', 'copy',
            output_video
        ]

        import subprocess
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            return {"error": f"ffmpeg failed: {result.stderr}"}

        return {"success": True, "output": output_video}

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print(json.dumps({"error": "Usage: python karaoke.py <video> <lyrics> <output> [duration]"}))
        sys.exit(1)

    video = sys.argv[1]
    lyrics = sys.argv[2]
    output = sys.argv[3]
    duration = float(sys.argv[4]) if len(sys.argv) > 4 else 5

    result = create_karaoke(video, lyrics, output, duration)
    print(json.dumps(result))
