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


let chatHistory = [];
let abortController = new AbortController();
let currentConversationId = null;
let isReplying = false;
// let lastSummaryCount = 0;
let selectedFile = null;
// let isSummarizing = false;
const SUMMARY_INTERVAL = 10;
// let activeImageInfo = null;// <-- TAMBAHKAN INI

// --- FUNGSI BARU: Manajer Status Tombol Kirim ---
// GANTI TOTAL FUNGSI updateSendButtonState DENGAN INI
function updateSendButtonState() {
    if (isReplying) {
        sendButton.classList.add('is-disabled');
        sendButton.title = 'Hentikan';
        sendButton.classList.add('is-stopping');
    } else {
        sendButton.classList.remove('is-disabled');
        sendButton.classList.remove('is-stopping');
        sendButton.title = 'Kirim';
    }
}

const sentImageFiles = new Map();
// --- SELESAI FUNGSI BARU ---
function savePendingImageToStorage(base64Image) {
    // Hanya simpan jika ada sesi aktif, biar datanya gak nyampur
    if (!currentConversationId) return;
    try {
        // Simpan gambar (dalam format teks base64) ke laci.
        // Kuncinya pake ID sesi, contoh: 'pendingImage_1'
        localStorage.setItem(`pendingImage_${currentConversationId}`, base64Image);
        console.log(`🖼️ Gambar di input box untuk sesi ${currentConversationId} berhasil disimpan ke 'laci'.`);
    } catch (e) {
        // Ini jarang terjadi, tapi bagus untuk jaga-jaga kalau laci kepenuhan.
        console.error("Gagal menyimpan gambar ke localStorage:", e);
    }
}

function loadPendingImageFromStorage() {
    // Ambil gambar dari laci pake kunci yang sama
    if (!currentConversationId) return null;
    const base64Image = localStorage.getItem(`pendingImage_${currentConversationId}`);
    if (base64Image) {
        console.log(`🖼️ Menemukan gambar di 'laci' untuk sesi ${currentConversationId}.`);
    }
    return base64Image;
}

function clearPendingImageFromStorage() {
    // Bersihkan laci setelah gambar berhasil dikirim
    if (!currentConversationId) return;
    localStorage.removeItem(`pendingImage_${currentConversationId}`);
    console.log(`🖼️ 'Laci' gambar untuk sesi ${currentConversationId} sudah dibersihkan.`);
}

// ▲▲▲ SELESAI BAGIAN 1 ▲▲▲

