let editingPersonaId = null;
document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMEN UTAMA YANG PASTI ADA ---
    const personaListContainer = document.getElementById('persona-list-container');
    const showCreateFormBtn = document.getElementById('show-create-form-btn');
    const createPersonaForm = document.getElementById('create-persona-form');

    if (!personaListContainer || !showCreateFormBtn || !createPersonaForm) {
        console.error("Elemen dasar halaman persona tidak ditemukan!");
        return;
    }

    // --- DEKLARASI VARIABEL UNTUK ELEMEN FORM ---
    let newPersonaName, newPersonaDesc, newPersonaAvatar, dropzone, avatarUploadInput,
        avatarPreview, removeAvatarBtn, emptyMessage, previewMessage,
        cancelCreateBtn, savePersonaBtn;

    // --- FUNGSI UNTUK MENYELEKSI SEMUA ELEMEN FORM ---
    function selectFormElements() {
        console.log("--- Memulai Pengecekan Elemen Form ---");

        newPersonaName = document.getElementById('new-persona-name');
        console.log("newPersonaName is:", newPersonaName);

        newPersonaDesc = document.getElementById('new-persona-desc');
        console.log("newPersonaDesc is:", newPersonaDesc);

        newPersonaAvatar = document.getElementById('new-persona-avatar');
        console.log("newPersonaAvatar (hidden input) is:", newPersonaAvatar);

        dropzone = document.getElementById('persona-avatar-dropzone');
        console.log("dropzone is:", dropzone);

        avatarUploadInput = document.getElementById('persona-avatar-upload');
        console.log("avatarUploadInput is:", avatarUploadInput);

        avatarPreview = document.getElementById('persona-avatar-preview');
        console.log("avatarPreview is:", avatarPreview);

        removeAvatarBtn = document.getElementById('remove-persona-avatar-btn');
        console.log("removeAvatarBtn is:", removeAvatarBtn);

        cancelCreateBtn = document.getElementById('cancel-create-btn');
        console.log("cancelCreateBtn is:", cancelCreateBtn);

        savePersonaBtn = document.getElementById('save-persona-btn');
        console.log("savePersonaBtn is:", savePersonaBtn);

        console.log("--- Pengecekan Elemen Selesai ---");

        // Cek lagi setelah seleksi
        if (dropzone) {
            emptyMessage = dropzone.querySelector('.dz-message-empty');
            previewMessage = dropzone.querySelector('.dz-message-preview');
        }
    }

    // --- FUNGSI-FUNGSI HELPER (Termasuk Uploader) ---
    function showPreview(base64String) {
        if (!avatarPreview || !newPersonaAvatar || !emptyMessage || !previewMessage) return;
        avatarPreview.src = base64String;
        newPersonaAvatar.value = base64String;
        emptyMessage.classList.add('hidden-uploader-content');
        previewMessage.classList.remove('hidden-uploader-content');
    }

    function showEmpty() {
        if (!avatarPreview || !newPersonaAvatar || !avatarUploadInput || !emptyMessage || !previewMessage) return;
        avatarPreview.src = '#';
        newPersonaAvatar.value = '';
        avatarUploadInput.value = '';
        emptyMessage.classList.remove('hidden-uploader-content');
        previewMessage.classList.add('hidden-uploader-content');
    }

    function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('Hanya file gambar (PNG, JPG, GIF) yang diizinkan!');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => showPreview(e.target.result);
        reader.readAsDataURL(file);
    }

    function showForm() {
        createPersonaForm.classList.remove('hidden');
        showCreateFormBtn.classList.add('hidden');
    }

    function hideForm() {
        createPersonaForm.classList.add('hidden');
        showCreateFormBtn.classList.remove('hidden');
        if (newPersonaName) newPersonaName.value = '';
        if (newPersonaDesc) newPersonaDesc.value = '';
        if (avatarUploadInput) showEmpty();

        // ▼▼▼ TAMBAHKAN INI ▼▼▼
        // Reset kembali ke mode "Buat Baru"
        editingPersonaId = null;
        createPersonaForm.querySelector('h2').textContent = 'Buat Persona Baru';
        savePersonaBtn.textContent = 'Simpan';
        // ▲▲▲ SELESAI MENAMBAHKAN ▲▲▲
    }

    // --- FUNGSI API (Tidak berubah) ---
    // GANTI TOTAL FUNGSI createPersonaItem DENGAN VERSI FINAL INI
    function createPersonaItem(persona) {
        const item = document.createElement('div');
        item.className = 'persona-item';
        item.dataset.personaId = persona.id;

        const avatar = persona.avatar_url || 'https://i.imgur.com/7iA7s2P.png';

        // Langkah 1: Buat cetakan HTML-nya dulu
        item.innerHTML = `
        <div class="persona-header">
            <div class="persona-info">
                <img src="${avatar}" alt="Avatar">
                <span>${persona.name}</span>
            </div>
            <div class="persona-actions">
                <button class="set-default-btn">Set Default</button>
                <button class="edit-btn">Edit</button>
                <button class="delete-btn">Hapus</button>
                <button class="expand-btn">▼</button>
            </div>
        </div>
        <div class="persona-body">
            <p>${persona.persona || 'Tidak ada deskripsi.'}</p>
        </div>
    `;

        // Langkah 2: SETELAH HTML jadi, baru kita cari tombol-tombol di dalamnya
        const setDefaultBtn = item.querySelector('.set-default-btn');
        const editBtn = item.querySelector('.edit-btn');
        const deleteBtn = item.querySelector('.delete-btn');
        const expandBtn = item.querySelector('.expand-btn');

        // Langkah 3: SETELAH tombol ketemu, baru kita pasang listener

        // Logika untuk tombol Set Default
        if (persona.is_default) {
            setDefaultBtn.textContent = 'Default';
            setDefaultBtn.disabled = true;
            item.classList.add('is-default');
        }
        setDefaultBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            try {
                const response = await fetch(`/api/personas/${persona.id}/set-default`, { method: 'POST' });
                if (!response.ok) throw new Error('Gagal mengatur default.');
                await loadPersonas();
            } catch (error) {
                alert(error.message);
            }
        });

        // Logika untuk tombol Edit
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            startEditPersona(persona);
        });

        // Logika untuk tombol Hapus
        deleteBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            if (confirm(`Yakin ingin menghapus persona "${persona.name}"?`)) {
                await deletePersona(persona.id);
            }
        });

        // Logika untuk tombol Expand
        expandBtn.addEventListener('click', () => {
            item.classList.toggle('expanded');
        });

        return item;
    }
    // ▼▼▼ TAMBAHKAN FUNGSI BARU INI ▼▼▼
    function startEditPersona(persona) {
        // Tandai bahwa kita sedang dalam mode edit dan simpan ID-nya
        editingPersonaId = persona.id;

        // Isi form dengan data persona yang ada
        newPersonaName.value = persona.name;
        newPersonaDesc.value = persona.persona || '';
        if (persona.avatar_url) {
            showPreview(persona.avatar_url);
        } else {
            showEmpty();
        }

        // Ubah judul dan teks tombol form
        createPersonaForm.querySelector('h2').textContent = 'Edit Persona';
        savePersonaBtn.textContent = 'Simpan Perubahan';

        // Tampilkan form
        showForm();
    }
    // ▲▲▲ SELESAI MENAMBAHKAN ▲▲▲
    async function loadPersonas() {
        try {
            const response = await fetch('/api/personas');
            if (!response.ok) throw new Error('Gagal memuat daftar persona.');
            const personas = await response.json();
            personaListContainer.innerHTML = '';
            if (personas.length > 0) {
                personas.forEach(p => personaListContainer.appendChild(createPersonaItem(p)));
            } else {
                personaListContainer.innerHTML = '<p class="loading-message">Kamu belum punya persona. Buat satu yuk!</p>';
            }
        } catch (error) {
            personaListContainer.innerHTML = `<p class="loading-message" style="color:red;">${error.message}</p>`;
        }
    }

    // GANTI TOTAL FUNGSI saveNewPersona DENGAN INI
    async function handleSave() {
        const name = newPersonaName.value.trim();
        const avatar_url = newPersonaAvatar.value;
        const persona_desc = newPersonaDesc.value.trim();

        if (!name) {
            alert('Nama persona tidak boleh kosong!');
            return;
        }

        // Tentukan URL dan Method berdasarkan mode (edit atau buat baru)
        const isEditing = editingPersonaId !== null;
        const url = isEditing ? `/api/personas/${editingPersonaId}` : '/api/personas';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name, avatar_url: avatar_url, persona: persona_desc })
            });

            if (!response.ok) throw new Error('Gagal menyimpan perubahan ke server.');

            hideForm();
            await loadPersonas(); // Muat ulang daftar untuk menampilkan perubahan
        } catch (error) {
            alert(error.message);
        }
    }

    async function deletePersona(id) {
        try {
            const response = await fetch(`/api/personas/${id}`, { method: 'DELETE' });
            if (!response.ok) throw new Error('Gagal menghapus persona.');
            await loadPersonas();
        } catch (error) {
            alert(error.message);
        }
    }

    // --- INISIALISASI & EVENT LISTENERS UTAMA ---
    function initializePage() {
        selectFormElements();

        if (showCreateFormBtn) showCreateFormBtn.addEventListener('click', showForm);
        if (cancelCreateBtn) cancelCreateBtn.addEventListener('click', hideForm);
        if (savePersonaBtn) savePersonaBtn.addEventListener('click', handleSave);

        // Pasang event listener untuk uploader (INI BAGIAN YANG BENAR)
        if (dropzone) {
            dropzone.addEventListener('click', () => avatarUploadInput.click());
            dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
            dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
            dropzone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropzone.classList.remove('dragover');
                handleFile(e.dataTransfer.files[0]);
            });
        }
        if (avatarUploadInput) avatarUploadInput.addEventListener('change', (e) => handleFile(e.target.files[0]));
        if (removeAvatarBtn) removeAvatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showEmpty();
        });

        loadPersonas();
    }

    initializePage();
});
