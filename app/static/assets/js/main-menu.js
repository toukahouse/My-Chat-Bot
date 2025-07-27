document.addEventListener('DOMContentLoaded', async () => {
    const characterGrid = document.getElementById('character-grid');
    const searchInput = document.getElementById('search-input');
    const searchToggleBtn = document.getElementById('search-toggle-btn');
    const expandableSearchBar = document.getElementById('expandable-search-bar');
    if (!characterGrid) return;


    function createCharacterCard(character) {
        const card = document.createElement('div');
        card.className = 'character-card';
        card.dataset.characterId = character.id;

        const avatarUrl = character.avatar_url || "https://i.imgur.com/7iA7s2P.png";
        const shortDescription = character.description || 'Tidak ada deskripsi.';

        let avatarElement = '';
        const avatarType = character.avatar_type || 'image';

        // ▼▼▼ MODIFIKASI TOTAL BLOK LOGIKA INI ▼▼▼
        if (avatarType === 'video') {
            // Jika tipenya video, kita pakai tag <video>
            // autoplay, loop, muted, playsinline itu wajib biar videonya bisa main otomatis tanpa kontrol
            avatarElement = `<video src="${avatarUrl}" class="card-image" autoplay loop muted playsinline></video>`;
        } else {
            // Untuk 'image' dan 'gif', kita tetap pakai tag <img>
            avatarElement = `<img src="${avatarUrl}" alt="Avatar ${character.name}" class="card-image">`;
        }
        // ▲▲▲ SELESAI ▲▲▲

        card.innerHTML = `
        <div class="card-image-container">
            ${avatarElement}
        </div>
        <div class="card-content">
            <h3 class="card-title">${character.name}</h3>
            <p class="card-description">${shortDescription}</p>
        </div>
    `;

        return card;
    }

    // Fungsi utama untuk memuat semua karakter
    async function loadCharacters() {
        try {
            const response = await fetch('/api/characters');
            if (!response.ok) {
                throw new Error('Gagal mengambil data karakter dari server.');
            }
            const characters = await response.json();

            // Kosongkan pesan loading
            characterGrid.innerHTML = '';

            if (characters.length === 0) {
                characterGrid.innerHTML = '<p class="loading-message">Kamu belum punya karakter. Buat satu yuk!</p>';
                return;
            }

            // Tampilkan setiap karakter sebagai kartu
            characters.forEach(character => {
                const cardElement = createCharacterCard(character);
                characterGrid.appendChild(cardElement);
            });

        } catch (error) {
            console.error(error);
            characterGrid.innerHTML = `<p class="loading-message" style="color: #f04747;">${error.message}</p>`;
        }
    }

    characterGrid.addEventListener('click', (event) => {
        // Cari kartu yang diklik (yang bukan placeholder)
        const card = event.target.closest('.character-card:not(.is-placeholder)');
        if (!card) return;

        // Ambil ID dari kartu
        const charId = card.dataset.characterId;
        if (!charId) return;

        // Arahkan ke halaman detail karakter dengan menyertakan ID-nya
        window.location.href = `character-detail.html?id=${charId}`;
    });

    // --- Logika untuk Dropdown Profil ---
    const profileMenuBtn = document.getElementById('profile-menu-btn');
    const profileDropdown = document.getElementById('profile-dropdown');

    if (profileMenuBtn && profileDropdown) {
        profileMenuBtn.addEventListener('click', (event) => {
            // Menghentikan event agar tidak langsung ditangkap oleh listener 'window'
            event.stopPropagation();
            profileDropdown.classList.toggle('hidden');
        });

        // Menutup dropdown jika klik di mana saja di luar menu
        window.addEventListener('click', (event) => {
            if (!profileDropdown.classList.contains('hidden') && !profileMenuBtn.contains(event.target)) {
                profileDropdown.classList.add('hidden');
            }
        });
    }

    // --- Logika untuk Search ---
    const searchInputs = [
        document.getElementById('search-input'),
        document.getElementById('search-input-desktop')
    ];

    const handleSearch = (event) => {
        const searchTerm = event.target.value.toLowerCase();
        const allCards = document.querySelectorAll('.character-card');

        allCards.forEach(card => {
            const cardTitle = card.querySelector('.card-title').textContent.toLowerCase();
            if (cardTitle.includes(searchTerm)) {
                card.style.display = 'flex';
            } else {
                card.style.display = 'none';
            }
        });
    };

    searchInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', handleSearch);
        }
    });
    if (searchToggleBtn && expandableSearchBar) {
        searchToggleBtn.addEventListener('click', () => {
            expandableSearchBar.classList.toggle('hidden');
        });
    }
    // Jalankan fungsi untuk memuat karakter saat halaman dibuka
    loadCharacters();

});