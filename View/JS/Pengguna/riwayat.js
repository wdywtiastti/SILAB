"use strict";

/* =========================================
   ELEMEN HTML
========================================= */

const historyTableBody = document.getElementById("historyTableBody");
const historySearch = document.getElementById("historySearch");
const historyInfo = document.getElementById("historyInfo");

const prevPageButton = document.getElementById("prevPage");
const nextPageButton = document.getElementById("nextPage");

const currentPageElement = document.getElementById("currentPage");
const paginationNumbers = document.getElementById("paginationNumbers");

/* =========================================
   KONFIGURASI
========================================= */

const itemsPerPage = 5;

let currentPage = 1;
let currentHistoryData = [];
let allUserHistory = [];

/* =========================================
   VALIDASI ELEMEN
========================================= */

function validateHistoryElements() {
  const requiredElements = [
    historyTableBody,
    historyInfo,
    prevPageButton,
    nextPageButton,
    paginationNumbers,
  ];

  return requiredElements.every(Boolean);
}

/* =========================================
   HELPER STRING
========================================= */

function safeString(value) {
  return typeof value === "string" ? value : "";
}

/* =========================================
   PENCARIAN RIWAYAT
========================================= */

function searchHistory() {
  const keyword = safeString(historySearch?.value).trim().toLowerCase();

  const filteredHistory = allUserHistory.filter((data) => {
    const namaKegiatan = safeString(
      data.namaKegiatan || data.nama,
    ).toLowerCase();

    const kategori = safeString(data.kategori).toLowerCase();

    return namaKegiatan.includes(keyword) || kategori.includes(keyword);
  });

  currentPage = 1;

  renderHistory(filteredHistory);
}

/* =========================================
   MENAMPILKAN RIWAYAT
========================================= */

function renderHistory(historyData) {
  if (!historyTableBody) return;

  currentHistoryData = Array.isArray(historyData) ? historyData : [];

  const totalData = currentHistoryData.length;

  const totalPages = Math.ceil(totalData / itemsPerPage);

  if (totalPages === 0) {
    currentPage = 1;
    showEmptyHistory("Data riwayat tidak ditemukan.");
    updatePagination(0, 0, 0);
    return;
  }

  if (currentPage > totalPages || currentPage < 1) {
    currentPage = 1;
  }

  historyTableBody.innerHTML = "";

  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalData);

  const pageData = currentHistoryData.slice(startIndex, endIndex);

  pageData.forEach((submission) => {
    historyTableBody.appendChild(createHistoryRow(submission));
  });

  updatePagination(currentPage, totalPages, totalData);
}

/* =========================================
   UPDATE PAGINATION
========================================= */

function updatePagination(page, totalPages, totalData) {
  if (!historyInfo) return;

  const start = totalData === 0 ? 0 : (page - 1) * itemsPerPage + 1;

  const end = Math.min(page * itemsPerPage, totalData);

  historyInfo.textContent = `Menampilkan ${start}–${end} dari ${totalData} pengajuan`;

  if (prevPageButton) {
    prevPageButton.disabled = page <= 1 || totalPages === 0;
  }

  if (nextPageButton) {
    nextPageButton.disabled = page >= totalPages || totalPages === 0;
  }

  if (currentPageElement) {
    currentPageElement.textContent =
      totalPages === 0 ? "0" : `${page} / ${totalPages}`;
  }

  renderPaginationNumbers(totalPages);
}

/* =========================================
   NAVIGASI HALAMAN
========================================= */

function changePage(direction) {
  const totalPages = Math.ceil(currentHistoryData.length / itemsPerPage);

  const nextPage = currentPage + direction;

  if (nextPage < 1 || nextPage > totalPages) {
    return;
  }

  currentPage = nextPage;

  renderHistory(currentHistoryData);
}

/* =========================================
   FORMAT TANGGAL
========================================= */

