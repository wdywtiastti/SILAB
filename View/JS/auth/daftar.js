
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

        tampilkanError(
            nama,
            namaError,
            "Nama lengkap wajib diisi."
        );

        valid = false;
    }


    // VALIDASI NIP/NPM
    if (!nilaiIdentifier) {

        tampilkanError(
            identifier,
            identifierError,
            "NIP/NPM wajib diisi."
        );

        valid = false;

    } else if (!/^[0-9]+$/.test(nilaiIdentifier)) {

        tampilkanError(
            identifier,
            identifierError,
            "NIP/NPM hanya boleh berisi angka."
        );

        valid = false;
    }


    // VALIDASI NOMOR TELEPON
    if (!nilaiNoTelp) {

        tampilkanError(
            noTelp,
            noTelpError,
            "Nomor telepon wajib diisi."
        );

        valid = false;

    } else if (!/^[0-9]+$/.test(nilaiNoTelp)) {

        tampilkanError(
            noTelp,
            noTelpError,
            "Nomor telepon hanya boleh berisi angka."
        );

        valid = false;
    }


    // VALIDASI PASSWORD
    if (!nilaiPassword) {

        tampilkanError(
            password,
            passwordError,
            "Password wajib diisi."
        );

        valid = false;
    }


    // VALIDASI KONFIRMASI PASSWORD
    if (!nilaiKonfirmasi) {

        tampilkanError(
            konfirmasi,
            confirmPasswordError,
            "Konfirmasi password wajib diisi."
        );

        valid = false;

    } else if (nilaiPassword !== nilaiKonfirmasi) {

        tampilkanError(
            konfirmasi,
            confirmPasswordError,
            "Password dan konfirmasi password tidak sama."
        );

        valid = false;
    }


    // VALIDASI PERSETUJUAN
    if (!persetujuan.checked) {

        tampilkanError(
            persetujuan,
            termsError,
            "Silakan setujui syarat dan ketentuan."
        );

        valid = false;
    }


    // MENGHENTIKAN PROSES JIKA VALIDASI GAGAL
    if (!valid) {

        const inputPertama = formDaftar.querySelector(
            '[aria-invalid="true"]'
        );

        if (inputPertama) {
            inputPertama.focus();
        }

        return;
    }


    // MENAMPILKAN MODAL JIKA VALIDASI BERHASIL
    window.location.hash = "registerModal";

});