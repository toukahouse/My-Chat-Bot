document.addEventListener('DOMContentLoaded', () => {
    // --- 1. SELEKSI SEMUA ELEMEN ---
    const charNameInput = document.getElementById('char-name');
    const charBioTextarea = document.getElementById('char-bio');
    const charGreetingTextarea = document.getElementById('char-greeting');
    const charDialogsTextarea = document.getElementById('char-dialogs');
    const tempSlider = document.getElementById('char-temp');
    const tempValue = document.getElementById('temp-value');
    const updateButton = document.querySelector('.update-button');

    // Elemen untuk Persona (jika masih dipakai, jika tidak bisa dihapus)
    const personaEditorDiv = document.getElementById('persona-editor');

    // Elemen BARU untuk Uploader
    const dropzone = document.getElementById('avatar-dropzone');
    const charAvatarUpload = document.getElementById('char-avatar-upload'); // input type=file
    const charAvatarInput = document.getElementById('char-avatar'); // input type=hidden
    const charAvatarPreview = document.getElementById('char-avatar-preview'); // img preview
    const emptyMessage = dropzone.querySelector('.dz-message-empty');
    const previewMessage = dropzone.querySelector('.dz-message-preview');
    const removeAvatarBtn = document.getElementById('remove-avatar-btn');

    let characterData;

    // --- 2. FUNGSI UNTUK MENGELOLA TAMPILAN UPLOADER ---
    function showPreview(base64String) {
        charAvatarPreview.src = base64String;
        charAvatarInput.value = base64String;
        emptyMessage.classList.add('hidden-uploader-content');
        previewMessage.classList.remove('hidden-uploader-content');
    }

    function showEmpty() {
        charAvatarPreview.src = '#';
        charAvatarInput.value = '';
        charAvatarUpload.value = ''; // Reset input file
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
    function renderPersonaEditor(personaText) {
        // (Kode renderPersonaEditor milikmu, tidak diubah)
        personaEditorDiv.innerHTML = '';
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

    function loadCharacterData() {
        const savedData = localStorage.getItem('characterData');
        if (savedData) {
            characterData = JSON.parse(savedData);
        } else {
            characterData = {
                name: "Hana",
                avatar_url: "", // Default kosong
                system_instruction: "Kamu adalah Hana Sakuragi...",
                persona: "Nama lengkapku Hana Sakuragi...",
                greeting: "Hai! Akhirnya kamu dateng juga.",
                example_dialogs: "user: Kamu lagi apa?\nmodel: *tersenyum tipis* Lagi nungguin kamu lah, siapa lagi?",
                temperature: 0.9
            };
        }

        charNameInput.value = characterData.name;
        charBioTextarea.value = characterData.system_instruction;
        charGreetingTextarea.value = characterData.greeting;
        charDialogsTextarea.value = characterData.example_dialogs;
        renderPersonaEditor(characterData.persona);

        tempSlider.value = characterData.temperature;
        tempValue.textContent = characterData.temperature;

        // Logika baru untuk avatar
        if (characterData.avatar_url) {
            showPreview(characterData.avatar_url);
        } else {
            showEmpty();
        }

        tempSlider.oninput = function () {
            tempValue.textContent = this.value;
        }
    }

    function saveCharacterData() {
        const personaText = personaEditorDiv.querySelector('#persona-text').value;

        const updatedData = {
            name: charNameInput.value,
            avatar_url: charAvatarInput.value, // Ambil dari input hidden
            system_instruction: charBioTextarea.value,
            persona: personaText,
            greeting: charGreetingTextarea.value,
            example_dialogs: charDialogsTextarea.value,
            temperature: parseFloat(tempSlider.value)
        };

        localStorage.setItem('characterData', JSON.stringify(updatedData));
        alert('Karakter berhasil di-update!');
        characterData = updatedData;
    }

    // --- 5. EVENT LISTENERS ---
    // Listener tombol utama
    updateButton.addEventListener('click', saveCharacterData);

    // Listener untuk membuka dialog file saat dropzone diklik
    dropzone.addEventListener('click', () => {
        charAvatarUpload.click(); // Memicu klik pada input file yang tersembunyi
    });

    // Listener untuk menangani file yang dipilih dari dialog
    charAvatarUpload.addEventListener('change', (e) => {
        handleFile(e.target.files[0]);
    });

    // Listener untuk Drag & Drop
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault(); // Wajib untuk mengizinkan drop
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault(); // Wajib untuk menangani file
        dropzone.classList.remove('dragover');
        handleFile(e.dataTransfer.files[0]);
    });

    // Listener untuk tombol Hapus Avatar
    removeAvatarBtn.addEventListener('click', (e) => {
        e.stopPropagation(); // Hentikan event agar tidak memicu klik pada dropzone
        showEmpty();
    });


    // --- 6. INISIALISASI ---
    loadCharacterData();
});