// js/script.js - VERSI FINAL DENGAN SEMUA FITUR LENGKAP

// --- 1. Seleksi Semua Elemen ---
const chatMessages = document.querySelector('.chat-messages');
const inputArea = document.querySelector('.chat-input-area textarea');
const sendButton = document.querySelector('.send-button');
const menuButton = document.querySelector('.menu-button');
const dropdownMenu = document.querySelector('.dropdown-menu');
const modelNotification = document.getElementById('model-notification');
// Di bawah const dropdownMenu = ...
const db = new Dexie('ChatDatabase');
db.version(5).stores({
    // Versi 5: Tambah kolom 'thoughts' untuk menyimpan pikiran AI
    messages: '++id, conversation_id, timestamp, thoughts, [conversation_id+timestamp]',
    conversations: '++id, &timestamp, summary'
}).upgrade(tx => {
    // Fungsi upgrade ini penting jika user sudah punya database versi lama.
    // Ini memastikan data lama tidak hilang, hanya saja kolom 'thoughts' akan kosong.
    console.log("Upgrading database to version 5, 'thoughts' column will be backfilled with empty string.");
    return tx.table('messages').toCollection().modify(msg => {
        if (msg.thoughts === undefined) {
            msg.thoughts = ""; // Isi dengan string kosong untuk data lama
        }

    });
});

db.version(6).stores({
    // Definisi untuk versi 6 sudah mencakup 'thoughts' dari v5 dan 'summary' yang baru
    messages: '++id, conversation_id, timestamp, thoughts, [conversation_id+timestamp]',
    conversations: '++id, &timestamp, summary'
}).upgrade(tx => {
    // Fungsi upgrade ini hanya berjalan jika database user ada di versi 5 dan ingin ke 6
    console.log("Upgrading database to version 6, 'summary' column will be backfilled with empty string.");
    return tx.table('conversations').toCollection().modify(convo => {
        if (convo.summary === undefined) {
            convo.summary = ""; // Isi kolom summary baru dengan string kosong
        }
    });
});

db.version(7).stores({
    messages: '++id, conversation_id, timestamp, thoughts, [conversation_id+timestamp]',
    // Tambahkan kolom baru untuk nama dan avatar karakter
    conversations: '++id, &timestamp, summary, character_name, character_avatar'
}).upgrade(tx => {
    // Fungsi upgrade ini penting agar data sesi lama tidak error.
    // Kita akan mengisi kolom baru dengan string kosong untuk data lama.
    console.log("Upgrading database to version 7, adding character info columns.");
    return tx.table('conversations').toCollection().modify(convo => {
        if (convo.character_name === undefined) {
            convo.character_name = "";
        }
        if (convo.character_avatar === undefined) {
            convo.character_avatar = "";
        }
    });
});

console.log("✅ Database Dexie (v2) dengan tabel 'conversations' siap.");


let chatHistory = [];
// ...
let currentConversationId = null;
let isReplying = false;
let lastSummaryCount = 0; // <-- TAMBAHKAN VARIABEL INI. Artinya: "Apakah AI sedang membalas?"
// --- 2. Kumpulan Fungsi Utama ---
// (Setelah blok setup Dexie)

// ▼▼▼ BUAT FUNGSI BARU INI ▼▼▼
// ▼▼▼ GANTI DENGAN VERSI YANG LEBIH BAIK INI ▼▼▼
// GANTI SELURUH FUNGSI LAMA DENGAN INI:
async function loadChatHistory(conversationIdToLoad = null) {
    try {
        let conversationToLoad;
        if (conversationIdToLoad) {
            conversationToLoad = await db.conversations.get(conversationIdToLoad);
        } else {
            conversationToLoad = await db.conversations.orderBy('timestamp').last();
        }

        // KUNCI UTAMA: BERSIHKAN SEMUANYA DULU!
        chatMessages.innerHTML = ''; // Kosongkan tampilan
        chatHistory = [];            // Kosongkan array history
        currentConversationId = null;  // Reset ID sesi

        if (conversationToLoad) {
            currentConversationId = conversationToLoad.id;
            const messagesFromDb = await db.messages
                .where({ conversation_id: currentConversationId })
                .sortBy('timestamp');

            // Loop dan isi ulang dari awal
            for (const msg of messagesFromDb) {
                const messageIdString = `msg-${msg.id}`;
                const role = msg.role;
                const content = msg.content;
                const sender = role === 'model' ? 'ai' : 'user';

                // Tampilkan di layar
                const bubble = createMessageBubble(sender, content, messageIdString);
                formatMarkdown(bubble.querySelector('.message-text p'));
                if (msg.thoughts && msg.thoughts.trim() !== '') {
                    bubble.dataset.thoughts = msg.thoughts; // Set dataset dari data DB
                    addDropdownIcon(bubble); // Tampilkan ikon '💡'
                }
                // Masukkan ke array history
                chatHistory.push({
                    id: messageIdString,
                    role: role,
                    parts: [content]
                });
            }
        } else {
            // Jika tidak ada sesi sama sekali (web baru dibuka, DB kosong)
            // Kita buat sesi baru sekarang juga.
            console.log("Database kosong, membuat sesi pertama...");
            await startNewConversation();
        }

        // Selalu scroll ke bawah setelah selesai memuat
        scrollToBottom(); // Panggil fungsi kita

    } catch (error) {
        console.error("Gagal total memuat history:", error);
    }

}

