#!/usr/bin/env python3
import sys
import os
import zipfile
from pathlib import Path

def create_zip(job_dir, zip_path):
    """Create a ZIP file from all files in job output directory."""
    job_path = Path(job_dir)
    if not job_path.exists():
        print(f"Error: Job directory {job_dir} not found", file=sys.stderr)
        sys.exit(1)
    
    # Find all audio files (wav, mp3, etc.) and JSON files
    files_to_zip = []
    for ext in ['*.wav', '*.mp3', '*.json', '*.txt']:
        files_to_zip.extend(job_path.glob(ext))
    
    if not files_to_zip:
        print(f"Error: No files found in {job_dir}", file=sys.stderr)
        sys.exit(1)
    
    # Create ZIP
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file in files_to_zip:
            # Use relative path inside ZIP (just filename, not full path)
            arcname = file.name
            zipf.write(file, arcname)
            print(f"Added: {arcname}")
    
    print(f"ZIP created: {zip_path}")
    return str(zip_path)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python zip_job.py <job_dir> <output_zip_path>", file=sys.stderr)
        sys.exit(1)
    
    job_dir = sys.argv[1]
    zip_path = sys.argv[2]
    create_zip(job_dir, zip_path)
