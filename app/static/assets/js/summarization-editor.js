// static/assets/js/summarization-editor.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Ambil semua elemen penting dari HTML
    const backButton = document.getElementById('back-to-chat-btn');
    const summaryTextarea = document.getElementById('summary-textarea');
    const updateButton = document.getElementById('update-summary-btn');
    const startMessageInput = document.getElementById('start-message');
    const endMessageInput = document.getElementById('end-message');
    const manualSummaryBtn = document.getElementById('manual-summary-btn');
    const btnLoader = manualSummaryBtn.querySelector('.btn-loader');
    const btnText = manualSummaryBtn.querySelector('.btn-text');

    // 2. Ambil session_id dari URL, ini KUNCINYA
    const urlParams = new URLSearchParams(window.location.search);
    const sessionId = urlParams.get('session_id');

    // Fungsi untuk menampilkan notifikasi toast (kita pinjam dari script.js)
    function showToastNotification(message, type = 'info') {
        const existingToast = document.querySelector('.toast-notification');
        if (existingToast) {
            existingToast.remove();
        }
        const toast = document.createElement('div');
        toast.className = `toast-notification ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            toast.addEventListener('transitionend', () => toast.remove());
        }, 3000);
    }

    // 3. Kalau nggak ada session_id, halaman ini nggak ada gunanya
    if (!sessionId) {
        summaryTextarea.value = "ERROR: ID Sesi tidak ditemukan. Silakan kembali dan pilih sesi yang benar.";
        summaryTextarea.disabled = true;
        updateButton.disabled = true;
        backButton.href = 'sessions.html'; // Arahkan ke daftar sesi aja
        return;
    }

    // Kalau ada ID, kita buat link tombol 'Kembali' jadi pinter
    backButton.href = `index.html?session_id=${sessionId}`;

    // 4. Fungsi untuk mengambil data ringkasan dari server
    async function fetchSummary() {
        try {
            // Kita panggil endpoint yang UDAH ADA di app.py
            const response = await fetch(`/api/sessions/${sessionId}`);
            if (!response.ok) {
                throw new Error('Gagal mengambil data dari server.');
            }
            const data = await response.json();
            // Masukin data summary ke textarea
            summaryTextarea.value = data.summary || 'Ringkasan masih kosong.';
        } catch (error) {
            console.error("Error fetching summary:", error);
            summaryTextarea.value = `Gagal memuat ringkasan. Coba refresh. Error: ${error.message}`;
            showToastNotification('Gagal memuat ringkasan.', 'error');
        }
    }

    // 5. Fungsi untuk mengirim ringkasan yang sudah di-edit ke server
    async function updateSummary() {
        const newSummary = summaryTextarea.value;
        updateButton.disabled = true; // Matikan tombol selagi proses
        updateButton.textContent = 'Menyimpan...';

        try {
            // Kita panggil endpoint update yang UDAH ADA juga di app.py
            const response = await fetch(`/api/sessions/${sessionId}/summary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ summary: newSummary }),
            });

            if (!response.ok) {
                throw new Error('Server menolak pembaruan.');
            }

            console.log("Ringkasan berhasil diupdate!");
            showToastNotification('Ringkasan berhasil diupdate!', 'success');

        } catch (error) {
            console.error("Error updating summary:", error);
            showToastNotification('Gagal menyimpan ringkasan.', 'error');
        } finally {
            // Apapun yang terjadi, hidupkan lagi tombolnya
            updateButton.disabled = false;
            updateButton.textContent = 'Update Ringkasan';
        }
    }


    async function doManualSummary() {
        const startNum = parseInt(startMessageInput.value);
        const endNum = parseInt(endMessageInput.value);

        // Validasi input di sisi klien
        if (isNaN(startNum) || isNaN(endNum) || startNum <= 0 || endNum < startNum) {
            showToastNotification('Mohon masukkan rentang nomor pesan yang valid.', 'error');
            return;
        }

        // Aktifkan mode loading
        manualSummaryBtn.disabled = true;
        btnText.style.visibility = 'hidden';
        btnLoader.classList.remove('hidden');

        try {
            const response = await fetch(`/api/sessions/${sessionId}/summarize-manual`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ start: startNum, end: endNum }),
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Terjadi kesalahan tidak diketahui.');
            }

            // Jika berhasil, update textarea dengan ringkasan LENGKAP yang baru
            summaryTextarea.value = result.new_full_summary;
            showToastNotification('Ringkasan manual berhasil ditambahkan!', 'success');
            // Kosongkan inputan
            startMessageInput.value = '';
            endMessageInput.value = '';

        } catch (error) {
            console.error("Error during manual summary:", error);
            showToastNotification(`Error: ${error.message}`, 'error');
        } finally {
            // Matikan mode loading, apapun yang terjadi
            manualSummaryBtn.disabled = false;
            btnText.style.visibility = 'visible';
            btnLoader.classList.add('hidden');
        }
    }

    // 6. Sambungkan fungsi ke tombol dan muat data pertama kali
    updateButton.addEventListener('click', updateSummary);
    manualSummaryBtn.addEventListener('click', doManualSummary); // <-- SAMBUNGKAN TOMBOL BARU
    fetchSummary();
});