// GANTI TOTAL FUNGSI loadChatHistory DENGAN VERSI INI
async function loadChatHistory() {
    chatMessages.innerHTML = '';
    chatHistory = [];
    currentConversationId = null;
    activeImageInfo = null;

    const urlParams = new URLSearchParams(window.location.search);
    const sessionIdFromUrl = urlParams.get('session_id');

    if (sessionIdFromUrl && !isNaN(sessionIdFromUrl)) {
        currentConversationId = parseInt(sessionIdFromUrl);
        localStorage.setItem('lastActiveSessionId', currentConversationId);
        console.log(`Mencoba memuat sesi dari server. ID: ${currentConversationId}`);

        try {
            const response = await fetch(`/api/sessions/${currentConversationId}/messages`);
            if (!response.ok) {
                chatMessages.innerHTML = `<p class="error-message">Gagal memuat sesi. Mungkin sudah dihapus.</p>`;
                return;
            }
            const data = await response.json();
            const messagesFromServer = data.messages;

            // KUNCI UTAMA ADA DI SINI
            for (const msg of messagesFromServer) {
                // Buat bubble dulu
                const bubble = createMessageBubble(msg.role, msg.content, `msg-${msg.db_id}`, msg.sequence_number);
                const messageTextContainer = bubble.querySelector('.message-text');

                // CEK APAKAH PESAN INI PUNYA GAMBAR
                if (msg.imageData) {
                    const imageElement = document.createElement('img');
                    imageElement.src = msg.imageData; // Langsung pakai data base64 dari DB
                    imageElement.className = 'sent-image';
                    // Taruh gambar di atas teks
                    messageTextContainer.insertBefore(imageElement, messageTextContainer.firstChild);
                }

                // Jika pesan tidak ada teks (hanya gambar), sembunyikan elemen <p>
                if (!msg.content && msg.imageData) {
                    const pElement = messageTextContainer.querySelector('p');
                    if (pElement) pElement.style.display = 'none';
                }

                formatMarkdown(messageTextContainer.querySelector('p'));
                if (msg.role === 'model' && msg.thoughts) {
                    // Simpan data 'thoughts' ke elemen bubble-nya
                    bubble.dataset.thoughts = msg.thoughts;
                    // Panggil fungsi untuk nambahin ikon 💡
                    addDropdownIcon(bubble);
                }
                // Simpan ke history lokal untuk AI
                chatHistory.push({
                    id: `msg-${msg.db_id}`,
                    role: msg.role,
                    parts: [msg.content]
                    // Kita tidak perlu simpan gambar di chatHistory, karena AI dapat dari FormData
                });
            }

            if (messagesFromServer.length === 0 && data.greeting) {
                setTimeout(() => displayGreeting(data.greeting), 100);
            }

            lastSummaryCount = Math.floor(chatHistory.length / SUMMARY_INTERVAL) * SUMMARY_INTERVAL;

        } catch (error) {
            console.error("Gagal memuat history dari server:", error);
            chatMessages.innerHTML = `<p class="error-message">Masalah saat ambil data. Cek koneksi.</p>`;
        }
    } else {
        console.log("Tidak ada session_id valid. Menampilkan halaman kosong.");
    }
    const pendingImage = loadPendingImageFromStorage();
    if (pendingImage) {
        // Jika ada gambar di laci, kita tampilkan lagi di preview input box
        imagePreview.src = pendingImage;
        imagePreviewContainer.classList.remove('hidden');

        // Kita juga perlu "membangun ulang" objek File dari data base64
        // agar siap untuk dikirim saat tombol send ditekan.
        try {
            const response = await fetch(pendingImage);
            const blob = await response.blob();
            selectedFile = new File([blob], "restored_image.png", { type: blob.type });
        } catch (e) {
            console.error("Gagal membangun ulang file dari gambar di laci", e);
        }
    }
    scrollToBottom();
}

async function startNewConversation() {
    try {
        console.log("Memulai proses pembuatan sesi baru ke server...");

        // 1. Siapkan data yang mau dikirim ke server
        const characterData = JSON.parse(localStorage.getItem('characterData') || '{}');
        const charName = characterData.name || 'Karakter';
        const charAvatar = characterData.avatar_url || '';
        // AMBIL GREETING DARI LOCALSTORAGE
        const charGreeting = characterData.greeting || 'Halo!';

        // 2. Kirim permintaan ke backend, sekarang dengan data greeting
        const response = await fetch('/api/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                character_name: charName,
                character_avatar: charAvatar,
                character_greeting: charGreeting // <-- KIRIM GREETING KE SERVER
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Server gagal membuat sesi baru.');
        }

        // 3. Terima ID sesi baru yang dikasih sama server
        const responseData = await response.json();
        const newConversationId = responseData.new_session_id;

        if (!newConversationId) {
            throw new Error("Server tidak memberikan ID sesi baru.");
        }

        console.log(`✅ Server berhasil membuat sesi baru dengan ID: ${newConversationId}`);

        // 4. Arahkan pengguna ke halaman chat dengan ID sesi yang baru
        // Ini cara paling simpel dan efektif
        window.location.href = `index.html?session_id=${newConversationId}`;

    } catch (error) {
        console.error("Gagal total saat startNewConversation:", error);
        alert(`Gagal memulai percakapan baru: ${error.message}`);
    }
}

