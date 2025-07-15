// js/script.js - VERSI FINAL DENGAN SEMUA FITUR LENGKAP

// --- 1. Seleksi Semua Elemen ---
const chatMessages = document.querySelector('.chat-messages');
const inputArea = document.querySelector('.chat-input-area textarea');
const sendButton = document.querySelector('.send-button');
const menuButton = document.querySelector('.menu-button');
const dropdownMenu = document.querySelector('.dropdown-menu');
const modelNotification = document.getElementById('model-notification');
const uploadButton = document.getElementById('upload-button');
const imageUploadInput = document.getElementById('image-upload-input');
const imagePreviewContainer = document.getElementById('image-preview-container');
const imagePreview = document.getElementById('image-preview');
const removeImageButton = document.getElementById('remove-image-button');
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

// ... (setelah db.version(7)...)

// ▼▼▼ TAMBAHKAN VERSI BARU INI ▼▼▼
db.version(8).stores({
    // Definisi dari v7 disalin, lalu kita tambahkan 'imageData'
    messages: '++id, conversation_id, timestamp, thoughts, imageData, [conversation_id+timestamp]',
    conversations: '++id, &timestamp, summary, character_name, character_avatar'
}).upgrade(tx => {
    // Fungsi upgrade ini penting agar data lama tidak error.
    console.log("Upgrading database to version 8, adding imageData column.");
    return tx.table('messages').toCollection().modify(msg => {
        if (msg.imageData === undefined) {
            msg.imageData = null; // Isi dengan null untuk pesan lama
        }
    });
});
// ▲▲▲ SELESAI ▲▲▲

console.log("✅ Database Dexie (v2) dengan tabel 'conversations' siap.");


