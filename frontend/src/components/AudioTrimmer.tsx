import { useState } from 'react';
import { useStore } from '../stores/useStore';

export default function AudioTrimmer() {
  const currentJobId = useStore(s => s.currentJobId);
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(60);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleTrim = async () => {
    if (!currentJobId) {
      setMessage('❌ Сначала обработайте файл');
      return;
    }
    if (startTime < 0 || endTime <= startTime) {
      setMessage('❌ Неверное время начала/конца');
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    try {
      const response = await fetch(`http://localhost:8000/api/trim/${currentJobId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start: startTime, end: endTime }),
      });
      
      const data = await response.json();
      if (data.success) {
        setMessage(`✅ Аудио обрезано: ${startTime}с - ${endTime}с`);
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
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center text-xl">
          ✂️
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Audio Trimmer</h3>
          <p className="text-sm text-gray-400">Обрезка аудио по времени</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Начало (секунды)</label>
          <input
            type="number"
            min="0"
            value={startTime}
            onChange={(e) => setStartTime(Number(e.target.value))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Конец (секунды)</label>
          <input
            type="number"
            min="0"
            value={endTime}
            onChange={(e) => setEndTime(Number(e.target.value))}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => { setStartTime(0); setEndTime(30); }} className="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition">0-30с</button>
        <button onClick={() => { setStartTime(30); setEndTime(60); }} className="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition">30-60с</button>
        <button onClick={() => { setStartTime(0); setEndTime(120); }} className="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition">0-120с</button>
        <button onClick={() => { setStartTime(0); setEndTime(300); }} className="px-3 py-1 text-xs rounded-lg bg-white/10 hover:bg-white/20 transition">0-300с</button>
      </div>

      <button
        onClick={handleTrim}
        disabled={loading || !currentJobId}
        className="btn-premium w-full disabled:opacity-50"
      >
        {loading ? '⏳ Обрезка...' : '✂️ Обрезать аудио'}
      </button>

      {message && (
        <p className={`text-sm text-center mt-4 ${message.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}
    </div>
  );
}
