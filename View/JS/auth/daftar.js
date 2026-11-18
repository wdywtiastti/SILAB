/* =========================================
   SILAB - REGISTRASI AKUN
   TERHUBUNG DENGAN PHP DAN MYSQL
========================================= */

"use strict";

// Mengambil elemen form
const formDaftar = document.getElementById("registerForm");

const nama = formDaftar.elements.nama;
const identifier = formDaftar.elements.identifier;
const noTelp = formDaftar.elements.no_telp;
const password = formDaftar.elements.password;
const konfirmasi = formDaftar.elements.confirm_password;
const persetujuan = formDaftar.elements.terms;

// Pesan kesalahan
const namaError = document.getElementById("namaError");
const identifierError = document.getElementById("identifierError");
const noTelpError = document.getElementById("noTelpError");
const passwordError = document.getElementById("passwordError");
const confirmPasswordError = document.getElementById("confirmPasswordError");
const termsError = document.getElementById("termsError");

const tombolDaftar = formDaftar.querySelector('button[type="submit"]');

// =========================================
// MENAMPILKAN PESAN KESALAHAN
// =========================================

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

// =========================================
// MENGHAPUS PESAN KESALAHAN
// =========================================

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

// =========================================
// MENGHAPUS SEMUA ERROR
// =========================================

function hapusSemuaError() {
  hapusError(nama, namaError);
  hapusError(identifier, identifierError);
  hapusError(noTelp, noTelpError);
  hapusError(password, passwordError);
  hapusError(konfirmasi, confirmPasswordError);
  hapusError(persetujuan, termsError);
}

// =========================================
// MENGHAPUS ERROR SAAT INPUT DIPERBAIKI
// =========================================

nama.addEventListener("input", () => {
  hapusError(nama, namaError);
});

identifier.addEventListener("input", () => {
  hapusError(identifier, identifierError);
});

noTelp.addEventListener("input", () => {
  hapusError(noTelp, noTelpError);
});

password.addEventListener("input", () => {
  hapusError(password, passwordError);
  hapusError(konfirmasi, confirmPasswordError);
});

konfirmasi.addEventListener("input", () => {
  hapusError(konfirmasi, confirmPasswordError);
});

persetujuan.addEventListener("change", () => {
  hapusError(persetujuan, termsError);
});

// =========================================
// PROSES VALIDASI REGISTRASI
// =========================================

formDaftar.addEventListener("submit", async function (event) {
  event.preventDefault();

  hapusSemuaError();

  let valid = true;

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

  // HENTIKAN JIKA VALIDASI GAGAL
  if (!valid) {
    const inputPertama = formDaftar.querySelector('[aria-invalid="true"]');

    inputPertama?.focus();

    return;
  }

  // =====================================
  // KIRIM DATA KE PHP
  // =====================================

  const formData = new FormData();

  formData.append("nama", nilaiNama);
  formData.append("identifier", nilaiIdentifier);
  formData.append("no_telp", nilaiNoTelp);
  formData.append("password", nilaiPassword);
  formData.append("confirm_password", nilaiKonfirmasi);
  formData.append("terms", persetujuan.checked ? "1" : "0");

  try {
    tombolDaftar.disabled = true;
    tombolDaftar.textContent = "Memproses...";

    const response = await fetch("proses_register.php", {
      method: "POST",
      body: formData,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });

    const result = await response.json();

    // =================================
    // PENDAFTARAN GAGAL
    // =================================

    if (!response.ok || !result.success) {
      if (result.field === "identifier") {
        tampilkanError(
          identifier,
          identifierError,
          result.message || "NIP/NPM sudah terdaftar.",
        );

        identifier.focus();
      } else if (result.field === "nama") {
        tampilkanError(nama, namaError, result.message);

        nama.focus();
      } else if (result.field === "no_telp") {
        tampilkanError(noTelp, noTelpError, result.message);

        noTelp.focus();
      } else if (result.field === "password") {
        tampilkanError(password, passwordError, result.message);

        password.focus();
      } else if (result.field === "confirm_password") {
        tampilkanError(konfirmasi, confirmPasswordError, result.message);

        konfirmasi.focus();
      } else if (result.field === "terms") {
        tampilkanError(persetujuan, termsError, result.message);
      } else {
        alert(result.message || "Pendaftaran gagal. Silakan coba kembali.");
      }

      return;
    }

    // =================================
    // PENDAFTARAN BERHASIL
    // =================================

    formDaftar.reset();

    window.location.hash = "registerModal";
  } catch (error) {
    console.error("Kesalahan registrasi:", error);

    alert("Tidak dapat menghubungi server. Periksa koneksi dan coba kembali.");
  } finally {
    tombolDaftar.disabled = false;
    tombolDaftar.textContent = "Daftar";
  }
});