let chatHistory = [];
let abortController = new AbortController();
let currentConversationId = null;
let isReplying = false;
let lastSummaryCount = 0;
let selectedFile = null;
const SUMMARY_INTERVAL = 10;
let activeImageInfo = null;// <-- TAMBAHKAN INI
const sentImageFiles = new Map();
// GANTI TOTAL FUNGSI loadChatHistory DENGAN INI
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
        activeImageInfo = null;      // Reset info gambar juga! PENTING!

        if (conversationToLoad) {
            currentConversationId = conversationToLoad.id;
            const messagesFromDb = await db.messages
                .where({ conversation_id: currentConversationId })
                .sortBy('timestamp');

            // Loop dan isi ulang dari awal
            for (const msg of messagesFromDb) {
                // Fungsi createMessageBubble sudah pintar, dia ambil nama dari localStorage
                const bubble = createMessageBubble(msg.role === 'model' ? 'ai' : 'user', msg.content, `msg-${msg.id}`);

                // Cek dan tampilkan gambar jika ada
                if (msg.imageData) {
                    const messageTextContainer = bubble.querySelector('.message-text');
                    const imageElement = document.createElement('img');
                    imageElement.src = msg.imageData;
                    imageElement.className = 'sent-image';
                    messageTextContainer.insertBefore(imageElement, messageTextContainer.firstChild);

                    // Jika tidak ada teks, sembunyikan elemen <p>
                    if (!msg.content) {
                        const pElement = messageTextContainer.querySelector('p');
                        if (pElement) pElement.style.display = 'none';
                    }
                }

                formatMarkdown(bubble.querySelector('.message-text p'));

                if (msg.thoughts && msg.thoughts.trim() !== '') {
                    bubble.dataset.thoughts = msg.thoughts;
                    addDropdownIcon(bubble);
                }

                // Masukkan ke array history untuk dikirim ke AI nanti
                chatHistory.push({
                    id: `msg-${msg.id}`,
                    role: msg.role,
                    parts: [msg.content]
                });
            }
            lastSummaryCount = Math.floor(chatHistory.length / SUMMARY_INTERVAL) * SUMMARY_INTERVAL;
            console.log(`History dimuat. lastSummaryCount di-set ke: ${lastSummaryCount}`);
        } else {
            console.log("Database kosong, membuat sesi pertama...");
            // Jika sesi baru, pastikan lastSummaryCount juga 0.
            lastSummaryCount = 0;
            await startNewConversation();
        }

        scrollToBottom();

    } catch (error) {
        // Log error yang lebih informatif
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

function createMessageBubble(sender, text, messageId = null, isError = false) {
    const savedCharData = localStorage.getItem('characterData');
    const characterData = savedCharData ? JSON.parse(savedCharData) : { name: "Hana" };
    const savedUserData = localStorage.getItem('userData');
    const userData = savedUserData ? JSON.parse(savedUserData) : { name: "User" };
    const senderName = sender === 'user' ? userData.name : characterData.name;
    const avatarUrl = sender === 'user' ? userData.avatar_url : characterData.avatar_url;

    const messageDiv = document.createElement('div');
    messageDiv.id = messageId || `msg-${Date.now()}-${Math.random()}`;
    messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'ai-message');
    if (isError) {
        messageDiv.classList.add('error-message');
    }
    // Tambahkan data-id untuk mempermudah pengambilan ID numerik
    messageDiv.dataset.id = messageId ? messageId.replace('msg-', '') : '';

    let menuItems = '';
    if (isError) {
        // Jika ini pesan error, hanya ada tombol hapus
        menuItems = `<button class="delete-error">🗑️ Hapus</button>`;
    } else if (sender === 'user') {
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
// ▼▼▼ TAMBAHKAN FUNGSI BARU INI ▼▼▼
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        event.target.value = null;
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
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

// Taruh di bawah fungsi createTypingIndicator()

// FUNGSI BARU UNTUK EFEK MESIN KETIK
function typewriterEffect(element, text, speed = 10) {
    return new Promise(resolve => {
        let i = 0;
        function type() {
            if (i < text.length) {
                // Cek apakah ada tag markdown, jika ada, lewati biar nggak aneh
                if (text.charAt(i) === '*' && text.charAt(i + 1) === '*') {
                    // Untuk **bold**
                    const closingIndex = text.indexOf('**', i + 2);
                    if (closingIndex !== -1) {
                        element.textContent += text.substring(i, closingIndex + 2);
                        i = closingIndex + 2;
                    } else {
                        element.textContent += text.charAt(i);
                        i++;
                    }
                } else if (text.charAt(i) === '*') {
                    // Untuk *italic*
                    const closingIndex = text.indexOf('*', i + 1);
                    if (closingIndex !== -1) {
                        element.textContent += text.substring(i, closingIndex + 1);
                        i = closingIndex + 1;
                    } else {
                        element.textContent += text.charAt(i);
                        i++;
                    }
                }
                else {
                    element.textContent += text.charAt(i);
                    i++;
                }

                setTimeout(type, speed);
            } else {
                resolve(); // Beri tahu kalau ngetik teks ini sudah selesai
            }
        }
        type();
    });
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
    // Variabel untuk melacak posisi sentuhan terakhir
    let lastTouchX = 0;
    let lastTouchY = 0;

    function onDragStart(e) {
        if (e.target === closeBtn) return;
        isDragging = true;
        popup.classList.add('is-dragging');

        // Jika ini event sentuhan, simpan posisi awal sentuhan
        if (e.type === 'touchstart') {
            lastTouchX = e.touches[0].clientX;
            lastTouchY = e.touches[0].clientY;
        }
    }

    function onDragMove(e) {
        if (!isDragging) return;
        // Mencegah layar scroll pas kita lagi geser avatar di HP
        e.preventDefault();

        let movementX, movementY;

        if (e.type === 'mousemove') {
            // Logika untuk Mouse
            movementX = e.movementX;
            movementY = e.movementY;
        } else { // Logika untuk Touch
            const touch = e.touches[0];
            movementX = touch.clientX - lastTouchX;
            movementY = touch.clientY - lastTouchY;
            // Update posisi sentuhan terakhir
            lastTouchX = touch.clientX;
            lastTouchY = touch.clientY;
        }

        targetX += movementX;
        targetY += movementY;
    }

    function onDragEnd() {
        if (!isDragging) return;
        isDragging = false;
        popup.classList.remove('is-dragging');
        scaleVelocity += 0.05;
    }

    // Daftarkan event untuk Mouse
    popup.addEventListener('mousedown', onDragStart);
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);

    // Daftarkan event untuk Sentuhan (Touch)
    popup.addEventListener('touchstart', onDragStart, { passive: false });
    window.addEventListener('touchmove', onDragMove, { passive: false });
    window.addEventListener('touchend', onDragEnd);
    window.addEventListener('touchcancel', onDragEnd); // Jaga-jaga jika sentuhan dibatalkan sistem

    const closePopup = () => {
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        if (popup.parentNode) popup.parentNode.removeChild(popup);
        // Hapus semua event listener dari window saat popup ditutup biar hemat memori
        window.removeEventListener('mousemove', onDragMove);
        window.removeEventListener('mouseup', onDragEnd);
        window.removeEventListener('touchmove', onDragMove);
        window.removeEventListener('touchend', onDragEnd);
        window.removeEventListener('touchcancel', onDragEnd);
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

        // Cek dulu, jangan-jangan popup-nya sudah ada
        if (document.querySelector('.thought-overlay')) return;

        // --- BUAT ELEMEN SEKALI SAJA ---
        const thoughtsParagraph = document.createElement('p');
        thoughtsParagraph.textContent = thoughts;
        formatMarkdown(thoughtsParagraph);

        const overlay = document.createElement('div');
        overlay.className = 'thought-overlay';
        const modal = document.createElement('div');
        modal.className = 'thought-modal';

        modal.innerHTML = `
        <button class="close-btn">×</button>
        <h3>Pikiran Hana</h3>
        ${thoughtsParagraph.outerHTML}
    `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // --- FUNGSI UNTUK MENUTUP ---
        const closeModal = () => {
            // 1. Hapus kelas 'active' untuk memicu animasi keluar
            overlay.classList.remove('active');

            // 2. Hapus elemen dari DOM SETELAH animasi selesai
            overlay.addEventListener('transitionend', () => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            }, { once: true }); // {once: true} biar listenernya otomatis kehapus

            document.removeEventListener('keydown', handleEscKey);
        };

        const handleEscKey = (e) => {
            if (e.key === 'Escape') closeModal();
        };

        // --- AKTIFKAN POPUP ---
        // Pake setTimeout 0 untuk memastikan elemen sudah ada di DOM sebelum kita nambahin kelas 'active'
        // Ini trik biar transisi CSS-nya jalan dengan benar
        setTimeout(() => {
            overlay.classList.add('active');
            document.addEventListener('keydown', handleEscKey);
        }, 0);


        // --- EVENT LISTENER UNTUK MENUTUP ---
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeModal();
        });
        modal.querySelector('.close-btn').addEventListener('click', closeModal);
    });
}