// --- DI DALAM script.js ---

// TAMBAHKAN FUNGSI BARU INI (TARUH DI BAWAH loadChatHistory):
async function startNewConversation() {
    try {
        const characterData = JSON.parse(localStorage.getItem('characterData') || '{}');
        const charName = characterData.name || 'Karakter';
        const charAvatar = characterData.avatar_url || '';
        // 1. Buat sesi baru di DB
        const newConversationId = await db.conversations.add({
            timestamp: new Date(),
            title: `Percakapan Baru - ${new Date().toLocaleDateString()}`,
            character_name: charName,      // <-- Data baru
            character_avatar: charAvatar
        });

        // 2. Update variabel global
        currentConversationId = newConversationId;
        lastSummaryCount = 0;

        // 3. Update URL browser
        const newUrl = `${window.location.pathname}?session_id=${newConversationId}`;
        history.pushState({ sessionId: newConversationId }, '', newUrl);

        // 4. Reset total tampilan dan history array
        chatMessages.innerHTML = '';
        chatHistory = [];

        console.log(`Sesi baru dimulai dengan ${charName}: ID ${currentConversationId}`);


        // 5. Tampilkan sapaan
        await displayGreeting();

    } catch (error) {
        console.error("Gagal memulai percakapan baru:", error);
    }
}

// (Di bawah fungsi loadChatHistory)

// ▼▼▼ GANTI DENGAN VERSI BARU INI ▼▼▼
// ▼▼▼ GANTI FUNGSI LAMA DENGAN VERSI INI ▼▼▼
// --- DI DALAM script.js ---

// GANTI DENGAN VERSI BARU INI:
async function displayGreeting() {
    // 1. Cek dulu, apakah ada sesi yang aktif?
    if (!currentConversationId) {
        console.log("Tidak ada sesi aktif, sapaan tidak ditampilkan.");
        // Jika tidak ada sesi aktif (misalnya saat pertama kali buka web & DB kosong),
        // jangan lakukan apa-apa. Sesi akan dibuat saat pesan pertama dikirim.
        return;
    }

    const savedData = localStorage.getItem('characterData');
    const characterData = savedData ? JSON.parse(savedData) : {};
    const greetingText = characterData.greeting;

    if (greetingText) {
        try {
            // 2. Siapkan data pesan sapaan untuk DISIMPAN di sesi yang SUDAH ADA.
            const messageData = {
                conversation_id: currentConversationId, // <-- Pakai ID yang sudah ada
                role: 'model',
                content: greetingText,
                timestamp: new Date()
            };

            // 3. Simpan sapaan ke DB dan tampilkan
            const newDbId = await db.messages.add(messageData);
            const messageIdString = `msg-${newDbId}`;

            const greetingBubble = createMessageBubble('ai', greetingText, messageIdString);
            formatMarkdown(greetingBubble.querySelector('.message-text p'));
            chatHistory.push({
                id: messageIdString,
                role: 'model',
                parts: [greetingText]
            });

        } catch (error) {
            console.error("Gagal menyimpan pesan sapaan:", error);
        }
    }
}

// FUNGSI BARU: Untuk memformat markdown
function formatMarkdown(element) {
    let currentText = element.textContent || '';
    // Regex baru yang bisa menangani *...* dan **...**
    const formattedHTML = currentText.replace(/(\*+)(.*?)\1/g, '<span class="action-text">$2</span>');
    element.innerHTML = formattedHTML;
}

function convertHtmlToMarkdown(htmlContent) {
    // Buat elemen div sementara di memori untuk mem-parsing HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Ganti setiap <span class="action-text">...</span> dengan *...*
    const actionSpans = tempDiv.querySelectorAll('.action-text');
    actionSpans.forEach(span => {
        // Ganti elemen span dengan teks yang sudah diapit bintang
        span.replaceWith(`*${span.textContent}*`);
    });

    // Kembalikan sebagai teks murni
    return tempDiv.textContent;
}

