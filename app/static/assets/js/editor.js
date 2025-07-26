document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SELEKSI SEMUA ELEMEN ---
    const pageTitle = document.querySelector('.editor-header h1');
    const charNameInput = document.getElementById('char-name');
    const charBioTextarea = document.getElementById('char-bio'); // Ini system_instruction
    const charGreetingTextarea = document.getElementById('char-greeting');
    const charDialogsTextarea = document.getElementById('char-dialogs');
    const updateButton = document.querySelector('.update-button');
    const personaEditorDiv = document.getElementById('persona-editor');

    const dropzone = document.getElementById('avatar-dropzone');
    const charAvatarUpload = document.getElementById('char-avatar-upload');
    const charAvatarInput = document.getElementById('char-avatar'); // input hidden
    const charAvatarPreview = document.getElementById('char-avatar-preview');
    const emptyMessage = dropzone.querySelector('.dz-message-empty');
    const previewMessage = dropzone.querySelector('.dz-message-preview');
    const removeAvatarBtn = document.getElementById('remove-avatar-btn');
    // --- 2. LOGIKA UTAMA: Cek ID di URL ---
    const urlParams = new URLSearchParams(window.location.search);
    const characterId = urlParams.get('id');
    let isEditMode = characterId !== null;

    // Fungsi untuk menampilkan notifikasi
    function showToast(message, type = 'success') {
        // (Kamu bisa copy-paste fungsi notifikasi dari script.js jika mau)
        alert(message); // Untuk sementara kita pakai alert()
    }

    // --- 3. FUNGSI UNTUK MENGELOLA TAMPILAN UPLOADER (Sama seperti sebelumnya) ---
    function showPreview(base64String) {
        charAvatarPreview.src = base64String;
        charAvatarInput.value = base64String;
        emptyMessage.classList.add('hidden-uploader-content');
        previewMessage.classList.remove('hidden-uploader-content');
    }

    function showEmpty() {
        charAvatarPreview.src = '#';
        charAvatarInput.value = '';
        charAvatarUpload.value = '';
        emptyMessage.classList.remove('hidden-uploader-content');
        previewMessage.classList.add('hidden-uploader-content');
    }

    function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            showToast('Hanya file gambar (PNG, JPG, GIF) yang diizinkan!', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => showPreview(e.target.result);
        reader.readAsDataURL(file);
    }

    // --- 4. FUNGSI BARU: Mengisi Form dengan Data dari Server ---
    function populateForm(data) {
        charNameInput.value = data.name || '';
        charBioTextarea.value = data.system_instruction || '';
        charGreetingTextarea.value = data.greeting || '';
        charDialogsTextarea.value = data.example_dialogs || '';
        renderPersonaEditor(data.persona || '');
        if (data.avatar_url) {
            showPreview(data.avatar_url);
        } else {
            showEmpty();
        }
    }

    // Fungsi render persona (tidak berubah, tapi kita taruh di sini biar rapi)
    function renderPersonaEditor(personaText) {
        personaEditorDiv.innerHTML = ''; // Kosongkan dulu
        const formGroup = document.createElement('div');
        formGroup.className = 'form-group';
        const label = document.createElement('label');
        label.setAttribute('for', 'persona-text');
        label.textContent = 'Deskripsi Persona & Latar Belakang (Paragraf)';
        const textarea = document.createElement('textarea');
        textarea.id = 'persona-text';
        textarea.rows = 15;
        textarea.value = personaText;
        formGroup.appendChild(label);
        formGroup.appendChild(textarea);
        personaEditorDiv.appendChild(formGroup);
    }


    // --- 5. FUNGSI BARU: Mengambil Data dari Form ---
    function getFormData() {
        const personaText = personaEditorDiv.querySelector('#persona-text')?.value || '';
        // Ganti return object menjadi seperti ini
        return {
            name: charNameInput.value,
            avatar_url: charAvatarInput.value,
            system_instruction: charBioTextarea.value,
            greeting: charGreetingTextarea.value,
            example_dialogs: charDialogsTextarea.value,
            persona: personaText
        };
    }

    // --- 6. FUNGSI BARU: Kirim Data ke Server (Create atau Update) ---
    async function handleSubmit() {
        const formData = getFormData();

        if (!formData.name) {
            showToast('Nama karakter tidak boleh kosong!', 'error');
            return;
        }

        const url = isEditMode ? `/api/characters/${characterId}` : '/api/characters';
        const method = isEditMode ? 'PUT' : 'POST';

        try {
            updateButton.disabled = true;
            updateButton.textContent = 'Menyimpan...';

            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Terjadi kesalahan di server.');
            }

            showToast(result.message, 'success');

            // Setelah sukses, arahkan ke halaman utama (yang akan kita buat)
            setTimeout(() => {
                window.location.href = 'main-menu.html'; // Nanti kita buat halaman ini
            }, 1500);

        } catch (error) {
            showToast(`Gagal menyimpan: ${error.message}`, 'error');
        } finally {
            updateButton.disabled = false;
            updateButton.textContent = isEditMode ? 'Update Karakter' : 'Buat Karakter';
        }
    }


    // --- 7. FUNGSI INISIALISASI HALAMAN ---
    async function initializePage() {
        if (isEditMode) {
            // Jika ini mode edit, ambil data karakter dari server
            pageTitle.textContent = 'Edit Karakter';
            updateButton.textContent = 'Update Karakter';
            try {
                const response = await fetch(`/api/characters/${characterId}`);
                if (!response.ok) {
                    throw new Error('Karakter tidak ditemukan atau gagal dimuat.');
                }
                const data = await response.json();
                populateForm(data);
            } catch (error) {
                showToast(error.message, 'error');
                // Sembunyikan form jika gagal muat data
                document.querySelector('.editor-main').innerHTML = `<p style="color: #f04747;">${error.message}</p>`;
            }
        } else {
            // Jika ini mode buat baru, tampilkan form kosong
            pageTitle.textContent = 'Buat Karakter Baru';
            updateButton.textContent = 'Buat Karakter';
            renderPersonaEditor(''); // Pastikan editor persona juga kosong
            showEmpty(); // Pastikan uploader juga kosong
        }
    }

    // --- 8. EVENT LISTENERS (Sama seperti sebelumnya) ---
    updateButton.addEventListener('click', handleSubmit);
    dropzone.addEventListener('click', () => charAvatarUpload.click());
    charAvatarUpload.addEventListener('change', (e) => handleFile(e.target.files[0]));
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        handleFile(e.dataTransfer.files[0]);
    });
    removeAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showEmpty();
    });

    // --- 9. JALANKAN SEMUANYA ---
    initializePage();
});