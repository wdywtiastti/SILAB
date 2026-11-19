(function (window, document) {
    "use strict";

    // ==========================================
    // 1. KONFIGURASI API
    // ==========================================

    const API_ANTREAN = "api/antrean.php";
    const API_TINDAKAN = "api/tindakan_antrean.php";

    const DATA_HALAMAN = 6;
    const INTERVAL_REFRESH = 30000;
    const BATAS_PRESENSI_MENIT = 15;
    const ZONA_WIT = "+09:00";

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
        filter: document.querySelectorAll("[data-filter-antrean]"),
        notifikasi: document.getElementById("wadahNotifikasi")
    };

    if (!el.tabel || !el.template || !el.modal) {
        console.error("SILAB: Elemen HTML antrean tidak lengkap.");
        return;
    }

    // ==========================================
    // 2. KONFIGURASI STATUS
    // ==========================================

    const STATUS = {
        verifikasi: {
            label: "Menunggu Verifikasi",
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
        "menunggu",
        "verifikasi",
        "menunggu_verifikasi",
        "bentrok",
        "konflik",
        "tergeser"
    ];

    const STATUS_PRESENSI_TERCATAT = [
        "hadir",
        "presensi",
        "sudah_presensi",
        "tercatat",
        "digunakan",
        "sedang_berjalan",
        "berlangsung",
        "selesai",
        "checked_in",
        "check_in"
    ];

    let daftarAntrean = [];
    let halamanAktif = 1;
    let filterAktif = "belum-disetujui";
    let fokusSebelumnya = null;
    let intervalRefresh = null;
    let sedangMemuat = false;

    // ==========================================
    // 3. FUNGSI BANTUAN
    // ==========================================

    function isiElemen(elemen, nilai) {
        if (!elemen) return;

        elemen.textContent =
            nilai === null ||
            nilai === undefined ||
            nilai === ""
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
            .trim()
            .replace(/\s+/g, "_");

        const alias = {
            menunggu: "verifikasi",
            menunggu_verifikasi: "verifikasi",
            pending: "verifikasi",
            konflik: "bentrok",
            conflict: "bentrok",
            approved: "disetujui",
            rejected: "ditolak",
            "sudah_disetujui": "disetujui"
        };

        return alias[nilai] || nilai;
    }

    function ambilStatusPengajuan(item) {
        return normalisasiStatus(
            item.statusPengajuan ||
            item.status ||
            "menunggu"
        );
    }

    function angka(nilai) {
        if (
            nilai === null ||
            nilai === undefined ||
            nilai === ""
        ) {
            return null;
        }

        const hasil = Number(nilai);

        return Number.isFinite(hasil) ? hasil : null;
    }

    function formatAngka(nilai) {
        const hasil = angka(nilai);

        return hasil === null ? "-" : String(hasil);
    }

    function ambilPrioritas(item) {
        const nilai = String(
            item.prioritas || ""
        ).toUpperCase();

        const cocok = nilai.match(/P([1-5])/);

        return cocok ? Number(cocok[1]) : 99;
    }

    function ambilSkor(item) {
        return angka(item.skor) ?? 0;
    }

    function formatWaktu(item) {
        const tanggal = item.tanggal
            ? `${formatTanggal(item.tanggal)} | `
            : "";

        return `${tanggal}${item.waktuMulai || "-"} - ${
            item.waktuSelesai || "-"
        } WIT`;
    }

    function formatTanggal(tanggal) {
        if (!tanggal) return "-";

        const bagian = String(tanggal).split("T")[0];
        const cocok = bagian.match(/^(\d{4})-(\d{2})-(\d{2})$/);

        if (!cocok) return bagian;

        return `${cocok[3]}-${cocok[2]}-${cocok[1]}`;
    }

    function ambilTanggal(item) {
        return String(item.tanggal || "").split("T")[0];
    }

    function ambilTimestampMulai(item) {
        const tanggal = ambilTanggal(item);
        const waktu = String(item.waktuMulai || "");

        if (!tanggal || !waktu) return null;

        const timestamp = Date.parse(
            `${tanggal}T${waktu.slice(0, 8).length === 5
                ? waktu + ":00"
                : waktu}${ZONA_WIT}`
        );

        return Number.isFinite(timestamp) ? timestamp : null;
    }

    function sudahPresensi(item) {
        const status = String(
            item.statusPresensi || ""
        ).toLowerCase().trim();

        return STATUS_PRESENSI_TERCATAT.includes(status);
    }

    function batasPresensiHabis(item) {
        const mulai = ambilTimestampMulai(item);

        if (mulai === null) return false;

        const batas = mulai +
            BATAS_PRESENSI_MENIT * 60 * 1000;

        return Date.now() >= batas;
    }

    function masihMenungguPresensi(item) {
        if (sudahPresensi(item)) return false;

        if (batasPresensiHabis(item)) return false;

        return true;
    }

    function escapeHTML(nilai) {
        return String(nilai ?? "").replace(
            /[&<>"']/g,
            karakter => ({
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#039;"
            })[karakter]
        );
    }

    // ==========================================
    // 4. KOMUNIKASI API
    // ==========================================

    async function requestAPI(url, opsi = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            cache: "no-store",
            ...opsi
        });

        const teks = await response.text();

        let hasil;

        try {
            hasil = JSON.parse(teks);
        } catch {
            throw new Error(
                "Respons server bukan JSON. Periksa session, URL API, atau error PHP."
            );
        }

        if (!response.ok || hasil.success === false) {
            throw new Error(
                hasil.message ||
                `Permintaan gagal. HTTP ${response.status}`
            );
        }

        return hasil;
    }

    async function ambilDataAntrean() {
        const hasil = await requestAPI(API_ANTREAN, {
            method: "GET"
        });

        if (!Array.isArray(hasil.data)) {
            throw new Error(
                "Format data antrean dari API tidak valid."
            );
        }

        return hasil.data;
    }

    async function kirimTindakan(aksi, idPengajuan, alasan = "") {
        const hasil = await requestAPI(API_TINDAKAN, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify({
                aksi: aksi,
                idPengajuan: Number(idPengajuan),
                alasan: alasan
            })
        });

        return hasil;
    }

    // ==========================================
    // 5. PENGELOLAAN ANTREAN
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

    function ambilDataFilter() {
        return daftarAntrean.filter(item => {
            const status = ambilStatusPengajuan(item);

            if (filterAktif === "belum-disetujui") {
                return STATUS_BELUM_DISETUJUI.includes(status) ||
                    status === "verifikasi";
            }

            if (filterAktif === "sudah-disetujui") {
                return (
                    status === "disetujui" &&
                    masihMenungguPresensi(item)
                );
            }

            return false;
        });
    }

    function perbaruiJumlahKategori() {
        const belum = daftarAntrean.filter(item =>
            STATUS_BELUM_DISETUJUI.includes(
                ambilStatusPengajuan(item)
            )
        ).length;

        const sudah = daftarAntrean.filter(item =>
            ambilStatusPengajuan(item) === "disetujui" &&
            masihMenungguPresensi(item)
        ).length;

        isiElemen(el.jumlahBelum, belum);
        isiElemen(el.jumlahSudah, sudah);
    }

    function pilihFilter(kategori) {
        if (![
            "belum-disetujui",
            "sudah-disetujui"
        ].includes(kategori)) {
            return;
        }

        filterAktif = kategori;
        halamanAktif = 1;

        el.filter.forEach(tombol => {
            const aktif =
                tombol.dataset.filterAntrean === kategori;

            tombol.classList.toggle("active", aktif);
            tombol.setAttribute("aria-pressed", String(aktif));
        });

        tampilkanAntrean();
    }

    el.filter.forEach(tombol => {
        tombol.addEventListener("click", () => {
            pilihFilter(tombol.dataset.filterAntrean);
        });
    });

    // ==========================================
    // 6. MEMBUAT BARIS TABEL
    // ==========================================

    function buatBaris(item) {
        const baris =
            el.template.content.firstElementChild.cloneNode(true);

        const status = ambilStatusPengajuan(item);
        const konfigurasi = STATUS[status];

        const namaPemohon =
            item.namaPemohon ||
            item.nama ||
            "-";

        const kebutuhanPC = item.kebutuhanPC;
        const kebutuhanKursi = item.kebutuhanKursi;

        isiField(baris, "id", `#${item.idPengajuan || item.id}`);

        isiField(
            baris,
            "nama-kegiatan",
            item.namaKegiatan || "-"
        );

        isiField(baris, "pemohon", namaPemohon);

        isiField(
            baris,
            "rentang-waktu",
            formatWaktu(item)
        );

        isiField(
            baris,
            "kebutuhan",
            `PC: ${formatAngka(kebutuhanPC)} | Kursi: ${formatAngka(kebutuhanKursi)}`
        );

        const badgePrioritas = baris.querySelector(
            '[data-field="prioritas"]'
        );

        if (badgePrioritas) {
            badgePrioritas.textContent =
                item.prioritas || "Belum dihitung";
        }

        isiField(
            baris,
            "skor",
            item.skor === null || item.skor === undefined
                ? "Skor belum dihitung"
                : `Skor: ${item.skor}`
        );

        const badgeStatus = baris.querySelector(
            '[data-field="status"]'
        );

        if (badgeStatus) {
            badgeStatus.className = "status-badge";

            if (konfigurasi) {
                badgeStatus.classList.add(konfigurasi.kelas);
                badgeStatus.textContent = konfigurasi.label;
            } else {
                badgeStatus.textContent = status;
            }
        }

        const tombol = baris.querySelector("[data-aksi-detail]");

        if (tombol) {
            tombol.dataset.id = item.idPengajuan || item.id;

            tombol.innerHTML =
                status === "disetujui"
                    ? '<i class="bi bi-eye"></i> Lihat Detail'
                    : '<i class="bi bi-search"></i> Periksa &amp; Proses';
        }

        return baris;
    }

    // ==========================================
    // 7. MENAMPILKAN TABEL
    // ==========================================

    function tampilkanAntrean() {
        const dataFilter = ambilDataFilter();

        const jumlahHalaman = Math.max(
            1,
            Math.ceil(dataFilter.length / DATA_HALAMAN)
        );

        halamanAktif = Math.min(halamanAktif, jumlahHalaman);

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

            kolom.className = "empty-message";

            kolom.textContent =
                filterAktif === "belum-disetujui"
                    ? "Belum ada pengajuan yang menunggu persetujuan."
                    : "Belum ada booking yang menunggu presensi.";

            baris.append(kolom);
            fragment.append(baris);
        } else {
            dataHalaman.forEach(item => {
                fragment.append(buatBaris(item));
            });
        }

        el.tabel.replaceChildren(fragment);

        perbaruiPagination();
    }

    // ==========================================
    // 8. PAGINATION
    // ==========================================

    function perbaruiPagination() {
        const total = ambilDataFilter().length;

        const jumlahHalaman = Math.ceil(
            total / DATA_HALAMAN
        );

        const awal = total === 0
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

        el.sebelumnya.disabled = halamanAktif <= 1;

        el.berikutnya.disabled =
            jumlahHalaman === 0 ||
            halamanAktif >= jumlahHalaman;

        el.nomorHalaman.replaceChildren();

        for (let i = 1; i <= jumlahHalaman; i++) {
            const tombol = document.createElement("button");

            tombol.type = "button";
            tombol.className = "pagination-btn";
            tombol.textContent = i;

            if (i === halamanAktif) {
                tombol.classList.add("active");
                tombol.setAttribute("aria-current", "page");
            }

            tombol.addEventListener("click", () => {
                halamanAktif = i;
                tampilkanAntrean();
            });

            el.nomorHalaman.append(tombol);
        }
    }

    el.sebelumnya.addEventListener("click", () => {
        if (halamanAktif > 1) {
            halamanAktif--;
            tampilkanAntrean();
        }
    });

    el.berikutnya.addEventListener("click", () => {
        const jumlahHalaman = Math.ceil(
            ambilDataFilter().length / DATA_HALAMAN
        );

        if (halamanAktif < jumlahHalaman) {
            halamanAktif++;
            tampilkanAntrean();
        }
    });

    // ==========================================
    // 9. NOTIFIKASI
    // ==========================================

    function tampilkanNotifikasi(pesan, jenis = "success") {
        if (!el.notifikasi) {
            window.alert(pesan);
            return;
        }

        const notifikasi = document.createElement("div");

        notifikasi.className = `notifikasi-antrean ${jenis}`;
        notifikasi.setAttribute("role", "status");
        notifikasi.textContent = pesan;

        el.notifikasi.replaceChildren(notifikasi);

        window.setTimeout(() => {
            notifikasi.remove();
        }, 3500);
    }

    function tampilkanPesan(modal, pesan, jenis = "error") {
        let feedback = modal.querySelector(".aksi-feedback");

        if (!feedback) {
            feedback = document.createElement("div");
            feedback.className = "aksi-feedback";

            const konten = modal.querySelector(".review-modal-content");

            if (konten) {
                konten.append(feedback);
            } else {
                modal.append(feedback);
            }
        }

        feedback.className = `aksi-feedback ${jenis}`;
        feedback.setAttribute("role", "alert");
        feedback.textContent = pesan;
    }

    // ==========================================
    // 10. PANEL MODAL
    // ==========================================

    function tampilkanPanel(namaPanel) {
        el.modal.querySelectorAll("[data-panel]").forEach(panel => {
            panel.hidden = panel.dataset.panel !== namaPanel;
        });
    }

    function ambilPengajuan(id) {
        return daftarAntrean.find(item =>
            String(item.idPengajuan || item.id) === String(id)
        ) || null;
    }

    // ==========================================
    // 11. MEMBUKA MODAL
    // ==========================================

    function tampilkanDetail(id) {
        const item = ambilPengajuan(id);

        if (!item) {
            tampilkanNotifikasi(
                "Data pengajuan tidak ditemukan. Muat ulang antrean.",
                "error"
            );
            return;
        }

        const modal = el.modal;
        const status = ambilStatusPengajuan(item);
        const konfigurasi = STATUS[status];

        modal.dataset.pengajuanId = item.idPengajuan || item.id;

        isiField(modal, "label-id",
            `ID PENGAJUAN #${item.idPengajuan || item.id}`);

        isiField(modal, "judul-kegiatan", item.namaKegiatan);

        isiField(modal, "nama-pemohon", item.namaPemohon);

        isiField(modal, "identifier", item.identifier);

        isiField(modal, "waktu", formatWaktu(item));

        isiField(
            modal,
            "jumlah-peserta",
            formatAngka(item.jumlahPeserta)
        );

        isiField(
            modal,
            "kategori",
            item.kategori || "Belum ditentukan"
        );

        isiField(
            modal,
            "kebutuhan-pc",
            formatAngka(item.kebutuhanPC)
        );

        isiField(
            modal,
            "kebutuhan-kursi",
            formatAngka(item.kebutuhanKursi)
        );

        isiField(
            modal,
            "skor-detail",
            item.skor === null || item.skor === undefined
                ? "Belum dihitung"
                : item.skor
        );

        const badgePrioritas = modal.querySelector(
            '[data-field="prioritas-detail"]'
        );

        if (badgePrioritas) {
            badgePrioritas.textContent =
                item.prioritas || "Belum dihitung";
        }

        const badgeStatus = modal.querySelector(
            '[data-field="status-detail"]'
        );

        if (badgeStatus) {
            badgeStatus.className = "status-badge";

            if (konfigurasi) {
                badgeStatus.classList.add(konfigurasi.kelas);
                badgeStatus.textContent = konfigurasi.label;
            } else {
                badgeStatus.textContent = status;
            }
        }

        modal.querySelector(".aksi-feedback")?.remove();
        modal.querySelector(".form-alasan-penolakan")?.remove();

        if (status === "verifikasi") {
            tampilkanPanel("verifikasi");

        } else if (status === "bentrok") {
            tampilkanPanel("bentrok");

            isiField(
                modal,
                "pesan-bentrok",
                "Pengajuan mengalami bentrokan jadwal. Konflik perlu diperiksa sebelum keputusan diberikan."
            );

        } else if (status === "tergeser") {
            tampilkanPanel("tergeser");

            isiField(
                modal,
                "pesan-tergeser",
                "Pengajuan mengalami penggeseran jadwal."
            );

        } else if (status === "disetujui") {
            tampilkanPanel("disetujui");

            const tombolBatal = modal.querySelector(
                "[data-aksi-batalkan-persetujuan]"
            );

            const bolehBatal =
                item.statusBooking === "terjadwal" &&
                !sudahPresensi(item) &&
                !batasPresensiHabis(item);

            if (tombolBatal) {
                tombolBatal.hidden = !bolehBatal;
                tombolBatal.disabled = !bolehBatal;
            }

        } else {
            tampilkanPanel("lainnya");
        }

        fokusSebelumnya = document.activeElement;

        modal.hidden = false;
        modal.setAttribute("aria-hidden", "false");
        modal.classList.add("is-open");

        modal.style.display = "flex";
        modal.style.visibility = "visible";
        modal.style.opacity = "1";
        modal.style.pointerEvents = "auto";
        modal.style.zIndex = "9999";

        modal.querySelector(".review-modal-content")?.focus();
    }

    // ==========================================
    // 12. MENUTUP MODAL
    // ==========================================

    function tutupModal() {
        const modal = el.modal;

        modal.classList.remove("is-open");
        modal.hidden = true;

        modal.setAttribute("aria-hidden", "true");

        modal.style.display = "none";
        modal.style.visibility = "hidden";
        modal.style.opacity = "0";
        modal.style.pointerEvents = "none";

        delete modal.dataset.pengajuanId;

        if (
            fokusSebelumnya &&
            document.contains(fokusSebelumnya)
        ) {
            fokusSebelumnya.focus();
        }

        fokusSebelumnya = null;
    }

    // ==========================================
    // 13. MEMUAT ULANG DATA DARI DATABASE
    // ==========================================

    async function muatAntrean() {
        if (sedangMemuat) return;

        sedangMemuat = true;

        try {
            const data = await ambilDataAntrean();

            daftarAntrean = urutkanAntrean(data);

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

            console.log(
                `[SILAB] ${daftarAntrean.length} data antrean berhasil dimuat dari MySQL.`
            );

        } catch (error) {
            console.error(
                "SILAB: Gagal mengambil data antrean.",
                error
            );

            isiElemen(el.total, "Gagal memuat data");

            el.tabel.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-message">
                        ${escapeHTML(error.message)}
                    </td>
                </tr>
            `;

            tampilkanNotifikasi(
                error.message,
                "error"
            );

        } finally {
            sedangMemuat = false;
        }
    }

    // ==========================================
    // 14. SETUJUI PENGAJUAN
    // ==========================================

    async function setujuiPengajuan(id) {
        const tombol = el.modal.querySelector(".btn-approve");

        try {
            if (tombol) tombol.disabled = true;

            const hasil = await kirimTindakan(
                "setujui",
                id
            );

            tutupModal();

            await muatAntrean();

            tampilkanNotifikasi(
                hasil.message || "Pengajuan berhasil disetujui."
            );

        } catch (error) {
            tampilkanPesan(el.modal, error.message);

        } finally {
            if (tombol) tombol.disabled = false;
        }
    }

    // ==========================================
    // 15. FORM PENOLAKAN
    // ==========================================

    function tampilkanFormPenolakan(id) {
        const konten = el.modal.querySelector(
            ".review-modal-content"
        );

        const aksi = el.modal.querySelector(
            '.verification-actions[data-panel="verifikasi"]'
        );

        if (!konten || !aksi) return;

        if (konten.querySelector(".form-alasan-penolakan")) {
            return;
        }

        const form = document.createElement("form");

        form.className = "form-alasan-penolakan";

        const label = document.createElement("label");
        label.textContent = "Alasan Penolakan";

        const textarea = document.createElement("textarea");

        textarea.name = "alasan";
        textarea.placeholder = "Tuliskan alasan penolakan...";
        textarea.rows = 3;
        textarea.maxLength = 500;
        textarea.required = true;

        const error = document.createElement("small");
        error.className = "alasan-error";
        error.setAttribute("aria-live", "polite");

        const tombolKirim = document.createElement("button");

        tombolKirim.type = "submit";
        tombolKirim.className = "btn-konfirmasi-penolakan";
        tombolKirim.textContent = "Konfirmasi Penolakan";

        const tombolBatal = document.createElement("button");

        tombolBatal.type = "button";
        tombolBatal.className = "btn-batal-penolakan";
        tombolBatal.textContent = "Batal";

        form.append(
            label,
            textarea,
            error,
            tombolKirim,
            tombolBatal
        );

        aksi.hidden = true;
        konten.append(form);

        textarea.focus();

        tombolBatal.addEventListener("click", () => {
            form.remove();
            aksi.hidden = false;
        });

        form.addEventListener("submit", async event => {
            event.preventDefault();

            const alasan = textarea.value.trim();

            if (!alasan) {
                error.textContent = "Alasan penolakan wajib diisi.";
                textarea.focus();
                return;
            }

            tombolKirim.disabled = true;

            try {
                const hasil = await kirimTindakan(
                    "tolak",
                    id,
                    alasan
                );

                tutupModal();

                await muatAntrean();

                tampilkanNotifikasi(
                    hasil.message || "Pengajuan berhasil ditolak."
                );

            } catch (kesalahan) {
                error.textContent = kesalahan.message;
                tombolKirim.disabled = false;
            }
        });
    }

    // ==========================================
    // 16. BATALKAN PERSETUJUAN
    // ==========================================

    async function batalkanPersetujuan(id) {
        const item = ambilPengajuan(id);

        if (!item) {
            tampilkanPesan(
                el.modal,
                "Data pengajuan tidak ditemukan."
            );
            return;
        }

        if (
            item.statusBooking !== "terjadwal" ||
            sudahPresensi(item) ||
            batasPresensiHabis(item)
        ) {
            tampilkanPesan(
                el.modal,
                "Booking tidak dapat dibatalkan karena tidak lagi memenuhi syarat pembatalan."
            );
            return;
        }

        const konfirmasi = window.confirm(
            "Apakah Anda yakin ingin membatalkan persetujuan booking ini? Pengajuan akan dikembalikan ke antrean verifikasi."
        );

        if (!konfirmasi) return;

        const tombol = el.modal.querySelector(
            "[data-aksi-batalkan-persetujuan]"
        );

        try {
            if (tombol) tombol.disabled = true;

            const hasil = await kirimTindakan(
                "batalkan_persetujuan",
                id
            );

            tutupModal();

            filterAktif = "belum-disetujui";
            halamanAktif = 1;

            pilihFilter("belum-disetujui");

            await muatAntrean();

            tampilkanNotifikasi(
                hasil.message ||
                "Persetujuan berhasil dibatalkan."
            );

        } catch (error) {
            tampilkanPesan(el.modal, error.message);

            if (tombol) tombol.disabled = false;
        }
    }

    // ==========================================
    // 17. EVENT TABEL
    // ==========================================

    el.tabel.addEventListener("click", event => {
        const tombol = event.target.closest(
            "[data-aksi-detail]"
        );

        if (!tombol) return;

        tampilkanDetail(tombol.dataset.id);
    });

    // ==========================================
    // 18. EVENT MODAL
    // ==========================================

    el.modal.addEventListener("click", event => {

        const tombolTutup = event.target.closest(
            "[data-tutup-modal]"
        );

        if (tombolTutup) {
            tutupModal();
            return;
        }

        const tombolSetuju = event.target.closest(
            ".btn-approve"
        );

        if (tombolSetuju) {
            const id = el.modal.dataset.pengajuanId;

            if (id) setujuiPengajuan(id);

            return;
        }

        const tombolTolak = event.target.closest(
            '[data-keputusan="ditolak"]'
        );

        if (tombolTolak) {
            const id = el.modal.dataset.pengajuanId;

            if (id) tampilkanFormPenolakan(id);

            return;
        }

        const tombolBatal = event.target.closest(
            "[data-aksi-batalkan-persetujuan]"
        );

        if (tombolBatal) {
            const id = el.modal.dataset.pengajuanId;

            if (id) batalkanPersetujuan(id);

            return;
        }

        const tombolKonflik = event.target.closest(
            "[data-aksi-eskalasi], [data-aksi-kirim-konflik]"
        );

        if (tombolKonflik) {
            tampilkanPesan(
                el.modal,
                "Fitur penerusan konflik akan dihubungkan pada modul konflik Kepala Lab."
            );
        }
    });

    // ==========================================
    // 19. EVENT KEYBOARD
    // ==========================================

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            !el.modal.hidden
        ) {
            tutupModal();
        }
    });

    // ==========================================
    // 20. SINKRONISASI DATA
    // ==========================================

    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            muatAntrean();
        }
    });

    window.addEventListener("focus", muatAntrean);

    intervalRefresh = window.setInterval(
        muatAntrean,
        INTERVAL_REFRESH
    );

    // ==========================================
    // 21. INISIALISASI
    // ==========================================

    el.modal.hidden = true;

    el.modal.setAttribute("aria-hidden", "true");

    el.modal.style.display = "none";

    muatAntrean();

    console.log(
        "SILAB: Modul antrean berbasis MySQL berhasil diinisialisasi."
    );

})(window, document);