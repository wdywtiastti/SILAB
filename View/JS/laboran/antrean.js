
(function (window, document) {
    "use strict";

    // ==========================================
    // 1. DEPENDENSI DAN ELEMEN HTML
    // ==========================================

    const layanan = window.SILABService;

    const el = {
        tabel: document.getElementById("antrianBody"),
        template: document.getElementById("templateBarisAntrian"),
        total: document.getElementById("totalAntrian"),
        pagination: document.getElementById("paginationInfo"),
        nomorHalaman: document.getElementById("paginationNumbers"),
        sebelumnya: document.getElementById("prevPage"),
        berikutnya: document.getElementById("nextPage"),
        modal: document.getElementById("modalReview"),

        jumlahBelum: document.getElementById("jumlahBelumDisetujui"),
        jumlahSudah: document.getElementById("jumlahSudahDisetujui"),

        filter: document.querySelectorAll("[data-filter-antrean]")
    };

    if (!layanan || !el.tabel || !el.template || !el.modal) {
        console.error(
            "SILAB: Elemen atau layanan modul antrean tidak lengkap."
        );
        return;
    }


    // ==========================================
    // 2. KONFIGURASI
    // ==========================================

    const DATA_HALAMAN = 6;

    const ZONA_WIT = "+09:00";

    const BATAS_TIMEOUT = 2147483647;

    // Batas presensi setelah waktu mulai peminjaman.
    const BATAS_PRESENSI_MENIT = 15;

    const STATUS = {
        verifikasi: {
            label: "Verifikasi",
            kelas: "verify"
        },

        bentrok: {
            label: "Bentrok",
            kelas: "conflict"
        },

        tergeser: {
            label: "Tergeser",
            kelas: "displaced"
        },

        disetujui: {
            label: "Disetujui",
            kelas: "approved"
        },

        ditolak: {
            label: "Ditolak",
            kelas: "rejected"
        }
    };

    const STATUS_BELUM_DISETUJUI = [
        "verifikasi",
        "bentrok"
    ];

    // Status presensi yang menandakan kehadiran tercatat.
    const STATUS_PRESENSI_TERCATAT = new Set([
        "hadir",
        "presensi",
        "sudah_presensi",
        "tercatat",
        "presensi_tercatat",
        "sudah_hadir",
        "checked_in",
        "check_in"
    ]);

    // Status booking yang sudah tidak menunggu presensi.
    const STATUS_PRESENSI_SELESAI = new Set([
        "digunakan",
        "tidak_digunakan",
        "sedang_berjalan",
        "berjalan",
        "selesai"
    ]);

    // Status yang secara eksplisit menunjukkan ketidakhadiran.
    const STATUS_TIDAK_HADIR = new Set([
        "tidak_hadir",
        "belum_hadir",
        "belum_presensi",
        "tidak_presensi",
        "alpha",
        "absen",
        "tidak hadir"
    ]);

    let daftarAntrean = [];

    let halamanAktif = 1;

    let filterAktif = "belum-disetujui";

    let fokusSebelumnya = null;

    let timerAntrean = null;

    let intervalAntrean = null;


    // ==========================================
    // 3. FUNGSI BANTUAN
    // ==========================================

    function isiElemen(elemen, nilai) {
        if (!elemen) return;

        elemen.textContent =
            nilai === null || nilai === undefined || nilai === ""
                ? "-"
                : String(nilai);
    }


    function isiField(container, nama, nilai) {
        const elemen = container.querySelector(
            `[data-field="${nama}"]`
        );

        isiElemen(elemen, nilai);
    }


    function normalisasiStatus(status) {
        const nilai = String(status || "")
            .toLowerCase()
            .trim();

        const alias = {
            menunggu_verifikasi: "verifikasi",
            konflik: "bentrok",
            "menunggu presensi": "menunggu_presensi",
            "sudah disetujui": "disetujui"
        };

        return alias[nilai] || nilai;
    }


    function formatAngka(nilai) {
        const angka = Number(nilai);

        return Number.isFinite(angka)
            ? String(angka)
            : "0";
    }


    function ambilPrioritas(data) {
        const nilai = String(data.prioritas || "").toUpperCase();

        const cocok = nilai.match(/P([1-5])/);

        return cocok ? Number(cocok[1]) : 99;
    }


    function ambilSkor(data) {
        const skor = Number(data.skor);

        return Number.isFinite(skor) ? skor : 0;
    }


    function formatWaktu(data) {
        const tanggal = data.tanggal
            ? `${data.tanggal} | `
            : "";

        return `${tanggal}${data.waktuMulai || "-"} - ${
            data.waktuSelesai || "-"
        } WIT`;
    }


    // ==========================================
    // 4. PENGELOLAAN TIMESTAMP WIT
    // ==========================================

    // Mengubah tanggal dan waktu menjadi timestamp.
    // Mendukung tanggal lengkap maupun tanggal terpisah.

    function ambilTimestampWaktu(nilaiWaktu, nilaiTanggal) {
        if (!nilaiWaktu) return null;

        const waktu = String(nilaiWaktu).trim();

        // Format tanggal dan waktu lengkap.
        // Contoh: 2026-11-17T05:00
        // Contoh: 2026-11-17T05:00:00+09:00

        const tanggalLengkap = waktu.match(
            /^(\d{4}-\d{2}-\d{2})[T ](.+)$/
        );

        if (tanggalLengkap) {
            let nilaiLengkap = waktu.replace(" ", "T");

            // Jika belum memiliki zona waktu,
            // gunakan zona waktu WIT.
            const memilikiZona = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(
                nilaiLengkap
            );

            if (!memilikiZona) {
                nilaiLengkap += ZONA_WIT;
            }

            const timestamp = Date.parse(nilaiLengkap);

            return Number.isFinite(timestamp)
                ? timestamp
                : null;
        }

        // Format jam terpisah.
        // Contoh: 05:00 atau 05:00:00

        const tanggal = String(
            nilaiTanggal || ""
        ).split("T")[0];

        if (!tanggal) return null;

        const cocok = waktu.match(
            /^([01]?\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/
        );

        if (!cocok) return null;

        const jam = String(cocok[1]).padStart(2, "0");

        const menit = cocok[2];

        const detik = cocok[3] || "00";

        const timestamp = Date.parse(
            `${tanggal}T${jam}:${menit}:${detik}${ZONA_WIT}`
        );

        return Number.isFinite(timestamp)
            ? timestamp
            : null;
    }


    // Mengambil waktu mulai peminjaman.

    function ambilTimestampMulai(data) {
        if (!data) return null;

        return ambilTimestampWaktu(
            data.waktuMulai || data.mulai,
            data.tanggalMulai || data.tanggal
        );
    }


    // Mengambil waktu selesai peminjaman.

    function ambilTimestampSelesai(data) {
        if (!data) return null;

        return ambilTimestampWaktu(
            data.waktuSelesai || data.selesai,
            data.tanggalSelesai || data.tanggal
        );
    }


    // Menghitung batas presensi.
    // Waktu mulai + 15 menit.

    function ambilBatasPresensi(data) {
        const waktuMulai = ambilTimestampMulai(data);

        if (waktuMulai === null) return null;

        return (
            waktuMulai +
            BATAS_PRESENSI_MENIT * 60 * 1000
        );
    }


    // Memeriksa apakah batas presensi sudah habis.

    function batasPresensiSudahHabis(data) {
        const batasWaktu = ambilBatasPresensi(data);

        if (batasWaktu === null) return false;

        return Date.now() >= batasWaktu;
    }


    // Memeriksa apakah waktu penggunaan sudah selesai.

    function sudahMelewatiMasaPenggunaan(data) {
        const waktuSelesai = ambilTimestampSelesai(data);

        if (waktuSelesai === null) return false;

        return Date.now() >= waktuSelesai;
    }


    // ==========================================
    // 5. PENGELOLAAN BOOKING DAN PRESENSI
    // ==========================================

    function ambilBookingPengajuan(pengajuanId) {
        const bookings = layanan.getAll("bookings");

        if (!Array.isArray(bookings)) {
            return null;
        }

        return bookings.find((booking) =>
            String(booking.sourceSubmissionId) ===
                String(pengajuanId) ||
            String(booking.id) ===
                `BOOK-${pengajuanId}`
        ) || null;
    }


    // Memeriksa apakah pemohon sudah melakukan presensi.

    function sudahMelakukanPresensi(pengajuan) {
        if (!pengajuan) return false;

        const booking = ambilBookingPengajuan(
            pengajuan.id
        );

        // --------------------------------------
        // A. PERIKSA PENANDA PRESENSI LANGSUNG
        // --------------------------------------

        if (
            booking?.presensi === true ||
            booking?.sudahPresensi === true ||
            booking?.presensi?.hadir === true ||
            pengajuan.presensi === true ||
            pengajuan.sudahPresensi === true
        ) {
            return true;
        }

        // --------------------------------------
        // B. PERIKSA STATUS PRESENSI
        // --------------------------------------

        const nilaiPresensi =
            typeof booking?.presensi === "string"
                ? booking.presensi
                : booking?.presensi?.status ||
                  booking?.statusPresensi ||
                  pengajuan?.presensi?.status ||
                  pengajuan?.statusPresensi ||
                  "";

        const statusPresensi = normalisasiStatus(
            nilaiPresensi
        );

        if (
            STATUS_PRESENSI_TERCATAT.has(statusPresensi)
        ) {
            return true;
        }

        // --------------------------------------
        // C. PERIKSA STATUS AKHIR BOOKING
        // --------------------------------------

        const statusBooking = normalisasiStatus(
            booking?.status
        );

        if (
            STATUS_PRESENSI_SELESAI.has(statusBooking)
        ) {
            return true;
        }

        // --------------------------------------
        // D. PERIKSA DATA ATTENDANCE
        // --------------------------------------

        const attendance = layanan.getAll("attendance");

        if (!Array.isArray(attendance)) {
            return false;
        }

        const idBooking = String(
            booking?.id || `BOOK-${pengajuan.id}`
        );

        const idPengajuan = String(pengajuan.id);

        return attendance.some((catatan) => {
            const cocokBooking =
                String(
                    catatan.bookingId ||
                    catatan.booking_id ||
                    ""
                ) === idBooking;

            const cocokPengajuan =
                String(
                    catatan.sourceSubmissionId ||
                    catatan.pengajuanId ||
                    catatan.submissionId ||
                    catatan.idPengajuan ||
                    ""
                ) === idPengajuan;

            if (!cocokBooking && !cocokPengajuan) {
                return false;
            }

            const statusCatatan = normalisasiStatus(
                catatan.status ||
                catatan.kehadiran ||
                catatan.statusPresensi ||
                ""
            );

            // Catatan ketidakhadiran bukan presensi hadir.
            if (
                STATUS_TIDAK_HADIR.has(statusCatatan)
            ) {
                return false;
            }

            // Data attendance yang terhubung dengan booking
            // dianggap sebagai catatan presensi.
            return true;
        });
    }


    // Menentukan apakah booking masih boleh
    // muncul pada antrean Sudah Disetujui.

    function masihMenungguPresensi(pengajuan) {

        // Jika sudah presensi, langsung hilangkan.
        if (sudahMelakukanPresensi(pengajuan)) {
            return false;
        }

        // Jika batas 15 menit sudah habis, hilangkan.
        if (batasPresensiSudahHabis(pengajuan)) {
            return false;
        }

        // Jika data waktu tidak valid,
        // jangan sembunyikan pengajuan secara sembarangan.
        return true;
    }


    // ==========================================
    // 6. MENGAMBIL DATA ANTREAN
    // ==========================================

    function ambilDataAntrean() {
        const data = layanan.getAll("antrean");

        if (!Array.isArray(data)) {
            throw new Error(
                "Data pengajuan tidak berbentuk array."
            );
        }

        return data.filter((pengajuan) => {
            const status = normalisasiStatus(
                pengajuan.status
            );

            // Pengajuan belum disetujui tetap ditampilkan.
            if (
                STATUS_BELUM_DISETUJUI.includes(status)
            ) {
                return true;
            }

            // Pengajuan disetujui hanya ditampilkan
            // selama belum presensi dan belum melewati 15 menit.
            if (status === "disetujui") {
                return masihMenungguPresensi(pengajuan);
            }

            return false;
        });
    }


    // ==========================================
    // 7. PENGURUTAN PRIORITAS DAN SKOR
    // ==========================================

    function urutkanAntrean(data) {
        return [...data].sort((a, b) => {
            const prioritasA = ambilPrioritas(a);

            const prioritasB = ambilPrioritas(b);

            if (prioritasA !== prioritasB) {
                return prioritasA - prioritasB;
            }

            return ambilSkor(b) - ambilSkor(a);
        });
    }


    // ==========================================
    // 8. FILTER KATEGORI ANTREAN
    // ==========================================

    function ambilDataFilter() {
        return daftarAntrean.filter((pengajuan) => {
            const status = normalisasiStatus(
                pengajuan.status
            );

            if (filterAktif === "belum-disetujui") {
                return STATUS_BELUM_DISETUJUI.includes(status);
            }

            if (filterAktif === "sudah-disetujui") {
                return status === "disetujui";
            }

            return false;
        });
    }


    function perbaruiJumlahKategori() {
        const belumDisetujui = daftarAntrean.filter(
            (item) =>
                STATUS_BELUM_DISETUJUI.includes(
                    normalisasiStatus(item.status)
                )
        ).length;

        const sudahDisetujui = daftarAntrean.filter(
            (item) =>
                normalisasiStatus(item.status) === "disetujui"
        ).length;

        isiElemen(el.jumlahBelum, belumDisetujui);

        isiElemen(el.jumlahSudah, sudahDisetujui);
    }


    function pilihFilter(kategori) {
        if (
            ![
                "belum-disetujui",
                "sudah-disetujui"
            ].includes(kategori)
        ) {
            return;
        }

        filterAktif = kategori;

        halamanAktif = 1;

        el.filter.forEach((tombol) => {
            const aktif =
                tombol.dataset.filterAntrean === kategori;

            tombol.classList.toggle("active", aktif);

            tombol.setAttribute(
                "aria-pressed",
                String(aktif)
            );
        });

        tampilkanAntrean();
    }


    el.filter.forEach((tombol) => {
        tombol.addEventListener("click", () => {
            pilihFilter(tombol.dataset.filterAntrean);
        });
    });


    // ==========================================
    // 9. MEMBUAT BARIS TABEL
    // ==========================================

    function buatBaris(pengajuan) {
        const baris =
            el.template.content.firstElementChild.cloneNode(true);

        const status = normalisasiStatus(
            pengajuan.status
        );

        const konfigurasi = STATUS[status];

        const kebutuhanPC = Number(
            pengajuan.kebutuhanPC ??
            pengajuan.jumlahPC ??
            0
        );

        const kebutuhanKursi = Number(
            pengajuan.kebutuhanKursi ??
            pengajuan.jumlahKursi ??
            0
        );

        const namaPemohon =
            pengajuan.namaPemohon ||
            pengajuan.nama ||
            pengajuan.userIdentifier ||
            "-";

        isiField(baris, "id", `#${pengajuan.id}`);

        isiField(
            baris,
            "nama-kegiatan",
            pengajuan.namaKegiatan || "-"
        );

        isiField(baris, "pemohon", namaPemohon);

        isiField(
            baris,
            "rentang-waktu",
            formatWaktu(pengajuan)
        );

        isiField(
            baris,
            "kebutuhan",
            `PC: ${formatAngka(kebutuhanPC)} | Kursi: ${formatAngka(
                kebutuhanKursi
            )}`
        );

        const badgePrioritas = baris.querySelector(
            '[data-field="prioritas"]'
        );

        if (badgePrioritas) {
            badgePrioritas.textContent =
                pengajuan.prioritas || "-";
        }

        isiField(
            baris,
            "skor",
            `Skor: ${formatAngka(ambilSkor(pengajuan))}`
        );

        const badgeStatus = baris.querySelector(
            '[data-field="status"]'
        );

        if (badgeStatus && konfigurasi) {
            badgeStatus.className =
                `status-badge ${konfigurasi.kelas}`;

            badgeStatus.textContent =
                konfigurasi.label;
        }

        const tombol = baris.querySelector(
            "[data-aksi-detail]"
        );

        if (tombol) {
            tombol.dataset.id = pengajuan.id;

            if (status === "disetujui") {
                tombol.innerHTML =
                    '<i class="bi bi-eye"></i> Lihat Detail';
            } else {
                tombol.innerHTML =
                    '<i class="bi bi-search"></i> Periksa &amp; Proses';
            }
        }

        return baris;
    }


    // ==========================================
    // 10. MENAMPILKAN TABEL ANTREAN
    // ==========================================

    function tampilkanAntrean() {
        const dataFilter = ambilDataFilter();

        const awal =
            (halamanAktif - 1) * DATA_HALAMAN;

        const dataHalaman = dataFilter.slice(
            awal,
            awal + DATA_HALAMAN
        );

        const fragment = document.createDocumentFragment();

        if (dataHalaman.length === 0) {
            const baris = document.createElement("tr");

            const kolom = document.createElement("td");

            kolom.colSpan = 6;

            kolom.textContent =
                filterAktif === "belum-disetujui"
                    ? "Belum ada pengajuan yang menunggu persetujuan."
                    : "Belum ada pengajuan yang sudah disetujui.";

            kolom.className = "empty-message";

            baris.append(kolom);

            fragment.append(baris);

        } else {
            dataHalaman.forEach((pengajuan) => {
                fragment.append(
                    buatBaris(pengajuan)
                );
            });
        }

        el.tabel.replaceChildren(fragment);

        perbaruiPagination();
    }


    // ==========================================
    // 11. PAGINATION
    // ==========================================

    function perbaruiPagination() {
        const dataFilter = ambilDataFilter();

        const total = dataFilter.length;

        const jumlahHalaman = Math.ceil(
            total / DATA_HALAMAN
        );

        const awal =
            total === 0
                ? 0
                : (halamanAktif - 1) * DATA_HALAMAN + 1;

        const akhir = Math.min(
            halamanAktif * DATA_HALAMAN,
            total
        );

        isiElemen(el.total, `${total} Pengajuan`);

        isiElemen(
            el.pagination,
            `Menampilkan ${awal}–${akhir} dari ${total} pengajuan`
        );

        if (el.sebelumnya) {
            el.sebelumnya.disabled =
                halamanAktif <= 1;
        }

        if (el.berikutnya) {
            el.berikutnya.disabled =
                halamanAktif >= jumlahHalaman;
        }

        if (el.nomorHalaman) {
            el.nomorHalaman.replaceChildren();

            for (let i = 1; i <= jumlahHalaman; i++) {
                const tombol = document.createElement("button");

                tombol.type = "button";

                tombol.className = "pagination-btn";

                tombol.textContent = i;

                if (i === halamanAktif) {
                    tombol.classList.add("active");

                    tombol.setAttribute(
                        "aria-current",
                        "page"
                    );
                }

                tombol.addEventListener("click", () => {
                    halamanAktif = i;

                    tampilkanAntrean();
                });

                el.nomorHalaman.append(tombol);
            }
        }
    }


    if (el.sebelumnya) {
        el.sebelumnya.addEventListener("click", () => {
            if (halamanAktif > 1) {
                halamanAktif--;

                tampilkanAntrean();
            }
        });
    }


    if (el.berikutnya) {
        el.berikutnya.addEventListener("click", () => {
            const jumlahHalaman = Math.ceil(
                ambilDataFilter().length / DATA_HALAMAN
            );

            if (halamanAktif < jumlahHalaman) {
                halamanAktif++;

                tampilkanAntrean();
            }
        });
    }


    // ==========================================
    // 12. PENJADWALAN PEMBERSIHAN ANTREAN
    // ==========================================

    function jadwalkanPembersihanAntrean() {
        if (timerAntrean !== null) {
            window.clearTimeout(timerAntrean);

            timerAntrean = null;
        }

        const sekarang = Date.now();

        // Cari batas presensi paling dekat.
        const waktuTerdekat = daftarAntrean
            .filter(
                (item) =>
                    normalisasiStatus(item.status) === "disetujui"
            )
            .map(ambilBatasPresensi)
            .filter(
                (timestamp) =>
                    timestamp !== null &&
                    timestamp > sekarang
            )
            .sort((a, b) => a - b)[0];

        if (!waktuTerdekat) return;

        const jeda = Math.min(
            Math.max(waktuTerdekat - sekarang + 50, 0),
            BATAS_TIMEOUT
        );

        // Jalankan pembaruan tepat setelah batas presensi.
        timerAntrean = window.setTimeout(() => {
            timerAntrean = null;

            muatAntrean();

        }, jeda);
    }


    // ==========================================
    // 13. MEMUAT ULANG DATA ANTREAN
    // ==========================================

    function muatAntrean() {
        try {
            daftarAntrean = urutkanAntrean(
                ambilDataAntrean()
            );

            const jumlahHalaman = Math.max(
                1,
                Math.ceil(
                    ambilDataFilter().length / DATA_HALAMAN
                )
            );

            halamanAktif = Math.min(
                halamanAktif,
                jumlahHalaman
            );

            perbaruiJumlahKategori();

            tampilkanAntrean();

            // Jadwalkan pemeriksaan berikutnya
            // berdasarkan batas presensi 15 menit.
            jadwalkanPembersihanAntrean();

        } catch (error) {
            console.error(
                "SILAB: Gagal memuat antrean.",
                error
            );

            isiElemen(
                el.total,
                "Gagal memuat data"
            );
        }
    }


    // ==========================================
    // 14. IDENTIFIKASI KELOMPOK KONFLIK
    // ==========================================

    function ambilMenitWaktu(nilai) {
        if (!nilai) return null;

        const bagian = String(nilai).includes("T")
            ? String(nilai).split("T")[1]
            : String(nilai);

        const cocok = bagian.match(
            /^(\d{1,2}):(\d{2})/
        );

        if (!cocok) return null;

        return (
            Number(cocok[1]) * 60 +
            Number(cocok[2])
        );
    }


    function tanggalPengajuan(item) {
        if (item.tanggal) {
            return String(item.tanggal).split("T")[0];
        }

        return String(
            item.waktuMulai || ""
        ).split("T")[0];
    }


    function waktuMulaiPengajuan(item) {
        return ambilMenitWaktu(
            item.waktuMulai || item.mulai
        );
    }


    function waktuSelesaiPengajuan(item) {
        return ambilMenitWaktu(
            item.waktuSelesai || item.selesai
        );
    }


    function ambilKelompokKonflik(idAktif) {
        const aktif = layanan.getById(
            "antrean",
            idAktif
        );

        if (!aktif) {
            throw new Error(
                "Pengajuan tidak ditemukan."
            );
        }

        if (
            normalisasiStatus(aktif.status) !== "bentrok"
        ) {
            throw new Error(
                "Pengajuan ini tidak berstatus bentrok."
            );
        }

        const mulaiAktif =
            waktuMulaiPengajuan(aktif);

        const selesaiAktif =
            waktuSelesaiPengajuan(aktif);

        const tanggalAktif =
            tanggalPengajuan(aktif);

        if (
            mulaiAktif === null ||
            selesaiAktif === null ||
            !tanggalAktif
        ) {
            throw new Error(
                "Data tanggal atau waktu pengajuan tidak lengkap."
            );
        }

        const semua = layanan.getAll("antrean");

        const kelompok = semua.filter((item) => {
            if (
                normalisasiStatus(item.status) !== "bentrok"
            ) {
                return false;
            }

            if (
                tanggalPengajuan(item) !== tanggalAktif
            ) {
                return false;
            }

            const mulai =
                waktuMulaiPengajuan(item);

            const selesai =
                waktuSelesaiPengajuan(item);

            if (
                mulai === null ||
                selesai === null
            ) {
                return false;
            }

            return (
                mulai < selesaiAktif &&
                selesai > mulaiAktif
            );
        });

        if (
            !kelompok.some(
                (item) =>
                    String(item.id) === String(idAktif)
            )
        ) {
            kelompok.push(aktif);
        }

        if (kelompok.length < 2) {
            throw new Error(
                "Belum ditemukan minimal dua pengajuan yang waktunya bertumpang tindih."
            );
        }

        return kelompok;
    }


    // ==========================================
    // 15. TOMBOL TERUSKAN KONFLIK
    // ==========================================

    function tampilkanTombolTeruskanKonflik(id) {
        const panel = el.modal.querySelector(
            '[data-panel="bentrok"]'
        );

        if (!panel) return;

        const wadahAksi = panel.querySelector(
            ".collision-actions"
        );

        if (!wadahAksi) {
            console.error(
                "SILAB: Wadah tombol penerusan konflik tidak ditemukan."
            );

            return;
        }

        let tombol = wadahAksi.querySelector(
            "[data-aksi-eskalasi]"
        );

        if (!tombol) {
            tombol = document.createElement("button");

            tombol.type = "button";

            tombol.dataset.aksiEskalasi = "true";

            tombol.className = "btn-eskalasi";

            wadahAksi.replaceChildren(tombol);
        }

        tombol.textContent =
            "Teruskan Konflik ke Kepala Lab";

        tombol.dataset.id = id;

        tombol.disabled = false;
    }


    // ==========================================
    // 16. MENGAMBIL DETAIL PENGAJUAN
    // ==========================================

    function ambilPengajuan(id) {
        if (!id) return null;

        return layanan.getById(
            "antrean",
            id
        );
    }


    // ==========================================
    // 17. PEMERIKSAAN KELAYAKAN PEMBATALAN
    // ==========================================

    function periksaKelayakanPembatalan(pengajuanId) {
        const pengajuan = ambilPengajuan(pengajuanId);

        if (!pengajuan) {
            return {
                boleh: false,
                pesan: "Data pengajuan tidak ditemukan."
            };
        }

        if (
            normalisasiStatus(pengajuan.status) !== "disetujui"
        ) {
            return {
                boleh: false,
                pesan: "Pengajuan tidak berstatus disetujui."
            };
        }

        // Periksa apakah sudah melakukan presensi.
        if (sudahMelakukanPresensi(pengajuan)) {
            return {
                boleh: false,
                pesan:
                    "Presensi sudah tercatat. Persetujuan tidak dapat dibatalkan."
            };
        }

        // Periksa apakah batas presensi sudah habis.
        if (batasPresensiSudahHabis(pengajuan)) {
            return {
                boleh: false,
                pesan:
                    "Batas waktu presensi 15 menit sudah habis. Pembatalan tidak dapat dilakukan."
            };
        }

        // Periksa waktu selesai penggunaan.
        if (sudahMelewatiMasaPenggunaan(pengajuan)) {
            return {
                boleh: false,
                pesan:
                    "Masa penggunaan laboratorium sudah berakhir. Pembatalan tidak dapat dilakukan."
            };
        }

        const booking = ambilBookingPengajuan(
            pengajuanId
        );

        if (!booking) {
            return {
                boleh: false,
                pesan:
                    "Data booking tidak ditemukan. Pembatalan tidak dapat dilakukan."
            };
        }

        // Gunakan layanan sebagai sumber kebenaran.
        if (
            typeof layanan.bolehBatalkanPersetujuan !== "function"
        ) {
            return {
                boleh: false,
                pesan:
                    "Fungsi pemeriksaan pembatalan belum tersedia."
            };
        }

        const boleh =
            layanan.bolehBatalkanPersetujuan(
                pengajuanId
            );

        if (boleh) {
            return {
                boleh: true,
                pesan:
                    "Booking masih menunggu presensi dan dapat dibatalkan.",
                booking
            };
        }

        const statusBooking = normalisasiStatus(
            booking.status
        );

        if (
            STATUS_PRESENSI_SELESAI.has(statusBooking)
        ) {
            return {
                boleh: false,
                pesan:
                    "Booking sudah memiliki status penggunaan akhir dan tidak dapat dibatalkan."
            };
        }

        return {
            boleh: false,
            pesan:
                "Pembatalan hanya diperbolehkan untuk booking yang masih menunggu presensi."
        };
    }


    function aturTampilanPembatalan(modal, pengajuanId) {
        const informasi = modal.querySelector(
            '.review-information[data-panel="disetujui"]'
        );

        const tombol = modal.querySelector(
            "[data-aksi-batalkan-persetujuan]"
        );

        const keterangan = informasi?.querySelector("span");

        if (!tombol) {
            console.warn(
                "SILAB: Tombol Batalkan Persetujuan tidak ditemukan pada HTML."
            );

            return;
        }

        const hasil = periksaKelayakanPembatalan(
            pengajuanId
        );

        tombol.hidden = !hasil.boleh;

        tombol.disabled = !hasil.boleh;

        if (keterangan) {
            keterangan.textContent = hasil.pesan;
        }
    }


    // ==========================================
    // 18. MENAMPILKAN PANEL BERDASARKAN STATUS
    // ==========================================

    function tampilkanPanel(namaPanel) {
        el.modal.querySelectorAll("[data-panel]").forEach(
            (panel) => {
                panel.hidden =
                    panel.dataset.panel !== namaPanel;
            }
        );
    }


    // ==========================================
    // 19. NOTIFIKASI DAN FEEDBACK
    // ==========================================

    function tampilkanPesan(
        modal,
        pesan,
        jenis = "error"
    ) {
        const konten = modal.querySelector(
            ".review-modal-content"
        );

        if (!konten) return;

        let feedback = konten.querySelector(
            ".aksi-feedback"
        );

        if (!feedback) {
            feedback = document.createElement("div");

            feedback.className = "aksi-feedback";

            konten.append(feedback);
        }

        feedback.className =
            `aksi-feedback ${jenis}`;

        feedback.setAttribute("role", "alert");

        feedback.textContent = pesan;
    }


    function tampilkanNotifikasi(pesan) {
        let notifikasi = document.getElementById(
            "notifikasiAntrean"
        );

        if (!notifikasi) {
            notifikasi = document.createElement("div");

            notifikasi.id = "notifikasiAntrean";

            notifikasi.className = "notifikasi-antrean";

            notifikasi.setAttribute("role", "status");

            notifikasi.setAttribute(
                "aria-live",
                "polite"
            );

            document.body.append(notifikasi);
        }

        notifikasi.textContent = pesan;

        notifikasi.classList.add("aktif");

        window.setTimeout(() => {
            notifikasi.classList.remove("aktif");
        }, 3000);
    }


    // ==========================================
    // 20. MEMBUKA MODAL DETAIL
    // ==========================================

    function tampilkanDetail(id) {
        if (!id) {
            console.error(
                "SILAB: ID pengajuan tidak ditemukan."
            );

            return;
        }

        try {
            const pengajuan = ambilPengajuan(id);

            if (!pengajuan) {
                throw new Error(
                    `Pengajuan ${id} tidak ditemukan.`
                );
            }

            const modal = el.modal;

            const status = normalisasiStatus(
                pengajuan.status
            );

            const konfigurasi = STATUS[status];

            modal.dataset.pengajuanId =
                pengajuan.id;

            isiField(
                modal,
                "label-id",
                `ID PENGAJUAN #${pengajuan.id}`
            );

            isiField(
                modal,
                "judul-kegiatan",
                pengajuan.namaKegiatan || "-"
            );

            isiField(
                modal,
                "nama-pemohon",
                pengajuan.namaPemohon ||
                    pengajuan.nama ||
                    pengajuan.userIdentifier ||
                    "-"
            );

            isiField(
                modal,
                "identifier",
                pengajuan.nipNpm ||
                    pengajuan.userIdentifier ||
                    "-"
            );

            isiField(
                modal,
                "waktu",
                formatWaktu(pengajuan)
            );

            isiField(
                modal,
                "jumlah-peserta",
                formatAngka(
                    pengajuan.jumlahPeserta ??
                    pengajuan.jumlahKursi ??
                    0
                )
            );

            isiField(
                modal,
                "kategori",
                pengajuan.kategori || "-"
            );

            isiField(
                modal,
                "kebutuhan-pc",
                formatAngka(
                    pengajuan.kebutuhanPC ??
                    pengajuan.jumlahPC ??
                    0
                )
            );

            isiField(
                modal,
                "kebutuhan-kursi",
                formatAngka(
                    pengajuan.kebutuhanKursi ??
                    pengajuan.jumlahKursi ??
                    0
                )
            );

            isiField(
                modal,
                "skor-detail",
                formatAngka(
                    ambilSkor(pengajuan)
                )
            );

            const badgePrioritas = modal.querySelector(
                '[data-field="prioritas-detail"]'
            );

            if (badgePrioritas) {
                badgePrioritas.textContent =
                    pengajuan.prioritas || "-";
            }

            const badgeStatus = modal.querySelector(
                '[data-field="status-detail"]'
            );

            if (badgeStatus && konfigurasi) {
                badgeStatus.className =
                    `status-badge ${konfigurasi.kelas}`;

                badgeStatus.textContent =
                    konfigurasi.label;
            }

            // Bersihkan feedback dan form sebelumnya.
            modal.querySelector(
                ".aksi-feedback"
            )?.remove();

            modal.querySelector(
                ".form-alasan-penolakan"
            )?.remove();

            // Tampilkan panel berdasarkan status.
            if (status === "verifikasi") {
                tampilkanPanel("verifikasi");

            } else if (status === "bentrok") {
                tampilkanPanel("bentrok");

                isiField(
                    modal,
                    "pesan-bentrok",
                    "Pengajuan mengalami bentrokan jadwal. Teruskan kelompok konflik kepada Kepala Laboratorium untuk mendapatkan keputusan."
                );

                tampilkanTombolTeruskanKonflik(
                    pengajuan.id
                );

            } else if (status === "tergeser") {
                tampilkanPanel("tergeser");

                isiField(
                    modal,
                    "pesan-tergeser",
                    "Pengajuan mengalami penggeseran jadwal dan memerlukan rekomendasi jadwal pengganti."
                );

            } else if (status === "disetujui") {
                tampilkanPanel("disetujui");

                aturTampilanPembatalan(
                    modal,
                    pengajuan.id
                );

            } else {
                tampilkanPanel("lainnya");
            }

            // Membuka modal.
            fokusSebelumnya = document.activeElement;

            modal.hidden = false;

            modal.setAttribute(
                "aria-hidden",
                "false"
            );

            modal.classList.add("is-open");

            modal.style.display = "flex";

            modal.style.visibility = "visible";

            modal.style.opacity = "1";

            modal.style.pointerEvents = "auto";

            modal.style.zIndex = "9999";

            const konten = modal.querySelector(
                ".review-modal-content"
            );

            if (konten) konten.focus();

            console.log(
                "SILAB: Detail berhasil dibuka:",
                pengajuan.id
            );

        } catch (error) {
            console.error(
                "SILAB: Gagal membuka detail pengajuan.",
                error
            );

            tampilkanNotifikasi(error.message);
        }
    }


    // ==========================================
    // 21. MENUTUP MODAL
    // ==========================================

    function tutupModal() {
        const modal = el.modal;

        modal.style.display = "none";

        modal.style.visibility = "hidden";

        modal.style.opacity = "0";

        modal.style.pointerEvents = "none";

        modal.classList.remove("is-open");

        modal.hidden = true;

        modal.setAttribute(
            "aria-hidden",
            "true"
        );

        delete modal.dataset.pengajuanId;

        if (
            fokusSebelumnya &&
            typeof fokusSebelumnya.focus === "function" &&
            document.contains(fokusSebelumnya)
        ) {
            fokusSebelumnya.focus();
        }

        fokusSebelumnya = null;
    }


    // ==========================================
    // 22. PERSETUJUAN PENGAJUAN
    // ==========================================

    function setujui(modal, id) {
        try {
            const pengajuan = ambilPengajuan(id);

            if (!pengajuan) {
                throw new Error(
                    "Data pengajuan tidak ditemukan."
                );
            }

            if (
                normalisasiStatus(pengajuan.status) !==
                "verifikasi"
            ) {
                throw new Error(
                    "Pengajuan tidak berada dalam antrean verifikasi."
                );
            }

            layanan.setujuiPengajuan(id);

            tutupModal();

            muatAntrean();

            tampilkanNotifikasi(
                "Pengajuan berhasil disetujui."
            );

        } catch (error) {
            tampilkanPesan(
                modal,
                error.message
            );
        }
    }


    // ==========================================
    // 23. FORM PENOLAKAN PENGAJUAN
    // ==========================================

    function tampilkanFormPenolakan(modal, id) {
        const konten = modal.querySelector(
            ".review-modal-content"
        );

        const aksi = modal.querySelector(
            '.verification-actions[data-panel="verifikasi"]'
        );

        if (!konten || !aksi) return;

        if (
            konten.querySelector(
                ".form-alasan-penolakan"
            )
        ) {
            return;
        }

        const form = document.createElement("form");

        form.className = "form-alasan-penolakan";

        const label = document.createElement("label");

        label.textContent = "Alasan Penolakan";

        const textarea = document.createElement("textarea");

        textarea.name = "alasanPenolakan";

        textarea.placeholder =
            "Tuliskan alasan penolakan pengajuan...";

        textarea.rows = 3;

        textarea.required = true;

        textarea.maxLength = 500;

        const error = document.createElement("small");

        error.className = "alasan-error";

        error.setAttribute(
            "aria-live",
            "polite"
        );

        const tombol = document.createElement("button");

        tombol.type = "submit";

        tombol.className = "btn-konfirmasi-penolakan";

        tombol.textContent = "Konfirmasi Penolakan";

        const batal = document.createElement("button");

        batal.type = "button";

        batal.className = "btn-batal-penolakan";

        batal.textContent = "Batal";

        form.append(
            label,
            textarea,
            error,
            tombol,
            batal
        );

        aksi.hidden = true;

        konten.append(form);

        textarea.focus();

        batal.addEventListener("click", () => {
            form.remove();

            aksi.hidden = false;
        });

        form.addEventListener("submit", (event) => {
            event.preventDefault();

            const alasan = textarea.value.trim();

            if (!alasan) {
                error.textContent =
                    "Alasan penolakan wajib diisi.";

                textarea.focus();

                return;
            }

            try {
                layanan.tolakPengajuan(id, alasan);

                tutupModal();

                muatAntrean();

                tampilkanNotifikasi(
                    "Pengajuan berhasil ditolak."
                );

            } catch (kesalahan) {
                error.textContent =
                    kesalahan.message;
            }
        });
    }


    // ==========================================
    // 24. MEMBATALKAN PERSETUJUAN
    // ==========================================

    function batalkanPersetujuan(modal, id) {
        try {
            const pengajuan = ambilPengajuan(id);

            if (!pengajuan) {
                throw new Error(
                    "Data pengajuan tidak ditemukan."
                );
            }

            if (
                normalisasiStatus(pengajuan.status) !==
                "disetujui"
            ) {
                throw new Error(
                    "Pengajuan tidak berstatus disetujui."
                );
            }

            // Pemeriksaan pertama sebelum konfirmasi.
            const pemeriksaanAwal =
                periksaKelayakanPembatalan(id);

            if (!pemeriksaanAwal.boleh) {
                throw new Error(
                    pemeriksaanAwal.pesan
                );
            }

            const konfirmasi = window.confirm(
                "Apakah Anda yakin ingin membatalkan persetujuan booking ini? Booking yang masih menunggu presensi akan dikembalikan ke antrean Belum Disetujui."
            );

            if (!konfirmasi) return;

            // Pemeriksaan ulang setelah konfirmasi.
            const pemeriksaanUlang =
                periksaKelayakanPembatalan(id);

            if (!pemeriksaanUlang.boleh) {
                throw new Error(
                    pemeriksaanUlang.pesan
                );
            }

            if (
                typeof layanan.batalkanPersetujuan !== "function"
            ) {
                throw new Error(
                    "Fungsi pembatalan persetujuan belum tersedia pada layanan SILAB."
                );
            }

            // Memanggil fungsi pembatalan yang sudah ada.
            layanan.batalkanPersetujuan(id);

            // Kembalikan tampilan ke Belum Disetujui.
            filterAktif = "belum-disetujui";

            el.filter.forEach((tombol) => {
                const aktif =
                    tombol.dataset.filterAntrean === filterAktif;

                tombol.classList.toggle(
                    "active",
                    aktif
                );

                tombol.setAttribute(
                    "aria-pressed",
                    String(aktif)
                );
            });

            halamanAktif = 1;

            tutupModal();

            muatAntrean();

            tampilkanNotifikasi(
                "Persetujuan berhasil dibatalkan. Pengajuan dikembalikan ke antrean Belum Disetujui."
            );

        } catch (error) {
            tampilkanPesan(
                modal,
                error.message
            );

            console.error(
                "SILAB: Gagal membatalkan persetujuan.",
                error
            );
        }
    }


    // ==========================================
    // 25. EVENT TOMBOL ANTREAN
    // ==========================================

    el.tabel.addEventListener("click", (event) => {
        const tombol = event.target.closest(
            "[data-aksi-detail]"
        );

        if (
            !tombol ||
            !el.tabel.contains(tombol)
        ) {
            return;
        }

        event.preventDefault();

        const id = tombol.dataset.id;

        if (!id) {
            console.error(
                "SILAB: ID tombol detail tidak tersedia."
            );

            return;
        }

        tampilkanDetail(id);
    });


    // ==========================================
    // 26. EVENT TOMBOL MODAL
    // ==========================================

    el.modal.addEventListener("click", (event) => {

        // A. MEMBATALKAN PERSETUJUAN

        const tombolBatalkan = event.target.closest(
            "[data-aksi-batalkan-persetujuan]"
        );

        if (tombolBatalkan) {
            const id = el.modal.dataset.pengajuanId;

            if (id) {
                batalkanPersetujuan(
                    el.modal,
                    id
                );
            }

            return;
        }


        // B. MENERUSKAN KONFLIK KE KEPALA LAB

        const tombolTeruskan = event.target.closest(
            "[data-aksi-eskalasi]"
        );

        if (tombolTeruskan) {
            const id = tombolTeruskan.dataset.id;

            if (
                typeof layanan.kirimKonflik !== "function"
            ) {
                tampilkanPesan(
                    el.modal,
                    "Fungsi penerusan konflik belum tersedia pada layanan SILAB."
                );

                return;
            }

            try {
                const kelompok = ambilKelompokKonflik(id);

                const pengajuanIds = [
                    ...new Set(
                        kelompok.map(
                            (item) => String(item.id)
                        )
                    )
                ];

                tombolTeruskan.disabled = true;

                tombolTeruskan.textContent =
                    "Mengirim konflik...";

                layanan.kirimKonflik(
                    pengajuanIds
                );

                tutupModal();

                muatAntrean();

                tampilkanNotifikasi(
                    `${pengajuanIds.length} pengajuan bentrok berhasil diteruskan ke Kepala Lab.`
                );

            } catch (error) {
                tombolTeruskan.disabled = false;

                tombolTeruskan.textContent =
                    "Teruskan Konflik ke Kepala Lab";

                tampilkanPesan(
                    el.modal,
                    error.message
                );

                console.error(
                    "SILAB: Gagal meneruskan konflik.",
                    error
                );
            }

            return;
        }


        // C. MENUTUP MODAL

        const tombolTutup = event.target.closest(
            "[data-tutup-modal]"
        );

        if (tombolTutup) {
            tutupModal();

            return;
        }


        // D. MENYETUJUI PENGAJUAN

        const tombolSetuju = event.target.closest(
            ".btn-approve"
        );

        if (tombolSetuju) {
            const id = el.modal.dataset.pengajuanId;

            if (id) {
                setujui(
                    el.modal,
                    id
                );
            }

            return;
        }


        // E. MENOLAK PENGAJUAN

        const tombolTolak = event.target.closest(
            ".btn-reject:not([data-aksi-batalkan-persetujuan])"
        );

        if (tombolTolak) {
            const id = el.modal.dataset.pengajuanId;

            if (id) {
                tampilkanFormPenolakan(
                    el.modal,
                    id
                );
            }
        }
    });


    // ==========================================
    // 27. MENUTUP MODAL DENGAN ESCAPE
    // ==========================================

    document.addEventListener("keydown", (event) => {
        if (
            event.key === "Escape" &&
            !el.modal.hidden
        ) {
            tutupModal();
        }
    });


    // ==========================================
    // 28. SINKRONISASI DATA
    // ==========================================

    // Sinkronisasi dari layanan SILAB.
    window.addEventListener(
        "silab:data-changed",
        muatAntrean
    );

    // Sinkronisasi perubahan Local Storage dari tab lain.
    window.addEventListener(
        "storage",
        muatAntrean
    );

    // Periksa ulang ketika pengguna kembali ke halaman.
    document.addEventListener(
        "visibilitychange",
        () => {
            if (!document.hidden) {
                muatAntrean();
            }
        }
    );

    // Pemeriksaan berkala untuk mendeteksi presensi baru.
    // Berguna ketika perubahan dilakukan pada tab yang sama.
    intervalAntrean = window.setInterval(() => {
        muatAntrean();
    }, 30000);


    // ==========================================
    // 29. INISIALISASI
    // ==========================================

    el.modal.hidden = true;

    el.modal.setAttribute(
        "aria-hidden",
        "true"
    );

    el.modal.style.display = "none";

    muatAntrean();

    console.log(
        "SILAB: Modul antrean berhasil dimuat."
    );

})(window, document);
