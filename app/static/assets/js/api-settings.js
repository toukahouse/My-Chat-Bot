document.addEventListener('DOMContentLoaded', () => {
    // 1. Seleksi semua elemen form yang kita butuhkan
    const apiKeyInput = document.getElementById('api-key');
    const modelSelect = document.getElementById('model-select');
    const updateButton = document.querySelector('.update-button');
    const notificationDiv = document.getElementById('save-notification');

    // Slider Temperature
    const temperatureSlider = document.getElementById('temperature-slider');
    const temperatureValue = document.getElementById('temperature-value');

    // Slider Top-P
    const topPSlider = document.getElementById('top-p-slider');
    const topPValue = document.getElementById('top-p-value');

    // Input Max Output Tokens (Bukan slider lagi!)
    const maxOutputTokensInput = document.getElementById('max-output-tokens-input');

    // Pengaturan Safety
    const safetyValueMap = ['BLOCK_NONE', 'BLOCK_ONLY_HIGH', 'BLOCK_MEDIUM_AND_ABOVE', 'BLOCK_LOW_AND_ABOVE'];
    const safetyDisplayMap = ['Block None', 'Block High', 'Block Medium+', 'Block Low+ (Ketat)'];
    const sliders = {
        harassment: { slider: document.getElementById('safety-harassment-slider'), output: document.getElementById('safety-harassment-value') },
        hate: { slider: document.getElementById('safety-hate-slider'), output: document.getElementById('safety-hate-value') },
        sexually_explicit: { slider: document.getElementById('safety-sexually-explicit-slider'), output: document.getElementById('safety-sexually-explicit-value') },
        dangerous: { slider: document.getElementById('safety-dangerous-slider'), output: document.getElementById('safety-dangerous-value') }
    };

    // --- FUNGSI-FUNGSI HELPER ---

    function showNotification(message, isSuccess = true) {
        notificationDiv.textContent = message;
        notificationDiv.style.backgroundColor = isSuccess ? '#43b581' : '#f04747';
        notificationDiv.classList.add('show');
        setTimeout(() => {
            notificationDiv.classList.remove('show');
        }, 3000);
    }

    function updateSliderTrack(slider) {
        const percentage = (slider.value - slider.min) / (slider.max - slider.min) * 100;
        slider.style.background = `linear-gradient(to right, #5865f2 ${percentage}%, #4f545c ${percentage}%)`;
    }

    // --- FUNGSI UTAMA UNTUK MENGELOLA DATA ---

    // Mengisi form dengan data dari server
    function populateForm(settings) {
        modelSelect.value = settings.model || 'models/gemini-2.5-flash';

        temperatureSlider.value = settings.temperature !== undefined ? settings.temperature : 0.9;
        temperatureValue.textContent = temperatureSlider.value;
        updateSliderTrack(temperatureSlider); // PENTING: Update warna slider juga

        topPSlider.value = settings.topP !== undefined ? settings.topP : 0.95;
        topPValue.textContent = topPSlider.value;
        updateSliderTrack(topPSlider); // PENTING: Update warna slider juga

        maxOutputTokensInput.value = settings.maxOutputTokens || 2048;

        apiKeyInput.value = ''; // Selalu kosongkan input API Key demi keamanan

        const safetySettings = settings.safetySettings || {};
        for (const key in sliders) {
            const savedValue = safetySettings[key] || 'BLOCK_NONE';
            const sliderIndex = safetyValueMap.indexOf(savedValue);
            if (sliderIndex !== -1) {
                sliders[key].slider.value = sliderIndex;
                sliders[key].output.textContent = safetyDisplayMap[sliderIndex];
                updateSliderTrack(sliders[key].slider); // PENTING: Update warna slider juga
            }
        }
    }

    // Mengambil semua data dari form untuk dikirim ke server
    function getFormData() {
        const newSafetySettings = {};
        for (const key in sliders) {
            const sliderIndex = sliders[key].slider.value;
            newSafetySettings[key] = safetyValueMap[sliderIndex];
        }

        const data = {
            model: modelSelect.value,
            temperature: parseFloat(temperatureSlider.value),
            topP: parseFloat(topPSlider.value),
            maxOutputTokens: parseInt(maxOutputTokensInput.value, 10),
            safetySettings: newSafetySettings
        };

        const newApiKey = apiKeyInput.value.trim();
        if (newApiKey) {
            data.apiKey = newApiKey;
        }

        return data;
    }

    // --- LOGIKA UTAMA HALAMAN ---

    // 1. Ambil data dari server saat halaman dimuat
    async function initializePage() {
        try {
            const response = await fetch(`/api/api-settings?t=${Date.now()}`);
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Gagal memuat pengaturan dari server.');
            }
            const data = await response.json();
            populateForm(data);
        } catch (error) {
            showNotification(error.message, false);
            document.querySelector('.editor-main').innerHTML = `<p style="color: #f04747;">${error.message}</p>`;
        }
    }

    // 2. Kirim update ke server saat tombol Simpan ditekan
    async function handleUpdate() {
        const formData = getFormData();

        try {
            updateButton.disabled = true;
            updateButton.textContent = 'Menyimpan...';

            const response = await fetch('/api/api-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Terjadi kesalahan di server.');
            }

            showNotification(result.message, true);
            const currentSettings = JSON.parse(localStorage.getItem('apiSettings') || '{}');
            const newSettings = { ...currentSettings, ...formData };
            localStorage.setItem('apiSettings', JSON.stringify(newSettings));
            console.log('✅ localStorage berhasil disinkronkan dengan pengaturan baru.');
        } catch (error) {
            showNotification(`Gagal menyimpan: ${error.message}`, false);
        } finally {
            updateButton.disabled = false;
            updateButton.textContent = 'Simpan Pengaturan';
            apiKeyInput.value = '';
        }
    }

    // --- DAFTARKAN SEMUA EVENT LISTENER ---

    // Listener untuk slider Temperature
    temperatureSlider.addEventListener('input', (event) => {
        temperatureValue.textContent = event.target.value;
        updateSliderTrack(event.target);
    });

    // Listener untuk slider Top-P
    topPSlider.addEventListener('input', (event) => {
        topPValue.textContent = event.target.value;
        updateSliderTrack(event.target);
    });

    // Listener untuk semua slider Safety
    for (const key in sliders) {
        sliders[key].slider.addEventListener('input', (event) => {
            const sliderIndex = event.target.value;
            sliders[key].output.textContent = safetyDisplayMap[sliderIndex];
            updateSliderTrack(event.target);
        });
    }

    // Listener untuk tombol Simpan
    updateButton.addEventListener('click', handleUpdate);

    // --- JALANKAN SEMUANYA ---
    initializePage();
});