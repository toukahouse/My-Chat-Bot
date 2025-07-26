// Hapus semua kode lama di file sessions.js, ganti dengan ini semua.

// Pastikan dayjs sudah di-load di sessions.html

window.onload = () => {
    // Taruh ini di dalam window.onload di js/sessions.js
    // GANTI DENGAN VERSI SIMPEL INI
    document.getElementById('back-to-chat-button').addEventListener('click', (e) => {
        e.preventDefault();
        // Perintah ini nyuruh browser buat "tekan tombol back"
        history.back();
    });
    localStorage.setItem('lastActiveSessionId', new URLSearchParams(window.location.search).get('session_id'));
    // INISIALISASI PLUGIN WAKTU
    dayjs.extend(dayjs_plugin_relativeTime);
    dayjs.locale('id');

    const container = document.getElementById('session-list-container');
    if (!container) {
        console.error("Elemen #session-list-container tidak ditemukan!");
        return;
    }

    // FUNGSI UTAMA UNTUK MENAMPILKAN SESI DARI SERVER
    async function renderSessionsFromServer() {
        try {
            container.innerHTML = '<p class="loading-message">Lagi ngambil data dari Gudang Pusat...</p>';

            // 1. Ambil data dari API backend kita
            const urlParams = new URLSearchParams(window.location.search);
            const charId = urlParams.get('char_id');

            let apiUrl = '/api/sessions';
            if (charId) {
                apiUrl += `?char_id=${charId}`; // Tambahkan parameter ke URL API
            }

            const response = await fetch(apiUrl);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Gagal fetch dari server: ${response.statusText}`);
            }
            const allSessions = await response.json(); // Ini data dari PostgreSQL!

            container.innerHTML = ''; // Bersihkan pesan loading

            if (allSessions.length === 0) {
                container.innerHTML = '<p class="loading-message">Belum ada sesi percakapan yang tersimpan di server.</p>';
                return;
            }

            // 2. Loop dan tampilkan data yang didapat dari server
            for (const session of allSessions) {
                const sessionCard = document.createElement('div');
                sessionCard.className = 'session-card';
                sessionCard.dataset.sessionId = session.id; // Simpan ID di elemen

                const timeAgo = dayjs(session.timestamp).fromNow();
                const characterName = session.character_name || 'Karakter';
                const characterAvatar = session.character_avatar || 'assets/img/default-avatar.png'; // Ganti dengan path avatar default kamu
                const summaryText = session.summary || 'Belum ada ringkasan untuk sesi ini.';
                const messageCount = session.message_count || 0;

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
                    <button class="delete-session-btn" title="Hapus Sesi">🗑️</button>
                `;
                container.appendChild(sessionCard);
            }

        } catch (error) {
            console.error("Gagal total saat renderSessionsFromServer:", error);
            container.innerHTML = `<p class="loading-message" style="color: #f04747;">Gagal memuat daftar sesi dari server. Error: ${error.message}</p>`;
        }
    }

    // EVENT LISTENER UNTUK MENANGANI KLIK TOMBOL HAPUS
    // GANTI TOTAL BLOK EVENT LISTENER-NYA DENGAN INI
    container.addEventListener('click', async (event) => {
        // Kita cuma peduli kalau yang diklik adalah tombol sampah
        const deleteButton = event.target.closest('.delete-session-btn');
        if (!deleteButton) {
            return; // Kalau bukan, cuekin aja
        }

        // Cegah link di belakangnya ikut keklik
        event.preventDefault();
        event.stopPropagation();

        const card = deleteButton.closest('.session-card');
        const sessionId = card.dataset.sessionId;
        const characterName = card.querySelector('.card-title').textContent;

        if (confirm(`Yakin mau hapus sesi dengan "${characterName}"? Semua history chat di sesi ini bakal hilang permanen lho.`)) {

            // Tampilkan feedback visual ke user, biar tau kalo lagi proses
            card.style.opacity = '0.5';
            card.style.pointerEvents = 'none'; // Biar gak bisa diklik-klik lagi

            try {
                // INI BAGIAN KUNCINYA: Kirim permintaan DELETE ke server
                const response = await fetch(`/api/sessions/${sessionId}`, {
                    method: 'DELETE',
                });

                // Cek apakah server merespon dengan 'OK' (status 200-299)
                if (!response.ok) {
                    // Kalau server kasih error, kita tampilkan pesannya
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Server menolak permintaan hapus.');
                }

                console.log(`✅ Sesi ID ${sessionId} berhasil dihapus dari server.`);

                // Kalau server sudah konfirmasi OK, BARU kita hapus dari tampilan dengan animasi keren
                card.style.transition = 'opacity 0.3s, transform 0.3s';
                card.style.transform = 'scale(0.9)';
                card.style.opacity = '0';

                // Tunggu animasinya selesai, baru hapus elemennya dari DOM
                setTimeout(() => {
                    card.remove();
                    // Cek apakah kontainer jadi kosong
                    if (container.children.length === 0) {
                        container.innerHTML = '<p class="loading-message">Yah, semua sesi sudah dihapus. Mulai percakapan baru yuk!</p>';
                    }
                }, 300);

            } catch (error) {
                // Kalau ada masalah (misal: koneksi putus, server error)
                console.error(`Gagal menghapus sesi ID ${sessionId}:`, error);
                alert(`Gagal menghapus sesi: ${error.message}`);

                // Balikin tampilan kartu ke semula karena prosesnya gagal
                card.style.opacity = '1';
                card.style.pointerEvents = 'auto';
            }
        }
    });

    // JALANKAN FUNGSI SAAT HALAMAN DIMUAT
    renderSessionsFromServer();
};