function formatDate(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/* =========================================
   FORMAT WAKTU
========================================= */

function formatTime(dateValue) {
  if (!dateValue) return "-";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/* =========================================
   LABEL STATUS
========================================= */

function getStatusLabel(status) {
  const statusLabels = {
    menunggu_verifikasi: "Menunggu Verifikasi",
    menunggu: "Menunggu",
    disetujui: "Disetujui",
    ditolak: "Ditolak",
    direkomendasikan: "Direkomendasikan",
    dibatalkan: "Dibatalkan",
    selesai: "Selesai",
  };

  return statusLabels[status] || status || "Tidak diketahui";
}

/* =========================================
   TABEL KOSONG
========================================= */

function showEmptyHistory(message) {
  if (!historyTableBody) return;

  historyTableBody.innerHTML = "";

  const row = document.createElement("tr");
  const cell = document.createElement("td");

  cell.colSpan = 5;
  cell.textContent = message;
  cell.style.textAlign = "center";
  cell.style.padding = "25px";

  row.appendChild(cell);
  historyTableBody.appendChild(row);
}

/* =========================================
   MEMBUAT BARIS RIWAYAT
========================================= */

function createHistoryRow(data) {
  const row = document.createElement("tr");

  // Kolom 1: Tanggal pengajuan
  const dateCell = document.createElement("td");

  dateCell.textContent = formatDate(data.createdAt);

  // Kolom 2: Waktu kegiatan
  const timeCell = document.createElement("td");

  timeCell.textContent = `${formatTime(data.waktuMulai)} - ${formatTime(data.waktuSelesai)}`;

  // Kolom 3: Nama kegiatan dan kategori
  const activityCell = document.createElement("td");

  const activityName = document.createElement("strong");

  activityName.textContent = safeString(data.namaKegiatan || data.nama) || "-";

  const categoryName = document.createElement("small");

  categoryName.textContent = safeString(data.kategori) || "-";

  categoryName.style.display = "block";

  activityCell.append(activityName, categoryName);

  // Kolom 4: Status
  const statusCell = document.createElement("td");

  const statusBadge = document.createElement("span");

  statusBadge.className = "status-badge";
  statusBadge.textContent = getStatusLabel(data.status);

  statusCell.appendChild(statusBadge);

  // Kolom 5: ID pengajuan
  const actionCell = document.createElement("td");

  actionCell.textContent = data.id ?? "-";

  row.append(dateCell, timeCell, activityCell, statusCell, actionCell);

  return row;
}

/* =========================================
   NOMOR HALAMAN OTOMATIS
========================================= */

function renderPaginationNumbers(totalPages) {
  if (!paginationNumbers) return;

  paginationNumbers.innerHTML = "";

  if (totalPages === 0) return;

  let pages = [];

  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    if (start > 2) {
      pages.push("...");
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages - 1) {
      pages.push("...");
    }

    pages.push(totalPages);
  }

  pages.forEach((page) => {
    if (page === "...") {
      const ellipsis = document.createElement("span");

      ellipsis.className = "pagination-ellipsis";
      ellipsis.textContent = "...";

      paginationNumbers.appendChild(ellipsis);
      return;
    }

    const button = document.createElement("button");

    button.type = "button";
    button.className = "pagination-number";
    button.textContent = page;

    if (page === currentPage) {
      button.classList.add("active");
      button.setAttribute("aria-current", "page");
    }

    button.addEventListener("click", () => {
      currentPage = page;
      renderHistory(currentHistoryData);
    });

    paginationNumbers.appendChild(button);
  });
}

/* =========================================
   MEMUAT DATA RIWAYAT
========================================= */

function loadHistory() {
  if (!historyTableBody) return;

  historyTableBody.innerHTML = "";

  try {
    const sesi = sesiSILAB.ambil();

    if (!sesi || !sesi.identifier || sesi.role !== "pengguna") {
      allUserHistory = [];

      showEmptyHistory("Sesi pengguna tidak ditemukan. Silakan login kembali.");

      currentPage = 1;
      updatePagination(0, 0, 0);

      return;
    }

    const submissions = SILABStorage.get(SILABStorage.KEYS.SUBMISSIONS, []);

    if (!Array.isArray(submissions)) {
      allUserHistory = [];

      showEmptyHistory("Data riwayat tidak dapat dibaca.");

      currentPage = 1;
      updatePagination(0, 0, 0);

      return;
    }

    // Filter berdasarkan pengguna login
    allUserHistory = submissions.filter((submission) => {
      return submission && submission.userIdentifier === sesi.identifier;
    });

    // Urutkan berdasarkan tanggal terbaru
    allUserHistory.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();

      return (
        (Number.isNaN(dateB) ? 0 : dateB) - (Number.isNaN(dateA) ? 0 : dateA)
      );
    });

    currentPage = 1;

    renderHistory(allUserHistory);
  } catch (error) {
    console.error("Gagal memuat riwayat:", error);

    allUserHistory = [];
    currentHistoryData = [];
    currentPage = 1;

    showEmptyHistory("Terjadi kesalahan saat memuat data riwayat.");

    updatePagination(0, 0, 0);
  }
}

/* =========================================
   INISIALISASI
========================================= */

function initHistory() {
  if (!validateHistoryElements()) {
    console.error("Elemen HTML riwayat tidak ditemukan. Periksa ID elemen.");
    return;
  }

  // Event pencarian
  if (historySearch) {
    historySearch.addEventListener("input", searchHistory);
  }

  // Tombol sebelumnya
  prevPageButton.addEventListener("click", () => {
    changePage(-1);
  });

  // Tombol selanjutnya
  nextPageButton.addEventListener("click", () => {
    changePage(1);
  });

  // Muat data satu kali
  loadHistory();
}

// Jalankan setelah DOM tersedia
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initHistory);
} else {
  initHistory();
}
