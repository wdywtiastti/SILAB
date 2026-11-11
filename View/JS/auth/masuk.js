/* =========================================
   SILAB - AUTENTIKASI LOGIN
========================================= */

"use strict";

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");

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
      "Akun Anda sedang menunggu verifikasi dari " +
      "Kepala Laboratorium. Anda dapat login " +
      "setelah akun disetujui.",
    icon: "bi bi-clock-history",
    style: "waiting",
  },

  ditolak: {
    title: "Pendaftaran Akun Ditolak",
    description:
      "Pendaftaran akun Anda telah ditolak oleh " +
      "Kepala Laboratorium. Silakan hubungi " +
      "pengelola laboratorium untuk informasi lebih lanjut.",
    icon: "bi bi-x-circle",
    style: "rejected",
  },

  nonaktif: {
    title: "Akun Dinonaktifkan",
    description:
      "Akun Anda saat ini dinonaktifkan. " +
      "Silakan hubungi pengelola laboratorium.",
    icon: "bi bi-lock",
    style: "inactive",
  },
};

function showAccountStatus(status) {
  const config = statusMessages[status];

  if (!config || !statusModal) return;

  previousFocus = document.activeElement;

  statusTitle.textContent = config.title;
  statusDescription.textContent = config.description;

  statusIcon.className = `account-status-icon ${config.style}`;

  statusIconSymbol.className = config.icon;

  statusModal.hidden = false;
  closeStatusButton.focus();
}

function closeAccountStatus() {
  if (!statusModal || statusModal.hidden) return;

  statusModal.hidden = true;

  if (previousFocus && typeof previousFocus.focus === "function") {
    previousFocus.focus();
  }
}

if (closeStatusButton) {
  closeStatusButton.addEventListener("click", closeAccountStatus);
}

document.addEventListener("keydown", (event) => {
  if (!statusModal || statusModal.hidden) return;

  if (event.key === "Escape") {
    closeAccountStatus();
  }

  if (event.key === "Tab") {
    event.preventDefault();
    closeStatusButton.focus();
  }
});

loginForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const identifier = loginForm.elements.identifier.value.trim();

  const password = loginForm.elements.password.value;

  loginMessage.textContent = "";

  // =====================================
  // 1. VALIDASI INPUT
  // =====================================

  if (!identifier || !password) {
    loginMessage.textContent = "NIP/NPM dan password wajib diisi.";
    return;
  }

  // =====================================
  // 2. LOGIN KEPALA LAB DAN LABORAN
  //    (AKUN DUMMY SEMENTARA)
  // =====================================

  let role = "";
  let tujuan = "";

  if (identifier === "07352411005" && password === "laboran123") {
    role = "laboran";
    tujuan = "../Laboran/dashboard.html";
  } else if (identifier === "07352411001" && password === "kepala123") {
    role = "kepala_lab";
    tujuan = "../KepalaLab/Dashboard.html";
  }

  if (role) {
    sesiSILAB.simpan(identifier, role);
    window.location.href = tujuan;
    return;
  }

  // =====================================
  // 3. MEMERIKSA SILAB STORAGE
  // =====================================

  if (!window.SILABStorage) {
    loginMessage.textContent = "Sistem penyimpanan akun tidak tersedia.";
    return;
  }

  const users = SILABStorage.get(SILABStorage.KEYS.USERS, null);

  if (!Array.isArray(users)) {
    loginMessage.textContent = "Data akun tidak dapat dibaca.";
    return;
  }

  // =====================================
  // 4. MENCARI AKUN DAN PASSWORD
  // =====================================

  const user = users.find(
    (item) => item.nipNpm === identifier && item.password === password,
  );

  if (!user) {
    loginMessage.textContent = "NIP/NPM atau password salah.";
    return;
  }

  // =====================================
  // 5. MEMERIKSA STATUS AKUN
  // =====================================

  if (user.status === "menunggu_verifikasi") {
    showAccountStatus("menunggu_verifikasi");
    return;
  }

  if (user.status === "ditolak") {
    showAccountStatus("ditolak");
    return;
  }

  if (user.status === "nonaktif") {
    showAccountStatus("nonaktif");
    return;
  }

  if (user.status !== "aktif") {
    loginMessage.textContent = "Status akun tidak dikenali.";
    return;
  }

  // =====================================
  // 6. LOGIN PENGGUNA BERHASIL
  // =====================================

  sesiSILAB.simpan(identifier, "pengguna");

  window.location.href = "../Pengguna/dashboard.html";
});
