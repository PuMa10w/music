import re

file_path = '/home/rousl/workspace/music/music/server.js'

with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Ищем начало блока "ЗАПУСК" или "server.listen"
end_marker = None
for i in range(len(lines) - 1, -1, -1):
    if 'server.listen' in lines[i]:
        end_marker = i
        break

if end_marker:
    # Оставляем всё до server.listen включительно, но убираем мусор после закрывающей скобки
    # Находим строку с "});" после server.listen
    closing_brace_idx = None
    for j in range(end_marker, len(lines)):
        if '});' in lines[j]:
            closing_brace_idx = j
            break
    
    if closing_brace_idx:
        # Берем строки до закрывающей скобки и саму скобку
        content = ''.join(lines[:closing_brace_idx + 1])
        
        # Добавляем статус и скачивание перед server.listen
        # Но они уже должны быть... Хмм, лучше перезапишем чистый конец
        pass

# Простой вариант: перезаписать последние 50 строк нормальным кодом
# Читаем весь файл как одну строку
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Удаляем всё после последнего "});" которое закрывает server.listen
# Найдем последний правильный блок
pattern = r"(// ===== ЗАПУСК =====\n\nserver\.listen\(PORT, \(\) => \{\n.*?\}\);)"
match = re.search(pattern, content, re.DOTALL)

if match:
    # Берем всё до этого блока + сам блок
    pre_content = content[:match.start()]
    # Добавляем статус и скачивание, если их нет
    if 'app.get(\'/api/status' not in pre_content:
        pre_content += """
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

"""
    final_content = pre_content + match.group(0)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(final_content)
    print("File fixed successfully!")
else:
    print("Could not find server.listen block")
