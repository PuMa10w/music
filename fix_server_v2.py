import re

file_path = '/home/rousl/workspace/music/music/server.js'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Разделяем файл: всё до Denoise (включительно) и всё после
denoise_marker = "// ===== DENOISE ENDPOINT ====="
denoise_idx = content.find(denoise_marker)

if denoise_idx == -1:
    print("Error: Denoise marker not found")
    exit(1)

# Берем всё до начала блока запуска (чтобы убрать мусор)
# Найдем начало блока "ЗАПУСК" или "server.listen"
launch_marker = "// ===== ЗАПУСК ====="
launch_idx = content.find(launch_marker)

if launch_idx == -1:
    print("Error: Launch marker not found")
    exit(1)

# Берем контент строго до маркера запуска
pre_launch_content = content[:launch_idx]

# Формируем чистый конец файла
clean_end = """
// ===== DENOISE ENDPOINT =====
app.post('/api/denoise/:jobId', validateJobId, validateJobDir, async (req, res) => {
    const jobId = req.params.jobId;
    const jobDir = path.join(UPLOAD_DIR, jobId);
    const { strength = 0.5, stem = 'vocals' } = req.body;

    try {
        const targetFile = path.join(jobDir, `${stem}.wav`);
        if (!fs.existsSync(targetFile)) {
            return res.status(404).json({ error: `File ${stem}.wav not found` });
        }

        const outputFile = path.join(jobDir, `${stem}_denoised.wav`);
        const scriptPath = path.join(__dirname, 'denoise.py');
        
        await runPythonScript(scriptPath, [targetFile, outputFile, String(strength)]);
        
        res.json({ success: true, file: `${stem}_denoised.wav`, path: outputFile });
    } catch (error) {
        console.error('[Denoise Error]', error);
        res.status(500).json({ error: 'Denoise failed', details: error.message });
    }
});

// ===== STATUS & DOWNLOAD API =====

app.get('/api/status/:jobId', (req, res) => {
    const { jobId } = req.params;
    if (activeJobs.has(jobId)) return res.json(activeJobs.get(jobId));
    const jobDir = path.join(OUTPUT_DIR, jobId);
    if (fs.existsSync(jobDir)) {
        const files = fs.readdirSync(jobDir).filter(f => f.endsWith('.wav'));
        if (files.length > 0) return res.json({ status: 'completed', jobId, files });
    }
    res.json({ status: 'not_found' });
});

app.get('/api/download/:jobId/:filename', (req, res) => {
    const { jobId, filename } = req.params;
    const safeFilename = path.basename(filename);
    if (!/^[a-zA-Z0-9_\\-.]+\\.wav$/.test(safeFilename)) return res.status(400).json({ error: 'Invalid filename' });
    const filePath = path.join(OUTPUT_DIR, jobId, safeFilename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
    res.download(filePath);
});

// ===== ЗАПУСК =====
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`🔌 WebSocket ready on ws://localhost:${PORT}`);
    console.log(`🎵 Voice Remover Pro v5.0 - ALL MODELS`);
    console.log(`📊 Models: fully local Demucs-family catalog`);
});
"""

# Склеиваем
new_content = pre_launch_content + clean_end

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("server.js has been rebuilt successfully!")