function createMessageBubble(sender, text, messageId = null) {
    const savedCharData = localStorage.getItem('characterData');
    const characterData = savedCharData ? JSON.parse(savedCharData) : { name: "Hana" };
    const savedUserData = localStorage.getItem('userData');
    const userData = savedUserData ? JSON.parse(savedUserData) : { name: "User" };
    const senderName = sender === 'user' ? userData.name : characterData.name;
    const avatarUrl = sender === 'user' ? userData.avatar_url : characterData.avatar_url;

    const messageDiv = document.createElement('div');
    messageDiv.id = messageId || `msg-${Date.now()}-${Math.random()}`;
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
    // Tambahkan data-id untuk mempermudah pengambilan ID numerik
    messageDiv.dataset.id = messageId ? messageId.replace('msg-', '') : '';

    let menuItems = '';
    if (sender === 'user') {
        menuItems = `
            <button class="edit">✏️ Edit</button>
            <button class="resend">🔄 Kirim Ulang</button>
            <button class="delete">🗑️ Hapus</button>
        `;
    } else {
        menuItems = `
            <button class="regenerate">✨ Regenerate</button>
            <button class="delete">🗑️ Hapus</button>
        `;
    }

    messageDiv.innerHTML = `
        <img src="${avatarUrl}" alt="Avatar" class="avatar">
        <div class="message-content">
            <span class="message-sender">${senderName}</span>
            <div class="message-text"><p>${text}</p></div>
            <button class="message-menu-button">⋮</button>
            <div class="message-dropdown-menu hidden">
                ${menuItems}
            </div>
        </div>
    `;

    chatMessages.appendChild(messageDiv);
    return messageDiv; // Fungsi ini hanya membuat dan mengembalikan elemen
}

// TAMBAHKAN FUNGSI BARU INI
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}
// ▲▲▲ SELESAI ▲▲▲

// ▼▼▼ TAMBAHKAN KUMPULAN FUNGSI BARU INI ▼▼▼

function enterEditMode(messageBubble) {
    const messageTextDiv = messageBubble.querySelector('.message-text');
    if (messageBubble.querySelector('.edit-area')) return;

    const currentTextElement = messageTextDiv.querySelector('p');
    if (!currentTextElement) return;

    const originalHtml = currentTextElement.innerHTML;
    const originalText = convertHtmlToMarkdown(originalHtml);
    currentTextElement.style.display = 'none';

    const editArea = document.createElement('div');
    editArea.className = 'edit-area';
    editArea.innerHTML = `
        <textarea>${originalText}</textarea>
        <div class="edit-controls">
            <button class="cancel-button">Batal</button>
            <button class="save-button">Simpan</button>
        </div>
    `;
    messageTextDiv.appendChild(editArea);

    const textarea = editArea.querySelector('textarea');

    // ▼▼▼ TAMBAHKAN BLOK KODE INI ▼▼▼
    function autoResizeTextarea() {
        textarea.style.height = 'auto'; // Kempeskan dulu
        textarea.style.height = textarea.scrollHeight + 'px'; // Set tinggi sesuai konten
    }
    autoResizeTextarea();
    textarea.addEventListener('input', autoResizeTextarea); // Panggil sekali untuk inisialisasi
    textarea.focus(); // Langsung fokus ke textarea

    // --- Logika Tombol Batal ---
    editArea.querySelector('.cancel-button').addEventListener('click', () => {
        // Hapus area edit
        messageBubble.classList.remove('is-editing');
        editArea.remove();
        // Tampilkan lagi teks aslinya
        currentTextElement.style.display = 'block';
    });

    // --- Logika Tombol Simpan ---
    editArea.querySelector('.save-button').addEventListener('click', async () => { // <-- Tambah async
        const newText = textarea.value;
        await exitEditMode(messageBubble, newText); // <-- Tambah await
    });
}

// GANTI SELURUH FUNGSI INI
async function exitEditMode(messageBubble, newText) {
    messageBubble.classList.remove('is-editing');
    const messageTextDiv = messageBubble.querySelector('.message-text');
    const currentTextElement = messageTextDiv.querySelector('p');
    const editArea = messageTextDiv.querySelector('.edit-area');

    currentTextElement.textContent = newText;
    if (editArea) {
        editArea.remove();
    }
    currentTextElement.style.display = 'block';
    formatMarkdown(currentTextElement);

    const messageIdString = messageBubble.id;
    const messageDbId = parseInt(messageBubble.dataset.id);

    const messageIndex = chatHistory.findIndex(msg => msg.id === messageIdString);
    if (messageIndex === -1) {
        console.error("Tidak bisa menemukan pesan untuk diupdate di history!");
        return; // Hentikan fungsi jika tidak ketemu
    }

    try {
        // 1. UPDATE pesan yang diedit di dalam IndexedDB
        await db.messages.update(messageDbId, { content: newText });

        // 2. CARI semua ID pesan yang ada SETELAH pesan yang diedit
        const idsToDelete = [];
        for (let i = messageIndex + 1; i < chatHistory.length; i++) {
            const idStr = chatHistory[i].id;
            idsToDelete.push(parseInt(idStr.replace('msg-', '')));
        }

        // 3. HAPUS semua pesan tersebut dari IndexedDB
        if (idsToDelete.length > 0) {
            await db.messages.bulkDelete(idsToDelete);
        }

        // 4. SINKRONKAN tampilan dan array lokal SEKARANG
        // Hapus gelembung chat dari tampilan
        let currentBubble = messageBubble.nextElementSibling;
        while (currentBubble) {
            let nextBubble = currentBubble.nextElementSibling;
            currentBubble.remove();
            currentBubble = nextBubble;
        }

        // Potong array history lokal kita
        chatHistory.splice(messageIndex + 1);

        // Update juga teks di array lokal
        chatHistory[messageIndex].parts[0] = newText;

        // 5. Minta respons baru dari AI
        console.log("History baru (setelah edit) dikirim ke AI:", chatHistory);
        getAiResponse(newText);

    } catch (error) {
        console.error("Gagal total saat proses edit dan sinkronisasi DB:", error);
        alert("Terjadi kesalahan saat menyimpan editan. Silakan coba lagi.");
    }
}
// ▲▲▲ SELESAI KUMPULAN FUNGSI BARU ▲▲▲

