document.addEventListener('DOMContentLoaded', () => {
    // 1. Seleksi elemen-elemen form
    const apiKeyInput = document.getElementById('api-key');
    const modelSelect = document.getElementById('model-select');
    const updateButton = document.querySelector('.update-button');
    const notificationDiv = document.getElementById('save-notification');
    const temperatureSlider = document.getElementById('temperature-slider');
    const temperatureValue = document.getElementById('temperature-value');
    const topPSlider = document.getElementById('top-p-slider');
    const topPValue = document.getElementById('top-p-value');

    // seleksi semua dropdown keamanan
    const safetyHarassmentSelect = document.getElementById('safety-harassment');
    const safetyHateSelect = document.getElementById('safety-hate');
    const safetySexuallyExplicitSelect = document.getElementById('safety-sexually-explicit');
    const safetyDangerousSelect = document.getElementById('safety-dangerous');
    // Kunci baru yang spesifik untuk pengaturan API di localStorage
    const storageKey = 'apiSettings';

    // 2. Fungsi untuk memuat pengaturan yang sudah ada
    function loadApiSettings() {
        const savedSettings = localStorage.getItem(storageKey);

        // Data default yang lebih lengkap sekarang
        const defaultSettings = {
            apiKey: '',
            model: 'models/gemini-2.5-flash',
            temperature: 0.9,
            topP: 0.95,
            safetySettings: {
                harassment: 'BLOCK_NONE',
                hate: 'BLOCK_NONE',
                sexually_explicit: 'BLOCK_NONE',
                dangerous: 'BLOCK_NONE'
            }
        };

        const settings = savedSettings ? JSON.parse(savedSettings) : defaultSettings;

        // Pastikan settings.safetySettings ada untuk menghindari error
        if (!settings.safetySettings) {
            settings.safetySettings = defaultSettings.safetySettings;
        }

        // Atur nilai untuk semua elemen form
        modelSelect.value = settings.model || defaultSettings.model;
        apiKeyInput.value = ''; // Tetap kosong demi keamanan

        temperatureSlider.value = settings.temperature || defaultSettings.temperature;
        temperatureValue.textContent = temperatureSlider.value;
        topPSlider.value = settings.topP || defaultSettings.topP;
        topPValue.textContent = topPSlider.value;

        safetyHarassmentSelect.value = settings.safetySettings.harassment || defaultSettings.safetySettings.harassment;
        safetyHateSelect.value = settings.safetySettings.hate || defaultSettings.safetySettings.hate;
        safetySexuallyExplicitSelect.value = settings.safetySettings.sexually_explicit || defaultSettings.safetySettings.sexually_explicit;
        safetyDangerousSelect.value = settings.safetySettings.dangerous || defaultSettings.safetySettings.dangerous;
    }

    // 3. Fungsi untuk menyimpan pengaturan baru
    function saveApiSettings() {
        const newApiKey = apiKeyInput.value.trim();
        const oldSettings = JSON.parse(localStorage.getItem(storageKey) || '{}');

        // Kumpulkan semua data dari form ke satu objek
        const updatedSettings = {
            apiKey: newApiKey ? newApiKey : oldSettings.apiKey,
            model: modelSelect.value,
            temperature: parseFloat(temperatureSlider.value),
            topP: parseFloat(topPSlider.value),
            safetySettings: {
                harassment: safetyHarassmentSelect.value,
                hate: safetyHateSelect.value,
                sexually_explicit: safetySexuallyExplicitSelect.value,
                dangerous: safetyDangerousSelect.value
            }
        };

        localStorage.setItem(storageKey, JSON.stringify(updatedSettings));

        notificationDiv.textContent = 'Pengaturan berhasil disimpan!'; // Pesan sukses
        notificationDiv.classList.add('show');
        setTimeout(() => {
            notificationDiv.classList.remove('show');
        }, 3000);

        apiKeyInput.value = '';
    }

    // Listener untuk update angka saat slider digeser
    temperatureSlider.addEventListener('input', () => {
        temperatureValue.textContent = temperatureSlider.value;
    });

    topPSlider.addEventListener('input', () => {
        topPValue.textContent = topPSlider.value;
    });
    updateButton.addEventListener('click', saveApiSettings);

    // 5. Muat pengaturan saat halaman pertama kali dibuka
    loadApiSettings();
});