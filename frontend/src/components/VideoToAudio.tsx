import { useState } from 'react';
import { useStore } from '../stores/useStore';

export default function VideoToAudio() {
  const currentJobId = useStore(s => s.currentJobId);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setVideoFile(e.target.files[0]);
    }
  };

  const handleExtractAudio = async () => {
    if (!currentJobId) {
      setMessage('❌ Сначала создайте задание (загрузите файл)');
      return;
    }
    if (!videoFile) {
      setMessage('❌ Выберите видео файл');
      return;
    }

    setLoading(true);
    setMessage('');

    const formData = new FormData();
    formData.append('video', videoFile);

    try {
      const response = await fetch(`http://localhost:8000/api/video-to-audio/${currentJobId}`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Аудио извлечено: ${data.file}!`);
      } else {
        setMessage(`❌ Ошибка: ${data.error}`);
      }
    } catch (e: any) {
      setMessage(`❌ Ошибка: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-premium rounded-2xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center text-xl">
          🎬
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Video to Audio</h3>
          <p className="text-sm text-gray-400">Извлечение аудио из видео файлов</p>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Видео файл (MP4, WebM, AVI, MOV)
        </label>
        <input
          type="file"
          accept="video/*,.mp4,.webm,.avi,.mov,.mkv"
          onChange={handleFileChange}
          className="input-premium"
        />
        {videoFile && (
          <p className="text-xs text-gray-400 mt-2">Выбрано: {videoFile.name}</p>
        )}
      </div>

      <button
        onClick={handleExtractAudio}
        disabled={loading || !currentJobId || !videoFile}
        className="btn-premium w-full disabled:opacity-50"
      >
        {loading ? '⏳ Извлечение...' : '🎬 Извлечь аудио из видео'}
      </button>

      {message && (
        <p className={`text-sm text-center mt-4 ${message.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}

      <div className="mt-6 p-4 bg-white/5 rounded-lg">
        <h4 className="font-semibold text-white mb-2">ℹ️ О функции</h4>
        <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
          <li>Поддерживаемые форматы: MP4, WebM, AVI, MOV, MKV</li>
          <li>Аудио извлекается в формате WAV (44.1kHz, Stereo)</li>
          <li>Используется FFmpeg для извлечения (-vn флаг)</li>
          <li>После извлечения файл можно обработать (Voice Remover)</li>
        </ul>
      </div>
    </div>
  );
}
