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

    const safetyValueMap = ['BLOCK_NONE', 'BLOCK_ONLY_HIGH', 'BLOCK_MEDIUM_AND_ABOVE', 'BLOCK_LOW_AND_ABOVE'];
    const safetyDisplayMap = ['Block None', 'Block High', 'Block Medium+', 'Block Low+ (Ketat)'];
    
    const sliders = {
        harassment: { slider: document.getElementById('safety-harassment-slider'), output: document.getElementById('safety-harassment-value') },
        hate: { slider: document.getElementById('safety-hate-slider'), output: document.getElementById('safety-hate-value') },
        sexually_explicit: { slider: document.getElementById('safety-sexually-explicit-slider'), output: document.getElementById('safety-sexually-explicit-value') },
        dangerous: { slider: document.getElementById('safety-dangerous-slider'), output: document.getElementById('safety-dangerous-value') }
    };

    function showNotification(message, isSuccess = true) {
        notificationDiv.textContent = message;
        notificationDiv.style.backgroundColor = isSuccess ? '#43b581' : '#f04747';
        notificationDiv.classList.add('show');
        setTimeout(() => {
            notificationDiv.classList.remove('show');
        }, 3000);
    }

    // 2. FUNGSI BARU: Mengisi form dari data server
    function populateForm(settings) {
        modelSelect.value = settings.model || 'models/gemini-2.5-flash';
        temperatureSlider.value = settings.temperature || 0.9;
        temperatureValue.textContent = temperatureSlider.value;
        topPSlider.value = settings.topP || 0.95;
        topPValue.textContent = topPSlider.value;
        apiKeyInput.value = ''; // Selalu kosongkan input API Key

        const safetySettings = settings.safetySettings || {};
        for (const key in sliders) {
            const savedValue = safetySettings[key] || 'BLOCK_NONE';
            const sliderIndex = safetyValueMap.indexOf(savedValue);
            if (sliderIndex !== -1) {
                sliders[key].slider.value = sliderIndex;
                sliders[key].output.textContent = safetyDisplayMap[sliderIndex];
                updateSliderTrack(sliders[key].slider);
            }
        }
    }

    // 3. FUNGSI BARU: Mengambil data dari form
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
            safetySettings: newSafetySettings
        };

        // Hanya tambahkan apiKey ke data jika user mengisinya
        const newApiKey = apiKeyInput.value.trim();
        if (newApiKey) {
            data.apiKey = newApiKey;
        }
        
        return data;
    }

    // 4. FUNGSI UTAMA: Inisialisasi halaman (load data)
    async function initializePage() {
        try {
            const response = await fetch('/api/api-settings');
            if (!response.ok) {
                throw new Error('Gagal memuat pengaturan API dari server.');
            }
            const data = await response.json();
            populateForm(data);
        } catch (error) {
            showNotification(error.message, false);
            document.querySelector('.editor-main').innerHTML = `<p style="color: #f04747;">${error.message}</p>`;
        }
    }

    // 5. FUNGSI BARU: Kirim update ke server
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

        } catch (error) {
            showNotification(`Gagal menyimpan: ${error.message}`, false);
        } finally {
            updateButton.disabled = false;
            updateButton.textContent = 'Simpan Pengaturan';
            apiKeyInput.value = ''; // Kosongkan lagi setelah mencoba save
        }
    }

    // Fungsi helper dan event listener (tidak banyak berubah)
    function updateSliderTrack(slider) {
        const percentage = (slider.value - slider.min) / (slider.max - slider.min) * 100;
        slider.style.background = `linear-gradient(to right, #5865f2 ${percentage}%, #4f545c ${percentage}%)`;
    }

    temperatureSlider.addEventListener('input', () => {
        temperatureValue.textContent = temperatureSlider.value;
    });

    topPSlider.addEventListener('input', () => {
        topPValue.textContent = topPSlider.value;
    });

    for (const key in sliders) {
        updateSliderTrack(sliders[key].slider);
        sliders[key].slider.addEventListener('input', (event) => {
            const sliderIndex = event.target.value;
            sliders[key].output.textContent = safetyDisplayMap[sliderIndex];
            updateSliderTrack(event.target);
        });
    }

    updateButton.addEventListener('click', handleUpdate);

    // 6. Jalankan semuanya
    initializePage();
});