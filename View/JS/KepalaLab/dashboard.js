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
  // STATISTIK DARI DATABASE MYSQL
  // =====================================

  const statistikDatabase = {
    jadwal: {
      totalSesi: 0,
      sesiBerlangsung: 0,
      jadwalMulai: null,
      jadwalSelesai: null,
    },

    peminjaman: {
      totalPengajuan: 0,
      disetujui: 0,
    },

    konflik: {
      totalKonflik: 0,
      menungguKeputusan: 0,
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

    const jadwal = statistikDatabase.jadwal;

    if (value) {
      value.textContent = `${jadwal.totalSesi} Sesi`;
    }

    if (time) {
      if (jadwal.jadwalMulai && jadwal.jadwalSelesai) {
        const mulai = jadwal.jadwalMulai.substring(11, 16);
        const selesai = jadwal.jadwalSelesai.substring(11, 16);

        time.textContent = `${formatWaktu(mulai)} – ${formatWaktu(selesai)} WIT`;
      } else {
        time.textContent = "Belum ada jadwal";
      }
    }

    setDeskripsi(
      card,
      `${jadwal.sesiBerlangsung} sesi sedang berlangsung di Lab RPL`,
    );
  }

  // =====================================
  // 7. RENDER KARTU EVALUASI BENTROKAN
  // =====================================

  function renderRingkasanKonflik() {
    const card = document.querySelector(".conflict-card");

    if (!card) return;

    const data = statistikDatabase.konflik;

    const value = card.querySelector(".card-value strong");
    const unit = card.querySelector(".card-value span");

    if (value) {
      value.textContent = `${formatAngka(data.totalKonflik)} Kasus`;
    }

    if (unit) {
      unit.textContent = "Konflik Aktif";
    }

    setDeskripsi(
      card,
      `${formatAngka(data.menungguKeputusan)} Kasus Menunggu Keputusan`,
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

    const prioritasCell = document.createElement("td");

    prioritasCell.appendChild(
      createElement(
        "span",
        "schedule-priority",
        item.prioritas || "Belum Dihitung",
      ),
    );
    // =====================================
    // KOLOM STATUS
    // =====================================

    const statusCell = document.createElement("td");

    const konfigurasiStatus = {
      terjadwal: {
        label: "Terjadwal",
        kelas: "status-confirmed",
      },
      berlangsung: {
        label: "Sedang Berlangsung",
        kelas: "status-active",
      },
      tidak_digunakan: {
        label: "Tidak Digunakan",
        kelas: "status-unused",
      },
    };

    const statusInfo =
      konfigurasiStatus[item.status] || konfigurasiStatus.terjadwal;

    statusCell.appendChild(
      createElement("span", statusInfo.kelas, statusInfo.label),
    );

    row.append(waktuCell, kegiatanCell, prioritasCell, statusCell);
    label: "Sedang Digunakan";

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
      .filter((item) =>
        ["terjadwal", "berlangsung", "tidak_digunakan"].includes(item.status),
      )
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
  // DATA JADWAL REALTIME DARI DATABASE
  // =====================================

  let sedangMemuatJadwal = false;

  async function ambilJadwalHariIni() {
    const response = await fetch("../Laboran/api/jadwal.php", {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      headers: {
        Accept: "application/json",
      },
    });

    const hasil = await response.json();

    if (!response.ok || !hasil.success) {
      throw new Error(hasil.message || "Gagal mengambil jadwal.");
    }

    if (!Array.isArray(hasil.data)) {
      throw new Error("Format data jadwal tidak valid.");
    }

    return hasil.data.map((item) => {
      const statusAsli = String(item.status || "")
        .toLowerCase()
        .trim();

      let status = "terjadwal";

      if (["digunakan", "berlangsung"].includes(statusAsli)) {
        status = "berlangsung";
      } else if (["tidak_digunakan", "tidak digunakan"].includes(statusAsli)) {
        status = "tidak_digunakan";
      }

      return {
        id: item.id,
        idPengajuan: item.idPengajuan,
        pemohon: item.namaPemohon || "-",
        kegiatan: item.namaKegiatan || "-",
        kategori: item.kategori || "-",
        mulai: item.waktuMulai || "00:00",
        selesai: item.waktuSelesai || "00:00",
        pc: Number(item.pc || 0),
        kursi: Number(item.kursi || 0),
        skorAkhir: item.skorAkhir !== null ? Number(item.skorAkhir) : null,

        prioritas:
          item.prioritas !== null && item.prioritas !== undefined
            ? `P${item.prioritas}`
            : null,
        status: status,
      };
    });
  }

  async function sinkronkanJadwal() {
    if (sedangMemuatJadwal) return;

    sedangMemuatJadwal = true;

    try {
      dashboardData.jadwal = await ambilJadwalHariIni();

      renderDashboard();

      console.log(
        "Jadwal Kepala Lab berhasil diperbarui:",
        dashboardData.jadwal.length,
      );
    } catch (error) {
      console.error("Gagal memperbarui jadwal Kepala Lab:", error);
    } finally {
      sedangMemuatJadwal = false;
    }
  }

  // =====================================
  // STATISTIK REALTIME DARI MYSQL
  // =====================================

  let sedangMemuatStatistik = false;

  async function ambilStatistikDashboard() {
    if (sedangMemuatStatistik) return;

    sedangMemuatStatistik = true;

    try {
      const response = await fetch("api/statistik_dashboard.php", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const hasil = await response.json();

      if (!response.ok || !hasil.success) {
        throw new Error(hasil.message || "Gagal mengambil statistik.");
      }

      statistikDatabase.jadwal = hasil.data.jadwal;
      statistikDatabase.peminjaman = hasil.data.peminjaman;
      statistikDatabase.konflik = hasil.data.konflik;

      renderRingkasanJadwal();
      renderRingkasanKonflik();

      console.log("Statistik Dashboard berhasil diperbarui.", hasil.data);
    } catch (error) {
      console.error("Gagal memperbarui statistik Dashboard:", error);
    } finally {
      sedangMemuatStatistik = false;
    }
  }
  // =====================================
  // 12. RENDER SELURUH DASHBOARD
  // =====================================

  function renderDashboard() {
    renderRingkasanJadwal();
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

  // =====================================
  // 15. INISIALISASI DASHBOARD
  // =====================================

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sinkronkanJadwal);
  } else {
    sinkronkanJadwal();
  }

  window.addEventListener("silab:data-changed", () => {
    sinkronkanJadwal();
  });

  window.addEventListener("storage", (event) => {
    if (!event.key || event.key.includes("booking")) {
      sinkronkanJadwal();
    }
  });

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      sinkronkanJadwal();
    }
  });

  window.setInterval(sinkronkanJadwal, 15000);
  // Statistik database diperbarui setiap 15 detik
  ambilStatistikDashboard();

  window.setInterval(ambilStatistikDashboard, 15000);
})();