// GANTI TOTAL FUNGSI INI DI js/script.js
async function displayGreeting(greetingText) {
    if (!greetingText || !currentConversationId) return;

    try {
        // 1. Tampilkan sapaan di layar
        const greetingBubble = createMessageBubble('model', greetingText, `msg-greeting-${Date.now()}`);
        formatMarkdown(greetingBubble.querySelector('.message-text p'));

        // 2. Simpan pesan sapaan ini ke Gudang Pusat (PostgreSQL)
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversation_id: currentConversationId,
                role: 'model',
                content: greetingText
            }),
        });
        const data = await response.json();
        const newDbId = data.new_message_id;
        if (imageDataForApi) {
            clearPendingImageFromStorage();
        }
        // Update ID bubble dan history array dengan ID dari database
        greetingBubble.id = `msg-${newDbId}`;
        chatHistory.push({ id: `msg-${newDbId}`, role: 'model', parts: [greetingText] });

    } catch (error) {
        console.error("Gagal menyimpan pesan sapaan ke server:", error);
    }
}

// FUNGSI BARU: Untuk memformat markdown
function formatMarkdown(element) {
    let currentText = element.textContent || '';

    // Prioritaskan yang bintang dua (**) dulu, baru bintang satu (*)
    // Ini penting biar *teks* di dalam **aksi *teks* aksi** tidak ikut termatching
    const formattedHTML = currentText
        .replace(/\*\*(.*?)\*\*/g, '<span class="action-text">$1</span>') // Untuk **teks** jadi aksi
        .replace(/\*(.*?)\*/g, '<span class="dialog-italic">$1</span>');  // Untuk *teks* jadi miring biasa

    element.innerHTML = formattedHTML;
}

function convertHtmlToMarkdown(htmlContent) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    // Ganti .action-text jadi **teks**
    tempDiv.querySelectorAll('.action-text').forEach(span => {
        span.replaceWith(`**${span.textContent}**`);
    });

    // Ganti .dialog-italic jadi *teks*
    tempDiv.querySelectorAll('.dialog-italic').forEach(span => {
        span.replaceWith(`*${span.textContent}*`);
    });

    // Kembalikan sebagai teks murni
    return tempDiv.textContent;
}

function createMessageBubble(sender, text, messageId = null, sequenceNumber = null, isError = false) {
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
    const sequenceInfoItem = sequenceNumber
        ? `<div class="menu-item-info">Pesan #${sequenceNumber}</div>`
        : '';
    if (isError) {
        menuItems = `<button class="delete-error">🗑️ Hapus</button>`;
    } else if (sender === 'user') {
        menuItems = `
            <button class="edit">✏️ Edit</button>
            <button class="resend">🔄 Kirim Ulang</button>
            <button class="delete">🗑️ Hapus</button>
            ${sequenceInfoItem}
        `;
    } else { // Ini untuk AI/model
        menuItems = `
            <button class="regenerate">✨ Regenerate</button>
            <button class="delete">🗑️ Hapus</button>
            ${sequenceInfoItem}
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


// GANTI LAGI FUNGSI exitEditMode DENGAN VERSI FINAL INI
async function exitEditMode(messageBubble, newText) {
    const editArea = messageBubble.querySelector('.edit-area');
    if (editArea) {
        messageBubble.classList.remove('is-editing');
        editArea.remove();
    }
    const currentTextElement = messageBubble.querySelector('.message-text p');
    if (currentTextElement) currentTextElement.style.display = 'block';

    const messageDbId = parseInt(messageBubble.dataset.id);
    if (isNaN(messageDbId)) {
        alert("Gagal: ID pesan tidak valid.");
        return;
    }

    // KUNCI BARU: Cek apakah di bubble ini ada gambar yang sudah ada
    let imageFileToResend = null;
    const existingImageElement = messageBubble.querySelector('.sent-image');
    if (existingImageElement) {
        console.log("Gambar lama terdeteksi, akan dikirim ulang.");
        // "Bangun ulang" File object dari data base64 yang ada di src gambar
        const response = await fetch(existingImageElement.src);
        const blob = await response.blob();
        imageFileToResend = new File([blob], "resend_image.png", { type: blob.type });
    }

    try {
        isReplying = true;
        abortController = new AbortController();
        sendButton.classList.add('is-stopping');
        sendButton.title = 'Hentikan';
        await fetch(`/api/messages/${messageDbId}/update`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: newText })
        });

        console.log("Update di server berhasil. Memuat ulang history chat untuk sinkronisasi...");
        await loadChatHistory();

        // Langkah 3: Minta respons AI baru dengan teks yang sudah diedit DAN gambar yang tadi kita simpan.
        console.log("History sinkron. Meminta respons AI baru dengan gambar (jika ada)...");
        await getAiResponse(newText, imageFileToResend);

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Gagal total saat proses edit/resend:", error);
            alert("Terjadi kesalahan. Silakan coba lagi.");
            await loadChatHistory();
        }
    } finally {
        isReplying = false;
        sendButton.classList.remove('is-stopping');
        sendButton.title = 'Kirim';
    }
}

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


function showToastNotification(message, type = 'info') {
    // Cek dulu, jangan sampai ada notif numpuk
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) {
        existingToast.remove();
    }

    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`; // 'info', 'error', 'success'
    toast.textContent = message;

    document.body.appendChild(toast);

    // Memicu animasi masuk
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);

    // Hapus otomatis setelah 5 detik
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, 5000);
}

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

