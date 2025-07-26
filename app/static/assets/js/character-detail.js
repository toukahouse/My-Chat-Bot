document.addEventListener('DOMContentLoaded', () => {
    // 1. Ambil semua elemen penting
    const container = document.getElementById('character-detail-container');
    const loader = document.getElementById('loader');
    const charAvatar = document.getElementById('char-avatar');
    const charNameLeft = document.getElementById('char-name-left');
    const startNewChatBtn = document.getElementById('start-new-chat-btn');
    const charGreeting = document.getElementById('char-greeting');
    const charPersona = document.getElementById('char-persona');
    const charSystemInstruction = document.getElementById('char-system-instruction');
    const charDialogs = document.getElementById('char-dialogs');
    const continueLastChatBtn = document.getElementById('continue-last-chat-btn');
    const editBtn = document.getElementById('edit-btn');
    const deleteBtn = document.getElementById('delete-btn');

    // 2. Ambil ID karakter dari URL
    const urlParams = new URLSearchParams(window.location.search);
    const characterId = urlParams.get('id');

    // Jika tidak ada ID, tampilkan error dan stop
    if (!characterId) {
        loader.remove();
        container.innerHTML = '<h1>Error: ID Karakter tidak ditemukan.</h1><a href="/main-menu.html">Kembali ke Menu</a>';
        container.classList.remove('hidden');
        return;
    }

    // 3. Fungsi utama untuk memuat dan menampilkan data
    async function loadCharacterDetails() {
        try {
            const response = await fetch(`/api/characters/${characterId}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Gagal memuat data karakter.');
            }
            const data = await response.json();

            // Isi semua elemen dengan data dari server
            document.title = data.name; // Ganti judul tab browser
            charAvatar.src = data.avatar_url || 'https://i.imgur.com/7iA7s2P.png';
            charNameLeft.textContent = data.name;
            charGreeting.textContent = data.greeting || 'Tidak ada sapaan.';
            charPersona.textContent = data.persona || 'Tidak ada persona.';
            charSystemInstruction.textContent = data.system_instruction || 'Tidak ada instruksi sistem.';
            charDialogs.textContent = data.example_dialogs || 'Tidak ada contoh dialog.';

            // Sembunyikan loader dan tampilkan konten
            loader.remove();
            container.classList.remove('hidden');
            if (data.last_session_id) {
                // Jika ada sesi terakhir, tampilkan tombolnya
                continueLastChatBtn.classList.remove('hidden');

                // Atur link-nya agar mengarah ke sesi tersebut
                continueLastChatBtn.addEventListener('click', () => {
                    continueLastChatBtn.disabled = true;
                    continueLastChatBtn.textContent = 'Memuat chat...';
                    localStorage.setItem('characterData', JSON.stringify(data));
                    window.location.href = `index.html?session_id=${data.last_session_id}`;
                });
            }

        } catch (error) {
            loader.remove();
            container.innerHTML = `<h1>Error: ${error.message}</h1><a href="/main-menu.html">Kembali ke Menu</a>`;
            container.classList.remove('hidden');
        }
    }

    // 4. Event listener untuk tombol-tombol

    // Tombol Edit
    editBtn.addEventListener('click', () => {
        window.location.href = `character-editor.html?id=${characterId}`;
    });

    // Tombol Hapus
    deleteBtn.addEventListener('click', async () => {
        if (confirm('Apakah kamu yakin ingin menghapus karakter ini secara permanen?')) {
            try {
                const response = await fetch(`/api/characters/${characterId}`, {
                    method: 'DELETE',
                });
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Gagal menghapus karakter.');
                }
                alert('Karakter berhasil dihapus!');
                window.location.href = '/'; // Kembali ke menu utama
            } catch (error) {
                alert(`Error: ${error.message}`);
            }
        }
    });

    // Tombol Mulai Chat
    // Tombol Mulai Chat BARU
    // GANTI event listener lama dengan ini
    startNewChatBtn.addEventListener('click', async () => {
        try {
            startNewChatBtn.disabled = true;
            startNewChatBtn.textContent = 'Mempersiapkan sesi...';
            // Ambil data karakter yang sudah kita load di awal
            let characterDataString = localStorage.getItem('characterData');
            let characterData;

            // Cek apakah data karakter di localStorage cocok dengan ID karakter saat ini
            if (characterDataString) {
                characterData = JSON.parse(characterDataString);
                if (characterData.id != characterId) {
                    characterDataString = null; // Anggap tidak ada jika ID tidak cocok
                }
            }

            if (!characterDataString) {
                // Ambil ulang jika tidak ada atau tidak cocok
                console.log("Mengambil ulang data karakter untuk sesi baru...");
                const response = await fetch(`/api/characters/${characterId}`);
                characterData = await response.json();
                localStorage.setItem('characterData', JSON.stringify(characterData));
            }

            // Langsung panggil API untuk buat sesi baru
            const sessionResponse = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    character_name: characterData.name,
                    character_avatar: characterData.avatar_url,
                    character_greeting: characterData.greeting
                })
            });
            if (!sessionResponse.ok) throw new Error('Gagal membuat sesi chat baru.');
            const sessionData = await sessionResponse.json();

            window.location.href = `index.html?session_id=${sessionData.new_session_id}`;
        } catch (error) { // <-- kurung buka { untuk catch
            alert(`Tidak bisa memulai chat: ${error.message}`);
            startNewChatBtn.disabled = false;
            startNewChatBtn.textContent = 'Mulai Chat Baru';
        } // <-- INI DIA KURUNG TUTUP } YANG HILANG
    });

    // Event listener untuk accordion
    const accordionItems = document.querySelectorAll('.accordion-item');
    accordionItems.forEach(item => {
        const header = item.querySelector('.accordion-header');
        header.addEventListener('click', () => {
            item.classList.toggle('active');
        });
    });


    // 5. Jalankan fungsi utama
    loadCharacterDetails();
});