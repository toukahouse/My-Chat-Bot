document.addEventListener('DOMContentLoaded', () => {
    // 1. Seleksi semua elemen penting
    const npcListDiv = document.getElementById('npc-list');
    const addNpcBtn = document.getElementById('add-npc-btn');
    const updateButton = document.querySelector('.update-button');
    
    // Gunakan kunci baru yang spesifik untuk data NPC di localStorage
    const storageKey = 'npcData'; 

    // 2. Fungsi untuk membuat satu blok entri NPC di HTML
    function createNpcEntry(text = "") {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'npc-entry';

        const textarea = document.createElement('textarea');
        textarea.className = 'npc-text';
        textarea.rows = 4; // Tinggi awal yang cukup lega
        textarea.placeholder = 
`Tulis deskripsi NPC di sini...

Contoh:
Nama: Kenji Tanaka
Penampilan: Pria tinggi berambut perak, sering memakai kacamata hitam.
Sifat: Tenang, observan, dan sangat protektif terhadap Hana.
Peran: Kakak angkat Hana dan pemilik Kafe Neko.`;
        textarea.value = text;

        // Fitur auto-resize tinggi textarea
        textarea.addEventListener('input', () => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        });

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-npc-btn';
        deleteBtn.textContent = 'X';

        deleteBtn.addEventListener('click', () => {
            entryDiv.remove(); // Hapus elemen dari tampilan
        });

        entryDiv.appendChild(textarea);
        entryDiv.appendChild(deleteBtn);
        npcListDiv.appendChild(entryDiv);

        // Langsung panggil auto-resize saat pertama kali dibuat
        // Diberi sedikit delay untuk memastikan elemen sudah dirender sepenuhnya oleh browser
        setTimeout(() => {
            textarea.style.height = 'auto';
            textarea.style.height = (textarea.scrollHeight) + 'px';
        }, 10);
    }

    // 3. Fungsi untuk memuat data dari localStorage saat halaman dibuka
    function loadNpcData() {
        const savedData = localStorage.getItem(storageKey);
        // Data disimpan sebagai array of strings, sama seperti memori/world
        const npcs = savedData ? JSON.parse(savedData) : [];

        npcListDiv.innerHTML = ''; // Kosongkan list dulu

        if (npcs.length > 0) {
            npcs.forEach(npcText => createNpcEntry(npcText));
        } else {
            // Jika kosong, buat satu entri contoh biar user nggak bingung
            createNpcEntry(); 
        }
    }

    // 4. Fungsi untuk menyimpan data ke localStorage saat tombol "Update" diklik
    function saveNpcData() {
        const npcTextareas = npcListDiv.querySelectorAll('.npc-text');
        const npcsToSave = [];

        npcTextareas.forEach(textarea => {
            const text = textarea.value.trim();
            if (text) { // Hanya simpan yang ada isinya
                npcsToSave.push(text);
            }
        });

        localStorage.setItem(storageKey, JSON.stringify(npcsToSave));
        alert('Info NPC berhasil di-update!');
    }

    // 5. Sambungkan semua fungsi ke tombol-tombol yang sesuai
    addNpcBtn.addEventListener('click', () => createNpcEntry());
    updateButton.addEventListener('click', saveNpcData);

    // 6. Muat data saat halaman pertama kali dibuka
    loadNpcData();
});