// GANTI TOTAL FUNGSI getAiResponse DENGAN INI
async function getAiResponse(userMessage, fileToSend = null) {
    const indicatorBubble = createTypingIndicator();
    let replyTextElement;
    let accumulatedThoughts = '';
    let timerInterval;
    const startTime = Date.now();

    const timerElement = indicatorBubble.querySelector('.typing-timer');
    if (timerElement) {
        timerInterval = setInterval(() => {
            const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);
            timerElement.textContent = `${elapsedTime}s`;
        }, 100);
    }

    const apiSettings = JSON.parse(localStorage.getItem('apiSettings') || '{}');
    const selectedModel = apiSettings.model || 'models/gemini-2.5-flash';
    const customApiKey = apiSettings.apiKey || null;
    const characterData = JSON.parse(localStorage.getItem('characterData') || '{}');
    const userData = JSON.parse(localStorage.getItem('userData') || '{}');

    try {
        const memoryData = JSON.parse(localStorage.getItem('memoryData') || '[]');
        const worldData = JSON.parse(localStorage.getItem('worldData') || '[]');
        const npcData = JSON.parse(localStorage.getItem('npcData') || '[]');

        // Ambil summary langsung dari server sebelum kirim ke AI
        let currentSummary = "";
        if (currentConversationId) {
            const response = await fetch(`/api/sessions/${currentConversationId}`);
            const data = await response.json();
            currentSummary = data.summary || "";
        }
        if (currentSummary) {
            console.log("%c📚 Mengirim prompt ke AI dengan MENGGUNAKAN SEMUA RINGKASAN yang ada:", "color: #4CAF50; font-weight: bold;", currentSummary);
        } else {
            console.log("%c📚 Mengirim prompt ke AI TANPA ringkasan (percakapan masih baru).", "color: #FFA500;");
        }

        const formData = new FormData();
        formData.append('message', userMessage);
        formData.append('history', JSON.stringify(chatHistory));
        formData.append('character', JSON.stringify(characterData));
        formData.append('user', JSON.stringify(userData));
        formData.append('memory', JSON.stringify(memoryData));
        formData.append('world_info', JSON.stringify(worldData));
        formData.append('npcs', JSON.stringify(npcData));
        formData.append('summary', currentSummary);
        formData.append('conversation_id', currentConversationId);
        formData.append('model', selectedModel);
        if (customApiKey) formData.append('api_key', customApiKey);
        if (fileToSend) formData.append('image', fileToSend);
        else if (activeImageInfo) {
            formData.append('active_image_uri', activeImageInfo.uri);
            formData.append('active_image_mime', activeImageInfo.mime);
        }

        const response = await fetch('/chat', {
            method: 'POST',
            body: formData,
            signal: abortController.signal
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let firstChunk = true;
        let finalReplyText = '';

        let accumulatedResponse = ""; // Variabel baru untuk nyimpen teks lengkap

        while (true) {
            const { value, done } = await reader.read();
            if (done) {
                if (timerInterval) clearInterval(timerInterval);
                break;
            }

            const chunk = decoder.decode(value, { stream: true });
            // Kita proses per baris, karena kadang server kirim beberapa 'data:' sekaligus
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    try {
                        const data = JSON.parse(line.substring(6));

                        if (data.type === 'image_uri') {
                            activeImageInfo = { uri: data.uri, mime: data.mime };
                        } else if (data.type === 'error') {
                            indicatorBubble.remove();
                            createMessageBubble('ai', `Error: ${data.content}`, null, true);
                            if (timerInterval) clearInterval(timerInterval);
                            return; // Hentikan semua proses jika ada error dari server
                        } else if (data.type === 'summary_error') {
                            // Tampilkan notifikasi toast yang keren!
                            showToastNotification(data.content, 'error');
                        } else if (data.type === 'thought') {
                            accumulatedThoughts += data.content;
                        } else if (data.type === 'reply') {
                            // INI KUNCINYA: Tampilkan teks per-potongan (chunk)
                            if (firstChunk) {
                                indicatorBubble.querySelector('.message-text').innerHTML = '<p></p>';
                                replyTextElement = indicatorBubble.querySelector('p');
                                firstChunk = false;
                            }
                            if (replyTextElement) {
                                // Langsung tambahkan potongan teks baru ke tampilan
                                // replyTextElement.textContent += data.content;
                                // Simpan juga ke variabel akumulasi kita
                                accumulatedResponse += data.content;
                            }
                        }
                        scrollToBottom(); // Scroll setiap kali ada konten baru
                    } catch (e) {
                        // Jangan error-kan seluruh stream cuma karena satu baris JSON salah
                        console.warn("Gagal parse satu baris JSON dari stream:", line, e);
                    }
                }
            }
        }

        // --- INI BAGIAN BARUNYA: SIMPAN BALASAN AI KE POSTGRESQL ---
        if (accumulatedResponse.trim() !== '') {
            await typewriterEffect(replyTextElement, accumulatedResponse.trim(), 10);
            formatMarkdown(replyTextElement);
            const finalThoughts = accumulatedThoughts.trim();

            // Simpan ke DB (logika ini tetap sama)
            const saveResponse = await fetch('/api/messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    conversation_id: currentConversationId,
                    role: 'model',
                    content: accumulatedResponse, // <-- Simpan teks lengkapnya
                    thoughts: finalThoughts,
                }),
            });
            const saveData = await saveResponse.json();
            const newDbId = saveData.new_message_id;
            console.log(`💬 Jumlah dialog saat ini (di browser): ${saveData.total_messages}`);
            console.log(`💬 Pesan KARAKTER disimpan ke DB dengan ID: ${newDbId}`);
            indicatorBubble.id = `msg-${newDbId}`;
            indicatorBubble.dataset.id = newDbId;
            chatHistory.push({ id: `msg-${newDbId}`, role: 'model', parts: [accumulatedResponse] });

            if (finalThoughts) {
                indicatorBubble.dataset.thoughts = finalThoughts;
                addDropdownIcon(indicatorBubble);
            }
        } else {
            indicatorBubble.remove(); // Hapus kalo AI gak jawab apa-apa
        }

    } catch (error) {
        if (timerInterval) clearInterval(timerInterval);
        if (error.name !== 'AbortError') {
            console.error("Fetch Error:", error);
            if (indicatorBubble) indicatorBubble.remove();
            createMessageBubble('ai', 'Waduh, ada masalah koneksi nih.', null, true);
        } else {
            if (indicatorBubble) indicatorBubble.remove();
        }
    }
}
// GANTI TOTAL FUNGSI sendMessage DENGAN INI
async function sendMessage(fileToResend = null) {
    // Kunci #1: Cek HANYA 'isReplying'. Jika true, jangan lakukan apa-apa.
    if (isReplying) {
        console.warn("Pengiriman pesan diblokir sementara (menunggu AI).");
        return;
    }
    const messageText = inputArea.value.trim();
    const imageFile = fileToResend || selectedFile;

    if (!messageText && !imageFile) return;

    // Kunci #2: SEGERA set isReplying ke true dan update tombol.
    // Ini akan menonaktifkan tombol kirim dan mengubahnya jadi tombol "Stop".
    isReplying = true;
    abortController = new AbortController(); // Siapkan remote control untuk stop
    updateSendButtonState(); // Panggil manajer untuk update tampilan tombol

    inputArea.value = '';
    inputArea.style.height = 'auto';
    imagePreviewContainer.classList.add('hidden');
    selectedFile = null;
    inputArea.focus();

    const tempId = `msg-temp-${Date.now()}`;
    const userBubble = createMessageBubble('user', messageText, tempId);

    let imageDataForApi = null;
    if (imageFile) {
        try {
            const base64Image = await fileToBase64(imageFile);
            imageDataForApi = base64Image;
            const imageElement = document.createElement('img');
            imageElement.src = base64Image;
            imageElement.className = 'sent-image';
            userBubble.querySelector('.message-text').insertBefore(imageElement, userBubble.querySelector('.message-text p'));
        } catch (error) {
            console.error("Gagal proses gambar:", error);
            userBubble.remove();
            isReplying = false;
            updateSendButtonState(); // <-- UPDATE saat error juga
            return;
        }
    }

    formatMarkdown(userBubble.querySelector('.message-text p'));
    scrollToBottom();
    chatHistory.push({ id: tempId, role: 'user', parts: [messageText] });

    try {
        const response = await fetch('/api/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                conversation_id: currentConversationId,
                role: 'user',
                content: messageText,
                imageData: imageDataForApi
            }),
        });

        if (!response.ok) throw new Error("Gagal menyimpan pesan user ke server.");

        const data = await response.json();
        const newDbId = data.new_message_id;
        console.log(`💬 Jumlah dialog saat ini (di browser): ${data.total_messages}`);
        const newIdString = `msg-${newDbId}`;
        userBubble.id = newIdString;
        userBubble.dataset.id = newDbId;
        const msgIndex = chatHistory.findIndex(msg => msg.id === tempId);
        if (msgIndex > -1) chatHistory[msgIndex].id = newIdString;

        console.log(`💬 Pesan USER disimpan ke DB dengan ID: ${newDbId}`);

        await getAiResponse(messageText, imageFile);

    } catch (error) {
        if (error.name !== 'AbortError') {
            console.error("Error fatal saat kirim pesan:", error);
            userBubble.querySelector('.message-text p').textContent = "Gagal terkirim. Klik Resend.";
            userBubble.classList.add('error-message');
        }
    } finally {
        // Bagian terpenting: set isReplying ke false dan panggil manajer
        isReplying = false;
        updateSendButtonState(); // <-- PANGGIL MANAJER DI AKHIR
    }
}

