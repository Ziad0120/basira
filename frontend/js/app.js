/* ======================================================
BASIRA GPT - FULL ORIGINAL BUILD + CAMERA EXTENSION
✔ No Feature Removed
✔ Blind Camera Voice Command
✔ No Base64 Memory Explosion
====================================================== */

let selectedFile = null;
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let analyser = null;
let silenceTimer = null;
let sourceNode = null;
let silenceThreshold = 12;
let silenceDelay = 1800;
let recordingStream = null;

/* ===== ORIGINAL VOICE STATE ===== */
let voiceState = "idle";
let emptyTranscriptCount = 0;
const MAX_EMPTY_TRANSCRIPTS = 2;

/* ===== NEW: Vision Memory (NO base64) ===== */
let lastVisionContext = null;

/* ====================================================== */

const ui = {
gate: document.getElementById("gate-scr"),
vision: document.getElementById("vision-scr"),
chat: document.getElementById("chat-ui"),
blind: document.getElementById("blind-ui"),
chatBody: document.getElementById("chat-body"),
input: document.getElementById("chat-input"),
sidebar: document.getElementById("chat-sidebar"),
chatList: document.getElementById("chat-list"),
filePreview: document.getElementById("file-preview-container"),
fileInput: document.getElementById("file-up"),
sendBtn: document.getElementById("send-btn"),
blindStatus: document.getElementById("blind-status"),
video: document.getElementById("video-feed")
};

const ChatStore = {
save: (data) => localStorage.setItem("basira_chats", JSON.stringify(data)),
load: () => JSON.parse(localStorage.getItem("basira_chats") || "{}"),
setCurrent: (id) => localStorage.setItem("basira_current_id", id),
getCurrent: () => localStorage.getItem("basira_current_id")
};

