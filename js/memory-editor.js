document.addEventListener('DOMContentLoaded', () => {
    // 1. Seleksi elemen penting
    const memoryListDiv = document.getElementById('memory-list');
    const addMemoryBtn = document.getElementById('add-memory-btn');
    const updateButton = document.querySelector('.update-button');
    const storageKey = 'memoryData'; // Kunci baru di localStorage

    // 2. Fungsi untuk membuat satu baris entri memori di HTML
    function createMemoryEntry(text = "") {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'memory-entry';

        const textarea = document.createElement('textarea');
        textarea.className = 'memory-text';
        textarea.rows = 2; // Tinggi awal yang cukup
        textarea.placeholder = 'Tulis fakta penting di sini... (Contoh: Hana tidak suka nanas)';
        textarea.value = text;

        // Fitur auto-resize tinggi textarea
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-memory-btn';
        deleteBtn.textContent = 'X';

        deleteBtn.addEventListener('click', () => {
            entryDiv.remove(); // Hapus elemen dari tampilan
        });

        entryDiv.appendChild(textarea);
        entryDiv.appendChild(deleteBtn);
        memoryListDiv.appendChild(entryDiv);

        // Langsung panggil auto-resize saat pertama kali dibuat
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }

    // 3. Fungsi untuk memuat data dari localStorage saat halaman dibuka
    function loadMemoryData() {
        const savedData = localStorage.getItem(storageKey);
        // Data disimpan sebagai array of strings, contoh: ["fakta 1", "fakta 2"]
        const memories = savedData ? JSON.parse(savedData) : [];

        memoryListDiv.innerHTML = ''; // Kosongkan list dulu

        if (memories.length > 0) {
            memories.forEach(memText => createMemoryEntry(memText));
        } else {
            // Jika kosong, buat satu entri default biar user nggak bingung
            createMemoryEntry();
        }
    }

    // 4. Fungsi untuk menyimpan data ke localStorage saat tombol "Update" diklik
    function saveMemoryData() {
        const memoryTextareas = memoryListDiv.querySelectorAll('.memory-text');
        const memoriesToSave = [];

        memoryTextareas.forEach(textarea => {
            const text = textarea.value.trim();
            if (text) { // Hanya simpan yang ada isinya
                memoriesToSave.push(text);
            }
        });

        localStorage.setItem(storageKey, JSON.stringify(memoriesToSave));
        alert('Memori berhasil di-update!');
    }

    // 5. Sambungkan fungsi ke tombol-tombol
    addMemoryBtn.addEventListener('click', () => createMemoryEntry()); // Kalau tombol '+' diklik, buat entri baru
    updateButton.addEventListener('click', saveMemoryData); // Kalau tombol 'Update' diklik, simpan data

    // 6. Muat data saat halaman pertama kali dibuka
    loadMemoryData();
});