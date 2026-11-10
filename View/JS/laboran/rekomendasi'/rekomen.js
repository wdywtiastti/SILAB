
/**
 * MODUL REKOMENDASI JADWAL SILAB
 * Mengelola pengajuan tergeser, statistik, pencarian,
 * filter, dan pagination berdasarkan data antrean.
 */

(function (window, document) {
    "use strict";

    const layanan = window.SILABService;

    // Elemen halaman.
    const el = {
        tabel: document.getElementById("tabelBody"),
        template: document.getElementById("templateBarisTergeser"),
        pencarian: document.querySelector("[data-cari-kasus]"),
        filter: document.querySelector("[data-filter-kasus]"),
        infoPagination: document.querySelector("[data-info-pagination]"),
        pagination: document.querySelector("[data-pagination-buttons]")
    };

    // KONFIGURASI
    const PER_HALAMAN = 10;

    const STATUS_KASUS = [
        "tergeser",
        "rekomendasi_dikirim"
    ];

    const STATUS_REKOMENDASI_BELUM_SELESAI = [
        "draft",
        "belum_dikirim",
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

    // Membaca ID pengajuan dari halaman sebelumnya.
    const parameterURL = new URLSearchParams(
        window.location.search
    );

    const pengajuanTerpilih =
        parameterURL.get("pengajuan") ||
        parameterURL.get("kasusId");

    let sorotanSudahDilakukan = false;

    // Memastikan seluruh elemen tersedia.
    if (
        !layanan ||
        Object.values(el).some(elemen => !elemen)
    ) {
        console.error(
            "SILAB: Layanan atau elemen halaman rekomendasi belum tersedia."
        );

        return;
    }


    // NORMALISASI DATA
    function normalisasi(nilai) {
        return String(nilai || "").trim().toLowerCase();
    }


    // MENGAMBIL URUTAN PRIORITAS
    function urutanPrioritas(nilai) {
        const angka = Number(
            String(nilai || "").replace(/\D/g, "")
        );

        return Number.isFinite(angka) && angka > 0
            ? angka
            : 99;
    }


    // MENGAMBIL REKOMENDASI TERBARU BERDASARKAN ID PENGAJUAN
    function cariRekomendasi(pengajuanId) {
        const hasil = semuaRekomendasi.filter(data => {
            const idTerkait =
                data.pengajuanId ??
                data.idPengajuan ??
                data.antreanId ??
                data.kasusId;

            return String(idTerkait) === String(pengajuanId);
        });

        hasil.sort((a, b) => {
            const waktuA = Date.parse(a.dibuatPada) || 0;
            const waktuB = Date.parse(b.dibuatPada) || 0;

            return waktuB - waktuA;
        });

        return hasil[0] || null;
    }


    // MEMERIKSA STATUS REKOMENDASI
    function sudahDirekomendasikan(kasus) {
        const rekomendasi = cariRekomendasi(kasus.id);

        if (!rekomendasi) {
            return false;
        }

        const status = normalisasi(rekomendasi.status);

        return !STATUS_REKOMENDASI_BELUM_SELESAI.includes(status);
    }


    // MENGAMBIL DATA DARI ANTREAN
    function ambilData() {
        try {
            semuaKasus = layanan.getAll("antrean")
                .filter(data =>
                    STATUS_KASUS.includes(
                        normalisasi(data.status)
                    )
                )
                .sort((a, b) => {
                    const bedaPrioritas =
                        urutanPrioritas(a.prioritas) -
                        urutanPrioritas(b.prioritas);

                    return bedaPrioritas ||
                        Number(b.skor || 0) -
                        Number(a.skor || 0);
                });

            semuaRekomendasi = layanan.getAll("rekomendasi");

            perbaruiHalaman();

        } catch (error) {
            console.error(
                "SILAB Rekomendasi: Gagal mengambil data.",
                error
            );

            semuaKasus = [];
            semuaRekomendasi = [];

            perbaruiHalaman();
        }
    }


    // MEMPERBARUI STATISTIK
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

        const daftarKategori = [...kelompokKategori.entries()]
            .map(([nama, jumlah]) => `${nama} (${jumlah})`);

        aturStatistik("total", `${total} Pengguna`);

        aturStatistik(
            "sumber",
            "Berdasarkan data antrean berstatus tergeser"
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


    // MENGISI DATA STATISTIK
    function aturStatistik(nama, nilai) {
        const elemen = document.querySelector(
            `[data-stat="${nama}"]`
        );

        if (elemen) {
            elemen.textContent = nilai;
        }
    }


    // MEMFORMAT JAM
    function formatJam(nilai) {
        return String(nilai || "--:--").replace(":", ".");
    }


    // MEMFORMAT JADWAL ASAL
    function formatJadwal(kasus) {

        // Mendukung data jadwal dalam format ISO.
        if (kasus.jadwalAsal) {
            const tanggal = new Date(kasus.jadwalAsal);

            if (Number.isNaN(tanggal.getTime())) {
                return "Jadwal asal tidak valid.";
            }

            const tanggalFormat = new Intl.DateTimeFormat(
                "id-ID",
                {
                    weekday: "long",
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                    timeZone: "Asia/Jayapura"
                }
            ).format(tanggal);

            const jamFormat = new Intl.DateTimeFormat(
                "id-ID",
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                    timeZone: "Asia/Jayapura"
                }
            ).format(tanggal);

            return `${tanggalFormat} • ${jamFormat} WIT`;
        }

        // Menggunakan data jadwal dari antrean.
        const hari = kasus.hari || "Hari belum ditentukan";

        if (!kasus.waktuMulai || !kasus.waktuSelesai) {
            return `${hari} • Waktu belum ditentukan`;
        }

        return (
            `${hari}, ${formatJam(kasus.waktuMulai)}–` +
            `${formatJam(kasus.waktuSelesai)} WIT`
        );
    }


    // MEMBUAT BARIS TABEL
    function buatBaris(kasus) {
        const salinan = el.template.content.cloneNode(true);

        const baris = salinan.querySelector(".tabel-row");

        if (!baris) {
            console.error(
                "SILAB: Elemen .tabel-row tidak ditemukan pada template."
            );

            return salinan;
        }

        baris.dataset.pengajuanId = String(kasus.id);
        baris.dataset.kasusId = String(kasus.id);


        // MENGISI DATA BARIS
        function isi(field, nilai) {
            const elemen = salinan.querySelector(
                `[data-field="${field}"]`
            );

            if (elemen) {
                elemen.textContent =
                    nilai === null ||
                    nilai === undefined ||
                    nilai === ""
                        ? "—"
                        : String(nilai);
            }
        }

        isi("namaPemohon", kasus.namaPemohon);
        isi("nipNpm", kasus.nipNpm);

        isi(
            "jadwalAsal",
            formatJadwal(kasus)
        );

        isi("namaKegiatan", kasus.namaKegiatan);

        isi(
            "kebutuhanPC",
            `Kebutuhan: ${kasus.kebutuhanPC ?? 0} PC`
        );

        isi(
            "kebutuhanKursi",
            `Kebutuhan: ${kasus.kebutuhanKursi ?? 0} Kursi`
        );

        isi(
            "kategoriPrioritas",
            `${kasus.kategori || "-"} • ${kasus.prioritas || "-"}`
        );

        isi(
            "alasan",
            kasus.alasan ||
                "Tergeser oleh pengajuan dengan prioritas lebih tinggi."
        );

        isi(
            "namaPenggeser",
            kasus.namaPenggeser
                ? `Penggeser: ${kasus.namaPenggeser}`
                : "Penggeser: Belum tercatat"
        );


        // MENGATUR TOMBOL REKOMENDASI
        const tombol = salinan.querySelector(
            "[data-aksi-rekomendasi]"
        );

        const label = salinan.querySelector(
            "[data-label-aksi]"
        );

        const selesai = sudahDirekomendasikan(kasus);

        const parameter = new URLSearchParams({
            pengajuan: String(kasus.id),
            kasusId: String(kasus.id)
        });

        if (selesai) {
            parameter.set("mode", "lihat");

            if (label) {
                label.textContent = "Lihat Rekomendasi";
            }

            if (tombol) {
                tombol.classList.add("sudah-direkomendasikan");
            }

        } else {
            if (label) {
                label.textContent = "Beri Rekomendasi";
            }
        }

        if (tombol) {
            tombol.href =
                `buat_rekomendasi.html?${parameter.toString()}`;

            tombol.setAttribute(
                "aria-label",
                `${selesai ? "Lihat" : "Buat"} rekomendasi untuk ${kasus.namaPemohon || kasus.id}`
            );
        }

        return salinan;
    }


    // MEMERIKSA PENCARIAN
    function cocokPencarian(kasus) {
        const teks = [
            kasus.id,
            kasus.namaPemohon,
            kasus.nipNpm,
            kasus.namaKegiatan,
            kasus.kategori,
            kasus.prioritas,
            kasus.hari,
            kasus.waktuMulai,
            kasus.waktuSelesai,
            kasus.alasan,
            kasus.namaPenggeser
        ]
            .join(" ")
            .toLowerCase();

        return teks.includes(kataKunci);
    }


    // MENERAPKAN FILTER DATA
    function dapatkanDataTampil() {
        return semuaKasus.filter(kasus => {
            const selesai = sudahDirekomendasikan(kasus);

            const cocokFilter =
                filterAktif === "semua" || !selesai;

            return cocokFilter && cocokPencarian(kasus);
        });
    }


    // MEMBUAT TOMBOL PAGINATION
    function buatTombolHalaman(teks, halaman, opsi = {}) {
        const tombol = document.createElement("button");

        tombol.type = "button";
        tombol.className = "btn-page";
        tombol.textContent = teks;

        tombol.dataset.halaman = halaman;

        if (opsi.aktif) {
            tombol.classList.add("active");
            tombol.setAttribute("aria-current", "page");
        }

        if (opsi.nonaktif) {
            tombol.disabled = true;
        }

        return tombol;
    }


    // MENAMPILKAN PAGINATION
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

        if (awal > 1) {
            el.pagination.append(
                buatTombolHalaman("1", 1)
            );
        }

        if (awal > 2) {
            const titikAwal = document.createElement("span");

            titikAwal.className = "pagination-dots";
            titikAwal.textContent = "...";

            el.pagination.append(titikAwal);
        }

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

        if (akhir < totalHalaman - 1) {
            const titikAkhir = document.createElement("span");

            titikAkhir.className = "pagination-dots";
            titikAkhir.textContent = "...";

            el.pagination.append(titikAkhir);
        }

        if (akhir < totalHalaman) {
            el.pagination.append(
                buatTombolHalaman(
                    String(totalHalaman),
                    totalHalaman
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


    // MEMPERBARUI INFORMASI PAGINATION
    function perbaruiInfoPagination(total, awal, akhir) {
        el.infoPagination.textContent = total
            ? `Menampilkan ${awal}–${akhir} dari ${total} kasus`
            : "Menampilkan 0 dari 0 kasus";
    }


    // MENAMPILKAN DATA TABEL
    function tampilkanTabel(data) {
        el.tabel.replaceChildren();

        if (!data.length) {
            const kosong = document.createElement("div");

            kosong.className = "tabel-row tabel-empty";

            kosong.textContent = kataKunci
                ? "Tidak ada pengajuan yang sesuai dengan pencarian."
                : "Belum ada pengajuan tergeser yang perlu ditindaklanjuti.";

            el.tabel.append(kosong);

            return;
        }

        data.forEach(kasus => {
            el.tabel.append(buatBaris(kasus));
        });
    }


    // MENYOROT PENGAJUAN YANG DIPILIH
    function sorotPengajuanTerpilih() {
        if (
            !pengajuanTerpilih ||
            sorotanSudahDilakukan
        ) {
            return;
        }

        const baris = [
            ...el.tabel.querySelectorAll("[data-pengajuan-id]")
        ].find(item =>
            item.dataset.pengajuanId === pengajuanTerpilih
        );

        if (!baris) {
            return;
        }

        sorotanSudahDilakukan = true;

        baris.classList.add("is-terpilih");

        baris.setAttribute("aria-current", "true");

        window.requestAnimationFrame(() => {
            baris.scrollIntoView({
                behavior: "smooth",
                block: "center"
            });
        });
    }


    // MEMPERBARUI SELURUH HALAMAN
    function perbaruiHalaman() {
        perbaruiStatistik();

        const dataTampil = dapatkanDataTampil();

        const totalData = dataTampil.length;

        const totalHalaman = Math.max(
            1,
            Math.ceil(totalData / PER_HALAMAN)
        );


        // Membuka halaman yang memuat pengajuan pilihan.
        if (
            pengajuanTerpilih &&
            !sorotanSudahDilakukan
        ) {
            const indexTerpilih = dataTampil.findIndex(
                kasus =>
                    String(kasus.id) === pengajuanTerpilih
            );

            if (indexTerpilih !== -1) {
                halamanAktif =
                    Math.floor(indexTerpilih / PER_HALAMAN) + 1;
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

        sorotPengajuanTerpilih();
    }


    // MENANGANI PENCARIAN
    el.pencarian.addEventListener("input", function () {
        kataKunci = this.value.trim().toLowerCase();

        halamanAktif = 1;

        perbaruiHalaman();
    });


    // MENANGANI FILTER
    el.filter.addEventListener("click", function () {
        filterAktif = filterAktif === "semua"
            ? "menunggu"
            : "semua";

        halamanAktif = 1;

        const sedangMenunggu = filterAktif === "menunggu";

        this.setAttribute(
            "aria-pressed",
            String(sedangMenunggu)
        );

        this.innerHTML = sedangMenunggu
            ? '<i class="bi bi-hourglass-split"></i> Menunggu Rekomendasi'
            : '<i class="bi bi-people-fill"></i> Semua Tergeser';

        perbaruiHalaman();
    });


    // MENANGANI PERPINDAHAN HALAMAN
    el.pagination.addEventListener("click", function (event) {
        const tombol = event.target.closest("[data-halaman]");

        if (!tombol || tombol.disabled) {
            return;
        }

        const halaman = Number(tombol.dataset.halaman);

        if (!Number.isInteger(halaman) || halaman < 1) {
            return;
        }

        halamanAktif = halaman;

        perbaruiHalaman();
    });


    // MEMPERBARUI DATA KETIKA ADA PERUBAHAN
    window.addEventListener(
        "silab:data-changed",
        ambilData
    );


    // MENJALANKAN MODUL
    ambilData();

    console.log(
        "SILAB: Modul rekomendasi berhasil dimuat."
    );

})(window, document);