window.app = {

chats: ChatStore.load(),  
currentChatId: ChatStore.getCurrent(),  
chatHistory: [],  
isSending: false,  
audioPlayer: new Audio(),  
abortController: null,

/* ================= INIT ================= */

init() {

if (!Object.keys(this.chats).length) {  
    this.createNewChat();  
} else {  
    const id = this.currentChatId || Object.keys(this.chats)[0];  
    this.loadChat(id);  
}  

this.bindEvents();  
/* Restore Vision Mode */
const savedMode = localStorage.getItem("basira_vision_mode");
if (savedMode) {
    document.body.classList.add(savedMode);
}
this.renderChatList();  
this.playWelcome();

},

/* ================= VOICE STATE ================= */

setVoiceState(state) {

voiceState = state;  

if (!ui.blindStatus) return;  

const map = {  
    idle: "🎙️ أتكلم...",  
    recording: "🎙️ أتكلم...",  
    thinking: "🤖 جاري التفكير...",  
    speaking: "🔊 جاري النطق..."  
};  

ui.blindStatus.textContent = map[state] || "";

},

/* ================= CAMERA FUNCTION ================= */

async captureAndDescribe() {

if (!ui.video) return;  

try {  

    this.setVoiceState("thinking");  

    const stream = await navigator.mediaDevices.getUserMedia({  
        video: { facingMode: "environment" }  
    });  

    ui.video.classList.remove("hidden");  
    ui.video.srcObject = stream;  

    await new Promise(r => setTimeout(r, 900));  

    const canvas = document.createElement("canvas");  
    canvas.width = ui.video.videoWidth;  
    canvas.height = ui.video.videoHeight;  

    canvas.getContext("2d").drawImage(ui.video, 0, 0);  

    stream.getTracks().forEach(t => t.stop());  
    ui.video.classList.add("hidden");  

    const imageData = canvas.toDataURL("image/jpeg");  

const ai = await puter.ai.chat(
`أنت مساعد متخصص للمكفوفين.
اشرح المشهد بتفصيل شديد جداً.
اذكر الأشخاص، الأشياء، الألوان، الاتجاهات، المسافات، المخاطر المحتملة.`,
imageData
);

const reply = ai?.message?.content || ai;  

    /* 🔒 حفظ الوصف فقط */  
    lastVisionContext = reply;  

    this.append(reply, "bot");  
    await this.speak(reply);  

    this.setVoiceState("idle");  

    setTimeout(() => this.startRecording(), 600);  

} catch (err) {  

    console.error(err);  
    await this.speak("لم أتمكن من فتح الكاميرا.");  
    this.setVoiceState("idle");  
}

},
/* ================= NAVIGATION ================= */

showVisionOptionsAnimated() {

    /* ✅ لو الأنيميشن اتعرضت قبل كده → دخول فوري */
    if (localStorage.getItem("basira_gate_seen")) {
        ui.gate.classList.add("hidden");
        ui.vision.classList.remove("hidden");
        return;
    }

    const vision = document.querySelector(".vision-side");
    const blind = document.querySelector(".blind-side");
    const visionContent = vision.querySelector(".content-box");
    const blindContent = blind.querySelector(".content-box");

    const oldDetails = document.querySelector(".details-text");
    if (oldDetails) oldDetails.remove();

    blindContent.style.opacity = "0";
    blindContent.style.transition = "opacity 0.4s ease";

    blind.classList.add("hide-side");
    vision.classList.add("expand-x");

    setTimeout(() => {
        visionContent.classList.add("center-screen");
    }, 100);

    let details;

    setTimeout(() => {

        visionContent.classList.add("move-up");

        details = document.createElement("div");
        details.className = "details-text";
        details.innerHTML = `
            <h3>منظومة بصير الذكية</h3>
            <p>تكنولوجيا متقدمة لتحويل المشاهد البصرية إلى بيانات منطقية.</p>
        `;

        document.getElementById("gate-scr").appendChild(details);

        setTimeout(() => {
            details.classList.add("show");
        }, 100);

    }, 1400);

    setTimeout(() => {

        ui.gate.classList.add("collapse-up");

        setTimeout(() => {

            ui.gate.classList.add("hidden");
            ui.vision.classList.remove("hidden");

            vision.classList.remove("expand-x");
            blind.classList.remove("hide-side");

            visionContent.classList.remove("center-screen", "move-up");
            blindContent.style.opacity = "1";

            if (details) details.remove();
            ui.gate.classList.remove("collapse-up");

            /* ✅ نحفظ إن المستخدم شاف الأنيميشن */
            localStorage.setItem("basira_gate_seen", "1");

        }, 1000);

    }, 6500);
},
initVision(mode){

    document.body.classList.remove("normal","low-vision","color-blind");
    document.body.classList.add(mode);

    localStorage.setItem("basira_vision_mode", mode);

    ui.vision.classList.add("hidden");
    ui.chat.classList.remove("hidden");

    this.currentMode = "vision";

    this.audioPlayer.pause();
    this.audioPlayer.currentTime = 0;
},

initBlind() {

ui.gate.classList.add("hidden");  
ui.blind.classList.remove("hidden");  

this.currentMode = "blind";  

let id = Object.keys(this.chats).find(c => c.startsWith("blind_"));  

if (!id) {  

    id = "blind_" + Date.now();  

    this.chats[id] = {  
        id,  
        name: "شات كفيف",  
        messages: []  
    };  

    ChatStore.save(this.chats);  
}  

this.loadChat(id);  

setTimeout(() => {  
    this.startRecording();  
}, 700);

},

backToGate() {

ui.chat.classList.add("hidden");  
ui.blind.classList.add("hidden");  
ui.vision.classList.add("hidden");  
ui.gate.classList.remove("hidden");  

this.audioPlayer.pause();  
this.audioPlayer.currentTime = 0;  

voiceState = "idle";  

const vision = document.querySelector(".vision-side");  
const blind = document.querySelector(".blind-side");  
const visionContent = vision.querySelector(".content-box");  
const blindContent = blind.querySelector(".content-box");  

vision.classList.remove("expand-x");  
blind.classList.remove("hide-side");  

visionContent.classList.remove("center-screen", "move-up");  
blindContent.style.opacity = "1";  

const details = document.querySelector(".details-text");  
if (details) details.remove();  

this.currentMode = null;

},
/* ================= CHAT ================= */

async handleSend() {

const text = ui.input.value.trim();  

if ((!text && !selectedFile) || this.isSending) return;  

this.isSending = true;  
this.updateSendButton(true);  

ui.input.value = "";  
this.autoResize();  

try {  

    let reply = "";  

    /* ================= IMAGE ================= */  
    if (selectedFile && selectedFile.type.startsWith("image")) {  

        const base64 = await this.fileToBase64(selectedFile);  

        if (text) this.append(text, "user");  

        /* الصورة تظهر فقط */  
        this.append(base64, "user");  
        this.clearFile();
        this.showTyping();  

        const ai = await puter.ai.chat(
`أنت مساعد متخصص للمكفوفين.
اشرح المشهد بتفصيل شديد جداً.
اذكر الأشخاص، الأشياء، الألوان، الاتجاهات، المسافات، المخاطر المحتملة.`,
base64
);

reply = ai?.message?.content || ai;  

        /* 🔒 حفظ الوصف فقط */  
        lastVisionContext = reply;  

        this.hideTyping();  
        this.append(reply, "bot");  

        if (this.currentMode === "blind") {  
            await this.speak(reply);  
        }  

        this.isSending = false;  
        this.updateSendButton(false);  

        return;  
    }  

    /* ================= TEXT ================= */  

    this.append(text, "user");  
    this.showTyping();  

    this.abortController = new AbortController();

const res = await fetch("/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: this.abortController.signal,
    body: JSON.stringify({
        message: text,
        history: this.chatHistory,
        visionContext: lastVisionContext || null
    })
});

    const data = await res.json();  
    reply = data.reply || "❌ خطأ";  

    this.hideTyping();  
    this.append(reply, "bot");  

    if (this.currentMode === "blind") {  
        await this.speak(reply);  
    }  

} catch (err) {  

    this.hideTyping();  
    this.append("❌ " + err.message, "bot");  

} finally {  

    this.isSending = false;  
    this.updateSendButton(false);  
    
}

},

