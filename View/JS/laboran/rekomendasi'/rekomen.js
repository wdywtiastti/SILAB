
/**
 * MODUL REKOMENDASI JADWAL SILAB
 *
 * Mengelola:
 * 1. Data pengguna tergeser.
 * 2. Status menunggu rekomendasi.
 * 3. Status rekomendasi dikirim.
 * 4. Pencarian dan filter.
 * 5. Pagination.
 * 6. Statistik rekomendasi.
 * 7. Navigasi buat dan edit rekomendasi.
 * 8. Pembatalan rekomendasi maksimal 24 jam.
 */

(function (window, document) {
    "use strict";

    // =====================================================
    // 1. KONFIGURASI
    // =====================================================

    const layanan = window.SILABService;

    const PER_HALAMAN = 5;

    const HALAMAN_BUAT = "buat_rekomendasi.html";

    const STATUS_AKTIF = [
        "menunggu_rekomendasi",
        "rekomendasi_dikirim"
    ];

    const PRIORITAS = {
        P1: 1,
        P2: 2,
        P3: 3,
        P4: 4,
        P5: 5
    };

    // =====================================================
    // 2. ELEMEN HTML
    // =====================================================

    const el = {
        tabel: document.getElementById("tabelBody"),

        template: document.getElementById(
            "templateBarisTergeser"
        ),

        pencarian: document.querySelector(
            "[data-cari-kasus]"
        ),

        filter: document.querySelector(
            "[data-filter-kasus]"
        ),

        infoPagination: document.querySelector(
            "[data-info-pagination]"
        ),

        tombolPagination: document.querySelector(
            "[data-pagination-buttons]"
        ),

        total: document.querySelector(
            '[data-stat="total"]'
        ),

        sumber: document.querySelector(
            '[data-stat="sumber"]'
        ),

        kategori: document.querySelector(
            '[data-stat="kategori"]'
        ),

        kategoriDetail: document.querySelector(
            '[data-stat="kategori-detail"]'
        ),

        pending: document.querySelector(
            '[data-stat="pending"]'
        ),

        selesai: document.querySelector(
            '[data-stat="selesai"]'
        )
    };

    // =====================================================
    // 3. VALIDASI AWAL
    // =====================================================

    if (!layanan) {
        console.error(
            "SILAB: layanan.js belum dimuat."
        );
        return;
    }

    if (
        typeof layanan.getRekomendasiAktif !== "function" ||
        typeof layanan.batalkanRekomendasi !== "function"
    ) {
        console.error(
            "SILAB: Fungsi rekomendasi pada layanan.js belum tersedia."
        );
        return;
    }

    if (
        !el.tabel ||
        !el.template ||
        !el.pencarian ||
        !el.filter ||
        !el.infoPagination ||
        !el.tombolPagination
    ) {
        console.error(
            "SILAB: Struktur HTML rekomendasi belum lengkap."
        );
        return;
    }

    // =====================================================
    // 4. STATE MODUL
    // =====================================================

    let semuaKasus = [];
    let kasusDitampilkan = [];

    let halamanAktif = 1;
    let hanyaMenunggu = false;

    let kasusPembatalan = null;
    let timerPembaruan = null;

    // =====================================================
    // 5. UTILITAS DATA
    // =====================================================

    function ambilNilai(data, properti, alternatif = null) {
        if (
            data &&
            data[properti] !== undefined &&
            data[properti] !== null &&
            data[properti] !== ""
        ) {
            return data[properti];
        }

        if (
            data?.pengajuan &&
            data.pengajuan[properti] !== undefined &&
            data.pengajuan[properti] !== null
        ) {
            return data.pengajuan[properti];
        }

        return alternatif;
    }

    function formatJam(nilai) {
        if (!nilai) return "--:--";

        return String(nilai)
            .slice(0, 5)
            .replace(":", ".");
    }

    function formatTanggal(nilai) {
        if (!nilai) return "Tanggal belum tersedia";

        const cocok = String(nilai).match(
            /^(\d{4})-(\d{2})-(\d{2})/
        );

        if (!cocok) return String(nilai);

        const tanggal = new Date(
            Number(cocok[1]),
            Number(cocok[2]) - 1,
            Number(cocok[3])
        );

        return tanggal.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
    }

    function formatJadwalAsal(kasus) {
        const jadwal = kasus.jadwalAsal;

        // Mendukung format tanggal ISO pada data lama.
        if (
            typeof jadwal === "string" &&
            jadwal.includes("T")
        ) {
            const tanggal = new Date(jadwal);

            if (!Number.isNaN(tanggal.getTime())) {
                return tanggal.toLocaleString("id-ID", {
                    timeZone: "Asia/Jayapura",
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23"
                });
            }
        }

        const tanggal = kasus.tanggal
            ? formatTanggal(kasus.tanggal)
            : kasus.hari || "Hari belum tersedia";

        return (
            `${tanggal}, ` +
            `${formatJam(kasus.waktuMulai)}–` +
            `${formatJam(kasus.waktuSelesai)}`
        );
    }

    function formatPrioritas(kasus) {
        const kategori = ambilNilai(kasus, "kategori", "");
        const prioritas = ambilNilai(kasus, "prioritas", "");

        return [kategori, prioritas]
            .filter(Boolean)
            .join(" • ") || "Belum diklasifikasi";
    }

    function ambilIdPengajuan(kasus) {
        return kasus.pengajuanId ||
            kasus.pengajuan?.id ||
            kasus.id;
    }

    function ambilStatus(kasus) {
        return String(kasus.status || "").toLowerCase();
    }

    function ambilBatasWaktu(kasus) {
        const batas = kasus.kedaluwarsaPada ||
            kasus.batasEditPada;

        if (batas) {
            const waktu = Date.parse(batas);

            return Number.isFinite(waktu)
                ? waktu
                : null;
        }

        const waktuKirim = kasus.dikirimPada ||
            kasus.waktuDikirim;

        if (waktuKirim) {
            const waktu = Date.parse(waktuKirim);

            return Number.isFinite(waktu)
                ? waktu + (24 * 60 * 60 * 1000)
                : null;
        }

        return null;
    }

    function hitungSisaWaktu(kasus) {
        const batas = ambilBatasWaktu(kasus);

        if (!batas) {
            return {
                aktif: false,
                teks: "Batas waktu 24 jam belum tercatat"
            };
        }

        const sisa = batas - Date.now();

        if (sisa <= 0) {
            return {
                aktif: false,
                teks: "Batas waktu 24 jam telah berakhir"
            };
        }

        const jam = Math.floor(
            sisa / (60 * 60 * 1000)
        );

        const menit = Math.floor(
            (sisa % (60 * 60 * 1000)) /
            (60 * 1000)
        );

        return {
            aktif: true,
            teks: `Sisa waktu edit: ${jam} jam ${menit} menit`
        };
    }

    // =====================================================
    // 6. PEMBUAT ELEMEN
    // =====================================================

    function buatElemen(tag, kelas, teks) {
        const elemen = document.createElement(tag);

        if (kelas) {
            elemen.className = kelas;
        }

        if (teks !== undefined && teks !== null) {
            elemen.textContent = String(teks);
        }

        return elemen;
    }

    function isiField(akar, pemilih, nilai) {
        const target = akar.querySelector(pemilih);

        if (target) {
            target.textContent =
                nilai === null ||
                nilai === undefined ||
                nilai === ""
                    ? "—"
                    : String(nilai);
        }
    }

    function buatBadgeStatus(status) {
        const informasi = status === "menunggu_rekomendasi"
            ? {
                label: "Menunggu Rekomendasi",
                kelas: "status-menunggu"
            }
            : {
                label: "Rekomendasi Dikirim",
                kelas: "status-dikirim"
            };

        return buatElemen(
            "span",
            `badge-status-rekomendasi ${informasi.kelas}`,
            informasi.label
        );
    }

    // =====================================================
    // 7. NAVIGASI FORMULIR
    // =====================================================

    function buatURLFormulir(kasus, mode) {
        const url = new URL(
            HALAMAN_BUAT,
            window.location.href
        );

        url.searchParams.set(
            "pengajuan",
            ambilIdPengajuan(kasus)
        );

        url.searchParams.set(
            "kasus",
            kasus.id
        );

        url.searchParams.set(
            "mode",
            mode
        );

        return url.href;
    }

    // =====================================================
    // 8. TOMBOL AKSI
    // =====================================================

    function buatAksi(kasus) {
        const wadah = buatElemen(
            "div",
            "kolom-aksi-inner"
        );

        const status = ambilStatus(kasus);

        // Kasus belum memiliki rekomendasi.
        if (status === "menunggu_rekomendasi") {
            const tombol = buatElemen(
                "a",
                "btn-rekomendasi",
                "Beri Rekomendasi"
            );

            tombol.href = buatURLFormulir(
                kasus,
                "buat"
            );

            wadah.append(tombol);

            return wadah;
        }

        // Rekomendasi sudah dikirim.
        if (status === "rekomendasi_dikirim") {
            const sisa = hitungSisaWaktu(kasus);

            if (sisa.aktif) {
                const tombolEdit = buatElemen(
                    "a",
                    "btn-rekomendasi btn-edit-rekomendasi",
                    "Edit"
                );

                tombolEdit.href = buatURLFormulir(
                    kasus,
                    "edit"
                );

                const tombolBatal = buatElemen(
                    "button",
                    "btn-rekomendasi btn-batal-rekomendasi",
                    "Batalkan"
                );

                tombolBatal.type = "button";
                tombolBatal.dataset.aksi = "batalkan";
                tombolBatal.dataset.id = kasus.id;

                wadah.append(
                    tombolEdit,
                    tombolBatal
                );

            } else {
                const informasi = buatElemen(
                    "span",
                    "batas-waktu-berakhir",
                    "Masa edit 24 jam berakhir"
                );

                wadah.append(informasi);
            }
        }

        return wadah;
    }

    // =====================================================
    // 9. MEMBUAT BARIS PENGGUNA TERGESER
    // =====================================================

    function buatBaris(kasus) {
        const fragmen = el.template.content.cloneNode(true);

        const baris = fragmen.querySelector(".tabel-row");

        if (!baris) {
            return document.createDocumentFragment();
        }

        baris.dataset.id = kasus.id;

        isiField(
            baris,
            '[data-field="namaPemohon"]',
            ambilNilai(kasus, "namaPemohon", "Nama tidak tersedia")
        );

        isiField(
            baris,
            '[data-field="nipNpm"]',
            ambilNilai(kasus, "nipNpm", "NIP/NPM tidak tersedia")
        );

        isiField(
            baris,
            '[data-field="jadwalAsal"]',
            formatJadwalAsal(kasus)
        );

        isiField(
            baris,
            '[data-field="namaKegiatan"]',
            ambilNilai(kasus, "namaKegiatan", "Kegiatan tidak tersedia")
        );

        isiField(
            baris,
            '[data-field="kebutuhanPC"]',
            `PC: ${ambilNilai(kasus, "kebutuhanPC", 0)} unit`
        );

        isiField(
            baris,
            '[data-field="kebutuhanKursi"]',
            `Kursi: ${ambilNilai(kasus, "kebutuhanKursi", 0)} unit`
        );

        isiField(
            baris,
            '[data-field="kategoriPrioritas"]',
            formatPrioritas(kasus)
        );

        isiField(
            baris,
            '[data-field="alasan"]',
            kasus.alasan || "Alasan belum tersedia"
        );

        isiField(
            baris,
            '[data-field="namaPenggeser"]',
            kasus.namaPenggeser
                ? `Penggeser: ${kasus.namaPenggeser}`
                : ""
        );

        // Menambahkan status tanpa mengubah struktur template.
        const kolomAlasan = baris.querySelector(
            ".kolom-alasan"
        );

        if (kolomAlasan) {
            kolomAlasan.append(
                buatBadgeStatus(ambilStatus(kasus))
            );
        }

        // Menampilkan jadwal alternatif jika rekomendasi sudah dikirim.
        if (ambilStatus(kasus) === "rekomendasi_dikirim") {
            const jadwalRekomendasi =
                kasus.rekomendasiTerbaru;

            const kolomJadwal = baris.querySelector(
                ".kolom-jadwal"
            );

            if (
                kolomJadwal &&
                jadwalRekomendasi?.waktuMulai &&
                jadwalRekomendasi?.waktuSelesai
            ) {
                kolomJadwal.append(
                    buatElemen(
                        "span",
                        "jadwal-alternatif",
                        `Alternatif: ${jadwalRekomendasi.waktuMulai}–${jadwalRekomendasi.waktuSelesai}`
                    )
                );
            }
        }

        // Mengganti tombol berdasarkan status kasus.
        const kolomAksi = baris.querySelector(".kolom-aksi");

        if (kolomAksi) {
            kolomAksi.replaceChildren(
                buatAksi(kasus)
            );
        }

        return fragmen;
    }

    // =====================================================
    // 10. MENGAMBIL DATA REKOMENDASI
    // =====================================================

    function ambilData() {
        try {
            const data = layanan.getRekomendasiAktif();

            if (!Array.isArray(data)) {
                throw new Error(
                    "Format data rekomendasi tidak valid."
                );
            }

            semuaKasus = data.filter(kasus =>
                STATUS_AKTIF.includes(ambilStatus(kasus))
            );

            semuaKasus.sort((a, b) => {
                const prioritasA =
                    PRIORITAS[
                        String(a.prioritas || "").toUpperCase()
                    ] || 99;

                const prioritasB =
                    PRIORITAS[
                        String(b.prioritas || "").toUpperCase()
                    ] || 99;

                return prioritasA - prioritasB ||
                    String(a.namaPemohon || "").localeCompare(
                        String(b.namaPemohon || ""),
                        "id"
                    );
            });

        } catch (error) {
            console.error(
                "SILAB: Gagal mengambil data rekomendasi.",
                error
            );

            semuaKasus = [];

            tampilkanNotifikasi(
                "Data gagal dimuat",
                error.message,
                "error"
            );
        }
    }

    // =====================================================
    // 11. STATISTIK
    // =====================================================

    function perbaruiStatistik() {
        const total = semuaKasus.length;

        const menunggu = semuaKasus.filter(
            kasus =>
                ambilStatus(kasus) === "menunggu_rekomendasi"
        ).length;

        const dikirim = semuaKasus.filter(
            kasus =>
                ambilStatus(kasus) === "rekomendasi_dikirim"
        ).length;

        const kategori = [
            ...new Set(
                semuaKasus
                    .map(kasus =>
                        ambilNilai(kasus, "kategori")
                    )
                    .filter(Boolean)
            )
        ];

        if (el.total) {
            el.total.textContent = `${total} Pengguna`;
        }

        if (el.sumber) {
            el.sumber.textContent =
                "Berdasarkan data pengguna tergeser";
        }

        if (el.kategori) {
            el.kategori.textContent =
                `${kategori.length} Kategori`;
        }

        if (el.kategoriDetail) {
            el.kategoriDetail.textContent =
                kategori.length
                    ? kategori.join(", ")
                    : "Belum ada klasifikasi";
        }

        if (el.pending) {
            el.pending.textContent =
                `${menunggu} Perlu Solusi Slot`;
        }

        if (el.selesai) {
            el.selesai.textContent =
                `${dikirim} Selesai Direkomendasikan`;
        }
    }

    // =====================================================
    // 12. PENCARIAN DAN FILTER
    // =====================================================

    function filterData() {
        const kataKunci = el.pencarian.value
            .trim()
            .toLowerCase();

        kasusDitampilkan = semuaKasus.filter(kasus => {
            const status = ambilStatus(kasus);

            if (
                hanyaMenunggu &&
                status !== "menunggu_rekomendasi"
            ) {
                return false;
            }

            const nama = String(
                ambilNilai(kasus, "namaPemohon", "")
            ).toLowerCase();

            const identifier = String(
                ambilNilai(kasus, "nipNpm", "")
            ).toLowerCase();

            const kegiatan = String(
                ambilNilai(kasus, "namaKegiatan", "")
            ).toLowerCase();

            return (
                nama.includes(kataKunci) ||
                identifier.includes(kataKunci) ||
                kegiatan.includes(kataKunci)
            );
        });

        const totalHalaman = Math.max(
            1,
            Math.ceil(kasusDitampilkan.length / PER_HALAMAN)
        );

        halamanAktif = Math.min(
            halamanAktif,
            totalHalaman
        );
    }

    // =====================================================
    // 13. PAGINATION
    // =====================================================

    function tampilkanPagination() {
        const total = kasusDitampilkan.length;

        const totalHalaman = Math.ceil(
            total / PER_HALAMAN
        );

        el.tombolPagination.replaceChildren();

        if (!total) {
            el.infoPagination.textContent =
                "Belum ada kasus yang sesuai.";

            return;
        }

        const awal =
            (halamanAktif - 1) * PER_HALAMAN + 1;

        const akhir = Math.min(
            halamanAktif * PER_HALAMAN,
            total
        );

        el.infoPagination.textContent =
            `Menampilkan ${awal}–${akhir} dari ${total} kasus`;

        // Tombol sebelumnya.
        const sebelumnya = buatElemen(
            "button",
            "pagination-btn",
            "‹"
        );

        sebelumnya.type = "button";
        sebelumnya.disabled = halamanAktif === 1;
        sebelumnya.dataset.halaman = halamanAktif - 1;

        el.tombolPagination.append(sebelumnya);

        // Nomor halaman.
        for (
            let nomor = 1;
            nomor <= totalHalaman;
            nomor++
        ) {
            const tombol = buatElemen(
                "button",
                `pagination-btn${nomor === halamanAktif ? " active" : ""}`,
                nomor
            );

            tombol.type = "button";
            tombol.dataset.halaman = nomor;

            if (nomor === halamanAktif) {
                tombol.setAttribute("aria-current", "page");
            }

            el.tombolPagination.append(tombol);
        }

        // Tombol berikutnya.
        const berikutnya = buatElemen(
            "button",
            "pagination-btn",
            "›"
        );

        berikutnya.type = "button";
        berikutnya.disabled =
            halamanAktif === totalHalaman;

        berikutnya.dataset.halaman = halamanAktif + 1;

        el.tombolPagination.append(berikutnya);
    }

    // =====================================================
    // 14. TAMPILKAN DATA
    // =====================================================

    function tampilkanRekomendasi() {
        ambilData();

        perbaruiStatistik();

        filterData();

        el.tabel.replaceChildren();

        if (!kasusDitampilkan.length) {
            const kosong = buatElemen(
                "div",
                "empty-state",
                "Belum ada kasus pengguna tergeser yang perlu ditindaklanjuti."
            );

            kosong.setAttribute("role", "status");

            el.tabel.append(kosong);

        } else {
            const awal =
                (halamanAktif - 1) * PER_HALAMAN;

            const dataHalaman = kasusDitampilkan.slice(
                awal,
                awal + PER_HALAMAN
            );

            const fragmen =
                document.createDocumentFragment();

            dataHalaman.forEach(kasus => {
                fragmen.append(
                    buatBaris(kasus)
                );
            });

            el.tabel.append(fragmen);
        }

        tampilkanPagination();
    }

    // =====================================================
    // 15. DIALOG PEMBATALAN
    // =====================================================

    function buatDialogPembatalan() {
        let dialog = document.getElementById(
            "dialogBatalRekomendasi"
        );

        if (dialog) return dialog;

        dialog = document.createElement("dialog");
        dialog.id = "dialogBatalRekomendasi";
        dialog.className = "dialog-batal-rekomendasi";

        const form = document.createElement("form");
        form.className = "form-batal-rekomendasi";

        const judul = buatElemen(
            "h3",
            "",
            "Batalkan Rekomendasi"
        );

        const keterangan = buatElemen(
            "p",
            "",
            "Kasus akan kembali ke status menunggu rekomendasi. Riwayat rekomendasi tetap disimpan."
        );

        const label = buatElemen(
            "label",
            "",
            "Alasan Pembatalan"
        );

        label.htmlFor = "alasanBatalRekomendasi";

        const textarea = document.createElement("textarea");
        textarea.id = "alasanBatalRekomendasi";
        textarea.name = "alasan";
        textarea.rows = 4;
        textarea.maxLength = 500;
        textarea.required = true;
        textarea.placeholder = "Tuliskan alasan pembatalan...";

        const tombolKembali = buatElemen(
            "button",
            "btn-reject",
            "Kembali"
        );

        tombolKembali.type = "button";
        tombolKembali.dataset.tutupDialog = "";

        const tombolKonfirmasi = buatElemen(
            "button",
            "btn-recommend",
            "Konfirmasi Pembatalan"
        );

        tombolKonfirmasi.type = "submit";

        const aksi = buatElemen(
            "div",
            "dialog-rekomendasi-actions"
        );

        aksi.append(
            tombolKembali,
            tombolKonfirmasi
        );

        form.append(
            judul,
            keterangan,
            label,
            textarea,
            aksi
        );

        dialog.append(form);

        document.body.append(dialog);

        return dialog;
    }

    function bukaDialogPembatalan(id) {
        const kasus = semuaKasus.find(
            item => String(item.id) === String(id)
        );

        if (!kasus) {
            tampilkanNotifikasi(
                "Kasus tidak ditemukan",
                "Data rekomendasi tidak tersedia.",
                "error"
            );

            return;
        }

        const sisa = hitungSisaWaktu(kasus);

        if (
            ambilStatus(kasus) !== "rekomendasi_dikirim" ||
            !sisa.aktif
        ) {
            tampilkanNotifikasi(
                "Pembatalan tidak diizinkan",
                sisa.teks,
                "error"
            );

            tampilkanRekomendasi();
            return;
        }

        kasusPembatalan = String(kasus.id);

        const dialog = buatDialogPembatalan();

        const textarea = dialog.querySelector(
            "#alasanBatalRekomendasi"
        );

        textarea.value = "";

        dialog.showModal();

        textarea.focus();
    }

    function tutupDialog() {
        const dialog = document.getElementById(
            "dialogBatalRekomendasi"
        );

        if (dialog?.open) {
            dialog.close();
        }

        kasusPembatalan = null;
    }

    function prosesPembatalan(event) {
        event.preventDefault();

        if (!kasusPembatalan) return;

        const dialog = document.getElementById(
            "dialogBatalRekomendasi"
        );

        const textarea = dialog.querySelector(
            "#alasanBatalRekomendasi"
        );

        const alasan = textarea.value.trim();

        if (!alasan) {
            textarea.setCustomValidity(
                "Alasan pembatalan wajib diisi."
            );

            textarea.reportValidity();
            return;
        }

        textarea.setCustomValidity("");

        const id = kasusPembatalan;

        try {
            layanan.batalkanRekomendasi(
                id,
                alasan
            );

            tutupDialog();

            tampilkanRekomendasi();

            tampilkanNotifikasi(
                "Rekomendasi dibatalkan",
                "Kasus kembali menunggu rekomendasi."
            );

        } catch (error) {
            console.error(
                "SILAB: Pembatalan gagal.",
                error
            );

            tampilkanNotifikasi(
                "Pembatalan gagal",
                error.message,
                "error"
            );
        }
    }

    // =====================================================
    // 16. NOTIFIKASI
    // =====================================================

    function tampilkanNotifikasi(
        judul,
        pesan,
        jenis = "sukses"
    ) {
        let wadah = document.getElementById(
            "wadahNotifikasi"
        );

        if (!wadah) {
            wadah = buatElemen(
                "div",
                "wadah-notifikasi"
            );

            wadah.id = "wadahNotifikasi";

            document.body.append(wadah);
        }

        const toast = buatElemen(
            "div",
            "notifikasi-toast"
        );

        toast.dataset.jenis = jenis;

        const ikon = document.createElement("i");

        ikon.className = jenis === "error"
            ? "bi bi-exclamation-circle-fill notifikasi-ikon"
            : "bi bi-check-circle-fill notifikasi-ikon";

        const konten = buatElemen(
            "div",
            "notifikasi-konten"
        );

        const judulElemen = buatElemen(
            "strong",
            "notifikasi-judul",
            judul
        );

        const pesanElemen = buatElemen(
            "p",
            "notifikasi-pesan",
            pesan
        );

        konten.append(
            judulElemen,
            pesanElemen
        );

        toast.append(
            ikon,
            konten
        );

        wadah.append(toast);

        window.setTimeout(() => {
            toast.classList.add("is-hilang");

            window.setTimeout(
                () => toast.remove(),
                250
            );
        }, 3200);
    }

    // =====================================================
    // 17. EVENT LISTENER
    // =====================================================

    // Pencarian.
    el.pencarian.addEventListener("input", () => {
        halamanAktif = 1;
        tampilkanRekomendasi();
    });

    // Filter kasus menunggu rekomendasi.
    el.filter.addEventListener("click", () => {
        hanyaMenunggu = !hanyaMenunggu;

        el.filter.setAttribute(
            "aria-pressed",
            String(hanyaMenunggu)
        );

        el.filter.innerHTML = hanyaMenunggu
            ? '<i class="bi bi-hourglass-split"></i> Menunggu Rekomendasi'
            : '<i class="bi bi-people-fill"></i> Semua Tergeser';

        halamanAktif = 1;

        tampilkanRekomendasi();
    });

    // Pagination.
    el.tombolPagination.addEventListener(
        "click",
        event => {
            const tombol = event.target.closest(
                "[data-halaman]"
            );

            if (!tombol || tombol.disabled) return;

            halamanAktif = Number(
                tombol.dataset.halaman
            );

            tampilkanRekomendasi();
        }
    );

    // Pembatalan rekomendasi.
    el.tabel.addEventListener("click", event => {
        const tombol = event.target.closest(
            '[data-aksi="batalkan"]'
        );

        if (!tombol) return;

        bukaDialogPembatalan(
            tombol.dataset.id
        );
    });

    // Form pembatalan.
    const dialog = buatDialogPembatalan();

    dialog.addEventListener(
        "submit",
        prosesPembatalan
    );

    dialog.addEventListener("click", event => {
        if (
            event.target === dialog ||
            event.target.closest("[data-tutup-dialog]")
        ) {
            tutupDialog();
        }
    });

    dialog.addEventListener("cancel", () => {
        kasusPembatalan = null;
    });

    // =====================================================
    // 18. SINKRONISASI DATA
    // =====================================================

    window.addEventListener(
        "silab:data-changed",
        tampilkanRekomendasi
    );

    // Memperbarui sisa waktu setiap menit.
    timerPembaruan = window.setInterval(
        tampilkanRekomendasi,
        60000
    );

    window.addEventListener(
        "pagehide",
        () => {
            window.clearInterval(timerPembaruan);
        },
        { once: true }
    );

    // =====================================================
    // 19. INISIALISASI
    // =====================================================

    tampilkanRekomendasi();

    console.log(
        "SILAB: Modul rekomendasi berhasil dimuat."
    );

})(window, document);
