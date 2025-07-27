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

        videoPreview = document.getElementById('persona-video-preview'); // Kita pakai nama variabel baru
        console.log("videoPreview is:", videoPreview);

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

    // static/assets/js/personas.js

    // Ganti total fungsi ini
    // static/assets/js/personas.js

    function showPreview(base64String) {
        if (!avatarPreview || !videoPreview || !newPersonaAvatar || !emptyMessage || !previewMessage) return;

        // KUNCI #1: Sembunyikan pesan "Drag & drop", tampilkan kotak preview
        emptyMessage.style.display = 'none';
        previewMessage.style.display = 'block';

        // Sembunyikan kedua elemen media dulu
        avatarPreview.style.display = 'none';
        videoPreview.style.display = 'none';

        // Tampilkan elemen media yang benar
        if (base64String.startsWith('data:video')) {
            videoPreview.src = base64String;
            videoPreview.style.display = 'block';
        } else {
            avatarPreview.src = base64String;
            avatarPreview.style.display = 'block';
        }

        // Simpan data base64 di input hidden
        newPersonaAvatar.value = base64String;
    }

    // static/assets/js/personas.js

    function showEmpty() {
        if (!avatarPreview || !videoPreview || !newPersonaAvatar || !avatarUploadInput || !emptyMessage || !previewMessage) return;

        // KUNCI #2: Tampilkan pesan "Drag & drop", sembunyikan total kotak preview
        emptyMessage.style.display = 'block';
        previewMessage.style.display = 'none';

        // Reset elemen-elemennya juga untuk kebersihan
        avatarPreview.src = '#';
        videoPreview.src = '';
        newPersonaAvatar.value = '';
        avatarUploadInput.value = '';
    }

    function handleFile(file) {
        if (!file || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) {
            alert('Hanya file gambar (PNG, JPG, GIF) atau video (MP4, WEBM) yang diizinkan!');
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

        const avatarUrl = persona.avatar_url || 'https://i.imgur.com/7iA7s2P.png';
        // ▼▼▼ GANTI LOGIKA INI ▼▼▼
        let avatarType = persona.avatar_type || 'image'; // Ambil dari API
        // Jika dari API kosong dan URL-nya adalah video, kita perbaiki tipenya
        if (avatarType === 'image' && (avatarUrl.endsWith('.mp4') || avatarUrl.endsWith('.webm'))) {
            avatarType = 'video';
        }

        // ▼▼▼ LOGIKA BARU DI SINI ▼▼▼
        let avatarElement = '';
        if (avatarType === 'video' && persona.avatar_url) { // Pastikan URL-nya ada
            avatarElement = `<video src="${avatarUrl}" class="persona-avatar" autoplay loop muted playsinline></video>`;
        } else {
            avatarElement = `<img src="${avatarUrl}" alt="Avatar" class="persona-avatar">`;
        }
        // ▲▲▲ SELESAI ▲▲▲

        item.innerHTML = `
        <div class="persona-header">
            <div class="persona-info">
                ${avatarElement}
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
    // static/assets/js/personas.js

    function startEditPersona(persona) {
        editingPersonaId = persona.id;
        newPersonaName.value = persona.name;
        newPersonaDesc.value = persona.persona || '';

        if (persona.avatar_url) {
            const avatarUrl = persona.avatar_url;
            // ▼▼▼ GANTI BARIS INI ▼▼▼
            let avatarType = persona.avatar_type || 'image';
            if (avatarType === 'image' && (avatarUrl.endsWith('.mp4') || avatarUrl.endsWith('.webm'))) {
                avatarType = 'video';
            }

            avatarPreview.classList.add('hidden-preview');
            videoPreview.classList.add('hidden-preview');

            // ▼▼▼ GANTI KONDISI INI ▼▼▼
            if (avatarType === 'video') {
                // ▲▲▲ SELESAI ▲▲▲
                videoPreview.src = avatarUrl;
                videoPreview.classList.remove('hidden-preview');
            } else {
                avatarPreview.src = avatarUrl;
                avatarPreview.classList.remove('hidden-preview');
            }
            emptyMessage.classList.add('hidden-uploader-content');
            previewMessage.classList.remove('hidden-uploader-content');
        } else {
            showEmpty();
        }

        createPersonaForm.querySelector('h2').textContent = 'Edit Persona';
        savePersonaBtn.textContent = 'Simpan Perubahan';
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

    // static/assets/js/personas.js

    // ▼▼▼ GANTI TOTAL FUNGSI INI DENGAN VERSI BARU ▼▼▼
    async function handleSave() {
        // 1. Buat paket FormData kosong
        const formData = new FormData();

        // 2. Kumpulkan semua data TEKS
        const name = newPersonaName.value.trim();
        const persona_desc = newPersonaDesc.value.trim();

        if (!name) {
            alert('Nama persona tidak boleh kosong!');
            return;
        }
        formData.append('name', name);
        formData.append('persona', persona_desc);

        // 3. Ambil FILE avatar yang dipilih dari input <input type="file">
        const avatarFile = avatarUploadInput.files[0];
        if (avatarFile) {
            // Jika ada file, masukkan ke paket. Nama 'persona-avatar-file' harus unik
            formData.append('persona-avatar-file', avatarFile);
        }

        // 4. Siapkan URL dan Method
        const isEditing = editingPersonaId !== null;
        const url = isEditing ? `/api/personas/${editingPersonaId}` : '/api/personas';
        const method = isEditing ? 'PUT' : 'POST';

        try {
            // (Kamu bisa tambahkan logika disabled tombol di sini jika mau)
            // savePersonaBtn.disabled = true;

            // 5. Kirim data sebagai FormData
            const response = await fetch(url, {
                method: method,
                // JANGAN SET 'Content-Type', biarkan browser yang atur
                body: formData
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.error || 'Gagal menyimpan perubahan ke server.');
            }

            hideForm();
            await loadPersonas(); // Muat ulang daftar untuk menampilkan perubahan
        } catch (error) {
            alert(error.message);
        } finally {
            // savePersonaBtn.disabled = false;
        }
    }
    // ▲▲▲ SELESAI ▲▲▲

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
