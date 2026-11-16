
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

    const STATUS_MENUNGGU_PRESENSI = new Set([
        "terjadwal",
        "menunggu_presensi"
    ]);

    const STATUS_PRESENSI_SELESAI = new Set([
        "digunakan",
        "tidak_digunakan",
        "sedang_berjalan",
        "berjalan"
    ]);

    let daftarAntrean = [];
    let halamanAktif = 1;
    let filterAktif = "belum-disetujui";
    let fokusSebelumnya = null;

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
            "menunggu presensi": "menunggu_presensi"
        };

        return alias[nilai] || nilai;
    }

    function formatAngka(nilai) {
        const angka = Number(nilai);

        return Number.isFinite(angka) ? String(angka) : "0";
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
    // 4. MENGAMBIL DATA ANTREAN
    // ==========================================

    function ambilDataAntrean() {
        const data = layanan.getAll("antrean");

        if (!Array.isArray(data)) {
            throw new Error("Data pengajuan tidak berbentuk array.");
        }

        return data.filter((pengajuan) => {
            const status = normalisasiStatus(pengajuan.status);

            return [
                ...STATUS_BELUM_DISETUJUI,
                "disetujui"
            ].includes(status);
        });
    }

    // ==========================================
    // 5. PENGURUTAN PRIORITAS DAN SKOR
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
    // 6. FILTER KATEGORI ANTREAN
    // ==========================================

    function ambilDataFilter() {
        return daftarAntrean.filter((pengajuan) => {
            const status = normalisasiStatus(pengajuan.status);

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
        const belumDisetujui = daftarAntrean.filter((item) =>
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
            !["belum-disetujui", "sudah-disetujui"].includes(kategori)
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
    // 7. MEMBUAT BARIS TABEL
    // ==========================================

    function buatBaris(pengajuan) {
        const baris =
            el.template.content.firstElementChild.cloneNode(true);

        const status = normalisasiStatus(pengajuan.status);
        const konfigurasi = STATUS[status];

        const kebutuhanPC = Number(
            pengajuan.kebutuhanPC ?? pengajuan.jumlahPC ?? 0
        );

        const kebutuhanKursi = Number(
            pengajuan.kebutuhanKursi ?? pengajuan.jumlahKursi ?? 0
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

        const tombol = baris.querySelector("[data-aksi-detail]");

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
    // 8. MENAMPILKAN TABEL ANTREAN
    // ==========================================

    function tampilkanAntrean() {
        const dataFilter = ambilDataFilter();

        const awal = (halamanAktif - 1) * DATA_HALAMAN;

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
                fragment.append(buatBaris(pengajuan));
            });
        }

        el.tabel.replaceChildren(fragment);

        perbaruiPagination();
    }

    // ==========================================
    // 9. PAGINATION
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
            el.sebelumnya.disabled = halamanAktif <= 1;
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
    // 10. MEMUAT ULANG DATA ANTREAN
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

        } catch (error) {
            console.error(
                "SILAB: Gagal memuat antrean.",
                error
            );

            isiElemen(el.total, "Gagal memuat data");
        }
    }

    // ==========================================
    // 11. IDENTIFIKASI KELOMPOK KONFLIK
    // ==========================================

    function ambilMenitWaktu(nilai) {
        if (!nilai) return null;

        const bagian = String(nilai).includes("T")
            ? String(nilai).split("T")[1]
            : String(nilai);

        const cocok = bagian.match(/^(\d{1,2}):(\d{2})/);

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

        return String(item.waktuMulai || "").split("T")[0];
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
        const aktif = layanan.getById("antrean", idAktif);

        if (!aktif) {
            throw new Error("Pengajuan tidak ditemukan.");
        }

        if (normalisasiStatus(aktif.status) !== "bentrok") {
            throw new Error(
                "Pengajuan ini tidak berstatus bentrok."
            );
        }

        const mulaiAktif = waktuMulaiPengajuan(aktif);
        const selesaiAktif = waktuSelesaiPengajuan(aktif);
        const tanggalAktif = tanggalPengajuan(aktif);

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
            if (normalisasiStatus(item.status) !== "bentrok") {
                return false;
            }

            if (tanggalPengajuan(item) !== tanggalAktif) {
                return false;
            }

            const mulai = waktuMulaiPengajuan(item);
            const selesai = waktuSelesaiPengajuan(item);

            if (mulai === null || selesai === null) {
                return false;
            }

            return (
                mulai < selesaiAktif &&
                selesai > mulaiAktif
            );
        });

        if (
            !kelompok.some(
                (item) => String(item.id) === String(idAktif)
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
    // 12. TOMBOL TERUSKAN KONFLIK
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
    // 13. MENGAMBIL DETAIL PENGAJUAN
    // ==========================================

    function ambilPengajuan(id) {
        if (!id) return null;

        return layanan.getById("antrean", id);
    }

    // ==========================================
    // 14. PEMERIKSAAN KELAYAKAN PEMBATALAN
    // ==========================================

    function ambilBookingPengajuan(pengajuanId) {
        const bookings = layanan.getAll("bookings");

        if (!Array.isArray(bookings)) {
            return null;
        }

        return bookings.find((booking) =>
            String(booking.sourceSubmissionId) ===
                String(pengajuanId) ||
            String(booking.id) === `BOOK-${pengajuanId}`
        ) || null;
    }

    function periksaKelayakanPembatalan(pengajuanId) {
        const booking = ambilBookingPengajuan(pengajuanId);

        if (!booking) {
            return {
                boleh: false,
                pesan:
                    "Data booking tidak ditemukan. Pembatalan tidak dapat dilakukan."
            };
        }

        const statusBooking = normalisasiStatus(
            booking.presensi?.status || booking.status
        );

        // Periksa catatan presensi secara langsung.
        const attendance = layanan.getAll("attendance");

        const sudahAdaCatatan = Array.isArray(attendance) &&
            attendance.some((catatan) =>
                String(catatan.bookingId) === String(booking.id)
            );

        // Jika presensi sudah dicatat, pembatalan dilarang.
        if (
            sudahAdaCatatan ||
            booking.presensi?.status ||
            STATUS_PRESENSI_SELESAI.has(statusBooking)
        ) {
            return {
                boleh: false,
                pesan:
                    "Booking sudah memiliki catatan presensi. Booking yang sedang berjalan maupun yang sudah dicatat tidak digunakan tidak dapat dibatalkan."
            };
        }

        // Hanya booking yang masih menunggu presensi
        // yang dapat dibatalkan.
        if (!STATUS_MENUNGGU_PRESENSI.has(statusBooking)) {
            return {
                boleh: false,
                pesan:
                    "Pembatalan hanya dapat dilakukan pada booking yang masih menunggu presensi."
            };
        }

        return {
            boleh: true,
            pesan:
                "Booking masih menunggu presensi dan dapat dibatalkan.",
            booking
        };
    }

    function aturTampilanPembatalan(modal, pengajuanId) {
        const panel = modal.querySelector(
            '.verification-actions[data-panel="disetujui"]'
        );

        const informasi = modal.querySelector(
            '.review-information[data-panel="disetujui"]'
        );

        const tombol = panel?.querySelector(
            "[data-aksi-batalkan-persetujuan]"
        );

        const keterangan = informasi?.querySelector("span");

        if (!tombol) return;

        const hasil = periksaKelayakanPembatalan(
            pengajuanId
        );

        tombol.hidden = !hasil.boleh;

        if (keterangan) {
            keterangan.textContent = hasil.boleh
                ? "Pengajuan sudah disetujui dan masih menunggu presensi. Laboran dapat membatalkan persetujuan apabila ditemukan konflik jadwal."
                : hasil.pesan;
        }
    }

    // ==========================================
    // 15. MENAMPILKAN PANEL BERDASARKAN STATUS
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
    // 16. NOTIFIKASI DAN FEEDBACK
    // ==========================================

    function tampilkanPesan(modal, pesan, jenis = "error") {
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

        feedback.className = `aksi-feedback ${jenis}`;
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
            notifikasi.setAttribute("aria-live", "polite");

            document.body.append(notifikasi);
        }

        notifikasi.textContent = pesan;
        notifikasi.classList.add("aktif");

        window.setTimeout(() => {
            notifikasi.classList.remove("aktif");
        }, 3000);
    }

    // ==========================================
    // 17. MEMBUKA MODAL DETAIL
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

            modal.dataset.pengajuanId = pengajuan.id;

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
                formatAngka(ambilSkor(pengajuan))
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
            modal.querySelector(".aksi-feedback")?.remove();

            modal.querySelector(
                ".form-alasan-penolakan"
            )?.remove();

            // Tampilkan panel sesuai status.
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

                // Periksa kelayakan pembatalan berdasarkan presensi.
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

            modal.setAttribute("aria-hidden", "false");
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
    // 18. MENUTUP MODAL
    // ==========================================

    function tutupModal() {
        const modal = el.modal;

        modal.style.display = "none";
        modal.style.visibility = "hidden";
        modal.style.opacity = "0";
        modal.style.pointerEvents = "none";

        modal.classList.remove("is-open");

        modal.hidden = true;

        modal.setAttribute("aria-hidden", "true");

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
    // 19. PERSETUJUAN PENGAJUAN
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
            tampilkanPesan(modal, error.message);
        }
    }

    // ==========================================
    // 20. FORM PENOLAKAN PENGAJUAN
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
        error.setAttribute("aria-live", "polite");

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
                error.textContent = kesalahan.message;
            }
        });
    }

    // ==========================================
    // 21. MEMBATALKAN PERSETUJUAN
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
                throw new Error(pemeriksaanAwal.pesan);
            }

            const konfirmasi = window.confirm(
                "Apakah Anda yakin ingin membatalkan persetujuan booking ini? Booking yang masih menunggu presensi akan dikembalikan ke antrean Belum Disetujui."
            );

            if (!konfirmasi) return;

            // Pemeriksaan ulang untuk mencegah perubahan status
            // setelah modal konfirmasi ditampilkan.
            const pemeriksaanUlang =
                periksaKelayakanPembatalan(id);

            if (!pemeriksaanUlang.boleh) {
                throw new Error(pemeriksaanUlang.pesan);
            }

            if (
                typeof layanan.batalkanPersetujuan !== "function"
            ) {
                throw new Error(
                    "Fungsi pembatalan persetujuan belum tersedia pada layanan SILAB."
                );
            }

            // Layanan tetap menjadi pengaman utama.
            layanan.batalkanPersetujuan(id);

            // Kembalikan ke kategori Belum Disetujui.
            filterAktif = "belum-disetujui";

            el.filter.forEach((tombol) => {
                const aktif =
                    tombol.dataset.filterAntrean === filterAktif;

                tombol.classList.toggle("active", aktif);

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
            tampilkanPesan(modal, error.message);
        }
    }

    // ==========================================
    // 22. EVENT TOMBOL ANTREAN
    // ==========================================

    el.tabel.addEventListener("click", (event) => {
        const tombol = event.target.closest(
            "[data-aksi-detail]"
        );

        if (!tombol || !el.tabel.contains(tombol)) {
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
    // 23. EVENT TOMBOL MODAL
    // ==========================================

    el.modal.addEventListener("click", (event) => {

        // A. MEMBATALKAN PERSETUJUAN

        const tombolBatalkan = event.target.closest(
            "[data-aksi-batalkan-persetujuan]"
        );

        if (tombolBatalkan) {
            const id = el.modal.dataset.pengajuanId;

            if (id) {
                batalkanPersetujuan(el.modal, id);
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
                        kelompok.map((item) => String(item.id))
                    )
                ];

                tombolTeruskan.disabled = true;

                tombolTeruskan.textContent =
                    "Mengirim konflik...";

                layanan.kirimKonflik(pengajuanIds);

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
                setujui(el.modal, id);
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
                tampilkanFormPenolakan(el.modal, id);
            }
        }
    });

    // ==========================================
    // 24. MENUTUP MODAL DENGAN ESCAPE
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
    // 25. SINKRONISASI DATA
    // ==========================================

    window.addEventListener(
        "silab:data-changed",
        muatAntrean
    );

    window.addEventListener(
        "storage",
        muatAntrean
    );

    // ==========================================
    // 26. INISIALISASI
    // ==========================================

    el.modal.hidden = true;

    el.modal.setAttribute("aria-hidden", "true");

    el.modal.style.display = "none";

    muatAntrean();

    console.log(
        "SILAB: Modul antrean berhasil dimuat."
    );

})(window, document);
