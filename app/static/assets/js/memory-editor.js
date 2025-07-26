document.addEventListener('DOMContentLoaded', () => {
    // 1. Seleksi elemen penting
    const memoryListDiv = document.getElementById('memory-list');
    const addMemoryBtn = document.getElementById('add-memory-btn');
    const updateButton = document.querySelector('.update-button');
    
    // Ambil ID karakter dari URL, ini KUNCINYA!
    const urlParams = new URLSearchParams(window.location.search);
    const characterId = urlParams.get('char_id');

    // Jika tidak ada ID, jangan lakukan apa-apa
    if (!characterId) {
        document.body.innerHTML = '<h1>Error: ID Karakter tidak ditemukan. Silakan kembali.</h1>';
        return;
    }

    // Fungsi untuk membuat satu baris entri (tidak berubah)
    function createMemoryEntry(text = "") {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'memory-entry';
        const textarea = document.createElement('textarea');
        textarea.className = 'memory-text';
        textarea.rows = 2;
        textarea.placeholder = 'Tulis fakta penting di sini...';
        textarea.value = text;
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        });
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-memory-btn';
        deleteBtn.textContent = 'X';
        deleteBtn.addEventListener('click', () => entryDiv.remove());
        entryDiv.appendChild(textarea);
        entryDiv.appendChild(deleteBtn);
        memoryListDiv.appendChild(entryDiv);
        setTimeout(() => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        }, 10);
    }

    // 2. FUNGSI BARU: Memuat data dari server
    async function loadMemoryData() {
        try {
            const response = await fetch(`/api/characters/${characterId}/memories`);
            if (!response.ok) throw new Error('Gagal memuat data dari server.');
            
            const data = await response.json();
            const memories = data.memories || [];

            memoryListDiv.innerHTML = ''; // Kosongkan list dulu

            if (memories.length > 0) {
                memories.forEach(memText => createMemoryEntry(memText));
            } else {
                createMemoryEntry(); // Buat satu entri kosong jika belum ada
            }
        } catch (error) {
            alert(error.message);
            memoryListDiv.innerHTML = `<p style="color: #f04747;">${error.message}</p>`;
        }
    }

    // 3. FUNGSI BARU: Menyimpan data ke server
    async function saveMemoryData() {
        const memoryTextareas = memoryListDiv.querySelectorAll('.memory-text');
        const memoriesToSave = [];
        memoryTextareas.forEach(textarea => {
            const text = textarea.value.trim();
            if (text) {
                memoriesToSave.push(text);
            }
        });

        try {
            const response = await fetch(`/api/characters/${characterId}/memories`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ memories: memoriesToSave }) // Kirim dalam format { "memories": [...] }
            });

            if (!response.ok) throw new Error('Gagal menyimpan perubahan ke server.');
            
            alert('Memori berhasil di-update!');
        } catch (error) {
            alert(error.message);
        }
    }

    // Sambungkan fungsi ke tombol
    addMemoryBtn.addEventListener('click', () => createMemoryEntry());
    updateButton.addEventListener('click', saveMemoryData);

    // Muat data saat halaman pertama kali dibuka
    loadMemoryData();
});