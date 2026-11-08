
/* Pengelolaan registrasi akun SILAB */

// Mengambil elemen form, pesan, dan modal.
const formDaftar = document.getElementById("registerForm");
const pesanDaftar = document.getElementById("registerMessage");
const modalDaftar = document.getElementById("registerModal");

// Menangani proses registrasi ketika form dikirim.
formDaftar.addEventListener("submit", function (event) {
    event.preventDefault();

    pesanDaftar.textContent = "";

    // Mengambil nilai seluruh input.
    const nama = formDaftar.elements.nama.value.trim();
    const identifier = formDaftar.elements.identifier.value.trim();
    const noTelp = formDaftar.elements.no_telp.value.trim();
    const password = formDaftar.elements.password.value;
    const konfirmasi = formDaftar.elements.confirm_password.value;
    const persetujuan = formDaftar.elements.terms.checked;

    // Memastikan nama tidak hanya berisi spasi.
    if (!nama) {
        pesanDaftar.textContent = "Nama lengkap wajib diisi.";
        return;
    }

    // Memastikan NIP/NPM hanya berisi angka.
    if (!/^[0-9]+$/.test(identifier)) {
        pesanDaftar.textContent = "NIP/NPM hanya boleh berisi angka.";
        return;
    }

    // Memastikan nomor telepon hanya berisi angka.
    if (!/^[0-9]+$/.test(noTelp)) {
        pesanDaftar.textContent = "Nomor telepon hanya boleh berisi angka.";
        return;
    }

    // Memastikan kedua password sama.
    if (password !== konfirmasi) {
        pesanDaftar.textContent = "Password dan konfirmasi password tidak sama.";
        return;
    }

    // Memastikan pengguna menyetujui ketentuan.
    if (!persetujuan) {
        pesanDaftar.textContent = "Silakan setujui syarat dan ketentuan.";
        return;
    }

    // Memperbarui informasi modal karena data belum disimpan.
    modalDaftar.querySelector("h2").textContent =
        "Validasi Formulir Berhasil!";

    const keteranganModal = modalDaftar.querySelectorAll("p");

    keteranganModal[0].textContent =
        "Data yang kamu masukkan sudah memenuhi pemeriksaan formulir.";

    keteranganModal[1].textContent =
        "Data belum disimpan karena database SILAB belum tersedia.";

    // Membuka modal pendaftaran.
    window.location.hash = "registerModal";
});
