/* =========================================
   SILAB - EDIT PROFILE
   Kepala Lab, Laboran, Pengguna
========================================= */

(function () {
  "use strict";

  const API_URL = "../auth/profil_api.php";

  const profileModal = document.getElementById("profileModal");
  const editModal = document.getElementById("editProfileModal");

  const form = document.getElementById("formEditProfile");

  if (!profileModal || !editModal || !form) {
    console.error("SILAB: Elemen modal profil tidak ditemukan.");
    return;
  }

  const btnEdit = document.getElementById("btnOpenEditProfile");
  const btnSave = document.getElementById("btnSaveProfile");
  const message = document.getElementById("profileMessage");

  const inputNama = document.getElementById("editProfileNama");
  const inputNip = document.getElementById("editProfileNip");
  const inputPassword = document.getElementById("editProfilePassword");

  // =====================================
  // BUKA DAN TUTUP MODAL
  // =====================================

  function bukaModal(modal) {
    modal.hidden = false;
    document.body.style.overflow = "hidden";
  }

  function tutupModal(modal) {
    modal.hidden = true;

    if (profileModal.hidden && editModal.hidden) {
      document.body.style.overflow = "";
    }
  }

  // Trigger dari menu navbar
  // Trigger Edit Profile dari navbar
  document.addEventListener("click", function (event) {
    const trigger = event.target.closest("[data-open-profile]");

    if (trigger) {
      event.preventDefault();

      // Ambil data profil terbaru
      inputNama.value = document
        .getElementById("profileNama")
        .textContent.trim();

      inputNip.value = document.getElementById("profileNip").textContent.trim();

      inputPassword.value = "";

      message.hidden = true;

      // Langsung buka popup edit
      tutupModal(profileModal);
      bukaModal(editModal);

      inputNama.focus();
    }
  });

  // Tombol tutup modal profil
  document.querySelectorAll("[data-close-profile]").forEach((button) => {
    button.addEventListener("click", () => {
      tutupModal(profileModal);
    });
  });

  // Tombol edit profil
  btnEdit.addEventListener("click", function () {
    inputNama.value = document.getElementById("profileNama").textContent.trim();

    inputNip.value = document.getElementById("profileNip").textContent.trim();

    inputPassword.value = "";

    message.hidden = true;

    tutupModal(profileModal);
    bukaModal(editModal);

    inputNama.focus();
  });

  // Tombol tutup edit
  document.querySelectorAll("[data-close-edit-profile]").forEach((button) => {
    button.addEventListener("click", () => {
      tutupModal(editModal);
    });
  });

  // Klik area luar modal
  [profileModal, editModal].forEach((modal) => {
    modal.addEventListener("click", function (event) {
      if (event.target === modal) {
        tutupModal(modal);
      }
    });
  });

  // Tombol Escape
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      tutupModal(editModal);
      tutupModal(profileModal);
    }
  });

  // =====================================
  // TAMPILKAN PASSWORD
  // =====================================

  const togglePassword = document.getElementById("toggleProfilePassword");

  togglePassword?.addEventListener("click", function () {
    const tampil = inputPassword.type === "password";

    inputPassword.type = tampil ? "text" : "password";

    this.innerHTML = tampil
      ? '<i class="bi bi-eye-slash"></i>'
      : '<i class="bi bi-eye"></i>';
  });

  // =====================================
  // PESAN
  // =====================================

  function tampilkanPesan(teks, tipe) {
    message.textContent = teks;
    message.className = "profile-message " + tipe;
    message.hidden = false;
  }

  // =====================================
  // SIMPAN PERUBAHAN PROFIL
  // =====================================

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (!form.reportValidity()) return;

    btnSave.disabled = true;
    btnSave.textContent = "Menyimpan...";

    message.hidden = true;

    try {
      const formData = new FormData(form);

      const response = await fetch(API_URL, {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal memperbarui profil.");
      }

      const nama = result.data.nama;
      const nip = result.data.nip_npm;

      // Perbarui tampilan profil
      document.getElementById("profileNama").textContent = nama;
      document.getElementById("profileNip").textContent = nip;

      // Perbarui input
      inputNama.value = nama;
      inputNip.value = nip;
      inputPassword.value = "";

      // Perbarui nama pada navbar jika menggunakan atribut ini
      document.querySelectorAll("[data-profile-name]").forEach((el) => {
        el.textContent = nama;
      });

      // Perbarui NIP/NPM jika diperlukan
      document.querySelectorAll("[data-profile-nip]").forEach((el) => {
        el.textContent = nip;
      });

      tampilkanPesan(
        result.message || "Profil berhasil diperbarui.",
        "success",
      );

      // Kembali ke modal profil setelah berhasil
      setTimeout(() => {
        tutupModal(editModal);
        bukaModal(profileModal);
      }, 1000);
    } catch (error) {
      tampilkanPesan(error.message || "Terjadi kesalahan.", "error");
    } finally {
      btnSave.disabled = false;
      btnSave.innerHTML = "Simpan Perubahan";
    }
  });
})();
