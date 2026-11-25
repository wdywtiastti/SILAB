/* =========================================
   SILAB - SIMULASI KONFLIK JADWAL
   DATA SEMENTARA (TANPA STORAGE)
========================================= */

/* =========================================
   SILAB - PERHITUNGAN WAKTU BENTROKAN
========================================= */

window.getGroupTime = function (pengajuan) {
  if (!Array.isArray(pengajuan)) {
    return "Data pengajuan tidak valid";
  }

  // MENGUBAH FORMAT JAM KE MENIT
  function toMinutes(time) {
    if (typeof time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      return null;
    }

    const [hours, minutes] = time.split(":").map(Number);

    return hours * 60 + minutes;
  }

  // MENGUBAH MENIT KE FORMAT HH:MM
  function formatTime(value) {
    const hours = String(Math.floor(value / 60)).padStart(2, "0");

    const minutes = String(value % 60).padStart(2, "0");

    return `${hours}:${minutes}`;
  }

  // MEMVALIDASI INTERVAL WAKTU
  const intervals = pengajuan
    .map((item) => ({
      start: toMinutes(item.mulai),
      end: toMinutes(item.selesai),
    }))
    .filter(
      (item) =>
        item.start !== null && item.end !== null && item.start < item.end,
    );

  const overlaps = [];

  // MENCARI BENTURAN ANTARPENGAJUAN
  for (let i = 0; i < intervals.length; i++) {
    for (let j = i + 1; j < intervals.length; j++) {
      const start = Math.max(intervals[i].start, intervals[j].start);

      const end = Math.min(intervals[i].end, intervals[j].end);

      if (start < end) {
        overlaps.push({ start, end });
      }
    }
  }

  if (overlaps.length === 0) {
    return "Tidak ada bentrokan";
  }

  // MENGURUTKAN WAKTU BENTROKAN
  overlaps.sort((a, b) => a.start - b.start || a.end - b.end);

  // MENGGABUNGKAN INTERVAL BENTROKAN
  const merged = [];

  for (const overlap of overlaps) {
    const last = merged[merged.length - 1];

    if (last && overlap.start <= last.end) {
      last.end = Math.max(last.end, overlap.end);
    } else {
      merged.push({ ...overlap });
    }
  }

  // MENAMPILKAN HASIL
  return merged
    .map((item) => `${formatTime(item.start)} – ${formatTime(item.end)}`)
    .join(", ");
};

/* =========================================
   SILAB - DATA KONFLIK DARI DATABASE API
========================================= */

const API_KONFLIK = "api/konflik_api.php";

// Menyimpan data konflik dari database.
let dataKonflikKepalaLab = [];

// Mengambil data konflik melalui API.
async function ambilDataKonflikKepalaLab() {
  try {
    const response = await fetch(`${API_KONFLIK}?action=list`, {
      method: "GET",
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    });

    const hasil = await response.json();

    if (!response.ok || !hasil.success) {
      throw new Error(hasil.message || "Gagal mengambil data konflik.");
    }

    if (!Array.isArray(hasil.data)) {
      throw new Error("Format data konflik tidak valid.");
    }

    dataKonflikKepalaLab = hasil.data
      .filter((item) => item && Array.isArray(item.pengajuan))
      .map((item) => ({
        ...item,

        id: Number(item.id ?? item.id_konflik),

        pengajuan: item.pengajuan.map((p) => ({
          ...p,

          id: Number(p.id ?? p.id_pengajuan),

          pemohon: p.pemohon || p.namaPemohon || "-",

          kegiatan: p.kegiatan || p.namaKegiatan || "-",

          mulai: p.mulai || "-",

          selesai: p.selesai || "-",
        })),
      }));

    return dataKonflikKepalaLab;
  } catch (error) {
    console.error("GAGAL MENGAMBIL DATA KONFLIK:", error);

    throw error;
  }
}
/* =========================================
   SILAB - RENDER SESI KONFLIK DINAMIS
========================================= */

