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
    const charVideoPreview = document.getElementById('char-video-preview');
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
    // static/assets/js/editor.js

    function showPreview(base64String) {
        // Sembunyikan semua preview dulu
        charAvatarPreview.classList.add('hidden-preview');
        charVideoPreview.classList.add('hidden-preview');

        // Cek tipe file dari data base64
        if (base64String.startsWith('data:video')) {
            // Jika video, isi src ke tag <video> dan tampilkan
            charVideoPreview.src = base64String;
            charVideoPreview.classList.remove('hidden-preview');
        } else {
            // Jika bukan, anggap gambar dan isi src ke tag <img>
            charAvatarPreview.src = base64String;
            charAvatarPreview.classList.remove('hidden-preview');
        }

        // Bagian ini tetap sama
        charAvatarInput.value = base64String;
        emptyMessage.classList.add('hidden-uploader-content');
        previewMessage.classList.remove('hidden-uploader-content');
    }

    // static/assets/js/editor.js

    function showEmpty() {
        // Kosongkan src untuk kedua elemen preview
        charAvatarPreview.src = '#';
        charVideoPreview.src = ''; // Untuk video, lebih baik string kosong

        // Sembunyikan kedua elemen preview
        charAvatarPreview.classList.add('hidden-preview');
        charVideoPreview.classList.add('hidden-preview');

        // Bagian ini tetap sama
        charAvatarInput.value = '';
        charAvatarUpload.value = '';
        emptyMessage.classList.remove('hidden-uploader-content');
        previewMessage.classList.add('hidden-uploader-content');
    }

    // static/assets/js/editor.js

    function handleFile(file) {
        // ▼▼▼ UBAH BARIS IF INI ▼▼▼
        if (!file || (!file.type.startsWith('image/') && !file.type.startsWith('video/'))) {
            showToast('Hanya file gambar (PNG, JPG, GIF) atau video (MP4, WEBM) yang diizinkan!', 'error');
            return;
        }
        // ▲▲▲ SELESAI ▲▲▲
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
            // 'data.avatar_url' sekarang berisi URL, bukan Base64.
            const avatarUrl = data.avatar_url;
            const avatarType = data.avatar_type || 'image';

            // Sembunyikan semua preview dulu
            charAvatarPreview.classList.add('hidden-preview');
            charVideoPreview.classList.add('hidden-preview');

            // Tampilkan elemen yang sesuai berdasarkan tipe
            if (avatarType === 'video') {
                charVideoPreview.src = avatarUrl;
                charVideoPreview.classList.remove('hidden-preview');
            } else { // Untuk 'image' dan 'gif'
                charAvatarPreview.src = avatarUrl;
                charAvatarPreview.classList.remove('hidden-preview');
            }

            // Tampilkan kotak preview dan sembunyikan pesan upload
            emptyMessage.classList.add('hidden-uploader-content');
            previewMessage.classList.remove('hidden-uploader-content');
        } else {
            // Jika tidak ada avatar sama sekali, tampilkan pesan upload
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
    // static/assets/js/editor.js

    async function handleSubmit() {
        // 1. Buat paket FormData kosong.
        const formData = new FormData();

        // 2. Kumpulkan semua data TEKS dan masukkan ke paket.
        const textData = getFormData(); // Fungsi ini tetap kita pakai, tapi hanya untuk teks.
        if (!textData.name) {
            showToast('Nama karakter tidak boleh kosong!', 'error');
            return;
        }
        formData.append('name', textData.name);
        formData.append('system_instruction', textData.system_instruction);
        formData.append('greeting', textData.greeting);
        formData.append('example_dialogs', textData.example_dialogs);
        formData.append('persona', textData.persona);

        // 3. Ambil FILE avatar yang dipilih dari input <input type="file">
        const avatarFile = charAvatarUpload.files[0];
        if (avatarFile) {
            // Jika ada file, masukkan ke paket dengan nama 'char-avatar-file'.
            // Nama ini harus SAMA dengan yang dicek di app.py (request.files['char-avatar-file'])
            formData.append('char-avatar-file', avatarFile);
        }

        // 4. Siapkan URL dan Method seperti biasa.
        const url = isEditMode ? `/api/characters/${characterId}` : '/api/characters';
        // PENTING: Untuk update, method tetap POST karena PUT tidak standar untuk FormData.
        // Kita akan akali ini di server nanti (jika perlu, tapi Flask cukup pintar).
        // Untuk sekarang, kita tetap pakai PUT untuk kejelasan.
        const method = isEditMode ? 'PUT' : 'POST';

        try {
            updateButton.disabled = true;
            updateButton.textContent = 'Menyimpan...';

            // 5. Kirim data! Perhatikan perbedaannya:
            const response = await fetch(url, {
                method: method,
                // JANGAN SET 'Content-Type'. Biarkan browser yang mengaturnya secara otomatis
                // agar bisa mengirim file dengan benar.
                body: formData // Body-nya sekarang adalah objek FormData, bukan JSON string.
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Terjadi kesalahan di server.');
            }

            showToast(result.message, 'success');

            setTimeout(() => {
                // Arahkan ke halaman menu utama, bukan detail, biar langsung lihat hasilnya.
                window.location.href = '/';
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