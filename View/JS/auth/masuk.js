
/* Pengelolaan proses login SILAB */

// Mengambil elemen form dan pesan kesalahan dari HTML.
const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

// Menangani proses login ketika form dikirim.
loginForm.addEventListener("submit", function (event) {
    event.preventDefault();

    // Mengambil nilai NIP/NPM dan password dari form.
    const identifier = loginForm.elements.identifier.value.trim();
    const password = loginForm.elements.password.value;

    let role = "";
    let tujuan = "";

    // Memeriksa identitas dan password untuk setiap role.
    if (identifier === "07352411013" && password === "user123") {
        role = "pengguna";
        tujuan = "../Pengguna/dashboard.html";

    } else if (identifier === "07352411005" && password === "laboran123") {
        role = "laboran";
        tujuan = "../Laboran/dashboard.html";

    } else if (identifier === "07352411001" && password === "kepala123") {
        role = "kepala_lab";
        tujuan = "../KepalaLab/Dashboard.html";
    }

    // Menampilkan pesan jika identitas atau password tidak sesuai.
    if (role === "") {
        loginMessage.textContent = "NIP/NPM atau password tidak ditemukan.";
        return;
    }

    // Menyimpan identitas dan role setelah login berhasil.
    sesiSILAB.simpan(identifier, role);

    // Mengarahkan pengguna ke dashboard sesuai role.
    window.location.href = tujuan;
});