// ▼▼▼ TAMBAHKAN FUNGSI BARU INI ▼▼▼
function animateTextFadeIn(textElement) {
    // Ambil teks asli
    const originalText = textElement.textContent;
    // Pecah jadi kata-kata (atau karakter jika kamu mau)
    const words = originalText.split(' ');

    // Kosongkan elemennya
    textElement.innerHTML = '';

    words.forEach((word, index) => {
        const wordSpan = document.createElement('span');
        wordSpan.textContent = word + ' '; // Tambah spasi lagi
        wordSpan.className = 'word-fade-in';
        // Atur jeda animasi berdasarkan urutan kata
        wordSpan.style.animationDelay = `${index * 0.05}s`; // Makin besar angkanya, makin lambat
        textElement.appendChild(wordSpan);
    });
}
// ▲▲▲ SELESAI FUNGSI BARU ▲▲▲

async function getAiResponse(userMessage, fileToSend = null) {
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

        // --- LOGIKA BARU: Gunakan FormData untuk mengirim data ---
        const formData = new FormData();
        formData.append('message', userMessage);
        formData.append('history', JSON.stringify(chatHistory));
        formData.append('character', JSON.stringify(characterData));
        formData.append('user', JSON.stringify(userData));
        formData.append('memory', JSON.stringify(memoryData));
        formData.append('world_info', JSON.stringify(worldData));
        formData.append('npcs', JSON.stringify(npcData));
        formData.append('summary', currentSummary);
        formData.append('model', selectedModel);
        if (customApiKey) {
            formData.append('api_key', customApiKey);
        }
        if (fileToSend) {
            formData.append('image', fileToSend); // Kirim file baru
        }
        // Jika tidak ada file baru, cek apakah ada URI LAMA yang tersimpan
        else if (activeImageInfo) {
            console.log('%c📌 Mengirim URI gambar yang sudah ada ke backend...', 'color: #87CEEB', activeImageInfo.uri);
            formData.append('active_image_uri', activeImageInfo.uri);
            formData.append('active_image_mime', activeImageInfo.mime);
        }
        // https://toukakazou.pythonanywhere.com/chat
        // http://127.0.0.1:5000/chat
        const response = await fetch('/chat', {
            method: 'POST',
            // JANGAN SET HEADERS 'Content-Type', browser akan otomatis menentukannya untuk FormData
            body: formData, // Kirim formData langsung
            signal: abortController.signal
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let firstChunk = true;

        console.log("--- MEMULAI STREAMING DARI SERVER ---"); // <-- LOG #1
        let hasReceivedData = false;
        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                if (!hasReceivedData) {
                    // Jika loop selesai tapi tidak ada data sama sekali, ini masalahnya
                    console.error("Server menutup koneksi tanpa mengirim data apapun.");
                    indicatorBubble.querySelector('.message-text').innerHTML = `<p style="color: #f04747;">Error: Server tidak merespon.</p>`;
                }
                // Hentikan timer saat streaming selesai
                if (timerInterval) clearInterval(timerInterval);
                break;
            }
            hasReceivedData = true;
            const chunk = decoder.decode(value);
            const lines = chunk.split('\n\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));

                        // INI KUNCI BARU: Tangani pesan error dari server
                        if (data.type === 'image_uri') {
                            console.log('%c📸 URI Gambar Diterima dan Disimpan!', 'color: #fca5b2', data);
                            activeImageInfo = { uri: data.uri, mime: data.mime };
                        } else if (data.type === 'error') {
                            console.error("Error dari Server:", data.content);
                            // Hapus bubble 'mengetik' yang lama
                            indicatorBubble.remove();
                            // Buat bubble error yang baru dan bisa dihapus
                            createMessageBubble('ai', `Error: ${data.content}`, null, true);
                            if (timerInterval) clearInterval(timerInterval);
                            return;
                        } else if (data.type === 'reply') {
                            if (firstChunk) {
                                const messageTextContainer = indicatorBubble.querySelector('.message-text');
                                if (messageTextContainer) {
                                    messageTextContainer.innerHTML = '<p></p>';
                                    replyTextElement = messageTextContainer.querySelector('p');
                                }
                                firstChunk = false;
                            }
                            if (replyTextElement) {
                                // Kita panggil fungsi typewriter kita di sini dan tunggu sampai selesai
                                await typewriterEffect(replyTextElement, data.content, 15); // <-- GANTI DENGAN INI
                            }
                        } else if (data.type === 'thought') {
                            accumulatedThoughts += data.content;
                        }

                        scrollToBottom();

                    } catch (e) {
                        console.error("Gagal parse JSON dari server:", e);
                    }
                }
            }
        }

        // Setelah streaming selesai, format teksnya dan tambahkan ikon
        // ▼▼▼ GANTI BLOK LAMA DENGAN VERSI DEXIE INI ▼▼▼

        // Setelah streaming selesai...
        // Cek dulu apakah AI memberikan balasan teks
        if (replyTextElement && replyTextElement.textContent.trim() !== '') {
            const aiReplyText = replyTextElement.textContent;
            replyTextElement.style.opacity = '0';

            // Lakukan format markdown
            formatMarkdown(replyTextElement);

            // Tampilkan lagi dengan transisi
            setTimeout(() => {
                replyTextElement.style.transition = 'opacity 0.5s ease';
                replyTextElement.style.opacity = '1';
            }, 50);
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
                    parts: [aiReplyText],
                    thoughts: finalThoughts
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

    } // PASTE KODE INI DI TEMPAT YANG LAMA
    catch (error) {
        // Hentikan timer apa pun yang terjadi
        if (timerInterval) {
            clearInterval(timerInterval);
        }

        // Cek jenis errornya
        if (error.name === 'AbortError') {
            // Ini terjadi jika tombol STOP ditekan
            console.log("Fetch dihentikan oleh pengguna.");
            if (indicatorBubble) {
                const messageTextElement = indicatorBubble.querySelector('.message-text p');
                // Cek apakah AI sudah sempat menghasilkan teks
                if (messageTextElement && messageTextElement.textContent.trim()) {
                    // Jika ya, kita finalisasi pesan parsial ini
                    console.log("Menyimpan respons parsial...");
                    const partialReply = messageTextElement.textContent;
                    formatMarkdown(messageTextElement); // Format apa yang sudah ada

                    // Simpan ke DB (ini sama seperti logika di akhir 'try')
                    const messageData = {
                        conversation_id: currentConversationId,
                        role: 'model',
                        content: partialReply,
                        timestamp: new Date(),
                        thoughts: accumulatedThoughts.trim() // Simpan juga thoughts yg sudah ada
                    };

                    // Kita tidak pakai 'await' di sini karena ini di dalam 'catch'
                    db.messages.add(messageData).then(newId => {
                        indicatorBubble.id = `msg-${newId}`;
                        indicatorBubble.dataset.id = newId;
                        chatHistory.push({ id: `msg-${newId}`, role: 'model', parts: [partialReply] });
                        if (messageData.thoughts) {
                            indicatorBubble.dataset.thoughts = messageData.thoughts;
                            addDropdownIcon(indicatorBubble);
                        }
                    }).catch(dbError => {
                        console.error("Gagal simpan respons parsial ke DB:", dbError);
                    });

                } else {
                    // Jika AI belum menghasilkan teks sama sekali, hapus bubble 'typing'
                    indicatorBubble.remove();
                }
            }
        } else {
            // Ini untuk error lain (misal: gagal konek ke server, API key salah, dll)
            console.error("Fetch Error (bukan Abort):", error);
            if (indicatorBubble) indicatorBubble.remove(); // Hapus bubble 'typing'
            createMessageBubble('ai', 'Waduh, ada masalah koneksi nih.', null, true); // Kasih pesan error yang jelas
        }
    }
}

