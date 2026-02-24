const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const Groq = require('groq-sdk');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

/* =======================================================
   MEMORY OPTIMIZATION + TOKEN PROTECTION
======================================================= */

function optimizeHistory(history = []) {
    return history
        .slice(-12)
        .map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: String(msg.content || '').slice(0, 1200)
        }));
}

/* =======================================================
   STT - Whisper Large v3
======================================================= */

async function transcribeAudio(filePath) {
    try {
        if (!fs.existsSync(filePath))
            throw new Error("Audio file not found");

        const result = await groq.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: 'whisper-large-v3',
            language: 'ar'
        });

        return result.text;

    } catch (error) {
        console.error('❌ STT Error:', error.message);
        throw error;

    } finally {
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    }
}

/* =======================================================
   CHAT ENGINE - WITH VISION CONTEXT SUPPORT
======================================================= */

async function getChatResponse(message, history = [], visionContext = null) {

    try {

        const safeMessage = String(message || '').slice(0, 1500);

        const systemPrompt = `
أنت مساعد ذكي عربي باسم "بصيرة".
قدم ردود واضحة ومفيدة.
إذا وُجد وصف لصورة سابقة فاستخدمه للإجابة بدقة.
`;

        const optimizedHistory = optimizeHistory(history);

        const messages = [
            { role: "system", content: systemPrompt }
        ];

        if (visionContext) {
            messages.push({
                role: "system",
                content: `وصف صورة سابقة:\n${String(visionContext).slice(0, 2000)}`
            });
        }

        messages.push(...optimizedHistory);
        messages.push({ role: "user", content: safeMessage });

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages,
            temperature: 0.7,
        });

        return completion.choices[0]?.message?.content
            || "لم أستطع فهم ذلك، حاول مرة أخرى.";

    } catch (error) {
        console.error('❌ Groq Error:', error.message);
        return "حدث خطأ أثناء معالجة الرد.";
    }
}

/* =======================================================
   TTS - Edge TTS
======================================================= */

async function generateSpeech(text) {

    return new Promise((resolve, reject) => {

        const fileName = `speech-${Date.now()}.mp3`;
        const outputPath = path.join(__dirname, '../../uploads', fileName);

        const cleanText = String(text || '')
            .replace(/[#*_~`]/g, '')
            .trim()
            .slice(0, 1200);

        const args = [
            '--voice', 'ar-EG-ShakirNeural',
            '--text', cleanText,
            '--rate=-5%',
            '--pitch=+0Hz',
            '--write-media', outputPath
        ];

        execFile('edge-tts', args, (error, _, stderr) => {
            if (error) {
                console.error('❌ TTS Error:', stderr);
                return reject(error);
            }
            resolve(fileName);
        });
    });
}

module.exports = {
    transcribeAudio,
    getChatResponse,
    generateSpeech
};