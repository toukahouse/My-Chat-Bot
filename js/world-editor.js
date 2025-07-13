document.addEventListener('DOMContentLoaded', () => {
    // 1. Seleksi elemen penting
    const worldListDiv = document.getElementById('world-list');
    const addWorldBtn = document.getElementById('add-world-btn');
    const updateButton = document.querySelector('.update-button');
    const storageKey = 'worldData'; // Kunci baru di localStorage untuk info dunia

    // 2. Fungsi untuk membuat satu baris entri info dunia
    function createWorldEntry(text = "") {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'world-entry';

        const textarea = document.createElement('textarea');
        textarea.className = 'world-text';
        textarea.rows = 2;
        textarea.placeholder = 'Tulis info dunia di sini... (Contoh: Kafe Neko adalah tempat favorit Hana)';
        textarea.value = text;

        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-world-btn';
        deleteBtn.textContent = 'X';

        deleteBtn.addEventListener('click', () => {
            entryDiv.remove();
        });

        entryDiv.appendChild(textarea);
        entryDiv.appendChild(deleteBtn);
        worldListDiv.appendChild(entryDiv);

        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight) + 'px';
    }

    // 3. Fungsi untuk memuat data dari localStorage
    function loadWorldData() {
        const savedData = localStorage.getItem(storageKey);
        const worldInfos = savedData ? JSON.parse(savedData) : [];

        worldListDiv.innerHTML = '';

        if (worldInfos.length > 0) {
            worldInfos.forEach(infoText => createWorldEntry(infoText));
        } else {
            createWorldEntry(); // Buat satu entri kosong jika belum ada data
        }
    }

    // 4. Fungsi untuk menyimpan data ke localStorage
    function saveWorldData() {
        const worldTextareas = worldListDiv.querySelectorAll('.world-text');
        const worldInfosToSave = [];

        worldTextareas.forEach(textarea => {
            const text = textarea.value.trim();
            if (text) {
                worldInfosToSave.push(text);
            }
        });

        localStorage.setItem(storageKey, JSON.stringify(worldInfosToSave));
        alert('Info Dunia berhasil di-update!');
    }

    // 5. Sambungkan fungsi ke tombol-tombol
    addWorldBtn.addEventListener('click', () => createWorldEntry());
    updateButton.addEventListener('click', saveWorldData);

    // 6. Muat data saat halaman dibuka
    loadWorldData();
});