(() => {
  "use strict";

  const conflictList = document.getElementById("conflict-list");
  const toggleAllButton = document.getElementById("toggle-all-conflicts");

  const expandedConflicts = new Set();

  // Menyimpan satu pengajuan terpilih untuk setiap sesi.
  // Menyimpan banyak pengajuan terpilih untuk setiap kelompok konflik.
  // Format: Map<idKonflik, Set<idPengajuan>>
  const selectedSubmissions = new Map();

  function getSelectedSubmissionIds(groupId) {
    return selectedSubmissions.get(groupId) ?? new Set();
  }

  function getIntervalWaktu(pengajuan) {
    const mulai =
      pengajuan.waktuMulai || `${pengajuan.tanggal} ${pengajuan.mulai}:00`;

    const selesai =
      pengajuan.waktuSelesai || `${pengajuan.tanggal} ${pengajuan.selesai}:00`;

    return {
      mulai: String(mulai).replace("T", " "),
      selesai: String(selesai).replace("T", " "),
    };
  }

  function jadwalBeririsan(a, b) {
    const waktuA = getIntervalWaktu(a);
    const waktuB = getIntervalWaktu(b);

    return waktuA.mulai < waktuB.selesai && waktuA.selesai > waktuB.mulai;
  }

  let pendingConflictDecision = null;
  let accordionInitialized = false;

  // Jumlah pengajuan per halaman.
  const ITEMS_PER_PAGE = 5;

  // Menyimpan halaman aktif masing-masing konflik.
  const conflictPages = new Map();

  if (!conflictList) {
    console.error("Elemen #conflict-list tidak ditemukan.");
    return;
  }

  /* =========================================
   MODAL KONFIRMASI KEPUTUSAN
========================================= */

  function openDecisionModal(group, selectedData) {
    const modal = document.getElementById("decision-confirm-modal");

    if (!modal) {
      console.error("Modal keputusan tidak ditemukan.");
      return;
    }

    const selectedIds = selectedData.map((item) => item.id);

    pendingConflictDecision = {
      groupId: group.id,
      selectedIds: selectedIds,
    };

    const fields = {
      "decision-selected-name": selectedData
        .map((item) => item.pemohon ?? item.nama ?? "-")
        .join(", "),

      "decision-selected-activity": selectedData
        .map((item) => item.kegiatan ?? "-")
        .join("; "),

      "decision-selected-time": selectedData
        .map((item) => `${item.mulai}–${item.selesai} WIT`)
        .join("; "),

      "decision-approved-count": selectedData.length,

      "decision-shifted-count": group.pengajuan.length - selectedData.length,
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);

      if (element) {
        element.textContent = value;
      }
    });

    modal.hidden = false;
    document.body.style.overflow = "hidden";

    document.getElementById("cancel-decision")?.focus();
  }

  function closeDecisionModal() {
    const modal = document.getElementById("decision-confirm-modal");

    if (!modal) return;

    modal.hidden = true;
    document.body.style.overflow = "";

    pendingConflictDecision = null;

    const button = document.getElementById("confirm-decision");

    if (button) {
      button.disabled = false;
    }
  }

  async function confirmConflictDecision() {
    if (!pendingConflictDecision) {
      console.error("Belum ada keputusan yang dipilih.");
      return;
    }

    const groupId = pendingConflictDecision.groupId;
    const selectedIds = pendingConflictDecision.selectedIds;

    if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
      alert("Pilih minimal satu pengajuan.");
      return;
    }

    const button = document.getElementById("confirm-decision");

    if (button) {
      button.disabled = true;
      button.textContent = "Menyimpan Keputusan...";
    }

    try {
      const response = await fetch(API_KONFLIK, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          action: "putuskan",
          id_konflik: groupId,
          id_pengajuan: selectedIds,
        }),
      });

      const hasil = await response.json();

      if (!response.ok || !hasil.success) {
        throw new Error(hasil.message || "Keputusan gagal disimpan.");
      }

      console.log("KEPUTUSAN BERHASIL:", hasil.data);

      selectedSubmissions.delete(groupId);

      closeDecisionModal();

      await renderKonflik();

      alert("Keputusan konflik berhasil disimpan!");
    } catch (error) {
      console.error("GAGAL MENYIMPAN KEPUTUSAN:", error);

      alert("Gagal menyimpan keputusan: " + error.message);
    } finally {
      if (button) {
        button.disabled = false;
        button.innerHTML = '<i class="bi bi-check2"></i> Tetapkan Keputusan';
      }
    }
  }

  // Pasang event listener satu kali.
  document
    .getElementById("close-decision-modal")
    ?.addEventListener("click", closeDecisionModal);

  document
    .getElementById("cancel-decision")
    ?.addEventListener("click", closeDecisionModal);

  document
    .getElementById("confirm-decision")
    ?.addEventListener("click", confirmConflictDecision);

  // Klik area luar modal.
  document
    .getElementById("decision-confirm-modal")
    ?.addEventListener("click", (event) => {
      if (event.target.id === "decision-confirm-modal") {
        closeDecisionModal();
      }
    });

  // =====================================
  // 1. MEMBUAT ELEMEN DENGAN TEKS AMAN
  // =====================================

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = String(text);
    }

    return element;
  }

  // =====================================
  // 2. MENGHITUNG RINGKASAN KONFLIK
  // =====================================

  function renderSummary(konflik) {
    // Mengambil kelompok konflik yang masih aktif.
    const konflikAktif = konflik.filter(
      (item) => item.status === "menunggu_keputusan",
    );

    // Menghitung seluruh pengajuan dalam kelompok aktif.
    const totalSubmissions = konflikAktif.reduce((total, item) => {
      return (
        total + (Array.isArray(item.pengajuan) ? item.pengajuan.length : 0)
      );
    }, 0);

    const values = {
      "total-conflict-groups": konflikAktif.length,
      "waiting-conflict-count": konflikAktif.length,
      "pending-conflict-count": konflikAktif.length,
      "total-conflict-submissions": totalSubmissions,
    };

    Object.entries(values).forEach(([id, value]) => {
      const element = document.getElementById(id);

      if (element) {
        element.textContent = value;
      }
    });
  }

  /* =========================================
   POPUP DETAIL PEMINJAMAN
========================================= */

  function formatNilaiSkor(value) {
    if (value === null || value === undefined || value === "") {
      return "Belum dihitung";
    }

    const number = Number(value);

    return Number.isFinite(number) ? number.toFixed(2) : String(value);
  }

  function formatStatusPengajuan(value) {
    const status = String(value || "-")
      .replace(/_/g, " ")
      .trim();

    if (!status || status === "-") return "-";

    return status
      .split(" ")
      .map((kata) => kata.charAt(0).toUpperCase() + kata.slice(1))
      .join(" ");
  }

  function renderDetailPengajuanDinamis(data) {
    const container = document.getElementById("detail-dinamis");

    if (!container) return;

    container.replaceChildren();

    function buatKartu(label, value) {
      const card = document.createElement("div");
      card.className = "detail-item";

      const title = document.createElement("span");
      title.textContent = label;

      const content = document.createElement("strong");
      content.textContent =
        value === null || value === undefined || value === ""
          ? "-"
          : String(value);

      card.append(title, content);
      container.appendChild(card);
    }

    const aturan = Array.isArray(data.detailAturan) ? data.detailAturan : [];

    aturan.forEach((detail) => {
      buatKartu(detail.kelompok || "Jenis Kegiatan", detail.nama || "-");
    });

    const fasilitas = Array.isArray(data.detailFasilitas)
      ? data.detailFasilitas
      : [];

    fasilitas.forEach((detail) => {
      buatKartu(detail.nama || "Fasilitas", `Jumlah: ${detail.jumlah ?? "-"}`);
    });

    if (!aturan.length && !fasilitas.length) {
      buatKartu(
        "Detail Tambahan",
        "Belum ada rincian jenis kegiatan atau fasilitas.",
      );
    }
  }

  function openDetailPeminjaman(data) {
    const modal = document.getElementById("submission-detail-modal");

    if (!modal) {
      console.error("Popup detail peminjaman tidak ditemukan.");
      return;
    }

    const fields = {
      "detail-id-pengajuan": `ID PENGAJUAN #${data.id ?? data.id_pengajuan ?? "-"}`,

      "detail-peminjam": data.pemohon ?? data.namaPemohon ?? "-",

      "detail-kegiatan": data.kegiatan ?? data.namaKegiatan ?? "-",

      "detail-nip-npm": data.nipNpm ?? "-",

      "detail-waktu": `${data.tanggal ? data.tanggal + " | " : ""}${data.mulai ?? "-"} – ${data.selesai ?? "-"} WIT`,

      "detail-status": formatStatusPengajuan(
        data.statusPengajuan ?? data.status,
      ),

      "detail-prioritas": data.prioritas ?? "Belum diklasifikasikan",

      "detail-skor-jenis": formatNilaiSkor(data.skorJenisKegiatan),

      "detail-skor-fasilitas": formatNilaiSkor(data.skorFasilitas),

      "detail-skor": formatNilaiSkor(
        data.skorAkhir ?? data.skor ?? data.skorSementara,
      ),
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);

      if (element) {
        element.textContent = value;
      }
    });

    renderDetailPengajuanDinamis(data);

    modal.hidden = false;
    modal.classList.add("show");

    document.body.style.overflow = "hidden";

    document.getElementById("close-submission-detail")?.focus();
  }

  function closeDetailPeminjaman() {
    const modal = document.getElementById("submission-detail-modal");

    if (!modal) return;

    modal.hidden = true;
    modal.classList.remove("show");

    document.body.style.overflow = "";
  }

  // Tombol tutup popup.
  document
    .getElementById("close-submission-detail")
    ?.addEventListener("click", closeDetailPeminjaman);

  // Klik area luar popup.
  document
    .getElementById("submission-detail-modal")
    ?.addEventListener("click", (event) => {
      if (event.target.id === "submission-detail-modal") {
        closeDetailPeminjaman();
      }
    });

  // Tutup menggunakan tombol Escape.
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeDetailPeminjaman();
    }
  });

  function toggleSubmissionSelection(groupId, submissionId) {
    const group = dataKonflikKepalaLab.find((item) => item.id === groupId);

    if (!group || group.status !== "menunggu_keputusan") {
      return;
    }

    const pengajuan = group.pengajuan.find((item) => item.id === submissionId);

    if (!pengajuan) {
      console.error("Pengajuan tidak ditemukan.");
      return;
    }

    const selectedIds = new Set(getSelectedSubmissionIds(groupId));

    // Jika sudah dipilih, batalkan pilihan.
    if (selectedIds.has(submissionId)) {
      selectedIds.delete(submissionId);
    } else {
      // Ambil seluruh pengajuan yang sudah dipilih.
      const selectedData = group.pengajuan.filter((item) =>
        selectedIds.has(item.id),
      );

      // Pastikan tidak berbenturan dengan pilihan sebelumnya.
      const bentrok = selectedData.find((item) =>
        jadwalBeririsan(item, pengajuan),
      );

      if (bentrok) {
        alert(
          `Jadwal pengajuan ini berbenturan dengan ` +
            `${bentrok.pemohon} (${bentrok.mulai}–${bentrok.selesai}).`,
        );

        return;
      }

      selectedIds.add(submissionId);
    }

    if (selectedIds.size > 0) {
      selectedSubmissions.set(groupId, selectedIds);
    } else {
      selectedSubmissions.delete(groupId);
    }

    renderKonflik();
  }

  // =====================================
  // 3. MEMBUAT BARIS PENGAJUAN
  // =====================================

  function createSubmissionRow(pengajuan, groupId) {
    const row = document.createElement("tr");

    row.dataset.submissionId = pengajuan.id ?? "";

    const columns = [
      pengajuan.pemohon ?? pengajuan.nama ?? "-",
      pengajuan.kegiatan ?? "-",
      `${pengajuan.mulai ?? "-"} – ${pengajuan.selesai ?? "-"} WIT`,
    ];

    columns.forEach((value) => {
      row.appendChild(makeElement("td", "", value));
    });

    const actionCell = document.createElement("td");

    const selectedIds = getSelectedSubmissionIds(groupId);
    const isSelected = selectedIds.has(pengajuan.id);

    const button = makeElement(
      "button",
      "btn-select-conflict",
      isSelected ? "Terpilih" : "Pilih Jadwal",
    );

    button.type = "button";

    if (isSelected) {
      button.classList.add("selected");
    }

    button.addEventListener("click", () => {
      toggleSubmissionSelection(groupId, pengajuan.id);
    });

    actionCell.appendChild(button);
    row.appendChild(actionCell);

    row.classList.add("clickable-submission-row");
    row.tabIndex = 0;

    row.addEventListener("click", (event) => {
      if (event.target.closest("button")) return;

      openDetailPeminjaman(pengajuan);
    });

    row.addEventListener("keydown", (event) => {
      if (event.target !== row) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openDetailPeminjaman(pengajuan);
      }
    });

    return row;
  }

  function updateToggleAllButton(konflik) {
    if (!toggleAllButton) return;

    const pending = konflik.filter(
      (item) => item.status === "menunggu_keputusan",
    );

    const allExpanded =
      pending.length > 0 &&
      pending.every((item) => expandedConflicts.has(item.id));

    const label = toggleAllButton.querySelector("span");
    const icon = toggleAllButton.querySelector("i");

    if (label) {
      label.textContent = allExpanded ? "Tutup Semua" : "Buka Semua";
    }

    if (icon) {
      icon.className = allExpanded
        ? "bi bi-arrows-collapse"
        : "bi bi-arrows-expand";
    }

    toggleAllButton.disabled = pending.length === 0;
  }

  function toggleConflict(groupId) {
    if (expandedConflicts.has(groupId)) {
      expandedConflicts.delete(groupId);
    } else {
      expandedConflicts.add(groupId);
    }

    renderKonflik();
  }

  // =====================================
  // PAGINATION PER KELOMPOK KONFLIK
  // =====================================

  function getConflictPage(groupId, totalItems) {
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

    const savedPage = conflictPages.get(groupId) ?? 1;

    const currentPage = Math.min(Math.max(1, savedPage), totalPages);

    conflictPages.set(groupId, currentPage);

    return {
      currentPage,
      totalPages,
    };
  }

  function changeConflictPage(groupId, page, totalItems) {
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

    if (!Number.isInteger(page) || page < 1 || page > totalPages) {
      return;
    }

    conflictPages.set(groupId, page);

    // Memperbarui tampilan seluruh konflik.
    // State accordion tetap dipertahankan.
    renderKonflik();
  }

  function createConflictPagination(groupId, totalItems) {
    const { currentPage, totalPages } = getConflictPage(groupId, totalItems);

    const footer = makeElement("div", "conflict-pagination");

    const start = totalItems === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;

    const end = Math.min(currentPage * ITEMS_PER_PAGE, totalItems);

    const info = makeElement("span", "conflict-pagination-info");

    footer.appendChild(info);

    // Tidak perlu tombol jika hanya satu halaman.
    if (totalPages <= 1) {
      return footer;
    }

    const buttons = makeElement("div", "conflict-pagination-buttons");

    function makePageButton(label, page, disabled, active = false) {
      const button = makeElement("button", "conflict-page-btn", label);

      button.type = "button";
      button.disabled = disabled;

      if (active) {
        button.classList.add("active");
        button.setAttribute("aria-current", "page");
      }

      button.addEventListener("click", () => {
        changeConflictPage(groupId, page, totalItems);
      });

      return button;
    }

    // Tombol sebelumnya.
    buttons.appendChild(
      makePageButton("‹", currentPage - 1, currentPage === 1),
    );

    // Nomor halaman.
    for (let page = 1; page <= totalPages; page++) {
      buttons.appendChild(
        makePageButton(String(page), page, false, page === currentPage),
      );
    }

    // Tombol berikutnya.
    buttons.appendChild(
      makePageButton("›", currentPage + 1, currentPage === totalPages),
    );

    footer.appendChild(buttons);

    return footer;
  }

  // =====================================
  // 4. MEMBUAT KARTU SETIAP SESI
  // =====================================

  function createConflictCard(group, index) {
    const pengajuan = Array.isArray(group.pengajuan) ? group.pengajuan : [];
    const { currentPage } = getConflictPage(group.id, pengajuan.length);

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

    const displayedSubmissions = pengajuan.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE,
    );

    const isExpanded = expandedConflicts.has(group.id);

    const card = makeElement("article", "dynamic-conflict-card");

    card.dataset.conflictId = group.id;

    // HEADER ACCORDION
    const headerButton = makeElement("button", "conflict-accordion-trigger");

    headerButton.type = "button";
    headerButton.setAttribute("aria-expanded", String(isExpanded));

    const headerInfo = makeElement("div", "dynamic-conflict-header-info");

    headerInfo.append(
      makeElement("span", "dynamic-conflict-label"),
      makeElement(
        "h3",
        "dynamic-conflict-time",
        getGroupTime(pengajuan) + " WIT",
      ),
    );

    const headerActions = makeElement("div", "conflict-accordion-actions");

    const status = makeElement(
      "span",
      "dynamic-conflict-status",
      group.status === "selesai" ? "Selesai" : "Menunggu Keputusan",
    );

    if (group.status === "selesai") {
      status.classList.add("resolved");
    }

    const icon = makeElement(
      "i",
      isExpanded ? "bi bi-chevron-up" : "bi bi-chevron-down",
    );

    icon.setAttribute("aria-hidden", "true");

    headerActions.append(status, icon);
    headerButton.append(headerInfo, headerActions);

    headerButton.addEventListener("click", () => {
      toggleConflict(group.id);
    });

    card.appendChild(headerButton);

    // KONTEN ACCORDION
    const content = makeElement("div", "conflict-accordion-content");

    content.hidden = !isExpanded;

    const description = makeElement(
      "div",
      "dynamic-conflict-description",
      `${pengajuan.length} pengajuan dalam kelompok ${index + 1}`,
    );

    const tableWrapper = makeElement("div", "dynamic-conflict-table-wrapper");

    const table = makeElement("table", "dynamic-conflict-table");

    const thead = document.createElement("thead");
    const headingRow = document.createElement("tr");
    ["Pemohon", "Kegiatan", "Waktu Penggunaan", "Aksi"].forEach((label) => {
      headingRow.appendChild(makeElement("th", "", label));
    });

    thead.appendChild(headingRow);

    const tbody = document.createElement("tbody");
    const isResolved = group.status === "selesai";

    displayedSubmissions.forEach((item) => {
      tbody.appendChild(createSubmissionRow(item, group.id));
    });

    table.append(thead, tbody);
    tableWrapper.appendChild(table);

    const footer = createConflictPagination(group.id, pengajuan.length);

    // AREA KEPUTUSAN KEPALA LABORATORIUM
    const decisionArea = makeElement("div", "conflict-decision-area");

    const selectedIds = getSelectedSubmissionIds(group.id);
    const selectedCount = selectedIds.size;

    const selectedInfo = makeElement(
      "span",
      "conflict-selection-info",
      selectedCount > 0
        ? `${selectedCount} pengajuan telah dipilih`
        : "Belum ada pengajuan yang dipilih",
    );

    const decisionButton = makeElement(
      "button",
      "conflict-decision-button",
      "Tetapkan Keputusan",
    );

    decisionButton.type = "button";

    decisionButton.disabled =
      selectedCount === 0 || group.status !== "menunggu_keputusan";

    decisionButton.addEventListener("click", () => {
      const selectedData = pengajuan.filter((item) => selectedIds.has(item.id));

      if (selectedData.length === 0) {
        return;
      }

      openDecisionModal(group, selectedData);
    });

    decisionArea.append(selectedInfo, decisionButton);

    content.append(description, tableWrapper, footer, decisionArea);

    card.appendChild(content);

    return card;
  }

  // =====================================
  // 5. RENDER SELURUH KONFLIK
  // =====================================

  async function renderKonflik() {
    let konflik;

    try {
      konflik = await ambilDataKonflikKepalaLab();
    } catch (error) {
      console.error("Gagal memuat konflik:", error);

      conflictList.replaceChildren();

      const empty = makeElement("div", "dynamic-conflict-empty");

      empty.append(
        makeElement("h3", "", "Gagal Memuat Data Konflik"),
        makeElement(
          "p",
          "",
          "Periksa koneksi database dan API, kemudian muat ulang halaman.",
        ),
      );

      conflictList.appendChild(empty);
      renderSummary([]);

      return;
    }

    renderSummary(konflik);

    const konflikAktif = konflik.filter(
      (item) => item.status === "menunggu_keputusan",
    );

    // Pada render pertama, buka seluruh konflik aktif.
    if (!accordionInitialized) {
      konflikAktif.forEach((item) => {
        expandedConflicts.add(item.id);
      });

      accordionInitialized = true;
    }

    // Bersihkan state kelompok yang sudah tidak aktif.
    const validIds = new Set(konflikAktif.map((item) => item.id));

    for (const id of expandedConflicts) {
      if (!validIds.has(id)) {
        expandedConflicts.delete(id);
      }
    }

    for (const id of selectedSubmissions.keys()) {
      if (!validIds.has(id)) {
        selectedSubmissions.delete(id);
      }
    }

    updateToggleAllButton(konflikAktif);

    conflictList.replaceChildren();

    if (konflikAktif.length === 0) {
      const empty = makeElement("div", "dynamic-conflict-empty");

      empty.append(
        makeElement("h3", "", "Tidak Ada Konflik yang Menunggu"),
        makeElement(
          "p",
          "",
          "Seluruh kelompok konflik telah diputuskan atau belum ada konflik baru.",
        ),
      );

      conflictList.appendChild(empty);
      return;
    }

    konflikAktif.forEach((group, index) => {
      conflictList.appendChild(createConflictCard(group, index));
    });
  }

  // =====================================
  // 6. SINKRONISASI DENGAN DATA CONSOLE
  // =====================================

  // Sinkronisasi jika ada perubahan konflik dari modul lain.
  window.addEventListener("silab:conflicts-berubah", () => {
    renderKonflik();
  });

  if (toggleAllButton) {
    toggleAllButton.addEventListener("click", () => {
      const konflik = dataKonflikKepalaLab.filter(
        (item) => item.status === "menunggu_keputusan",
      );

      const allExpanded =
        konflik.length > 0 &&
        konflik.every((item) => expandedConflicts.has(item.id));

      if (allExpanded) {
        konflik.forEach((item) => {
          expandedConflicts.delete(item.id);
        });
      } else {
        konflik.forEach((item) => {
          expandedConflicts.add(item.id);
        });
      }

      renderKonflik();
    });
  }

  renderKonflik();
})();
