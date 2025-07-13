document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SELEKSI SEMUA ELEMEN ---
    const userNameInput = document.getElementById('user-name');
    const userPersonaTextarea = document.getElementById('user-persona');
    const updateButton = document.querySelector('.update-button');
    const storageKey = 'userData';

    // Elemen BARU untuk Uploader
    const dropzone = document.getElementById('avatar-dropzone');
    const userAvatarUpload = document.getElementById('user-avatar-upload'); // input type=file
    const userAvatarInput = document.getElementById('user-avatar');     // input type=hidden
    const userAvatarPreview = document.getElementById('user-avatar-preview'); // img preview
    const emptyMessage = dropzone.querySelector('.dz-message-empty');
    const previewMessage = dropzone.querySelector('.dz-message-preview');
    const removeAvatarBtn = document.getElementById('remove-avatar-btn');

    // --- 2. FUNGSI UNTUK MENGELOLA TAMPILAN UPLOADER ---
    function showPreview(base64String) {
        userAvatarPreview.src = base64String;
        userAvatarInput.value = base64String;
        emptyMessage.classList.add('hidden-uploader-content');
        previewMessage.classList.remove('hidden-uploader-content');
    }

    function showEmpty() {
        userAvatarPreview.src = '#';
        userAvatarInput.value = '';
        userAvatarUpload.value = ''; // Reset input file
        emptyMessage.classList.remove('hidden-uploader-content');
        previewMessage.classList.add('hidden-uploader-content');
    }

    // --- 3. FUNGSI UNTUK MEMPROSES FILE GAMBAR ---
    function handleFile(file) {
        if (!file || !file.type.startsWith('image/')) {
            alert('Hanya file gambar (PNG, JPG, GIF) yang diizinkan!');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            showPreview(e.target.result);
        };
        reader.readAsDataURL(file);
    }

    // --- 4. FUNGSI LOAD & SAVE DATA ---
    function loadUserData() {
        const savedData = localStorage.getItem(storageKey);
        const userData = savedData ? JSON.parse(savedData) : {
            name: 'Izumi',
            avatar_url: '', // Default kosong
            persona: 'Aku adalah seorang mahasiswa IT yang suka bermain game dan anime.'
        };

        userNameInput.value = userData.name;
        userPersonaTextarea.value = userData.persona;

        // Logika baru untuk avatar
        if (userData.avatar_url) {
            showPreview(userData.avatar_url);
        } else {
            showEmpty();
        }
    }

    function saveUserData() {
        const updatedData = {
            name: userNameInput.value,
            avatar_url: userAvatarInput.value, // Ambil dari input hidden
            persona: userPersonaTextarea.value
        };

        localStorage.setItem(storageKey, JSON.stringify(updatedData));
        alert('Persona user berhasil di-update!');
    }

    // --- 5. EVENT LISTENERS ---
    updateButton.addEventListener('click', saveUserData);

    dropzone.addEventListener('click', () => {
        userAvatarUpload.click();
    });

    userAvatarUpload.addEventListener('change', (e) => {
        handleFile(e.target.files[0]);
    });

    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        handleFile(e.dataTransfer.files[0]);
    });

    removeAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showEmpty();
    });

    // --- 6. INISIALISASI ---
    loadUserData();
});