/* ================= APPEND (NO BASE64 SAVE) ================= */

append(text, role, save = true) {

const empty = ui.chatBody.querySelector(".empty-chat-placeholder");  
if (empty) empty.remove();  

const div = document.createElement("div");  
div.className = `msg ${role}-msg`;  

const isImage = typeof text === "string" && text.startsWith("data:image");  

if (isImage) {  
    div.innerHTML = `<img src="${text}" style="max-width:100%;border-radius:12px;">`;  
} else {  
    const safeText = String(text)  
        .replace(/</g, "&lt;")  
        .replace(/>/g, "&gt;")  
        .replace(/\n/g, "<br>");  
    div.innerHTML = safeText;  
    div.style.wordBreak = "break-word";  
    div.style.overflowWrap = "anywhere";  
}  

ui.chatBody.appendChild(div);  
ui.chatBody.scrollTop = ui.chatBody.scrollHeight;  

if (!save) return;  

/* 🔒 لا نحفظ base64 */  
if (isImage) return;  

this.chatHistory.push({ role, content: text });  

this.chats[this.currentChatId].messages = this.chatHistory;  
ChatStore.save(this.chats);  
this.renderChatList();

},

/* ================= FILE ================= */

handleFileSelect(e) {

selectedFile = e.target.files[0];  
if (!selectedFile) return;  

ui.filePreview.innerHTML = `  
    <div class="file-bubble">  
        📎 ${selectedFile.name}  
        <button onclick="app.clearFile()">×</button>  
    </div>`;  

ui.filePreview.classList.remove("hidden");

},

clearFile() {
selectedFile = null;
ui.filePreview.classList.add("hidden");
ui.fileInput.value = "";
},

fileToBase64(file) {

return new Promise((resolve, reject) => {  
    const reader = new FileReader();  
    reader.onload = () => resolve(reader.result);  
    reader.onerror = reject;  
    reader.readAsDataURL(file);  
});

},

/* ================= UI ================= */

updateSendButton(thinking) {

if (thinking) {  
    ui.sendBtn.innerHTML = '<i class="fas fa-stop"></i>';  
    ui.sendBtn.onclick = () => this.abortRequest();  
} else {  
    ui.sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';  
    ui.sendBtn.onclick = () => this.handleSend();  
}

},

abortRequest() {

if (this.abortController) {  
    this.abortController.abort();  
    this.audioPlayer.pause();  
    this.audioPlayer.currentTime = 0;  
    this.isSending = false;  
    this.hideTyping();  
    this.updateSendButton(false);  
    this.abortController = null;
}

},

