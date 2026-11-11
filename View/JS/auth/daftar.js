/* Pengelolaan registrasi akun SILAB */

// Mengambil elemen form.
const formDaftar = document.getElementById("registerForm");

// Mengambil seluruh input.
const nama = formDaftar.elements.nama;
const identifier = formDaftar.elements.identifier;
const noTelp = formDaftar.elements.no_telp;
const password = formDaftar.elements.password;
const konfirmasi = formDaftar.elements.confirm_password;
const persetujuan = formDaftar.elements.terms;

// Mengambil elemen pesan kesalahan.
const namaError = document.getElementById("namaError");
const identifierError = document.getElementById("identifierError");
const noTelpError = document.getElementById("noTelpError");
const passwordError = document.getElementById("passwordError");
const confirmPasswordError = document.getElementById("confirmPasswordError");
const termsError = document.getElementById("termsError");

// MENAMPILKAN PESAN KESALAHAN
function tampilkanError(input, elemenError, pesan) {
  elemenError.textContent = pesan;

  input.setAttribute("aria-invalid", "true");

  const kelompok = input.closest(".input-group");

  if (kelompok) {
    kelompok.classList.add("is-invalid");
  }

  const label = input.closest(".terms");

  if (label) {
    label.classList.add("is-invalid");
  }
}

// MENGHAPUS PESAN KESALAHAN
function hapusError(input, elemenError) {
  elemenError.textContent = "";

  input.setAttribute("aria-invalid", "false");

  const kelompok = input.closest(".input-group");

  if (kelompok) {
    kelompok.classList.remove("is-invalid");
  }

  const label = input.closest(".terms");

  if (label) {
    label.classList.remove("is-invalid");
  }
}

// MENGHAPUS SELURUH PESAN KESALAHAN
function hapusSemuaError() {
  hapusError(nama, namaError);
  hapusError(identifier, identifierError);
  hapusError(noTelp, noTelpError);
  hapusError(password, passwordError);
  hapusError(konfirmasi, confirmPasswordError);
  hapusError(persetujuan, termsError);
}

// MENGHAPUS PESAN SAAT INPUT DIPERBAIKI

nama.addEventListener("input", function () {
  hapusError(nama, namaError);
});

identifier.addEventListener("input", function () {
  hapusError(identifier, identifierError);
});

noTelp.addEventListener("input", function () {
  hapusError(noTelp, noTelpError);
});

password.addEventListener("input", function () {
  hapusError(password, passwordError);
  hapusError(konfirmasi, confirmPasswordError);
});

konfirmasi.addEventListener("input", function () {
  hapusError(konfirmasi, confirmPasswordError);
});

persetujuan.addEventListener("change", function () {
  hapusError(persetujuan, termsError);
});

// =========================================
// PENYIMPANAN AKUN REGISTRASI
// =========================================

function simpanAkunRegistrasi() {
  // Memastikan SILABStorage tersedia.
  if (!window.SILABStorage) {
    console.error("SILABStorage belum dimuat.");

    alert("Sistem penyimpanan belum tersedia.");
    return false;
  }

  // Mengambil data pengguna yang sudah tersimpan.
  const users = SILABStorage.get(SILABStorage.KEYS.USERS, []);

  if (!Array.isArray(users)) {
    console.error("Format data pengguna tidak valid.");

    alert("Data pengguna tidak dapat diproses.");
    return false;
  }

  // Memeriksa NIP/NPM duplikat.
  const nipNpmTerdaftar = users.some((user) => {
    const identitas = user.nipNpm || user.identifier || "";

    return identitas.toString().trim() === identifier.value.trim();
  });

  if (nipNpmTerdaftar) {
    tampilkanError(
      identifier,
      identifierError,
      "NIP/NPM sudah terdaftar. Gunakan NIP/NPM lain.",
    );

    identifier.focus();
    return false;
  }

  // Membuat ID pengguna yang unik.
  let userId;

  do {
    userId = `USR${Date.now()}${Math.floor(Math.random() * 1000)}`;
  } while (users.some((user) => user.id === userId));

  // Membentuk data akun baru.
  const akunBaru = {
    id: userId,
    nama: nama.value.trim(),
    nipNpm: identifier.value.trim(),
    noTelp: noTelp.value.trim(),
    password: password.value,
    status: "menunggu_verifikasi",
    tanggalDaftar: new Date().toISOString(),
    tanggalVerifikasi: null,
    alasanPenolakan: null,
  };

  // Menambahkan akun ke data pengguna.
  const usersTerbaru = [...users, akunBaru];

  // Menyimpan melalui SILABStorage.
  const berhasil = SILABStorage.set(SILABStorage.KEYS.USERS, usersTerbaru);

  if (!berhasil) {
    console.error("Penyimpanan akun gagal.");

    alert("Pendaftaran gagal disimpan. Silakan coba kembali.");
    return false;
  }

  return true;
}

