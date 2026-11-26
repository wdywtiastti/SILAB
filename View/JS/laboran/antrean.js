(function (window, document) {
  "use strict";

  // =========================================
  // 1. KONFIGURASI
  // =========================================

  const API_ANTREAN = "api/antrean.php";
  const API_TINDAKAN = "api/tindakan_antrean.php";

  const HALAMAN_REKOMENDASI = "rekomendasi_jadwal.php";

  const BATAS_PRESENSI_MENIT = 15;
  const INTERVAL_REFRESH = 30000;
  const ZONA_WIT = "+09:00";
  const PER_HALAMAN = 6;

  // =========================================
  // 2. REFERENSI HTML
  // =========================================

  const el = {
    tabel: document.getElementById("antrianBody"),
    template: document.getElementById("templateBarisAntrian"),

    total: document.getElementById("totalAntrian"),
    pagination: document.getElementById("paginationInfo"),
    nomorHalaman: document.getElementById("paginationNumbers"),

    sebelumnya: document.getElementById("prevPage"),
    berikutnya: document.getElementById("nextPage"),

    modal: document.getElementById("modalReview"),

    jumlahBelum: document.getElementById("jumlahBelumDisetujui"),
    jumlahSudah: document.getElementById("jumlahSudahDisetujui"),

    filter: document.querySelectorAll("[data-filter-antrean]"),

    notifikasi: document.getElementById("wadahNotifikasi"),
  };

  if (!el.tabel || !el.template || !el.modal) {
    console.error("SILAB: Elemen HTML antrean tidak lengkap.");
    return;
  }

  // =========================================
  // 3. KONFIGURASI STATUS
  // =========================================

  const STATUS = {
    menunggu: {
      label: "Menunggu Verifikasi",
      kelas: "verify",
    },

    verifikasi: {
      label: "Menunggu Verifikasi",
      kelas: "verify",
    },

    menunggu_verifikasi: {
      label: "Menunggu Verifikasi",
      kelas: "verify",
    },

    bentrok: {
      label: "Bentrok",
      kelas: "conflict",
    },

    tergeser: {
      label: "Tergeser",
      kelas: "displaced",
    },

    disetujui: {
      label: "Disetujui",
      kelas: "approved",
    },

    ditolak: {
      label: "Ditolak",
      kelas: "rejected",
    },
  };

  const STATUS_PENDING = [
    "menunggu",
    "verifikasi",
    "menunggu_verifikasi",
    "bentrok",
    "konflik",
  ];

  const STATUS_BOOKING_AKTIF = [
    "terjadwal",
    "disetujui",
    "berlangsung",
    "digunakan",
  ];

  const STATUS_PRESENSI = [
    "hadir",
    "presensi",
    "sudah_presensi",
    "tercatat",
    "digunakan",
    "sedang_berjalan",
    "berlangsung",
    "selesai",
    "checked_in",
    "check_in",
  ];

  // =========================================
  // 4. STATE APLIKASI
  // =========================================

  let daftarAntrean = [];

  let halamanAktif = 1;

  let filterAktif = "belum-disetujui";

  let fokusSebelumnya = null;

  let sedangMemuat = false;

  let sedangMengirim = false;

  // =========================================
  // 5. FUNGSI BANTU
  // =========================================

  function teks(value) {
    return value === null || value === undefined || value === ""
      ? "-"
      : String(value);
  }

  function norm(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "_");
  }

  // =========================================
  // ISI FIELD HTML
  // =========================================

  function isiField(container, nama, value) {
    const target = container.querySelector(`[data-field="${nama}"]`);

    if (target) {
      target.textContent = teks(value);
    }
  }

  // =========================================
  // DETAIL PENGAJUAN DINAMIS
  // =========================================

  function renderDetailDinamis(item) {
    const container = el.modal.querySelector("[data-detail-dinamis]");

    if (!container) return;

    container.replaceChildren();

    function buatKartu(label, value) {
      const card = document.createElement("div");
      card.className = "detail-item";

      const title = document.createElement("small");
      title.textContent = label;

      const content = document.createElement("strong");
      content.textContent = value;

      card.append(title, content);
      container.append(card);
    }

    const aturan = Array.isArray(item.detailAturan) ? item.detailAturan : [];

    aturan.forEach((detail) => {
      buatKartu(detail.kelompok, detail.nama);
    });

    const fasilitas = Array.isArray(item.detailFasilitas)
      ? item.detailFasilitas
      : [];

    fasilitas.forEach((detail) => {
      buatKartu(detail.nama, `Jumlah: ${detail.jumlah}`);
    });

    if (!aturan.length && !fasilitas.length) {
      buatKartu("Detail Tambahan", "Belum ada detail pengajuan.");
    }
  }

  function ambilId(item) {
    return item.idPengajuan ?? item.id;
  }

  function cariItem(id) {
    return (
      daftarAntrean.find((item) => String(ambilId(item)) === String(id)) || null
    );
  }

  function statusItem(item) {
    return norm(item.status || item.statusPengajuan || "menunggu");
  }

  function statusBooking(item) {
    return norm(item.statusBooking);
  }

  function statusPengajuan(item) {
    return norm(item.statusPengajuan);
  }

  function isApproved(item) {
    return (
        !isDisplaced(item) &&
        (
            statusPengajuan(item) === "disetujui" ||
            STATUS_BOOKING_AKTIF.includes(statusBooking(item))
        )
    );
}

  function isPending(item) {
    return !isApproved(item) && STATUS_PENDING.includes(statusItem(item));
  }

  function isDisplaced(item) {
    return (
      statusPengajuan(item) === "tergeser" ||
      statusPengajuan(item) === "displaced" ||
      statusItem(item) === "tergeser" ||
      statusItem(item) === "displaced"
    );
  }

  function isEscalated(item) {
    return (
        item.sedangEskalasi === true ||
        item.sedangEskalasi === 1 ||
        item.sedangEskalasi === "1"
    );
}

  function mengalamiKonflik(item) {
    return (
      Boolean(item.mengalamiKonflik) ||
      statusItem(item) === "bentrok" ||
      norm(item.status) === "konflik"
    );
  }

  // Status eskalasi dibaca dari data API.

  function sudahDieskalasi(item) {
    const status = norm(item.statusEskalasi || item.statusKonflik || "");

    return (
      isEscalated(item) ||
      item.sudahDieskalasi === true ||
      item.sudahDieskalasi === 1 ||
      item.sudahDieskalasi === "1" ||
      [
          "dikirim",
          "terkirim",
          "menunggu_kepala_lab",
          "menunggu_keputusan",
          "diproses",
      ].includes(status)
    );
  }

  // =========================================
  // 6. PEMERIKSAAN PRESENSI
  // =========================================

  function timestampMulai(item) {
    if (!item.tanggal || !item.waktuMulai) {
      return null;
    }

    const waktu =
      String(item.waktuMulai).length === 5
        ? `${item.waktuMulai}:00`
        : item.waktuMulai;

    const value = Date.parse(
      `${String(item.tanggal).split("T")[0]}T${waktu}${ZONA_WIT}`,
    );

    return Number.isFinite(value) ? value : null;
  }

  function sudahPresensi(item) {
    return STATUS_PRESENSI.includes(norm(item.statusPresensi));
  }

  function batasPresensiHabis(item) {
    const mulai = timestampMulai(item);

    return mulai !== null && Date.now() >= mulai + BATAS_PRESENSI_MENIT * 60000;
  }

  function masihMenungguPresensi(item) {
    return !sudahPresensi(item) && !batasPresensiHabis(item);
  }

  // =========================================
  // 7. FORMAT TANGGAL DAN WAKTU
  // =========================================

  function formatTanggal(value) {
    if (!value) return "-";

    const match = String(value)
      .split("T")[0]
      .match(/^(\d{4})-(\d{2})-(\d{2})$/);

    return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value);
  }

  function formatWaktu(item) {
    return (
      `${formatTanggal(item.tanggal)} | ` +
      `${teks(item.waktuMulai)} - ` +
      `${teks(item.waktuSelesai)} WIT`
    );
  }

  // =========================================
  // 8. KOMUNIKASI API
  // =========================================

  async function requestAPI(url, options = {}) {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
    });

    const raw = await response.text();

    let result;

    try {
      result = JSON.parse(raw);
    } catch (error) {
      console.error("Respons API bukan JSON:", raw);

      throw new Error("Respons server bukan JSON. Periksa error PHP pada API.");
    }

    if (!response.ok || result.success === false) {
      throw new Error(
        result.message || `Permintaan gagal (HTTP ${response.status}).`,
      );
    }

    return result;
  }

  async function ambilDataAntrean() {
    const result = await requestAPI(API_ANTREAN, { method: "GET" });

    if (!Array.isArray(result.data)) {
      throw new Error("Format data antrean dari API tidak valid.");
    }

    return result.data;
  }

  async function kirimTindakan(aksi, idPengajuan) {
    const response = await fetch(API_TINDAKAN, {
      method: "POST",

      credentials: "same-origin",

      cache: "no-store",

      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },

      body: JSON.stringify({
        aksi: aksi,
        idPengajuan: Number(idPengajuan),
      }),
    });

    const raw = await response.text();

    let result;

    try {
      result = JSON.parse(raw);
    } catch (error) {
      console.error("Respons API:", raw);

      throw new Error("Respons API bukan JSON.");
    }

    if (!response.ok || result.success === false) {
      throw new Error(result.message || "Permintaan gagal.");
    }

    return result;
  }

  // =========================================
  // 9. PENGURUTAN ANTREAN
  // =========================================

  function urutkan(data) {
    return [...data].sort((a, b) => {
      const pa = Number(
        String(a.prioritas || "").match(/P([1-5])/i)?.[1] || 99,
      );

      const pb = Number(
        String(b.prioritas || "").match(/P([1-5])/i)?.[1] || 99,
      );

      if (pa !== pb) {
        return pa - pb;
      }

      return Number(b.skor || 0) - Number(a.skor || 0);
    });
  }

  // =========================================
  // 10. FILTER ANTREAN
  // =========================================

  function dataFilter() {
    return daftarAntrean.filter((item) => {
      // Pengajuan yang sedang ditangani
      // Kepala Lab tidak ditampilkan di antrean.

      if (isEscalated(item)) {
        return false;
      }

      // Antrean belum disetujui.
      if (filterAktif === "belum-disetujui") {
        return isPending(item);
      }

      // Antrean sudah disetujui.
      if (filterAktif === "sudah-disetujui") {
        return isApproved(item) && masihMenungguPresensi(item);
      }

      return false;
    });
  }

  // =========================================
  // 11. JUMLAH ANTREAN
  // =========================================

  function renderJumlah() {
    const dataAktif = daftarAntrean.filter((item) => !isEscalated(item));

    const pending = dataAktif.filter((item) => isPending(item)).length;

    const approved = dataAktif.filter(
      (item) => isApproved(item) && masihMenungguPresensi(item),
    ).length;

    if (el.jumlahBelum) {
      el.jumlahBelum.textContent = pending;
    }

    if (el.jumlahSudah) {
      el.jumlahSudah.textContent = approved;
    }

    if (el.total) {
      el.total.textContent = `${dataAktif.length} Pengajuan`;
    }
  }

  // =========================================
  // 12. KONFIGURASI BADGE STATUS
  // =========================================

  function konfigurasiStatus(item) {
    const status = statusItem(item);

    if (isApproved(item)) {
      if (mengalamiKonflik(item)) {
        return {
          label: "Disetujui - Ada Konflik",
          kelas: "approved conflict",
        };
      }

      return STATUS.disetujui;
    }

    if (mengalamiKonflik(item)) {
      return STATUS.bentrok;
    }

    return (
      STATUS[status] || {
        label: status,
        kelas: "",
      }
    );
  }

  // =========================================
  // 13. RENDER BARIS ANTREAN
  // =========================================

  function renderBaris(item) {
    const row = el.template.content.firstElementChild.cloneNode(true);

    const config = konfigurasiStatus(item);

    isiField(row, "pemohon", item.namaPemohon);

    isiField(row, "nama-kegiatan", item.namaKegiatan);

    isiField(row, "rentang-waktu", formatWaktu(item));


    isiField(row, "prioritas", item.prioritas || "Belum dihitung");

    isiField(
      row,
      "skor",
      item.skor === null || item.skor === undefined
        ? "Skor belum dihitung"
        : `Skor: ${item.skor}`,
    );

    const badge = row.querySelector('[data-field="status"]');

    if (badge) {
      badge.className = "status-badge";
      badge.textContent = config.label;

      if (config.kelas) {
        config.kelas.split(" ").forEach((kelas) => {
          badge.classList.add(kelas);
        });
      }

      if (item.pesanKonflik) {
        badge.title = item.pesanKonflik;
      }
    }

    const button = row.querySelector("[data-aksi-detail]");

    if (button) {
      button.dataset.id = ambilId(item);

      button.innerHTML = isApproved(item)
        ? '<i class="bi bi-eye"></i> Lihat Detail'
        : '<i class="bi bi-search"></i> Periksa &amp; Proses';
    }

    return row;
  }

  // =========================================
  // 14. PAGINATION
  // =========================================

  function renderPagination(total) {
    const pages = Math.max(1, Math.ceil(total / PER_HALAMAN));

    halamanAktif = Math.min(halamanAktif, pages);

    const start = total ? (halamanAktif - 1) * PER_HALAMAN + 1 : 0;

    const end = Math.min(halamanAktif * PER_HALAMAN, total);

    if (el.pagination) {
      el.pagination.textContent = `Menampilkan ${start}-${end} dari ${total} pengajuan`;
    }

    if (el.sebelumnya) {
      el.sebelumnya.disabled = halamanAktif <= 1;
    }

    if (el.berikutnya) {
      el.berikutnya.disabled = halamanAktif >= pages || total === 0;
    }

    if (el.nomorHalaman) {
      el.nomorHalaman.replaceChildren();

      for (let page = 1; page <= pages; page++) {
        const button = document.createElement("button");

        button.type = "button";
        button.className = "pagination-btn";
        button.textContent = page;

        if (page === halamanAktif) {
          button.classList.add("active");
        }

        button.addEventListener("click", () => {
          halamanAktif = page;
          renderAntrean();
        });

        el.nomorHalaman.append(button);
      }
    }
  }

  // =========================================
  // 15. RENDER TABEL
  // =========================================

  function renderAntrean() {
    const data = dataFilter();

    const start = (halamanAktif - 1) * PER_HALAMAN;

    const pageData = data.slice(start, start + PER_HALAMAN);

    const fragment = document.createDocumentFragment();

    if (!pageData.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 5;
      cell.className = "empty-state";

      cell.textContent =
        filterAktif === "belum-disetujui"
          ? "Belum ada pengajuan yang menunggu verifikasi."
          : "Belum ada booking yang menunggu presensi.";

      row.append(cell);
      fragment.append(row);
    } else {
      pageData.forEach((item) => {
        fragment.append(renderBaris(item));
      });
    }

    el.tabel.replaceChildren(fragment);

    renderPagination(data.length);
  }

  // =========================================
  // 16. NOTIFIKASI
  // =========================================

  function notifikasi(message, type = "success") {
    if (!el.notifikasi) {
      window.alert(message);
      return;
    }

    const box = document.createElement("div");

    box.className = `notifikasi-antrean ${type}`;
    box.setAttribute("role", "status");
    box.textContent = message;

    el.notifikasi.replaceChildren(box);

    window.setTimeout(() => {
      box.remove();
    }, 4000);
  }

  function pesanModal(message) {
    let box = el.modal.querySelector(".aksi-feedback");

    if (!box) {
      box = document.createElement("div");
      box.className = "aksi-feedback";

      el.modal.querySelector(".review-modal-content")?.append(box);
    }

    box.textContent = message;
    box.setAttribute("role", "alert");
  }

  // =========================================
  // 17. PENGATURAN PANEL MODAL
  // =========================================

  function tampilkanPanel(name) {
    el.modal.querySelectorAll("[data-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.panel !== name;
    });
  }

  // =========================================
  // 18. DAFTAR JADWAL KONFLIK
  // =========================================

  function renderDaftarKonflik(item, panel) {
    if (!panel) return;

    panel.querySelector(".daftar-anggota-konflik")?.remove();

    const list = Array.isArray(item.daftarKonflik) ? item.daftarKonflik : [];

    if (!list.length) return;

    const wrap = document.createElement("div");
    wrap.className = "daftar-anggota-konflik";

    const heading = document.createElement("strong");

    heading.textContent = `Jadwal yang beririsan (${list.length})`;

    const ul = document.createElement("ul");

    list.forEach((other) => {
      const li = document.createElement("li");

      const waktu = `${teks(other.waktuMulai)}–${teks(other.waktuSelesai)}`;

      li.textContent =
        `#${other.idPengajuan} · ` +
        `${teks(other.namaKegiatan)} · ` +
        `${teks(other.namaPemohon)} · ` +
        `${waktu} WIT`;

      ul.append(li);
    });

    wrap.append(heading, ul);
    panel.append(wrap);
  }

  // =========================================
  // 19. TOMBOL ESKALASI KEPALA LAB
  // =========================================

  function buatTombolEskalasi(id, sudahDikirim) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "btn-eskalasi";
    if (sudahDikirim) {
      button.disabled = true;

      button.innerHTML =
        '<i class="bi bi-check-circle"></i> ' + "Sudah Dikirim ke Kepala Lab";
    } else {
      button.dataset.eskalasiKonflik = id;

      button.innerHTML =
        '<i class="bi bi-send"></i> ' + "Kirim Konflik ke Kepala Lab";
    }

    return button;
  }

  // =========================================
