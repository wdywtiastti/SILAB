/* Pengelolaan logout SILAB */

// Mengambil seluruh tombol logout pada halaman.
const tombolKeluar = document.querySelectorAll(".logout-link");

// Menangani proses logout untuk setiap tombol.
tombolKeluar.forEach((tombol) => {

    tombol.addEventListener("click", function (event) {
        event.preventDefault();

        // Menghapus sesi pengguna.
        sesiSILAB.hapus();

        // Mengarahkan pengguna kembali ke halaman login.
        window.location.href = tombol.href;
    });

});