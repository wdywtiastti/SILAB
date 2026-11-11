
/**
 * MODUL ANTREAN SILAB
 *
 * Mengelola:
 * 1. Pengambilan antrean aktif.
 * 2. Penyaringan status pengajuan.
 * 3. Pengurutan berdasarkan prioritas dan skor.
 * 4. Pagination.
 * 5. Detail pengajuan.
 * 6. Verifikasi pengajuan.
 * 7. Notifikasi tindakan Laboran.
 *
 * Data dikelola melalui layanan.js.
 */

(function (window, document) {
    "use strict";


    // =====================================================
    // 1. KONFIGURASI DAN ELEMEN HALAMAN
    // =====================================================

    const layanan = window.SILABService;

    const el = {
        tabel: document.getElementById("antrianBody"),
        template: document.getElementById("templateBarisAntrian"),
        total: document.getElementById("totalAntrian"),

        infoHalaman: document.getElementById("paginationInfo"),
        sebelumnya: document.getElementById("prevPage"),
        berikutnya: document.getElementById("nextPage"),
        nomorHalaman: document.getElementById("paginationNumbers"),

        modal: document.getElementById("modalReview"),
        notifikasi: document.getElementById("wadahNotifikasi")
    };

    const PER_HALAMAN = 5;

    const STATUS_ANTREAN_AKTIF = new Set([
        "verifikasi",
        "bentrok"
    ]);

    const STATUS_KEPUTUSAN = new Set([
        "disetujui",
        "ditolak"
    ]);

    // Informasi prioritas pengajuan.
    const PRIORITAS = {
        P1: {
            label: "P1 TINGGI",
            kelas: "p1",
            urutan: 1
        },
        P2: {
            label: "P2 SEDANG",
            kelas: "p2",
            urutan: 2
        },
        P3: {
            label: "P3 RENDAH",
            kelas: "p3",
            urutan: 3
        },
        P4: {
            label: "P4",
            kelas: "p4",
            urutan: 4
        },
        P5: {
            label: "P5",
            kelas: "p5",
            urutan: 5
        }
    };

    // Informasi status pengajuan.
    const STATUS = {
        bentrok: {
            label: "Bentrok",
            kelas: "conflict"
        },
        verifikasi: {
            label: "Verifikasi",
            kelas: "verify"
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

    let dataAntrean = [];
    let halamanAktif = 1;
    let idTerpilih = null;
    let timerModal = null;


    // =====================================================
    // 2. PEMERIKSAAN KOMPONEN
    // =====================================================

    const elemenWajib = [
        el.tabel,
        el.template,
        el.total,
        el.infoHalaman,
        el.sebelumnya,
        el.berikutnya,
        el.nomorHalaman,
        el.modal
    ];

    if (
        !layanan ||
        typeof layanan.getAntreanAktif !== "function" ||
        typeof layanan.getById !== "function" ||
        typeof layanan.update !== "function" ||
        elemenWajib.some(item => !item) ||
        !el.template.content
    ) {
        console.error(
            "SILAB: Layanan atau elemen modul antrean belum tersedia."
        );

        return;
    }


    // =====================================================
    // 3. UTILITAS FORMAT DATA
    // =====================================================

    // Mengubah format jam.
    function formatJam(nilai) {
        return String(nilai || "--:--").replace(":", ".");
    }


    // Menggabungkan hari dan rentang waktu.
    function formatWaktu(data) {
        if (
            !data.waktuMulai ||
            !data.waktuSelesai
        ) {
            return "Waktu belum ditentukan";
        }

        const rentang =
            `${formatJam(data.waktuMulai)}–${formatJam(data.waktuSelesai)}`;

        return data.hari
            ? `${data.hari}, ${rentang}`
            : `${data.tanggal || "Tanggal belum ditentukan"}, ${rentang}`;
    }


    // Mengubah skor menjadi format angka Indonesia.
    function formatSkor(nilai) {
        if (
            nilai === null ||
            nilai === undefined ||
            nilai === ""
        ) {
            return "Belum tersedia";
        }

        const angka = Number(nilai);

        if (!Number.isFinite(angka)) {
            return "Belum tersedia";
        }

        return angka.toLocaleString("id-ID", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }


    // Mengambil informasi prioritas.
    function infoPrioritas(nilai) {
        const kode = String(nilai || "").toUpperCase();

        return PRIORITAS[kode] || {
            label: kode || "Belum diklasifikasi",
            kelas: "priority-other",
            urutan: 99
        };
    }


    // Mengambil informasi status.
    function infoStatus(nilai) {
        const kode = String(nilai || "").toLowerCase();

        return STATUS[kode] || {
            label: kode
                ? kode.replaceAll("_", " ").replace(
                    /\b\w/g,
                    huruf => huruf.toUpperCase()
                )
                : "Belum ditentukan",

            kelas: "status-other"
        };
    }


    // =====================================================
    // 4. PENGAMBILAN DAN PENGURUTAN ANTREAN
    // =====================================================

    function ambilAntreanAktif() {

        // Mengambil data melalui layanan.js.
        // Layanan hanya mengembalikan status verifikasi
        // dan bentrok.

        return layanan.getAntreanAktif()

            // Pemeriksaan tambahan agar status lain
            // tidak masuk ke tabel antrean.
            .filter(data =>
                STATUS_ANTREAN_AKTIF.has(
                    String(data.status || "").toLowerCase()
                )
            )

            // Mengurutkan prioritas tertinggi terlebih dahulu.
            .sort((a, b) => {
                const bedaPrioritas =
                    infoPrioritas(a.prioritas).urutan -
                    infoPrioritas(b.prioritas).urutan;

                if (bedaPrioritas !== 0) {
                    return bedaPrioritas;
                }

                // Jika prioritas sama, skor tertinggi dahulu.
                return Number(b.skor || 0) -
                    Number(a.skor || 0);
            });
    }


    // =====================================================
    // 5. UTILITAS TAMPILAN
    // =====================================================

    // Mengisi teks tanpa memasukkan HTML dari pengguna.
    function isiTeks(akar, pemilih, nilai) {
        const target = akar.querySelector(pemilih);

        if (!target) {
            return;
        }

        target.textContent =
            nilai === null ||
            nilai === undefined ||
            nilai === ""
                ? "—"
                : String(nilai);
    }


    // Mengatur badge prioritas dan status.
    function aturBadge(akar, pemilih, dasar, info) {
        const badge = akar.querySelector(pemilih);

        if (!badge) {
            return;
        }

        badge.className = `${dasar} ${info.kelas}`;
        badge.textContent = info.label;
    }


    // =====================================================
    // 6. MEMBUAT BARIS TABEL
    // =====================================================

    function buatBaris(data) {
        const baris = el.template.content
            .firstElementChild.cloneNode(true);

        const peserta = data.jumlahPeserta ?? "—";

        baris.dataset.id = data.id;

        // ID pengajuan.
        isiTeks(
            baris,
            '[data-field="id"]',
            `#${data.id}`
        );

        // Nama kegiatan.
        isiTeks(
            baris,
            '[data-field="nama-kegiatan"]',
            data.namaKegiatan
        );

        // Nama pemohon dan jumlah peserta.
        isiTeks(
            baris,
            '[data-field="pemohon"]',
            `Pemohon: ${data.namaPemohon || "—"} • ${peserta} peserta`
        );

        // Waktu pengajuan.
        isiTeks(
            baris,
            '[data-field="rentang-waktu"]',
            formatWaktu(data)
        );

        // Kebutuhan fasilitas.
        isiTeks(
            baris,
            '[data-field="kebutuhan"]',
            `PC: ${data.kebutuhanPC ?? "—"} • Kursi: ${data.kebutuhanKursi ?? "—"}`
        );

        // Skor klasifikasi.
        isiTeks(
            baris,
            '[data-field="skor"]',
            `Skor: ${formatSkor(data.skor)}`
        );

        // Badge prioritas.
        aturBadge(
            baris,
            '[data-field="prioritas"]',
            "priority-badge",
            infoPrioritas(data.prioritas)
        );

        // Badge status.
        aturBadge(
            baris,
            '[data-field="status"]',
            "status-badge",
            infoStatus(data.status)
        );

        // ID untuk tombol detail.
        const tombolDetail = baris.querySelector(
            "[data-aksi-detail]"
        );

        if (tombolDetail) {
            tombolDetail.dataset.id = data.id;
        }

        return baris;
    }


    // =====================================================
    // 7. PAGINATION
    // =====================================================

    function tampilkanNomorHalaman(totalHalaman) {
        el.nomorHalaman.replaceChildren();

        for (
            let nomor = 1;
            nomor <= totalHalaman;
            nomor += 1
        ) {
            const tombol = document.createElement("button");

            tombol.type = "button";

            tombol.className =
                `pagination-btn${nomor === halamanAktif ? " active" : ""}`;

            tombol.textContent = nomor;

            tombol.dataset.halaman = nomor;

            if (nomor === halamanAktif) {
                tombol.setAttribute(
                    "aria-current",
                    "page"
                );
            }

            el.nomorHalaman.append(tombol);
        }
    }


    // =====================================================
    // 8. MENAMPILKAN ANTREAN
    // =====================================================

    function tampilkanAntrean() {
        try {
            dataAntrean = ambilAntreanAktif();

        } catch (error) {
            console.error(
                "SILAB: Gagal mengambil data antrean.",
                error
            );

            dataAntrean = [];

            el.tabel.replaceChildren();

            tampilkanPesanKosong(
                "Data antrean gagal dimuat."
            );

            perbaruiPagination(0);

            return;
        }

        const total = dataAntrean.length;

        const totalHalaman = Math.max(
            1,
            Math.ceil(total / PER_HALAMAN)
        );

        // Memastikan halaman aktif tidak melebihi jumlah halaman.
        halamanAktif = Math.min(
            halamanAktif,
            totalHalaman
        );

        el.tabel.replaceChildren();

        if (total === 0) {
            tampilkanPesanKosong(
                "Belum ada pengajuan yang perlu diproses."
            );

        } else {
            const awal =
                (halamanAktif - 1) * PER_HALAMAN;

            const fragmen =
                document.createDocumentFragment();

            dataAntrean
                .slice(awal, awal + PER_HALAMAN)
                .forEach(data => {
                    fragmen.append(
                        buatBaris(data)
                    );
                });

            el.tabel.append(fragmen);
        }

        el.total.textContent =
            `${total} Pengajuan`;

        el.infoHalaman.textContent = total
            ? `Menampilkan ${(halamanAktif - 1) * PER_HALAMAN + 1}–${Math.min(halamanAktif * PER_HALAMAN, total)} dari ${total} pengajuan`
            : "Belum ada pengajuan aktif";

        tampilkanNomorHalaman(
            total ? totalHalaman : 0
        );

        perbaruiPagination(total);
    }


    // Mengatur tombol pagination.
    function perbaruiPagination(total) {
        const totalHalaman = Math.max(
            1,
            Math.ceil(total / PER_HALAMAN)
        );

        el.sebelumnya.disabled =
            halamanAktif <= 1 || total === 0;

        el.berikutnya.disabled =
            halamanAktif >= totalHalaman || total === 0;
    }


    // Menampilkan pesan ketika tabel kosong.
    function tampilkanPesanKosong(pesan) {
        const baris = document.createElement("tr");

        const sel = document.createElement("td");

        sel.colSpan = 6;

        sel.className = "empty-state";

        sel.textContent = pesan;

        baris.append(sel);

        el.tabel.append(baris);
    }


    // =====================================================
    // 9. DETAIL PENGAJUAN
    // =====================================================

    function isiModal(data) {

        // Informasi utama.
        isiTeks(
            el.modal,
            '[data-field="label-id"]',
            `DETAIL PENGAJUAN #${data.id}`
        );

        isiTeks(
            el.modal,
            '[data-field="judul-kegiatan"]',
            data.namaKegiatan
        );

        isiTeks(
            el.modal,
            '[data-field="nama-pemohon"]',
            data.namaPemohon
        );

        isiTeks(
            el.modal,
            '[data-field="identifier"]',
            data.nipNpm
        );

        isiTeks(
            el.modal,
            '[data-field="waktu"]',
            formatWaktu(data)
        );

        isiTeks(
            el.modal,
            '[data-field="jumlah-peserta"]',
            `${data.jumlahPeserta ?? "—"} peserta`
        );

        isiTeks(
            el.modal,
            '[data-field="kategori"]',
            data.kategori
        );

        isiTeks(
            el.modal,
            '[data-field="kebutuhan-pc"]',
            `${data.kebutuhanPC ?? "—"} unit`
        );

        isiTeks(
            el.modal,
            '[data-field="kebutuhan-kursi"]',
            `${data.kebutuhanKursi ?? "—"} unit`
        );

        isiTeks(
            el.modal,
            '[data-field="skor-detail"]',
            formatSkor(data.skor)
        );

        // Badge prioritas.
        aturBadge(
            el.modal,
            '[data-field="prioritas-detail"]',
            "priority-badge",
            infoPrioritas(data.prioritas)
        );

        // Badge status.
        aturBadge(
            el.modal,
            '[data-field="status-detail"]',
            "status-badge",
            infoStatus(data.status)
        );

        // Menampilkan panel sesuai status aktif.
        const status = String(
            data.status || ""
        ).toLowerCase();

        const panel = [
            "bentrok",
            "verifikasi"
        ].includes(status)
            ? status
            : "lainnya";

        el.modal.querySelectorAll(
            "[data-panel]"
        ).forEach(item => {
            item.hidden =
                item.dataset.panel !== panel;
        });

        // Pesan ketika terjadi bentrok.
        isiTeks(
            el.modal,
            '[data-field="pesan-bentrok"]',
            `Pengajuan #${data.id} terindikasi mengalami bentrok pada ${formatWaktu(data)}. Laboran perlu menindaklanjuti kasus ini sesuai prosedur pemeriksaan bentrok.`
        );

        // Pesan verifikasi.
        isiTeks(
            el.modal,
            '[data-field="pesan-verifikasi"]',
            `Pengajuan #${data.id} sedang menunggu pemeriksaan Laboran. Periksa kelengkapan informasi sebelum memberikan keputusan.`
        );
    }


    // =====================================================
    // 10. MEMBUKA MODAL
    // =====================================================

    function bukaModal(id) {
        const data = layanan.getById(
            "antrean",
            id
        );

        // Memastikan pengajuan masih berada
        // dalam antrean aktif.
        if (
            !data ||
            !STATUS_ANTREAN_AKTIF.has(
                String(data.status || "").toLowerCase()
            )
        ) {
            tampilkanNotifikasi(
                "Data tidak tersedia",
                "Pengajuan sudah tidak berada dalam antrean aktif.",
                "error"
            );

            tampilkanAntrean();

            return;
        }

        idTerpilih = String(data.id);

        isiModal(data);

        window.clearTimeout(timerModal);

        el.modal.hidden = false;

        el.modal.setAttribute(
            "aria-hidden",
            "false"
        );

        document.body.classList.add(
            "modal-terbuka"
        );

        window.requestAnimationFrame(() => {
            el.modal.classList.add("is-open");

            el.modal
                .querySelector(".review-modal-content")
                ?.focus();
        });
    }


    // =====================================================
    // 11. MENUTUP MODAL
    // =====================================================

    function tutupModal() {
        if (el.modal.hidden) {
            return;
        }

        el.modal.classList.remove("is-open");

        el.modal.setAttribute(
            "aria-hidden",
            "true"
        );

        document.body.classList.remove(
            "modal-terbuka"
        );

        window.clearTimeout(timerModal);

        timerModal = window.setTimeout(() => {
            el.modal.hidden = true;

            idTerpilih = null;

        }, 250);
    }


    // =====================================================
    // 12. NOTIFIKASI
    // =====================================================

    function tampilkanNotifikasi(
        judul,
        pesan,
        jenis = "sukses"
    ) {
        if (!el.notifikasi) {
            console.warn(
                `SILAB: ${judul} - ${pesan}`
            );

            return;
        }

        const toast = document.createElement("div");

        const ikon = document.createElement("i");

        const konten = document.createElement("div");

        const judulToast = document.createElement("strong");

        const pesanToast = document.createElement("p");

        toast.className = "notifikasi-toast";

        toast.dataset.jenis = jenis;

        ikon.className = jenis === "error"
            ? "bi bi-exclamation-circle-fill notifikasi-ikon"
            : "bi bi-check-circle-fill notifikasi-ikon";

        konten.className = "notifikasi-konten";

        judulToast.className = "notifikasi-judul";

        pesanToast.className = "notifikasi-pesan";

        judulToast.textContent = judul;

        pesanToast.textContent = pesan;

        konten.append(
            judulToast,
            pesanToast
        );

        toast.append(
            ikon,
            konten
        );

        el.notifikasi.append(toast);

        window.setTimeout(() => {
            toast.classList.add("is-hilang");

            window.setTimeout(() => {
                toast.remove();
            }, 250);

        }, 3200);
    }


    // =====================================================
    // 13. PROSES VERIFIKASI
    // =====================================================

    function prosesVerifikasi(keputusan) {

        // Hanya dua keputusan yang diperbolehkan.
        if (
            !idTerpilih ||
            !STATUS_KEPUTUSAN.has(keputusan)
        ) {
            return;
        }

        const data = layanan.getById(
            "antrean",
            idTerpilih
        );

        // Memastikan status masih verifikasi.
        if (
            !data ||
            String(data.status).toLowerCase() !==
                "verifikasi"
        ) {
            tampilkanNotifikasi(
                "Pengajuan tidak dapat diproses",
                "Status pengajuan sudah berubah atau tidak lagi menunggu verifikasi.",
                "error"
            );

            tutupModal();

            tampilkanAntrean();

            return;
        }

        const tindakan = keputusan === "disetujui"
            ? "menyetujui"
            : "menolak";

        if (
            !window.confirm(
                `Apakah Anda yakin ingin ${tindakan} pengajuan ${data.id}?`
            )
        ) {
            return;
        }

        try {
            // Memperbarui status melalui layanan.js.
            layanan.update(
                "antrean",
                idTerpilih,
                {
                    status: keputusan,

                    waktuVerifikasi:
                        new Date().toISOString()
                }
            );

            // Pengajuan otomatis keluar dari antrean aktif.
            tutupModal();

            tampilkanNotifikasi(
                keputusan === "disetujui"
                    ? "Pengajuan disetujui"
                    : "Pengajuan ditolak",

                `Status ${data.id} berhasil diperbarui dan dikeluarkan dari antrean aktif.`
            );

            tampilkanAntrean();

        } catch (error) {
            console.error(
                "SILAB Antrean:",
                error
            );

            tampilkanNotifikasi(
                "Perubahan gagal disimpan",

                error.message ||
                    "Terjadi kesalahan saat memperbarui pengajuan.",

                "error"
            );
        }
    }


    // =====================================================
    // 14. EVENT TOMBOL DETAIL
    // =====================================================

    el.tabel.addEventListener(
        "click",
        event => {
            const tombol = event.target.closest(
                "[data-aksi-detail]"
            );

            if (
                tombol &&
                el.tabel.contains(tombol)
            ) {
                bukaModal(tombol.dataset.id);
            }
        }
    );


    // =====================================================
    // 15. EVENT PAGINATION
    // =====================================================

    // Halaman sebelumnya.
    el.sebelumnya.addEventListener(
        "click",
        () => {
            if (halamanAktif > 1) {
                halamanAktif -= 1;

                tampilkanAntrean();
            }
        }
    );


    // Halaman berikutnya.
    el.berikutnya.addEventListener(
        "click",
        () => {
            const totalHalaman = Math.ceil(
                dataAntrean.length / PER_HALAMAN
            );

            if (halamanAktif < totalHalaman) {
                halamanAktif += 1;

                tampilkanAntrean();
            }
        }
    );


    // Nomor halaman.
    el.nomorHalaman.addEventListener(
        "click",
        event => {
            const tombol = event.target.closest(
                "[data-halaman]"
            );

            if (!tombol) {
                return;
            }

            halamanAktif = Number(
                tombol.dataset.halaman
            );

            tampilkanAntrean();
        }
    );


    // =====================================================
    // 16. EVENT MODAL
    // =====================================================

    el.modal.addEventListener(
        "click",
        event => {

            // Menutup modal.
            if (
                event.target.closest(
                    "[data-tutup-modal]"
                )
            ) {
                tutupModal();

                return;
            }

            // Menjalankan keputusan verifikasi.
            const tombol = event.target.closest(
                "[data-keputusan]"
            );

            if (tombol) {
                prosesVerifikasi(
                    tombol.dataset.keputusan
                );
            }
        }
    );


    // =====================================================
    // 17. TOMBOL ESCAPE
    // =====================================================

    document.addEventListener(
        "keydown",
        event => {
            if (
                event.key === "Escape" &&
                !el.modal.hidden
            ) {
                tutupModal();
            }
        }
    );


    // =====================================================
    // 18. SINKRONISASI DATA
    // =====================================================

    // Memperbarui tampilan ketika layanan.js
    // mengirimkan pemberitahuan perubahan data.

    window.addEventListener(
        "silab:data-changed",
        () => {
            tampilkanAntrean();
        }
    );


    // =====================================================
    // 19. INISIALISASI MODUL
    // =====================================================

    tampilkanAntrean();

    console.log(
        "SILAB: Modul antrean berhasil dimuat."
    );

})(window, document);
