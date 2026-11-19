/* =========================================
   SILAB - DASHBOARD PENGGUNA
   JADWAL PEMINJAMAN HARI INI
========================================= */

(() => {
  "use strict";

  const el = {
    jadwal: document.getElementById("user-slot-list"),
    jumlah: document.getElementById("user-jumlah-jadwal"),
    info: document.getElementById("user-info-pagination"),
    pagination: document.getElementById("user-pagination"),
  };

  const PER_HALAMAN = 5;

  let dataJadwal = [];
  let halamanAktif = 1;
  let sedangMemuat = false;

  if (!el.jadwal || !el.jumlah || !el.info || !el.pagination) {
    console.error("SILAB: Elemen jadwal pengguna belum lengkap.");
    return;
  }

  // Mengambil tanggal berdasarkan WIT.
  function tanggalHariIni() {
    const bagian = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jayapura",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

    return bagian;
  }

  // Mengambil jam sekarang berdasarkan WIT.
  function menitSekarang() {
    const bagian = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jayapura",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date());

    const [jam, menit] = bagian.split(":").map(Number);

    return jam * 60 + menit;
  }

  function konversiMenit(jam) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(jam || "")) {
      return null;
    }

    const [h, m] = jam.split(":").map(Number);
    return h * 60 + m;
  }

  function formatJam(jam) {
    return jam.replace(":", ".");
  }

  // Menentukan status berdasarkan waktu.
  function statusJadwal(item) {
    const sekarang = menitSekarang();
    const mulai = konversiMenit(item.waktuMulai);
    const selesai = konversiMenit(item.waktuSelesai);

    if (mulai === null || selesai === null || mulai >= selesai) {
      return {
        teks: "Waktu Tidak Valid",
        kelas: "user-status-invalid",
      };
    }

    if (sekarang < mulai) {
      return {
        teks: "Disetujui",
        kelas: "user-status-approved",
      };
    }

    if (sekarang < selesai) {
      return {
        teks: "Sedang Berlangsung",
        kelas: "user-status-ongoing",
      };
    }

    return {
      teks: "Selesai",
      kelas: "user-status-finished",
    };
  }

  // Membuat elemen secara aman.
  function buatElemen(tag, kelas, teks) {
    const node = document.createElement(tag);

    if (kelas) node.className = kelas;
    if (teks !== undefined) node.textContent = teks;

    return node;
  }

  function buatBaris(item) {
    const row = buatElemen("div", "user-jadwal-row");

    // JAM / SESI
    const jam = buatElemen("div", "user-jadwal-jam");

    jam.appendChild(
      buatElemen(
        "strong",
        "",
        `${formatJam(item.waktuMulai)} – ${formatJam(item.waktuSelesai)} WIT`,
      ),
    );

    // NAMA PEMOHON
    const pemohon = buatElemen("div", "user-jadwal-pemohon");

    pemohon.appendChild(buatElemen("strong", "", item.namaPemohon || "-"));

    // NAMA KEGIATAN
    const kegiatan = buatElemen("div", "user-jadwal-kegiatan");

    kegiatan.appendChild(buatElemen("strong", "", item.namaKegiatan || "-"));

    row.append(jam, pemohon, kegiatan);

    return row;
  }

  // Kondisi ketika tidak ada jadwal.
  function tampilkanKosong() {
    const kosong = buatElemen("div", "user-schedule-empty");

    kosong.appendChild(buatElemen("i", "bi bi-calendar-x"));

    kosong.appendChild(
      buatElemen("p", "", "Belum ada jadwal peminjaman hari ini."),
    );

    el.jadwal.replaceChildren(kosong);
  }

  // Tombol pagination.
  function buatTombol(label, halaman, nonaktif, aktif = false) {
    const tombol = buatElemen(
      "button",
      aktif ? "user-page-number active" : "user-page-button",
      label,
    );

    tombol.type = "button";
    tombol.disabled = nonaktif;

    tombol.addEventListener("click", () => {
      halamanAktif = halaman;
      tampilkanJadwal();
    });

    return tombol;
  }

  function tampilkanPagination() {
    const totalHalaman = Math.max(
      1,
      Math.ceil(dataJadwal.length / PER_HALAMAN),
    );

    halamanAktif = Math.min(halamanAktif, totalHalaman);

    const awal = dataJadwal.length ? (halamanAktif - 1) * PER_HALAMAN + 1 : 0;

    const akhir = Math.min(halamanAktif * PER_HALAMAN, dataJadwal.length);

    el.info.textContent = dataJadwal.length
      ? `Menampilkan ${awal}–${akhir} dari ${dataJadwal.length} jadwal`
      : "Menampilkan 0 jadwal";

    el.pagination.replaceChildren();

    el.pagination.appendChild(
      buatTombol(
        "Sebelumnya",
        Math.max(1, halamanAktif - 1),
        halamanAktif === 1,
      ),
    );

    for (let i = 1; i <= totalHalaman; i++) {
      el.pagination.appendChild(
        buatTombol(String(i), i, false, i === halamanAktif),
      );
    }

    el.pagination.appendChild(
      buatTombol(
        "Berikutnya",
        Math.min(totalHalaman, halamanAktif + 1),
        halamanAktif === totalHalaman,
      ),
    );
  }

  // Menampilkan data ke tabel.
  function tampilkanJadwal() {
    el.jadwal.replaceChildren();

    if (!dataJadwal.length) {
      tampilkanKosong();
      tampilkanPagination();
      return;
    }

    const awal = (halamanAktif - 1) * PER_HALAMAN;
    const dataHalaman = dataJadwal.slice(awal, awal + PER_HALAMAN);

    const fragmen = document.createDocumentFragment();

    dataHalaman.forEach((item) => {
      fragmen.appendChild(buatBaris(item));
    });

    el.jadwal.appendChild(fragmen);

    tampilkanPagination();
  }

  // Mengambil data dari API.
  async function perbaruiJadwal() {
    if (sedangMemuat) return;

    sedangMemuat = true;

    try {
      const response = await fetch(
        `jadwal_hari_ini.php?tanggal=${encodeURIComponent(tanggalHariIni())}`,
        {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const hasil = await response.json();

      if (!response.ok || !hasil.success) {
        throw new Error(hasil.message || "Gagal mengambil jadwal.");
      }

      if (!Array.isArray(hasil.data)) {
        throw new Error("Format data jadwal tidak valid.");
      }

      dataJadwal = hasil.data;
      el.jumlah.textContent = `${dataJadwal.length} Sesi Terjadwal`;

      tampilkanJadwal();
    } catch (error) {
      console.error("SILAB Jadwal Pengguna:", error);

      el.jadwal.replaceChildren(
        buatElemen(
          "p",
          "user-schedule-empty",
          "Jadwal belum dapat dimuat. Silakan coba kembali.",
        ),
      );
    } finally {
      sedangMemuat = false;
    }
  }

  // Pembaruan otomatis.
  perbaruiJadwal();

  window.setInterval(perbaruiJadwal, 15000);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) perbaruiJadwal();
  });

  window.addEventListener("silab:data-changed", perbaruiJadwal);
})();
