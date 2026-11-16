
/**
 * SILAB - PEMBUATAN REKOMENDASI JADWAL
 *
 * Fitur:
 * 1. Memuat rincian pengguna yang jadwalnya tergeser.
 * 2. Membuat satu atau dua alternatif jadwal.
 * 3. Menambah dan menghapus alternatif.
 * 4. Validasi waktu dan bentrokan jadwal.
 * 5. Mengirim rekomendasi melalui SILABService.
 * 6. Melihat rekomendasi yang sudah dikirim.
 * 7. Mengedit rekomendasi yang masih memenuhi ketentuan layanan.
 */

(function (window, document) {
    "use strict";

    // ==========================================
    // 1. DEPENDENSI DAN ELEMEN HTML
    // ==========================================

    const layanan = window.SILABService;

    const el = {
        form: document.getElementById("formRekomendasi"),

        daftarAlternatif: document.getElementById(
            "daftarAlternatif"
        ),

        tombolTambah: document.getElementById(
            "btnTambahAlternatif"
        ),

        catatan: document.getElementById("catatan"),

        feedback: document.getElementById(
            "feedbackRekomendasi"
        ),

        status: document.getElementById(
            "statusRekomendasi"
        ),

        idKasus: document.getElementById("idKasus")
    };

    if (
        !layanan ||
        !el.form ||
        !el.daftarAlternatif ||
        !el.tombolTambah
    ) {
        console.error(
            "SILAB: Elemen formulir atau SILABService tidak ditemukan."
        );

        return;
    }


    // ==========================================
    // 2. KONFIGURASI
    // ==========================================

    const BATAS_ALTERNATIF = 2;
    const MINIMAL_ALTERNATIF = 1;
    const ZONA_WAKTU = "Asia/Jayapura";

    const STATUS_AKTIF = new Set([
        "menunggu_persetujuan",
        "rekomendasi_dikirim",
        "menunggu_konfirmasi"
    ]);

    let kasusAktif = null;
    let modeEdit = false;
    let modeLihat = false;
    let sedangMengirim = false;


    // ==========================================
    // 3. FUNGSI BANTUAN
    // ==========================================

    function buatElemen(tag, kelas, teks = "") {
        const elemen = document.createElement(tag);

        if (kelas) {
            elemen.className = kelas;
        }

        if (teks) {
            elemen.textContent = teks;
        }

        return elemen;
    }


    function normalisasi(nilai) {
        return String(nilai ?? "")
            .trim()
            .toLowerCase();
    }


    function ambilParameterURL(nama) {
        return new URLSearchParams(
            window.location.search
        ).get(nama);
    }


    function ambilIdKasus() {
        return (
            el.form.dataset.kasusId ||
            el.idKasus?.value ||
            ambilParameterURL("kasusId") ||
            ambilParameterURL("pengajuanId") ||
            ambilParameterURL("id") ||
            ""
        );
    }


    // ==========================================
    // 4. FEEDBACK
    // ==========================================

    function tampilkanFeedback(pesan, jenis = "error") {
        let feedback = el.feedback;

        if (!feedback) {
            feedback = buatElemen(
                "div",
                "recommendation-feedback"
            );

            feedback.id = "feedbackRekomendasi";

            feedback.setAttribute(
                "role",
                "status"
            );

            feedback.setAttribute(
                "aria-live",
                "polite"
            );

            el.form.append(feedback);

            el.feedback = feedback;
        }

        feedback.textContent = pesan;
        feedback.dataset.jenis = jenis;
        feedback.hidden = false;
    }


    function hapusFeedback() {
        if (!el.feedback) return;

        el.feedback.textContent = "";

        delete el.feedback.dataset.jenis;

        el.feedback.hidden = true;
    }


    // ==========================================
    // 5. STATUS DAN TOMBOL SUBMIT
    // ==========================================

    function perbaruiStatus(teks) {
        if (el.status) {
            el.status.textContent = teks;
        }
    }


    function ambilTombolSubmit() {
        return el.form.querySelector(
            '[type="submit"]'
        );
    }


    function ubahLabelSubmit(teks) {
        const tombol = ambilTombolSubmit();

        if (!tombol) return;

        const label = tombol.querySelector(
            "[data-label-submit]"
        );

        if (label) {
            label.textContent = teks;
        } else {
            tombol.textContent = teks;
        }
    }


    // ==========================================
    // 6. FORMAT WAKTU
    // ==========================================

    function keNilaiDatetimeLocal(nilai, tanggal = "") {
        if (!nilai) return "";

        const teks = String(nilai).trim();

        // Format waktu saja.
        if (/^\d{2}:\d{2}/.test(teks) && tanggal) {
            return `${tanggal}T${teks.slice(0, 5)}`;
        }

        // Format tanggal dan waktu.
        if (!teks.includes("T")) {
            return "";
        }

        // Waktu yang sudah memiliki zona waktu.
        const memilikiZona = /Z$|[+-]\d{2}:\d{2}$/.test(teks);

        if (!memilikiZona) {
            return teks.slice(0, 16);
        }

        const tanggalWaktu = new Date(teks);

        if (Number.isNaN(tanggalWaktu.getTime())) {
            return "";
        }

        const bagian = new Intl.DateTimeFormat(
            "en-GB",
            {
                timeZone: ZONA_WAKTU,
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23"
            }
        ).formatToParts(tanggalWaktu);

        const hasil = {};

        bagian.forEach(item => {
            hasil[item.type] = item.value;
        });

        return (
            `${hasil.year}-${hasil.month}-${hasil.day}` +
            `T${hasil.hour}:${hasil.minute}`
        );
    }


    function formatWaktuRekomendasi(data) {
        if (!data) return "";

        return keNilaiDatetimeLocal(
            data.mulaiLokal || data.waktuMulai,
            data.tanggal
        );
    }


    function formatWaktuSelesai(data) {
        if (!data) return "";

        return keNilaiDatetimeLocal(
            data.selesaiLokal || data.waktuSelesai,
            data.tanggal
        );
    }


    function parseWaktuWIT(nilai) {
        if (!nilai) return NaN;

        return Date.parse(
            `${nilai}:00+09:00`
        );
    }


    // ==========================================
    // 7. FORMAT JADWAL ASAL
    // ==========================================

    function formatJadwalAsal(nilai) {
        if (!nilai) {
            return {
                tanggal: "-",
                jam: "-"
            };
        }

        let sumber = nilai;

        if (typeof nilai === "object" && !(nilai instanceof Date)) {
            if (nilai.mulaiLokal) {
                sumber = nilai.mulaiLokal;
            } else if (nilai.waktuMulai && nilai.tanggal) {
                sumber = `${nilai.tanggal}T${nilai.waktuMulai}`;
            }
        }

        let tanggal;

        if (
            typeof sumber === "string" &&
            /^\d{4}-\d{2}-\d{2}T/.test(sumber) &&
            !/Z$|[+-]\d{2}:\d{2}$/.test(sumber)
        ) {
            tanggal = new Date(
                `${sumber.slice(0, 16)}:00+09:00`
            );
        } else {
            tanggal = new Date(sumber);
        }

        if (Number.isNaN(tanggal.getTime())) {
            return {
                tanggal: "-",
                jam: "-"
            };
        }

        return {
            tanggal: new Intl.DateTimeFormat(
                "id-ID",
                {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                    timeZone: ZONA_WAKTU
                }
            ).format(tanggal),

            jam: new Intl.DateTimeFormat(
                "id-ID",
                {
                    hour: "2-digit",
                    minute: "2-digit",
                    hourCycle: "h23",
                    timeZone: ZONA_WAKTU
                }
            ).format(tanggal) + " WIT"
        };
    }


    // ==========================================
    // 8. MENGISI RINCIAN PENGGUNA
    // ==========================================

    function isiDetail(nama, nilai) {
        const target = document.querySelector(
            `[data-detail="${nama}"]`
        );

        if (!target) return;

        target.textContent =
            nilai === null ||
            nilai === undefined ||
            nilai === ""
                ? "-"
                : String(nilai);
    }


    function tampilkanDetailKasus(kasus) {
        const jadwal = formatJadwalAsal(
            kasus.jadwalAsal
        );

        const jumlahPC = Number(kasus.kebutuhanPC);
        const jumlahKursi = Number(kasus.kebutuhanKursi);

        const kebutuhan =
            `PC: ${Number.isFinite(jumlahPC) ? jumlahPC : 0} unit` +
            ` | Kursi: ${Number.isFinite(jumlahKursi) ? jumlahKursi : 0} unit`;

        const namaPenggeser =
            kasus.namaPenggeser ||
            kasus.penggeser?.namaPemohon ||
            kasus.pengajuanPenggeser?.namaPemohon ||
            "-";

        isiDetail(
            "namaPemohon",
            kasus.namaPemohon
        );

        isiDetail(
            "nipNpm",
            kasus.nipNpm
        );

        isiDetail(
            "kategoriPrioritas",
            kasus.prioritas || kasus.kategoriPrioritas
        );

        isiDetail(
            "namaKegiatan",
            kasus.namaKegiatan
        );

        isiDetail(
            "kebutuhan",
            kebutuhan
        );

        isiDetail(
            "jadwalAsalTanggal",
            jadwal.tanggal
        );

        isiDetail(
            "jadwalAsalJam",
            jadwal.jam
        );

        isiDetail(
            "namaPenggeser",
            namaPenggeser
        );

        isiDetail(
            "alasan",
            kasus.alasan || kasus.alasanTergeser
        );
    }


    // ==========================================
    // 9. MEMBUAT CARD ALTERNATIF
    // ==========================================

    function buatCardAlternatif(nomor, data = {}) {
        const card = buatElemen(
            "article",
            "alternatif-card"
        );

        card.dataset.alternatif = nomor;

        // Header card.
        const heading = buatElemen(
            "div",
            "alternative-card-heading"
        );

        const judul = buatElemen(
            "div",
            "alternative-title"
        );

        const nomorBadge = buatElemen(
            "span",
            "alternative-number",
            String(nomor)
        );

        const namaAlternatif = buatElemen(
            "h4",
            "",
            `Alternatif Jadwal ${nomor}`
        );

        judul.append(
            nomorBadge,
            namaAlternatif
        );

        const aksi = buatElemen(
            "div",
            "alternative-card-actions"
        );

        const label = buatElemen(
            "span",
            "alternative-label",
            nomor === 1 ? "Pilihan Utama" : "Pilihan Kedua"
        );

        aksi.append(label);

        // Tombol hapus untuk alternatif kedua.
        if (nomor > MINIMAL_ALTERNATIF) {
            const tombolHapus = buatElemen(
                "button",
                "btn-hapus-alternatif"
            );

            tombolHapus.type = "button";

            tombolHapus.dataset.hapusAlternatif = nomor;

            tombolHapus.setAttribute(
                "aria-label",
                `Hapus alternatif jadwal ${nomor}`
            );

            tombolHapus.title = "Hapus alternatif";

            tombolHapus.append(
                buatElemen("i", "bi bi-trash3")
            );

            aksi.append(tombolHapus);
        }

        heading.append(judul, aksi);

        // Grid input.
        const grid = buatElemen(
            "div",
            "alternative-input-grid"
        );

        // Input waktu mulai.
        const grupMulai = buatElemen(
            "div",
            "form-group"
        );

        const idMulai = `waktuMulai-${nomor}`;

        const labelMulai = buatElemen(
            "label",
            "",
            "Waktu Mulai"
        );

        labelMulai.htmlFor = idMulai;

        const inputMulai = buatElemen("input");

        inputMulai.id = idMulai;
        inputMulai.type = "datetime-local";
        inputMulai.required = true;
        inputMulai.name =
            `alternatifJadwal[${nomor - 1}][waktuMulai]`;

        inputMulai.dataset.field = "waktu-mulai";

        inputMulai.value = formatWaktuRekomendasi(data);

        const errorMulai = buatElemen(
            "small",
            "field-error"
        );

        errorMulai.dataset.error = "waktu-mulai";

        grupMulai.append(
            labelMulai,
            inputMulai,
            errorMulai
        );

        // Input waktu selesai.
        const grupSelesai = buatElemen(
            "div",
            "form-group"
        );

        const idSelesai = `waktuSelesai-${nomor}`;

        const labelSelesai = buatElemen(
            "label",
            "",
            "Waktu Selesai"
        );

        labelSelesai.htmlFor = idSelesai;

        const inputSelesai = buatElemen("input");

        inputSelesai.id = idSelesai;
        inputSelesai.type = "datetime-local";
        inputSelesai.required = true;
        inputSelesai.name =
            `alternatifJadwal[${nomor - 1}][waktuSelesai]`;

        inputSelesai.dataset.field = "waktu-selesai";

        inputSelesai.value = formatWaktuSelesai(data);

        const errorSelesai = buatElemen(
            "small",
            "field-error"
        );

        errorSelesai.dataset.error = "waktu-selesai";

        grupSelesai.append(
            labelSelesai,
            inputSelesai,
            errorSelesai
        );

        grid.append(
            grupMulai,
            grupSelesai
        );

        card.append(
            heading,
            grid
        );

        return card;
    }


    // ==========================================
    // 10. MENGAMBIL DATA ALTERNATIF
    // ==========================================

    function ambilDataAlternatif() {
        return Array.from(
            el.daftarAlternatif.querySelectorAll(
                ".alternatif-card"
            )
        ).map(card => ({
            waktuMulai: card.querySelector(
                '[data-field="waktu-mulai"]'
            )?.value.trim() || "",

            waktuSelesai: card.querySelector(
                '[data-field="waktu-selesai"]'
            )?.value.trim() || ""
        }));
    }


    // ==========================================
    // 11. MENGATUR JUMLAH ALTERNATIF
    // ==========================================

    function perbaruiKontrolAlternatif() {
        const jumlah = el.daftarAlternatif.querySelectorAll(
            ".alternatif-card"
        ).length;

        el.tombolTambah.disabled =
            jumlah >= BATAS_ALTERNATIF || modeLihat;

        el.tombolTambah.title =
            jumlah >= BATAS_ALTERNATIF
                ? "Maksimal dua alternatif jadwal."
                : "Tambah alternatif jadwal";

        const badge = document.querySelector(
            ".slot-badge"
        );

        if (badge) {
            const ikon = badge.querySelector("i");

            badge.replaceChildren();

            if (ikon) {
                badge.append(ikon);
            }

            badge.append(
                document.createTextNode(
                    ` ${jumlah} dari ${BATAS_ALTERNATIF} slot`
                )
            );
        }
    }


    // ==========================================
    // 12. MENAMPILKAN ALTERNATIF
    // ==========================================

    function tampilkanAlternatif(data = [{}]) {
        const daftar = data
            .slice(0, BATAS_ALTERNATIF);

        if (daftar.length === 0) {
            daftar.push({});
        }

        el.daftarAlternatif.replaceChildren();

        daftar.forEach((item, index) => {
            el.daftarAlternatif.append(
                buatCardAlternatif(index + 1, item)
            );
        });

        perbaruiKontrolAlternatif();
    }


    // ==========================================
    // 13. MENAMBAHKAN ALTERNATIF
    // ==========================================

    function tambahAlternatif() {
        if (modeLihat) return;

        const jumlah = el.daftarAlternatif.querySelectorAll(
            ".alternatif-card"
        ).length;

        if (jumlah >= BATAS_ALTERNATIF) {
            tampilkanFeedback(
                "Maksimal dua alternatif jadwal yang dapat diberikan."
            );

            return;
        }

        tampilkanAlternatif(
            ambilDataAlternatif().concat([{}])
        );

        hapusFeedback();
    }


    // ==========================================
    // 14. MENGHAPUS ALTERNATIF
    // ==========================================

    function hapusAlternatif(nomor) {
        if (modeLihat || nomor <= MINIMAL_ALTERNATIF) {
            return;
        }

        const data = ambilDataAlternatif();

        data.splice(nomor - 1, 1);

        tampilkanAlternatif(data);

        hapusFeedback();
    }


    // ==========================================
    // 15. VALIDASI INPUT
    // ==========================================

    function tampilkanErrorInput(input, pesan) {
        const grup = input.closest(".form-group");

        const error = grup?.querySelector(
            ".field-error"
        );

        input.setAttribute(
            "aria-invalid",
            "true"
        );

        if (error) {
            error.textContent = pesan;
            error.classList.add("aktif");
        }
    }


    function hapusErrorInput(input) {
        if (!input) return;

        const grup = input.closest(".form-group");

        const error = grup?.querySelector(
            ".field-error"
        );

        input.removeAttribute("aria-invalid");

        if (error) {
            error.textContent = "";
            error.classList.remove("aktif");
        }
    }


    // ==========================================
    // 16. VALIDASI ALTERNATIF
    // ==========================================

    function validasiAlternatif() {
        const cards = Array.from(
            el.daftarAlternatif.querySelectorAll(
                ".alternatif-card"
            )
        );

        if (
            cards.length < MINIMAL_ALTERNATIF ||
            cards.length > BATAS_ALTERNATIF
        ) {
            throw new Error(
                "Jumlah alternatif harus satu atau dua."
            );
        }

        const hasil = [];

        for (const card of cards) {
            const mulai = card.querySelector(
                '[data-field="waktu-mulai"]'
            );

            const selesai = card.querySelector(
                '[data-field="waktu-selesai"]'
            );

            hapusErrorInput(mulai);
            hapusErrorInput(selesai);

            if (!mulai.value) {
                tampilkanErrorInput(
                    mulai,
                    "Waktu mulai wajib diisi."
                );

                mulai.focus();

                return null;
            }

            if (!selesai.value) {
                tampilkanErrorInput(
                    selesai,
                    "Waktu selesai wajib diisi."
                );

                selesai.focus();

                return null;
            }

            const timestampMulai = parseWaktuWIT(
                mulai.value
            );

            const timestampSelesai = parseWaktuWIT(
                selesai.value
            );

            if (
                !Number.isFinite(timestampMulai) ||
                !Number.isFinite(timestampSelesai)
            ) {
                tampilkanErrorInput(
                    mulai,
                    "Format waktu tidak valid."
                );

                mulai.focus();

                return null;
            }

            if (timestampMulai <= Date.now()) {
                tampilkanErrorInput(
                    mulai,
                    "Waktu mulai harus berada di masa mendatang."
                );

                mulai.focus();

                return null;
            }

            // Jadwal tidak boleh melewati pergantian tanggal.
            if (
                mulai.value.slice(0, 10) !==
                selesai.value.slice(0, 10)
            ) {
                tampilkanErrorInput(
                    selesai,
                    "Jadwal tidak boleh melewati pergantian tanggal."
                );

                selesai.focus();

                return null;
            }

            if (timestampSelesai <= timestampMulai) {
                tampilkanErrorInput(
                    selesai,
                    "Waktu selesai harus setelah waktu mulai."
                );

                selesai.focus();

                return null;
            }

            hasil.push({
                waktuMulai: mulai.value,
                waktuSelesai: selesai.value,
                mulai: timestampMulai,
                selesai: timestampSelesai
            });
        }

        // Memeriksa bentrokan antaralternatif.
        if (hasil.length === 2) {
            const pertama = hasil[0];
            const kedua = hasil[1];

            const bentrok =
                pertama.mulai < kedua.selesai &&
                pertama.selesai > kedua.mulai;

            if (bentrok) {
                tampilkanFeedback(
                    "Alternatif pertama dan kedua tidak boleh memiliki jadwal yang bertabrakan."
                );

                return null;
            }
        }

        return hasil.map(item => ({
            waktuMulai: item.waktuMulai,
            waktuSelesai: item.waktuSelesai
        }));
    }


    // ==========================================
    // 17. MEMBENTUK DATA REKOMENDASI
    // ==========================================

    function bentukDataRekomendasi() {
        const alternatif = validasiAlternatif();

        if (!alternatif) return null;

        return {
            pengajuanId:
                kasusAktif.pengajuanId || kasusAktif.id,

            alternatifJadwal: alternatif,

            catatan: el.catatan?.value.trim() || ""
        };
    }


    // ==========================================
    // 18. MEMUAT DATA KASUS TERGESER
    // ==========================================

    function muatKasus(id) {
        if (!id) {
            throw new Error(
                "ID kasus tergeser tidak ditemukan."
            );
        }

        const kasus = layanan.getKasusTergeserById(id);

        if (!kasus) {
            throw new Error(
                "Data kasus tergeser tidak ditemukan."
            );
        }

        kasusAktif = kasus;

        el.form.dataset.kasusId = id;

        tampilkanDetailKasus(kasus);

        return kasus;
    }


    // ==========================================
    // 19. MENGAMBIL REKOMENDASI TERBARU
    // ==========================================

    function ambilRekomendasiTerbaru(kasus) {
        return kasus.rekomendasiTerbaru || null;
    }


    // ==========================================
    // 20. MODE EDIT REKOMENDASI
    // ==========================================

    function muatEditRekomendasi(kasus) {
        const rekomendasi = ambilRekomendasiTerbaru(
            kasus
        );

        if (!rekomendasi) {
            throw new Error(
                "Data rekomendasi sebelumnya tidak ditemukan."
            );
        }

        const status = normalisasi(
            rekomendasi.status
        );

        if (!STATUS_AKTIF.has(status)) {
            throw new Error(
                "Rekomendasi ini sudah tidak dapat diedit."
            );
        }

        modeEdit = true;

        let alternatif = rekomendasi.alternatifJadwal;

        // Kompatibilitas dengan data rekomendasi lama.
        if (
            !Array.isArray(alternatif) ||
            alternatif.length === 0
        ) {
            alternatif = [{
                tanggal: rekomendasi.tanggal,
                waktuMulai: rekomendasi.waktuMulai,
                waktuSelesai: rekomendasi.waktuSelesai
            }];
        }

        tampilkanAlternatif(alternatif);

        if (el.catatan) {
            el.catatan.value =
                rekomendasi.catatan || "";
        }

        perbaruiStatus("Mengubah Rekomendasi");

        ubahLabelSubmit(
            "Simpan Perubahan Rekomendasi"
        );
    }


    // ==========================================
    // 21. MODE LIHAT REKOMENDASI
    // ==========================================

    function aturModeBacaSaja() {
        modeLihat = true;

        el.form.dataset.mode = "lihat";

        el.daftarAlternatif.querySelectorAll(
            "input"
        ).forEach(input => {
            input.disabled = true;
        });

        el.daftarAlternatif.querySelectorAll(
            ".btn-hapus-alternatif"
        ).forEach(tombol => {
            tombol.hidden = true;
        });

        el.tombolTambah.disabled = true;

        if (el.catatan) {
            el.catatan.disabled = true;
        }

        const tombolSubmit = ambilTombolSubmit();

        if (tombolSubmit) {
            tombolSubmit.disabled = true;
        }

        ubahLabelSubmit("Rekomendasi Telah Dikirim");

        perbaruiKontrolAlternatif();
    }


    function muatLihatRekomendasi(kasus) {
        const rekomendasi = ambilRekomendasiTerbaru(
            kasus
        );

        if (!rekomendasi) {
            throw new Error(
                "Data rekomendasi yang akan dilihat tidak ditemukan."
            );
        }

        let alternatif = rekomendasi.alternatifJadwal;

        // Kompatibilitas dengan data lama.
        if (
            !Array.isArray(alternatif) ||
            alternatif.length === 0
        ) {
            alternatif = [{
                tanggal: rekomendasi.tanggal,
                waktuMulai: rekomendasi.waktuMulai,
                waktuSelesai: rekomendasi.waktuSelesai
            }];
        }

        tampilkanAlternatif(alternatif);

        if (el.catatan) {
            el.catatan.value =
                rekomendasi.catatan || "";
        }

        perbaruiStatus("Rekomendasi Telah Dikirim");

        aturModeBacaSaja();
    }


    // ==========================================
    // 22. MENGIRIM REKOMENDASI
    // ==========================================

    function kirimFormulir(event) {
        event.preventDefault();

        if (sedangMengirim || modeLihat) return;

        hapusFeedback();

        if (!kasusAktif) {
            tampilkanFeedback(
                "Data kasus tergeser belum dimuat."
            );

            return;
        }

        try {
            const detail = bentukDataRekomendasi();

            if (!detail) return;

            sedangMengirim = true;

            const tombol = ambilTombolSubmit();

            if (tombol) {
                tombol.disabled = true;
            }

            ubahLabelSubmit(
                modeEdit
                    ? "Menyimpan perubahan..."
                    : "Mengirim rekomendasi..."
            );

            const hasil = modeEdit
                ? layanan.editRekomendasi(
                    kasusAktif.id,
                    detail
                )
                : layanan.kirimRekomendasi(
                    kasusAktif.id,
                    detail
                );

            if (!hasil || !hasil.success) {
                throw new Error(
                    "Rekomendasi gagal diproses."
                );
            }

            kasusAktif = hasil;

            tampilkanFeedback(
                modeEdit
                    ? "Rekomendasi berhasil diperbarui."
                    : "Rekomendasi berhasil dikirim kepada pengguna.",
                "sukses"
            );

            window.dispatchEvent(
                new CustomEvent(
                    "silab:rekomendasi-berhasil",
                    {
                        detail: {
                            kasusId: kasusAktif.id,
                            rekomendasi:
                                hasil.rekomendasiTerbaru
                        }
                    }
                )
            );

            el.form.dataset.selesai = "true";

            perbaruiStatus("Rekomendasi Berhasil Diproses");

            ubahLabelSubmit("Berhasil Diproses");

            aturModeBacaSaja();

        } catch (error) {
            console.error(
                "SILAB: Gagal memproses rekomendasi.",
                error
            );

            tampilkanFeedback(
                error.message || "Terjadi kesalahan saat memproses rekomendasi."
            );

        } finally {
            sedangMengirim = false;

            if (
                el.form.dataset.selesai !== "true"
            ) {
                const tombol = ambilTombolSubmit();

                if (tombol) {
                    tombol.disabled = false;
                }

                ubahLabelSubmit(
                    modeEdit
                        ? "Simpan Perubahan Rekomendasi"
                        : "Kirim Rekomendasi"
                );
            }
        }
    }


    // ==========================================
    // 23. EVENT TAMBAH ALTERNATIF
    // ==========================================

    el.tombolTambah.addEventListener(
        "click",
        tambahAlternatif
    );


    // ==========================================
    // 24. EVENT HAPUS ALTERNATIF
    // ==========================================

    el.daftarAlternatif.addEventListener(
        "click",
        event => {
            const tombol = event.target.closest(
                "[data-hapus-alternatif]"
            );

            if (!tombol) return;

            const nomor = Number(
                tombol.dataset.hapusAlternatif
            );

            hapusAlternatif(nomor);
        }
    );


    // ==========================================
    // 25. EVENT VALIDASI INPUT
    // ==========================================

    el.daftarAlternatif.addEventListener(
        "input",
        event => {
            if (
                !event.target.matches(
                    '[data-field="waktu-mulai"], [data-field="waktu-selesai"]'
                )
            ) {
                return;
            }

            hapusErrorInput(event.target);

            hapusFeedback();

            el.form.dataset.selesai = "false";
        }
    );


    // ==========================================
    // 26. EVENT CATATAN
    // ==========================================

    if (el.catatan) {
        el.catatan.addEventListener(
            "input",
            () => {
                el.form.dataset.selesai = "false";
                hapusFeedback();
            }
        );
    }


    // ==========================================
    // 27. EVENT SUBMIT FORM
    // ==========================================

    el.form.addEventListener(
        "submit",
        kirimFormulir
    );


    // ==========================================
    // 28. INISIALISASI HALAMAN
    // ==========================================

    function inisialisasi() {
        try {
            // Menampilkan satu alternatif secara default.
            tampilkanAlternatif([{}]);

            const idKasus = ambilIdKasus();

            if (!idKasus) {
                throw new Error(
                    "ID kasus tidak ditemukan. Silakan kembali ke daftar rekomendasi."
                );
            }

            const kasus = muatKasus(idKasus);

            const modeURL = normalisasi(
                ambilParameterURL("mode")
            );

            const editAktif =
                modeURL === "edit" ||
                el.form.dataset.mode === "edit";

            const lihatAktif =
                modeURL === "lihat";

            if (lihatAktif) {
                muatLihatRekomendasi(kasus);

            } else if (editAktif) {
                muatEditRekomendasi(kasus);

            } else {
                perbaruiStatus("Menunggu Rekomendasi");
            }

            console.log(
                "SILAB: Modul rekomendasi jadwal berhasil dimuat."
            );

        } catch (error) {
            console.error(
                "SILAB: Inisialisasi rekomendasi gagal.",
                error
            );

            tampilkanFeedback(
                error.message || "Halaman rekomendasi gagal dimuat."
            );

            const tombol = ambilTombolSubmit();

            if (tombol) {
                tombol.disabled = true;
            }
        }
    }


    inisialisasi();

})(window, document);