autoResize() {
ui.input.style.height = "auto";
ui.input.style.height = ui.input.scrollHeight + "px";
},

showTyping() {

if (document.getElementById("typing")) return;  

const div = document.createElement("div");  
div.id = "typing";  
div.className = "msg bot-msg typing";  
div.innerHTML = "<span></span><span></span><span></span>";  

ui.chatBody.appendChild(div);

},

hideTyping() {
document.getElementById("typing")?.remove();
},
changeVisionMode(){
    ui.sidebar.classList.add("hidden");
    ui.vision.classList.remove("hidden");
},
applyVision(mode){

    document.body.classList.remove("normal","low-vision","color-blind");
    document.body.classList.add(mode);

    localStorage.setItem("basira_vision_mode", mode);
},
/* ================= VOICE SYSTEM ================= */

async startRecording() {

if (voiceState !== "idle") return;  
if (!navigator.mediaDevices?.getUserMedia) return;  

try {  

    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });  

    mediaRecorder = new MediaRecorder(recordingStream);  
    audioChunks = [];  

    mediaRecorder.ondataavailable = e => audioChunks.push(e.data);  
    mediaRecorder.start();  

    audioContext = new AudioContext();  
    sourceNode = audioContext.createMediaStreamSource(recordingStream);  
    analyser = audioContext.createAnalyser();  
    analyser.fftSize = 256;  
    sourceNode.connect(analyser);  

    const dataArray = new Uint8Array(analyser.frequencyBinCount);  

    this.setVoiceState("recording");  

    const checkSilence = () => {  

        if (voiceState !== "recording") return;  

        analyser.getByteFrequencyData(dataArray);  
        const volume = dataArray.reduce((a,b)=>a+b)/dataArray.length;  

        if (volume < silenceThreshold) {  
            if (!silenceTimer) {  
                silenceTimer = setTimeout(() => this.stopRecording(), silenceDelay);  
            }  
        } else {  
            clearTimeout(silenceTimer);  
            silenceTimer = null;  
        }  

        if (mediaRecorder?.state === "recording") {  
            requestAnimationFrame(checkSilence);  
        }  
    };  

    checkSilence();  

} catch (err) {  
    console.error(err);  
    voiceState = "idle";  
}

},

async stopRecording() {

if (!mediaRecorder || mediaRecorder.state !== "recording") return;  
if (voiceState !== "recording") return;  

this.setVoiceState("thinking");  

clearTimeout(silenceTimer);  
silenceTimer = null;  

mediaRecorder.stop();  
recordingStream?.getTracks().forEach(t => t.stop());  

mediaRecorder.onstop = async () => {  

    const blob = new Blob(audioChunks, { type: "audio/webm" });  
    const form = new FormData();  
    form.append("audio", blob, "voice.webm");  

    try {  

        const res = await fetch("/transcribe", {  
            method: "POST",  
            body: form  
        });  

        const data = await res.json();  

        if (!data.text?.trim()) {  
            emptyTranscriptCount++;  
            voiceState = "idle";  
            if (emptyTranscriptCount < MAX_EMPTY_TRANSCRIPTS)  
                return this.startRecording();  
            emptyTranscriptCount = 0;  
            return;  
        }  

        emptyTranscriptCount = 0;  

        const userText = data.text.trim();  
        this.append(userText, "user");  

        /* ================= CAMERA COMMAND ================= */  

        const lower = userText.toLowerCase();  

if (/افتح.*كاميرا|شغل.*كاميرا|صور|صوّر|شوف قدامي/.test(lower)) {
    await this.captureAndDescribe();
    return;
}

        /* ================= NORMAL CHAT ================= */  

        const chatRes = await fetch("/chat", {  
            method: "POST",  
            headers: { "Content-Type": "application/json" },  
            body: JSON.stringify({  
                message: userText,  
                history: this.chatHistory,  
                visionContext: lastVisionContext || null  
            })  
        });  

        const chatData = await chatRes.json();  
        const reply = chatData.reply || "حدث خطأ";  
        this.append(reply, "bot");
        await this.speak(reply);  

        this.setVoiceState("idle");  

        setTimeout(() => this.startRecording(), 600);  

    } catch (err) {  

        console.error(err);  
        this.setVoiceState("idle");  
        setTimeout(() => this.startRecording(), 1500);  
    }  
};

},

