import { useState } from 'react';

export default function BatchProcessing() {
  const [jobIds, setJobIds] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<any[]>([]);

  const handleBatchProcess = async () => {
    const ids = jobIds.split(',').map(id => id.trim()).filter(id => id);
    if (ids.length === 0) {
      setMessage('❌ Введите хотя бы один jobId');
      return;
    }

    setLoading(true);
    setMessage('');
    setResults([]);

    try {
      const response = await fetch('http://localhost:8000/api/batch-separate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobIds: ids }),
      });

      const data = await response.json();
      if (data.success) {
        setResults(data.results);
        setMessage(`✅ Обработано файлов: ${data.results.filter((r: any) => r.success).length}`);
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
          📦
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Batch Processing</h3>
          <p className="text-sm text-gray-400">Параллельная обработка нескольких файлов</p>
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Job IDs (через запятую)
        </label>
        <textarea
          value={jobIds}
          onChange={(e) => setJobIds(e.target.value)}
          placeholder="job-id-1, job-id-2, job-id-3"
          className="input-premium min-h-[80px] resize-y"
        />
        <p className="text-xs text-gray-500 mt-1">Введите jobId файлов, разделённые запятыми</p>
      </div>

      <button
        onClick={handleBatchProcess}
        disabled={loading || !jobIds}
        className="btn-premium w-full disabled:opacity-50"
      >
        {loading ? '⏳ Обработка...' : '📦 Запустить Batch Processing'}
      </button>

      {message && (
        <p className={`text-sm text-center mt-4 ${message.includes('✅') ? 'text-green-400' : 'text-red-400'}`}>
          {message}
        </p>
      )}

      {results.length > 0 && (
        <div className="mt-6 space-y-3">
          <h4 className="font-semibold text-white">Результаты:</h4>
          {results.map((r, idx) => (
            <div key={idx} className="p-3 bg-white/5 rounded-lg text-sm">
              {r.success ? (
                <div className="text-green-400">
                  ✅ {r.jobId} — <a href={r.vocals} className="underline">Vocals</a> | <a href={r.instrumental} className="underline">Instrumental</a>
                </div>
              ) : (
                <div className="text-red-400">❌ {r.jobId}: {r.error}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 p-4 bg-white/5 rounded-lg">
        <h4 className="font-semibold text-white mb-2">ℹ️ О функции</h4>
        <ul className="text-xs text-gray-400 space-y-1 list-disc list-inside">
          <li>Обработка нескольких файлов параллельно (Promise.all)</li>
          <li>Каждый файл обрабатывается независимо</li>
          <li>Результаты выводятся для всех файлов сразу</li>
          <li>Используется та же модель, что и для обычного разделения</li>
        </ul>
      </div>
    </div>
  );
}
