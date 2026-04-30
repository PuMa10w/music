#!/usr/bin/env python3
"""
Download song from URL (YouTube, SoundCloud, etc.) using yt-dlp
"""
import sys
import os
import json
import subprocess
import tempfile

def download_audio(url, output_dir):
    """
    Download audio from URL to output_dir.
    Returns: { 'success': True, 'filename': ..., 'path': ... } or { 'error': ... }
    """
    try:
        # Check if yt-dlp is installed
        try:
            subprocess.run(['yt-dlp', '--version'], capture_output=True, check=True)
        except (subprocess.CalledProcessError, FileNotFoundError):
            return {"error": "yt-dlp not installed. Install it with: pip install yt-dlp"}

        # Create temp file path
        temp_dir = tempfile.mkdtemp(dir=output_dir)
        output_template = os.path.join(temp_dir, '%(title)s.%(ext)s')

        # Run yt-dlp
        cmd = [
            'yt-dlp',
            '-x',  # Extract audio
            '--audio-format', 'wav',
            '--audio-quality', '0',
            '-o', output_template,
            url
        ]
        
        result = subprocess.run(cmd, capture_output=True, text=True)
        
        if result.returncode != 0:
            return {"error": f"yt-dlp failed: {result.stderr}"}

        # Find downloaded file
        files = [f for f in os.listdir(temp_dir) if f.endswith('.wav')]
        if not files:
            return {"error": "No WAV file found after download"}

        downloaded_file = os.path.join(temp_dir, files[0])
        return {"success": True, "filename": files[0], "path": downloaded_file}

    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "Usage: python download_song.py <url> <output_dir>"}))
        sys.exit(1)
    
    url = sys.argv[1]
    output_dir = sys.argv[2]
    
    result = download_audio(url, output_dir)
    print(json.dumps(result))
