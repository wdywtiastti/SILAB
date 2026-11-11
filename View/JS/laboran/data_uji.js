
/**
 * DATA UJI SILAB
 * Menyediakan data simulasi untuk seluruh modul Laboran.
 * Digunakan sementara sebelum backend PHP tersedia.
 */

(function (window) {
    "use strict";

    // Memastikan utilitas waktu tersedia.
    if (!window.SILABWaktu?.tanggalHariIni) {
        console.error(
            "SILAB: waktu.js harus dimuat sebelum data_uji.js."
        );
        return;
    }

    // Mengambil tanggal berdasarkan waktu perangkat.
    const tanggalHariIni =
        window.SILABWaktu.tanggalHariIni();

    const daftarHari = [
        "Minggu",
        "Senin",
        "Selasa",
        "Rabu",
        "Kamis",
        "Jumat",
        "Sabtu"
    ];

    // Mengambil nama hari berdasarkan tanggal.
    function ambilNamaHari(tanggal) {
        const [tahun, bulan, hari] =
            tanggal.split("-").map(Number);

        const objekTanggal = new Date(
            tahun,
            bulan - 1,
            hari
        );

        return daftarHari[objekTanggal.getDay()];
    }

    const hariIni = ambilNamaHari(tanggalHariIni);

    // ID booking mengikuti tanggal agar tidak bertabrakan
    // dengan data booking dari hari sebelumnya.
    const tanggalId = tanggalHariIni.replaceAll("-", "");

    // Data jadwal peminjaman laboratorium.
    const bookings = [
        {
            id: `BOOK-${tanggalId}-001`,
            userId: "USR-001",
            namaPemohon: "Syaiful Anwar",
            nipNpm: "0702221001",
            namaKegiatan: "Dasar Pemrograman",
            kategori: "K1",
            jenisKegiatan: "Kuliah Pengganti",
            dosen: "Syaiful Anwar, M.Cs.",
            tanggal: tanggalHariIni,
            waktuMulai: "08:00",
            waktuSelesai: "10:30",
            kebutuhanPC: 36,
            kebutuhanKursi: 36,
            status: "terjadwal",
            presensi: null,
            sumber: "simulasi"
        },
        {
            id: `BOOK-${tanggalId}-002`,
            userId: "USR-002",
            namaPemohon: "HMTI",
            nipNpm: "ORMAWA-HMTI",
            namaKegiatan: "KBA Pemrograman Terstruktur",
            kategori: "K1",
            jenisKegiatan: "HMTI",
            dosen: "Yasir Muin, S.T., M.Kom.",
            tanggal: tanggalHariIni,
            waktuMulai: "10:30",
            waktuSelesai: "12:00",
            kebutuhanPC: 36,
            kebutuhanKursi: 36,
            status: "terjadwal",
            presensi: null,
            sumber: "simulasi"
        },
        {
            id: `BOOK-${tanggalId}-003`,
            userId: "USR-003",
            namaPemohon: "Ir. Salkin Luthfi",
            nipNpm: "197804122005011003",
            namaKegiatan: "Kelas Pengganti Pemrograman Web",
            kategori: "K2",
            jenisKegiatan: "Kuliah Pengganti",
            dosen: "Ir. Salkin Luthfi, S.T., M.Kom.",
            tanggal: tanggalHariIni,
            waktuMulai: "13:00",
            waktuSelesai: "15:30",
            kebutuhanPC: 36,
            kebutuhanKursi: 36,
            status: "terjadwal",
            presensi: null,
            sumber: "simulasi"
        },
        {
            id: `BOOK-${tanggalId}-004`,
            userId: "USR-004",
            namaPemohon: "Yasir Muin",
            nipNpm: "197804122005011004",
            namaKegiatan: "Pemrograman Mobile / RPL Lanjut",
            kategori: "K4",
            jenisKegiatan: "Asistensi/Responsi",
            dosen: "Yasir Muin, S.T., M.Kom.",
            tanggal: tanggalHariIni,
            waktuMulai: "16:00",
            waktuSelesai: "18:00",
            kebutuhanPC: 20,
            kebutuhanKursi: 20,
            status: "terjadwal",
            presensi: null,
            sumber: "simulasi"
        },
        {
            id: `BOOK-${tanggalId}-005`,
            userId: "USR-005",
            namaPemohon: "Muthia Sangadji",
            nipNpm: "0702221045",
            namaKegiatan: "Riset Mandiri & Skripsi",
            kategori: "K5",
            jenisKegiatan: "Belajar Mandiri",
            dosen: "Muthia Sangadji",
            tanggal: tanggalHariIni,
            waktuMulai: "19:00",
            waktuSelesai: "21:00",
            kebutuhanPC: 1,
            kebutuhanKursi: 1,
            status: "terjadwal",
            presensi: null,
            sumber: "simulasi"
        }
    ];

    // Seluruh data pengajuan simulasi.
    // Total 8 pengajuan dengan ID unik.
    const antrean = [
        {
            id: "REQ-UJI-101",
            namaKegiatan: "Matakuliah Pengganti (Pemrograman Web)",
            namaPemohon: "Dr. Hendra",
            nipNpm: "0702221001",
            jumlahPeserta: 35,
            hari: hariIni,
            tanggal: tanggalHariIni,
            waktuMulai: "08:00",
            waktuSelesai: "10:30",
            kategori: "K1",
            prioritas: "P1",
            skor: 96.25,
            status: "bentrok",
            kebutuhanPC: 35,
            kebutuhanKursi: 35,
            pengajuanPenggeserId: null,
            sumber: "simulasi",
            arsip: false
        },
        {
            id: "REQ-UJI-102",
            namaKegiatan: "Rapat Asisten Lab RPL (Persiapan Modul)",
            namaPemohon: "Sarah Amelia",
            nipNpm: "0702221012",
            jumlahPeserta: 12,
            hari: hariIni,
            tanggal: tanggalHariIni,
            waktuMulai: "10:00",
            waktuSelesai: "12:00",
            kategori: "K2",
            prioritas: "P2",
            skor: 76.50,
            status: "verifikasi",
            kebutuhanPC: 12,
            kebutuhanKursi: 12,
            pengajuanPenggeserId: null,
            sumber: "simulasi",
            arsip: false
        },
        {
            id: "REQ-UJI-103",
            namaKegiatan: "Belajar Mandiri (Riset Skripsi AI)",
            namaPemohon: "Fajar R.",
            nipNpm: "0702221002",
            jumlahPeserta: 2,
            hari: hariIni,
            tanggal: tanggalHariIni,
            waktuMulai: "13:00",
            waktuSelesai: "15:30",
            kategori: "K5",
            prioritas: "P3",
            skor: 49.50,
            status: "tergeser",
            kebutuhanPC: 1,
            kebutuhanKursi: 2,
            pengajuanPenggeserId: null,
            alasanTergeser:
                "Jadwal tergeser akibat pengajuan dengan prioritas lebih tinggi.",
            sumber: "simulasi",
            arsip: false
        },
        {
            id: "REQ-UJI-104",
            namaKegiatan: "Matakuliah Pengganti (Grafika Komputer)",
            namaPemohon: "Ibu Rina",
            nipNpm: "0702221013",
            jumlahPeserta: 30,
            hari: hariIni,
            tanggal: tanggalHariIni,
            waktuMulai: "08:00",
            waktuSelesai: "10:30",
            kategori: "K1",
            prioritas: "P1",
            skor: 89.00,
            status: "bentrok",
            kebutuhanPC: 30,
            kebutuhanKursi: 30,
            pengajuanPenggeserId: null,
            sumber: "simulasi",
            arsip: false
        },
        {
            id: "REQ-UJI-105",
            namaKegiatan: "Rapat Asisten Lab (Pelatihan Asisten Baru)",
            namaPemohon: "Budi Santoso",
            nipNpm: "0702221014",
            jumlahPeserta: 8,
            hari: hariIni,
            tanggal: tanggalHariIni,
            waktuMulai: "15:30",
            waktuSelesai: "17:30",
            kategori: "K2",
            prioritas: "P2",
            skor: 71.00,
            status: "verifikasi",
            kebutuhanPC: 8,
            kebutuhanKursi: 8,
            pengajuanPenggeserId: null,
            sumber: "simulasi",
            arsip: false
        },
        {
            id: "REQ-UJI-106",
            namaKegiatan: "Belajar Mandiri (Tugas Kelompok Jaringan)",
            namaPemohon: "Kevin",
            nipNpm: "0702221015",
            jumlahPeserta: 4,
            hari: hariIni,
            tanggal: tanggalHariIni,
            waktuMulai: "15:00",
            waktuSelesai: "17:00",
            kategori: "K5",
            prioritas: "P3",
            skor: 46.00,
            status: "verifikasi",
            kebutuhanPC: 2,
            kebutuhanKursi: 4,
            pengajuanPenggeserId: null,
            sumber: "simulasi",
            arsip: false
        },
        {
            id: "REQ-UJI-107",
            namaKegiatan: "Pengerjaan Tugas Akhir dan Penelitian",
            namaPemohon: "Rizky Pratama",
            nipNpm: "0702221012",
            jumlahPeserta: 3,
            hari: hariIni,
            tanggal: tanggalHariIni,
            waktuMulai: "13:00",
            waktuSelesai: "15:30",
            kategori: "K5",
            prioritas: "P3",
            skor: 47.50,
            status: "tergeser",
            kebutuhanPC: 2,
            kebutuhanKursi: 3,
            pengajuanPenggeserId: null,
            alasanTergeser:
                "Jadwal tergeser akibat pengajuan dengan prioritas lebih tinggi.",
            sumber: "simulasi",
            arsip: false
        },
        {
            id: "REQ-UJI-108",
            namaKegiatan: "Belajar Mandiri (Tugas Desain UI/UX)",
            namaPemohon: "Nadia Putri",
            nipNpm: "0702221016",
            jumlahPeserta: 3,
            hari: hariIni,
            tanggal: tanggalHariIni,
            waktuMulai: "17:30",
            waktuSelesai: "19:00",
            kategori: "K5",
            prioritas: "P3",
            skor: 48.50,
            status: "verifikasi",
            kebutuhanPC: 2,
            kebutuhanKursi: 3,
            pengajuanPenggeserId: null,
            sumber: "simulasi",
            arsip: false
        }
    ];

    // Dua kasus tergeser yang terhubung dengan pengajuan aslinya.
    const penggunaTergeser = [
        {
            id: "CASE-REQ-UJI-103",
            pengajuanId: "REQ-UJI-103",
            pengajuanPenggeserId: null,
            alasan:
                "Jadwal tergeser akibat pengajuan dengan prioritas lebih tinggi.",
            status: "menunggu_rekomendasi",
            dibuatPada: new Date().toISOString(),
            arsip: false,
            sumber: "simulasi"
        },
        {
            id: "CASE-REQ-UJI-107",
            pengajuanId: "REQ-UJI-107",
            pengajuanPenggeserId: null,
            alasan:
                "Jadwal tergeser akibat pengajuan dengan prioritas lebih tinggi.",
            status: "menunggu_rekomendasi",
            dibuatPada: new Date().toISOString(),
            arsip: false,
            sumber: "simulasi"
        }
    ];

    // Data rekomendasi awal masih kosong.
    const rekomendasi = [];

    // Menyediakan satu sumber data awal untuk Laboran.
    window.SILAB_DATA_SEED = {
        bookings,
        antrean,
        penggunaTergeser,
        rekomendasi
    };

    console.log("SILAB: Data simulasi berhasil disiapkan.", {
        tanggal: tanggalHariIni,
        bookings: bookings.length,
        antrean: antrean.length,
        penggunaTergeser: penggunaTergeser.length
    });

})(window);