// Taruh ini di atas atau di bawah fungsi getAiResponse

async function handleSummarization() {
    // Kita sudah pindahkan SUMMARY_INTERVAL ke atas jadi bisa dihapus dari sini

    console.log(`Pengecekan ringkasan... Total History: ${chatHistory.length}, Terakhir meringkas di interval: ${lastSummaryCount}`);

    if (chatHistory.length >= lastSummaryCount + SUMMARY_INTERVAL) {
        console.log(`%cALARM BERBUNYI! Panjang history (${chatHistory.length}) telah mencapai ambang batas berikutnya. Memulai proses peringkasan...`, 'color: #ffc107; font-weight: bold;');

        const targetSummaryCount = lastSummaryCount + SUMMARY_INTERVAL;

        try {
            const currentConvo = await db.conversations.get(currentConversationId);
            if (!currentConvo) {
                console.error("Gagal menemukan sesi percakapan saat ini di DB untuk meringkas.");
                return;
            }

            // Ambil ringkasan LAMA yang sudah ada di database
            const oldSummary = currentConvo.summary || "";

            // Ambil hanya chat baru yang perlu diringkas
            const historyToSummarize = chatHistory.slice(lastSummaryCount, targetSummaryCount);

            console.log(`Mengirim ${historyToSummarize.length} pesan untuk diringkas (dari indeks ${lastSummaryCount} sampai ${targetSummaryCount})`);

            const apiSettings = JSON.parse(localStorage.getItem('apiSettings') || '{}');

            const response = await fetch('/summarize', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    history: historyToSummarize,
                    old_summary: oldSummary, // <-- KIRIM RINGKASAN LAMA KE BACKEND
                    api_key: apiSettings.apiKey || null,
                    model: apiSettings.model || 'models/gemini-2.5-flash-latest'
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Gagal mendapatkan respon dari server peringkasan.');
            }
            lastSummaryCount = targetSummaryCount;
            console.log(`%cProses peringkasan untuk blok ini selesai. Counter sekarang di: ${lastSummaryCount}`, 'color: #43b581; font-weight: bold;');

            const data = await response.json();
            const updatedSummaryFromServer = data.summary; // Ini adalah ringkasan LAMA + BARU dari server

            if (updatedSummaryFromServer) {
                await db.conversations.update(currentConversationId, { summary: updatedSummaryFromServer });
                console.log(`%cRingkasan baru dari server berhasil disimpan ke DB.`, 'color: #87CEEB;');
            } else {
                // Log ini hanya untuk informasi, tidak mempengaruhi alur.
                console.log("Tidak ada konten ringkasan baru yang diterima dari server untuk disimpan.");
            }
        } catch (error) {
            console.error("Error selama proses handleSummarization:", error);
            // JANGAN update counter jika gagal, agar bisa dicoba lagi nanti.
        }
    }
}