// Fungsi untuk membuat gelembung animasi 'mengetik...'
function createTypingIndicator() {
    const indicator = createMessageBubble('ai', '');
    indicator.id = 'typing-indicator';
    const messageText = indicator.querySelector('.message-text');

    // Buat struktur baru dengan wadah untuk titik-titik dan timer
    messageText.innerHTML = `
        <div class="typing-animation-container">
            <div class="typing-dots">
                <span></span><span></span><span></span>
            </div>
            <span class="typing-timer">0.0s</span> 
        </div>
    `;

    // Tambahkan sedikit style langsung via JS agar tidak perlu ubah file CSS
    const style = document.createElement('style');
    style.textContent = `
        .typing-animation-container {
            display: flex;
            align-items: center;
            gap: 10px; /* Jarak antara titik-titik dan timer */
        }
        .typing-timer {
            font-size: 0.8rem;
            color: #ffffffff;
            font-fargba(255, 255, 255, 1)onospace; /* Pakai font monospace biar angka tidak loncat-loncat */
        }
    `;
    indicator.appendChild(style);

    return indicator;
}

// GANTI LAGI FUNGSI LAMA DENGAN VERSI "SULTAN" INI
// GANTI LAGI DENGAN VERSI FINAL "FISIKA PEGAS" INI
function createAvatarPopup(imageUrl) {
    const existingPopup = document.querySelector('.avatar-popup-draggable');
    if (existingPopup) existingPopup.remove();

    const popup = document.createElement('div');
    popup.className = 'avatar-popup-draggable';
    popup.innerHTML = `
        <img src="${imageUrl}" alt="Avatar">
        <button class="popup-close-btn">×</button>
    `;
    document.body.appendChild(popup);

    const closeBtn = popup.querySelector('.popup-close-btn');

    // --- Variabel untuk fisika & animasi ---
    let isDragging = false;
    let animationFrameId = null;

    // Posisi
    let targetX, currentX;
    let targetY, currentY;

    // Kemiringan
    let velocityX = 0;
    let velocityY = 0;
    const easing = 0.15;
    const tiltFactor = 0.1;

    // SKALA (Untuk Efek Pegas)
    let scaleCurrent = 0.8; // Mulai dari ukuran kecil untuk efek 'pop-in'
    let scaleTarget = 1.0;
    let scaleVelocity = 0.0;
    const springConstant = 0.04; // Kekuatan pegas (0.01 - 0.1)
    const damping = 0.75;      // Rem/peredam (0.1 - 0.95)

    // --- Fungsi Animasi Utama ---
    function animationLoop() {
        // Hitung fisika posisi (efek karet)
        const dx = targetX - currentX;
        const dy = targetY - currentY;
        velocityX = dx * easing;
        velocityY = dy * easing;
        currentX += velocityX;
        currentY += velocityY;

        // Hitung fisika skala (efek pegas)
        const scaleForce = (scaleTarget - scaleCurrent) * springConstant;
        scaleVelocity += scaleForce;
        scaleVelocity *= damping; // Terapkan rem
        scaleCurrent += scaleVelocity;

        // Hitung kemiringan
        const tiltY = velocityX * -tiltFactor;
        const tiltX = velocityY * tiltFactor;

        // Terapkan semua ke transform
        popup.style.transform = `
            translate(${currentX}px, ${currentY}px)
            rotateX(${tiltX}deg)
            rotateY(${tiltY}deg)
            scale(${scaleCurrent})
        `;

        // Lanjutkan loop
        animationFrameId = requestAnimationFrame(animationLoop);
    }

    // --- Inisialisasi Posisi Awal ---
    const rect = popup.getBoundingClientRect();
    popup.style.top = '0px';
    popup.style.left = '0px';
    currentX = window.innerWidth / 2 - rect.width / 2;
    currentY = window.innerHeight / 2 - rect.height / 2;
    targetX = currentX;
    targetY = currentY;

    // --- Event Listeners ---
    popup.addEventListener('mousedown', (e) => {
        if (e.target === closeBtn) return;
        isDragging = true;
        popup.classList.add('is-dragging');
    });

    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        targetX += e.movementX;
        targetY += e.movementY;
    });

    window.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        popup.classList.remove('is-dragging');

        // "Sentil" pegasnya saat dilepas untuk memberi sedikit getaran
        scaleVelocity += 0.05;
    });

    const closePopup = () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (popup.parentNode) popup.parentNode.removeChild(popup);
    };
    closeBtn.addEventListener('click', closePopup);

    // --- Mulai Animasi ---
    animationLoop();
}
// Fungsi untuk menambahkan ikon 'pikiran' dan membuat popup
// GANTI FUNGSI LAMA DENGAN VERSI BARU INI
function addDropdownIcon(messageBubble) {
    const icon = document.createElement('span');
    icon.textContent = '💡';
    icon.className = 'thought-icon';
    icon.style.cursor = 'pointer';
    icon.style.marginLeft = '10px';

    const senderElement = messageBubble.querySelector('.message-sender');
    senderElement.appendChild(icon);

    icon.addEventListener('click', () => {
        const thoughts = messageBubble.dataset.thoughts;

        // --- PERUBAHAN DI SINI ---
        // 1. Buat elemen paragraf sementara untuk 'thoughts'
        const thoughtsParagraph = document.createElement('p');
        thoughtsParagraph.textContent = thoughts;

        // 2. Terapkan Markdown ke paragraf itu
        formatMarkdown(thoughtsParagraph);
        // --- AKHIR PERUBAHAN ---

        const overlay = document.createElement('div');
        overlay.className = 'thought-overlay';
        const modal = document.createElement('div');
        modal.className = 'thought-modal';

        // 3. Gunakan HTML dari paragraf yang sudah diformat
        modal.innerHTML = `
            <button class="close-btn">&times;</button>
            <h3>Pikiran Hana</h3>
            ${thoughtsParagraph.outerHTML}
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        const handleEscKey = (e) => {
            if (e.key === 'Escape') closeModal();
        };
        document.addEventListener('keydown', handleEscKey);

        const closeModal = () => {
            document.body.removeChild(overlay);
            document.removeEventListener('keydown', handleEscKey);
        };
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
        modal.querySelector('.close-btn').addEventListener('click', closeModal);
    });
}

async function getAiResponse(userMessage) {
    const indicatorBubble = createTypingIndicator();
    let replyTextElement;
    let accumulatedThoughts = '';
    let timerInterval; // Variabel untuk menyimpan interval
    const startTime = Date.now(); // Catat waktu mulai

    // Cari elemen timer yang baru saja kita buat di dalam gelembung indikator
    const timerElement = indicatorBubble.querySelector('.typing-timer');

    if (timerElement) {
        // Mulai interval yang akan mengupdate timer setiap 100 milidetik
        timerInterval = setInterval(() => {
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
            timerElement.textContent = `${elapsedTime}s`;
        }, 100); // Update setiap 0.1 detik
    }
    const apiSettings = JSON.parse(localStorage.getItem('apiSettings') || '{}');
    const selectedModel = apiSettings.model || 'models/gemini-2.5-flash';
    const customApiKey = apiSettings.apiKey || null;
    const savedData = localStorage.getItem('characterData');
    const characterData = savedData ? JSON.parse(savedData) : {};
    const savedUserData = localStorage.getItem('userData');
    const userData = savedUserData ? JSON.parse(savedUserData) : {};

    try {
        const memoryData = JSON.parse(localStorage.getItem('memoryData') || '[]');
        const worldData = JSON.parse(localStorage.getItem('worldData') || '[]');
        const npcData = JSON.parse(localStorage.getItem('npcData') || '[]');
        let currentSummary = "";
        if (currentConversationId) {
            const currentConvo = await db.conversations.get(currentConversationId);
            if (currentConvo && currentConvo.summary) {
                currentSummary = currentConvo.summary;
                console.log("%cMengambil ringkasan dari DB untuk dikirim ke AI:", "color: #87CEEB;", currentSummary);
            }
        }
        // https://toukakazou.pythonanywhere.com/chat
        // http://127.0.0.1:5000/chat
        const response = await fetch('http://127.0.0.1:5000/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: userMessage,
                history: chatHistory, // <-- TAMBAHKAN INI
                character: characterData,
                user: userData, // <-- TAMBAHKAN BARIS INI
                memory: memoryData,
                world_info: worldData,
                npcs: npcData,
                summary: currentSummary,
                model: selectedModel,
                api_key: customApiKey
            }),
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let firstChunk = true;

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                // Saat streaming selesai, HENTIKAN interval timer
                if (timerInterval) {
                    clearInterval(timerInterval);
                }
                break; // Keluar dari loop
            }

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = JSON.parse(line.substring(6));

                    if (firstChunk && data.type === 'reply') {
                        const messageTextContainer = indicatorBubble.querySelector('.message-text');
                        messageTextContainer.innerHTML = '<p></p>';
                        replyTextElement = messageTextContainer.querySelector('p');
                        firstChunk = false;
                    }

                    if (data.type === 'reply' && replyTextElement) {
                        replyTextElement.textContent += data.content;
                    } else if (data.type === 'thought') {
                        accumulatedThoughts += data.content;
                    }
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                    scrollToBottom();
                }
            }
        }

        // Setelah streaming selesai, format teksnya dan tambahkan ikon
        // ▼▼▼ GANTI BLOK LAMA DENGAN VERSI DEXIE INI ▼▼▼

        // Setelah streaming selesai...
        // Cek dulu apakah AI memberikan balasan teks
        if (replyTextElement && replyTextElement.textContent.trim() !== '') {
            const aiReplyText = replyTextElement.textContent;
            formatMarkdown(replyTextElement);
            const finalThoughts = accumulatedThoughts.trim();
            const messageData = {
                conversation_id: currentConversationId, // <-- PENTING!
                role: 'model',
                content: aiReplyText,
                timestamp: new Date(),
                thoughts: finalThoughts
            };

            try {
                const newId = await db.messages.add(messageData);
                indicatorBubble.id = `msg-${newId}`;
                indicatorBubble.dataset.id = newId;
                chatHistory.push({
                    id: `msg-${newId}`,
                    role: 'model',
                    parts: [aiReplyText]
                });

                if (finalThoughts) { // Jika ada pikiran...
                    indicatorBubble.dataset.thoughts = finalThoughts; // Tetap set dataset untuk tampilan instan
                    addDropdownIcon(indicatorBubble); // Tampilkan ikon '💡'
                }
            } catch (error) {
                console.error("Gagal menyimpan pesan AI ke IndexedDB:", error);
            }
        } else {
            indicatorBubble.remove();
        }
        // ▲▲▲ SELESAI BLOK PENGGANTI ▲▲▲

    } catch (error) {
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        if (indicatorBubble) indicatorBubble.remove();
        createMessageBubble('ai', 'Gagal terhubung ke server.');
        console.error("Fetch Error:", error);
    }
}

// Taruh ini di atas atau di bawah fungsi getAiResponse

async function handleSummarization() {
    const SUMMARY_INTERVAL = 10;

    // Log baru yang lebih informatif untuk debugging
    console.log(`Pengecekan ringkasan... Total History: ${chatHistory.length}, Terakhir meringkas di interval: ${lastSummaryCount}`);

    // INI LOGIKA BARUNYA:
    // Apakah panjang history sudah MELEBIHI atau SAMA DENGAN interval ringkasan berikutnya?
    if (chatHistory.length >= lastSummaryCount + SUMMARY_INTERVAL) {

        console.log(`%cALARM BERBUNYI! Panjang history (${chatHistory.length}) telah mencapai ambang batas berikutnya. Memulai proses peringkasan...`, 'color: #ffc107; font-weight: bold;');

        // Tandai bahwa kita SUDAH melewati ambang batas ini, jadi tidak akan dipanggil lagi sampai ambang batas berikutnya
        lastSummaryCount += SUMMARY_INTERVAL;

        try {
            const currentConvo = await db.conversations.get(currentConversationId);
            if (!currentConvo) {
                console.error("Gagal menemukan sesi percakapan saat ini di DB untuk meringkas.");
                return;
            }
            const oldSummary = currentConvo.summary || "";

            // Ambil hanya pesan-pesan baru sejak ringkasan terakhir
            const historyToSummarize = chatHistory.slice(-SUMMARY_INTERVAL);
            const apiSettings = JSON.parse(localStorage.getItem('apiSettings') || '{}');
            // http://127.0.0.1:5000/summarize
            // https://toukakazou.pythonanywhere.com/summarize
            const response = await fetch('http://127.0.0.1:5000/summarize', { // Pastikan URL sudah benar
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    history: historyToSummarize,
                    api_key: apiSettings.apiKey || null, // <-- TAMBAHKAN INI
                    model: apiSettings.model || 'models/gemini-2.5-flash-latest' // <-- TAMBAHKAN INI
                }),
            });

            if (!response.ok) {
                throw new Error('Gagal mendapatkan respon dari server peringkasan.');
            }

            const data = await response.json();
            const newSummary = data.summary;

            if (newSummary) {
                const updatedSummary = (oldSummary + "\n" + newSummary).trim();
                await db.conversations.update(currentConversationId, { summary: updatedSummary });
                console.log(`%cRingkasan baru berhasil disimpan ke DB!`, 'color: #43b581; font-weight: bold;');
            } else {
                console.log("Tidak ada ringkasan baru yang diterima dari server.");
            }
        } catch (error) {
            console.error("Error selama proses handleSummarization:", error);
            // Jika gagal, kita kurangi lagi counternya agar bisa dicoba lagi nanti
            lastSummaryCount -= SUMMARY_INTERVAL;
        }
    }
}
// ▼▼▼ GANTI DENGAN VERSI FINAL INI ▼▼▼
// ▼▼▼ GANTI FUNGSI sendMessage-mu DENGAN VERSI INI ▼▼▼
async function sendMessage() {
    if (isReplying) {
        console.log("Proses sedang berjalan, pesan baru diabaikan.");
        return;
    }

    const messageText = inputArea.value.trim();
    if (!messageText) return;

    // Pastikan ada sesi aktif sebelum mengirim
    if (!currentConversationId) {
        alert("Terjadi kesalahan: Tidak ada sesi aktif. Coba refresh halaman.");
        return;
    }

    isReplying = true;
    try {
        // HAPUS SEMUA LOGIKA 'if (!currentConversationId)' YANG LAMA
        // Langsung saja ke logika mengirim pesan:

        const messageData = {
            conversation_id: currentConversationId,
            role: 'user',
            content: messageText,
            timestamp: new Date()
        };
        const newDbId = await db.messages.add(messageData);
        const messageIdString = `msg-${newDbId}`;
        const userBubble = createMessageBubble('user', messageText, messageIdString);
        formatMarkdown(userBubble.querySelector('.message-text p'));
        scrollToBottom(); // Panggil fungsi kita // <-- Perbaikan bug markdown
        chatHistory.push({
            id: messageIdString,
            role: 'user',
            parts: [messageText]
        });
        inputArea.value = '';
        inputArea.focus();
        await getAiResponse(messageText);
        await handleSummarization(); // Tambahkan await di sini untuk memastikan kita menunggu

    } catch (error) {
        console.error("Gagal total saat mengirim pesan:", error);
        alert("Gagal mengirim pesan, silakan coba lagi.");
    } finally {
        // APA PUN YANG TERJADI (sukses atau gagal), BUKA KEMBALI KUNCINYA.
        isReplying = false;
        console.log("Proses selesai, kunci dibuka.");
    }
}

// --- DI DALAM script.js ---

// HANYA ADA SATU BLOK INI DI SELURUH FILE
document.addEventListener('DOMContentLoaded', () => {
    // Guard clause, jika bukan halaman chat, jangan jalankan apa-apa
    if (!document.querySelector('.chat-container')) return;

    // --- SETUP AWAL HALAMAN CHAT ---
    const characterData = JSON.parse(localStorage.getItem('characterData') || '{ "name": "Hana" }');
    const headerName = document.querySelector('.chat-header .character-info h2');
    if (headerName) {
        headerName.textContent = characterData.name;
    }

    const apiSettings = JSON.parse(localStorage.getItem('apiSettings') || '{}');
    const activeModelId = apiSettings.model || 'models/gemini-2.5-flash';

    let modelName = "Gemini 2.5 Flash";
    if (activeModelId.includes('pro')) {
        modelName = "Gemini 2.5 Pro";
    }

    if (modelNotification) {
        modelNotification.textContent = `Mode Aktif: ${modelName}`;
        modelNotification.classList.add('show');

        setTimeout(() => {
            modelNotification.classList.remove('show');
        }, 4000);
    }
    // Ambil session_id dari URL
    const urlParams = new URLSearchParams(window.location.search);
    const sessionIdFromUrl = urlParams.get('session_id');

    // Muat history berdasarkan ID dari URL (atau muat yang terakhir jika tidak ada)
    loadChatHistory(sessionIdFromUrl ? parseInt(sessionIdFromUrl) : null);


    // --- EVENT LISTENERS (HANYA SATU KALI INISIALISASI) ---
    const inputField = document.querySelector('.chat-input-area textarea');
    if (inputField) {
        // Simpan tinggi awal
        const initialHeight = inputField.style.height;

        inputField.addEventListener('input', () => {
            // Reset dulu tingginya biar bisa ngukur ulang dengan benar
            inputField.style.height = initialHeight;
            // Ambil tinggi scroll (tinggi konten sebenarnya)
            const scrollHeight = inputField.scrollHeight;
            // Set tinggi baru sesuai tinggi konten
            inputField.style.height = `${scrollHeight}px`;
        });
    }
    // Listener untuk tombol send dan input area
    sendButton.addEventListener('click', sendMessage);
    inputArea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    // Listener untuk tombol menu header (☰)
    menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
    });

    // Listener untuk tombol New Chat (+)
    const newChatButton = document.querySelector('.new-chat-button');
    if (newChatButton) {
        newChatButton.addEventListener('click', () => {
            if (confirm('Apakah kamu yakin ingin memulai percakapan baru?')) {
                startNewConversation();
            }
        });
    }

    // Listener utama untuk semua aksi di dalam chat (delegasi event)
    chatMessages.addEventListener('click', async (e) => {
        const target = e.target;
        const messageBubble = target.closest('.message');
        if (target.classList.contains('avatar')) {
            e.preventDefault(); // Mencegah aksi default jika avatar ada di dalam link

            // Ambil URL gambar dari elemen yang diklik
            const imageUrl = target.src;

            // Panggil fungsi untuk membuat dan menampilkan popup
            createAvatarPopup(imageUrl);
            return; // Hentikan eksekusi lebih lanjut
        }
        if (!messageBubble) return;
        const dropdown = messageBubble.querySelector('.message-dropdown-menu');
        // Logika untuk menampilkan/menyembunyikan menu per pesan (⋮)
        if (target.classList.contains('message-menu-button')) {
            const wasHidden = dropdown.classList.contains('hidden');

            // Sembunyikan SEMUA menu lain dulu, tanpa kecuali.
            document.querySelectorAll('.message-dropdown-menu').forEach(menu => {
                menu.classList.add('hidden');
            });

            // Jika menu yang diklik tadi awalnya tersembunyi, sekarang tampilkan.
            if (wasHidden) {
                dropdown.classList.remove('hidden');
            }

            return; // Hentikan eksekusi lebih lanjut
        }

        // Logika tombol di dalam dropdown pesan
        const messageId = messageBubble.dataset.id;
        const messageIdString = `msg-${messageId}`;

        // Hapus pesan
        if (target.classList.contains('delete')) {
            // Logika hapus pesanmu akan ada di sini
            dropdown.classList.add('hidden');
            if (confirm('Yakin ingin menghapus pesan ini?')) { // <-- INI UDAH BENER
                try {
                    await db.messages.delete(parseInt(messageId));
                    messageBubble.remove();
                    const index = chatHistory.findIndex(msg => msg.id === messageIdString);
                    if (index > -1) chatHistory.splice(index, 1);
                } catch (error) { console.error("Gagal hapus pesan:", error); }
            }
        }

        // Edit pesan
        if (target.classList.contains('edit')) {
            dropdown.classList.add('hidden');
            // CEK DULU: Apakah sudah ada area edit di dalam bubble ini?
            if (messageBubble.querySelector('.edit-area')) {
                messageBubble.classList.add('is-editing');
                console.log("Mode edit sudah aktif, tidak melakukan apa-apa.");
                return; // Jika sudah ada, langsung hentikan fungsi.
            }
            enterEditMode(messageBubble);
        }

        // Regenerate
        if (target.classList.contains('regenerate')) {
            dropdown.classList.add('hidden');
            try {
                // Hapus pesan AI dari DB dan tampilan
                await db.messages.delete(parseInt(messageId));
                messageBubble.remove();

                // Hapus dari history lokal
                const messageIndex = chatHistory.findIndex(msg => msg.id === messageIdString);
                if (messageIndex > -1) {
                    chatHistory.splice(messageIndex, 1);
                }

                // Cari pesan user terakhir sebelum pesan AI ini sebagai pemicu
                let triggerMessage = "";
                // Kita mulai dari index pesan AI yang dihapus, lalu mundur ke belakang
                for (let i = messageIndex - 1; i >= 0; i--) {
                    if (chatHistory[i].role === 'user') {
                        triggerMessage = chatHistory[i].parts[0];
                        break; // Ketemu, langsung berhenti
                    }
                }

                if (triggerMessage) {
                    console.log("Memicu regenerate dengan pesan:", triggerMessage);
                    getAiResponse(triggerMessage);
                } else {
                    console.error("Tidak ditemukan pesan user sebelumnya untuk me-regenerate.");
                }

            } catch (error) { console.error("Gagal saat regenerate:", error); }
        }

        // Kirim ulang
        // MODIFIKASI BLOK INI
        if (target.classList.contains('resend')) {
            dropdown.classList.add('hidden');
            const userMessageBubble = messageBubble; // Ganti nama biar lebih jelas

            // --- LOGIKA BARU DIMULAI DI SINI ---

            // 1. CARI PESAN ASLI DI chatHistory, BUKAN DARI HTML
            const messageFromHistory = chatHistory.find(msg => msg.id === userMessageBubble.id);
            if (!messageFromHistory) {
                console.error("Gagal menemukan pesan di history untuk dikirim ulang!");
                return;
            }
            const originalMessageText = messageFromHistory.parts[0];

            // 1. Kumpulkan semua yang mau kita hapus biar rapi
            const bubblesToDelete = [userMessageBubble];
            const dbIdsToDelete = [parseInt(userMessageBubble.dataset.id)];
            const historyIdsToDelete = new Set([userMessageBubble.id]);

            // 2. Cek elemen selanjutnya, apakah itu balasan AI?
            const nextBubble = userMessageBubble.nextElementSibling;
            if (nextBubble && nextBubble.classList.contains('ai-message')) {
                bubblesToDelete.push(nextBubble);
                dbIdsToDelete.push(parseInt(nextBubble.dataset.id));
                historyIdsToDelete.add(nextBubble.id);
            }

            // 3. Hapus semua yang terkumpul dari DB, Tampilan, dan Array Lokal
            try {
                // Hapus dari IndexedDB
                if (dbIdsToDelete.length > 0) {
                    await db.messages.bulkDelete(dbIdsToDelete);
                }

                // Hapus dari Tampilan
                bubblesToDelete.forEach(bubble => bubble.remove());

                // Hapus dari array chatHistory (cara yang lebih aman)
                chatHistory = chatHistory.filter(msg => !historyIdsToDelete.has(msg.id));

            } catch (error) {
                console.error("Gagal menghapus paket pesan (user+ai) dari DB:", error);
            }

            // 4. Kirim ulang pesan seperti biasa
            inputArea.value = originalMessageText;
            sendMessage();
        }
    });

    // Listener untuk menutup semua dropdown jika klik di luar
    window.addEventListener('click', (e) => {
        // Tutup dropdown header
        if (!e.target.closest('.header-menu')) {
            dropdownMenu.classList.add('hidden');
        }
        // Tutup dropdown pesan
        if (!e.target.closest('.message-content')) {
            document.querySelectorAll('.message-dropdown-menu').forEach(menu => {
                menu.classList.add('hidden');
            });
        }
    });
});