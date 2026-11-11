
/**
 * MODUL REKOMENDASI JADWAL SILAB
 * Mengelola daftar pengguna yang jadwalnya tergeser.
 */

(function (window, document) {
    "use strict";

    // ==========================================
    // 1. DEPENDENSI DAN ELEMEN
    // ==========================================

    const layanan = window.SILABService;

    const el = {
        tabel: document.getElementById("tabelBody"),
        template: document.getElementById("templateBarisTergeser"),

        pencarian: document.querySelector("[data-cari-kasus]"),
        filter: document.querySelector("[data-filter-kasus]"),

        infoPagination: document.querySelector("[data-info-pagination]"),
        pagination: document.querySelector("[data-pagination-buttons]")
    };

    const PER_HALAMAN = 10;

    const STATUS_MENUNGGU = "menunggu_rekomendasi";

    const STATUS_NONAKTIF = [
        "dibatalkan",
        "ditolak",
        "kedaluwarsa",
        "expired",
        "rejected",
        "cancelled"
    ];

    let semuaKasus = [];
    let semuaRekomendasi = [];

    let halamanAktif = 1;
    let filterAktif = "semua";
    let kataKunci = "";

    // Mengambil ID kasus dari URL jika tersedia.
    const parameterURL = new URLSearchParams(
        window.location.search
    );

    const kasusTerpilih =
        parameterURL.get("kasusId") ||
        parameterURL.get("pengajuan");

    // Memastikan seluruh elemen tersedia.
    if (
        !layanan ||
        Object.values(el).some(elemen => !elemen)
    ) {
        console.error(
            "SILAB: Elemen modul rekomendasi belum lengkap."
        );

        return;
    }


    // ==========================================
    // 2. UTILITAS DATA
    // ==========================================

    // Menyeragamkan teks.
    function normalisasi(nilai) {
        return String(nilai ?? "")
            .trim()
            .toLowerCase();
    }

    // Mengambil nomor prioritas.
    function urutanPrioritas(prioritas) {
        const angka = Number(
            String(prioritas || "").replace(/\D/g, "")
        );

        return angka || 99;
    }

    // Mencari rekomendasi berdasarkan ID kasus.
    function cariRekomendasi(idKasus) {
        return semuaRekomendasi.find(item => {
            return String(item.kasusId) === String(idKasus);
        }) || null;
    }

    // Memeriksa apakah rekomendasi sudah dikirim.
    function sudahDirekomendasikan(kasus) {
        const rekomendasi = cariRekomendasi(kasus.id);

        if (rekomendasi) {
            return !STATUS_NONAKTIF.includes(
                normalisasi(rekomendasi.status)
            );
        }

        return [
            "rekomendasi_dikirim",
            "direkomendasikan",
            "sudah_direkomendasikan",
            "selesai"
        ].includes(normalisasi(kasus.status));
    }


    // ==========================================
    // 3. PENGAMBILAN DATA
    // ==========================================

    function ambilData() {
        try {
            semuaKasus = layanan.getAll("penggunaTergeser");

            semuaRekomendasi = layanan.getAll("rekomendasi");

            // Mengurutkan berdasarkan prioritas.
            semuaKasus.sort((a, b) => {
                return (
                    urutanPrioritas(a.prioritas) -
                    urutanPrioritas(b.prioritas)
                );
            });

            perbaruiHalaman();

        } catch (error) {
            console.error(
                "SILAB: Gagal mengambil data rekomendasi.",
                error
            );
        }
    }


    // ==========================================
    // 4. STATISTIK
    // ==========================================

    function aturStatistik(nama, nilai) {
        const target = document.querySelector(
            `[data-stat="${nama}"]`
        );

        if (target) {
            target.textContent = nilai;
        }
    }

    function perbaruiStatistik() {
        const total = semuaKasus.length;

        const selesai = semuaKasus.filter(
            sudahDirekomendasikan
        ).length;

        const pending = total - selesai;

        const kelompokKategori = new Map();

        semuaKasus.forEach(kasus => {
            const kategori = kasus.kategori || "-";
            const prioritas = kasus.prioritas || "-";

            const kunci = `${kategori} • ${prioritas}`;

            kelompokKategori.set(
                kunci,
                (kelompokKategori.get(kunci) || 0) + 1
            );
        });

        const daftarKategori = [
            ...kelompokKategori.entries()
        ].map(([nama, jumlah]) => {
            return `${nama} (${jumlah})`;
        });

        aturStatistik("total", `${total} Pengguna`);

        aturStatistik(
            "sumber",
            "Berdasarkan data pengguna tergeser"
        );

        aturStatistik(
            "kategori",
            daftarKategori.length
                ? daftarKategori.join(", ")
                : "Belum ada data"
        );

        aturStatistik(
            "kategori-detail",
            `${kelompokKategori.size} kelompok kategori dan prioritas`
        );

        aturStatistik(
            "pending",
            `${pending} Perlu Solusi Slot`
        );

        aturStatistik(
            "selesai",
            `${selesai} Selesai Direkomendasikan`
        );
    }


    // ==========================================
    // 5. FORMAT JADWAL
    // ==========================================

    function formatJadwal(kasus) {
        if (!kasus.jadwalAsal) {
            return "Jadwal asal tidak tersedia.";
        }

        const tanggal = new Date(kasus.jadwalAsal);

        if (Number.isNaN(tanggal.getTime())) {
            return "Format jadwal tidak valid.";
        }

        const formatTanggal = new Intl.DateTimeFormat(
            "id-ID",
            {
                weekday: "long",
                day: "2-digit",
                month: "short",
                year: "numeric",
                timeZone: "Asia/Jayapura"
            }
        ).format(tanggal);

        const formatJam = new Intl.DateTimeFormat(
            "id-ID",
            {
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
                timeZone: "Asia/Jayapura"
            }
        ).format(tanggal);

        return `${formatTanggal} • ${formatJam} WIT`;
    }


    // ==========================================
    // 6. MEMBUAT BARIS TABEL
    // ==========================================

    function buatBaris(kasus) {
        const salinan = el.template.content.cloneNode(true);

        const baris = salinan.querySelector(".tabel-row");

        if (!baris) return null;

        baris.dataset.kasusId = kasus.id;

        // Mengisi data berdasarkan atribut data-field.
        function isi(field, nilai) {
            const target = salinan.querySelector(
                `[data-field="${field}"]`
            );

            if (target) {
                target.textContent =
                    nilai === null ||
                    nilai === undefined ||
                    nilai === ""
                        ? "-"
                        : String(nilai);
            }
        }

        isi("namaPemohon", kasus.namaPemohon);

        isi("nipNpm", kasus.nipNpm);

        isi("jadwalAsal", formatJadwal(kasus));

        isi("namaKegiatan", kasus.namaKegiatan);

        isi(
            "kebutuhanPC",
            `Kebutuhan: ${Number(kasus.kebutuhanPC) || 0} PC`
        );

        isi(
            "kebutuhanKursi",
            `Kebutuhan: ${Number(kasus.kebutuhanKursi) || 0} Kursi`
        );

        isi(
            "kategoriPrioritas",
            `${kasus.kategori || "-"} • ${kasus.prioritas || "-"}`
        );

        isi(
            "alasan",
            kasus.alasan || "Alasan pergeseran tidak tersedia."
        );

        isi(
            "namaPenggeser",
            kasus.namaPenggeser
                ? `Penggeser: ${kasus.namaPenggeser}`
                : "Penggeser belum tercatat"
        );

        // Mengatur tombol rekomendasi.
        const tombol = salinan.querySelector(
            "[data-aksi-rekomendasi]"
        );

        const label = salinan.querySelector(
            "[data-label-aksi]"
        );

        const selesai = sudahDirekomendasikan(kasus);

        const parameter = new URLSearchParams({
            kasusId: String(kasus.id)
        });

        if (selesai) {
            parameter.set("mode", "lihat");

            label.textContent = "Lihat Rekomendasi";

            tombol.classList.add(
                "sudah-direkomendasikan"
            );

        } else {
            label.textContent = "Beri Rekomendasi";
        }

        tombol.href =
            `buat_rekomendasi.html?${parameter.toString()}`;

        tombol.setAttribute(
            "aria-label",
            `${selesai ? "Lihat" : "Buat"} rekomendasi untuk ${kasus.namaPemohon}`
        );

        return salinan;
    }


    // ==========================================
    // 7. PENCARIAN
    // ==========================================

    function cocokPencarian(kasus) {
        const teks = [
            kasus.id,
            kasus.namaPemohon,
            kasus.nipNpm,
            kasus.namaKegiatan,
            kasus.kategori,
            kasus.prioritas,
            kasus.alasan,
            kasus.namaPenggeser
        ].join(" ").toLowerCase();

        return teks.includes(kataKunci);
    }


    // ==========================================
    // 8. FILTER DATA
    // ==========================================

    function dapatkanDataTampil() {
        return semuaKasus.filter(kasus => {

            const selesai = sudahDirekomendasikan(kasus);

            const cocokFilter =
                filterAktif === "semua" || !selesai;

            return cocokFilter && cocokPencarian(kasus);
        });
    }


    // ==========================================
    // 9. PAGINATION
    // ==========================================

    function buatTombolHalaman(teks, halaman, opsi = {}) {
        const tombol = document.createElement("button");

        tombol.type = "button";
        tombol.className = "btn-page";
        tombol.textContent = teks;

        tombol.dataset.halaman = halaman;

        if (opsi.aktif) {
            tombol.classList.add("active");

            tombol.setAttribute(
                "aria-current",
                "page"
            );
        }

        tombol.disabled = Boolean(opsi.nonaktif);

        return tombol;
    }

    function tampilkanPagination(totalHalaman) {
        el.pagination.replaceChildren();

        const sebelumnya = buatTombolHalaman(
            "Sebelumnya",
            halamanAktif - 1,
            {
                nonaktif: halamanAktif === 1
            }
        );

        el.pagination.append(sebelumnya);

        const awal = Math.max(1, halamanAktif - 2);

        const akhir = Math.min(
            totalHalaman,
            halamanAktif + 2
        );

        for (
            let halaman = awal;
            halaman <= akhir;
            halaman++
        ) {
            el.pagination.append(
                buatTombolHalaman(
                    String(halaman),
                    halaman,
                    {
                        aktif: halaman === halamanAktif
                    }
                )
            );
        }

        const berikutnya = buatTombolHalaman(
            "Berikutnya",
            halamanAktif + 1,
            {
                nonaktif: halamanAktif === totalHalaman
            }
        );

        el.pagination.append(berikutnya);
    }


    // ==========================================
    // 10. MENAMPILKAN TABEL
    // ==========================================

    function tampilkanTabel(data) {
        el.tabel.replaceChildren();

        if (!data.length) {
            const kosong = document.createElement("div");

            kosong.className = "tabel-row tabel-empty";

            kosong.textContent = kataKunci
                ? "Data tidak ditemukan."
                : "Belum ada pengguna yang memerlukan rekomendasi jadwal.";

            el.tabel.append(kosong);

            return;
        }

        data.forEach(kasus => {
            const baris = buatBaris(kasus);

            if (baris) {
                el.tabel.append(baris);
            }
        });
    }


    // ==========================================
    // 11. INFORMASI PAGINATION
    // ==========================================

    function perbaruiInfoPagination(total, awal, akhir) {
        el.infoPagination.textContent = total
            ? `Menampilkan ${awal}–${akhir} dari ${total} kasus`
            : "Menampilkan 0 dari 0 kasus";
    }


    // ==========================================
    // 12. SOROT KASUS TERPILIH
    // ==========================================

    function sorotKasusTerpilih() {
        if (!kasusTerpilih) return;

        const baris = [
            ...el.tabel.querySelectorAll("[data-kasus-id]")
        ].find(item => {
            return item.dataset.kasusId === kasusTerpilih;
        });

        if (!baris) return;

        baris.classList.add("is-terpilih");

        baris.setAttribute("aria-current", "true");
    }


    // ==========================================
    // 13. MEMPERBARUI SELURUH HALAMAN
    // ==========================================

    function perbaruiHalaman() {
        perbaruiStatistik();

        const dataTampil = dapatkanDataTampil();

        const totalData = dataTampil.length;

        const totalHalaman = Math.max(
            1,
            Math.ceil(totalData / PER_HALAMAN)
        );

        // Mencari halaman yang memuat kasus terpilih.
        if (kasusTerpilih) {
            const index = dataTampil.findIndex(
                kasus => String(kasus.id) === kasusTerpilih
            );

            if (index !== -1) {
                halamanAktif = Math.floor(
                    index / PER_HALAMAN
                ) + 1;
            }
        }

        halamanAktif = Math.min(
            halamanAktif,
            totalHalaman
        );

        const awalIndex =
            (halamanAktif - 1) * PER_HALAMAN;

        const dataHalaman = dataTampil.slice(
            awalIndex,
            awalIndex + PER_HALAMAN
        );

        const nomorAwal = totalData
            ? awalIndex + 1
            : 0;

        const nomorAkhir = Math.min(
            awalIndex + PER_HALAMAN,
            totalData
        );

        tampilkanTabel(dataHalaman);

        perbaruiInfoPagination(
            totalData,
            nomorAwal,
            nomorAkhir
        );

        tampilkanPagination(totalHalaman);

        sorotKasusTerpilih();
    }


    // ==========================================
    // 14. EVENT PENCARIAN
    // ==========================================

    el.pencarian.addEventListener("input", function () {
        kataKunci = normalisasi(this.value);

        halamanAktif = 1;

        perbaruiHalaman();
    });


    // ==========================================
    // 15. EVENT FILTER
    // ==========================================

    el.filter.addEventListener("click", function () {
        filterAktif = filterAktif === "semua"
            ? "menunggu"
            : "semua";

        const hanyaMenunggu = filterAktif === "menunggu";

        this.setAttribute(
            "aria-pressed",
            String(hanyaMenunggu)
        );

        this.innerHTML = hanyaMenunggu
            ? '<i class="bi bi-hourglass-split"></i> Menunggu Rekomendasi'
            : '<i class="bi bi-people-fill"></i> Semua Tergeser';

        halamanAktif = 1;

        perbaruiHalaman();
    });


    // ==========================================
    // 16. EVENT PAGINATION
    // ==========================================

    el.pagination.addEventListener("click", function (event) {
        const tombol = event.target.closest("[data-halaman]");

        if (!tombol || tombol.disabled) return;

        const halaman = Number(tombol.dataset.halaman);

        if (
            !Number.isInteger(halaman) ||
            halaman < 1
        ) {
            return;
        }

        halamanAktif = halaman;

        perbaruiHalaman();
    });


    // ==========================================
    // 17. SINKRONISASI DATA
    // ==========================================

    window.addEventListener(
        "silab:data-changed",
        ambilData
    );


    // ==========================================
    // 18. INISIALISASI
    // ==========================================

    ambilData();

    console.log(
        "SILAB: Modul rekomendasi berhasil dijalankan."
    );

})(window, document);
