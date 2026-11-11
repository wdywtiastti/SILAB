/* =========================================
   SILAB - SIMULASI KONFLIK JADWAL
   DATA SEMENTARA (TANPA STORAGE)
========================================= */

window.SILABKonflikDemo = (() => {
  "use strict";

  const konflik = [];

  // =====================================
  // 1. TAMBAH DATA KONFLIK
  // =====================================

  function tambah(data) {
    if (!data || typeof data !== "object" || !Array.isArray(data.pengajuan)) {
      console.error("Format data konflik tidak valid.");
      return false;
    }

    if (konflik.some((item) => item.id === data.id)) {
      console.error("ID konflik sudah digunakan.");
      return false;
    }

    konflik.push(structuredClone(data));

    window.dispatchEvent(new CustomEvent("silab:konflik-demo-berubah"));

    console.log("Konflik sementara berhasil ditambahkan.");

    return true;
  }

  // =====================================
  // 2. LIHAT DATA KONFLIK
  // =====================================

  function lihat() {
    return structuredClone(konflik);
  }

  // =====================================
  // 3. HAPUS SELURUH DATA SEMENTARA
  // =====================================

  function hapusSemua() {
    konflik.length = 0;

    window.dispatchEvent(new CustomEvent("silab:konflik-demo-berubah"));

    console.log("Data simulasi konflik dikosongkan.");
  }

  // =====================================
  // 4. KEPUTUSAN KEPALA LABORATORIUM
  // =====================================

  function putuskan(id, selectedId) {
    const group = konflik.find((item) => item.id === id);

    if (!group) {
      return {
        berhasil: false,
        pesan: "Sesi konflik tidak ditemukan.",
      };
    }

    if (group.status === "selesai") {
      return {
        berhasil: false,
        pesan: "Sesi konflik sudah diputuskan.",
      };
    }

    if (!selectedId) {
      return {
        berhasil: false,
        pesan: "Pilih satu pengajuan terlebih dahulu.",
      };
    }

    const selected = group.pengajuan.find((item) => item.id === selectedId);

    if (!selected) {
      return {
        berhasil: false,
        pesan: "Pengajuan yang dipilih tidak ditemukan.",
      };
    }

    // Satu pengajuan dipertahankan.
    // Sisanya langsung menjadi tergeser.
    group.pengajuan.forEach((item) => {
      item.status = item.id === selectedId ? "disetujui" : "tergeser";
    });

    group.status = "selesai";
    group.pengajuanTerpilih = selectedId;

    window.dispatchEvent(new CustomEvent("silab:konflik-demo-berubah"));

    return {
      berhasil: true,
      pesan: "Keputusan berhasil ditetapkan.",
    };
  }

  // =====================================
  // 4. KEMBALIKAN FUNGSI PUBLIK
  // =====================================

  return {
    tambah,
    lihat,
    hapusSemua,
    putuskan,
  };
})();

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
   SILAB - RENDER SESI KONFLIK DINAMIS
========================================= */

