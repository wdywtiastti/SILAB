/* =========================================
   SILAB - DASHBOARD KEPALA LAB
   DATA DUMMY TERINTEGRASI
   TANPA LOCALSTORAGE
========================================= */

(() => {
  "use strict";

  // =====================================
  // 1. DATA DUMMY
  // =====================================

  const dashboardData = {
    // =====================================
    // JADWAL SUDAH MENDAPATKAN PERSETUJUAN
    // =====================================

    jadwal: [],

    // =====================================
    // PENGAJUAN MENUNGGU VERIFIKASI
    // =====================================

    menungguVerifikasi: [],

    // =====================================
    // KELOMPOK KONFLIK JADWAL
    // =====================================

    konflik: [],

    // =====================================
    // KAPASITAS FASILITAS
    // =====================================

    fasilitas: {
      totalPC: 36,
      totalKursi: 36,
    },
  };

  // =====================================
  // 2. PERHITUNGAN STATISTIK
  // =====================================

  function hitungStatistik() {
    const totalKonflik = dashboardData.konflik.reduce(
      (total, group) => total + group.pengajuan.length,
      0,
    );

    return {
      totalPengajuan:
        dashboardData.jadwal.length +
        dashboardData.menungguVerifikasi.length +
        totalKonflik,

      disetujui: dashboardData.jadwal.length,

      menungguVerifikasi: dashboardData.menungguVerifikasi.length,

      konflik: dashboardData.konflik.length,

      pengajuanTerdampak: totalKonflik,
    };
  }

  // =====================================
  // 3. FORMAT ANGKA DAN WAKTU
  // =====================================

  function formatAngka(nilai) {
    return new Intl.NumberFormat("id-ID").format(nilai);
  }

  function formatWaktu(waktu) {
    return waktu.replace(":", ".");
  }

  // =====================================
  // 4. DESKRIPSI KARTU
  // =====================================

  function setDeskripsi(card, text) {
    const description = card.querySelector(".card-description");

    if (!description) return;

    let textElement = description.querySelector(".dashboard-description-text");

    if (!textElement) {
      [...description.childNodes].forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          node.remove();
        }
      });

      textElement = document.createElement("span");
      textElement.className = "dashboard-description-text";

      description.appendChild(textElement);
    }

    textElement.textContent = text;
  }

  // =====================================
  // 5. RENDER KARTU JADWAL
  // =====================================

  function renderRingkasanJadwal() {
    const card = document.querySelector(".schedule-card");

    if (!card) return;

    const value = card.querySelector(".card-value strong");

    const time = card.querySelector(".card-value span");

    const jadwal = dashboardData.jadwal;

    if (value) {
      value.textContent = `${jadwal.length} Sesi`;
    }

    if (time && jadwal.length > 0) {
      const sorted = [...jadwal].sort((a, b) => a.mulai.localeCompare(b.mulai));

      time.textContent = `${formatWaktu(sorted[0].mulai)} – ${formatWaktu(sorted[sorted.length - 1].selesai)} WIT`;
    }

    const berlangsung = jadwal.filter(
      (item) => item.status === "berlangsung",
    ).length;

    setDeskripsi(card, `${berlangsung} sesi sedang berlangsung di Lab RPL`);
  }

  // =====================================
  // 6. RENDER KARTU PEMINJAMAN
  // =====================================

  function renderRingkasanPeminjaman() {
    const card = document.querySelector(".booking-card");

    if (!card) return;

    const stats = hitungStatistik();

    const value = card.querySelector(".card-value strong");

    const unit = card.querySelector(".card-value span");

    if (value) {
      value.textContent = formatAngka(stats.totalPengajuan);
    }

    if (unit) {
      unit.textContent = "Pengajuan";
    }

    setDeskripsi(
      card,
      `${formatAngka(stats.disetujui)} pengajuan sudah terjadwal`,
    );
  }

  // =====================================
  // 7. RENDER KARTU EVALUASI BENTROKAN
  // =====================================

  function renderRingkasanKonflik() {
    const card = document.querySelector(".conflict-card");

    if (!card) return;

    const stats = hitungStatistik();

    const value = card.querySelector(".card-value strong");

    const unit = card.querySelector(".card-value span");

    if (value) {
      value.textContent = `${stats.konflik} Kasus`;
    }

    if (unit) {
      unit.textContent = "Perlu Otorisasi";
    }

    setDeskripsi(
      card,
      `${stats.pengajuanTerdampak} pengajuan terlibat konflik`,
    );
  }

  // =====================================
  // 8. PAGINATION JADWAL
  // =====================================

  const ITEMS_PER_PAGE = 5;

  let currentPage = 1;

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (text !== undefined) {
      element.textContent = text;
    }

    return element;
  }

  // =====================================
  // 9. RENDER BARIS TABEL
  // =====================================

  function renderBarisJadwal(item) {
    const row = document.createElement("tr");

    const waktuCell = document.createElement("td");

    waktuCell.append(
      createElement(
        "strong",
        "",
        `${formatWaktu(item.mulai)} – ${formatWaktu(item.selesai)}`,
      ),
      createElement(
        "small",
        "",
        item.status === "berlangsung" ? "Sesi Berlangsung" : "Sesi Terjadwal",
      ),
    );

    const kegiatanCell = document.createElement("td");

    kegiatanCell.append(
      createElement("strong", "", item.kegiatan),
      createElement("small", "", item.pemohon),
    );

    const fasilitasCell = document.createElement("td");

    fasilitasCell.append(
      createElement("strong", "", item.kategori),
      createElement(
        "small",
        "",
        `Kebutuhan PC : ${item.pc > 0 ? item.pc : "-"}`,
      ),
      createElement(
        "small",
        "",
        `Kebutuhan Kursi : ${item.kursi > 0 ? item.kursi : "-"}`,
      ),
    );

    const statusCell = document.createElement("td");

    statusCell.appendChild(
      createElement(
        "span",
        item.status === "berlangsung" ? "status-active" : "status-confirmed",
        item.status === "berlangsung" ? "Aktif" : "Terjadwal",
      ),
    );

    row.append(waktuCell, kegiatanCell, fasilitasCell, statusCell);

    return row;
  }

  // =====================================
  // 10. RENDER PAGINATION
  // =====================================

  function renderPagination(totalData) {
    const container = document.querySelector(".schedule-pagination");

    if (!container) return;

    container.replaceChildren();

    const totalPages = Math.ceil(totalData / ITEMS_PER_PAGE);

    const start = totalData === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;

    const end = Math.min(currentPage * ITEMS_PER_PAGE, totalData);

    const info = createElement("div", "pagination-info");

    info.append(
      document.createTextNode("Menampilkan "),
      createElement("strong", "", `${start}–${end}`),
      document.createTextNode(" dari "),
      createElement("strong", "", totalData),
      document.createTextNode(" jadwal"),
    );

    const controls = createElement("div", "pagination-controls");

    function createButton(label, page, disabled, className) {
      const button = createElement("button", className, label);

      button.type = "button";
      button.disabled = disabled;

      button.addEventListener("click", () => {
        currentPage = page;
        renderTabelJadwal();
      });

      return button;
    }

    controls.appendChild(
      createButton(
        "Sebelumnya",
        currentPage - 1,
        currentPage <= 1,
        "pagination-button pagination-prev",
      ),
    );

    for (let page = 1; page <= totalPages; page++) {
      const button = createButton(String(page), page, false, "page-number");

      if (page === currentPage) {
        button.classList.add("active");
        button.setAttribute("aria-current", "page");
      }

      controls.appendChild(button);
    }

    controls.appendChild(
      createButton(
        "Berikutnya",
        currentPage + 1,
        currentPage >= totalPages,
        "pagination-button pagination-next",
      ),
    );

    container.append(info, controls);
  }

  // =====================================
  // 11. RENDER TABEL JADWAL
  // HANYA STATUS TERJADWAL / BERLANGSUNG
  // =====================================

  function renderTabelJadwal() {
    const tbody = document.querySelector(".schedule-table tbody");

    if (!tbody) return;

    const jadwalTampil = dashboardData.jadwal
      .filter((item) => ["terjadwal", "berlangsung"].includes(item.status))
      .sort((a, b) => a.mulai.localeCompare(b.mulai));

    const totalPages = Math.ceil(jadwalTampil.length / ITEMS_PER_PAGE);

    currentPage = Math.min(Math.max(currentPage, 1), Math.max(totalPages, 1));

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;

    const displayed = jadwalTampil.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE,
    );

    tbody.replaceChildren();

    if (displayed.length === 0) {
      const row = document.createElement("tr");
      const cell = createElement(
        "td",
        "",
        "Belum ada jadwal yang terkonfirmasi.",
      );

      cell.colSpan = 4;
      row.appendChild(cell);
      tbody.appendChild(row);
    } else {
      displayed.forEach((item) => {
        tbody.appendChild(renderBarisJadwal(item));
      });
    }

    renderPagination(jadwalTampil.length);
  }

  // =====================================
  // 12. RENDER SELURUH DASHBOARD
  // =====================================

  function renderDashboard() {
    renderRingkasanJadwal();
    renderRingkasanPeminjaman();
    renderRingkasanKonflik();
    renderTabelJadwal();

    console.log("Dashboard SILAB berhasil diperbarui.");
  }
  // =====================================
  // 14. AKSES DATA SIMULASI
  // =====================================

  window.SILABDashboardDemo = {
    // Melihat seluruh data dashboard
    lihat: () => ({
      statistik: hitungStatistik(),
      jadwal: structuredClone(dashboardData.jadwal),
      menungguVerifikasi: structuredClone(dashboardData.menungguVerifikasi),
      konflik: structuredClone(dashboardData.konflik),
      fasilitas: structuredClone(dashboardData.fasilitas),
    }),

    // Menambahkan data melalui Console
    tambah: function (data) {
      if (!data || typeof data !== "object") {
        console.error("Format data tidak valid.");
        return false;
      }

      const kelompok = ["jadwal", "menungguVerifikasi", "konflik"];

      for (const key of kelompok) {
        if (data[key] !== undefined && !Array.isArray(data[key])) {
          console.error(`Format ${key} harus berupa array.`);
          return false;
        }
      }

      for (const key of kelompok) {
        if (data[key]) {
          dashboardData[key].push(...structuredClone(data[key]));
        }
      }

      renderDashboard();

      console.log("Data dummy dashboard berhasil ditambahkan.");

      return true;
    },

    // Menghapus seluruh data sementara
    hapusSemua: function () {
      dashboardData.jadwal.length = 0;
      dashboardData.menungguVerifikasi.length = 0;
      dashboardData.konflik.length = 0;

      renderDashboard();

      console.log("Seluruh data dummy dashboard berhasil dikosongkan.");
    },
  };
})();
