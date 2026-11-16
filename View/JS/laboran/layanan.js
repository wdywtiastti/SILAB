
/**
 * LAYANAN DATA SILAB - MODUL LABORAN
 *
 * Mengelola:
 * 1. Shared Storage dan data simulasi.
 * 2. Pengajuan dan antrean.
 * 3. Booking dan validasi kapasitas.
 * 4. Deteksi bentrokan otomatis.
 * 5. Verifikasi, penolakan, dan pembatalan booking.
 * 6. Presensi laboratorium.
 * 7. Rekomendasi jadwal pengganti.
 * 8. Edit rekomendasi dengan batas 24 jam.
 * 9. Konflik dan keputusan Kepala Lab.
 */

(function (window) {
    "use strict";

    // ==========================================
    // 1. DEPENDENSI DAN KONFIGURASI
    // ==========================================

    const storage = window.SILABStorage;
    const waktu = window.SILABWaktu;
    const seed = window.SILAB_DATA_SEED || {};

    if (!storage || !waktu) {
        console.error(
            "SILAB: storage.js dan waktu.js harus dimuat sebelum layanan.js."
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
        attendance: KEYS.ATTENDANCE
    });

    const STATUS_ANTREAN_AKTIF = new Set([
        "verifikasi",
        "menunggu_verifikasi",
        "bentrok"
    ]);

    const STATUS_TERGESER = new Set([
        "tergeser",
        "pengguna_tergeser",
        "tergeser_prioritas",
        "menunggu_rekomendasi",
        "displaced"
    ]);

    const STATUS_REKOMENDASI_AKTIF = new Set([
        "rekomendasi_dikirim",
        "menunggu_persetujuan",
        "menunggu_konfirmasi"
    ]);

    const STATUS_BOOKING_NONAKTIF = new Set([
    "dibatalkan",
    "ditolak",
    "tidak_digunakan",
    "tergeser"
]);

const STATUS_BOOKING_MENUNGGU_PRESENSI = new Set([
    "terjadwal",
    "menunggu_presensi"
]);
    const BATAS_KONFIRMASI = 24 * 60 * 60 * 1000;

    // ==========================================
    // 2. FUNGSI DASAR STORAGE
    // ==========================================

    function ambilKey(namaKoleksi) {
        const key = KOLEKSI[namaKoleksi];

        if (!key) {
            throw new Error(
                `Koleksi SILAB tidak dikenal: ${namaKoleksi}`
            );
        }

        return key;
    }

    function salinData(data) {
        return JSON.parse(JSON.stringify(data));
    }

    function ambilSemua(namaKoleksi) {
        const data = storage.get(ambilKey(namaKoleksi), []);

        if (!Array.isArray(data)) {
            throw new Error(
                `Format data ${namaKoleksi} tidak valid.`
            );
        }

        return salinData(data);
    }

    function simpanSemua(namaKoleksi, data) {
        if (!Array.isArray(data)) {
            throw new Error(
                "Data yang disimpan harus berupa array."
            );
        }

        if (!storage.set(ambilKey(namaKoleksi), data)) {
            throw new Error(
                `Gagal menyimpan data ${namaKoleksi}.`
            );
        }

        return true;
    }

    function beriTahuPerubahan(namaKoleksi, aksi) {
        window.dispatchEvent(
            new CustomEvent("silab:data-changed", {
                detail: {
                    koleksi: namaKoleksi,
                    aksi,
                    waktu: new Date().toISOString()
                }
            })
        );
    }

    // ==========================================
    // 3. INISIALISASI DATA SIMULASI
    // ==========================================

    function gabungkanDataAwal(key, dataAwal) {
        if (!Array.isArray(dataAwal)) return;

        const dataTersimpan = storage.get(key, []);

        if (!Array.isArray(dataTersimpan)) {
            throw new Error(
                `Struktur penyimpanan ${key} tidak valid.`
            );
        }

        const gabungan = new Map();

        dataAwal.forEach((item) => {
            if (item?.id) {
                gabungan.set(String(item.id), item);
            }
        });

        dataTersimpan.forEach((item) => {
            if (item?.id) {
                gabungan.set(String(item.id), item);
            }
        });

        const hasil = Array.from(gabungan.values());

        if (
            !storage.exists(key) ||
            hasil.length !== dataTersimpan.length
        ) {
            if (!storage.set(key, hasil)) {
                throw new Error(
                    `Gagal menginisialisasi ${key}.`
                );
            }
        }
    }

    function inisialisasiData() {
        gabungkanDataAwal(
            KEYS.SUBMISSIONS,
            seed.antrean
        );

        gabungkanDataAwal(
            KEYS.CONFLICTS,
            seed.penggunaTergeser
        );

        gabungkanDataAwal(
            KEYS.RECOMMENDATIONS,
            seed.rekomendasi
        );
    }

    // ==========================================
    // 4. NORMALISASI WAKTU
    // ==========================================

    function pecahWaktu(nilai, tanggalFallback = "") {
        if (typeof nilai !== "string" || !nilai) {
            return {
                tanggal: tanggalFallback,
                jam: ""
            };
        }

        if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(nilai)) {
            return {
                tanggal: tanggalFallback,
                jam: nilai
            };
        }

        const waktuLokal = nilai.match(
            /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/
        );

        const memilikiZona =
            /(?:Z|[+-]\d{2}:\d{2})$/i.test(nilai);

        if (waktuLokal && !memilikiZona) {
            return {
                tanggal: waktuLokal[1],
                jam: waktuLokal[2]
            };
        }

        const tanggal = new Date(nilai);

        if (Number.isNaN(tanggal.getTime())) {
            return {
                tanggal: tanggalFallback,
                jam: ""
            };
        }

        const bagian = waktu.getWITParts(tanggal);

        if (!bagian) {
            return {
                tanggal: tanggalFallback,
                jam: ""
            };
        }

        const duaDigit = (angka) =>
            String(angka).padStart(2, "0");

        return {
            tanggal: `${bagian.year}-${duaDigit(bagian.month)}-${duaDigit(bagian.day)}`,
            jam: `${duaDigit(bagian.hour)}:${duaDigit(bagian.minute)}`
        };
    }

    // ==========================================
    // 5. NORMALISASI DATA PENGAJUAN
    // ==========================================

    function normalisasiPengajuan(data) {
        if (!data) return null;

        const mulai = pecahWaktu(
            data.waktuMulai,
            data.tanggal || ""
        );

        const selesai = pecahWaktu(
            data.waktuSelesai,
            data.tanggal || mulai.tanggal
        );

        const tanggal = data.tanggal || mulai.tanggal;

        return {
            ...data,

            tanggal,

            tanggalSelesai:
                selesai.tanggal || tanggal,

            waktuMulai: mulai.jam,

            waktuSelesai: selesai.jam,

            status:
                data.status === "menunggu_verifikasi"
                    ? "verifikasi"
                    : data.status,

            namaPemohon:
                data.namaPemohon ||
                data.nama ||
                data.userIdentifier ||
                "-",

            nipNpm:
                data.nipNpm ||
                data.userIdentifier ||
                "-",

            kebutuhanPC: Number(
                data.kebutuhanPC ??
                data.jumlahPC ??
                0
            ),

            kebutuhanKursi: Number(
                data.kebutuhanKursi ??
                data.jumlahKursi ??
                0
            ),

            jumlahPeserta: Number(
                data.jumlahPeserta ??
                data.jumlahKursi ??
                0
            )
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
                pesan:
                    "Peminjaman tidak boleh melewati pergantian tanggal."
            };
        }

        const rentang = waktu.validasiRentang(
            data.tanggal,
            data.waktuMulai,
            data.waktuSelesai
        );

        if (!rentang.valid) {
            return {
                valid: false,
                pesan: rentang.pesan
            };
        }

        return {
            valid: true,
            mulai: rentang.mulai,
            selesai: rentang.selesai
        };
    }

    // ==========================================
    // 6. PEMERIKSAAN RENTANG BENTROK
    // ==========================================

    function rentangBertabrakan(dataPertama, dataKedua) {
        const pertama = normalisasiPengajuan(dataPertama);
        const kedua = normalisasiPengajuan(dataKedua);

        if (
            !pertama ||
            !kedua ||
            pertama.tanggal !== kedua.tanggal
        ) {
            return false;
        }

        const rentangPertama = validasiJadwal(pertama);
        const rentangKedua = validasiJadwal(kedua);

        if (
            !rentangPertama.valid ||
            !rentangKedua.valid
        ) {
            return false;
        }

        return (
            rentangPertama.mulai < rentangKedua.selesai &&
            rentangPertama.selesai > rentangKedua.mulai
        );
    }

    function bookingMasihAktif(booking) {
        const status = String(
            booking.presensi?.status ||
            booking.status ||
            ""
        ).toLowerCase();

        return !STATUS_BOOKING_NONAKTIF.has(status);
    }

    // ==========================================
    // 7. PEMBENTUKAN DATA BOOKING
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
                new Date().toISOString()
        };
    }

    // ==========================================
    // 8. MENGAMBIL SELURUH BOOKING
    // ==========================================

    function ambilSemuaBooking() {
    const daftarBooking = new Map();

    const submissions = ambilSemua("submissions");

    const dataPengajuan = new Map(
        submissions.map((item) => [
            String(item.id),
            item
        ])
    );

    // 1. Mengambil booking dari data simulasi.
    if (Array.isArray(seed.bookings)) {
        seed.bookings.forEach((booking) => {
            if (!booking?.id) return;

            const idPengajuan =
                booking.sourceSubmissionId ||
                booking.pengajuanId ||
                (
                    String(booking.id).startsWith("BOOK-")
                        ? String(booking.id).substring(5)
                        : null
                );

            const pengajuanTerkait = idPengajuan
                ? dataPengajuan.get(String(idPengajuan))
                : null;

            const statusPengajuan = String(
                pengajuanTerkait?.status || ""
            ).toLowerCase();

            // Booking tetap dipertahankan jika sedang
            // menunggu keputusan Kepala Lab.
            if (
                pengajuanTerkait &&
                ![
                    "disetujui",
                    "menunggu_keputusan"
                ].includes(statusPengajuan)
            ) {
                return;
            }

            daftarBooking.set(
                String(booking.id),
                salinData(booking)
            );
        });
    }

    // 2. Membentuk booking dari pengajuan yang disetujui
    //    dan booking sementara yang menunggu keputusan.
    submissions.forEach((pengajuan) => {
        const status = String(
            pengajuan.status || ""
        ).toLowerCase();

        if (
            ![
                "disetujui",
                "menunggu_keputusan"
            ].includes(status)
        ) {
            return;
        }

        const bookingBaru = bentukBooking(pengajuan);

        const bookingLama =
            daftarBooking.get(String(bookingBaru.id)) || {};

        const bookingGabungan = {
            ...bookingLama,
            ...bookingBaru,

            status:
                status === "menunggu_keputusan"
                    ? "menunggu_keputusan"
                    : bookingLama.status || "terjadwal",

            presensi: bookingLama.presensi ?? null
        };

        daftarBooking.set(
            String(bookingGabungan.id),
            bookingGabungan
        );
    });

    // 3. Mengambil catatan presensi.
    const attendance = ambilSemua("attendance");

    const presensiTerakhir = new Map();

    attendance.forEach((catatan) => {
        if (!catatan.bookingId) return;

        presensiTerakhir.set(
            String(catatan.bookingId),
            catatan
        );
    });

    // 4. Menggabungkan booking dengan data presensi.
    return Array.from(daftarBooking.values()).map(
        (booking) => {
            const catatan = presensiTerakhir.get(
                String(booking.id)
            );

            if (!catatan) return booking;

            const menungguKeputusan =
                booking.status === "menunggu_keputusan";

            return {
                ...booking,

                status: menungguKeputusan
                    ? "menunggu_keputusan"
                    : catatan.status,

                statusPresensiAsli: catatan.status,

                presensi: {
                    status: catatan.status,
                    dicatatPada: catatan.dicatatPada
                }
            };
        }
    );
}

    // ==========================================
    // 9. PEMERIKSAAN KELAYAKAN PEMBATALAN BOOKING
    // ==========================================

    function bolehBatalkanPersetujuan(pengajuanId) {
        if (!pengajuanId) return false;

        const id = String(pengajuanId).startsWith("BOOK-")
            ? String(pengajuanId).substring(5)
            : String(pengajuanId);

        const submissions = ambilSemua("submissions");

        const pengajuan = submissions.find(
            (item) => String(item.id) === id
        );

        // Hanya pengajuan yang sudah disetujui.
        if (
            !pengajuan ||
            pengajuan.status !== "disetujui"
        ) {
            return false;
        }

        const bookingId = `BOOK-${id}`;

        // Booking yang sudah memiliki catatan presensi
        // tidak boleh dibatalkan.
        const attendance = ambilSemua("attendance");

        const sudahPresensi = attendance.some(
            (item) =>
                String(item.bookingId) === bookingId
        );

        if (sudahPresensi) return false;

        // Pastikan booking masih menunggu presensi.
        const booking = ambilSemuaBooking().find(
            (item) =>
                String(item.id) === bookingId
        );

        if (!booking || booking.presensi) {
            return false;
        }

        return STATUS_BOOKING_MENUNGGU_PRESENSI.has(
            String(booking.status || "").toLowerCase()
        );
    }

    // ==========================================
    // 10. DETEKSI BENTROK PENGAJUAN DAN BOOKING
    // ==========================================

    function ambilPengajuanAktif() {
        return ambilSemua("submissions").filter(
            (item) =>
                [
                    "verifikasi",
                    "menunggu_verifikasi",
                    "bentrok"
                ].includes(
                    String(item.status || "").toLowerCase()
                )
        );
    }

    function deteksiBentrokJadwal(pengajuanId) {
        const pengajuan = ambilSemua("submissions").find(
            (item) =>
                String(item.id) === String(pengajuanId)
        );

        if (!pengajuan) {
            throw new Error(
                "Pengajuan tidak ditemukan."
            );
        }

        const dataPengajuan = normalisasiPengajuan(pengajuan);

        const bookings = ambilSemuaBooking();

        const bentrok = bookings.filter((booking) => {
            if (!bookingMasihAktif(booking)) return false;

            if (
                String(booking.sourceSubmissionId) ===
                String(pengajuanId)
            ) {
                return false;
            }

            return rentangBertabrakan(
                dataPengajuan,
                booking
            );
        });

        return {
            bentrok: bentrok.length > 0,
            jumlahBentrok: bentrok.length,
            pengajuan: salinData(dataPengajuan),
            daftarBooking: salinData(bentrok)
        };
    }

    function ambilPengajuanBentrokDenganBooking(booking) {
        return ambilPengajuanAktif().filter(
            (pengajuan) => {
                if (
                    String(pengajuan.id) ===
                    String(booking.sourceSubmissionId)
                ) {
                    return false;
                }

                return rentangBertabrakan(
                    pengajuan,
                    booking
                );
            }
        );
    }

    
    // ==========================================
    // 11. PENGAMBILAN SELURUH DATA
    // ==========================================

    function getAll(namaKoleksi) {

        // ======================================
        // A. MENGAMBIL SELURUH BOOKING
        // ======================================

        if (namaKoleksi === "bookings") {
            const bookings = ambilSemuaBooking();

            return salinData(
                bookings.map((booking) => {

                    // Booking yang tidak aktif atau sedang
                    // menunggu keputusan tetap dipertahankan.
                    if (
                        !bookingMasihAktif(booking) ||
                        booking.status === "menunggu_keputusan"
                    ) {
                        return booking;
                    }

                    const pengajuanBentrok =
                        ambilPengajuanBentrokDenganBooking(
                            booking
                        );

                    if (!pengajuanBentrok.length) {
                        return booking;
                    }

                    return {
                        ...booking,

                        statusSebelumBentrok: booking.status,

                        statusPresensiAsli:
                            booking.presensi?.status ||
                            booking.status,

                        status: "bentrok",

                        konflikAktif: true,

                        konflikDengan:
                            pengajuanBentrok.map((item) => ({
                                id: item.id,

                                namaPemohon:
                                    item.namaPemohon ||
                                    item.nama ||
                                    "-",

                                namaKegiatan:
                                    item.namaKegiatan || "-",

                                waktuMulai: item.waktuMulai,

                                waktuSelesai: item.waktuSelesai
                            }))
                    };
                })
            );
        }

        // ======================================
        // B. MENGAMBIL DATA PENGGUNA TERGESER
        // ======================================

        if (
            [
                "penggunaTergeser",
                "konflik",
                "conflicts"
            ].includes(namaKoleksi)
        ) {
            const dataKonflik = ambilSemua("conflicts").filter(
                (item) =>
                    !Array.isArray(item.pengajuan) &&
                    (
                        item.pengajuanId ||
                        item.sourceSubmissionId
                    )
            );

            const dataPengajuan = ambilSemua(
                "submissions"
            ).filter((item) =>
                STATUS_TERGESER.has(
                    String(item.status || "").toLowerCase()
                )
            );

            const gabungan = new Map();

            dataKonflik.forEach((item) => {
                const id = String(
                    item.pengajuanId ||
                    item.sourceSubmissionId
                );

                gabungan.set(id, item);
            });

            dataPengajuan.forEach((pengajuan) => {
                const id = String(pengajuan.id);
                const kasus = gabungan.get(id) || {};

                gabungan.set(id, {
                    ...pengajuan,
                    ...kasus,

                    id: kasus.id || `CASE-${id}`,

                    pengajuanId: id,

                    sourceSubmissionId: id,

                    namaPemohon:
                        kasus.namaPemohon ||
                        pengajuan.namaPemohon ||
                        pengajuan.nama ||
                        "-",

                    nipNpm:
                        kasus.nipNpm ||
                        pengajuan.nipNpm ||
                        "-",

                    namaKegiatan:
                        kasus.namaKegiatan ||
                        pengajuan.namaKegiatan ||
                        "-",

                    tanggal:
                        kasus.tanggal ||
                        pengajuan.tanggal,

                    waktuMulai:
                        kasus.waktuMulai ||
                        pengajuan.waktuMulai,

                    waktuSelesai:
                        kasus.waktuSelesai ||
                        pengajuan.waktuSelesai,

                    jadwalAsal:
                        kasus.jadwalAsal ||
                        (
                            (
                                kasus.tanggal ||
                                pengajuan.tanggal
                            ) &&
                            (
                                kasus.waktuMulai ||
                                pengajuan.waktuMulai
                            )
                                ? `${kasus.tanggal || pengajuan.tanggal}T${kasus.waktuMulai || pengajuan.waktuMulai}:00+09:00`
                                : null
                        ),

                    alasan:
                        kasus.alasan ||
                        kasus.alasanTergeser ||
                        pengajuan.alasanTergeser ||
                        pengajuan.alasan ||
                        "Pengajuan tergeser akibat keputusan penyelesaian konflik Kepala Lab.",

                    namaPenggeser:
                        kasus.namaPenggeser ||
                        pengajuan.namaPenggeser ||
                        "-",

                    kategori:
                        kasus.kategori ||
                        pengajuan.kategori ||
                        "-",

                    prioritas:
                        kasus.prioritas ||
                        pengajuan.prioritas ||
                        "-",

                    kebutuhanPC:
                        kasus.kebutuhanPC ??
                        pengajuan.kebutuhanPC ??
                        0,

                    kebutuhanKursi:
                        kasus.kebutuhanKursi ??
                        pengajuan.kebutuhanKursi ??
                        0,

                    status:
                        kasus.status ||
                        pengajuan.status
                });
            });

            return Array.from(
                gabungan.values()
            ).map(normalisasiPengajuan);
        }

        // ======================================
        // C. MENGAMBIL DATA KOLEKSI
        // ======================================

        const data = ambilSemua(namaKoleksi);

        if (
            namaKoleksi === "antrean" ||
            namaKoleksi === "submissions"
        ) {
            const bookings = ambilSemuaBooking();

            return data.map((pengajuan) => {

                const hasil = normalisasiPengajuan(pengajuan);

                const status = String(
                    pengajuan.status || ""
                ).toLowerCase();

                // ==================================
                // C1. BOOKING YANG SUDAH DISETUJUI
                // ==================================

                if (status === "disetujui") {
                    const booking = bookings.find(
                        (item) =>
                            String(item.sourceSubmissionId) ===
                                String(pengajuan.id) ||
                            String(item.id) ===
                                `BOOK-${pengajuan.id}`
                    );

                    if (
                        !booking ||
                        !bookingMasihAktif(booking)
                    ) {
                        return hasil;
                    }

                    const pengajuanBentrok =
                        ambilPengajuanBentrokDenganBooking(
                            booking
                        );

                    if (!pengajuanBentrok.length) {
                        return hasil;
                    }

                    return {
                        ...hasil,

                        statusSebelumBentrok: "disetujui",

                        status: "bentrok",

                        konflikAktif: true,

                        konflikDengan:
                            pengajuanBentrok.map((item) => ({
                                id: item.id,

                                namaPemohon:
                                    item.namaPemohon ||
                                    item.nama ||
                                    "-",

                                namaKegiatan:
                                    item.namaKegiatan || "-",

                                waktuMulai: item.waktuMulai,

                                waktuSelesai: item.waktuSelesai
                            }))
                    };
                }

                // ==================================
                // C2. PENGAJUAN YANG BELUM DISETUJUI
                // ==================================

                if (
                    ![
                        "verifikasi",
                        "menunggu_verifikasi",
                        "bentrok"
                    ].includes(status)
                ) {
                    return hasil;
                }

                // Memeriksa bentrokan dengan booking aktif.
                const bookingBentrok = bookings.filter(
                    (booking) => {

                        if (!bookingMasihAktif(booking)) {
                            return false;
                        }

                        // Booking yang menunggu keputusan
                        // tidak membentuk kelompok konflik baru.
                        if (
                            booking.status === "menunggu_keputusan"
                        ) {
                            return false;
                        }

                        // Abaikan booking milik pengajuan sendiri.
                        if (
                            String(booking.sourceSubmissionId) ===
                            String(pengajuan.id)
                        ) {
                            return false;
                        }

                        return rentangBertabrakan(
                            hasil,
                            booking
                        );
                    }
                );

                // Memeriksa bentrokan dengan pengajuan aktif lainnya.
                const pengajuanLainBentrok =
                    ambilPengajuanAktif().filter(
                        (item) => {

                            // Abaikan pengajuan sendiri.
                            if (
                                String(item.id) ===
                                String(pengajuan.id)
                            ) {
                                return false;
                            }

                            return rentangBertabrakan(
                                hasil,
                                item
                            );
                        }
                    );

                // Menggabungkan seluruh hasil pemeriksaan.
                const daftarKonflik = [

                    ...bookingBentrok.map((booking) => ({
                        id:
                            booking.sourceSubmissionId ||
                            booking.id,

                        bookingId: booking.id,

                        namaPemohon:
                            booking.namaPemohon || "-",

                        namaKegiatan:
                            booking.namaKegiatan || "-",

                        waktuMulai: booking.waktuMulai,

                        waktuSelesai: booking.waktuSelesai
                    })),

                    ...pengajuanLainBentrok.map((item) => {
                        const dataLain =
                            normalisasiPengajuan(item);

                        return {
                            id: item.id,

                            namaPemohon:
                                dataLain.namaPemohon || "-",

                            namaKegiatan:
                                dataLain.namaKegiatan || "-",

                            waktuMulai:
                                dataLain.waktuMulai,

                            waktuSelesai:
                                dataLain.waktuSelesai
                        };
                    })
                ];

                // Tidak ditemukan bentrokan.
                if (!daftarKonflik.length) {
                    return hasil;
                }

                // Tandai pengajuan sebagai bentrok.
                return {
                    ...hasil,

                    statusSebelumBentrok:
                        pengajuan.statusSebelumBentrok ||
                        pengajuan.status,

                    status: "bentrok",

                    konflikAktif: true,

                    konflikDengan: daftarKonflik
                };
            });
        }

        // ======================================
        // D. MENGEMBALIKAN DATA KOLEKSI LAINNYA
        // ======================================

        return data;
    }


    // ==========================================
    // 12. MENGAMBIL DATA BERDASARKAN ID
    // ==========================================

    function getById(namaKoleksi, id) {
        if (!id) return null;

        const data = getAll(namaKoleksi);

        return data.find(
            (item) =>
                String(item.id) === String(id)
        ) || null;
    }

    // ==========================================
    // 13. MENGAMBIL ANTREAN AKTIF
    // ==========================================

    function getAntreanAktif() {
        return getAll("antrean").filter(
            (item) =>
                STATUS_ANTREAN_AKTIF.has(
                    String(item.status || "").toLowerCase()
                )
        );
    }

    // ==========================================
    // 14. VALIDASI KAPASITAS
    // ==========================================

    function ambilKapasitas() {
        const kapasitasDefault = {
            kapasitasPC: 30,
            kapasitasKursi: 30
        };

        const fasilitas = storage.get(
            KEYS.FACILITIES,
            kapasitasDefault
        );

        if (
            !fasilitas ||
            !Number.isInteger(fasilitas.kapasitasPC) ||
            !Number.isInteger(fasilitas.kapasitasKursi) ||
            fasilitas.kapasitasPC <= 0 ||
            fasilitas.kapasitasKursi <= 0
        ) {
            throw new Error(
                "Konfigurasi kapasitas fasilitas tidak valid."
            );
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
                pesan:
                    "Kebutuhan PC dan kursi harus berupa bilangan bulat positif."
            };
        }

        if (
            data.kebutuhanPC > kapasitas.kapasitasPC ||
            data.kebutuhanKursi > kapasitas.kapasitasKursi
        ) {
            return {
                valid: false,
                pesan:
                    "Kebutuhan fasilitas melebihi kapasitas laboratorium."
            };
        }

        return {
            valid: true,
            pesan:
                "Kapasitas fasilitas memenuhi kebutuhan."
        };
    }

    // ==========================================
    // 15. PEMERIKSAAN BENTROKAN JADWAL
    // ==========================================

    function cekKonflikJadwal(
    dataBaru,
    bookingId = null
) {
    const data = normalisasiPengajuan(dataBaru);

    const rentangBaru = validasiJadwal(data);

    if (!rentangBaru.valid) {
        return {
            bentrok: false,
            valid: false,
            pesan: rentangBaru.pesan,
            booking: null,
            daftarBooking: []
        };
    }

    // Mendukung pengecualian satu atau beberapa booking.
    const referensi = Array.isArray(bookingId)
        ? bookingId
        : [bookingId];

    const daftarPengecualian = new Set();

    referensi.forEach((referensiId) => {
        if (
            referensiId === null ||
            referensiId === undefined ||
            referensiId === ""
        ) {
            return;
        }

        const id = String(referensiId);

        if (id.startsWith("BOOK-")) {
            daftarPengecualian.add(id);
            daftarPengecualian.add(
                id.substring(5)
            );
        } else {
            daftarPengecualian.add(id);
            daftarPengecualian.add(
                `BOOK-${id}`
            );
        }
    });

    const bookings = ambilSemuaBooking();

    const daftarBentrok = bookings.filter(
        (booking) => {
            if (!bookingMasihAktif(booking)) {
                return false;
            }

            // Abaikan booking milik kelompok yang diperiksa.
            if (
                daftarPengecualian.has(
                    String(booking.id)
                ) ||
                daftarPengecualian.has(
                    String(booking.sourceSubmissionId)
                )
            ) {
                return false;
            }

            return rentangBertabrakan(
                data,
                booking
            );
        }
    );

    return {
        bentrok: daftarBentrok.length > 0,

        valid: true,

        pesan: daftarBentrok.length
            ? "Jadwal bertabrakan dengan booking yang sudah ada."
            : "Tidak ditemukan bentrokan jadwal.",

        booking: daftarBentrok[0] || null,

        daftarBooking: salinData(daftarBentrok)
    };
}

    // ==========================================
    // 16. PERSETUJUAN PENGAJUAN
    // ==========================================

    function setujuiPengajuan(pengajuanId) {
        if (!pengajuanId) {
            throw new Error(
                "ID pengajuan tidak ditemukan."
            );
        }

        const submissions = ambilSemua("submissions");

        const index = submissions.findIndex(
            (item) =>
                String(item.id) === String(pengajuanId)
        );

        if (index === -1) {
            throw new Error("Pengajuan tidak ditemukan.");
        }

        const pengajuan = submissions[index];

        if (
            ["disetujui", "ditolak"].includes(
                pengajuan.status
            )
        ) {
            throw new Error(
                "Pengajuan sudah memiliki keputusan akhir."
            );
        }

        if (
            ![
                "verifikasi",
                "menunggu_verifikasi"
            ].includes(pengajuan.status)
        ) {
            throw new Error(
                "Pengajuan tidak berada dalam status verifikasi."
            );
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

    // Jangan membuat kelompok konflik baru jika
    // booking sedang menunggu keputusan Kepala Lab.
    const menungguKeputusan =
        konflik.daftarBooking.some(
            (booking) =>
                booking.status === "menunggu_keputusan"
        );

    if (menungguKeputusan) {
        throw new Error(
            "Jadwal sedang menunggu keputusan Kepala Lab. Pengajuan belum dapat disetujui."
        );
    }

    submissions[index] = {
        ...pengajuan,

        status: "bentrok",

        statusSebelumBentrok:
            pengajuan.status,

        bentrokTerdeteksiPada:
            new Date().toISOString()
    };

    simpanSemua("submissions", submissions);

    beriTahuPerubahan(
        "antrean",
        "bentrok"
    );

    beriTahuPerubahan(
        "bookings",
        "bentrok"
    );

    throw new Error(
        "Pengajuan tidak dapat disetujui karena jadwal bentrok. Pengajuan dikembalikan ke antrean untuk diteruskan kepada Kepala Lab."
    );
}

        const bookings = ambilSemuaBooking();

        const bookingSudahAda = bookings.some(
            (booking) =>
                String(booking.sourceSubmissionId) ===
                    String(pengajuan.id) ||
                String(booking.id) ===
                    `BOOK-${pengajuan.id}`
        );

        if (bookingSudahAda) {
            throw new Error(
                "Booking untuk pengajuan ini sudah tersedia."
            );
        }

        submissions[index] = {
            ...pengajuan,

            status: "disetujui",

            diverifikasiPada: new Date().toISOString()
        };

        simpanSemua("submissions", submissions);

        beriTahuPerubahan("bookings", "disetujui");
        beriTahuPerubahan("antrean", "disetujui");

        return {
            pengajuan: salinData(submissions[index]),
            booking: salinData(
                bentukBooking(submissions[index])
            )
        };
    }

    // ==========================================
    // 17. PENOLAKAN PENGAJUAN
    // ==========================================

    function tolakPengajuan(
        pengajuanId,
        alasan = ""
    ) {
        if (!pengajuanId) {
            throw new Error(
                "ID pengajuan tidak ditemukan."
            );
        }

        const alasanPenolakan = String(alasan).trim();

        if (!alasanPenolakan) {
            throw new Error(
                "Alasan penolakan wajib diisi."
            );
        }

        const submissions = ambilSemua("submissions");

        const index = submissions.findIndex(
            (item) =>
                String(item.id) === String(pengajuanId)
        );

        if (index === -1) {
            throw new Error("Pengajuan tidak ditemukan.");
        }

        if (
            ![
                "verifikasi",
                "menunggu_verifikasi"
            ].includes(submissions[index].status)
        ) {
            throw new Error(
                "Pengajuan tidak berada dalam status verifikasi."
            );
        }

        submissions[index] = {
            ...submissions[index],

            status: "ditolak",

            alasanPenolakan,

            diverifikasiPada: new Date().toISOString()
        };

        simpanSemua("submissions", submissions);

        beriTahuPerubahan("antrean", "ditolak");
        beriTahuPerubahan("bookings", "ditolak");

        return salinData(submissions[index]);
    }

    // ==========================================
    // 18. MEMBATALKAN BOOKING SEBELUM PRESENSI
    // ==========================================

    function batalkanPersetujuan(pengajuanId) {
        if (!pengajuanId) {
            throw new Error(
                "ID pengajuan tidak ditemukan."
            );
        }

        // Mendukung ID pengajuan maupun ID booking.
        const id = String(pengajuanId).startsWith("BOOK-")
            ? String(pengajuanId).substring(5)
            : String(pengajuanId);

        const submissions = ambilSemua("submissions");

        const index = submissions.findIndex(
            (item) => String(item.id) === id
        );

        if (index === -1) {
            throw new Error("Pengajuan tidak ditemukan.");
        }

        const pengajuan = submissions[index];

        if (pengajuan.status !== "disetujui") {
            throw new Error(
                "Hanya booking yang sudah disetujui yang dapat dibatalkan."
            );
        }

        const bookingId = `BOOK-${id}`;

        // Periksa apakah presensi sudah pernah dicatat.
        const attendance = ambilSemua("attendance");

        const presensiSudahDicatat = attendance.some(
            (item) =>
                String(item.bookingId) === bookingId
        );

        if (presensiSudahDicatat) {
            throw new Error(
                "Booking tidak dapat dibatalkan karena presensi sudah dicatat. Penggunaan laboratorium dianggap sedang berlangsung."
            );
        }

        // Pastikan booking masih berstatus menunggu presensi.
        if (!bolehBatalkanPersetujuan(id)) {
            throw new Error(
                "Pembatalan hanya diperbolehkan untuk booking yang masih menunggu presensi."
            );
        }

        const bookingAsal = bentukBooking(pengajuan);

        // Cari semua pengajuan aktif yang bertabrakan
        // dengan booking yang akan dibatalkan.
        const pengajuanBentrok = submissions.filter(
            (item) => {
                if (String(item.id) === id) return false;

                if (
                    ![
                        "verifikasi",
                        "menunggu_verifikasi",
                        "bentrok"
                    ].includes(
                        String(item.status || "").toLowerCase()
                    )
                ) {
                    return false;
                }

                return rentangBertabrakan(
                    item,
                    bookingAsal
                );
            }
        );

        const waktuPembatalan =
            new Date().toISOString();

        const idBentrok = pengajuanBentrok.map(
            (item) => String(item.id)
        );

        // Booking yang dibatalkan kembali ke antrean.
        submissions[index] = {
            ...pengajuan,

            status: idBentrok.length
                ? "bentrok"
                : "verifikasi",

            statusSebelumBentrok: "disetujui",

            persetujuanDibatalkanPada:
                waktuPembatalan,

            alasanPembatalan:
                idBentrok.length
                    ? "Persetujuan dibatalkan karena terjadi bentrok jadwal."
                    : "Persetujuan dibatalkan oleh Laboran.",

            konflikDengan: idBentrok,

            konflikAktif: idBentrok.length > 0
        };

        // Pengajuan baru yang bertabrakan juga ditandai.
        pengajuanBentrok.forEach((item) => {
            const posisi = submissions.findIndex(
                (data) =>
                    String(data.id) === String(item.id)
            );

            if (posisi === -1) return;

            submissions[posisi] = {
                ...submissions[posisi],

                status: "bentrok",

                statusSebelumBentrok:
                    submissions[posisi].status,

                bentrokDengan: [
                    ...new Set([
                        ...(submissions[posisi].bentrokDengan || []),
                        id
                    ])
                ],

                bentrokTerdeteksiPada:
                    waktuPembatalan,

                konflikAktif: true
            };
        });

        simpanSemua("submissions", submissions);

        beriTahuPerubahan(
            "antrean",
            "persetujuan_dibatalkan"
        );

        beriTahuPerubahan(
            "bookings",
            "persetujuan_dibatalkan"
        );

        beriTahuPerubahan(
            "submissions",
            "bentrok"
        );

        return {
            ...salinData(submissions[index]),

            berhasil: true,

            jumlahPengajuanBentrok:
                pengajuanBentrok.length,

            pengajuanBentrok:
                salinData(pengajuanBentrok)
        };
    }

    // ==========================================
    // 19. UPDATE ANTREAN
    // ==========================================

    function update(
        namaKoleksi,
        id,
        perubahan = {}
    ) {
        if (
            namaKoleksi !== "antrean" &&
            namaKoleksi !== "submissions"
        ) {
            throw new Error(
                "Update hanya tersedia untuk proses pengajuan."
            );
        }

        if (
            !perubahan ||
            typeof perubahan !== "object"
        ) {
            throw new Error(
                "Data perubahan tidak valid."
            );
        }

        if (perubahan.status === "disetujui") {
            return setujuiPengajuan(id);
        }

        if (perubahan.status === "ditolak") {
            return tolakPengajuan(
                id,
                perubahan.alasanPenolakan ||
                perubahan.alasan ||
                ""
            );
        }

        throw new Error(
            "Keputusan pengajuan tidak dikenali."
        );
    }

    // ==========================================
    // 20. PENGELOLAAN PRESENSI
    // ==========================================

    function updatePresensi(bookingId, status) {
        const statusValid = [
            "digunakan",
            "tidak_digunakan"
        ];

        if (!statusValid.includes(status)) {
            throw new Error(
                "Status presensi tidak valid."
            );
        }

        const bookings = getAll("bookings");

        const booking = bookings.find(
            (item) =>
                String(item.id) === String(bookingId)
        );

        if (!booking) {
            throw new Error(
                "Data booking tidak ditemukan."
            );
        }

        if (booking.konflikAktif) {
            throw new Error(
                "Presensi tidak dapat dicatat karena booking sedang mengalami bentrok jadwal."
            );
        }

        // Presensi hanya boleh dicatat pada booking
        // yang masih menunggu presensi.
        if (
            !STATUS_BOOKING_MENUNGGU_PRESENSI.has(
                String(booking.status || "").toLowerCase()
            ) ||
            booking.presensi
        ) {
            throw new Error(
                "Presensi hanya dapat dicatat pada booking yang masih menunggu presensi."
            );
        }

        const attendance = ambilSemua("attendance");

        const sudahDicatat = attendance.some(
            (item) =>
                String(item.bookingId) === String(bookingId)
        );

        if (sudahDicatat) {
            throw new Error(
                "Presensi booking ini sudah dicatat."
            );
        }

        const waktuPencatatan =
            new Date().toISOString();

        const catatanBaru = {
            id: `${bookingId}-${status}`,
            bookingId,
            status,
            dicatatPada: waktuPencatatan
        };

        attendance.push(catatanBaru);

        simpanSemua("attendance", attendance);

        beriTahuPerubahan("bookings", "presensi");
        beriTahuPerubahan("attendance", "presensi");

        return {
            ...booking,

            status,

            presensi: {
                status,
                dicatatPada: waktuPencatatan
            }
        };
    }

    // ==========================================
    // 21. ID REKOMENDASI
    // ==========================================

    function buatIdRekomendasi(data) {
        let nomorTerakhir = 0;

        data.forEach((item) => {
            const cocok = item.id?.match(/^REC-(\d+)$/);

            if (cocok) {
                nomorTerakhir = Math.max(
                    nomorTerakhir,
                    Number(cocok[1])
                );
            }
        });

        return `REC-${String(
            nomorTerakhir + 1
        ).padStart(3, "0")}`;
    }

    // ==========================================
    // 22. MEMBUAT REKOMENDASI JADWAL
    // ==========================================

    function buatRekomendasi(data) {
        if (!data || !data.pengajuanId) {
            throw new Error(
                "ID pengajuan untuk rekomendasi wajib tersedia."
            );
        }

        const pengajuan = getById(
            "submissions",
            data.pengajuanId
        );

        if (!pengajuan) {
            throw new Error(
                "Data pengajuan tidak ditemukan."
            );
        }

        const dataRekomendasi = normalisasiPengajuan({
            ...pengajuan,
            ...data
        });

        const rentang = validasiJadwal(dataRekomendasi);

        if (!rentang.valid) {
            throw new Error(rentang.pesan);
        }

        const kapasitas = validasiKapasitas(
            dataRekomendasi
        );

        if (!kapasitas.valid) {
            throw new Error(kapasitas.pesan);
        }

        const idBookingAsal =
            data.bookingId ||
            `BOOK-${data.pengajuanId}`;

        const konflik = cekKonflikJadwal(
            dataRekomendasi,
            idBookingAsal
        );

        if (konflik.bentrok) {
            throw new Error(
                "Jadwal rekomendasi masih bertabrakan dengan booking lain."
            );
        }

        const rekomendasi =
            ambilSemua("recommendations");

        const rekomendasiBaru = {
            ...dataRekomendasi,

            id: buatIdRekomendasi(rekomendasi),

            pengajuanId: data.pengajuanId,

            bookingId: idBookingAsal,

            status: "menunggu_persetujuan",

            dibuatPada: new Date().toISOString(),

            sumber: "laboran"
        };

        rekomendasi.push(rekomendasiBaru);

        simpanSemua("recommendations", rekomendasi);

        beriTahuPerubahan(
            "recommendations",
            "dibuat"
        );

        return salinData(rekomendasiBaru);
    }

    function hapusRekomendasi(rekomendasiId) {
        const rekomendasi =
            ambilSemua("recommendations");

        const index = rekomendasi.findIndex(
            (item) =>
                String(item.id) === String(rekomendasiId)
        );

        if (index === -1) {
            throw new Error(
                "Rekomendasi tidak ditemukan."
            );
        }

        if (
            rekomendasi[index].status !==
            "menunggu_persetujuan"
        ) {
            throw new Error(
                "Rekomendasi yang sudah diproses tidak dapat dihapus."
            );
        }

        rekomendasi.splice(index, 1);

        simpanSemua("recommendations", rekomendasi);

        beriTahuPerubahan(
            "recommendations",
            "dihapus"
        );

        return true;
    }

    // ==========================================
    // 23. MENGAMBIL REKOMENDASI BERDASARKAN KASUS
    // ==========================================

    function ambilRekomendasiKasus(kasus) {
        const daftar =
            ambilSemua("recommendations");

        const idKasus = String(kasus.id);
        const idPengajuan = String(kasus.pengajuanId);

        const hasil = daftar.filter((item) =>
            [
                item.caseId,
                item.kasusId,
                item.pengajuanId,
                item.antreanId
            ].some(
                (id) =>
                    id !== undefined &&
                    id !== null &&
                    (
                        String(id) === idKasus ||
                        String(id) === idPengajuan
                    )
            )
        );

        hasil.sort(
            (a, b) =>
                (
                    Date.parse(
                        b.dikirimPada ||
                        b.dibuatPada ||
                        b.createdAt
                    ) || 0
                ) -
                (
                    Date.parse(
                        a.dikirimPada ||
                        a.dibuatPada ||
                        a.createdAt
                    ) || 0
                )
        );

        return hasil[0] || null;
    }

    // ==========================================
    // 24. MENGAMBIL KASUS TERGESER
    // ==========================================

    function getKasusTergeserById(idReferensi) {
        if (!idReferensi) return null;

        const id = String(idReferensi);

        const konflik = ambilSemua("conflicts");

        const submissions = ambilSemua("submissions");

        const dataKonflik = konflik.find((item) =>
            [
                item.id,
                item.pengajuanId,
                item.sourceSubmissionId
            ].some(
                (nilai) =>
                    nilai !== undefined &&
                    String(nilai) === id
            )
        );

        const idPengajuan =
            dataKonflik?.pengajuanId ||
            dataKonflik?.sourceSubmissionId ||
            (
                id.startsWith("CASE-")
                    ? id.substring(5)
                    : id
            );

        const pengajuan = submissions.find(
            (item) =>
                String(item.id) === String(idPengajuan)
        );

        if (!pengajuan && !dataKonflik) {
            return null;
        }

        const sumber = {
            ...(pengajuan || {}),
            ...(dataKonflik || {})
        };

        const kasus = {
            ...sumber,

            id:
                dataKonflik?.id ||
                `CASE-${idPengajuan}`,

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

            status: sumber.status || "tergeser"
        };

        const rekomendasi =
            ambilRekomendasiKasus(kasus);

        const rekomendasiTerbaru = rekomendasi
            ? {
                ...rekomendasi,

                status: STATUS_REKOMENDASI_AKTIF.has(
                    String(rekomendasi.status).toLowerCase()
                )
                    ? "rekomendasi_dikirim"
                    : rekomendasi.status
            }
            : null;

        return normalisasiPengajuan({
            ...kasus,

            status:
                rekomendasiTerbaru?.status ||
                kasus.status,

            rekomendasiTerbaru
        });
    }

    // ==========================================
    // 25. VALIDASI SLOT REKOMENDASI
    // ==========================================

    function siapkanJadwalRekomendasi(
        kasus,
        detail
    ) {
        if (
            !detail ||
            !detail.waktuMulai ||
            !detail.waktuSelesai
        ) {
            throw new Error(
                "Waktu mulai dan waktu selesai wajib diisi."
            );
        }

        const mulai = pecahWaktu(detail.waktuMulai);

        const selesai = pecahWaktu(
            detail.waktuSelesai
        );

        if (!mulai.jam || !selesai.jam) {
            throw new Error(
                "Format waktu rekomendasi tidak valid."
            );
        }

        if (
            !mulai.tanggal ||
            mulai.tanggal !== selesai.tanggal
        ) {
            throw new Error(
                "Jadwal rekomendasi tidak boleh melewati pergantian tanggal."
            );
        }

        const waktuMulaiTimestamp = Date.parse(
            `${mulai.tanggal}T${mulai.jam}:00+09:00`
        );

        if (
            !Number.isFinite(waktuMulaiTimestamp) ||
            waktuMulaiTimestamp <= Date.now()
        ) {
            throw new Error(
                "Jadwal rekomendasi harus berada di masa mendatang."
            );
        }

        const dataJadwal = normalisasiPengajuan({
            ...kasus,

            tanggal: mulai.tanggal,

            tanggalSelesai: selesai.tanggal,

            waktuMulai: mulai.jam,

            waktuSelesai: selesai.jam
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
            `BOOK-${kasus.pengajuanId}`
        );

        if (konflikBooking.bentrok) {
            throw new Error(
                "Jadwal rekomendasi bertabrakan dengan peminjaman yang sudah terjadwal."
            );
        }

        return {
            data: dataJadwal,

            mulaiLokal: detail.waktuMulai,

            selesaiLokal: detail.waktuSelesai,

            rentang
        };
    }

    // ==========================================
    // 26. VALIDASI MULTI ALTERNATIF JADWAL
    // ==========================================

    function siapkanAlternatifRekomendasi(
        kasus,
        detail,
        rekomendasiId = null
    ) {
        const daftarAlternatif =
            detail?.alternatifJadwal;

        if (
            !Array.isArray(daftarAlternatif) ||
            daftarAlternatif.length < 1 ||
            daftarAlternatif.length > 2
        ) {
            throw new Error(
                "Rekomendasi harus memiliki satu atau dua alternatif jadwal."
            );
        }

        const hasil = daftarAlternatif.map(
            (alternatif, index) => {
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
            }
        );

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
    // 27. PEMERIKSAAN BENTROKAN REKOMENDASI
    // ==========================================

    function cekKonflikRekomendasi(
        dataBaru,
        pengajuanId,
        rekomendasiId = null
    ) {
        const daftar =
            ambilSemua("recommendations");

        const rentangBaru = validasiJadwal(dataBaru);

        if (!rentangBaru.valid) {
            return null;
        }

        return (
            daftar.find((item) => {
                if (
                    String(item.id) ===
                    String(rekomendasiId)
                ) {
                    return false;
                }

                if (
                    String(item.pengajuanId) ===
                    String(pengajuanId)
                ) {
                    return false;
                }

                if (
                    !STATUS_REKOMENDASI_AKTIF.has(
                        String(item.status || "").toLowerCase()
                    )
                ) {
                    return false;
                }

                return rentangBertabrakan(
                    dataBaru,
                    item
                );
            }) || null
        );
    }

    // ==========================================
    // 28. BATAS KONFIRMASI REKOMENDASI
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
            ""
        );

        return Number.isFinite(dibuat)
            ? dibuat + BATAS_KONFIRMASI
            : NaN;
    }

    // ==========================================
    // 29. UPDATE METADATA KONFLIK
    // ==========================================

    function perbaruiMetadataRekomendasi(
        kasus,
        rekomendasi
    ) {
        const konflik = ambilSemua("conflicts");

        const index = konflik.findIndex(
            (item) =>
                String(
                    item.pengajuanId ||
                    item.sourceSubmissionId ||
                    item.id
                ) === String(kasus.pengajuanId)
        );

        if (index === -1) return;

        konflik[index] = {
            ...konflik[index],

            rekomendasiId: rekomendasi.id,

            rekomendasiStatus: rekomendasi.status,

            rekomendasiDikirimPada:
                rekomendasi.dikirimPada,

            kedaluwarsaPada:
                rekomendasi.kedaluwarsaPada
        };

        simpanSemua("conflicts", konflik);
    }

    // ==========================================
    // 30. MENGIRIM REKOMENDASI MULTI ALTERNATIF
    // ==========================================

    function kirimRekomendasi(idKasus, detail) {
        if (!idKasus) {
            throw new Error(
                "ID kasus tidak ditemukan."
            );
        }

        const kasus = getKasusTergeserById(idKasus);

        if (!kasus) {
            throw new Error(
                "Data kasus tergeser tidak ditemukan."
            );
        }

        const rekomendasiLama =
            ambilRekomendasiKasus(kasus);

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

        const alternatif = siapkanAlternatifRekomendasi(
            kasus,
            detail
        );

        const alternatifUtama = alternatif[0];

        const daftar =
            ambilSemua("recommendations");

        const sekarang = new Date();

        const waktuDikirim = sekarang.toISOString();

        const kedaluwarsa = new Date(
            sekarang.getTime() + BATAS_KONFIRMASI
        ).toISOString();

        const rekomendasiBaru = {
            ...alternatifUtama,

            id: buatIdRekomendasi(daftar),

            caseId: kasus.id,

            kasusId: kasus.id,

            pengajuanId: kasus.pengajuanId,

            antreanId: kasus.pengajuanId,

            bookingId: `BOOK-${kasus.pengajuanId}`,

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

        beriTahuPerubahan(
            "recommendations",
            "dikirim"
        );

        beriTahuPerubahan(
            "antrean",
            "rekomendasi_dikirim"
        );

        beriTahuPerubahan(
            "conflicts",
            "rekomendasi_dikirim"
        );

        beriTahuPerubahan(
            "penggunaTergeser",
            "rekomendasi_dikirim"
        );

        return {
            ...getKasusTergeserById(kasus.id),

            success: true,

            rekomendasiTerbaru:
                salinData(rekomendasiBaru),

            status: "rekomendasi_dikirim"
        };
    }

    // ==========================================
    // 31. EDIT REKOMENDASI MULTI ALTERNATIF
    // ==========================================

    function editRekomendasi(idKasus, detail) {
        const kasus = getKasusTergeserById(idKasus);

        if (!kasus) {
            throw new Error(
                "Data kasus tergeser tidak ditemukan."
            );
        }

        const rekomendasiLama =
            ambilRekomendasiKasus(kasus);

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

        const alternatif = siapkanAlternatifRekomendasi(
            kasus,
            detail,
            rekomendasiLama.id
        );

        const daftar =
            ambilSemua("recommendations");

        const index = daftar.findIndex(
            (item) =>
                String(item.id) ===
                String(rekomendasiLama.id)
        );

        if (index === -1) {
            throw new Error(
                "Data rekomendasi tidak ditemukan dalam penyimpanan."
            );
        }

        const diperbaruiPada =
            new Date().toISOString();

        const rekomendasiBaru = {
            ...daftar[index],

            ...alternatif[0],

            alternatifJadwal: alternatif,

            jumlahAlternatif: alternatif.length,

            catatan: String(
                detail.catatan || ""
            ).trim(),

            status: "rekomendasi_dikirim",

            diperbaruiPada,

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

        beriTahuPerubahan(
            "recommendations",
            "diedit"
        );

        beriTahuPerubahan(
            "conflicts",
            "rekomendasi_diedit"
        );

        beriTahuPerubahan(
            "penggunaTergeser",
            "rekomendasi_diedit"
        );

        return {
            ...getKasusTergeserById(kasus.id),

            success: true,

            rekomendasiTerbaru:
                salinData(rekomendasiBaru),

            status: "rekomendasi_dikirim"
        };
    }

    // ==========================================
    // 32. MENGIRIM KONFLIK KE KEPALA LAB
    // ==========================================

    function kirimKonflik(pengajuanIds) {
    if (
        !Array.isArray(pengajuanIds) ||
        pengajuanIds.length < 2
    ) {
        throw new Error(
            "Minimal dua pengajuan diperlukan untuk membentuk konflik."
        );
    }

    const ids = [
        ...new Set(pengajuanIds.map(String))
    ];

    const submissions = ambilSemua("submissions");

    const daftarPengajuan = submissions.filter(
        (item) => ids.includes(String(item.id))
    );

    if (daftarPengajuan.length !== ids.length) {
        throw new Error(
            "Sebagian pengajuan tidak ditemukan."
        );
    }

    // ======================================
    // 1. CEK KONFLIK YANG SUDAH PERNAH DIKIRIM
    // ======================================

    const konflik = ambilSemua("conflicts");

    const sudahAda = konflik.find(
        (group) =>
            group.status === "menunggu_keputusan" &&
            Array.isArray(group.pengajuan) &&
            group.pengajuan.length === ids.length &&
            ids.every((id) =>
                group.pengajuan.some(
                    (item) =>
                        String(item.id) === id
                )
            )
    );

    if (sudahAda) {
        return salinData(sudahAda);
    }

    // ======================================
    // 2. VALIDASI STATUS DAN BOOKING
    // ======================================

    const statusDiizinkan = [
        "bentrok",
        "verifikasi",
        "menunggu_verifikasi",
        "disetujui"
    ];

    const bookings = ambilSemuaBooking();

    const tanggal = normalisasiPengajuan(
        daftarPengajuan[0]
    ).tanggal;

    for (const pengajuan of daftarPengajuan) {
        const status = String(
            pengajuan.status || ""
        ).toLowerCase();

        const data = normalisasiPengajuan(
            pengajuan
        );

        if (
            !statusDiizinkan.includes(status) ||
            data.tanggal !== tanggal
        ) {
            throw new Error(
                "Pengajuan tidak memenuhi syarat untuk dikirim sebagai kelompok konflik."
            );
        }

        // Booking yang sebelumnya disetujui
        // harus benar-benar memiliki booking aktif.
        if (status === "disetujui") {
            const booking = bookings.find(
                (item) =>
                    String(item.sourceSubmissionId) ===
                        String(pengajuan.id) ||
                    String(item.id) ===
                        `BOOK-${pengajuan.id}`
            );

            if (
                !booking ||
                !bookingMasihAktif(booking)
            ) {
                throw new Error(
                    `Booking pengajuan ${pengajuan.id} tidak lagi aktif.`
                );
            }
        }
    }

    // ======================================
    // 3. PASTIKAN ANGGOTA MEMILIKI BENTROKAN
    // ======================================

    const setiapAnggotaBerbenturan =
        daftarPengajuan.every(
            (pengajuan, index) =>
                daftarPengajuan.some(
                    (anggotaLain, indexLain) =>
                        index !== indexLain &&
                        rentangBertabrakan(
                            pengajuan,
                            anggotaLain
                        )
                )
        );

    if (!setiapAnggotaBerbenturan) {
        throw new Error(
            "Tidak semua pengajuan memiliki hubungan bentrokan dengan anggota kelompok lainnya."
        );
    }

    // ======================================
    // 4. PASTIKAN TIDAK ADA KONFLIK DI LUAR KELOMPOK
    // ======================================

    for (const pengajuan of daftarPengajuan) {
        const hasilKonflik = cekKonflikJadwal(
            pengajuan,
            ids
        );

        if (hasilKonflik.bentrok) {
            throw new Error(
                `Pengajuan ${pengajuan.id} masih berbenturan dengan booking lain di luar kelompok konflik.`
            );
        }
    }

    // ======================================
    // 5. MEMBUAT IDENTITAS KELOMPOK KONFLIK
    // ======================================

    const idKonflik =
        `CONFLICT-${Date.now()}`;

    const waktuPengiriman =
        new Date().toISOString();

    // ======================================
    // 6. MENGUBAH STATUS ANGGOTA KELOMPOK
    // ======================================

    const submissionsBaru = submissions.map(
        (item) => {
            if (!ids.includes(String(item.id))) {
                return item;
            }

            return {
                ...item,

                statusSebelumKeputusan:
                    item.status,

                status: "menunggu_keputusan",

                konflikId: idKonflik,

                konflikDikirimPada:
                    waktuPengiriman
            };
        }
    );

    const daftarAnggota = submissionsBaru.filter(
        (item) =>
            ids.includes(String(item.id))
    );

    // ======================================
    // 7. MEMBENTUK DATA KELOMPOK KONFLIK
    // ======================================

    const groupBaru = {
        id: idKonflik,

        jenis: "bentrok_jadwal",

        tanggal,

        status: "menunggu_keputusan",

        dibuatPada: waktuPengiriman,

        dikirimPada: waktuPengiriman,

        pengajuan: daftarAnggota.map((item) => ({
            ...item,

            pemohon:
                item.namaPemohon ||
                item.pemohon ||
                "-",

            mulai:
                item.mulai ||
                item.waktuMulai,

            selesai:
                item.selesai ||
                item.waktuSelesai
        }))
    };

    // ======================================
    // 8. MENYIMPAN DATA
    // ======================================

    simpanSemua(
        "submissions",
        submissionsBaru
    );

    konflik.push(groupBaru);

    simpanSemua(
        "conflicts",
        konflik
    );

    // ======================================
    // 9. MEMBERITAHU PERUBAHAN DATA
    // ======================================

    beriTahuPerubahan(
        "submissions",
        "konflik_dikirim"
    );

    beriTahuPerubahan(
        "antrean",
        "konflik_dikirim"
    );

    beriTahuPerubahan(
        "conflicts",
        "konflik_dikirim"
    );

    beriTahuPerubahan(
        "bookings",
        "konflik_dikirim"
    );

    return salinData(groupBaru);
}

    // ==========================================
    // 33. MENGAMBIL KELOMPOK KONFLIK
    // ==========================================

    function getKonflik() {
        return ambilSemua("conflicts");
    }

    // ==========================================
    // 34. KEPUTUSAN KONFLIK KEPALA LAB
    // ==========================================

    function putuskanKonflik(
        idKonflik,
        selectedId
    ) {
        const konflik = ambilSemua("conflicts");

        const index = konflik.findIndex(
            (item) =>
                String(item.id) === String(idKonflik)
        );

        if (index === -1) {
            throw new Error(
                "Kelompok konflik tidak ditemukan."
            );
        }

        const group = konflik[index];

        if (group.status !== "menunggu_keputusan") {
            throw new Error(
                "Konflik sudah diputuskan."
            );
        }

        if (
            !Array.isArray(group.pengajuan) ||
            group.pengajuan.length < 2
        ) {
            throw new Error(
                "Data anggota kelompok konflik tidak valid."
            );
        }

        const idTerpilih = String(selectedId);

        const terpilih = group.pengajuan.find(
            (item) =>
                String(item.id) === idTerpilih
        );

        if (!terpilih) {
            throw new Error(
                "Pengajuan pilihan tidak ditemukan."
            );
        }

        const submissions =
            ambilSemua("submissions");

        const semuaTersedia = group.pengajuan.every(
            (item) =>
                submissions.some(
                    (submission) =>
                        String(submission.id) ===
                        String(item.id) &&
                        submission.status === "menunggu_keputusan"
                )
        );

        if (!semuaTersedia) {
            throw new Error(
                "Data pengajuan berubah. Keputusan tidak dapat disimpan."
            );
        }

        // Validasi ulang jadwal dan kapasitas pengajuan terpilih.
        const dataTerpilih =
            normalisasiPengajuan(terpilih);

        const rentang = validasiJadwal(dataTerpilih);

        if (!rentang.valid) {
            throw new Error(rentang.pesan);
        }

        const kapasitas =
            validasiKapasitas(dataTerpilih);

        if (!kapasitas.valid) {
            throw new Error(kapasitas.pesan);
        }

        // Pastikan keputusan tidak menimbulkan bentrok baru
        // dengan booking lain di luar kelompok konflik.
    const idsKelompok = group.pengajuan.map(
    (item) => String(item.id)
);

const konflikLain = cekKonflikJadwal(
    dataTerpilih,
    idsKelompok
);

        if (konflikLain.bentrok) {
            throw new Error(
                "Pengajuan pilihan masih bertabrakan dengan booking lain di luar kelompok konflik."
            );
        }

        const waktuKeputusan =
            new Date().toISOString();

        
        const displaced = [];
        const dikembalikan = [];

        // Memproses status setiap anggota berdasarkan
        // bentrokan terhadap pengajuan yang dipilih.
        const submissionsBaru = submissions.map((item) => {

            const anggotaKelompok = group.pengajuan.some(
                (anggota) =>
                    String(anggota.id) === String(item.id)
            );

            if (!anggotaKelompok) return item;

            // 1. Pengajuan yang dipilih Kepala Lab.
            if (String(item.id) === idTerpilih) {
                return {
                    ...item,
                    status: "disetujui",
                    keputusanKonflik: idKonflik,
                    diputuskanPada: waktuKeputusan,
                    konflikAktif: false
                };
            }

            // 2. Periksa bentrokan langsung dengan pilihan.
            const berbenturan = rentangBertabrakan(
                item,
                terpilih
            );

            // 3. Jika berbenturan, masukkan ke kasus tergeser.
            if (berbenturan) {
                displaced.push(item.id);

                return {
                    ...item,
                    status: "tergeser",
                    keputusanKonflik: idKonflik,
                    diputuskanPada: waktuKeputusan,
                    konflikAktif: false
                };
            }

            // 4. Jika tidak berbenturan, pulihkan status sebelumnya.
            dikembalikan.push(item.id);

            const statusSebelumnya =
                item.statusSebelumBentrok ||
                item.statusSebelumKeputusan ||
                "verifikasi";

            const statusPulih =
                String(statusSebelumnya).toLowerCase() === "bentrok"
                    ? "verifikasi"
                    : statusSebelumnya;

            return {
                ...item,
                status: statusPulih,
                keputusanKonflik: idKonflik,
                diputuskanPada: waktuKeputusan,
                konflikAktif: false
            };
        });


        // Cari nama pengajuan yang terpilih.
        const pengajuanTerpilih =
            submissionsBaru.find(
                (item) =>
                    String(item.id) === idTerpilih
            );

        const namaPenggeser =
            pengajuanTerpilih?.namaPemohon ||
            pengajuanTerpilih?.pemohon ||
            pengajuanTerpilih?.nama ||
            "-";

        // Buat kasus rekomendasi untuk pengajuan tergeser.
        const konflikDiperbarui = [...konflik];

        
        const anggotaDiperbarui = group.pengajuan.map((item) => {

            const hasil = submissionsBaru.find(
                (submission) =>
                    String(submission.id) === String(item.id)
            );

            return {
                ...item,
                ...(hasil || {}),
                status: hasil?.status || item.status
            };
        });


        // Memperbarui riwayat kelompok konflik.
        konflikDiperbarui[index] = {
            ...group,

            status: "selesai",

            pengajuanTerpilih: idTerpilih,

            diputuskanPada: waktuKeputusan,

            hasilKeputusan: {
                disetujui: idTerpilih,
                tergeser: displaced,
                tidakTergeser: dikembalikan
            },

            pengajuan: anggotaDiperbarui
        };

        // Membuat kasus rekomendasi untuk anggota tergeser.
        displaced.forEach((idPengajuan) => {

            const pengajuan = submissionsBaru.find(
                (item) =>
                    String(item.id) === String(idPengajuan)
            );

            if (!pengajuan) return;

            const sudahAda = konflikDiperbarui.some(
                (item) =>
                    String(item.pengajuanId) ===
                        String(idPengajuan) &&
                    item.jenis === "kasus_tergeser"
            );

            if (sudahAda) return;

            const data = normalisasiPengajuan(pengajuan);

            konflikDiperbarui.push({
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

                jadwalAsal:
                    `${data.tanggal}T${data.waktuMulai}:00+09:00`,

                kebutuhanPC: data.kebutuhanPC,

                kebutuhanKursi: data.kebutuhanKursi,

                alasan:
                    "Pengajuan tergeser akibat keputusan penyelesaian konflik Kepala Lab.",

                pengajuanPenggeserId: idTerpilih,

                namaPenggeser,

                status: "menunggu_rekomendasi",

                dibuatPada: waktuKeputusan
            });
        });



        // Simpan seluruh hasil keputusan.
        simpanSemua("submissions", submissionsBaru);

        simpanSemua("conflicts", konflikDiperbarui);

        beriTahuPerubahan(
            "submissions",
            "keputusan_konflik"
        );

        beriTahuPerubahan(
            "antrean",
            "keputusan_konflik"
        );

        beriTahuPerubahan(
            "conflicts",
            "keputusan_konflik"
        );

        beriTahuPerubahan(
            "penggunaTergeser",
            "kasus_tergeser"
        );

        beriTahuPerubahan(
            "bookings",
            "keputusan_konflik"
        );

        return {
            berhasil: true,

            pesan:
                "Keputusan konflik dan kasus tergeser berhasil disimpan.",

            terpilih: idTerpilih,

            tergeser: displaced
        };
    }

    // ==========================================
    // 35. EKSPOR LAYANAN SILAB
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
        batalkanPersetujuan,
        bolehBatalkanPersetujuan,

        // Validasi jadwal dan kapasitas
        validasiJadwal,
        validasiKapasitas,
        cekKonflikJadwal,
        deteksiBentrokJadwal,

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
        inisialisasiData

    });

})(window);
