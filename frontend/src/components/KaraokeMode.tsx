import { useState, useRef, useEffect } from 'react';
import { useStore } from '../stores/useStore';

export default function KaraokeMode() {
  const currentJobId = useStore(s => s.currentJobId);
  const [lyrics, setLyrics] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [artist, setArtist] = useState('');
  const [title, setTitle] = useState('');
  const [pitch, setPitch] = useState<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Pitch detection using Web Audio API
  const startPitchDetection = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      
      source.connect(analyser);
      
      const detectPitch = () => {
        if (!analyserRef.current || !audioContextRef.current) return;
        
        const buffer = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(buffer);
        
        // Simplified pitch detection (find dominant frequency)
        let maxIndex = 0;
        let maxValue = 0;
        for (let i = 0; i < buffer.length; i++) {
          if (buffer[i] > maxValue) {
            maxValue = buffer[i];
            maxIndex = i;
          }
        }
        
        const frequency = maxIndex * audioContextRef.current.sampleRate / analyserRef.current.fftSize;
        if (frequency > 50 && frequency < 2000) {
          setPitch(Math.round(frequency * 10) / 10);
        }
        
        if (isRecording) {
          requestAnimationFrame(detectPitch);
        }
      };
      
      setIsRecording(true);
      detectPitch();
      
    } catch (error) {
      console.error('Error accessing microphone:', error);
    }
  };

  const stopPitchDetection = () => {
    setIsRecording(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: any) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  // Search lyrics using lyrics.ovh API (free)
  const searchLyrics = async () => {
    if (!artist || !title) {
      setLyrics('❌ Введите исполнителя и название');
      return;
    }

    setLoading(true);
    setLyrics('');

    try {
      // Using lyrics.ovh API (free, no key required)
      const response = await fetch(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
      );
      
      if (!response.ok) {
        throw new Error('Lyrics not found');
      }
      
      const data = await response.json();
      
      if (data.lyrics) {
        setLyrics(data.lyrics);
      } else {
        setLyrics('❌ Текст песни не найден');
      }
    } catch (error) {
      console.error('Lyrics search error:', error);
      // Fallback: try another API or show error
      setLyrics('❌ Ошибка поиска текста. Попробуйте другой запрос.');
    } finally {
      setLoading(false);
    }
  };

  // Generate karaoke from current job
  const generateKaraoke = async () => {
    if (!currentJobId) {
      setLyrics('❌ Сначала обработайте трек');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`http://localhost:8000/api/karaoke/${currentJobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoFile: 'output.mp4', // Assuming you have video
          lyricsFile: 'lyrics.txt'
        })
      });
      
      const data = await response.json();
      if (data.success) {
        setLyrics(`✅ Karaoke video generated! File: ${data.file}`);
      } else {
        setLyrics(`❌ Ошибка: ${data.error}`);
      }
    } catch (error: any) {
      setLyrics(`❌ Ошибка: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPitchDetection();
    };
  }, []);

  return (
    <div className="glass-premium rounded-2xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-red-500 flex items-center justify-center text-xl">
          🎤
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Karaoke Mode</h3>
          <p className="text-sm text-gray-400">Pitch detection & Lyrics search</p>
        </div>
      </div>

      {/* Pitch Detection */}
      <div className="mb-6 p-4 bg-white/5 rounded-xl">
        <h4 className="font-semibold text-white mb-3">🎵 Pitch Detection</h4>
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={isRecording ? stopPitchDetection : startPitchDetection}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              isRecording 
                ? 'bg-red-500/30 text-red-300 border border-red-500/50' 
                : 'bg-green-500/30 text-green-300 border border-green-500/50 hover:bg-green-500/50'
            }`}
          >
            {isRecording ? '⏹ Stop' : '⏺ Start'} Recording
          </button>
          {pitch !== null && (
            <div className="text-2xl font-bold gradient-text">
              {pitch} Hz
            </div>
          )}
        </div>
        {isRecording && (
          <p className="text-xs text-gray-400">
            🎙️ Recording... Sing something!
          </p>
        )}
      </div>

      {/* Lyrics Search */}
      <div className="mb-6">
        <h4 className="font-semibold text-white mb-3">📝 Lyrics Search</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          <input
            type="text"
            placeholder="Artist (e.g. Queen)"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            className="input-premium"
          />
          <input
            type="text"
            placeholder="Title (e.g. Bohemian Rhapsody)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input-premium"
          />
        </div>
        <button
          onClick={searchLyrics}
          disabled={loading || !artist || !title}
          className="btn-premium w-full disabled:opacity-50"
        >
          {loading ? '⏳ Searching...' : '🔍 Search Lyrics (lyrics.ovh)'}
        </button>
      </div>

      {/* Lyrics Display */}
      {lyrics && (
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <h4 className="font-semibold text-white">📃 Lyrics</h4>
            <button
              onClick={() => { setLyrics(''); setArtist(''); setTitle(''); }}
              className="text-xs text-gray-400 hover:text-white"
            >
              Clear
            </button>
          </div>
          <div className="p-4 bg-white/5 rounded-xl max-h-64 overflow-y-auto">
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans">
              {lyrics}
            </pre>
          </div>
        </div>
      )}

      {/* Generate Karaoke Video */}
      {currentJobId && (
        <div className="pt-4 border-t border-white/10">
          <button
            onClick={generateKaraoke}
            disabled={loading}
            className="w-full px-4 py-3 rounded-xl bg-gradient-to-r from-pink-600 to-red-600 text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? '⏳ Generating...' : '🎬 Generate Karaoke Video'}
          </button>
        </div>
      )}

      <div className="mt-6 p-4 bg-white/5 rounded-lg">
        <h4 className="font-semibold text-white mb-2">ℹ️ About Karaoke Mode</h4>
        <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
          <li><strong>Pitch Detection</strong> — использует Web Audio API для определения высоты тона</li>
          <li><strong>Lyrics Search</strong> — бесплатный API lyrics.ovh (не требует ключа)</li>
          <li><strong>Karaoke Video</strong> — генерирует видео с текстом поверх инструментала</li>
          <li>Для записи голоса разрешите доступ к микрофону в браузере</li>
        </ul>
      </div>
    </div>
  );
}
