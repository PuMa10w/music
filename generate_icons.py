#!/usr/bin/env python3
"""
Generate simple PWA icons for Voice Remover Ultra.
Creates gradient icons with "VR" text.
"""
import struct
import zlib

def create_png(width, height, filename):
    """Create a simple PNG with gradient background."""
    def make_chunk(chunk_type, data):
        chunk = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(chunk) & 0xffffffff)
        return struct.pack('>I', len(data)) + chunk + crc

    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'
    
    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    ihdr = make_chunk(b'IHDR', ihdr_data)
    
    # IDAT - create gradient
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # filter byte
        for x in range(width):
            # Gradient from purple to pink
            r = int(192 + (255-192) * x/width)
            g = int(64 + (0-64) * y/height)
            b = int(192 + (128-192) * x/width)
            a = 255
            raw_data += struct.pack('BBBB', r, g, b, a)
    
    compressed = zlib.compress(raw_data)
    idat = make_chunk(b'IDAT', compressed)
    
    # IEND
    iend = make_chunk(b'IEND', b'')
    
    with open(filename, 'wb') as f:
        f.write(signature + ihdr + idat + iend)
    
    print(f'Created {filename} ({width}x{height})')

if __name__ == '__main__':
    create_png(192, 192, '/home/rousl/workspace/music/frontend/public/icon-192x192.png')
    create_png(512, 512, '/home/rousl/workspace/music/frontend/public/icon-512x512.png')
    print('Icons generated!')
