const express = require('express');
const multer = require('multer');
const path = require('path');
const dotenv = require('dotenv');
const fs = require('fs');

const pdfParse = require("pdf-parse");
const mammoth = require("mammoth");
const { transcribeAudio, generateSpeech } = require('./services/aiService');

dotenv.config();
const app = express();

// =============================
// CONFIG
// =============================
const UPLOADS_DIR = path.join(__dirname, '../uploads');
const FRONTEND_DIR = path.join(__dirname, '../frontend');
const PORT = process.env.PORT || 3000;

// =============================
// INIT DIRS
// =============================
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// =============================
// MIDDLEWARE
// =============================
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(FRONTEND_DIR));
app.use('/uploads', express.static(UPLOADS_DIR));

// =============================
// MULTER CONFIG
// =============================
const storage = multer.diskStorage({
    destination: (_, __, cb) => cb(null, UPLOADS_DIR),
    filename: (_, file, cb) => {
        const safeName = file.originalname.replace(/\s+/g, '_');
        cb(null, `${Date.now()}-${safeName}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 25 * 1024 * 1024 }
});

// =============================
// STT ROUTE
// =============================
app.post('/transcribe', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ ok: false, error: 'No file uploaded' });
        }

        const text = await transcribeAudio(req.file.path);

        res.json({ ok: true, text });

    } catch (err) {
        console.error("STT Route Error:", err.message);
        res.status(500).json({ ok: false, error: 'STT failed' });
    }
});

// =============================
// TTS ROUTE
// =============================
app.post('/speak', async (req, res) => {
    try {
        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ ok: false, error: 'Text required' });
        }

        const fileName = await generateSpeech(text);

        res.json({
            ok: true,
            audioUrl: `/uploads/${fileName}`
        });

    } catch (err) {
        console.error("TTS Route Error:", err.message);
        res.status(500).json({ ok: false, error: 'TTS failed' });
    }
});

// =============================
// FILE UPLOAD ROUTE
// =============================
app.post('/upload-file', upload.single('file'), async (req, res) => {

    if (!req.file) {
        return res.json({ ok: false, error: "لا يوجد ملف" });
    }

    const ext = path.extname(req.file.originalname).toLowerCase();
    let content = "";

    try {

        // 📄 ملفات نصية
        const textTypes = [
            '.txt','.md','.js','.json','.html','.css','.csv',
            '.xml','.py','.java','.c','.cpp','.ts','.jsx','.tsx'
        ];

        if (textTypes.includes(ext)) {
            content = fs.readFileSync(req.file.path, "utf8");
        }

        // 📕 PDF
        else if (ext === '.pdf') {
            const dataBuffer = fs.readFileSync(req.file.path);
            const pdfData = await pdfParse(dataBuffer);
            content = pdfData.text;
        }

        // 📘 DOCX
        else if (ext === '.docx') {
            const result = await mammoth.extractRawText({ path: req.file.path });
            content = result.value;
        }

     
        else {
            fs.unlinkSync(req.file.path);
            return res.json({ ok: false, error: "نوع الملف غير مدعوم" });
        }

        fs.unlinkSync(req.file.path);

        res.json({ ok: true, content });

    } catch (err) {
        console.error(err);
        res.json({ ok: false, error: "فشل تحليل الملف" });
    }
});
// =============================
// AUTO CLEANUP
// =============================
const MAX_AGE_HOURS = 6;

setInterval(() => {
    const now = Date.now();

    fs.readdir(UPLOADS_DIR, (err, files) => {
        if (err) return;

        files.forEach(file => {
            const filePath = path.join(UPLOADS_DIR, file);

            fs.stat(filePath, (err, stat) => {
                if (err) return;

                const age = (now - stat.mtimeMs) / (1000 * 60 * 60);
                if (age > MAX_AGE_HOURS) {
                    fs.unlink(filePath, () => {});
                }
            });
        });
    });
}, 30 * 60 * 1000);
// =============================
// CHAT ROUTE
// =============================
const { getChatResponse } = require('./services/aiService');

app.post("/chat", async (req, res) => {

    const {
        message,
        history = [],
        visionContext = null
    } = req.body;

    try {

        const reply = await getChatResponse(
            message,
            Array.isArray(history) ? history : [],
            visionContext
        );

        res.json({ ok: true, reply });

    } catch (err) {
        console.error("Chat Route Error:", err);
        res.status(500).json({
            ok: false,
            error: err.message
        });
    }
});
// =============================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Basira Server running → http://localhost:${PORT}`);
});