
/**
 * MODUL ANTREAN SILAB
 * Mengelola tampilan, pengurutan, pagination,
 * detail pengajuan, dan tindakan verifikasi Laboran.
 */

(function (window, document) {
    "use strict";

    const layanan = window.SILABService;

    // Mengambil elemen yang digunakan modul.
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
    const STATUS_AKHIR = ["disetujui", "ditolak"];

    // Informasi kelas prioritas.
    const PRIORITAS = {
        P1: { label: "P1 TINGGI", kelas: "p1", urutan: 1 },
        P2: { label: "P2 SEDANG", kelas: "p2", urutan: 2 },
        P3: { label: "P3 RENDAH", kelas: "p3", urutan: 3 },
        P4: { label: "P4", kelas: "p4", urutan: 4 },
        P5: { label: "P5", kelas: "p5", urutan: 5 }
    };

    // Informasi status pengajuan.
    const STATUS = {
        bentrok: { label: "Bentrok", kelas: "conflict" },
        verifikasi: { label: "Verifikasi", kelas: "verify" },
        tergeser: { label: "Tergeser", kelas: "displaced" },
        disetujui: { label: "Disetujui", kelas: "approved" },
        ditolak: { label: "Ditolak", kelas: "rejected" }
    };

    let dataAntrean = [];
    let halamanAktif = 1;
    let idTerpilih = null;
    let timerModal = null;

    // Memastikan layanan dan elemen halaman tersedia.
    if (!layanan || Object.values(el).some(item => !item)) {
        console.error(
            "SILAB: Layanan atau elemen modul antrean belum tersedia."
        );
        return;
    }

    // Mengubah format waktu menjadi format tampilan.
    function formatJam(nilai) {
        return String(nilai || "--:--").replace(":", ".");
    }

    // Menggabungkan hari dan rentang waktu pengajuan.
    function formatWaktu(data) {
        if (!data.hari || !data.waktuMulai || !data.waktuSelesai) {
            return "Waktu belum ditentukan";
        }

        return `${data.hari}, ${formatJam(data.waktuMulai)}–${formatJam(data.waktuSelesai)}`;
    }

    // Menampilkan skor menggunakan format angka Indonesia.
    function formatSkor(nilai) {
        const angka = Number(nilai);

        if (
            nilai === null ||
            nilai === undefined ||
            nilai === "" ||
            !Number.isFinite(angka)
        ) {
            return "Belum tersedia";
        }

        return angka.toLocaleString("id-ID", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    }

    // Mengambil informasi kelas prioritas.
    function infoPrioritas(nilai) {
        const kode = String(nilai || "").toUpperCase();

        return PRIORITAS[kode] || {
            label: kode || "Belum diklasifikasi",
            kelas: "priority-other",
            urutan: 99
        };
    }

    // Mengambil informasi status pengajuan.
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

    // Mengurutkan berdasarkan prioritas, kemudian skor tertinggi.
    function ambilAntreanAktif() {
        return layanan.getAll("antrean")
            .filter(data =>
                !STATUS_AKHIR.includes(
                    String(data.status || "").toLowerCase()
                )
            )
            .sort((a, b) => {
                const bedaPrioritas =
                    infoPrioritas(a.prioritas).urutan -
                    infoPrioritas(b.prioritas).urutan;

                return bedaPrioritas ||
                    Number(b.skor || 0) - Number(a.skor || 0);
            });
    }

    // Mengisi teks tanpa memasukkan HTML dari data pengguna.
    function isiTeks(akar, pemilih, nilai) {
        const target = akar.querySelector(pemilih);

        if (target) {
            target.textContent =
                nilai === null || nilai === undefined || nilai === ""
                    ? "—"
                    : String(nilai);
        }
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

    // Membuat satu baris tabel dari template HTML.
    function buatBaris(data) {
        const baris = el.template.content
            .firstElementChild.cloneNode(true);

        const peserta = data.jumlahPeserta ?? "—";

        baris.dataset.id = data.id;

        isiTeks(
            baris,
            '[data-field="id"]',
            `#${data.id}`
        );

        isiTeks(
            baris,
            '[data-field="nama-kegiatan"]',
            data.namaKegiatan
        );

        isiTeks(
            baris,
            '[data-field="pemohon"]',
            `Pemohon: ${data.namaPemohon || "—"} • ${peserta} peserta`
        );

        isiTeks(
            baris,
            '[data-field="rentang-waktu"]',
            formatWaktu(data)
        );

        isiTeks(
            baris,
            '[data-field="kebutuhan"]',
            `PC: ${data.kebutuhanPC ?? "—"} • Kursi: ${data.kebutuhanKursi ?? "—"}`
        );

        isiTeks(
            baris,
            '[data-field="skor"]',
            `Skor: ${formatSkor(data.skor)}`
        );

        aturBadge(
            baris,
            '[data-field="prioritas"]',
            "priority-badge",
            infoPrioritas(data.prioritas)
        );

        aturBadge(
            baris,
            '[data-field="status"]',
            "status-badge",
            infoStatus(data.status)
        );

        baris.querySelector("[data-aksi-detail]").dataset.id = data.id;

        return baris;
    }

    // Membuat tombol nomor halaman.
    function tampilkanNomorHalaman(totalHalaman) {
        el.nomorHalaman.replaceChildren();

        for (let nomor = 1; nomor <= totalHalaman; nomor += 1) {
            const tombol = document.createElement("button");

            tombol.type = "button";
            tombol.className =
                `pagination-btn${nomor === halamanAktif ? " active" : ""}`;

            tombol.textContent = nomor;
            tombol.dataset.halaman = nomor;

            if (nomor === halamanAktif) {
                tombol.setAttribute("aria-current", "page");
            }

            el.nomorHalaman.append(tombol);
        }
    }

    // Memperbarui tabel dan pagination.
    function tampilkanAntrean() {
        try {
            dataAntrean = ambilAntreanAktif();

        } catch (error) {
            console.error("SILAB: Gagal mengambil data antrean.", error);

            dataAntrean = [];
            tampilkanPesanKosong("Data antrean gagal dimuat.");
        }

        const total = dataAntrean.length;

        const totalHalaman = Math.max(
            1,
            Math.ceil(total / PER_HALAMAN)
        );

        halamanAktif = Math.min(halamanAktif, totalHalaman);

        el.tabel.replaceChildren();

        if (!total) {
            tampilkanPesanKosong(
                "Belum ada pengajuan yang perlu diproses."
            );

        } else {
            const awal = (halamanAktif - 1) * PER_HALAMAN;

            const fragmen = document.createDocumentFragment();

            dataAntrean
                .slice(awal, awal + PER_HALAMAN)
                .forEach(data => fragmen.append(buatBaris(data)));

            el.tabel.append(fragmen);
        }

        el.total.textContent = `${total} Pengajuan`;

        el.infoHalaman.textContent = total
            ? `Menampilkan ${(halamanAktif - 1) * PER_HALAMAN + 1}–${Math.min(halamanAktif * PER_HALAMAN, total)} dari ${total} pengajuan`
            : "Belum ada pengajuan aktif";

        tampilkanNomorHalaman(total ? totalHalaman : 0);

        el.sebelumnya.disabled = halamanAktif <= 1 || !total;
        el.berikutnya.disabled =
            halamanAktif >= totalHalaman || !total;
    }

    // Menampilkan pesan ketika antrean kosong atau gagal dimuat.
    function tampilkanPesanKosong(pesan) {
        const baris = document.createElement("tr");
        const sel = document.createElement("td");

        sel.colSpan = 6;
        sel.className = "empty-state";
        sel.textContent = pesan;

        baris.append(sel);
        el.tabel.append(baris);
    }

    // Mengisi detail pengajuan pada modal.
    function isiModal(data) {
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

        aturBadge(
            el.modal,
            '[data-field="prioritas-detail"]',
            "priority-badge",
            infoPrioritas(data.prioritas)
        );

        aturBadge(
            el.modal,
            '[data-field="status-detail"]',
            "status-badge",
            infoStatus(data.status)
        );

        // Menampilkan panel sesuai status pengajuan.
        const status = String(data.status || "").toLowerCase();

        const panel = [
            "bentrok",
            "tergeser",
            "verifikasi"
        ].includes(status) ? status : "lainnya";

        el.modal.querySelectorAll("[data-panel]").forEach(item => {
            item.hidden = item.dataset.panel !== panel;
        });

        isiTeks(
            el.modal,
            '[data-field="pesan-bentrok"]',
            `Pengajuan #${data.id} terindikasi mengalami bentrok pada ${formatWaktu(data)}. Laboran dapat meneruskan kasus ini kepada Kepala Lab untuk ditinjau.`
        );

        isiTeks(
            el.modal,
            '[data-field="pesan-tergeser"]',
            `Pengajuan #${data.id} berstatus tergeser. Buka halaman rekomendasi untuk menyiapkan alternatif jadwal bagi pemohon.`
        );

        const tautan = el.modal.querySelector(
            "[data-tautan-rekomendasi]"
        );

        if (tautan) {
            tautan.href =
                `rekomendasi_jadwal.html?pengajuan=${encodeURIComponent(data.id)}`;
        }
    }

    // Membuka modal berdasarkan ID pengajuan.
    function bukaModal(id) {
        const data = layanan.getById("antrean", id);

        if (!data) {
            tampilkanNotifikasi(
                "Data tidak ditemukan",
                "Pengajuan sudah tidak tersedia.",
                "error"
            );

            tampilkanAntrean();
            return;
        }

        idTerpilih = String(data.id);

        isiModal(data);

        window.clearTimeout(timerModal);

        el.modal.hidden = false;
        el.modal.setAttribute("aria-hidden", "false");

        document.body.classList.add("modal-terbuka");

        window.requestAnimationFrame(() => {
            el.modal.classList.add("is-open");

            el.modal
                .querySelector(".review-modal-content")
                ?.focus();
        });
    }

    // Menutup modal setelah animasi selesai.
    function tutupModal() {
        el.modal.classList.remove("is-open");
        el.modal.setAttribute("aria-hidden", "true");

        document.body.classList.remove("modal-terbuka");

        window.clearTimeout(timerModal);

        timerModal = window.setTimeout(() => {
            el.modal.hidden = true;
            idTerpilih = null;
        }, 250);
    }

    // Menampilkan notifikasi hasil tindakan Laboran.
    function tampilkanNotifikasi(judul, pesan, jenis = "sukses") {
        if (!el.notifikasi) {
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

        konten.append(judulToast, pesanToast);
        toast.append(ikon, konten);

        el.notifikasi.append(toast);

        window.setTimeout(() => {
            toast.classList.add("is-hilang");

            window.setTimeout(() => toast.remove(), 250);
        }, 3200);
    }

    // Menyimpan keputusan verifikasi Laboran.
    function prosesVerifikasi(keputusan) {
        if (
            !idTerpilih ||
            !["disetujui", "ditolak"].includes(keputusan)
        ) {
            return;
        }

        const data = layanan.getById("antrean", idTerpilih);

        if (
            !data ||
            String(data.status).toLowerCase() !== "verifikasi"
        ) {
            tampilkanNotifikasi(
                "Pengajuan tidak dapat diproses",
                "Status pengajuan sudah berubah.",
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
            layanan.update("antrean", idTerpilih, {
                status: keputusan,
                waktuVerifikasi: new Date().toISOString()
            });

            tutupModal();

            tampilkanNotifikasi(
                keputusan === "disetujui"
                    ? "Pengajuan disetujui"
                    : "Pengajuan ditolak",
                `Status ${data.id} diperbarui dan dikeluarkan dari antrean aktif.`
            );

        } catch (error) {
            console.error("SILAB Antrean:", error);

            tampilkanNotifikasi(
                "Perubahan gagal disimpan",
                error.message ||
                    "Terjadi kesalahan saat memperbarui pengajuan.",
                "error"
            );
        }
    }

    // Menangani klik tombol detail pengajuan.
    el.tabel.addEventListener("click", event => {
        const tombol = event.target.closest("[data-aksi-detail]");

        if (tombol && el.tabel.contains(tombol)) {
            bukaModal(tombol.dataset.id);
        }
    });

    // Navigasi halaman sebelumnya.
    el.sebelumnya.addEventListener("click", () => {
        if (halamanAktif > 1) {
            halamanAktif -= 1;
            tampilkanAntrean();
        }
    });

    // Navigasi halaman berikutnya.
    el.berikutnya.addEventListener("click", () => {
        if (
            halamanAktif <
            Math.ceil(dataAntrean.length / PER_HALAMAN)
        ) {
            halamanAktif += 1;
            tampilkanAntrean();
        }
    });

    // Navigasi melalui nomor halaman.
    el.nomorHalaman.addEventListener("click", event => {
        const tombol = event.target.closest("[data-halaman]");

        if (tombol) {
            halamanAktif = Number(tombol.dataset.halaman);
            tampilkanAntrean();
        }
    });

    // Menangani tombol keputusan dan penutupan modal.
    el.modal.addEventListener("click", event => {
        if (event.target.closest("[data-tutup-modal]")) {
            tutupModal();
            return;
        }

        const tombol = event.target.closest("[data-keputusan]");

        if (tombol) {
            prosesVerifikasi(tombol.dataset.keputusan);
        }
    });

    // Menutup modal dengan tombol Escape.
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !el.modal.hidden) {
            tutupModal();
        }
    });

    // Memperbarui antrean jika data berubah.
    window.addEventListener(
        "silab:data-changed",
        tampilkanAntrean
    );

    // Menampilkan data antrean saat halaman dibuka.
    tampilkanAntrean();

    console.log("SILAB: Modul antrean berhasil dimuat.");

})(window, document);