// TOMBOL TOLAK PENGAJUAN KONFLIK
// =========================================

function buatTombolTolakKonflik(id) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "btn-tolak-konflik";
    button.dataset.tolakKonflik = id;

    button.innerHTML =
        '<i class="bi bi-x-circle"></i> Tolak Pengajuan';

    return button;
}

function tampilkanAksiEskalasi(item) {
    const id = ambilId(item);
    const dikirim = sudahDieskalasi(item);

    // Tombol penolakan hanya untuk pengajuan baru
    // yang masih menunggu verifikasi.
    const bolehDitolak =
        isPending(item) &&
        !isApproved(item) &&
        !dikirim;

    // =====================================
    // PANEL BENTROK BIASA
    // =====================================

    const panelKonflik = el.modal.querySelector(
        '[data-panel="bentrok"]'
    );

    const areaKonflik = panelKonflik?.querySelector(
        '[data-area-aksi-konflik="bentrok"]'
    );

    if (areaKonflik) {
        const tombol = [
            buatTombolEskalasi(id, dikirim)
        ];

        if (bolehDitolak) {
            tombol.push(buatTombolTolakKonflik(id));
        }

        areaKonflik.replaceChildren(...tombol);
    }

    // =====================================
    // PANEL BENTROK BOOKING DISETUJUI
    // =====================================

    const panelApproved = el.modal.querySelector(
        '[data-panel="bentrok-disetujui"]'
    );

    const areaApproved = panelApproved?.querySelector(
        '[data-area-aksi-konflik="bentrok-disetujui"]'
    );

    if (areaApproved) {
        areaApproved.replaceChildren(
            buatTombolEskalasi(id, dikirim)
        );
    }

    // =====================================
    // INFORMASI STATUS ESKALASI
    // =====================================

    let info = panelKonflik?.querySelector(
        ".status-eskalasi-info"
    );

    if (panelKonflik && !info) {
        info = document.createElement("p");
        info.className = "status-eskalasi-info";
        panelKonflik.append(info);
    }

    if (info) {
        info.textContent = dikirim
            ? "Kasus konflik sudah diteruskan kepada Kepala Lab dan menunggu keputusan."
            : "Kasus ini perlu diteruskan kepada Kepala Lab untuk mendapatkan keputusan.";
    }
}

  // =========================================
  // 20. BUKA MODAL DETAIL
  // =========================================

  function bukaModal(id) {
    const item = cariItem(id);

    if (!item) {
      notifikasi("Data pengajuan tidak ditemukan.", "error");
      return;
    }

    const status = statusItem(item);
    const config = konfigurasiStatus(item);

    el.modal.dataset.pengajuanId = ambilId(item);

    el.modal.querySelector(".aksi-feedback")?.remove();

    isiField(el.modal, "label-id", `ID PENGAJUAN #${ambilId(item)}`);
    isiField(el.modal, "judul-kegiatan", item.namaKegiatan);
    isiField(el.modal, "nama-pemohon", item.namaPemohon);
    isiField(el.modal, "identifier", item.identifier);
    isiField(el.modal, "waktu", formatWaktu(item));
    renderDetailDinamis(item);
    isiField(el.modal, "skor-detail", item.skor ?? "Belum dihitung");

    const priority = el.modal.querySelector('[data-field="prioritas-detail"]');

    if (priority) {
      priority.textContent = item.prioritas || "Belum dihitung";
    }

    const statusBadge = el.modal.querySelector('[data-field="status-detail"]');

    if (statusBadge) {
      statusBadge.className = "status-badge";
      statusBadge.textContent = config.label;

      config.kelas.split(" ").forEach((kelas) => {
        statusBadge.classList.add(kelas);
      });
    }

    // =====================================
    // TOMBOL BATALKAN PERSETUJUAN
    // =====================================

    const cancelButton = el.modal.querySelector(
      "[data-aksi-batalkan-persetujuan]",
    );

    if (cancelButton) {
      const canCancel =
        statusPengajuan(item) === "disetujui" &&
        statusBooking(item) === "terjadwal" &&
        !sudahPresensi(item) &&
        !batasPresensiHabis(item);

      cancelButton.hidden = !canCancel;
      cancelButton.disabled = !canCancel;
    }

    // =====================================
    // PEMBERSIHAN PANEL KONFLIK
    // =====================================

    el.modal
      .querySelectorAll(".daftar-anggota-konflik")
      .forEach((node) => node.remove());

    // =====================================
    // PEMILIHAN PANEL
    // =====================================

    if (isApproved(item) && mengalamiKonflik(item)) {
      tampilkanPanel("bentrok-disetujui");

      isiField(
        el.modal,
        "pesan-bentrok-disetujui",
        item.pesanKonflik ||
          "Booking tetap berstatus disetujui, tetapi terdapat pengajuan baru yang beririsan.",
      );

      renderDaftarKonflik(
        item,
        el.modal.querySelector('[data-panel="bentrok-disetujui"]'),
      );

      tampilkanAksiEskalasi(item);
    } else if (status === "bentrok" || mengalamiKonflik(item)) {
      tampilkanPanel("bentrok");

      isiField(
        el.modal,
        "pesan-bentrok",
        item.pesanKonflik ||
          "Jadwal beririsan dengan pengajuan atau booking lain.",
      );

      renderDaftarKonflik(
        item,
        el.modal.querySelector('[data-panel="bentrok"]'),
      );

      tampilkanAksiEskalasi(item);
    } else if (isApproved(item)) {
      tampilkanPanel("disetujui");
    } else if (isDisplaced(item)) {
      tampilkanPanel("tergeser");

      isiField(
        el.modal,
        "pesan-tergeser",
        "Pengajuan ini memerlukan rekomendasi jadwal pengganti.",
      );

      const link = el.modal.querySelector("[data-tautan-rekomendasi]");

      if (link) {
        link.href =
          HALAMAN_REKOMENDASI +
          "?id_pengajuan=" +
          encodeURIComponent(ambilId(item));
      }
    } else if (isPending(item)) {
      tampilkanPanel("verifikasi");
    } else {
      tampilkanPanel("lainnya");
    }

    fokusSebelumnya = document.activeElement;

    el.modal.hidden = false;
    el.modal.setAttribute("aria-hidden", "false");
    el.modal.classList.add("is-open");
    el.modal.style.display = "flex";

    el.modal.querySelector(".review-modal-content")?.focus();
  }

  // =========================================
  // 21. TUTUP MODAL
  // =========================================

  function tutupModal() {
    el.modal.classList.remove("is-open");
    el.modal.hidden = true;

    el.modal.setAttribute("aria-hidden", "true");
    el.modal.style.display = "none";

    delete el.modal.dataset.pengajuanId;

    if (fokusSebelumnya && document.contains(fokusSebelumnya)) {
      fokusSebelumnya.focus();
    }

    fokusSebelumnya = null;
  }

  // =========================================
  // 22. MEMUAT DATA ANTREAN
  // =========================================

  async function muatAntrean() {
    if (sedangMemuat) return;

    sedangMemuat = true;

    try {
      daftarAntrean = urutkan(await ambilDataAntrean());

      renderJumlah();
      renderAntrean();

      console.info(
        `[SILAB] ${daftarAntrean.length} pengajuan dimuat dari database.`,
      );
    } catch (error) {
      console.error("Gagal memuat antrean:", error);

      if (el.total) {
        el.total.textContent = "Gagal memuat data";
      }

      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 5;
      cell.className = "empty-state";
      cell.textContent = error.message;

      row.append(cell);
      el.tabel.replaceChildren(row);

      notifikasi(error.message, "error");
    } finally {
      sedangMemuat = false;
    }
  }

  // =========================================
  // 23. SETUJUI PENGAJUAN
  // =========================================

  async function prosesSetujui(id) {
    const item = cariItem(id);

    if (!item || !isPending(item)) {
      pesanModal("Pengajuan tidak berada dalam antrean verifikasi.");
      return;
    }

    if (mengalamiKonflik(item)) {
      pesanModal(
        "Pengajuan yang mengalami konflik harus diteruskan kepada Kepala Lab.",
      );
      return;
    }

    if (sedangMengirim) return;

    if (!window.confirm("Setujui pengajuan ini?")) return;

    const button = el.modal.querySelector(".btn-approve");

    sedangMengirim = true;

    if (button) button.disabled = true;

    try {
      const result = await kirimTindakan("setujui", id);

      tutupModal();

      await muatAntrean();

      notifikasi(result.message || "Pengajuan berhasil disetujui.");
    } catch (error) {
      pesanModal(error.message);
    } finally {
      sedangMengirim = false;

      if (button) button.disabled = false;
    }
  }

  // =========================================
  // 24. TOLAK PENGAJUAN
  // =========================================

  async function prosesTolak(id) {
    const item = cariItem(id);

    if (!item || !isPending(item)) {
      pesanModal("Pengajuan tidak berada dalam antrean verifikasi.");
      return;
    }

    if (mengalamiKonflik(item)) {
      pesanModal(
        "Pengajuan yang mengalami konflik harus diteruskan kepada Kepala Lab.",
      );
      return;
    }

    if (sedangMengirim) return;

    if (
      !window.confirm(
        "Tolak pengajuan ini? Status pengajuan akan diubah menjadi Ditolak.",
      )
    )
      return;

    const button = el.modal.querySelector('[data-keputusan="ditolak"]');

    sedangMengirim = true;

    if (button) button.disabled = true;

    try {
      const result = await kirimTindakan("tolak", id);

      tutupModal();

      await muatAntrean();

      notifikasi(result.message || "Pengajuan berhasil ditolak.");
    } catch (error) {
      pesanModal(error.message);
    } finally {
      sedangMengirim = false;

      if (button) button.disabled = false;
    }
  }

  // =========================================
  // 25. BATALKAN PERSETUJUAN
  // =========================================

  async function batalkanPersetujuan(id) {
    const item = cariItem(id);

    if (!item) {
      pesanModal("Data pengajuan tidak ditemukan.");
      return;
    }

    if (
      statusPengajuan(item) !== "disetujui" ||
      statusBooking(item) !== "terjadwal" ||
      sudahPresensi(item) ||
      batasPresensiHabis(item)
    ) {
      pesanModal(
        "Booking tidak dapat dibatalkan karena tidak memenuhi syarat.",
      );
      return;
    }

    if (sedangMengirim) return;

    if (
      !window.confirm(
        "Batalkan persetujuan booking ini? Pengajuan akan dikembalikan ke antrean verifikasi.",
      )
    )
      return;

    const button = el.modal.querySelector("[data-aksi-batalkan-persetujuan]");

    sedangMengirim = true;

    if (button) button.disabled = true;

    try {
      const result = await kirimTindakan("batalkan_persetujuan", id);

      tutupModal();

      filterAktif = "belum-disetujui";
      halamanAktif = 1;

      pilihFilter("belum-disetujui");

      await muatAntrean();

      notifikasi(result.message || "Persetujuan berhasil dibatalkan.");
    } catch (error) {
      pesanModal(error.message);
    } finally {
      sedangMengirim = false;

      if (button) button.disabled = false;
    }
  }

  // =========================================
  // 26. ESKALASI KONFLIK KE KEPALA LAB
  // =========================================

  async function eskalasiKonflik(id) {
    const item = cariItem(id);

    if (!item) {
      pesanModal("Data pengajuan tidak ditemukan.");
      return;
    }

    if (!mengalamiKonflik(item)) {
      pesanModal("Pengajuan ini tidak memiliki konflik.");
      return;
    }

    if (sudahDieskalasi(item)) {
      pesanModal("Kasus konflik ini sudah dikirim kepada Kepala Lab.");
      return;
    }

    if (sedangMengirim) return;

    const konfirmasi = window.confirm(
      "Teruskan kasus konflik jadwal ini kepada Kepala Lab untuk mendapatkan keputusan?",
    );

    if (!konfirmasi) return;

    const buttons = el.modal.querySelectorAll("[data-eskalasi-konflik]");

    sedangMengirim = true;

    buttons.forEach((button) => (button.disabled = true));

    try {
      /*
       * API tindakan harus mendukung aksi:
       * eskalasi_konflik
       *
       * API bertanggung jawab:
       * 1. Memvalidasi pengajuan.
       * 2. Membentuk kelompok konflik.
       * 3. Menyimpan data ke tabel konflik.
       * 4. Menghubungkan anggota melalui pengajuan_konflik.
       * 5. Mencatat status pengiriman kepada Kepala Lab.
       */

      const result = await kirimTindakan("kirim_konflik", id);

      await muatAntrean();

      const itemTerbaru = cariItem(id);

      if (itemTerbaru) {
        bukaModal(id);
      } else {
        tutupModal();
      }

      notifikasi(
        result.message ||
          "Kasus konflik berhasil diteruskan kepada Kepala Lab.",
      );
    } catch (error) {
      pesanModal(error.message);

      buttons.forEach((button) => (button.disabled = false));
    } finally {
      sedangMengirim = false;
    }
  }

  // =========================================
