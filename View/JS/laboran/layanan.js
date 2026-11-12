/**
 * LAYANAN DATA SILAB - MODUL LABORAN
 *
 * Mengelola:
 * 1. Shared Storage dan data simulasi.
 * 2. Pengajuan dan antrean.
 * 3. Booking dan validasi kapasitas.
 * 4. Pemeriksaan bentrokan jadwal.
 * 5. Verifikasi dan penolakan pengajuan.
 * 6. Presensi laboratorium.
 * 7. Rekomendasi jadwal pengganti.
 * 8. Edit rekomendasi dengan batas 24 jam.
 */

(function (window) {
  "use strict";

  // ==========================================
  // 1. DEPENDENSI
  // ==========================================

  const storage = window.SILABStorage;
  const waktu = window.SILABWaktu;
  const seed = window.SILAB_DATA_SEED || {};

  if (!storage || !waktu) {
    console.error(
      "SILAB: storage.js dan waktu.js harus dimuat sebelum layanan.js.",
    );
    return;
  }

  const KEYS = storage.KEYS;

  const KOLEKSI = Object.freeze({
    antrean: KEYS.SUBMISSIONS,
    submissions: KEYS.SUBMISSIONS,

    rekomendasi: KEYS.RECOMMENDATIONS,
    recommendations: KEYS.RECOMMENDATIONS,

    konflik: KEYS.CONFLICTS,
    conflicts: KEYS.CONFLICTS,
    penggunaTergeser: KEYS.CONFLICTS,

    presensi: KEYS.ATTENDANCE,
    attendance: KEYS.ATTENDANCE,
  });

  const STATUS_ANTREAN_AKTIF = new Set([
    "verifikasi",
    "menunggu_verifikasi",
    "bentrok",
  ]);

  const STATUS_TERGESER = new Set([
    "tergeser",
    "pengguna_tergeser",
    "tergeser_prioritas",
    "menunggu_rekomendasi",
    "displaced",
  ]);

  const STATUS_REKOMENDASI_AKTIF = new Set([
    "rekomendasi_dikirim",
    "menunggu_persetujuan",
    "menunggu_konfirmasi",
  ]);

  const BATAS_KONFIRMASI = 24 * 60 * 60 * 1000;

  // ==========================================
  // 2. FUNGSI DASAR STORAGE
  // ==========================================

  function ambilKey(namaKoleksi) {
    const key = KOLEKSI[namaKoleksi];

    if (!key) {
      throw new Error(`Koleksi SILAB tidak dikenal: ${namaKoleksi}`);
    }

    return key;
  }

  function salinData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  function ambilSemua(namaKoleksi) {
    const data = storage.get(ambilKey(namaKoleksi), []);

    if (!Array.isArray(data)) {
      throw new Error(`Format data ${namaKoleksi} tidak valid.`);
    }

    return salinData(data);
  }

  function simpanSemua(namaKoleksi, data) {
    if (!Array.isArray(data)) {
      throw new Error("Data yang disimpan harus berupa array.");
    }

    if (!storage.set(ambilKey(namaKoleksi), data)) {
      throw new Error(`Gagal menyimpan data ${namaKoleksi}.`);
    }

    return true;
  }

  function beriTahuPerubahan(namaKoleksi, aksi) {
    window.dispatchEvent(
      new CustomEvent("silab:data-changed", {
        detail: {
          koleksi: namaKoleksi,
          aksi,
          waktu: new Date().toISOString(),
        },
      }),
    );
  }

  // ==========================================
  // 3. INISIALISASI DATA SIMULASI
  // ==========================================

  function gabungkanDataAwal(key, dataAwal) {
    if (!Array.isArray(dataAwal)) return;

    const dataTersimpan = storage.get(key, []);

    if (!Array.isArray(dataTersimpan)) {
      throw new Error(`Struktur penyimpanan ${key} tidak valid.`);
    }

    const gabungan = new Map();

    dataAwal.forEach((item) => {
      if (item?.id) {
        gabungan.set(String(item.id), item);
      }
    });

    // Data Shared Storage tetap menjadi prioritas.
    dataTersimpan.forEach((item) => {
      if (item?.id) {
        gabungan.set(String(item.id), item);
      }
    });

    const hasil = Array.from(gabungan.values());

    if (!storage.exists(key) || hasil.length !== dataTersimpan.length) {
      if (!storage.set(key, hasil)) {
        throw new Error(`Gagal menginisialisasi ${key}.`);
      }
    }
  }

  function inisialisasiData() {
    gabungkanDataAwal(KEYS.SUBMISSIONS, seed.antrean);

    gabungkanDataAwal(KEYS.CONFLICTS, seed.penggunaTergeser);

    gabungkanDataAwal(KEYS.RECOMMENDATIONS, seed.rekomendasi);
  }

  // ==========================================
  // 4. NORMALISASI WAKTU
  // ==========================================

  function pecahWaktu(nilai, tanggalFallback = "") {
    if (typeof nilai !== "string" || !nilai) {
      return {
        tanggal: tanggalFallback,
        jam: "",
      };
    }

    if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(nilai)) {
      return {
        tanggal: tanggalFallback,
        jam: nilai,
      };
    }

    const waktuLokal = nilai.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);

    const memilikiZona = /(?:Z|[+-]\d{2}:\d{2})$/i.test(nilai);

    if (waktuLokal && !memilikiZona) {
      return {
        tanggal: waktuLokal[1],
        jam: waktuLokal[2],
      };
    }

    const tanggal = new Date(nilai);

    if (Number.isNaN(tanggal.getTime())) {
      return {
        tanggal: tanggalFallback,
        jam: "",
      };
    }

    const bagian = waktu.getWITParts(tanggal);

    if (!bagian) {
      return {
        tanggal: tanggalFallback,
        jam: "",
      };
    }

    const duaDigit = (angka) => String(angka).padStart(2, "0");

    return {
      tanggal: `${bagian.year}-${duaDigit(bagian.month)}-${duaDigit(bagian.day)}`,

      jam: `${duaDigit(bagian.hour)}:${duaDigit(bagian.minute)}`,
    };
  }

  // ==========================================
  // 5. NORMALISASI DATA PENGAJUAN
  // ==========================================

  function normalisasiPengajuan(data) {
    if (!data) return null;

    const mulai = pecahWaktu(data.waktuMulai, data.tanggal || "");

    const selesai = pecahWaktu(
      data.waktuSelesai,
      data.tanggal || mulai.tanggal,
    );

    const tanggal = data.tanggal || mulai.tanggal;

    return {
      ...data,

      tanggal,

      tanggalSelesai: selesai.tanggal || tanggal,

      waktuMulai: mulai.jam,

      waktuSelesai: selesai.jam,

      status:
        data.status === "menunggu_verifikasi" ? "verifikasi" : data.status,

      namaPemohon: data.namaPemohon || data.nama || data.userIdentifier || "-",

      nipNpm: data.nipNpm || data.userIdentifier || "-",

      kebutuhanPC: Number(data.kebutuhanPC ?? data.jumlahPC ?? 0),

      kebutuhanKursi: Number(data.kebutuhanKursi ?? data.jumlahKursi ?? 0),

      jumlahPeserta: Number(data.jumlahPeserta ?? data.jumlahKursi ?? 0),
    };
  }

  function validasiJadwal(data) {
    if (
      !data.tanggal ||
      !data.tanggalSelesai ||
      data.tanggal !== data.tanggalSelesai
    ) {
      return {
        valid: false,
        pesan: "Peminjaman tidak boleh melewati pergantian tanggal.",
      };
    }

    const rentang = waktu.validasiRentang(
      data.tanggal,
      data.waktuMulai,
      data.waktuSelesai,
    );

    if (!rentang.valid) {
      return {
        valid: false,
        pesan: rentang.pesan,
      };
    }

    return {
      valid: true,
      mulai: rentang.mulai,
      selesai: rentang.selesai,
    };
  }

  // ==========================================
  // 6. PEMBENTUKAN DATA BOOKING
  // ==========================================

  function bentukBooking(pengajuan) {
    const data = normalisasiPengajuan(pengajuan);

    return {
      id: `BOOK-${data.id}`,

      sourceSubmissionId: data.id,

      userId: data.userIdentifier || null,

      namaPemohon: data.namaPemohon,

      nipNpm: data.nipNpm,

      namaKegiatan: data.namaKegiatan,

      kategori: data.kategori,

      jenisKegiatan: data.jenisKegiatan || "",

      dosen: data.dosen || "",

      tanggal: data.tanggal,

      waktuMulai: data.waktuMulai,

      waktuSelesai: data.waktuSelesai,

      kebutuhanPC: data.kebutuhanPC,

      kebutuhanKursi: data.kebutuhanKursi,

      status: "terjadwal",

      presensi: null,

      sumber: "pengajuan",

      createdAt:
        pengajuan.diverifikasiPada ||
        pengajuan.createdAt ||
        new Date().toISOString(),
    };
  }

  function ambilSemuaBooking() {
    const daftarBooking = new Map();

    if (Array.isArray(seed.bookings)) {
      seed.bookings.forEach((booking) => {
        if (booking?.id) {
          daftarBooking.set(String(booking.id), salinData(booking));
        }
      });
    }

    const submissions = ambilSemua("submissions");

    submissions.forEach((pengajuan) => {
      if (pengajuan.status !== "disetujui") return;

      const booking = bentukBooking(pengajuan);

      daftarBooking.set(String(booking.id), booking);
    });

    const attendance = ambilSemua("attendance");
    const presensiTerakhir = new Map();

    attendance.forEach((catatan) => {
      if (!catatan.bookingId) return;

      presensiTerakhir.set(String(catatan.bookingId), catatan);
    });

    return Array.from(daftarBooking.values()).map((booking) => {
      const catatan = presensiTerakhir.get(String(booking.id));

      if (!catatan) return booking;

      return {
        ...booking,

        status: catatan.status,

        presensi: {
          status: catatan.status,
          dicatatPada: catatan.dicatatPada,
        },
      };
    });
  }

  // ==========================================
  // 7. PENGAMBILAN SELURUH DATA
  // ==========================================

  function getAll(namaKoleksi) {
    if (namaKoleksi === "bookings") {
      return salinData(ambilSemuaBooking());
    }

    if (["penggunaTergeser", "konflik", "conflicts"].includes(namaKoleksi)) {
      // Ambil kasus individual, bukan kelompok konflik.
      const dataKonflik = ambilSemua("conflicts").filter(
        (item) =>
          !Array.isArray(item.pengajuan) &&
          (item.pengajuanId || item.sourceSubmissionId),
      );

      const dataPengajuan = ambilSemua("submissions").filter((item) =>
        STATUS_TERGESER.has(String(item.status || "").toLowerCase()),
      );

      const gabungan = new Map();

      // Masukkan data kasus terlebih dahulu.
      dataKonflik.forEach((item) => {
        const id = String(item.pengajuanId || item.sourceSubmissionId);

        gabungan.set(id, item);
      });

      // Gabungkan pengajuan asli tanpa menghilangkan
      // informasi tambahan dari kasus tergeser.
      dataPengajuan.forEach((pengajuan) => {
        const id = String(pengajuan.id);
        const kasus = gabungan.get(id) || {};

        const data = {
          ...pengajuan,
          ...kasus,

          id: kasus.id || `CASE-${id}`,
          pengajuanId: id,
          sourceSubmissionId: id,

          namaPemohon:
            kasus.namaPemohon || pengajuan.namaPemohon || pengajuan.nama || "-",

          nipNpm: kasus.nipNpm || pengajuan.nipNpm || "-",

          namaKegiatan: kasus.namaKegiatan || pengajuan.namaKegiatan || "-",

          tanggal: kasus.tanggal || pengajuan.tanggal,

          waktuMulai: kasus.waktuMulai || pengajuan.waktuMulai,

          waktuSelesai: kasus.waktuSelesai || pengajuan.waktuSelesai,

          jadwalAsal:
            kasus.jadwalAsal ||
            ((kasus.tanggal || pengajuan.tanggal) &&
            (kasus.waktuMulai || pengajuan.waktuMulai)
              ? `${kasus.tanggal || pengajuan.tanggal}T${kasus.waktuMulai || pengajuan.waktuMulai}:00+09:00`
              : null),

          alasan:
            kasus.alasan ||
            kasus.alasanTergeser ||
            pengajuan.alasanTergeser ||
            pengajuan.alasan ||
            "Jadwal tergeser akibat keputusan penyelesaian konflik Kepala Lab.",

          namaPenggeser: kasus.namaPenggeser || pengajuan.namaPenggeser || "-",

          kategori: kasus.kategori || pengajuan.kategori || "-",

          prioritas: kasus.prioritas || pengajuan.prioritas || "-",

          kebutuhanPC: kasus.kebutuhanPC ?? pengajuan.kebutuhanPC ?? 0,

          kebutuhanKursi: kasus.kebutuhanKursi ?? pengajuan.kebutuhanKursi ?? 0,

          status: kasus.status || pengajuan.status,
        };

        gabungan.set(id, data);
      });

      return Array.from(gabungan.values()).map(normalisasiPengajuan);
    }

    const data = ambilSemua(namaKoleksi);

    if (namaKoleksi === "antrean" || namaKoleksi === "submissions") {
      return data.map(normalisasiPengajuan);
    }

    return data;
  }

  // ==========================================
  // 8. MENGAMBIL DATA BERDASARKAN ID
  // ==========================================

  function getById(namaKoleksi, id) {
    if (!id) return null;

    const data = getAll(namaKoleksi);

    return data.find((item) => String(item.id) === String(id)) || null;
  }

  // ==========================================
  // 9. MENGAMBIL ANTREAN AKTIF
  // ==========================================

  function getAntreanAktif() {
    const data = getAll("antrean");

    return data.filter((item) =>
      STATUS_ANTREAN_AKTIF.has(String(item.status || "").toLowerCase()),
    );
  }

  // ==========================================
  // 10. VALIDASI KAPASITAS
  // ==========================================

  function ambilKapasitas() {
    const kapasitasDefault = {
      kapasitasPC: 30,
      kapasitasKursi: 30,
    };

    const fasilitas = storage.get(KEYS.FACILITIES, kapasitasDefault);

    if (
      !fasilitas ||
      !Number.isInteger(fasilitas.kapasitasPC) ||
      !Number.isInteger(fasilitas.kapasitasKursi) ||
      fasilitas.kapasitasPC <= 0 ||
      fasilitas.kapasitasKursi <= 0
    ) {
      throw new Error("Konfigurasi kapasitas fasilitas tidak valid.");
    }

    return fasilitas;
  }

  function validasiKapasitas(data) {
    const kapasitas = ambilKapasitas();

    if (
      !Number.isInteger(data.kebutuhanPC) ||
      !Number.isInteger(data.kebutuhanKursi) ||
      data.kebutuhanPC <= 0 ||
      data.kebutuhanKursi <= 0
    ) {
      return {
        valid: false,
        pesan: "Kebutuhan PC dan kursi harus berupa bilangan bulat positif.",
      };
    }

    if (
      data.kebutuhanPC > kapasitas.kapasitasPC ||
      data.kebutuhanKursi > kapasitas.kapasitasKursi
    ) {
      return {
        valid: false,
        pesan: "Kebutuhan fasilitas melebihi kapasitas laboratorium.",
      };
    }

    return {
      valid: true,
      pesan: "Kapasitas fasilitas memenuhi kebutuhan.",
    };
  }

  // ==========================================
  // 11. PEMERIKSAAN BENTROKAN JADWAL
  // ==========================================

  function cekKonflikJadwal(dataBaru, bookingId = null) {
    const data = normalisasiPengajuan(dataBaru);

    const rentangBaru = validasiJadwal(data);

    if (!rentangBaru.valid) {
      return {
        bentrok: false,
        valid: false,
        pesan: rentangBaru.pesan,
        booking: null,
      };
    }

    const bookings = getAll("bookings");

    const bookingBentrok = bookings.find((booking) => {
      if (
        String(booking.id) === String(bookingId) ||
        String(booking.sourceSubmissionId) === String(bookingId)
      ) {
        return false;
      }

      if (
        ["dibatalkan", "ditolak", "tidak_digunakan"].includes(booking.status) ||
        booking.presensi?.status === "tidak_digunakan"
      ) {
        return false;
      }

      if (booking.tanggal !== data.tanggal) {
        return false;
      }

      const rentangLama = waktu.validasiRentang(
        booking.tanggal,
        booking.waktuMulai,
        booking.waktuSelesai,
      );

      if (!rentangLama.valid) return false;

      return (
        rentangBaru.mulai < rentangLama.selesai &&
        rentangBaru.selesai > rentangLama.mulai
      );
    });

    return {
      bentrok: Boolean(bookingBentrok),
      valid: true,

      pesan: bookingBentrok
        ? "Jadwal bertabrakan dengan booking yang sudah ada."
        : "Tidak ditemukan bentrokan jadwal.",

      booking: bookingBentrok || null,
    };
  }

  // ==========================================
  // 12. PERSETUJUAN PENGAJUAN
  // ==========================================

  function setujuiPengajuan(pengajuanId) {
    if (!pengajuanId) {
      throw new Error("ID pengajuan tidak ditemukan.");
    }

    const submissions = ambilSemua("submissions");

    const index = submissions.findIndex(
      (item) => String(item.id) === String(pengajuanId),
    );

    if (index === -1) {
      throw new Error("Pengajuan tidak ditemukan.");
    }

    const pengajuan = submissions[index];

    if (["disetujui", "ditolak"].includes(pengajuan.status)) {
      throw new Error("Pengajuan sudah memiliki keputusan akhir.");
    }

    if (!["verifikasi", "menunggu_verifikasi"].includes(pengajuan.status)) {
      throw new Error("Pengajuan tidak berada dalam status verifikasi.");
    }

    const data = normalisasiPengajuan(pengajuan);

    const rentang = validasiJadwal(data);

    if (!rentang.valid) {
      throw new Error(rentang.pesan);
    }

    const kapasitas = validasiKapasitas(data);

    if (!kapasitas.valid) {
      throw new Error(kapasitas.pesan);
    }

    const konflik = cekKonflikJadwal(data);

    if (konflik.bentrok) {
      throw new Error("Pengajuan tidak dapat disetujui karena jadwal bentrok.");
    }

    const bookings = getAll("bookings");

    const bookingSudahAda = bookings.some(
      (booking) =>
        booking.sourceSubmissionId === pengajuan.id ||
        booking.id === `BOOK-${pengajuan.id}`,
    );

    if (bookingSudahAda) {
      throw new Error("Booking untuk pengajuan ini sudah tersedia.");
    }

    submissions[index] = {
      ...pengajuan,
      status: "disetujui",
      diverifikasiPada: new Date().toISOString(),
    };

    simpanSemua("submissions", submissions);

    beriTahuPerubahan("bookings", "disetujui");
    beriTahuPerubahan("antrean", "disetujui");

    return {
      pengajuan: salinData(submissions[index]),
      booking: salinData(bentukBooking(submissions[index])),
    };
  }

  // ==========================================
  // 13. PENOLAKAN PENGAJUAN
  // ==========================================

  function tolakPengajuan(pengajuanId, alasan = "") {
    if (!pengajuanId) {
      throw new Error("ID pengajuan tidak ditemukan.");
    }

    const alasanPenolakan = String(alasan).trim();

    if (!alasanPenolakan) {
      throw new Error("Alasan penolakan wajib diisi.");
    }

    const submissions = ambilSemua("submissions");

    const index = submissions.findIndex(
      (item) => String(item.id) === String(pengajuanId),
    );

    if (index === -1) {
      throw new Error("Pengajuan tidak ditemukan.");
    }

    const pengajuan = submissions[index];

    if (!["verifikasi", "menunggu_verifikasi"].includes(pengajuan.status)) {
      throw new Error("Pengajuan tidak berada dalam status verifikasi.");
    }

    submissions[index] = {
      ...pengajuan,

      status: "ditolak",

      alasanPenolakan,

      diverifikasiPada: new Date().toISOString(),
    };

    simpanSemua("submissions", submissions);

    beriTahuPerubahan("antrean", "ditolak");
    beriTahuPerubahan("bookings", "ditolak");

    return salinData(submissions[index]);
  }

  // ==========================================
  // 14. UPDATE ANTREAN
  // ==========================================

  function update(namaKoleksi, id, perubahan = {}) {
    if (namaKoleksi !== "antrean" && namaKoleksi !== "submissions") {
      throw new Error("Update hanya tersedia untuk proses pengajuan.");
    }

    if (!perubahan || typeof perubahan !== "object") {
      throw new Error("Data perubahan tidak valid.");
    }

    if (perubahan.status === "disetujui") {
      return setujuiPengajuan(id);
    }

    if (perubahan.status === "ditolak") {
      return tolakPengajuan(
        id,
        perubahan.alasanPenolakan || perubahan.alasan || "",
      );
    }

    throw new Error("Keputusan pengajuan tidak dikenali.");
  }

  // ==========================================
  // 15. PENGELOLAAN PRESENSI
  // ==========================================

  function updatePresensi(bookingId, status) {
    const statusValid = ["digunakan", "tidak_digunakan"];

    if (!statusValid.includes(status)) {
      throw new Error("Status presensi tidak valid.");
    }

    const bookings = getAll("bookings");

    const booking = bookings.find(
      (item) => String(item.id) === String(bookingId),
    );

    if (!booking) {
      throw new Error("Data booking tidak ditemukan.");
    }

    if (
      ["digunakan", "tidak_digunakan"].includes(
        booking.presensi?.status || booking.status,
      )
    ) {
      throw new Error("Presensi booking ini sudah dicatat.");
    }

    const attendance = ambilSemua("attendance");

    const waktuPencatatan = new Date().toISOString();

    const catatanBaru = {
      id: `${bookingId}-${status}`,
      bookingId,
      status,
      dicatatPada: waktuPencatatan,
    };

    const index = attendance.findIndex(
      (item) => String(item.bookingId) === String(bookingId),
    );

    if (index !== -1) {
      attendance[index] = catatanBaru;
    } else {
      attendance.push(catatanBaru);
    }

    simpanSemua("attendance", attendance);

    beriTahuPerubahan("bookings", "presensi");
    beriTahuPerubahan("attendance", "presensi");

    return {
      ...booking,

      status,

      presensi: {
        status,
        dicatatPada: waktuPencatatan,
      },
    };
  }

  // ==========================================
  // 16. REKOMENDASI JADWAL LAMA
  // ==========================================

  function buatIdRekomendasi(data) {
    let nomorTerakhir = 0;

    data.forEach((item) => {
      const cocok = item.id?.match(/^REC-(\d+)$/);

      if (cocok) {
        nomorTerakhir = Math.max(nomorTerakhir, Number(cocok[1]));
      }
    });

    return `REC-${String(nomorTerakhir + 1).padStart(3, "0")}`;
  }

  function buatRekomendasi(data) {
    if (!data || !data.pengajuanId) {
      throw new Error("ID pengajuan untuk rekomendasi wajib tersedia.");
    }

    const pengajuan = getById("submissions", data.pengajuanId);

    if (!pengajuan) {
      throw new Error("Data pengajuan tidak ditemukan.");
    }

    const dataRekomendasi = normalisasiPengajuan({
      ...pengajuan,
      ...data,
    });

    const rentang = validasiJadwal(dataRekomendasi);

    if (!rentang.valid) {
      throw new Error(rentang.pesan);
    }

    const kapasitas = validasiKapasitas(dataRekomendasi);

    if (!kapasitas.valid) {
      throw new Error(kapasitas.pesan);
    }

    const idBookingAsal = data.bookingId || `BOOK-${data.pengajuanId}`;

    const konflik = cekKonflikJadwal(dataRekomendasi, idBookingAsal);

    if (konflik.bentrok) {
      throw new Error(
        "Jadwal rekomendasi masih bertabrakan dengan booking lain.",
      );
    }

    const rekomendasi = ambilSemua("recommendations");

    const rekomendasiBaru = {
      ...dataRekomendasi,

      id: buatIdRekomendasi(rekomendasi),

      pengajuanId: data.pengajuanId,

      bookingId: idBookingAsal,

      status: "menunggu_persetujuan",

      dibuatPada: new Date().toISOString(),

      sumber: "laboran",
    };

    rekomendasi.push(rekomendasiBaru);

    simpanSemua("recommendations", rekomendasi);

    beriTahuPerubahan("recommendations", "dibuat");

    return salinData(rekomendasiBaru);
  }

  function hapusRekomendasi(rekomendasiId) {
    const rekomendasi = ambilSemua("recommendations");

    const index = rekomendasi.findIndex(
      (item) => String(item.id) === String(rekomendasiId),
    );

    if (index === -1) {
      throw new Error("Rekomendasi tidak ditemukan.");
    }

    if (rekomendasi[index].status !== "menunggu_persetujuan") {
      throw new Error("Rekomendasi yang sudah diproses tidak dapat dihapus.");
    }

    rekomendasi.splice(index, 1);

    simpanSemua("recommendations", rekomendasi);

    beriTahuPerubahan("recommendations", "dihapus");

    return true;
  }

  // ==========================================
  // 17. MENGAMBIL REKOMENDASI BERDASARKAN KASUS
  // ==========================================

  function ambilRekomendasiKasus(kasus) {
    const daftar = ambilSemua("recommendations");

    const idKasus = String(kasus.id);
    const idPengajuan = String(kasus.pengajuanId);

    const hasil = daftar.filter((item) =>
      [item.caseId, item.kasusId, item.pengajuanId, item.antreanId].some(
        (id) =>
          id !== undefined &&
          id !== null &&
          (String(id) === idKasus || String(id) === idPengajuan),
      ),
    );

    hasil.sort(
      (a, b) =>
        (Date.parse(b.dikirimPada || b.dibuatPada || b.createdAt) || 0) -
        (Date.parse(a.dikirimPada || a.dibuatPada || a.createdAt) || 0),
    );

    return hasil[0] || null;
  }

  // ==========================================
  // 18. MENGAMBIL KASUS TERGESER BERDASARKAN ID
  // ==========================================

  function getKasusTergeserById(idReferensi) {
    if (!idReferensi) return null;

    const id = String(idReferensi);

    const konflik = ambilSemua("conflicts");

    const submissions = ambilSemua("submissions");

    const dataKonflik = konflik.find((item) =>
      [item.id, item.pengajuanId, item.sourceSubmissionId].some(
        (nilai) => nilai !== undefined && String(nilai) === id,
      ),
    );

    const idPengajuan =
      dataKonflik?.pengajuanId ||
      dataKonflik?.sourceSubmissionId ||
      (id.startsWith("CASE-") ? id.substring(5) : id);

    const pengajuan = submissions.find(
      (item) => String(item.id) === String(idPengajuan),
    );

    if (!pengajuan && !dataKonflik) {
      return null;
    }

    const sumber = {
      ...(pengajuan || {}),
      ...(dataKonflik || {}),
    };

    const kasus = {
      ...sumber,

      id: dataKonflik?.id || `CASE-${idPengajuan}`,

      pengajuanId: idPengajuan,

      sourceSubmissionId: idPengajuan,

      alasan:
        dataKonflik?.alasan ||
        dataKonflik?.alasanTergeser ||
        sumber.alasan ||
        "Pengajuan tergeser oleh prioritas lebih tinggi.",

      namaPenggeser:
        dataKonflik?.namaPenggeser ||
        dataKonflik?.namaPengajuPenggeser ||
        dataKonflik?.namaPemohonPenggeser ||
        sumber.namaPenggeser ||
        "-",

      status: sumber.status || "tergeser",
    };

    const rekomendasi = ambilRekomendasiKasus(kasus);

    const rekomendasiTerbaru = rekomendasi
      ? {
          ...rekomendasi,

          status: STATUS_REKOMENDASI_AKTIF.has(
            String(rekomendasi.status).toLowerCase(),
          )
            ? "rekomendasi_dikirim"
            : rekomendasi.status,
        }
      : null;

    return normalisasiPengajuan({
      ...kasus,

      status: rekomendasiTerbaru?.status || kasus.status,

      rekomendasiTerbaru,
    });
  }

  // ==========================================
  // 19. VALIDASI SLOT REKOMENDASI
  // ==========================================

  function siapkanJadwalRekomendasi(kasus, detail) {
    if (!detail || !detail.waktuMulai || !detail.waktuSelesai) {
      throw new Error("Waktu mulai dan waktu selesai wajib diisi.");
    }

    const mulai = pecahWaktu(detail.waktuMulai);

    const selesai = pecahWaktu(detail.waktuSelesai);

    if (!mulai.jam || !selesai.jam) {
      throw new Error("Format waktu rekomendasi tidak valid.");
    }

    if (!mulai.tanggal || mulai.tanggal !== selesai.tanggal) {
      throw new Error(
        "Jadwal rekomendasi tidak boleh melewati pergantian tanggal.",
      );
    }

    const waktuMulaiTimestamp = Date.parse(
      `${mulai.tanggal}T${mulai.jam}:00+09:00`,
    );

    if (
      !Number.isFinite(waktuMulaiTimestamp) ||
      waktuMulaiTimestamp <= Date.now()
    ) {
      throw new Error("Jadwal rekomendasi harus berada di masa mendatang.");
    }

    const dataJadwal = normalisasiPengajuan({
      ...kasus,

      tanggal: mulai.tanggal,

      tanggalSelesai: selesai.tanggal,

      waktuMulai: mulai.jam,

      waktuSelesai: selesai.jam,
    });

    const rentang = validasiJadwal(dataJadwal);

    if (!rentang.valid) {
      throw new Error(rentang.pesan);
    }

    const kapasitas = validasiKapasitas(kasus);

    if (!kapasitas.valid) {
      throw new Error(kapasitas.pesan);
    }

    const konflikBooking = cekKonflikJadwal(
      dataJadwal,
      `BOOK-${kasus.pengajuanId}`,
    );

    if (konflikBooking.bentrok) {
      throw new Error(
        "Jadwal rekomendasi bertabrakan dengan peminjaman yang sudah terjadwal.",
      );
    }

    return {
      data: dataJadwal,

      mulaiLokal: detail.waktuMulai,

      selesaiLokal: detail.waktuSelesai,

      rentang,
    };
  }


  // ==========================================
  // 19A. VALIDASI MULTI ALTERNATIF JADWAL
  // ==========================================

  function siapkanAlternatifRekomendasi(
    kasus,
    detail,
    rekomendasiId = null
  ) {
    const daftarAlternatif = detail?.alternatifJadwal;

    if (
      !Array.isArray(daftarAlternatif) ||
      daftarAlternatif.length < 1 ||
      daftarAlternatif.length > 2
    ) {
      throw new Error(
        "Rekomendasi harus memiliki satu atau dua alternatif jadwal."
      );
    }

    const hasil = daftarAlternatif.map((alternatif, index) => {
      const jadwal = siapkanJadwalRekomendasi(
        kasus,
        alternatif
      );

      const konflik = cekKonflikRekomendasi(
        jadwal.data,
        kasus.pengajuanId,
        rekomendasiId
      );

      if (konflik) {
        throw new Error(
          `Alternatif ${index + 1} bertabrakan dengan rekomendasi pengguna lain.`
        );
      }

      return {
        ...jadwal.data,

        nomorAlternatif: index + 1,

        mulaiLokal: jadwal.mulaiLokal,

        selesaiLokal: jadwal.selesaiLokal
      };
    });

    // Memastikan kedua alternatif tidak saling bertabrakan.
    if (hasil.length === 2) {
      const pertama = validasiJadwal(hasil[0]);
      const kedua = validasiJadwal(hasil[1]);

      if (
        pertama.mulai < kedua.selesai &&
        pertama.selesai > kedua.mulai
      ) {
        throw new Error(
          "Alternatif pertama dan kedua tidak boleh memiliki waktu yang bertabrakan."
        );
      }
    }

    return hasil;
  }


  // ==========================================
  // 20. PEMERIKSAAN BENTROKAN REKOMENDASI
  // ==========================================

  function cekKonflikRekomendasi(dataBaru, pengajuanId, rekomendasiId = null) {
    const daftar = ambilSemua("recommendations");

    const rentangBaru = validasiJadwal(dataBaru);

    if (!rentangBaru.valid) {
      return null;
    }

    return (
      daftar.find((item) => {
        if (String(item.id) === String(rekomendasiId)) {
          return false;
        }

        if (String(item.pengajuanId) === String(pengajuanId)) {
          return false;
        }

        if (
          !STATUS_REKOMENDASI_AKTIF.has(String(item.status || "").toLowerCase())
        ) {
          return false;
        }

        const rekomendasiLama = normalisasiPengajuan(item);

        if (rekomendasiLama.tanggal !== dataBaru.tanggal) {
          return false;
        }

        const rentangLama = validasiJadwal(rekomendasiLama);

        if (!rentangLama.valid) {
          return false;
        }

        return (
          rentangBaru.mulai < rentangLama.selesai &&
          rentangBaru.selesai > rentangLama.mulai
        );
      }) || null
    );
  }

  // ==========================================
  // 21. BATAS KONFIRMASI REKOMENDASI
  // ==========================================

  function ambilBatasRekomendasi(rekomendasi) {
    const batas =
      rekomendasi.kedaluwarsaPada ||
      rekomendasi.expiresAt ||
      rekomendasi.batasRespons;

    if (batas) {
      const timestamp = Date.parse(batas);

      if (Number.isFinite(timestamp)) {
        return timestamp;
      }
    }

    const dibuat = Date.parse(
      rekomendasi.dikirimPada ||
        rekomendasi.dibuatPada ||
        rekomendasi.createdAt ||
        "",
    );

    return Number.isFinite(dibuat) ? dibuat + BATAS_KONFIRMASI : NaN;
  }

  // ==========================================
  // 22. UPDATE METADATA KONFLIK
  // ==========================================

  function perbaruiMetadataRekomendasi(kasus, rekomendasi) {
    const konflik = ambilSemua("conflicts");

    const index = konflik.findIndex(
      (item) =>
        String(item.pengajuanId || item.sourceSubmissionId || item.id) ===
        String(kasus.pengajuanId),
    );

    if (index === -1) return;

    konflik[index] = {
      ...konflik[index],

      rekomendasiId: rekomendasi.id,

      rekomendasiStatus: rekomendasi.status,

      rekomendasiDikirimPada: rekomendasi.dikirimPada,

      kedaluwarsaPada: rekomendasi.kedaluwarsaPada,
    };

    simpanSemua("conflicts", konflik);
  }

  
  // ==========================================
  // 23. MENGIRIM REKOMENDASI MULTI ALTERNATIF
  // ==========================================

  function kirimRekomendasi(idKasus, detail) {
    if (!idKasus) {
      throw new Error("ID kasus tidak ditemukan.");
    }

    const kasus = getKasusTergeserById(idKasus);

    if (!kasus) {
      throw new Error("Data kasus tergeser tidak ditemukan.");
    }

    const rekomendasiLama = ambilRekomendasiKasus(kasus);

    if (
      rekomendasiLama &&
      STATUS_REKOMENDASI_AKTIF.has(
        String(rekomendasiLama.status).toLowerCase()
      )
    ) {
      throw new Error(
        "Kasus ini sudah memiliki rekomendasi aktif."
      );
    }

    const statusKasus = String(
      kasus.status || ""
    ).toLowerCase();

    if (
      statusKasus &&
      !STATUS_TERGESER.has(statusKasus)
    ) {
      throw new Error(
        "Kasus tidak lagi berada dalam status tergeser."
      );
    }

    // Validasi seluruh alternatif.
    const alternatif = siapkanAlternatifRekomendasi(
      kasus,
      detail
    );

    const alternatifUtama = alternatif[0];

    const daftar = ambilSemua("recommendations");

    const sekarang = new Date();

    const waktuDikirim = sekarang.toISOString();

    const kedaluwarsa = new Date(
      sekarang.getTime() + BATAS_KONFIRMASI
    ).toISOString();

    const rekomendasiBaru = {
      // Data utama mengikuti alternatif pertama
      // untuk menjaga kompatibilitas modul lama.
      ...alternatifUtama,

      id: buatIdRekomendasi(daftar),

      caseId: kasus.id,

      kasusId: kasus.id,

      pengajuanId: kasus.pengajuanId,

      antreanId: kasus.pengajuanId,

      bookingId: `BOOK-${kasus.pengajuanId}`,

      // Menyimpan seluruh pilihan jadwal.
      alternatifJadwal: alternatif,

      jumlahAlternatif: alternatif.length,

      catatan: String(
        detail.catatan || ""
      ).trim(),

      status: "rekomendasi_dikirim",

      dibuatPada: waktuDikirim,

      dikirimPada: waktuDikirim,

      kedaluwarsaPada: kedaluwarsa,

      expiresAt: kedaluwarsa,

      batasRespons: kedaluwarsa,

      sumber: "laboran"
    };

    daftar.push(rekomendasiBaru);

    simpanSemua("recommendations", daftar);

    perbaruiMetadataRekomendasi(
      kasus,
      rekomendasiBaru
    );

    beriTahuPerubahan("recommendations", "dikirim");

    beriTahuPerubahan("antrean", "rekomendasi_dikirim");

    beriTahuPerubahan("conflicts", "rekomendasi_dikirim");

    beriTahuPerubahan("penggunaTergeser", "rekomendasi_dikirim");

    return {
      ...getKasusTergeserById(kasus.id),

      success: true,

      rekomendasiTerbaru: salinData(rekomendasiBaru),

      status: "rekomendasi_dikirim"
    };
  }


  // ==========================================
  // 24. EDIT REKOMENDASI MULTI ALTERNATIF
  // ==========================================

  function editRekomendasi(idKasus, detail) {
    const kasus = getKasusTergeserById(idKasus);

    if (!kasus) {
      throw new Error(
        "Data kasus tergeser tidak ditemukan."
      );
    }

    const rekomendasiLama = ambilRekomendasiKasus(kasus);

    if (!rekomendasiLama) {
      throw new Error(
        "Rekomendasi yang akan diedit tidak ditemukan."
      );
    }

    if (
      !STATUS_REKOMENDASI_AKTIF.has(
        String(rekomendasiLama.status).toLowerCase()
      )
    ) {
      throw new Error(
        "Rekomendasi sudah tidak dapat diedit."
      );
    }

    // Memeriksa batas konfirmasi 24 jam.
    const batas = ambilBatasRekomendasi(
      rekomendasiLama
    );

    if (
      !Number.isFinite(batas) ||
      Date.now() >= batas
    ) {
      throw new Error(
        "Batas waktu edit rekomendasi 24 jam sudah berakhir."
      );
    }

    // Validasi ulang seluruh alternatif.
    const alternatif = siapkanAlternatifRekomendasi(
      kasus,
      detail,
      rekomendasiLama.id
    );

    const alternatifUtama = alternatif[0];

    const daftar = ambilSemua("recommendations");

    const index = daftar.findIndex(
      item =>
        String(item.id) === String(rekomendasiLama.id)
    );

    if (index === -1) {
      throw new Error(
        "Data rekomendasi tidak ditemukan dalam penyimpanan."
      );
    }

    const diperbaruiPada = new Date().toISOString();

    const rekomendasiBaru = {
      ...daftar[index],

      // Data utama tetap menggunakan alternatif pertama.
      ...alternatifUtama,

      // Memperbarui seluruh pilihan.
      alternatifJadwal: alternatif,

      jumlahAlternatif: alternatif.length,

      catatan: String(
        detail.catatan || ""
      ).trim(),

      status: "rekomendasi_dikirim",

      diperbaruiPada,

      // ID, waktu pengiriman, dan batas konfirmasi tetap.
      id: rekomendasiLama.id,

      dikirimPada: rekomendasiLama.dikirimPada,

      kedaluwarsaPada:
        rekomendasiLama.kedaluwarsaPada ||
        rekomendasiLama.expiresAt ||
        rekomendasiLama.batasRespons,

      expiresAt:
        rekomendasiLama.expiresAt ||
        rekomendasiLama.kedaluwarsaPada,

      batasRespons:
        rekomendasiLama.batasRespons ||
        rekomendasiLama.kedaluwarsaPada
    };

    daftar[index] = rekomendasiBaru;

    simpanSemua("recommendations", daftar);

    perbaruiMetadataRekomendasi(
      kasus,
      rekomendasiBaru
    );

    beriTahuPerubahan("recommendations", "diedit");

    beriTahuPerubahan("conflicts", "rekomendasi_diedit");

    beriTahuPerubahan("penggunaTergeser", "rekomendasi_diedit");

    return {
      ...getKasusTergeserById(kasus.id),

      success: true,

      rekomendasiTerbaru: salinData(rekomendasiBaru),

      status: "rekomendasi_dikirim"
    };
  }


  // ==========================================
  // 25. PENGELOLAAN KONFLIK KEPALA LAB
  // ==========================================

  function kirimKonflik(pengajuanIds) {
    if (!Array.isArray(pengajuanIds) || pengajuanIds.length < 2) {
      throw new Error(
        "Minimal dua pengajuan diperlukan untuk membentuk konflik.",
      );
    }

    const submissions = ambilSemua("submissions");

    const daftarPengajuan = submissions.filter((item) =>
      pengajuanIds.map(String).includes(String(item.id)),
    );

    if (daftarPengajuan.length !== pengajuanIds.length) {
      throw new Error("Sebagian pengajuan tidak ditemukan.");
    }

    const tanggal = daftarPengajuan[0].tanggal;

    if (
      daftarPengajuan.some(
        (item) =>
          item.tanggal !== tanggal ||
          !["bentrok", "verifikasi", "menunggu_verifikasi"].includes(
            item.status,
          ),
      )
    ) {
      throw new Error(
        "Pengajuan tidak memenuhi syarat untuk dikirim sebagai konflik.",
      );
    }

    const konflik = ambilSemua("conflicts");

    // Cegah pengiriman kelompok yang sama berulang kali.
    const sudahAda = konflik.some(
      (group) =>
        group.status === "menunggu_keputusan" &&
        pengajuanIds.every((id) =>
          group.pengajuan.some((item) => String(item.id) === String(id)),
        ) &&
        group.pengajuan.length === pengajuanIds.length,
    );

    if (sudahAda) {
      throw new Error("Kelompok konflik ini sudah pernah dikirim.");
    }

    const idKonflik = "CONFLICT-" + Date.now();

    const groupBaru = {
      id: idKonflik,
      tanggal,
      status: "menunggu_keputusan",
      dibuatPada: new Date().toISOString(),

      pengajuan: daftarPengajuan.map((item) => ({
        ...item,

        // Alias agar cocok dengan tampilan Kepala Lab.
        pemohon: item.namaPemohon || item.pemohon || "-",
        mulai: item.mulai || item.waktuMulai,
        selesai: item.selesai || item.waktuSelesai,
      })),
    };

    konflik.push(groupBaru);

    simpanSemua("conflicts", konflik);

    beriTahuPerubahan("conflicts", "konflik_dikirim");

    return salinData(groupBaru);
  }
  function getKonflik() {
    return ambilSemua("conflicts");
  }

  function putuskanKonflik(idKonflik, selectedId) {
    const konflik = ambilSemua("conflicts");

    const index = konflik.findIndex(
      (item) => String(item.id) === String(idKonflik),
    );

    if (index === -1) {
      throw new Error("Kelompok konflik tidak ditemukan.");
    }

    const group = konflik[index];

    if (group.status !== "menunggu_keputusan") {
      throw new Error("Konflik sudah diputuskan.");
    }

    const terpilih = group.pengajuan.find(
      (item) => String(item.id) === String(selectedId),
    );

    if (!terpilih) {
      throw new Error("Pengajuan pilihan tidak ditemukan.");
    }

    const submissions = ambilSemua("submissions");

    const semuaTersedia = group.pengajuan.every((item) =>
      submissions.some(
        (submission) => String(submission.id) === String(item.id),
      ),
    );

    if (!semuaTersedia) {
      throw new Error(
        "Data pengajuan berubah. Keputusan tidak dapat disimpan.",
      );
    }

    const displaced = [];

    const submissionsBaru = submissions.map((item) => {
      const anggota = group.pengajuan.find(
        (pengajuan) => String(pengajuan.id) === String(item.id),
      );

      if (!anggota) return item;

      if (String(item.id) === String(selectedId)) {
        return {
          ...item,
          status: "disetujui",
          keputusanKonflik: idKonflik,
          diputuskanPada: new Date().toISOString(),
        };
      }

      displaced.push(item.id);

      return {
        ...item,
        status: "tergeser",
        keputusanKonflik: idKonflik,
        diputuskanPada: new Date().toISOString(),
      };
    });

    // Simpan pengajuan asli.
    simpanSemua("submissions", submissionsBaru);

    // Perbarui kelompok konflik.
    group.status = "selesai";
    group.pengajuanTerpilih = selectedId;
    group.diputuskanPada = new Date().toISOString();
    group.pengajuan.forEach((item) => {
      item.status =
        String(item.id) === String(selectedId) ? "disetujui" : "tergeser";
    });

    konflik[index] = group;

    // Cari pengajuan yang dipilih sebagai penggeser.
    const pengajuanTerpilih = submissionsBaru.find(
      (item) => String(item.id) === String(selectedId),
    );

    const namaPenggeser =
      pengajuanTerpilih?.pemohon ||
      pengajuanTerpilih?.namaPemohon ||
      pengajuanTerpilih?.nama ||
      "-";

    // Buat kasus rekomendasi untuk setiap pengajuan tergeser.
    displaced.forEach((idPengajuan) => {
      const pengajuan = submissionsBaru.find(
        (item) => String(item.id) === String(idPengajuan),
      );

      if (!pengajuan) return;

      // Cegah kasus rekomendasi ganda.
      const sudahAda = konflik.some(
        (item) =>
          String(item.pengajuanId) === String(idPengajuan) &&
          item.jenis === "kasus_tergeser",
      );

      if (sudahAda) return;

      const data = normalisasiPengajuan(pengajuan);

      konflik.push({
        id: `CASE-${idPengajuan}`,
        jenis: "kasus_tergeser",

        pengajuanId: idPengajuan,
        sourceSubmissionId: idPengajuan,

        conflictId: idKonflik,

        namaPemohon: data.namaPemohon,
        nipNpm: data.nipNpm,
        namaKegiatan: data.namaKegiatan,

        kategori: data.kategori || "-",
        prioritas: data.prioritas || "-",

        tanggal: data.tanggal,
        waktuMulai: data.waktuMulai,
        waktuSelesai: data.waktuSelesai,

        jadwalAsal: `${data.tanggal}T${data.waktuMulai}:00+09:00`,

        kebutuhanPC: data.kebutuhanPC,
        kebutuhanKursi: data.kebutuhanKursi,

        alasan:
          "Jadwal tergeser akibat keputusan penyelesaian konflik Kepala Lab.",

        pengajuanPenggeserId: selectedId,
        namaPenggeser,

        status: "menunggu_rekomendasi",

        dibuatPada: new Date().toISOString(),
      });
    });

    // Simpan kelompok konflik dan kasus yang tergeser.
    simpanSemua("conflicts", konflik);

    // Beritahu seluruh modul bahwa data berubah.
    beriTahuPerubahan("submissions", "keputusan_konflik");
    beriTahuPerubahan("conflicts", "keputusan_konflik");
    beriTahuPerubahan("penggunaTergeser", "kasus_tergeser");

    return {
      berhasil: true,
      pesan: "Keputusan konflik dan kasus tergeser berhasil disimpan.",
      terpilih: selectedId,
      tergeser: displaced,
    };

    beriTahuPerubahan("submissions", "keputusan_konflik");
    beriTahuPerubahan("conflicts", "keputusan_konflik");

    return {
      berhasil: true,
      pesan: "Keputusan konflik berhasil disimpan.",
      terpilih: selectedId,
      tergeser: displaced,
    };
  }

  // ==========================================
  // 26. EKSPOR LAYANAN SILAB
  // ==========================================

  window.SILABService = Object.freeze({
    // Pengambilan data
    getAll,
    getById,
    getAntreanAktif,

    // Pengelolaan pengajuan
    update,
    setujuiPengajuan,
    tolakPengajuan,

    // Validasi jadwal dan kapasitas
    validasiJadwal,
    validasiKapasitas,
    cekKonflikJadwal,

    // Booking dan presensi
    updatePresensi,

    // Rekomendasi
    buatRekomendasi,
    hapusRekomendasi,
    getKasusTergeserById,
    kirimRekomendasi,
    editRekomendasi,
    ambilRekomendasiKasus,

    // Konflik Kepala Lab
    kirimKonflik,
    getKonflik,
    putuskanKonflik,

    // Inisialisasi
    inisialisasiData,
  });
})(window);
