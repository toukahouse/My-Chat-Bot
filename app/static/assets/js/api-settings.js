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
    const safetyDangerousSelect = document.getElementById('safety-dangerous');
    // KAMUS PENERJEMAH NILAI SLIDER
    // Urutan ini PENTING: dari paling bebas (kiri) ke paling ketat (kanan)
    const safetyValueMap = [
        'BLOCK_NONE',
        'BLOCK_ONLY_HIGH',
        'BLOCK_MEDIUM_AND_ABOVE',
        'BLOCK_LOW_AND_ABOVE'
    ];

    const safetyDisplayMap = [
        'Block None',
        'Block High',
        'Block Medium+',
        'Block Low+ (Ketat)'
    ];
    // seleksi semua dropdown keamanan
    // Seleksi semua slider dan outputnya
    const sliders = {
        harassment: {
            slider: document.getElementById('safety-harassment-slider'),
            output: document.getElementById('safety-harassment-value')
        },
        hate: {
            slider: document.getElementById('safety-hate-slider'),
            output: document.getElementById('safety-hate-value')
        },
        sexually_explicit: {
            slider: document.getElementById('safety-sexually-explicit-slider'),
            output: document.getElementById('safety-sexually-explicit-value')
        },
        dangerous: {
            slider: document.getElementById('safety-dangerous-slider'),
            output: document.getElementById('safety-dangerous-value')
        }
    };
    // Kunci baru yang spesifik untuk pengaturan API di localStorage
    const storageKey = 'apiSettings';

    // 2. Fungsi untuk memuat pengaturan yang sudah ada
    function loadApiSettings() {
        const savedSettings = localStorage.getItem(storageKey);

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
        if (!settings.safetySettings) settings.safetySettings = defaultSettings.safetySettings;

        modelSelect.value = settings.model || defaultSettings.model;
        apiKeyInput.value = '';

        temperatureSlider.value = settings.temperature || defaultSettings.temperature;
        temperatureValue.textContent = temperatureSlider.value;
        topPSlider.value = settings.topP || defaultSettings.topP;
        topPValue.textContent = topPSlider.value;

        // Loop untuk mengatur setiap slider
        for (const key in sliders) {
            const savedValue = settings.safetySettings[key] || 'BLOCK_NONE';
            const sliderIndex = safetyValueMap.indexOf(savedValue);
            if (sliderIndex !== -1) {
                sliders[key].slider.value = sliderIndex;
                sliders[key].output.textContent = safetyDisplayMap[sliderIndex];
                updateSliderTrack(sliders[key].slider);
            }
        }
    }

    // 3. Fungsi untuk menyimpan pengaturan baru
    function saveApiSettings() {
        const newApiKey = apiKeyInput.value.trim();
        const oldSettings = JSON.parse(localStorage.getItem(storageKey) || '{}');

        // Buat objek safetySettings baru dari nilai slider
        const newSafetySettings = {};
        for (const key in sliders) {
            const sliderIndex = sliders[key].slider.value;
            newSafetySettings[key] = safetyValueMap[sliderIndex];
        }

        const updatedSettings = {
            apiKey: newApiKey ? newApiKey : oldSettings.apiKey,
            model: modelSelect.value,
            temperature: parseFloat(temperatureSlider.value),
            topP: parseFloat(topPSlider.value),
            safetySettings: newSafetySettings // <-- Gunakan objek yang baru dibuat
        };

        localStorage.setItem(storageKey, JSON.stringify(updatedSettings));

        notificationDiv.textContent = 'Pengaturan berhasil disimpan!';
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

    // Listener untuk semua slider keamanan

    // 5. Muat pengaturan saat halaman pertama kali dibuka
    loadApiSettings();
    // Fungsi helper untuk update warna track
    function updateSliderTrack(slider) {
        const percentage = (slider.value - slider.min) / (slider.max - slider.min) * 100;
        slider.style.background = `linear-gradient(to right, #5865f2 ${percentage}%, #4f545c ${percentage}%)`;
    }

    // Listener untuk semua slider keamanan
    for (const key in sliders) {
        // Panggil sekali saat load biar warnanya sesuai
        updateSliderTrack(sliders[key].slider);

        sliders[key].slider.addEventListener('input', (event) => {
            const sliderIndex = event.target.value;
            sliders[key].output.textContent = safetyDisplayMap[sliderIndex];

            // Panggil fungsi update warna setiap kali slider digeser
            updateSliderTrack(event.target);
        });
    }
});