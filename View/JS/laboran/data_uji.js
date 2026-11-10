
/**
 * DATA UJI SILAB
 * Menyediakan data simulasi untuk seluruh modul Laboran.
 * Digunakan sementara sebelum backend PHP tersedia.
 */

(function (window) {
    "use strict";

    // Memastikan utilitas waktu sudah tersedia.
    if (!window.SILABWaktu?.tanggalHariIni) {
        console.error(
            "SILAB: waktu.js harus dimuat sebelum data_uji.js."
        );
        return;
    }

    // Menggunakan satu sumber waktu untuk seluruh modul.
    const tanggal = window.SILABWaktu.tanggalHariIni();

    // Data jadwal peminjaman laboratorium.
    const bookings = [
        {
            id: "BOOK-001",
            userId: "USR-001",
            namaPemohon: "Syaiful Anwar",
            nipNpm: "0702221001",
            namaKegiatan: "Dasar Pemrograman",
            kategori: "K1",
            jenisKegiatan: "Kuliah Pengganti",
            dosen: "Syaiful Anwar, M.Cs.",
            tanggal,
            waktuMulai: "08:00",
            waktuSelesai: "10:30",
            kebutuhanPC: 36,
            kebutuhanKursi: 36,
            status: "terjadwal",
            presensi: null
        },
        {
            id: "BOOK-002",
            userId: "USR-002",
            namaPemohon: "HMTI",
            nipNpm: "ORMAWA-HMTI",
            namaKegiatan: "KBA Pemrograman Terstruktur",
            kategori: "K1",
            jenisKegiatan: "HMTI",
            dosen: "Yasir Muin, S.T., M.Kom.",
            tanggal,
            waktuMulai: "10:30",
            waktuSelesai: "12:00",
            kebutuhanPC: 36,
            kebutuhanKursi: 36,
            status: "terjadwal",
            presensi: null
        },
        {
            id: "BOOK-003",
            userId: "USR-003",
            namaPemohon: "Ir. Salkin Luthfi",
            nipNpm: "197804122005011003",
            namaKegiatan: "Kelas Pengganti Pemrograman Web",
            kategori: "K2",
            jenisKegiatan: "Kuliah Pengganti",
            dosen: "Ir. Salkin Luthfi, S.T., M.Kom.",
            tanggal,
            waktuMulai: "13:00",
            waktuSelesai: "15:30",
            kebutuhanPC: 36,
            kebutuhanKursi: 36,
            status: "terjadwal",
            presensi: null
        },
        {
            id: "BOOK-004",
            userId: "USR-004",
            namaPemohon: "Yasir Muin",
            nipNpm: "197804122005011004",
            namaKegiatan: "Pemrograman Mobile / RPL Lanjut",
            kategori: "K4",
            jenisKegiatan: "Asistensi/Responsi",
            dosen: "Yasir Muin, S.T., M.Kom.",
            tanggal,
            waktuMulai: "16:00",
            waktuSelesai: "18:00",
            kebutuhanPC: 20,
            kebutuhanKursi: 20,
            status: "terjadwal",
            presensi: null
        },
        {
            id: "BOOK-005",
            userId: "USR-005",
            namaPemohon: "Muthia Sangadji",
            nipNpm: "0702221045",
            namaKegiatan: "Riset Mandiri & Skripsi",
            kategori: "K5",
            jenisKegiatan: "Belajar Mandiri",
            dosen: "Muthia Sangadji",
            tanggal,
            waktuMulai: "19:00",
            waktuSelesai: "21:00",
            kebutuhanPC: 1,
            kebutuhanKursi: 1,
            status: "terjadwal",
            presensi: null
        }
    ];

    // Data pengajuan yang masuk ke antrean Laboran.
    const antrean = [
        {
            id: "REQ-101",
            namaKegiatan: "Matakuliah Pengganti (Pemrograman Web)",
            namaPemohon: "Dr. Hendra",
            nipNpm: "0702221001",
            jumlahPeserta: 35,
            hari: "Kamis",
            waktuMulai: "08:00",
            waktuSelesai: "10:30",
            kategori: "K1",
            prioritas: "P1",
            skor: 96.25,
            status: "bentrok",
            kebutuhanPC: 35,
            kebutuhanKursi: 35
        },
        {
            id: "REQ-102",
            namaKegiatan: "Rapat Asisten Lab RPL (Persiapan Modul)",
            namaPemohon: "Sarah Amelia",
            nipNpm: "0702221012",
            jumlahPeserta: 12,
            hari: "Rabu",
            waktuMulai: "10:00",
            waktuSelesai: "12:00",
            kategori: "K2",
            prioritas: "P2",
            skor: 76.50,
            status: "verifikasi",
            kebutuhanPC: 12,
            kebutuhanKursi: 12
        },
        {
            id: "REQ-103",
            namaKegiatan: "Belajar Mandiri (Riset Skripsi AI)",
            namaPemohon: "Fajar R.",
            nipNpm: "0702221002",
            jumlahPeserta: 2,
            hari: "Selasa",
            waktuMulai: "13:00",
            waktuSelesai: "15:30",
            kategori: "K5",
            prioritas: "P3",
            skor: 49.50,
            status: "tergeser",
            kebutuhanPC: 1,
            kebutuhanKursi: 2
        },
        {
            id: "REQ-104",
            namaKegiatan: "Matakuliah Pengganti (Grafika Komputer)",
            namaPemohon: "Ibu Rina",
            nipNpm: "0702221013",
            jumlahPeserta: 30,
            hari: "Kamis",
            waktuMulai: "08:00",
            waktuSelesai: "10:30",
            kategori: "K1",
            prioritas: "P1",
            skor: 89.00,
            status: "bentrok",
            kebutuhanPC: 30,
            kebutuhanKursi: 30
        },
        {
            id: "REQ-105",
            namaKegiatan: "Rapat Asisten Lab (Pelatihan Asisten Baru)",
            namaPemohon: "Budi Santoso",
            nipNpm: "0702221014",
            jumlahPeserta: 8,
            hari: "Jumat",
            waktuMulai: "15:30",
            waktuSelesai: "17:30",
            kategori: "K2",
            prioritas: "P2",
            skor: 71.00,
            status: "verifikasi",
            kebutuhanPC: 8,
            kebutuhanKursi: 8
        },
        {
            id: "REQ-106",
            namaKegiatan: "Belajar Mandiri (Tugas Kelompok Jaringan)",
            namaPemohon: "Kevin",
            nipNpm: "0702221015",
            jumlahPeserta: 4,
            hari: "Kamis",
            waktuMulai: "15:00",
            waktuSelesai: "17:00",
            kategori: "K5",
            prioritas: "P3",
            skor: 46.00,
            status: "verifikasi",
            kebutuhanPC: 2,
            kebutuhanKursi: 4
        }
    ];

    // Data pengguna yang jadwal peminjamannya tergeser.
    const penggunaTergeser = [
        {
            id: "CASE-001",
            namaPemohon: "Djuleha M. Asyik",
            nipNpm: "07352411038",
            namaKegiatan: "Pengerjaan Skripsi Akhir",
            kategori: "K5",
            prioritas: "P5",
            jadwalAsal: "2026-10-21T13:00:00+09:00",
            alasan: "Tergeser oleh pengajuan prioritas lebih tinggi",
            namaPenggeser: "Yasir Muin, S.T., M.Kom.",
            kebutuhanPC: 1,
            kebutuhanKursi: 1,
            status: "menunggu_rekomendasi"
        },
        {
            id: "CASE-002",
            namaPemohon: "Rizky Pratama",
            nipNpm: "0702221012",
            namaKegiatan: "Pengerjaan Tugas Akhir IoT",
            kategori: "K5",
            prioritas: "P5",
            jadwalAsal: "2026-10-22T13:00:00+09:00",
            alasan: "Tergeser oleh pengajuan prioritas lebih tinggi",
            namaPenggeser: "Yasir Muin, S.T., M.Kom.",
            kebutuhanPC: 1,
            kebutuhanKursi: 1,
            status: "menunggu_rekomendasi"
        },
        {
            id: "CASE-003",
            namaPemohon: "Muthia Sangadji",
            nipNpm: "0702221045",
            namaKegiatan: "Menyusun Proposal",
            kategori: "K5",
            prioritas: "P5",
            jadwalAsal: "2026-10-20T08:00:00+09:00",
            alasan: "Tergeser oleh pengajuan prioritas lebih tinggi",
            namaPenggeser: "Yasir Muin, S.T., M.Kom.",
            kebutuhanPC: 1,
            kebutuhanKursi: 1,
            status: "menunggu_rekomendasi"
        }
    ];

    // Data rekomendasi yang sudah dikirim kepada pengguna.
    const rekomendasi = [];

    // Satu sumber data awal untuk seluruh modul Laboran.
    window.SILAB_DATA_SEED = {
        bookings,
        antrean,
        penggunaTergeser,
        rekomendasi
    };

})(window);