// 26A. TOLAK PENGAJUAN YANG MENGALAMI KONFLIK
// =========================================

async function tolakPengajuanKonflik(id) {
    const item = cariItem(id);

    if (!item) {
        pesanModal("Data pengajuan tidak ditemukan.");
        return;
    }

    // Pastikan pengajuan masih pending.
    if (!isPending(item) || isApproved(item)) {
        pesanModal(
            "Hanya pengajuan baru yang masih menunggu verifikasi yang dapat ditolak."
        );
        return;
    }

    if (!mengalamiKonflik(item)) {
        pesanModal(
            "Pengajuan ini tidak mengalami konflik jadwal."
        );
        return;
    }

    if (sudahDieskalasi(item)) {
        pesanModal(
            "Pengajuan sudah diteruskan kepada Kepala Lab dan tidak dapat ditolak melalui tindakan ini."
        );
        return;
    }

    if (sedangMengirim) return;

    const konfirmasi = window.confirm(
        "Tolak pengajuan baru ini karena mengalami konflik jadwal?\n\n" +
        "Booking lama yang sudah disetujui atau sedang menunggu presensi tidak akan diubah."
    );

    if (!konfirmasi) return;

    const buttons = el.modal.querySelectorAll(
        "[data-tolak-konflik]"
    );

    sedangMengirim = true;

    buttons.forEach(button => {
        button.disabled = true;
    });

    try {
        const result = await kirimTindakan(
            "tolak_konflik",
            id
        );

        tutupModal();

        await muatAntrean();

        notifikasi(
            result.message ||
            "Pengajuan konflik berhasil ditolak."
        );

    } catch (error) {

        pesanModal(error.message);

        buttons.forEach(button => {
            button.disabled = false;
        });

    } finally {
        sedangMengirim = false;
    }
}

  // =========================================
  // 27. PILIH FILTER
  // =========================================

  function pilihFilter(value) {
    if (!["belum-disetujui", "sudah-disetujui"].includes(value)) {
      return;
    }

    filterAktif = value;
    halamanAktif = 1;

    el.filter.forEach((button) => {
      const active = button.dataset.filterAntrean === value;

      button.classList.toggle("active", active);

      button.setAttribute("aria-pressed", String(active));
    });

    renderAntrean();
  }

  // =========================================
  // 28. EVENT FILTER
  // =========================================

  el.filter.forEach((button) => {
    button.addEventListener("click", () => {
      pilihFilter(button.dataset.filterAntrean);
    });
  });

  // =========================================
  // 29. EVENT TABEL
  // =========================================

  el.tabel.addEventListener("click", (event) => {
    const button = event.target.closest("[data-aksi-detail]");

    if (button) {
      bukaModal(button.dataset.id);
    }
  });

  // =========================================
  // 30. EVENT MODAL
  // =========================================

  el.modal.addEventListener("click", (event) => {
    if (event.target.closest("[data-tutup-modal]")) {
      tutupModal();
      return;
    }

    const escalationButton = event.target.closest("[data-eskalasi-konflik]");

    if (escalationButton) {
      eskalasiKonflik(escalationButton.dataset.eskalasiKonflik);
      return;
    }

        // =====================================
    // TOMBOL TOLAK PENGAJUAN KONFLIK
    // =====================================

    const rejectConflictButton = event.target.closest(
        "[data-tolak-konflik]"
    );

    if (rejectConflictButton) {
        tolakPengajuanKonflik(
            rejectConflictButton.dataset.tolakKonflik
        );
        return;
    }

    const id = el.modal.dataset.pengajuanId;

    if (!id) return;

    if (event.target.closest(".btn-approve")) {
      prosesSetujui(id);
      return;
    }

    if (event.target.closest('[data-keputusan="ditolak"]')) {
      prosesTolak(id);
      return;
    }

    if (event.target.closest("[data-aksi-batalkan-persetujuan]")) {
      batalkanPersetujuan(id);
      return;
    }
  });

  // =========================================
  // 31. EVENT PAGINATION
  // =========================================

  if (el.sebelumnya) {
    el.sebelumnya.addEventListener("click", () => {
      if (halamanAktif > 1) {
        halamanAktif--;
        renderAntrean();
      }
    });
  }

  if (el.berikutnya) {
    el.berikutnya.addEventListener("click", () => {
      const pages = Math.ceil(dataFilter().length / PER_HALAMAN);

      if (halamanAktif < pages) {
        halamanAktif++;
        renderAntrean();
      }
    });
  }

  // =========================================
  // 32. EVENT KEYBOARD
  // =========================================

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.modal.hidden) {
      tutupModal();
    }
  });

  // =========================================
  // 33. REFRESH DATA
  // =========================================

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      muatAntrean();
    }
  });

  window.addEventListener("focus", muatAntrean);

  window.setInterval(muatAntrean, INTERVAL_REFRESH);

  // =========================================
  // 34. INISIALISASI
  // =========================================

  el.modal.hidden = true;

  el.modal.setAttribute("aria-hidden", "true");

  el.modal.style.display = "none";

  muatAntrean();
})(window, document);
