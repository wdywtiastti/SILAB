(function (window, document) {
  "use strict";

  const waktu = window.SILABWaktu;
  const layanan = window.SILABService;

  const el = {
    presensi: document.getElementById("wadahPresensi"),
    templatePresensi: document.getElementById("templatePresensi"),
    jadwal: document.getElementById("jadwalBody"),
    templateBaris: document.getElementById("templateBarisJadwal"),
    jumlah: document.getElementById("jumlahJadwal"),
    infoHalaman: document.getElementById("infoPagination"),
    kontrolHalaman: document.getElementById("kontrolPagination"),
  };

  const BATAS_VALIDASI = 15;
  const BATAS_PER_HALAMAN = 5;

  const KATEGORI = {
    K1: ["K1 Praktikum", "bi-book-fill"],
    K2: ["K2 Dosen", "bi-person-badge-fill"],
    K4: ["K4 HMTI", "bi-people-fill"],
    K5: ["K5 Mandiri", "bi-person-fill"],
  };

  let halamanAktif = 1;
  let sedangMemperbarui = false;

  if (!waktu || !layanan || Object.values(el).some((item) => !item)) {
    console.error("SILAB: Elemen atau layanan dashboard belum tersedia.");
    return;
  }

  // Mengambil status akhir presensi.
  function statusPresensi(booking) {
    const status = booking.presensi?.status;

    return ["digunakan", "tidak_digunakan"].includes(status)
      ? status
      : ["digunakan", "tidak_digunakan"].includes(booking.status)
        ? booking.status
        : null;
  }

  // Memeriksa rentang waktu peminjaman.
  function rentangWaktu(booking) {
    return waktu.validasiRentang(
      booking.tanggal,
      booking.waktuMulai,
      booking.waktuSelesai,
    );
  }

  // Mengambil jadwal hari ini dan mengurutkannya berdasarkan jam.

  function ambilJadwalHariIni(tanggal) {
    const STATUS_AKTIF = ["disetujui", "terjadwal", "digunakan", "berlangsung"];

    return layanan
      .getAll("bookings")
      .filter((item) => {
        const status = String(item.status || "")
          .toLowerCase()
          .trim();

        return item.tanggal === tanggal && STATUS_AKTIF.includes(status);
      })
      .sort((a, b) =>
        String(a.waktuMulai || "").localeCompare(String(b.waktuMulai || "")),
      );
  }

  // Menentukan status yang ditampilkan pada tabel.
  function statusJadwal(booking, rentang, sekarang) {
    const presensi = statusPresensi(booking);

    if (presensi === "digunakan") {
      const selesai = sekarang >= rentang.selesai;

      return {
        kode: selesai ? "selesai" : "aktif",
        label: selesai ? "Selesai Digunakan" : "Aktif di Lab",
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

  // Menentukan keterangan waktu pada setiap baris.
  function keteranganJadwal(booking, rentang, status, sekarang, idBerikutnya) {
    if (status.kode === "tidak-digunakan") {
      return "Slot Dibuka";
    }

    if (status.kode === "aktif") {
      return "Sedang Berjalan";
    }

    if (status.kode === "selesai") {
      const durasi = Math.round((rentang.selesai - rentang.mulai) / 60000);

      return `Selesai • ${durasi} mnt`;
    }

    if (sekarang >= rentang.mulai && sekarang < rentang.selesai) {
      return "Sedang Berjalan";
    }

    if (booking.id === idBerikutnya) {
      return "Sesi Berikutnya";
    }

    const jam = Number(booking.waktuMulai.slice(0, 2));

    return jam >= 18
      ? "Malam Hari"
      : jam >= 15
        ? "Sore Hari"
        : "Sesi Berikutnya";
  }

  // Mengisi teks pada template.
  function isi(parent, selector, nilai) {
    const target = parent.querySelector(selector);

    if (target) {
      target.textContent = nilai ?? "-";
    }
  }

  // Mengatur ikon pada template.
  function aturIkon(parent, selector, nama) {
    const target = parent.querySelector(selector);

    if (target) {
      target.className = `bi ${nama}`;
    }
  }

  // Membuat satu baris jadwal dari template HTML.
  function buatBarisJadwal(booking, sekarang, idBerikutnya) {
    const rentang = rentangWaktu(booking);

    if (!rentang.valid) return null;

    const fragmen = el.templateBaris.content.cloneNode(true);
    const baris = fragmen.querySelector("[data-jadwal-row]");

    if (!baris) return null;

    const status = statusJadwal(booking, rentang, sekarang);

    const kategori = KATEGORI[booking.kategori] || [
      booking.kategori || "Tidak diketahui",
      "bi-tag-fill",
    ];

    isi(
      baris,
      '[data-field="waktu"]',
      waktu.formatRentangJam(booking.waktuMulai, booking.waktuSelesai),
    );

    isi(
      baris,
      '[data-field="keterangan"]',
      keteranganJadwal(booking, rentang, status, sekarang, idBerikutnya),
    );

    isi(baris, '[data-field="nama-kegiatan"]', booking.namaKegiatan);
    isi(baris, '[data-field="pemohon"]', booking.namaPemohon);
    isi(baris, '[data-field="label-kategori"]', kategori[0]);
    isi(baris, '[data-field="label-status"]', status.label);

    aturIkon(
      baris,
      '[data-field="ikon-jam"]',
      status.kode === "aktif" ? "bi-clock-fill" : "bi-clock",
    );

    aturIkon(baris, '[data-field="ikon-kategori"]', kategori[1]);

    aturIkon(baris, '[data-field="ikon-status"]', status.ikon);

    const badgeKategori = baris.querySelector('[data-field="kategori"]');

    const badgeStatus = baris.querySelector('[data-field="status"]');

    if (badgeKategori) {
      badgeKategori.dataset.kategori = booking.kategori || "";
    }

    if (badgeStatus) {
      badgeStatus.dataset.status = status.kode;
      badgeStatus.classList.add(`status-${status.kode}`);
    }

    baris.dataset.status = status.kode;

    return fragmen;
  }

  // Membuat tombol navigasi halaman.
  function tombolHalaman(label, halaman, nonaktif, aktif, ariaLabel) {
    const tombol = document.createElement("button");

    tombol.type = "button";

    // Menyesuaikan class dengan CSS.
    const angkaHalaman = /^\d+$/.test(label);

    tombol.className = angkaHalaman ? "page-number" : "page-btn";

    tombol.textContent = label;
    tombol.disabled = nonaktif;
    tombol.setAttribute("aria-label", ariaLabel);

    if (aktif) {
      tombol.classList.add("active");
      tombol.setAttribute("aria-current", "page");
    }

    tombol.addEventListener("click", () => {
      if (nonaktif || halaman === halamanAktif) return;

      halamanAktif = halaman;
      perbaruiDashboard();
    });

    return tombol;
  }

  // Menampilkan informasi dan tombol pagination.
  function tampilkanPagination(jumlah) {
    const totalHalaman = Math.max(1, Math.ceil(jumlah / BATAS_PER_HALAMAN));

    halamanAktif = Math.min(halamanAktif, totalHalaman);

    el.kontrolHalaman.replaceChildren();

    const awal = jumlah ? (halamanAktif - 1) * BATAS_PER_HALAMAN + 1 : 0;

    const akhir = Math.min(halamanAktif * BATAS_PER_HALAMAN, jumlah);

    el.infoHalaman.textContent = jumlah
      ? `Menampilkan ${awal}–${akhir} dari ${jumlah} jadwal`
      : "Belum ada jadwal peminjaman hari ini.";

    el.kontrolHalaman.append(
      tombolHalaman(
        "Sebelumnya",
        Math.max(1, halamanAktif - 1),
        halamanAktif === 1,
        false,
        "Halaman sebelumnya",
      ),
    );

    for (let nomor = 1; nomor <= totalHalaman; nomor++) {
      el.kontrolHalaman.append(
        tombolHalaman(
          String(nomor),
          nomor,
          false,
          nomor === halamanAktif,
          `Halaman ${nomor}`,
        ),
      );
    }

    el.kontrolHalaman.append(
      tombolHalaman(
        "Berikutnya",
        Math.min(totalHalaman, halamanAktif + 1),
        halamanAktif === totalHalaman,
        false,
        "Halaman berikutnya",
      ),
    );
  }

  // Menampilkan jadwal sesuai halaman yang dipilih.
  function tampilkanJadwal(data, sekarang) {
    const fragmen = document.createDocumentFragment();

    const berikutnya = data.find((item) => {
      const rentang = rentangWaktu(item);

      return !statusPresensi(item) && rentang.valid && rentang.mulai > sekarang;
    })?.id;

    const awal = (halamanAktif - 1) * BATAS_PER_HALAMAN;

    data.slice(awal, awal + BATAS_PER_HALAMAN).forEach((booking) => {
      const baris = buatBarisJadwal(booking, sekarang, berikutnya);

      if (baris) {
        fragmen.append(baris);
      }
    });

    el.jadwal.replaceChildren(fragmen);

    if (!data.length) {
      const kosong = document.createElement("p");

      kosong.className = "jadwal-kosong";
      kosong.textContent = "Belum ada jadwal peminjaman hari ini.";

      el.jadwal.append(kosong);
    }

    tampilkanPagination(data.length);
  }

  // Menampilkan card hanya selama validasi masih tersedia.
  function tampilkanPresensi(data, sekarang) {
    const fragmen = document.createDocumentFragment();

    data.forEach((booking) => {
      // Card tidak ditampilkan jika presensi sudah dicatat.
      if (statusPresensi(booking)) return;

      const rentang = rentangWaktu(booking);

      if (!rentang.valid) return;

      // Menunggu waktu mulai peminjaman.
      if (sekarang < rentang.mulai) return;

      // Card tidak ditampilkan setelah sesi berakhir.
      if (sekarang >= rentang.selesai) return;

      // Menghitung batas validasi 15 menit.
      const batas = rentang.mulai.getTime() + BATAS_VALIDASI * 60000;

      // Menutup tampilan card setelah batas validasi.
      if (sekarang.getTime() >= batas) return;

      const isiTemplate = el.templatePresensi.content.cloneNode(true);

      const kartu = isiTemplate.querySelector(".sesi-card");

      if (!kartu) return;

      kartu.dataset.bookingId = booking.id;

      isi(
        kartu,
        '[data-field="rentang-jam"]',
        waktu.formatRentangJam(booking.waktuMulai, booking.waktuSelesai),
      );

      isi(kartu, '[data-field="nama-kegiatan"]', booking.namaKegiatan);

      isi(kartu, '[data-field="pemohon"]', booking.namaPemohon);

      const feedback = kartu.querySelector("[data-presensi-feedback]");

      if (feedback) {
        feedback.textContent =
          "Silakan validasi kehadiran dalam 15 menit sejak sesi dimulai.";

        feedback.dataset.jenis = "info";
      }

      fragmen.append(isiTemplate);
    });

    el.presensi.replaceChildren(fragmen);
  }

  // Memperbarui seluruh tampilan dashboard.
  function perbaruiDashboard() {
    if (sedangMemperbarui) return;

    sedangMemperbarui = true;

    try {
      const tanggal = waktu.tanggalHariIni();
      const sekarang = new Date();

      const data = ambilJadwalHariIni(tanggal);

      el.jumlah.textContent = String(data.length);

      tampilkanJadwal(data, sekarang);
      tampilkanPresensi(data, sekarang);
    } catch (error) {
      console.error("SILAB: Gagal memperbarui dashboard.", error);
    } finally {
      sedangMemperbarui = false;
    }
  }

  // Memperbarui dashboard ketika data berubah.
  window.addEventListener("silab:data-changed", () => {
    if (!sedangMemperbarui) {
      perbaruiDashboard();
    }
  });

  // Memperbarui dashboard ketika pengguna kembali ke halaman.
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      perbaruiDashboard();
    }
  });

  // Memeriksa perubahan waktu setiap 15 detik.
  window.setInterval(perbaruiDashboard, 15000);

  // Menampilkan data ketika dashboard pertama kali dibuka.
  perbaruiDashboard();

  console.log("SILAB: Dashboard Laboran berhasil dimuat.");
})(window, document);
