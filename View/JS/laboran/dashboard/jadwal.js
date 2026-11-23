
(function (window, document) {
  "use strict";

  // =========================================
  // 1. REFERENSI ELEMEN HTML
  // =========================================

  const waktu = window.SILABWaktu;

  const el = {
    jadwal: document.getElementById("jadwalBody"),
    templateBaris: document.getElementById("templateBarisJadwal"),
    jumlah: document.getElementById("jumlahJadwal"),
    infoHalaman: document.getElementById("infoPagination"),
    kontrolHalaman: document.getElementById("kontrolPagination"),
  };

  const BATAS_PER_HALAMAN = 5;

    let halamanAktif = 1;
    let sedangMemperbarui = false;
    let perluMemperbarui = false;

  // =========================================
  // 2. PEMERIKSAAN ELEMEN
  // =========================================

  if (
    !waktu ||
    Object.values(el).some((item) => !item)
  ) {
    console.error(
      "SILAB: Elemen atau utilitas waktu jadwal belum tersedia."
    );
    return;
  }

  // =========================================
  // 3. MENGAMBIL STATUS PRESENSI
  // =========================================

  function statusPresensi(booking) {
    const status = booking.presensi?.status;

    return ["digunakan", "tidak_digunakan"].includes(status)
      ? status
      : ["digunakan", "tidak_digunakan"].includes(booking.status)
        ? booking.status
        : null;
  }

  // =========================================
  // 4. MEMERIKSA RENTANG WAKTU
  // =========================================

  function rentangWaktu(booking) {
    return waktu.validasiRentang(
      booking.tanggal,
      booking.waktuMulai,
      booking.waktuSelesai
    );
  }

  // =========================================
  // 5. MENGAMBIL DATA JADWAL DARI API
  // =========================================

  async function ambilJadwalHariIni(tanggal) {
    const response = await fetch(
    `api/jadwal.php?tanggal=${encodeURIComponent(tanggal)}`,
    {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin",
        headers: {
        Accept: "application/json",
        },
    }
    );

    let hasil;

    try {
      hasil = await response.json();
    } catch {
      throw new Error(
        "Respons API jadwal bukan JSON yang valid."
      );
    }

    if (!response.ok || !hasil.success) {
      throw new Error(
        hasil.message ||
        "Gagal mengambil jadwal laboratorium."
      );
    }

    if (!Array.isArray(hasil.data)) {
      throw new Error(
        "Format data jadwal tidak valid."
      );
    }

    return hasil.data;
  }

  // =========================================
  // 6. MENENTUKAN STATUS JADWAL
  // =========================================

  function statusJadwal(booking, rentang, sekarang) {
    const presensi = statusPresensi(booking);

    if (presensi === "digunakan") {
      const selesai = sekarang >= rentang.selesai;

      return {
        kode: selesai ? "selesai" : "aktif",
        label: selesai
          ? "Selesai Digunakan"
          : "Aktif di Lab",
        ikon: "bi-check-circle-fill",
      };
    }

    if (presensi === "tidak_digunakan") {
      return {
        kode: "tidak-digunakan",
        label: "Tidak Digunakan",
        ikon: "bi-x-circle-fill",
      };
    }

    return {
      kode: "menunggu",
      label: "Menunggu Presensi",
      ikon: "bi-hourglass-split",
    };
  }

  // =========================================
  // 7. KETERANGAN WAKTU JADWAL
  // =========================================

  function keteranganJadwal(
    booking,
    rentang,
    status,
    sekarang,
    idBerikutnya
  ) {
    if (status.kode === "tidak-digunakan") {
      return "Slot Dibuka";
    }

    if (status.kode === "aktif") {
      return "Sedang Berjalan";
    }

    if (status.kode === "selesai") {
      const durasi = Math.round(
        (rentang.selesai - rentang.mulai) / 60000
      );

      return `Selesai • ${durasi} mnt`;
    }

    if (
      sekarang >= rentang.mulai &&
      sekarang < rentang.selesai
    ) {
      return "Sedang Berjalan";
    }

    if (booking.id === idBerikutnya) {
      return "Sesi Berikutnya";
    }

    const jam = Number(
      booking.waktuMulai.slice(0, 2)
    );

    return jam >= 18
      ? "Malam Hari"
      : jam >= 15
        ? "Sore Hari"
        : "Sesi Berikutnya";
  }

  // =========================================
  // 8. MENGISI TEKS TEMPLATE
  // =========================================

  function isi(parent, selector, nilai) {
    const target = parent.querySelector(selector);

    if (target) {
      target.textContent = nilai ?? "-";
    }
  }

  // =========================================
  // 9. MENGATUR IKON TEMPLATE
  // =========================================

  function aturIkon(parent, selector, nama) {
    const target = parent.querySelector(selector);

    if (target) {
      target.className = `bi ${nama}`;
    }
  }

  // =========================================
// 10. FORMAT KATEGORI
// =========================================

function formatKategori(kategori, kodeKategori) {
    if (!kategori) {
        return "Kategori belum diatur";
    }

    if (!kodeKategori) {
        return kategori;
    }

    return `${kategori} (${kodeKategori})`;
}

  // =========================================
  // 11. MEMBUAT SATU BARIS JADWAL
  // =========================================

  function buatBarisJadwal(
    booking,
    sekarang,
    idBerikutnya
  ) {
    const rentang = rentangWaktu(booking);

    if (!rentang.valid) return null;

    const fragmen =
      el.templateBaris.content.cloneNode(true);

    const baris = fragmen.querySelector(
      "[data-jadwal-row]"
    );

    if (!baris) return null;

    const status = statusJadwal(
      booking,
      rentang,
      sekarang
    );

    const kategori = booking.kategori;
    const kodeKategori = booking.kodeKategori;

    // WAKTU
    isi(
      baris,
      '[data-field="waktu"]',
      waktu.formatRentangJam(
        booking.waktuMulai,
        booking.waktuSelesai
      )
    );

    // KETERANGAN WAKTU
    isi(
      baris,
      '[data-field="keterangan"]',
      keteranganJadwal(
        booking,
        rentang,
        status,
        sekarang,
        idBerikutnya
      )
    );

    // KEGIATAN
    isi(
      baris,
      '[data-field="nama-kegiatan"]',
      booking.namaKegiatan
    );

    // PEMOHON
    isi(
      baris,
      '[data-field="pemohon"]',
      booking.namaPemohon
    );

    // KATEGORI
    isi(
        baris,
        '[data-field="label-kategori"]',
        formatKategori(kategori, kodeKategori)
    );

    // STATUS
    isi(
      baris,
      '[data-field="label-status"]',
      status.label
    );

    // IKON WAKTU
    aturIkon(
      baris,
      '[data-field="ikon-jam"]',
      status.kode === "aktif"
        ? "bi-clock-fill"
        : "bi-clock"
    );

    // IKON KATEGORI
    aturIkon(
        baris,
        '[data-field="ikon-kategori"]',
        "bi-tag-fill"
    );
    // IKON STATUS
    aturIkon(
      baris,
      '[data-field="ikon-status"]',
      status.ikon
    );

    // BADGE KATEGORI
    const badgeKategori = baris.querySelector(
        '[data-field="kategori"]'
    );

    if (badgeKategori) {
        badgeKategori.dataset.kategori =
            kodeKategori || "lainnya";
    }

    // BADGE STATUS
    const badgeStatus = baris.querySelector(
      '[data-field="status"]'
    );

    if (badgeStatus) {
      badgeStatus.dataset.status = status.kode;
      badgeStatus.classList.add(
        `status-${status.kode}`
      );
    }

    baris.dataset.status = status.kode;

    return fragmen;
  }

  // =========================================
  // 12. MEMBUAT TOMBOL PAGINATION
  // =========================================

  function tombolHalaman(
    label,
    halaman,
    nonaktif,
    aktif,
    ariaLabel
  ) {
    const tombol = document.createElement("button");

    tombol.type = "button";

    const angkaHalaman = /^\d+$/.test(label);

    tombol.className = angkaHalaman
      ? "page-number"
      : "page-btn";

    tombol.textContent = label;
    tombol.disabled = nonaktif;

    tombol.setAttribute(
      "aria-label",
      ariaLabel
    );

    if (aktif) {
      tombol.classList.add("active");
      tombol.setAttribute(
        "aria-current",
        "page"
      );
    }

    tombol.addEventListener("click", () => {
      if (nonaktif || halaman === halamanAktif) {
        return;
      }

      halamanAktif = halaman;

      perbaruiJadwal();
    });

    return tombol;
  }

  // =========================================
  // 13. MENAMPILKAN PAGINATION
  // =========================================

  function tampilkanPagination(jumlah) {
    const totalHalaman = Math.max(
      1,
      Math.ceil(jumlah / BATAS_PER_HALAMAN)
    );

    halamanAktif = Math.min(
      halamanAktif,
      totalHalaman
    );

    el.kontrolHalaman.replaceChildren();

    const awal = jumlah
      ? (halamanAktif - 1) *
          BATAS_PER_HALAMAN + 1
      : 0;

    const akhir = Math.min(
      halamanAktif * BATAS_PER_HALAMAN,
      jumlah
    );

    el.infoHalaman.textContent = jumlah
      ? `Menampilkan ${awal}–${akhir} dari ${jumlah} jadwal`
      : "Belum ada jadwal peminjaman hari ini.";

    // SEBELUMNYA
    el.kontrolHalaman.append(
      tombolHalaman(
        "Sebelumnya",
        Math.max(1, halamanAktif - 1),
        halamanAktif === 1,
        false,
        "Halaman sebelumnya"
      )
    );

    // NOMOR HALAMAN
    for (
      let nomor = 1;
      nomor <= totalHalaman;
      nomor++
    ) {
      el.kontrolHalaman.append(
        tombolHalaman(
          String(nomor),
          nomor,
          false,
          nomor === halamanAktif,
          `Halaman ${nomor}`
        )
      );
    }

    // BERIKUTNYA
    el.kontrolHalaman.append(
      tombolHalaman(
        "Berikutnya",
        Math.min(
          totalHalaman,
          halamanAktif + 1
        ),
        halamanAktif === totalHalaman,
        false,
        "Halaman berikutnya"
      )
    );
  }

  // =========================================
  // 14. MENAMPILKAN SELURUH JADWAL
  // =========================================

  function tampilkanJadwal(data, sekarang) {
    const fragmen = document.createDocumentFragment();

    const berikutnya = data.find((item) => {
      const rentang = rentangWaktu(item);

      return (
        !statusPresensi(item) &&
        rentang.valid &&
        rentang.mulai > sekarang
      );
    })?.id;

    const awal =
      (halamanAktif - 1) *
      BATAS_PER_HALAMAN;

    data
      .slice(
        awal,
        awal + BATAS_PER_HALAMAN
      )
      .forEach((booking) => {
        const baris = buatBarisJadwal(
          booking,
          sekarang,
          berikutnya
        );

        if (baris) {
          fragmen.append(baris);
        }
      });

    el.jadwal.replaceChildren(fragmen);

    if (!data.length) {
      const kosong = document.createElement("p");

      kosong.className = "jadwal-kosong";

      kosong.textContent =
        "Belum ada jadwal peminjaman hari ini.";

      el.jadwal.append(kosong);
    }

    tampilkanPagination(data.length);
  }

  // =========================================
  // 15. MENANGANI KESALAHAN PENGAMBILAN DATA
  // =========================================

  function tampilkanErrorJadwal() {
    el.jumlah.textContent = "-";

    el.jadwal.replaceChildren();

    const pesan = document.createElement("p");

    pesan.className = "jadwal-kosong";

    pesan.textContent =
      "Jadwal belum dapat dimuat. Silakan coba kembali.";

    el.jadwal.append(pesan);

    el.infoHalaman.textContent =
      "Gagal memuat jadwal.";

    el.kontrolHalaman.replaceChildren();
  }

  // =========================================
  // 16. MEMPERBARUI TABEL JADWAL
  // =========================================

    async function perbaruiJadwal() {

    if (sedangMemperbarui) {
        perluMemperbarui = true;
        return;
    }

    sedangMemperbarui = true;

    try {

        const tanggal = waktu.tanggalHariIni();
        const sekarang = new Date();

        const data = await ambilJadwalHariIni(tanggal);

        // Memperbarui jumlah seluruh jadwal.
        el.jumlah.textContent = String(data.length);

        // Memperbarui tabel dan pagination.
        tampilkanJadwal(data, sekarang);

    } catch (error) {

        console.error(
            "SILAB: Gagal memperbarui tabel jadwal.",
            error
        );

        tampilkanErrorJadwal();

    } finally {

        sedangMemperbarui = false;

        if (perluMemperbarui) {
            perluMemperbarui = false;
            perbaruiJadwal();
        }
    }
}

  // =========================================
  // 17. EVENT PERUBAHAN DATA
  // =========================================

    window.addEventListener(
        "silab:data-changed",
        perbaruiJadwal
    );

  // =========================================
  // 18. EVENT KETIKA HALAMAN DIBUKA KEMBALI
  // =========================================

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        perbaruiJadwal();
      }
    }
  );

  // =========================================
  // 19. PEMERIKSAAN BERKALA
  // =========================================

  window.setInterval(
    perbaruiJadwal,
    15000
  );

  // =========================================
  // 20. INISIALISASI
  // =========================================

  perbaruiJadwal();

  console.log(
    "SILAB: Modul jadwal laboratorium berhasil dimuat."
  );

})(window, document);