// PROSES VALIDASI REGISTRASI

formDaftar.addEventListener("submit", function (event) {
  event.preventDefault();

  hapusSemuaError();

  let valid = true;

  // Mengambil nilai input.
  const nilaiNama = nama.value.trim();
  const nilaiIdentifier = identifier.value.trim();
  const nilaiNoTelp = noTelp.value.trim();
  const nilaiPassword = password.value;
  const nilaiKonfirmasi = konfirmasi.value;

  // VALIDASI NAMA
  if (!nilaiNama) {
    tampilkanError(nama, namaError, "Nama lengkap wajib diisi.");

    valid = false;
  }

  // VALIDASI NIP/NPM
  if (!nilaiIdentifier) {
    tampilkanError(identifier, identifierError, "NIP/NPM wajib diisi.");

    valid = false;
  } else if (!/^[0-9]+$/.test(nilaiIdentifier)) {
    tampilkanError(
      identifier,
      identifierError,
      "NIP/NPM hanya boleh berisi angka.",
    );

    valid = false;
  }

  // VALIDASI NOMOR TELEPON
  if (!nilaiNoTelp) {
    tampilkanError(noTelp, noTelpError, "Nomor telepon wajib diisi.");

    valid = false;
  } else if (!/^[0-9]+$/.test(nilaiNoTelp)) {
    tampilkanError(
      noTelp,
      noTelpError,
      "Nomor telepon hanya boleh berisi angka.",
    );

    valid = false;
  }

  // VALIDASI PASSWORD
  if (!nilaiPassword) {
    tampilkanError(password, passwordError, "Password wajib diisi.");

    valid = false;
  }

  // VALIDASI KONFIRMASI PASSWORD
  if (!nilaiKonfirmasi) {
    tampilkanError(
      konfirmasi,
      confirmPasswordError,
      "Konfirmasi password wajib diisi.",
    );

    valid = false;
  } else if (nilaiPassword !== nilaiKonfirmasi) {
    tampilkanError(
      konfirmasi,
      confirmPasswordError,
      "Password dan konfirmasi password tidak sama.",
    );

    valid = false;
  }

  // VALIDASI PERSETUJUAN
  if (!persetujuan.checked) {
    tampilkanError(
      persetujuan,
      termsError,
      "Silakan setujui syarat dan ketentuan.",
    );

    valid = false;
  }

  // MENGHENTIKAN PROSES JIKA VALIDASI GAGAL
  if (!valid) {
    const inputPertama = formDaftar.querySelector('[aria-invalid="true"]');

    if (inputPertama) {
      inputPertama.focus();
    }

    return;
  }

  // MENYIMPAN AKUN KE SILAB STORAGE
  const berhasil = simpanAkunRegistrasi();

  if (!berhasil) {
    return;
  }

  // MENAMPILKAN MODAL JIKA PENDAFTARAN BERHASIL
  window.location.hash = "registerModal";
});
