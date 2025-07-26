document.addEventListener('DOMContentLoaded', () => {
    // 1. Seleksi elemen penting
    const npcListDiv = document.getElementById('npc-list');
    const addNpcBtn = document.getElementById('add-npc-btn');
    const updateButton = document.querySelector('.update-button');

    // Ambil ID karakter dari URL
    const urlParams = new URLSearchParams(window.location.search);
    const characterId = urlParams.get('char_id');

    if (!characterId) {
        document.body.innerHTML = '<h1>Error: ID Karakter tidak ditemukan. Silakan kembali.</h1>';
        return;
    }

    // Fungsi untuk membuat satu blok entri NPC
    function createNpcEntry(text = "") {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'npc-entry';
        const textarea = document.createElement('textarea');
        textarea.className = 'npc-text';
        textarea.rows = 4;
        textarea.placeholder = `Tulis deskripsi NPC di sini...\n\nContoh:\nNama: Kenji Tanaka\nPenampilan: Pria tinggi berambut perak.\nPeran: Kakak angkat Hana.`;
        textarea.value = text;
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        });
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-npc-btn';
        deleteBtn.textContent = 'X';
        deleteBtn.addEventListener('click', () => entryDiv.remove());
        entryDiv.appendChild(textarea);
        entryDiv.appendChild(deleteBtn);
        npcListDiv.appendChild(entryDiv);
        setTimeout(() => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        }, 10);
    }

    // 2. Memuat data dari server
    async function loadNpcData() {
        try {
            const response = await fetch(`/api/characters/${characterId}/npcs`);
            if (!response.ok) throw new Error('Gagal memuat data dari server.');

            const data = await response.json();
            const npcs = data.npcs || [];

            npcListDiv.innerHTML = '';

            if (npcs.length > 0) {
                // Berbeda dengan yg lain, kita tidak pakai .join() karena pemisahnya '---'
                // Jadi kita langsung loop array-nya
                npcs.forEach(npcText => createNpcEntry(npcText));
            } else {
                createNpcEntry();
            }
        } catch (error) {
            alert(error.message);
            npcListDiv.innerHTML = `<p style="color: #f04747;">${error.message}</p>`;
        }
    }

    // 3. Menyimpan data ke server
    async function saveNpcData() {
        const npcTextareas = npcListDiv.querySelectorAll('.npc-text');
        const npcsToSave = [];
        npcTextareas.forEach(textarea => {
            const text = textarea.value.trim();
            if (text) {
                npcsToSave.push(text);
            }
        });

        try {
            const response = await fetch(`/api/characters/${characterId}/npcs`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ npcs: npcsToSave })
            });

            if (!response.ok) throw new Error('Gagal menyimpan perubahan ke server.');

            alert('Info NPC berhasil di-update!');
        } catch (error) {
            alert(error.message);
        }
    }

    // Sambungkan fungsi ke tombol
    addNpcBtn.addEventListener('click', () => createNpcEntry());
    updateButton.addEventListener('click', saveNpcData);

    // Muat data saat halaman dibuka
    loadNpcData();
});