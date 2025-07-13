document.addEventListener('DOMContentLoaded', () => {
    // 1. Seleksi elemen-elemen form
    const apiKeyInput = document.getElementById('api-key');
    const modelSelect = document.getElementById('model-select');
    const updateButton = document.querySelector('.update-button');
    const notificationDiv = document.getElementById('save-notification');

    // Kunci baru yang spesifik untuk pengaturan API di localStorage
    const storageKey = 'apiSettings';

    // 2. Fungsi untuk memuat pengaturan yang sudah ada
    function loadApiSettings() {
        const savedSettings = localStorage.getItem(storageKey);

        // Data default jika belum ada pengaturan sama sekali
        const defaultSettings = {
            apiKey: '', // Kita tidak akan pernah menampilkan API key yang tersimpan
            model: 'models/gemini-1.5-flash-latest' // Default ke Flash
        };

        const settings = savedSettings ? JSON.parse(savedSettings) : defaultSettings;

        // Atur nilai dropdown sesuai dengan data yang tersimpan
        modelSelect.value = settings.model;

        // PENTING: Jangan pernah mengisi input API Key dengan nilai yang tersimpan
        // Biarkan kosong demi keamanan. User hanya mengisinya jika ingin MENGGANTI.
        apiKeyInput.value = '';
    }

    // 3. Fungsi untuk menyimpan pengaturan baru
    function saveApiSettings() {
        // Ambil nilai API Key yang baru dimasukkan. Jika kosong, kita tidak akan mengubahnya.
        const newApiKey = apiKeyInput.value.trim();

        // Ambil nilai model yang dipilih
        const selectedModel = modelSelect.value;

        // Ambil pengaturan lama sebagai dasar
        const oldSettings = JSON.parse(localStorage.getItem(storageKey) || '{}');

        // Buat objek data baru
        const updatedSettings = {
            // Jika ada API Key baru, gunakan itu. Jika tidak, pertahankan yang lama (yang mungkin kosong).
            apiKey: newApiKey ? newApiKey : oldSettings.apiKey,
            model: selectedModel
        };

        // Simpan objek yang sudah diupdate ke localStorage
        localStorage.setItem(storageKey, JSON.stringify(updatedSettings));

        notificationDiv.classList.add('show');
        setTimeout(() => {
            notificationDiv.classList.remove('show');
        }, 3000); // 3000 milidetik = 3 detik
        // Kosongkan kembali input API Key setelah disimpan
        apiKeyInput.value = '';
    }

    // 4. Sambungkan fungsi ke tombol
    updateButton.addEventListener('click', saveApiSettings);

    // 5. Muat pengaturan saat halaman pertama kali dibuka
    loadApiSettings();
});