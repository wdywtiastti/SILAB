/* =========================================
   SILAB - AUTENTIKASI LOGIN PHP
========================================= */

"use strict";

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const loginButton = loginForm?.querySelector('button[type="submit"]');

// =========================================
// MODAL INFORMASI STATUS AKUN
// =========================================

const statusModal = document.getElementById("accountStatusModal");
const statusTitle = document.getElementById("accountStatusTitle");
const statusDescription = document.getElementById("accountStatusDescription");
const statusIcon = document.getElementById("accountStatusIcon");
const statusIconSymbol = document.getElementById("accountStatusIconSymbol");
const closeStatusButton = document.getElementById("closeAccountStatusModal");

let previousFocus = null;

const statusMessages = {
  menunggu_verifikasi: {
    title: "Akun Menunggu Verifikasi",
    description:
      "Akun Anda sedang menunggu verifikasi dari Kepala Laboratorium. Anda dapat login setelah akun disetujui.",
    icon: "bi bi-clock-history",
    style: "waiting",
  },

  ditolak: {
    title: "Pendaftaran Akun Ditolak",
    description:
      "Pendaftaran akun Anda telah ditolak oleh Kepala Laboratorium. Silakan hubungi pengelola laboratorium untuk informasi lebih lanjut.",
    icon: "bi bi-x-circle",
    style: "rejected",
  },

  nonaktif: {
    title: "Akun Dinonaktifkan",
    description:
      "Akun Anda saat ini dinonaktifkan. Silakan hubungi pengelola laboratorium.",
    icon: "bi bi-lock",
    style: "inactive",
  },
};

// =========================================
// MENAMPILKAN MODAL STATUS
// =========================================

function showAccountStatus(status) {
  const config = statusMessages[status];

  if (!config || !statusModal) return;

  previousFocus = document.activeElement;

  statusTitle.textContent = config.title;
  statusDescription.textContent = config.description;

  statusIcon.className = `account-status-icon ${config.style}`;
  statusIconSymbol.className = config.icon;

  statusModal.hidden = false;

  closeStatusButton?.focus();
}

// =========================================
// MENUTUP MODAL STATUS
// =========================================

function closeAccountStatus() {
  if (!statusModal || statusModal.hidden) return;

  statusModal.hidden = true;

  if (previousFocus && typeof previousFocus.focus === "function") {
    previousFocus.focus();
  }
}

closeStatusButton?.addEventListener("click", closeAccountStatus);

document.addEventListener("keydown", (event) => {
  if (!statusModal || statusModal.hidden) return;

  if (event.key === "Escape") {
    closeAccountStatus();
  }

  if (event.key === "Tab") {
    event.preventDefault();
    closeStatusButton?.focus();
  }
});

// =========================================
// PROSES LOGIN
// =========================================

loginForm?.addEventListener("submit", async function (event) {
  event.preventDefault();

  const identifier = loginForm.elements.identifier.value.trim();
  const password = loginForm.elements.password.value;

  loginMessage.textContent = "";
  statusModal && (statusModal.hidden = true);

  // =====================================
  // 1. VALIDASI INPUT
  // =====================================

  if (!identifier || !password) {
    loginMessage.textContent = "NIP/NPM dan password wajib diisi.";
    return;
  }

  if (!/^[0-9]+$/.test(identifier)) {
    loginMessage.textContent = "NIP/NPM hanya boleh berisi angka.";
    return;
  }

  // =====================================
  // 2. KIRIM DATA KE PHP
  // =====================================

  try {
    loginButton.disabled = true;
    loginButton.textContent = "Memproses...";

    const formData = new FormData();

    formData.append("identifier", identifier);
    formData.append("password", password);

    const response = await fetch("proses_login.php", {
      method: "POST",
      body: formData,
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });

    const result = await response.json();
    // =====================================
    // 3. LOGIN GAGAL / STATUS AKUN
    // =====================================

    if (!result.success) {
      if (statusMessages[result.status]) {
        showAccountStatus(result.status);
      } else {
        loginMessage.textContent =
          result.message || "NIP/NPM atau password salah.";
      }

      return;
    }

    // =====================================
    // 4. LOGIN BERHASIL
    // =====================================

    const tujuan = {
      kepala_lab: "../KepalaLab/Dashboard.php",
      laboran: "../Laboran/dashboard.php",
      pengguna: "../Pengguna/dashboard.php",
    };

    const halamanTujuan = tujuan[result.role];

    if (!halamanTujuan) {
      loginMessage.textContent = "Role akun tidak dikenali.";
      return;
    }

    // Session sudah dibuat oleh PHP.
    window.location.href = halamanTujuan;
  } catch (error) {
    console.error("Kesalahan login:", error);

    loginMessage.textContent =
      "Tidak dapat menghubungi server. Periksa koneksi dan coba kembali.";
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Login";
  }
});