(() => {
  "use strict";

  const conflictList = document.getElementById("conflict-list");
  const toggleAllButton = document.getElementById("toggle-all-conflicts");

  const expandedConflicts = new Set();

  // Menyimpan satu pengajuan terpilih untuk setiap sesi.
  const selectedSubmissions = new Map();
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

    pendingConflictDecision = {
      groupId: group.id,
      selectedId: selectedData.id,
    };

    const fields = {
      "decision-selected-name":
        selectedData.pemohon ?? selectedData.nama ?? "-",

      "decision-selected-activity": selectedData.kegiatan ?? "-",

      "decision-selected-time": `${selectedData.mulai ?? "-"} – ${selectedData.selesai ?? "-"} WIT`,

      "decision-approved-count": 1,

      "decision-shifted-count": group.pengajuan.length - 1,
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

  function confirmConflictDecision() {
    if (!pendingConflictDecision) return;

    const { groupId, selectedId } = pendingConflictDecision;

    const button = document.getElementById("confirm-decision");

    if (button) {
      button.disabled = true;
    }

    const result = SILABKonflikDemo.putuskan(groupId, selectedId);

    if (!result.berhasil) {
      if (button) button.disabled = false;

      closeDecisionModal();

      console.error(result.pesan);
      return;
    }

    selectedSubmissions.delete(groupId);

    closeDecisionModal();

    console.log(result.pesan);

    // renderKonflik dipanggil melalui event
    // silab:konflik-demo-berubah.
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
    const waiting = konflik.filter(
      (item) => item.status === "menunggu_keputusan",
    ).length;

    const resolved = konflik.filter((item) => item.status === "selesai").length;

    const totalSubmissions = konflik.reduce((jumlah, item) => {
      return (
        jumlah + (Array.isArray(item.pengajuan) ? item.pengajuan.length : 0)
      );
    }, 0);

    const values = {
      "total-conflict-groups": konflik.length,
      "waiting-conflict-count": waiting,
      "resolved-conflict-count": resolved,
      "pending-conflict-count": waiting,
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

  function openDetailPeminjaman(data) {
    const modal = document.getElementById("submission-detail-modal");

    if (!modal) {
      console.error("Popup detail peminjaman tidak ditemukan.");
      return;
    }

    const fields = {
      "detail-peminjam": data.pemohon ?? data.nama ?? "-",
      "detail-kegiatan": data.kegiatan ?? "-",
      "detail-waktu": `${data.mulai ?? "-"} – ${data.selesai ?? "-"} WIT`,
      "detail-pc": data.pc ?? data.jumlahPC ?? "-",
      "detail-kursi": data.kursi ?? data.jumlahKursi ?? "-",
      "detail-skor": data.skorSementara ?? "Belum dihitung",
    };

    Object.entries(fields).forEach(([id, value]) => {
      const element = document.getElementById(id);

      if (element) {
        element.textContent = value;
      }
    });

    modal.hidden = false;
    modal.classList.add("show");

    document.body.style.overflow = "hidden";

    const closeButton = document.getElementById("close-submission-detail");

    if (closeButton) {
      closeButton.focus();
    }
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
    const konflik = SILABKonflikDemo.lihat().filter(
      (item) => item.status !== "selesai",
    );

    const group = konflik.find((item) => item.id === groupId);

    if (!group || group.status === "selesai") {
      return;
    }

    const pengajuan = group.pengajuan.find((item) => item.id === submissionId);

    if (!pengajuan) {
      console.error("Pengajuan tidak ditemukan.");
      return;
    }

    const selectedId = selectedSubmissions.get(groupId);

    // Jika tombol yang sama diklik, batalkan pilihan.
    if (selectedId === submissionId) {
      selectedSubmissions.delete(groupId);
    } else {
      // Pilihan sebelumnya otomatis digantikan.
      selectedSubmissions.set(groupId, submissionId);
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

    const selectedId = selectedSubmissions.get(groupId);
    const isSelected = selectedId === pengajuan.id;

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
      const current = selectedSubmissions.get(groupId);

      if (current === pengajuan.id) {
        selectedSubmissions.delete(groupId);
      } else {
        selectedSubmissions.set(groupId, pengajuan.id);
      }

      renderKonflik();
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

  function updateToggleAllButton(totalGroups) {
    if (!toggleAllButton) return;

    const allExpanded =
      totalGroups > 0 && expandedConflicts.size === totalGroups;

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

    toggleAllButton.disabled = totalGroups === 0;
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

    const info = makeElement(
      "span",
      "conflict-pagination-info",
      `Menampilkan ${start}–${end} dari ${totalItems} pengajuan`,
    );

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
      makeElement("p", "dynamic-conflict-location", group.laboratorium ?? "-"),
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
      `${pengajuan.length} pengajuan dalam kelompok ${group.id}`,
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

    const selectedId = selectedSubmissions.get(group.id);

    const selectedInfo = makeElement(
      "span",
      "conflict-selection-info",
      selectedId
        ? "1 pengajuan telah dipilih"
        : "Belum ada pengajuan yang dipilih",
    );

    const decisionButton = makeElement(
      "button",
      "conflict-decision-button",
      "Tetapkan Keputusan",
    );

    decisionButton.type = "button";
    decisionButton.disabled = !selectedId;

    decisionButton.addEventListener("click", () => {
      const selected = selectedSubmissions.get(group.id);

      if (!selected) {
        return;
      }

      const selectedData = pengajuan.find((item) => item.id === selected);

      if (!selectedData) {
        console.error("Pengajuan tidak ditemukan.");
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

  function renderKonflik() {
    if (!window.SILABKonflikDemo) {
      console.error("SILABKonflikDemo belum tersedia.");
      return;
    }

    const konflik = SILABKonflikDemo.lihat().filter(
      (item) => item.status !== "selesai",
    );

    renderSummary(konflik);

    // Pada render pertama, buka seluruh sesi.
    if (!accordionInitialized) {
      konflik.forEach((item) => {
        expandedConflicts.add(item.id);
      });

      accordionInitialized = true;
    }

    // Hapus ID yang sudah tidak ada.
    const validIds = new Set(konflik.map((item) => item.id));

    for (const id of expandedConflicts) {
      if (!validIds.has(id)) {
        expandedConflicts.delete(id);
      }
    }

    updateToggleAllButton(konflik.length);

    conflictList.replaceChildren();

    if (konflik.length === 0) {
      const empty = makeElement("div", "dynamic-conflict-empty");

      empty.append(
        makeElement("h3", "", "Tidak Ada Konflik yang Menunggu"),
        makeElement(
          "p",
          "",
          "Seluruh sesi konflik telah diputuskan atau belum ada pengajuan bentrok dari Laboran.",
        ),
      );

      conflictList.appendChild(empty);
      return;
    }

    konflik.forEach((group, index) => {
      conflictList.appendChild(createConflictCard(group, index));
    });
  }

  // =====================================
  // 6. SINKRONISASI DENGAN DATA CONSOLE
  // =====================================

  window.addEventListener("silab:konflik-demo-berubah", renderKonflik);

  if (toggleAllButton) {
    toggleAllButton.addEventListener("click", () => {
      // Ambil hanya sesi yang belum diputuskan.
      const konflik = SILABKonflikDemo.lihat().filter(
        (item) => item.status !== "selesai",
      );

      renderSummary(konflik);

      const allExpanded =
        konflik.length > 0 &&
        konflik.every((item) => expandedConflicts.has(item.id));

      if (allExpanded) {
        expandedConflicts.clear();
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
