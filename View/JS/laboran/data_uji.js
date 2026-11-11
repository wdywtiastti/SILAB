
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

    const tanggalHariIni =
        window.SILABWaktu.tanggalHariIni();

    // Mengubah nama hari menjadi tanggal terdekat.
    function tanggalUntukHari(namaHari) {
        const daftarHari = [
            "Minggu",
            "Senin",
            "Selasa",
            "Rabu",
            "Kamis",
            "Jumat",
            "Sabtu"
        ];

        const target = daftarHari.indexOf(namaHari);

        if (target === -1) {
            return tanggalHariIni;
        }

        const [tahun, bulan, hari] =
            tanggalHariIni.split("-").map(Number);

        const tanggal = new Date(tahun, bulan - 1, hari);

        const selisih =
            (target - tanggal.getDay() + 7) % 7;

        tanggal.setDate(tanggal.getDate() + selisih);

        const pad = angka =>
            String(angka).padStart(2, "0");

        return [
            tanggal.getFullYear(),
            pad(tanggal.getMonth() + 1),
            pad(tanggal.getDate())
        ].join("-");
    }

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
            tanggal: tanggalHariIni,
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
            tanggal: tanggalHariIni,
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
            tanggal: tanggalHariIni,
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
            tanggal: tanggalHariIni,
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
            tanggal: tanggalHariIni,
            waktuMulai: "19:00",
            waktuSelesai: "21:00",
            kebutuhanPC: 1,
            kebutuhanKursi: 1,
            status: "terjadwal",
            presensi: null
        }
    ];

    // Seluruh data pengajuan Laboran.
    const antrean = [
        {
            id: "REQ-101",
            namaKegiatan:
                "Matakuliah Pengganti (Pemrograman Web)",
            namaPemohon: "Dr. Hendra",
            nipNpm: "0702221001",
            jumlahPeserta: 35,
            hari: "Kamis",
            tanggal: tanggalUntukHari("Kamis"),
            waktuMulai: "08:00",
            waktuSelesai: "10:30",
            kategori: "K1",
            prioritas: "P1",
            skor: 96.25,
            status: "bentrok",
            kebutuhanPC: 35,
            kebutuhanKursi: 35,
            pengajuanPenggeserId: null
        },
        {
            id: "REQ-102",
            namaKegiatan:
                "Rapat Asisten Lab RPL (Persiapan Modul)",
            namaPemohon: "Sarah Amelia",
            nipNpm: "0702221012",
            jumlahPeserta: 12,
            hari: "Rabu",
            tanggal: tanggalUntukHari("Rabu"),
            waktuMulai: "10:00",
            waktuSelesai: "12:00",
            kategori: "K2",
            prioritas: "P2",
            skor: 76.50,
            status: "verifikasi",
            kebutuhanPC: 12,
            kebutuhanKursi: 12,
            pengajuanPenggeserId: null
        },
        {
            id: "REQ-103",
            namaKegiatan:
                "Belajar Mandiri (Riset Skripsi AI)",
            namaPemohon: "Fajar R.",
            nipNpm: "0702221002",
            jumlahPeserta: 2,
            hari: "Selasa",
            tanggal: tanggalUntukHari("Selasa"),
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
                "Tergeser oleh pengajuan dengan prioritas lebih tinggi."
        },
        {
            id: "REQ-104",
            namaKegiatan:
                "Matakuliah Pengganti (Grafika Komputer)",
            namaPemohon: "Ibu Rina",
            nipNpm: "0702221013",
            jumlahPeserta: 30,
            hari: "Kamis",
            tanggal: tanggalUntukHari("Kamis"),
            waktuMulai: "08:00",
            waktuSelesai: "10:30",
            kategori: "K1",
            prioritas: "P1",
            skor: 89.00,
            status: "bentrok",
            kebutuhanPC: 30,
            kebutuhanKursi: 30,
            pengajuanPenggeserId: null
        },
        {
            id: "REQ-105",
            namaKegiatan:
                "Rapat Asisten Lab (Pelatihan Asisten Baru)",
            namaPemohon: "Budi Santoso",
            nipNpm: "0702221014",
            jumlahPeserta: 8,
            hari: "Jumat",
            tanggal: tanggalUntukHari("Jumat"),
            waktuMulai: "15:30",
            waktuSelesai: "17:30",
            kategori: "K2",
            prioritas: "P2",
            skor: 71.00,
            status: "verifikasi",
            kebutuhanPC: 8,
            kebutuhanKursi: 8,
            pengajuanPenggeserId: null
        },
        {
            id: "REQ-106",
            namaKegiatan:
                "Belajar Mandiri (Tugas Kelompok Jaringan)",
            namaPemohon: "Kevin",
            nipNpm: "0702221015",
            jumlahPeserta: 4,
            hari: "Kamis",
            tanggal: tanggalUntukHari("Kamis"),
            waktuMulai: "15:00",
            waktuSelesai: "17:00",
            kategori: "K5",
            prioritas: "P3",
            skor: 46.00,
            status: "verifikasi",
            kebutuhanPC: 2,
            kebutuhanKursi: 4,
            pengajuanPenggeserId: null
        }
    ];

    // Kasus tergeser yang terhubung dengan pengajuan aslinya.
    const penggunaTergeser = [
        {
            id: "CASE-REQ-103",
            pengajuanId: "REQ-103",
            pengajuanPenggeserId: null,
            alasan:
                "Tergeser oleh pengajuan dengan prioritas lebih tinggi.",
            status: "menunggu_rekomendasi",
            dibuatPada: new Date().toISOString(),
            arsip: false
        }
    ];

    // Data rekomendasi yang dibuat oleh Laboran.
    const rekomendasi = [];

    // Satu sumber data awal untuk seluruh modul Laboran.
    window.SILAB_DATA_SEED = {
        bookings,
        antrean,
        penggunaTergeser,
        rekomendasi
    };

})(window);