async function sendMessage(fileToResend = null) {
    const messageText = inputArea.value.trim();
    const imageFile = fileToResend || selectedFile;

    if (!messageText && !imageFile) return;
    if (isReplying) return;

    // --- Persiapan awal ---
    isReplying = true;
    abortController = new AbortController();
    sendButton.classList.add('is-stopping');
    sendButton.title = 'Hentikan';
    inputArea.value = '';
    inputArea.style.height = 'auto';
    imagePreviewContainer.classList.add('hidden');
    selectedFile = null;
    inputArea.focus();

    // --- Ubah gambar ke Base64 (jika ada) ---
    let imageDataBase64 = null;
    if (imageFile) {
        try {
            imageDataBase64 = await fileToBase64(imageFile);
        } catch (error) {
            console.error("Gagal mengubah gambar ke Base64:", error);
            // Tampilkan error ke pengguna jika perlu
            isReplying = false; // Buka kunci lagi
            sendButton.classList.remove('is-stopping');
            return;
        }
    }

    // --- Simpan pesan ke DB (sekarang dengan data gambar) ---
    const messageData = {
        conversation_id: currentConversationId,
        role: 'user',
        content: messageText,
        timestamp: new Date(),
        imageData: imageDataBase64 // <-- SIMPAN GAMBAR DI SINI
    };
    const newDbId = await db.messages.add(messageData);
    const messageIdString = `msg-${newDbId}`;

    // --- Tampilkan bubble di layar ---
    const userBubble = createMessageBubble('user', messageText, messageIdString);
    userBubble.id = messageIdString; // Pastikan ID-nya benar
    userBubble.dataset.id = newDbId;
    const messageTextContainer = userBubble.querySelector('.message-text');

    if (imageDataBase64) {
        const imageElement = document.createElement('img');
        imageElement.src = imageDataBase64; // Langsung pakai data Base64
        imageElement.className = 'sent-image';
        messageTextContainer.insertBefore(imageElement, messageTextContainer.firstChild);
    }

    // Format atau sembunyikan teks
    if (!messageText && imageFile) {
        const pElement = messageTextContainer.querySelector('p');
        if (pElement) pElement.style.display = 'none';
    } else {
        formatMarkdown(messageTextContainer.querySelector('p'));
    }

    scrollToBottom();
    chatHistory.push({ id: messageIdString, role: 'user', parts: [messageText] });

    // --- Panggil AI ---
    try {
        await getAiResponse(messageText, imageFile);
        await handleSummarization();
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Error fatal saat kirim pesan:", error);
            userBubble.remove();
        }
    } finally {
        isReplying = false;
        sendButton.classList.remove('is-stopping');
        sendButton.title = 'Kirim';
    }
}

