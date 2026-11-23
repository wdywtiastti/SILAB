
(function (window, document) {
  "use strict";

  // =========================================
  // 1. REFERENSI ELEMEN HTML
  // =========================================

  const waktu = window.SILABWaktu;

  const el = {
    presensi: document.getElementById("wadahPresensi"),
    templatePresensi: document.getElementById("templatePresensi"),
  };

  const BATAS_VALIDASI = 15;

  let sedangMemperbarui = false;
  let perluMemperbarui = false;

  // =========================================
  // 2. PEMERIKSAAN ELEMEN
  // =========================================

  if (
    !waktu ||
    !el.presensi ||
    !el.templatePresensi
  ) {
    console.error(
      "SILAB: Elemen atau utilitas waktu presensi belum tersedia."
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
        "Gagal mengambil data presensi."
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
  // 6. MENGISI INFORMASI CARD
  // =========================================

  function isi(parent, selector, nilai) {
    const target = parent.querySelector(selector);

    if (target) {
      target.textContent = nilai ?? "-";
    }
  }

  // =========================================
  // 7. MENAMPILKAN CARD PRESENSI
  // =========================================

  function tampilkanPresensi(data, sekarang) {
    const fragmen = document.createDocumentFragment();

    data.forEach((booking) => {

      // Tidak menampilkan booking yang sudah divalidasi.
      if (statusPresensi(booking)) return;

      const rentang = rentangWaktu(booking);

      if (!rentang.valid) return;

      // Menunggu waktu mulai peminjaman.
      if (sekarang < rentang.mulai) return;

      // Tidak menampilkan sesi yang sudah berakhir.
      if (sekarang >= rentang.selesai) return;

      // Menghitung batas validasi 15 menit.
      const batas =
        rentang.mulai.getTime() +
        BATAS_VALIDASI * 60000;

      // Tidak menampilkan card setelah batas validasi.
      if (sekarang.getTime() >= batas) return;

      // Membuat card berdasarkan template HTML.
      const isiTemplate =
        el.templatePresensi.content.cloneNode(true);

      const kartu = isiTemplate.querySelector(".sesi-card");

      if (!kartu) return;

      kartu.dataset.bookingId = booking.id;

      // Mengisi rentang waktu.
      isi(
        kartu,
        '[data-field="rentang-jam"]',
        waktu.formatRentangJam(
          booking.waktuMulai,
          booking.waktuSelesai
        )
      );

      // Mengisi nama kegiatan.
      isi(
        kartu,
        '[data-field="nama-kegiatan"]',
        booking.namaKegiatan
      );

      // Mengisi nama pemohon.
      isi(
        kartu,
        '[data-field="pemohon"]',
        booking.namaPemohon
      );

      // Mengisi informasi batas validasi.
      const feedback = kartu.querySelector(
        "[data-presensi-feedback]"
      );

      if (feedback) {
        feedback.textContent =
          "Silakan validasi kehadiran dalam 15 menit sejak sesi dimulai.";

        feedback.dataset.jenis = "info";
      }

      fragmen.append(isiTemplate);
    });

    // Memperbarui wadah card presensi.
    el.presensi.replaceChildren(fragmen);
  }

  // =========================================
  // 8. MENAMPILKAN KONDISI KESALAHAN
  // =========================================

  function tampilkanErrorPresensi() {
    const pesan = document.createElement("p");

    pesan.className = "jadwal-kosong";

    pesan.textContent =
      "Data presensi belum dapat dimuat. Silakan coba kembali.";

    el.presensi.replaceChildren(pesan);
  }

  // =========================================
  // 9. MEMPERBARUI CARD PRESENSI
  // =========================================

  async function perbaruiPresensi() {

    if (sedangMemperbarui) {
        perluMemperbarui = true;
        return;
    }

    sedangMemperbarui = true;

    try {

        const tanggal = waktu.tanggalHariIni();
        const sekarang = new Date();

        const data = await ambilJadwalHariIni(tanggal);

        tampilkanPresensi(data, sekarang);

    } catch (error) {

        console.error(
            "SILAB: Gagal memperbarui card presensi.",
            error
        );

        tampilkanErrorPresensi();

    } finally {

        sedangMemperbarui = false;

        if (perluMemperbarui) {
            perluMemperbarui = false;
            perbaruiPresensi();
        }
    }
}

  // =========================================
  // 10. EVENT PERUBAHAN DATA
  // =========================================

  window.addEventListener(
    "silab:data-changed",
    perbaruiPresensi
);

  // =========================================
  // 11. EVENT KETIKA HALAMAN DIBUKA KEMBALI
  // =========================================

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        perbaruiPresensi();
      }
    }
  );

  // =========================================
  // 12. PEMERIKSAAN BERKALA
  // =========================================

  window.setInterval(
    perbaruiPresensi,
    15000
  );

  // =========================================
  // 13. INISIALISASI
  // =========================================

  perbaruiPresensi();

  console.log(
    "SILAB: Modul tampilan presensi berhasil dimuat."
  );

})(window, document);
