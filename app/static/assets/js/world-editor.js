document.addEventListener('DOMContentLoaded', () => {
    // 1. Seleksi elemen penting
    const worldListDiv = document.getElementById('world-list');
    const addWorldBtn = document.getElementById('add-world-btn');
    const updateButton = document.querySelector('.update-button');
    
    // Ambil ID karakter dari URL
    const urlParams = new URLSearchParams(window.location.search);
    const characterId = urlParams.get('char_id');

    if (!characterId) {
        document.body.innerHTML = '<h1>Error: ID Karakter tidak ditemukan. Silakan kembali.</h1>';
        return;
    }

    // Fungsi untuk membuat satu baris entri
    function createWorldEntry(text = "") {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'world-entry';
        const textarea = document.createElement('textarea');
        textarea.className = 'world-text';
        textarea.rows = 2;
        textarea.placeholder = 'Tulis info dunia di sini...';
        textarea.value = text;
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        });
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-world-btn';
        deleteBtn.textContent = 'X';
        deleteBtn.addEventListener('click', () => entryDiv.remove());
        entryDiv.appendChild(textarea);
        entryDiv.appendChild(deleteBtn);
        worldListDiv.appendChild(entryDiv);
        setTimeout(() => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        }, 10);
    }

    // 2. Memuat data dari server
    async function loadWorldData() {
        try {
            const response = await fetch(`/api/characters/${characterId}/world_info`);
            if (!response.ok) throw new Error('Gagal memuat data dari server.');
            
            const data = await response.json();
            const worldInfos = data.world_info || [];

            worldListDiv.innerHTML = ''; 

            if (worldInfos.length > 0) {
                worldInfos.forEach(infoText => createWorldEntry(infoText));
            } else {
                createWorldEntry(); 
            }
        } catch (error) {
            alert(error.message);
            worldListDiv.innerHTML = `<p style="color: #f04747;">${error.message}</p>`;
        }
    }

    // 3. Menyimpan data ke server
    async function saveWorldData() {
        const worldTextareas = worldListDiv.querySelectorAll('.world-text');
        const worldInfosToSave = [];
        worldTextareas.forEach(textarea => {
            const text = textarea.value.trim();
            if (text) {
                worldInfosToSave.push(text);
            }
        });

        try {
            const response = await fetch(`/api/characters/${characterId}/world_info`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ world_info: worldInfosToSave }) 
            });

            if (!response.ok) throw new Error('Gagal menyimpan perubahan ke server.');
            
            alert('Info Dunia berhasil di-update!');
        } catch (error) {
            alert(error.message);
        }
    }

    // Sambungkan fungsi ke tombol
    addWorldBtn.addEventListener('click', () => createWorldEntry());
    updateButton.addEventListener('click', saveWorldData);

    // Muat data saat halaman dibuka
    loadWorldData();
});