// --- DI DALAM script.js ---

// HANYA ADA SATU BLOK INI DI SELURUH FILE
document.addEventListener('DOMContentLoaded', () => {

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
    sendButton.addEventListener('click', () => {
        if (isReplying) {
            abortController.abort();
            // ▼▼▼ TAMBAHKAN 3 BARIS INI ▼▼▼
            // isReplying = false; // Langsung set false
            // sendButton.classList.remove('is-stopping'); // Langsung balikin tampilan
            // sendButton.title = 'Kirim'; // Langsung balikin tooltip
        } else {
            sendMessage();
        }
    });
    inputArea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    inputArea.addEventListener('paste', (event) => {
        // Cek data yang ada di clipboard
        const items = (event.clipboardData || window.clipboardData).items;
        let imageFile = null;

        // Loop untuk cari item yang merupakan file gambar
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                imageFile = items[i].getAsFile();
                break; // Ketemu, langsung hentikan loop
            }
        }

        // Kalau gambar ditemukan...
        if (imageFile) {
            console.log('Gambar dari clipboard terdeteksi!', imageFile);

            // Hentikan aksi default browser (biar nggak nempel nama file di textarea)
            event.preventDefault();

            // Set file yang kita temukan ke variabel global 'selectedFile'
            // biar fungsi sendMessage() bisa ngambil dari sini
            selectedFile = imageFile;

            // Gunakan FileReader untuk membaca file dan menampilkannya di preview
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreviewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(imageFile);
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
        // GANTI TOTAL BLOK 'delete' INI
        if (target.classList.contains('delete')) {
            dropdown.classList.add('hidden');

            // Cek apakah ini pesan error atau pesan biasa
            if (messageBubble.classList.contains('error-message')) {
                // Jika pesan error, langsung hapus dari tampilan
                if (confirm('Yakin ingin menghapus pesan error ini?')) {
                    messageBubble.remove();
                }
            } else {
                // Jika pesan biasa, hapus dari DB dan tampilan
                if (confirm('Yakin ingin menghapus pesan ini?')) {
                    try {
                        const messageId = parseInt(messageBubble.dataset.id);
                        if (!isNaN(messageId)) { // Pastikan ID adalah angka
                            await db.messages.delete(messageId);
                        }
                        messageBubble.remove();
                        const index = chatHistory.findIndex(msg => msg.id === messageIdString);
                        if (index > -1) chatHistory.splice(index, 1);
                    } catch (error) {
                        console.error("Gagal hapus pesan dari DB:", error);
                    }
                }
            }
        }
        if (target.classList.contains('delete-error')) {
            dropdown.classList.add('hidden');
            if (confirm('Yakin ingin menghapus pesan error ini?')) {
                messageBubble.remove(); // Langsung hapus dari tampilan, tidak perlu ke DB
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
            const messageId = parseInt(messageBubble.dataset.id);
            if (!messageId) return;

            try {
                // ... (ambil data dari DB) ...
                const messageToResend = await db.messages.get(messageId);
                if (!messageToResend) {
                    alert("Tidak bisa menemukan data pesan untuk dikirim ulang.");
                    return;
                }
                const originalMessageText = messageToResend.content;
                const originalImageData = messageToResend.imageData;

                // ... (hapus pesan lama) ...
                const bubblesToDelete = [messageBubble];
                const dbIdsToDelete = [messageId];
                const historyIdsToDelete = new Set([messageBubble.id]);
                const nextBubble = messageBubble.nextElementSibling;
                if (nextBubble && nextBubble.classList.contains('ai-message')) {
                    bubblesToDelete.push(nextBubble);
                    if (nextBubble.dataset.id) {
                        dbIdsToDelete.push(parseInt(nextBubble.dataset.id));
                        historyIdsToDelete.add(nextBubble.id);
                    }
                }
                if (dbIdsToDelete.length > 0) await db.messages.bulkDelete(dbIdsToDelete);
                bubblesToDelete.forEach(bubble => bubble.remove());
                chatHistory = chatHistory.filter(msg => !historyIdsToDelete.has(msg.id));

                // --- BAGIAN YANG DIPERBAIKI ---
                inputArea.value = originalMessageText;
                let fileToPass = null; // Gunakan nama variabel baru biar jelas

                if (originalImageData) {
                    const response = await fetch(originalImageData);
                    const blob = await response.blob();
                    // Isi variabel fileToPass dengan file yang dibuat ulang
                    fileToPass = new File([blob], "resend_image.jpg", { type: blob.type });

                    // Tampilkan preview
                    imagePreview.src = originalImageData;
                    imagePreviewContainer.classList.remove('hidden');
                }

                // Panggil sendMessage() dengan membawa file (atau null jika tidak ada)
                sendMessage(fileToPass); // <-- KIRIM VARIABEL BARU INI

            } catch (error) {
                console.error("Gagal saat proses kirim ulang:", error);
                alert("Terjadi kesalahan saat mencoba mengirim ulang pesan.");
            }
        }
    });
    uploadButton.addEventListener('click', () => {
        imageUploadInput.click(); // Picu input file yang tersembunyi
    });

    imageUploadInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
            selectedFile = file;
            const reader = new FileReader();
            reader.onload = (e) => {
                imagePreview.src = e.target.result;
                imagePreviewContainer.classList.remove('hidden');
            };
            reader.readAsDataURL(file);
        }
    });

    removeImageButton.addEventListener('click', () => {
        selectedFile = null;
        activeImageInfo = null;
        imageUploadInput.value = ''; // Reset input file
        imagePreviewContainer.classList.add('hidden');
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