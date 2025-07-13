// HANYA GUNAKAN window.onload SEBAGAI PEMBUNGKUS UTAMA
window.onload = () => {

    // Langsung jalankan semua kode kita di sini

    // Inisialisasi Day.js dengan plugin dan locale yang sudah kita muat
    dayjs.extend(dayjs_plugin_relativeTime);
    dayjs.locale('id');

    // Definisikan koneksi ke database Dexie
    const db = new Dexie('ChatDatabase');

    // Rantai semua versi database bersama-sama
    db.version(7).stores({
        messages: '++id, conversation_id, timestamp, thoughts, [conversation_id+timestamp]',
        conversations: '++id, &timestamp, summary, character_name, character_avatar'
    }).upgrade(tx => {
        // Fungsi upgrade ini akan menangani pembuatan atau modifikasi kolom jika diperlukan
        console.log("Upgrading database to version 7 if needed...");
        return tx.table('conversations').toCollection().modify(convo => {
            if (convo.character_name === undefined) convo.character_name = "";
            if (convo.character_avatar === undefined) convo.character_avatar = "";
            // Kita bisa tambahkan pengecekan lain di sini untuk versi sebelumnya jika perlu
            if (convo.summary === undefined) convo.summary = "";
        });
    });

    const container = document.getElementById('session-list-container');

    // Fungsi utama untuk memuat dan menampilkan semua sesi
    async function renderSessions() {
        try {
            // Buka database untuk memicu proses upgrade jika diperlukan
            await db.open();
            console.log("Database terbuka, mulai mengambil sesi...");

            const allSessions = await db.conversations.orderBy('timestamp').reverse().toArray();
            console.log(`Ditemukan ${allSessions.length} sesi.`);

            container.innerHTML = '';

            if (allSessions.length === 0) {
                container.innerHTML = '<p class="loading-message">Belum ada sesi percakapan yang tersimpan.</p>';
                return;
            }

            for (const session of allSessions) {
                const messageCount = await db.messages
                    .where('conversation_id')
                    .equals(session.id)
                    .count();

                const sessionCard = document.createElement('a');
                sessionCard.className = 'session-card';
                sessionCard.href = `index.html?session_id=${session.id}`;

                const timeAgo = dayjs(session.timestamp).fromNow();

                const characterName = session.character_name || 'Karakter';
                const characterAvatar = session.character_avatar || 'https://i.imgur.com/default-avatar.png';
                const summaryText = session.summary || 'Belum ada ringkasan untuk sesi ini.';

                sessionCard.innerHTML = `
                    <div class="card-image-container">
                        <img src="${characterAvatar}" alt="Avatar Karakter" class="card-image" loading="lazy">
                    </div>
                    <div class="card-content">
                        <h3 class="card-title">${characterName}</h3>
                        <p class="card-summary">${summaryText}</p>
                        <div class="card-footer">
                            <span class="card-timestamp">${timeAgo}</span>
                            <span class="card-message-count">${messageCount} pesan</span>
                        </div>
                    </div>
                `;

                container.appendChild(sessionCard);
            }

        } catch (error) {
            console.error("Gagal total saat renderSessions:", error);
            container.innerHTML = '<p class="loading-message" style="color: #f04747;">Gagal memuat daftar sesi. Cek console untuk detail.</p>';
        }
    }

    // Panggil fungsi untuk pertama kali
    renderSessions();
};