// --- DI DALAM script.js ---

// HANYA ADA SATU BLOK INI DI SELURUH FILE
document.addEventListener('DOMContentLoaded', () => {
    const backToSessionsButton = document.querySelector('.back-button');
    if (backToSessionsButton) {
        backToSessionsButton.addEventListener('click', () => {
            // Arahkan ke halaman daftar sesi
            window.location.href = 'sessions.html';
        });
    }
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
    loadChatHistory(sessionIdFromUrl ? parseInt(sessionIdFromUrl) : null);

    const editSummaryLink = document.getElementById('edit-summary-link');
    if (editSummaryLink && sessionIdFromUrl) {
        editSummaryLink.href = `summarization-editor.html?session_id=${sessionIdFromUrl}`;
    } else if (editSummaryLink) {
        // Kalau nggak ada session_id, sembunyiin aja link-nya
        editSummaryLink.style.display = 'none';
    }

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
            // Jika AI sedang membalas (tombol dalam mode 'Stop'),
            // maka kita panggil abort().
            console.log("👆 Tombol Stop ditekan. Mengirim sinyal abort...");
            abortController.abort();

            // Kita TIDAK perlu mengubah 'isReplying' di sini.
            // Biarkan blok 'finally' di sendMessage yang menanganinya
            // agar status selalu konsisten.

        } else {
            // Jika AI tidak sedang membalas (tombol dalam mode 'Kirim'),
            // maka kita panggil sendMessage().
            sendMessage();
        }
    });
    inputArea.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            sendMessage();
        }
    });

    // MODIFIKASI event listener 'paste' ini
    inputArea.addEventListener('paste', async (event) => { // Tambahkan async
        const items = (event.clipboardData || window.clipboardData).items;
        let imageFile = null;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                imageFile = items[i].getAsFile();
                break;
            }
        }

        if (imageFile) {
            event.preventDefault();
            selectedFile = imageFile;
            try {
                const base64 = await fileToBase64(imageFile); // Tambahkan await
                imagePreview.src = base64;
                imagePreviewContainer.classList.remove('hidden');
                // INI KUNCINYA: Simpan ke laci
                savePendingImageToStorage(base64);
            } catch (error) {
                console.error("Gagal memproses gambar dari paste:", error);
            }
        }
    });

    // Listener untuk tombol menu header (☰)
    menuButton.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('hidden');
    });

    dropdownMenu.addEventListener('click', (e) => {
        // Kita cuma mau dia nutup kalo yang diklik itu beneran link (tag <a>)
        if (e.target.tagName === 'A') {
            dropdownMenu.classList.add('hidden');
        }
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

        // GANTI BLOK 'delete' INI di dalam event listener 'click'
        if (target.classList.contains('delete')) {
            dropdown.classList.add('hidden');
            if (confirm('Yakin ingin menghapus pesan ini beserta semua balasan AI setelahnya?')) {
                const messageDbId = parseInt(messageBubble.dataset.id);
                if (isNaN(messageDbId)) return;

                // Kunci #1: Kumpulin dulu semua ID yang mau dihapus.
                // Gak cuma pesan ini, tapi semua pesan setelah ini juga!
                const idsToDelete = [messageDbId];
                const bubblesToDelete = [messageBubble];
                let currentBubble = messageBubble;

                while (currentBubble.nextElementSibling) {
                    currentBubble = currentBubble.nextElementSibling;
                    const nextId = parseInt(currentBubble.dataset.id);
                    if (!isNaN(nextId)) {
                        idsToDelete.push(nextId);
                    }
                    bubblesToDelete.push(currentBubble);
                }

                console.log("Meminta penghapusan untuk ID:", idsToDelete);

                try {
                    // Kunci #2: Panggil API dan TUNGGU (await) sampai selesai.
                    const response = await fetch(`/api/messages/delete`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ids: idsToDelete }) // Kirim semua ID sekaligus
                    });

                    if (!response.ok) {
                        throw new Error('Server menolak permintaan hapus.');
                    }

                    // Kunci #3: Setelah server konfirmasi OK, BARU hapus dari layar dan history lokal.
                    bubblesToDelete.forEach(bubble => bubble.remove());
                    const idSetToDelete = new Set(idsToDelete.map(id => `msg-${id}`));
                    chatHistory = chatHistory.filter(msg => !idSetToDelete.has(msg.id));

                    console.log("Penghapusan berhasil di server dan UI.");

                } catch (error) {
                    console.error("Gagal hapus pesan via API:", error);
                    alert("Gagal menghapus pesan. Cek konsol untuk detail.");
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
            messageBubble.classList.add('is-editing');
            enterEditMode(messageBubble); // Fungsi ini akan menampilkan textarea dan tombol simpan
        }

        // GANTI BLOK REGENERATE DENGAN VERSI FINAL INI
        if (target.classList.contains('regenerate')) {
            dropdown.classList.add('hidden');
            if (isReplying) return; // Jangan lakukan apa-apa kalo lagi nunggu balasan

            const aiMessageBubble = messageBubble;
            const aiMessageId = parseInt(aiMessageBubble.dataset.id);

            // Cari pesan user SEBELUM pesan AI ini. Itulah pemicunya.
            const messageIndex = chatHistory.findIndex(msg => msg.id === `msg-${aiMessageId}`);
            let triggerMessage = "";
            let triggerImageFile = null; // Siapin buat kalo ada gambar
            if (messageIndex > -1) {
                // Loop mundur dari posisi AI untuk nemuin 'user' message terakhir
                for (let i = messageIndex - 1; i >= 0; i--) {
                    if (chatHistory[i].role === 'user') {
                        triggerMessage = chatHistory[i].parts[0];
                        // Cek juga apakah pesan pemicu itu ada gambarnya
                        const triggerBubble = document.getElementById(chatHistory[i].id);
                        const imgElement = triggerBubble.querySelector('.sent-image');
                        if (imgElement) {
                            // Jika ada gambar, kita "buat ulang" file-nya dari data base64
                            const response = await fetch(imgElement.src);
                            const blob = await response.blob();
                            triggerImageFile = new File([blob], "regenerate_image.png", { type: blob.type });
                        }
                        break; // Ketemu, stop loop
                    }
                }
            }

            if (!triggerMessage && !triggerImageFile) {
                alert("Gagal me-regenerate: Pesan pemicu dari user tidak ditemukan.");
                return;
            }

            try {
                isReplying = true;
                abortController = new AbortController();
                sendButton.classList.add('is-stopping');
                sendButton.title = 'Hentikan';

                // Langkah 1: Minta server HAPUS pesan AI yang lama. TUNGGU.
                await fetch(`/api/messages/delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: [aiMessageId] })
                });

                // Langkah 2: Setelah dikonfirmasi server, HAPUS dari layar & history lokal.
                aiMessageBubble.remove();
                chatHistory.splice(messageIndex, 1);

                console.log(`Regenerate: Pesan AI lama (ID: ${aiMessageId}) dihapus. Meminta balasan baru untuk: "${triggerMessage}"`);

                // Langkah 3: BARU panggil AI lagi dengan pemicu yang sama.
                await getAiResponse(triggerMessage, triggerImageFile);

            } catch (error) {
                if (error.name !== 'AbortError') {
                    console.error("Error saat regenerate:", error);
                    alert("Terjadi masalah saat me-regenerate.");
                }
            } finally {
                // Langkah 4: Apapun yang terjadi, balikin tombol send ke kondisi normal.
                isReplying = false;
                sendButton.classList.remove('is-stopping');
                sendButton.title = 'Kirim';
            }
        }

        if (target.classList.contains('resend')) {
            dropdown.classList.add('hidden');
            if (isReplying) return;

            // Ambil teks asli dari bubble
            const originalText = convertHtmlToMarkdown(messageBubble.querySelector('.message-text p').innerHTML);
            await exitEditMode(messageBubble, originalText);
        }
    });
    uploadButton.addEventListener('click', () => {
        imageUploadInput.click(); // Picu input file yang tersembunyi
    });

    // MODIFIKASI event listener 'change' ini
    imageUploadInput.addEventListener('change', async (event) => { // Tambahkan async
        const file = event.target.files[0];
        if (file) {
            selectedFile = file;
            try {
                const base64 = await fileToBase64(file); // Tambahkan await
                imagePreview.src = base64;
                imagePreviewContainer.classList.remove('hidden');
                // INI KUNCINYA: Simpan ke laci
                savePendingImageToStorage(base64);
            } catch (error) {
                console.error("Gagal memproses gambar untuk preview:", error);
            }
        }
    });

    removeImageButton.addEventListener('click', () => {
        selectedFile = null;
        activeImageInfo = null;
        imageUploadInput.value = ''; // Reset input file
        imagePreviewContainer.classList.add('hidden');
        clearPendingImageFromStorage();
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