/* ================= TTS ================= */

async speak(text) {

if (!text) return;  

this.setVoiceState("speaking");  

try {  

    const res = await fetch("/speak", {  
        method: "POST",  
        headers: { "Content-Type": "application/json" },  
        body: JSON.stringify({ text })  
    });  

    const data = await res.json();  

    const file =  
        data.fileName ||  
        (data.audioUrl ? data.audioUrl.split("/").pop() : null);  

    if (data.ok && file) {  

        return new Promise(resolve => {  

            this.audioPlayer.src = "/uploads/" + file;  

            this.audioPlayer.onended = resolve;  
            this.audioPlayer.onerror = resolve;  

            this.audioPlayer.play().catch(resolve);  
        });  
    }  

} catch (err) {  
    console.error("TTS Error:", err);  
}  

return Promise.resolve();

},

/* ================= CLEAR HISTORY ================= */

clearHistory() {

    if (!this.currentChatId) return;

    Swal.fire({
        title: "هل أنت متأكد؟",
        text: "سيتم مسح المحادثة الحالية نهائياً.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "نعم، امسح",
        cancelButtonText: "إلغاء",
        background: "#0f172a",
        color: "#ffffff",
        confirmButtonColor: "#3b82f6",
        cancelButtonColor: "#374151",
        reverseButtons: true
    }).then((result) => {

        if (!result.isConfirmed) return;

        delete this.chats[this.currentChatId];

        const remaining = Object.keys(this.chats);

        if (remaining.length === 0) {
            this.createNewChat();
        } else {
            this.loadChat(remaining[0]);
        }

        ChatStore.save(this.chats);
        this.renderChatList();

        Swal.fire({
            title: "تم الحذف بنجاح",
            icon: "success",
            timer: 1300,
            showConfirmButton: false,
            background: "#0f172a",
            color: "#ffffff"
        });
    });
},

/* ================= TOGGLE SIDEBAR ================= */

toggleSidebar(show) {

    if (!ui.sidebar) return;

    if (show) {
        ui.sidebar.classList.remove("hidden");
    } else {
        ui.sidebar.classList.add("hidden");
    }
},
/* ================= STORAGE ================= */

createNewChat() {
const id = "chat_" + Date.now();
this.chats[id] = { id, name: "محادثة جديدة", messages: [] };
this.loadChat(id);
},

loadChat(id) {

this.currentChatId = id;  
ChatStore.setCurrent(id);  

ui.chatBody.innerHTML = "";  

this.chatHistory = this.chats[id].messages || [];  

this.chatHistory.forEach(m =>  
    this.append(m.content, m.role, false)  
);  

this.renderChatList();

},

renderChatList() {

ui.chatList.innerHTML = "";  

Object.values(this.chats).reverse().forEach(chat => {  

    const div = document.createElement("div");  
    div.className = `chat-item ${chat.id === this.currentChatId ? "active" : ""}`;  
    div.textContent = chat.name;  
    div.onclick = () => this.loadChat(chat.id);  

    ui.chatList.appendChild(div);  
});

},

playWelcome() {

    const isVisited = localStorage.getItem("basira_visited");

    this.audioPlayer.src = isVisited
        ? "/uploads/welcome-back.mp3"
        : "/uploads/welcome-first.mp3";

    this.audioPlayer.volume = 1;

    this.audioPlayer.play().catch(err => {
        console.log("Autoplay blocked:", err.message);
    });

    localStorage.setItem("basira_visited","1");
},

bindEvents() {

document.getElementById("change-vision-btn")
?.addEventListener("click", () => {
    this.changeVisionMode();
});
ui.fileInput.addEventListener("change", e =>  
    this.handleFileSelect(e)  
);  

ui.input.addEventListener("input", () =>  
    this.autoResize()  
);  

ui.input.addEventListener("keydown", e => {  
    if (e.key === "Enter" && !e.shiftKey) {  
        e.preventDefault();  
        this.handleSend();  
    }  
});

}

}; /* END APP */

document.addEventListener(
"DOMContentLoaded",
() => window.app.init()
);
