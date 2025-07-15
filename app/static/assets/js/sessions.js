// HANYA GUNAKAN window.onload SEBAGAI PEMBUNGKUS UTAMA
window.onload = () => {

    // 1. INISIALISASI PLUGIN & DATABASE
    // ===================================
    dayjs.extend(dayjs_plugin_relativeTime);
    dayjs.locale('id');

    const db = new Dexie('ChatDatabase');
    db.version(8).stores({
        messages: '++id, conversation_id, timestamp, thoughts, imageData, [conversation_id+timestamp]',
        conversations: '++id, &timestamp, summary, character_name, character_avatar'
    });

    const container = document.getElementById('session-list-container');


    // 2. FUNGSI UTAMA UNTUK MENAMPILKAN SESI
    // ========================================
        // ▼▼▼ GANTI TOTAL FUNGSI INI DENGAN VERSI FINAL ANTI-BUG LAYOUT ▼▼▼
    async function renderSessions() {
        try {
            await db.open();
            const allSessions = await db.conversations.orderBy('timestamp').reverse().toArray();

            container.innerHTML = ''; 

            if (allSessions.length === 0) {
                container.innerHTML = '<p class="loading-message">Belum ada sesi percakapan yang tersimpan.</p>';
                return;
            }

            for (const session of allSessions) {
                const messageCount = await db.messages.where('conversation_id').equals(session.id).count();
                const sessionCard = document.createElement('div');
                sessionCard.className = 'session-card';

                const timeAgo = dayjs(session.timestamp).fromNow();
                const characterName = session.character_name || 'Karakter';
                const characterAvatar = session.character_avatar || 'https://i.imgur.com/default-avatar.png';
                const summaryText = session.summary || 'Belum ada ringkasan untuk sesi ini.';

                // STRUKTUR HTML YANG BENAR DAN DIJAMIN AMAN
                sessionCard.innerHTML = `
                    <a href="index.html?session_id=${session.id}" class="card-link-wrapper">
                        <div class="card-image-container">
                            <img src="${characterAvatar}" alt="Avatar Karakter" class="card-image">
                        </div>
                        <div class="card-content">
                            <h3 class="card-title">${characterName}</h3>
                            <p class="card-summary">${summaryText}</p>
                            <div class="card-footer">
                                <span class="card-timestamp">${timeAgo}</span>
                                <span class="card-message-count">${messageCount} pesan</span>
                            </div>
                        </div>
                    </a>
                    <button class="delete-session-btn" data-session-id="${session.id}" title="Hapus Sesi">
                        🗑️
                    </button>
                `;

                container.appendChild(sessionCard);
            }

        } catch (error) {
            console.error("Gagal total saat renderSessions:", error);
            container.innerHTML = '<p class="loading-message" style="color: #f04747;">Gagal memuat daftar sesi.</p>';
        }
    }


    // 3. EVENT LISTENER UNTUK AKSI HAPUS
    // ====================================
    container.addEventListener('click', async (event) => {
        if (event.target.classList.contains('delete-session-btn')) {
            const sessionId = parseInt(event.target.dataset.sessionId);
            if (isNaN(sessionId)) return;

            if (confirm('Yakin ingin menghapus sesi ini? Semua riwayat chat di dalamnya akan hilang selamanya.')) {
                try {
                    await db.transaction('rw', db.conversations, db.messages, async () => {
                        await db.messages.where('conversation_id').equals(sessionId).delete();
                        await db.conversations.delete(sessionId);
                    });

                    const cardToRemove = event.target.closest('.session-card');
                    if (cardToRemove) {
                        cardToRemove.style.transition = 'opacity 0.3s, transform 0.3s';
                        cardToRemove.style.transform = 'scale(0.9)';
                        cardToRemove.style.opacity = '0';
                        setTimeout(() => cardToRemove.remove(), 300);
                    }
                } catch (error) {
                    console.error(`Gagal menghapus sesi ID ${sessionId}:`, error);
                    alert('Gagal menghapus sesi. Silakan coba lagi.');
                }
            }
        }
    });


    // 4. JALANKAN FUNGSI SAAT HALAMAN DIMUAT
    // =======================================
    renderSessions();

}; // Akhir dari window.onload