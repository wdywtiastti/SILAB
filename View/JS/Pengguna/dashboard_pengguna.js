/* =========================================
  SILAB - DASHBOARD PENGGUNA
  TAMPILAN DAN PENGELOLAAN JADWAL HARI INI
========================================= */

(() => {
  "use strict";


  //  REFERENSI ELEMEN HTML

  const tanggalElement = document.getElementById(
    "user-current-date"
  );

  const slotContainer = document.getElementById(
    "user-slot-list"
  );

  // =====================================
  // 3. FUNGSI TANGGAL HARI INI
  // =====================================

  function getTanggalHariIni() {
    const sekarang = new Date();

    const tahun = sekarang.getFullYear();
    const bulan = String(sekarang.getMonth() + 1).padStart(2, "0");

    const tanggal = String(sekarang.getDate()).padStart(2, "0");

    return `${tahun}-${bulan}-${tanggal}`;
  }

  function renderTanggal() {
    if (!tanggalElement) return;

    const sekarang = new Date();

    tanggalElement.textContent = new Intl.DateTimeFormat("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(sekarang);
  }

  // =====================================
  // 4. FORMAT WAKTU
  // =====================================

  function formatWaktu(waktu) {
    return waktu.replace(":", ".");
  }

  function toMinutes(waktu) {
    if (typeof waktu !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(waktu)) {
      return null;
    }

    const [jam, menit] = waktu.split(":").map(Number);

    return jam * 60 + menit;
  }

  // =====================================
  // 5. STATUS OTOMATIS
  // =====================================

  function getStatusJadwal(item) {
    const sekarang = new Date();

    const menitSekarang = sekarang.getHours() * 60 + sekarang.getMinutes();

    const mulai = toMinutes(item.mulai);
    const selesai = toMinutes(item.selesai);

    if (mulai === null || selesai === null || mulai >= selesai) {
      return {
        teks: "Waktu tidak valid",
        className: "user-status-invalid",
      };
    }

    if (menitSekarang < mulai) {
      return {
        teks: "Disetujui",
        className: "user-status-approved",
      };
    }

    if (menitSekarang < selesai) {
      return {
        teks: "Sedang Berlangsung",
        className: "user-status-ongoing",
      };
    }

    return {
      teks: "Selesai",
      className: "user-status-finished",
    };
  }

  // =====================================
  // 6. MEMBUAT ELEMEN HTML
  // =====================================

  function buatElemen(tag, className, text) {
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
  // 7. RENDER SATU KARTU JADWAL
  // =====================================

  function renderKartuJadwal(item) {
    const article = buatElemen("article", "user-slot-card");

    // WAKTU
    const waktu = buatElemen(
      "div",
      "user-slot-time",
      `${formatWaktu(item.mulai)} – ${formatWaktu(item.selesai)}`,
    );

    // DETAIL JADWAL
    const detail = buatElemen("div", "user-slot-detail");

    const title = buatElemen("div", "user-slot-title");

    const kegiatan = buatElemen("h4", "", item.kegiatan);

    const badgePC = buatElemen(
      "span",
      "user-requirement-badge",
      `Kebutuhan PC: ${item.pc}`,
    );

    const badgeKursi = buatElemen(
      "span",
      "user-requirement-badge",
      `Kebutuhan Kursi: ${item.kursi}`,
    );

    title.append(kegiatan, badgePC, badgeKursi);

    const informasi = buatElemen("p");

    informasi.append(
      document.createTextNode(item.kelas || "Penggunaan Laboratorium"),
    );

    const pemisah = buatElemen("span", "", "•");

    informasi.append(
      pemisah,
      document.createTextNode(`Pemohon: ${item.pemohon}`),
    );

    detail.append(title, informasi);

    // STATUS
    const statusWrapper = buatElemen("div", "user-slot-status");

    const statusData = getStatusJadwal(item);

    const status = buatElemen("span", statusData.className);

    const icon = buatElemen("i", "bi bi-circle-fill");

    status.append(icon, document.createTextNode(statusData.teks));

    statusWrapper.appendChild(status);

    article.append(waktu, detail, statusWrapper);

    return article;
  }

  // =====================================
  // 8. RENDER KONDISI KOSONG
  // =====================================

  function renderKosong() {
    const empty = buatElemen("div", "user-schedule-empty");

    const icon = buatElemen("i", "bi bi-calendar-x");

    const title = buatElemen("h4", "", "Belum Ada Jadwal Hari Ini");

    const description = buatElemen(
      "p",
      "",
      "Anda belum memiliki jadwal penggunaan laboratorium yang disetujui untuk hari ini.",
    );

    empty.append(icon, title, description);

    slotContainer.replaceChildren(empty);
  }

  // =====================================
  // 9. FILTER JADWAL PENGGUNA
  // =====================================

    function getJadwalHariIni() {
  // Data akan diambil dari database
  // melalui endpoint PHP pada tahap berikutnya.

  return [];
  }

  // =====================================
  // 10. RENDER SELURUH JADWAL
  // =====================================

  function renderJadwalHariIni() {
    renderTanggal();

    const jadwal = getJadwalHariIni();

    slotContainer.replaceChildren();

    if (jadwal.length === 0) {
      renderKosong();
      return;
    }

    jadwal.forEach((item) => {
      slotContainer.appendChild(renderKartuJadwal(item));
    });
  }

  renderJadwalHariIni();
})();