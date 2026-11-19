
/**
 * ==========================================================
 * LAYANAN DATA SILAB - MODUL LABORAN
 * ==========================================================
 *
 * Tanggung jawab:
 * 1. Inisialisasi dan pengelolaan data.
 * 2. Pengambilan data antrean dan booking.
 * 3. Validasi kapasitas dan jadwal.
 * 4. Deteksi bentrok booking dan pengajuan aktif.
 * 5. Persetujuan, penolakan, dan pembatalan.
 * 6. Pengelolaan presensi.
 * 7. Pembuatan dan pengiriman rekomendasi.
 * 8. Pengelolaan rekomendasi kedaluwarsa.
 * 9. Pengiriman dan keputusan konflik Kepala Lab.
 *
 * Catatan:
 * - Penyimpanan masih menggunakan LocalStorage.
 * - Decision Tree belum dimasukkan ke modul ini.
 * - Zona waktu operasional menggunakan WIT (UTC+9).
 */

(function (window) {
    "use strict";

    // ======================================================
    // 1. DEPENDENSI DAN KONFIGURASI
    // ======================================================

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
        "tergeser",
        "kedaluwarsa"
    ]);

    const STATUS_BOOKING_MENUNGGU_PRESENSI = new Set([
        "terjadwal",
        "menunggu_presensi"
    ]);

    const BATAS_KONFIRMASI = 24 * 60 * 60 * 1000;

    // ======================================================
    // 2. FUNGSI DASAR STORAGE
    // ======================================================

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
        if (data === undefined) return undefined;
        if (data === null) return null;

        return JSON.parse(JSON.stringify(data));
    }

    function ambilSemua(namaKoleksi) {
        const data = storage.get(
            ambilKey(namaKoleksi),
            []
        );

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

    /**
     * Menyimpan beberapa koleksi secara berurutan.
     * Jika salah satu penyimpanan gagal, data sebelumnya
     * diusahakan dikembalikan.
     *
     * Catatan: ini merupakan rollback simulasi,
     * bukan transaksi database yang sesungguhnya.
     */
    function simpanTransaksi(perubahan) {
        const daftar = Object.entries(perubahan);
        const cadangan = {};

        daftar.forEach(([namaKoleksi]) => {
            cadangan[namaKoleksi] =
                ambilSemua(namaKoleksi);
        });

        const berhasil = [];

        try {
            daftar.forEach(([namaKoleksi, data]) => {
                simpanSemua(namaKoleksi, data);
                berhasil.push(namaKoleksi);
            });

            return true;

        } catch (error) {
            berhasil.reverse().forEach((namaKoleksi) => {
                try {
                    simpanSemua(
                        namaKoleksi,
                        cadangan[namaKoleksi]
                    );
                } catch (errorRollback) {
                    console.error(
                        "Rollback penyimpanan gagal:",
                        errorRollback
                    );
                }
            });

            throw error;
        }
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

    function beriTahuBanyakPerubahan(daftar) {
        daftar.forEach(({ koleksi, aksi }) => {
            beriTahuPerubahan(koleksi, aksi);
        });
    }

    function buatTimestamp() {
        return new Date().toISOString();
    }

    // ======================================================
    // 3. INISIALISASI DATA SIMULASI
    // ======================================================

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

        // Data yang sudah tersimpan tidak ditimpa seed.
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

    // ======================================================
    // 4. NORMALISASI WAKTU
    // ======================================================

    function pecahWaktu(nilai, tanggalFallback = "") {
        if (typeof nilai !== "string" || !nilai) {
            return {
                tanggal: tanggalFallback,
                jam: ""
            };
        }

        // Format jam saja.
        if (/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(nilai)) {
            return {
                tanggal: tanggalFallback,
                jam: nilai
            };
        }

        // Format tanggal dan jam lokal.
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
            tanggal:
                `${bagian.year}-${duaDigit(bagian.month)}-${duaDigit(bagian.day)}`,

            jam:
                `${duaDigit(bagian.hour)}:${duaDigit(bagian.minute)}`
        };
    }

    function tanggalValid(tanggal) {
        if (
            typeof tanggal !== "string" ||
            !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)
        ) {
            return false;
        }

        const nilai = new Date(
            `${tanggal}T00:00:00Z`
        );

        if (Number.isNaN(nilai.getTime())) {
            return false;
        }

        return (
            nilai.toISOString().slice(0, 10) === tanggal
        );
    }

    // ======================================================
    // 5. NORMALISASI DATA PENGAJUAN
    // ======================================================

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
                data.tanggalSelesai ||
                selesai.tanggal ||
                tanggal,

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
        if (!data) {
            return {
                valid: false,
                pesan: "Data jadwal tidak tersedia."
            };
        }

        if (
            !tanggalValid(data.tanggal) ||
            !tanggalValid(data.tanggalSelesai)
        ) {
            return {
                valid: false,
                pesan: "Tanggal peminjaman tidak valid."
            };
        }

        if (data.tanggal !== data.tanggalSelesai) {
            return {
                valid: false,
                pesan:
                    "Peminjaman tidak boleh melewati pergantian tanggal."
            };
        }

        if (
            !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
                data.waktuMulai
            ) ||
            !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
                data.waktuSelesai
            )
        ) {
            return {
                valid: false,
                pesan: "Format waktu peminjaman tidak valid."
            };
        }

        if (typeof waktu.validasiRentang !== "function") {
            throw new Error(
                "Fungsi validasiRentang tidak ditemukan pada SILABWaktu."
            );
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

    // ======================================================
    // 6. PEMERIKSAAN RENTANG BENTROK
    // ======================================================

    function rentangBertabrakan(dataPertama, dataKedua) {
        const pertama = normalisasiPengajuan(dataPertama);
        const kedua = normalisasiPengajuan(dataKedua);

        if (!pertama || !kedua) return false;

        if (
            pertama.tanggal !== kedua.tanggal ||
            pertama.tanggalSelesai !== kedua.tanggalSelesai
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

        // Interval [mulai, selesai).
        // Jadwal 08.00-10.00 dan 10.00-12.00 tidak bentrok.
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

    // ======================================================
    // 7. PEMBENTUKAN DATA BOOKING
    // ======================================================

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
                buatTimestamp()
        };
    }

    // ======================================================
    // 8. MENGAMBIL SELURUH BOOKING
    // ======================================================

    function ambilSemuaBooking() {
        const daftarBooking = new Map();

        const submissions = ambilSemua("submissions");

        const dataPengajuan = new Map(
            submissions.map((item) => [
                String(item.id),
                item
            ])
        );

        // A. Booking dari data simulasi.
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

                // Jika pengajuan terkait sudah tidak memenuhi
                // status booking, jangan pertahankan booking lama.
                if (
                    pengajuanTerkait &&
                    ![
                        "disetujui",
                        "menunggu_keputusan"
                    ].includes(statusPengajuan)
                ) {
                    return;
                }

                // Booking mandiri dari seed tetap dipertahankan.
                daftarBooking.set(
                    String(booking.id),
                    salinData(booking)
                );
            });
        }

        // B. Booking dari pengajuan yang disetujui
        // atau menunggu keputusan Kepala Lab.
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

        // C. Mengambil catatan presensi terbaru.
        const attendance = ambilSemua("attendance");

        const presensiTerakhir = new Map();

        attendance.forEach((catatan) => {
            if (!catatan.bookingId) return;

            const id = String(catatan.bookingId);
            const lama = presensiTerakhir.get(id);

            const waktuBaru =
                Date.parse(catatan.dicatatPada || "") || 0;

            const waktuLama =
                Date.parse(lama?.dicatatPada || "") || 0;

            if (!lama || waktuBaru >= waktuLama) {
                presensiTerakhir.set(id, catatan);
            }
        });

        // D. Menggabungkan booking dengan presensi.
        return Array.from(daftarBooking.values()).map(
            (booking) => {
                const catatan = presensiTerakhir.get(
                    String(booking.id)
                );

                if (!catatan) return booking;

                if (
                    booking.status === "menunggu_keputusan"
                ) {
                    return booking;
                }

                return {
                    ...booking,

                    status: catatan.status,

                    statusPresensiAsli: catatan.status,

                    presensi: {
                        status: catatan.status,
                        dicatatPada: catatan.dicatatPada
                    }
                };
            }
        );
    }

    // ======================================================
    // 9. PENGAMBILAN PENGAJUAN AKTIF
    // ======================================================

    function ambilPengajuanAktif() {
        return ambilSemua("submissions").filter(
            (item) =>
                STATUS_ANTREAN_AKTIF.has(
                    String(item.status || "").toLowerCase()
                )
        );
    }

    // ======================================================
    // 10. VALIDASI KAPASITAS
    // ======================================================

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
        if (!data) {
            return {
                valid: false,
                pesan: "Data kebutuhan fasilitas tidak tersedia."
            };
        }

        const kapasitas = ambilKapasitas();

        const kebutuhanPC = Number(data.kebutuhanPC);
        const kebutuhanKursi = Number(data.kebutuhanKursi);

        if (
            !Number.isInteger(kebutuhanPC) ||
            !Number.isInteger(kebutuhanKursi) ||
            kebutuhanPC <= 0 ||
            kebutuhanKursi <= 0
        ) {
            return {
                valid: false,
                pesan:
                    "Kebutuhan PC dan kursi harus berupa bilangan bulat positif."
            };
        }

        if (
            kebutuhanPC > kapasitas.kapasitasPC ||
            kebutuhanKursi > kapasitas.kapasitasKursi
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
                "Kapasitas fasilitas memenuhi kebutuhan.",
            kapasitas
        };
    }

    // ======================================================
    // 11. PEMERIKSAAN KONFLIK TERPUSAT
    // ======================================================

    /**
     * Pemeriksaan dilakukan terhadap:
     * 1. Booking aktif.
     * 2. Pengajuan aktif yang belum menjadi booking.
     *
     * bookingId dapat berupa satu ID atau array ID
     * yang dikecualikan dari pemeriksaan.
     */
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
                daftarBooking: [],
                daftarPengajuan: [],
                daftarKonflik: []
            };
        }

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
                daftarPengecualian.add(id.substring(5));
            } else {
                daftarPengecualian.add(id);
                daftarPengecualian.add(`BOOK-${id}`);
            }
        });

        const daftarBooking = ambilSemuaBooking().filter(
            (booking) => {
                if (!bookingMasihAktif(booking)) {
                    return false;
                }

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

                return rentangBertabrakan(data, booking);
            }
        );

        const daftarPengajuan = ambilPengajuanAktif().filter(
            (pengajuan) => {
                const id = String(pengajuan.id);

                if (daftarPengecualian.has(id)) {
                    return false;
                }

                // Pengajuan yang sudah menjadi booking
                // tidak perlu dihitung dua kali.
                const sudahMenjadiBooking =
                    daftarBooking.some(
                        (booking) =>
                            String(booking.sourceSubmissionId) === id ||
                            String(booking.id) === `BOOK-${id}`
                    );

                if (sudahMenjadiBooking) {
                    return false;
                }

                return rentangBertabrakan(
                    data,
                    pengajuan
                );
            }
        );

        const daftarKonflik = [
            ...daftarBooking.map((booking) => ({
                jenis: "booking",
                id: booking.sourceSubmissionId || booking.id,
                bookingId: booking.id,
                namaPemohon: booking.namaPemohon || "-",
                namaKegiatan: booking.namaKegiatan || "-",
                waktuMulai: booking.waktuMulai,
                waktuSelesai: booking.waktuSelesai
            })),

            ...daftarPengajuan.map((pengajuan) => ({
                jenis: "pengajuan",
                id: pengajuan.id,
                namaPemohon: pengajuan.namaPemohon || "-",
                namaKegiatan: pengajuan.namaKegiatan || "-",
                waktuMulai: pengajuan.waktuMulai,
                waktuSelesai: pengajuan.waktuSelesai
            }))
        ];

        return {
            bentrok: daftarKonflik.length > 0,

            valid: true,

            pesan: daftarKonflik.length
                ? "Jadwal bertabrakan dengan data lain yang masih aktif."
                : "Tidak ditemukan bentrokan jadwal.",

            booking: daftarBooking[0] || null,

            daftarBooking: salinData(daftarBooking),

            daftarPengajuan: salinData(daftarPengajuan),

            daftarKonflik
        };
    }

    // ======================================================
    // 12. DETEKSI BENTROK PENGAJUAN
    // ======================================================

    function deteksiBentrokJadwal(pengajuanId) {
        const pengajuan = ambilSemua("submissions").find(
            (item) =>
                String(item.id) === String(pengajuanId)
        );

        if (!pengajuan) {
            throw new Error("Pengajuan tidak ditemukan.");
        }

        const data = normalisasiPengajuan(pengajuan);

        const hasil = cekKonflikJadwal(
            data,
            pengajuanId
        );

        return {
            bentrok: hasil.bentrok,

            valid: hasil.valid,

            jumlahBentrok: hasil.daftarKonflik.length,

            pengajuan: salinData(data),

            daftarBooking: hasil.daftarBooking,

            daftarPengajuan: hasil.daftarPengajuan,

            daftarKonflik: hasil.daftarKonflik
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

    // ======================================================
    // 13. PENGAMBILAN SELURUH DATA
    // ======================================================

    function getAll(namaKoleksi) {

        // A. BOOKING
        if (namaKoleksi === "bookings") {
            const bookings = ambilSemuaBooking();

            return salinData(
                bookings.map((booking) => {
                    if (!bookingMasihAktif(booking)) {
                        return booking;
                    }

                    if (
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

                        statusSebelumBentrok:
                            booking.status,

                        statusPresensiAsli:
                            booking.presensi?.status ||
                            booking.status,

                        status: "bentrok",

                        konflikAktif: true,

                        konflikDengan:
                            pengajuanBentrok.map((item) => ({
                                id: item.id,

                                namaPemohon:
                                    item.namaPemohon || "-",

                                namaKegiatan:
                                    item.namaKegiatan || "-",

                                waktuMulai: item.waktuMulai,

                                waktuSelesai: item.waktuSelesai
                            }))
                    };
                })
            );
        }

        // B. PENGGUNA TERGESER / KASUS TERGESER
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

        // C. KOLEKSI BIASA
        const data = ambilSemua(namaKoleksi);

        if (
            namaKoleksi === "antrean" ||
            namaKoleksi === "submissions"
        ) {
            return data.map((pengajuan) => {
                const hasil =
                    normalisasiPengajuan(pengajuan);

                const status = String(
                    pengajuan.status || ""
                ).toLowerCase();

                if (
                    ![
                        "disetujui",
                        "verifikasi",
                        "menunggu_verifikasi",
                        "bentrok"
                    ].includes(status)
                ) {
                    return hasil;
                }

                const konflik = cekKonflikJadwal(
                    hasil,
                    pengajuan.id
                );

                if (konflik.bentrok) {
                    return {
                        ...hasil,

                        statusSebelumBentrok:
                            pengajuan.statusSebelumBentrok ||
                            pengajuan.status,

                        status: "bentrok",

                        konflikAktif: true,

                        konflikDengan:
                            konflik.daftarKonflik
                    };
                }

                // Jika bentrok lama sudah tidak aktif,
                // kembalikan pengajuan pending ke verifikasi.
                if (status === "bentrok") {
                    return {
                        ...hasil,

                        status: "verifikasi",

                        konflikAktif: false,

                        konflikDengan: []
                    };
                }

                return {
                    ...hasil,
                    konflikAktif: false
                };
            });
        }

        // D. REKOMENDASI
        if (
            namaKoleksi === "rekomendasi" ||
            namaKoleksi === "recommendations"
        ) {
            kedaluwarsakanRekomendasi();
            return ambilSemua("recommendations");
        }

        return data;
    }

    // ======================================================
    // 14. PENGAMBILAN DATA BERDASARKAN ID
    // ======================================================

    function getById(namaKoleksi, id) {
        if (!id) return null;

        const data = getAll(namaKoleksi);

        return data.find(
            (item) =>
                String(item.id) === String(id)
        ) || null;
    }

    // ======================================================
    // 15. PENGAMBILAN ANTREAN AKTIF
    // ======================================================

    function getAntreanAktif() {
        return getAll("antrean").filter(
            (item) =>
                STATUS_ANTREAN_AKTIF.has(
                    String(item.status || "").toLowerCase()
                )
        );
    }

    // ======================================================
    // 16. PEMERIKSAAN PEMBATALAN BOOKING
    // ======================================================

    function bolehBatalkanPersetujuan(pengajuanId) {
        if (!pengajuanId) return false;

        const id = String(pengajuanId).startsWith("BOOK-")
            ? String(pengajuanId).substring(5)
            : String(pengajuanId);

        const submissions = ambilSemua("submissions");

        const pengajuan = submissions.find(
            (item) =>
                String(item.id) === id
        );

        if (
            !pengajuan ||
            pengajuan.status !== "disetujui"
        ) {
            return false;
        }

        const bookingId = `BOOK-${id}`;

        const attendance = ambilSemua("attendance");

        const sudahPresensi = attendance.some(
            (item) =>
                String(item.bookingId) === bookingId
        );

        if (sudahPresensi) return false;

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

    // ======================================================
    // 17. PERSETUJUAN PENGAJUAN
    // ======================================================

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
            ["disetujui", "ditolak", "tergeser"].includes(
                String(pengajuan.status).toLowerCase()
            )
        ) {
            throw new Error(
                "Pengajuan sudah memiliki status akhir."
            );
        }

        if (
            !STATUS_ANTREAN_AKTIF.has(
                String(pengajuan.status || "").toLowerCase()
            )
        ) {
            throw new Error(
                "Pengajuan tidak berada dalam antrean verifikasi."
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

        // Pemeriksaan booking dan pengajuan aktif.
        const konflik = cekKonflikJadwal(
            data,
            pengajuan.id
        );

        if (konflik.bentrok) {
            submissions[index] = {
                ...pengajuan,

                status: "bentrok",

                statusSebelumBentrok:
                    pengajuan.statusSebelumBentrok ||
                    pengajuan.status,

                konflikAktif: true,

                bentrokTerdeteksiPada: buatTimestamp()
            };

            simpanSemua(
                "submissions",
                submissions
            );

            beriTahuBanyakPerubahan([
                { koleksi: "antrean", aksi: "bentrok" },
                { koleksi: "bookings", aksi: "bentrok" }
            ]);

            throw new Error(
                "Pengajuan tidak dapat disetujui karena masih terdapat bentrokan jadwal. Pengajuan perlu diproses melalui penyelesaian konflik."
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

            diverifikasiPada: buatTimestamp(),

            konflikAktif: false
        };

        simpanSemua("submissions", submissions);

        beriTahuBanyakPerubahan([
            { koleksi: "bookings", aksi: "disetujui" },
            { koleksi: "antrean", aksi: "disetujui" }
        ]);

        return {
            pengajuan: salinData(submissions[index]),

            booking: salinData(
                bentukBooking(submissions[index])
            )
        };
    }

    // ======================================================
    // 18. PENOLAKAN PENGAJUAN
    // ======================================================

    function tolakPengajuan(pengajuanId) {
        if (!pengajuanId) {
            throw new Error(
                "ID pengajuan tidak ditemukan."
            );
        }

        const submissions = ambilSemua("submissions");
        const index = submissions.findIndex(
            (item) => String(item.id) === String(pengajuanId)
        );

        if (index === -1) {
            throw new Error("Pengajuan tidak ditemukan.");
        }

        const status = String(
            submissions[index].status || ""
        ).toLowerCase();

        if (!STATUS_ANTREAN_AKTIF.has(status)) {
            throw new Error(
                "Pengajuan tidak berada dalam status yang dapat ditolak."
            );
        }

        // Penolakan hanya mengubah status tanpa menyimpan alasan.
        const pengajuanDiperbarui = { ...submissions[index] };

        submissions[index] = {
            ...pengajuanDiperbarui,
            status: "ditolak",
            konflikAktif: false,
            diverifikasiPada: buatTimestamp()
        };

        simpanSemua("submissions", submissions);
        beriTahuBanyakPerubahan([
            { koleksi: "antrean", aksi: "ditolak" },
            { koleksi: "bookings", aksi: "ditolak" }
        ]);

        return salinData(submissions[index]);
    }

    // ======================================================
    // 19. MEMBATALKAN BOOKING SEBELUM PRESENSI
    // ======================================================

    function batalkanPersetujuan(pengajuanId) {
        if (!pengajuanId) {
            throw new Error(
                "ID pengajuan tidak ditemukan."
            );
        }

        const id = String(pengajuanId).startsWith("BOOK-")
            ? String(pengajuanId).substring(5)
            : String(pengajuanId);

        const submissions = ambilSemua("submissions");

        const index = submissions.findIndex(
            (item) =>
                String(item.id) === id
        );

        if (index === -1) {
            throw new Error("Pengajuan tidak ditemukan.");
        }

        if (!bolehBatalkanPersetujuan(id)) {
            throw new Error(
                "Pembatalan hanya diperbolehkan untuk booking yang masih menunggu presensi dan belum memiliki catatan presensi."
            );
        }

        const pengajuan = submissions[index];

        const bookingAsal = bentukBooking(pengajuan);

        const konflik = cekKonflikJadwal(
            bookingAsal,
            id
        );

        const waktuPembatalan = buatTimestamp();

        const idBentrok = [
            ...new Set([
                ...konflik.daftarBooking.map(
                    (item) =>
                        String(
                            item.sourceSubmissionId ||
                            item.id
                        )
                ),

                ...konflik.daftarPengajuan.map(
                    (item) => String(item.id)
                )
            ])
        ];

        const idPengajuanBentrok =
            konflik.daftarPengajuan.map(
                (item) => String(item.id)
            );

        // Booking yang dibatalkan kembali ke antrean.
        submissions[index] = {
            ...pengajuan,

            status: konflik.bentrok
                ? "bentrok"
                : "verifikasi",

            statusSebelumBentrok: "disetujui",

            persetujuanDibatalkanPada:
                waktuPembatalan,

            alasanPembatalan:
                konflik.bentrok
                    ? "Persetujuan dibatalkan dan ditemukan bentrokan jadwal."
                    : "Persetujuan dibatalkan oleh Laboran.",

            konflikDengan: idBentrok,

            konflikAktif: konflik.bentrok
        };

        // Pengajuan lain yang berbenturan juga ditandai.
        idPengajuanBentrok.forEach((idLain) => {
            const posisi = submissions.findIndex(
                (item) =>
                    String(item.id) === idLain
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

        beriTahuBanyakPerubahan([
            {
                koleksi: "antrean",
                aksi: "persetujuan_dibatalkan"
            },
            {
                koleksi: "bookings",
                aksi: "persetujuan_dibatalkan"
            },
            {
                koleksi: "submissions",
                aksi: "bentrok"
            }
        ]);

        return {
            ...salinData(submissions[index]),

            berhasil: true,

            jumlahPengajuanBentrok:
                idPengajuanBentrok.length,

            pengajuanBentrok:
                salinData(
                    konflik.daftarPengajuan
                )
        };
    }

    // ======================================================
    // 20. UPDATE ANTREAN
    // ======================================================

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
            typeof perubahan !== "object" ||
            Array.isArray(perubahan)
        ) {
            throw new Error(
                "Data perubahan tidak valid."
            );
        }

        if (perubahan.status === "disetujui") {
            return setujuiPengajuan(id);
        }

        if (perubahan.status === "ditolak") {
            return tolakPengajuan(id);
        }

        throw new Error(
            "Keputusan pengajuan tidak dikenali."
        );
    }

    // ======================================================
    // 21. PENGELOLAAN PRESENSI
    // ======================================================

    function updatePresensi(bookingId, status) {
        const statusValid = [
            "digunakan",
            "tidak_digunakan"
        ];

        if (!bookingId) {
            throw new Error(
                "ID booking wajib tersedia."
            );
        }

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

        // Validasi ulang jadwal booking.
        const jadwal = validasiJadwal(
            normalisasiPengajuan(booking)
        );

        if (!jadwal.valid) {
            throw new Error(
                `Jadwal booking tidak valid: ${jadwal.pesan}`
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

        const waktuPencatatan = buatTimestamp();

        const catatanBaru = {
            id: `${bookingId}-${status}`,
            bookingId,
            status,
            dicatatPada: waktuPencatatan
        };

        attendance.push(catatanBaru);

        simpanSemua("attendance", attendance);

        beriTahuBanyakPerubahan([
            { koleksi: "bookings", aksi: "presensi" },
            { koleksi: "attendance", aksi: "presensi" }
        ]);

        return {
            ...booking,

            status,

            presensi: {
                status,
                dicatatPada: waktuPencatatan
            }
        };
    }

    // ======================================================
    // 22. ID REKOMENDASI
    // ======================================================

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

    // ======================================================
    // 23. BATAS KONFIRMASI REKOMENDASI
    // ======================================================

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

    /**
     * Menandai rekomendasi yang melewati batas waktu.
     * Riwayat rekomendasi tetap dipertahankan.
     */
    function kedaluwarsakanRekomendasi() {
        const daftar =
            ambilSemua("recommendations");

        const sekarang = Date.now();

        let berubah = false;

        const hasil = daftar.map((item) => {
            const status = String(
                item.status || ""
            ).toLowerCase();

            if (
                !STATUS_REKOMENDASI_AKTIF.has(status)
            ) {
                return item;
            }

            const batas = ambilBatasRekomendasi(item);

            if (
                !Number.isFinite(batas) ||
                sekarang < batas
            ) {
                return item;
            }

            berubah = true;

            return {
                ...item,

                status: "kedaluwarsa",

                kedaluwarsaDiprosesPada:
                    buatTimestamp()
            };
        });

        if (berubah) {
            simpanSemua("recommendations", hasil);

            beriTahuPerubahan(
                "recommendations",
                "kedaluwarsa"
            );
        }

        return hasil;
    }

    // ======================================================
    // 24. VALIDASI SLOT REKOMENDASI
    // ======================================================

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
        const selesai = pecahWaktu(detail.waktuSelesai);

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

        const kapasitas = validasiKapasitas(dataJadwal);

        if (!kapasitas.valid) {
            throw new Error(kapasitas.pesan);
        }

        const konflikBooking = cekKonflikJadwal(
            dataJadwal,
            [
                kasus.pengajuanId,
                `BOOK-${kasus.pengajuanId}`
            ]
        );

        if (konflikBooking.bentrok) {
            throw new Error(
                "Jadwal rekomendasi bertabrakan dengan peminjaman atau pengajuan aktif lainnya."
            );
        }

        return {
            data: dataJadwal,

            mulaiLokal: detail.waktuMulai,

            selesaiLokal: detail.waktuSelesai,

            rentang
        };
    }

    // ======================================================
    // 25. PEMERIKSAAN BENTROK REKOMENDASI
    // ======================================================

    function cekKonflikRekomendasi(
        dataBaru,
        pengajuanId,
        rekomendasiId = null
    ) {
        kedaluwarsakanRekomendasi();

        const daftar =
            ambilSemua("recommendations");

        const rentangBaru = validasiJadwal(dataBaru);

        if (!rentangBaru.valid) {
            return null;
        }

        return (
            daftar.find((item) => {
                if (
                    rekomendasiId &&
                    String(item.id) === String(rekomendasiId)
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

    // ======================================================
    // 26. VALIDASI MULTI ALTERNATIF
    // ======================================================

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
            if (
                rentangBertabrakan(
                    hasil[0],
                    hasil[1]
                )
            ) {
                throw new Error(
                    "Alternatif pertama dan kedua tidak boleh memiliki waktu yang bertabrakan."
                );
            }
        }

        return hasil;
    }

    // ======================================================
    // 27. MENGAMBIL REKOMENDASI BERDASARKAN KASUS
    // ======================================================

    function ambilRekomendasiKasus(kasus) {
        kedaluwarsakanRekomendasi();

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

    // ======================================================
    // 28. MENGAMBIL KASUS TERGESER
    // ======================================================

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

    // ======================================================
    // 29. PEMBARUAN METADATA REKOMENDASI
    // ======================================================

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

        if (index === -1) return false;

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

        return true;
    }

    // ======================================================
    // 30. MEMBUAT REKOMENDASI JADWAL
    // ======================================================

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

        const jadwal = siapkanJadwalRekomendasi(
            dataRekomendasi,
            data
        );

        const konflikRekomendasi =
            cekKonflikRekomendasi(
                jadwal.data,
                data.pengajuanId
            );

        if (konflikRekomendasi) {
            throw new Error(
                "Jadwal rekomendasi bertabrakan dengan rekomendasi pengguna lain."
            );
        }

        const daftar =
            ambilSemua("recommendations");

        const sekarang = new Date();

        const waktuDikirim = sekarang.toISOString();

        const kedaluwarsa = new Date(
            sekarang.getTime() + BATAS_KONFIRMASI
        ).toISOString();

        const rekomendasiBaru = {
            ...jadwal.data,

            id: buatIdRekomendasi(daftar),

            pengajuanId: data.pengajuanId,

            bookingId:
                data.bookingId ||
                `BOOK-${data.pengajuanId}`,

            alternatifJadwal: [
                {
                    ...jadwal.data,
                    nomorAlternatif: 1
                }
            ],

            jumlahAlternatif: 1,

            catatan: String(
                data.catatan || ""
            ).trim(),

            status: "menunggu_persetujuan",

            dibuatPada: waktuDikirim,

            dikirimPada: waktuDikirim,

            kedaluwarsaPada: kedaluwarsa,

            expiresAt: kedaluwarsa,

            batasRespons: kedaluwarsa,

            sumber: "laboran"
        };

        daftar.push(rekomendasiBaru);

        simpanSemua("recommendations", daftar);

        beriTahuPerubahan(
            "recommendations",
            "dibuat"
        );

        return salinData(rekomendasiBaru);
    }

    // ======================================================
    // 31. MENGHAPUS REKOMENDASI
    // ======================================================

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
            !STATUS_REKOMENDASI_AKTIF.has(
                String(rekomendasi[index].status).toLowerCase()
            )
        ) {
            throw new Error(
                "Rekomendasi yang sudah diproses atau kedaluwarsa tidak dapat dihapus."
            );
        }

        const batas = ambilBatasRekomendasi(
            rekomendasi[index]
        );

        if (
            !Number.isFinite(batas) ||
            Date.now() >= batas
        ) {
            kedaluwarsakanRekomendasi();

            throw new Error(
                "Rekomendasi sudah melewati batas waktu konfirmasi."
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

    // ======================================================
    // 32. MENGIRIM REKOMENDASI MULTI ALTERNATIF
    // ======================================================

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

        // Simpan rekomendasi terlebih dahulu.
        simpanSemua("recommendations", daftar);

        // Perbarui metadata kasus jika tersedia.
        perbaruiMetadataRekomendasi(
            kasus,
            rekomendasiBaru
        );

        beriTahuBanyakPerubahan([
            {
                koleksi: "recommendations",
                aksi: "dikirim"
            },
            {
                koleksi: "antrean",
                aksi: "rekomendasi_dikirim"
            },
            {
                koleksi: "conflicts",
                aksi: "rekomendasi_dikirim"
            },
            {
                koleksi: "penggunaTergeser",
                aksi: "rekomendasi_dikirim"
            }
        ]);

        return {
            ...getKasusTergeserById(kasus.id),

            success: true,

            rekomendasiTerbaru:
                salinData(rekomendasiBaru),

            status: "rekomendasi_dikirim"
        };
    }

    // ======================================================
    // 33. EDIT REKOMENDASI MULTI ALTERNATIF
    // ======================================================

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
            kedaluwarsakanRekomendasi();

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

        const diperbaruiPada = buatTimestamp();

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

        beriTahuBanyakPerubahan([
            {
                koleksi: "recommendations",
                aksi: "diedit"
            },
            {
                koleksi: "conflicts",
                aksi: "rekomendasi_diedit"
            },
            {
                koleksi: "penggunaTergeser",
                aksi: "rekomendasi_diedit"
            }
        ]);

        return {
            ...getKasusTergeserById(kasus.id),

            success: true,

            rekomendasiTerbaru:
                salinData(rekomendasiBaru),

            status: "rekomendasi_dikirim"
        };
    }

    // ======================================================
    // 34. MENGIRIM KELOMPOK KONFLIK KE KEPALA LAB
    // ======================================================

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

        if (ids.length < 2) {
            throw new Error(
                "Minimal dua ID pengajuan yang berbeda diperlukan."
            );
        }

        const submissions = ambilSemua("submissions");

        const daftarPengajuan = submissions.filter(
            (item) => ids.includes(String(item.id))
        );

        if (daftarPengajuan.length !== ids.length) {
            throw new Error(
                "Sebagian pengajuan tidak ditemukan."
            );
        }

        const konflik = ambilSemua("conflicts");

        // A. Mencegah pengiriman kelompok yang sama dua kali.
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

        // B. Validasi status, jadwal, dan kapasitas.
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

            const rentang = validasiJadwal(data);

            if (!rentang.valid) {
                throw new Error(
                    `Jadwal pengajuan ${pengajuan.id} tidak valid: ${rentang.pesan}`
                );
            }

            const kapasitas = validasiKapasitas(data);

            if (!kapasitas.valid) {
                throw new Error(
                    `Kapasitas pengajuan ${pengajuan.id} tidak valid: ${kapasitas.pesan}`
                );
            }

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

        // C. Pastikan setiap anggota mempunyai hubungan
        // bentrokan dengan anggota lain.
        const salingBerhubungan = daftarPengajuan.every(
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

        if (!salingBerhubungan) {
            throw new Error(
                "Tidak semua pengajuan memiliki hubungan bentrokan dengan anggota kelompok lainnya."
            );
        }

        // D. Pastikan kelompok merupakan satu komponen
        // konflik yang saling terhubung.
        const terhubung = new Set([0]);

        let berubah = true;

        while (berubah) {
            berubah = false;

            daftarPengajuan.forEach(
                (pengajuan, index) => {
                    if (terhubung.has(index)) return;

                    const terhubungDenganAnggota =
                        [...terhubung].some(
                            (indexLain) =>
                                rentangBertabrakan(
                                    pengajuan,
                                    daftarPengajuan[indexLain]
                                )
                        );

                    if (terhubungDenganAnggota) {
                        terhubung.add(index);
                        berubah = true;
                    }
                }
            );
        }

        if (terhubung.size !== daftarPengajuan.length) {
            throw new Error(
                "Kelompok konflik terdiri dari beberapa kelompok yang tidak saling terhubung. Kirim setiap kelompok secara terpisah."
            );
        }

        // E. Pastikan tidak ada konflik di luar kelompok.
        for (const pengajuan of daftarPengajuan) {
            const hasilKonflik = cekKonflikJadwal(
                pengajuan,
                ids
            );

            if (hasilKonflik.bentrok) {
                throw new Error(
                    `Pengajuan ${pengajuan.id} masih berbenturan dengan data di luar kelompok konflik.`
                );
            }
        }

        // F. Bentuk identitas konflik.
        const idKonflik =
            `CONFLICT-${Date.now()}`;

        const waktuPengiriman = buatTimestamp();

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

        konflik.push(groupBaru);

        // G. Simpan kedua koleksi sebagai satu operasi
        // dengan mekanisme rollback.
        simpanTransaksi({
            submissions: submissionsBaru,
            conflicts: konflik
        });

        beriTahuBanyakPerubahan([
            {
                koleksi: "submissions",
                aksi: "konflik_dikirim"
            },
            {
                koleksi: "antrean",
                aksi: "konflik_dikirim"
            },
            {
                koleksi: "conflicts",
                aksi: "konflik_dikirim"
            },
            {
                koleksi: "bookings",
                aksi: "konflik_dikirim"
            }
        ]);

        return salinData(groupBaru);
    }

    // ======================================================
    // 35. MENGAMBIL KELOMPOK KONFLIK
    // ======================================================

    function getKonflik() {
        // Hanya mengembalikan kelompok konflik.
        // Kasus tergeser tetap diambil melalui getAll().
        return ambilSemua("conflicts").filter(
            (item) =>
                Array.isArray(item.pengajuan)
        );
    }

    // ======================================================
    // 36. KEPUTUSAN KONFLIK KEPALA LAB
    // ======================================================

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

        const submissions =
            ambilSemua("submissions");

        // Mengambil kondisi terbaru dari penyimpanan.
        const anggotaSaatIni = group.pengajuan.map(
            (anggota) => {
                const data = submissions.find(
                    (item) =>
                        String(item.id) ===
                        String(anggota.id)
                );

                if (!data) {
                    throw new Error(
                        `Pengajuan ${anggota.id} tidak ditemukan.`
                    );
                }

                if (data.status !== "menunggu_keputusan") {
                    throw new Error(
                        `Status pengajuan ${anggota.id} sudah berubah.`
                    );
                }

                return data;
            }
        );

        const terpilih = anggotaSaatIni.find(
            (item) =>
                String(item.id) === idTerpilih
        );

        if (!terpilih) {
            throw new Error(
                "Pengajuan pilihan tidak ditemukan."
            );
        }

        // Validasi ulang jadwal dan kapasitas.
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

        // Pengecualian seluruh anggota kelompok.
        const idsKelompok = group.pengajuan.map(
            (item) => String(item.id)
        );

        // Pastikan tidak ada konflik di luar kelompok.
        const konflikLain = cekKonflikJadwal(
            dataTerpilih,
            idsKelompok
        );

        if (konflikLain.bentrok) {
            throw new Error(
                "Pengajuan pilihan masih bertabrakan dengan booking atau pengajuan aktif di luar kelompok konflik."
            );
        }

        const waktuKeputusan = buatTimestamp();

        const displaced = [];
        const dikembalikan = [];

        // Memproses seluruh anggota kelompok.
        const submissionsBaru = submissions.map(
            (item) => {
                const anggotaKelompok =
                    idsKelompok.includes(
                        String(item.id)
                    );

                if (!anggotaKelompok) return item;

                // A. Pengajuan yang dipilih.
                if (String(item.id) === idTerpilih) {
                    return {
                        ...item,

                        status: "disetujui",

                        keputusanKonflik: idKonflik,

                        diputuskanPada: waktuKeputusan,

                        konflikAktif: false
                    };
                }

                // B. Periksa bentrokan langsung dengan pilihan.
                const berbenturan = rentangBertabrakan(
                    item,
                    terpilih
                );

                // C. Pengajuan yang bertabrakan menjadi tergeser.
                if (berbenturan) {
                    displaced.push(String(item.id));

                    return {
                        ...item,

                        status: "tergeser",

                        keputusanKonflik: idKonflik,

                        diputuskanPada: waktuKeputusan,

                        konflikAktif: false
                    };
                }

                // D. Pengajuan yang tidak bertabrakan
                // dikembalikan ke status sebelumnya.
                dikembalikan.push(String(item.id));

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
            }
        );

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

        const konflikDiperbarui = [...konflik];

        const anggotaDiperbarui = group.pengajuan.map(
            (item) => {
                const hasil = submissionsBaru.find(
                    (submission) =>
                        String(submission.id) ===
                        String(item.id)
                );

                return {
                    ...item,
                    ...(hasil || {}),
                    status: hasil?.status || item.status
                };
            }
        );

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

        // Membuat kasus rekomendasi untuk pengajuan tergeser.
        displaced.forEach((idPengajuan) => {
            const pengajuan = submissionsBaru.find(
                (item) =>
                    String(item.id) === idPengajuan
            );

            if (!pengajuan) return;

            const sudahAda = konflikDiperbarui.some(
                (item) =>
                    String(item.pengajuanId) === idPengajuan &&
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

        // Simpan hasil keputusan.
        simpanTransaksi({
            submissions: submissionsBaru,
            conflicts: konflikDiperbarui
        });

        beriTahuBanyakPerubahan([
            {
                koleksi: "submissions",
                aksi: "keputusan_konflik"
            },
            {
                koleksi: "antrean",
                aksi: "keputusan_konflik"
            },
            {
                koleksi: "conflicts",
                aksi: "keputusan_konflik"
            },
            {
                koleksi: "penggunaTergeser",
                aksi: "kasus_tergeser"
            },
            {
                koleksi: "bookings",
                aksi: "keputusan_konflik"
            }
        ]);

        return {
            berhasil: true,

            pesan:
                "Keputusan konflik dan kasus tergeser berhasil disimpan.",

            terpilih: idTerpilih,

            tergeser: displaced,

            tidakTergeser: dikembalikan
        };
    }

    // ======================================================
    // 37. EKSPOR LAYANAN SILAB
    // ======================================================

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
        cekKonflikRekomendasi,

        // Konflik Kepala Lab
        kirimKonflik,
        getKonflik,
        putuskanKonflik,

        // Inisialisasi
        inisialisasiData

    });

})(window);
