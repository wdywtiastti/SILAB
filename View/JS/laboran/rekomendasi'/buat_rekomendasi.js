
/**
 * SILAB - PEMBUATAN REKOMENDASI JADWAL
 *
 * Fitur:
 * 1. Satu atau dua alternatif jadwal.
 * 2. Tambah dan hapus alternatif.
 * 3. Validasi input jadwal.
 * 4. Validasi bentrokan alternatif.
 * 5. Integrasi SILABService.
 * 6. Kirim rekomendasi.
 * 7. Edit rekomendasi maksimal 24 jam.
 */

(function (window, document) {
    "use strict";

    // ==========================================
    // 1. DEPENDENSI DAN ELEMEN HTML
    // ==========================================

    const layanan = window.SILABService;

    const el = {
        form: document.querySelector(
            "#formRekomendasi, #rekomendasiForm, [data-form-rekomendasi]"
        ),

        daftarAlternatif: document.querySelector(
            "#daftarAlternatif, #alternatifContainer, [data-alternatif-list], .alternative-list"
        ),

        tombolTambah: document.querySelector(
            "#tambahAlternatif, [data-tambah-alternatif], .btn-tambah-alternatif"
        ),

        catatan: document.querySelector(
            "#catatanRekomendasi, [name='catatan']"
        ),

        feedback: document.querySelector(
            "#rekomendasiFeedback, .recommendation-feedback"
        ),

        tombolKirim: null,

        idKasus: document.querySelector(
            "#idKasus, [name='kasusId'], [name='pengajuanId']"
        )
    };

    if (!layanan || !el.form || !el.daftarAlternatif) {
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

    const STATUS_AKTIF = new Set([
        "menunggu_persetujuan",
        "rekomendasi_dikirim",
        "menunggu_konfirmasi"
    ]);

    let kasusAktif = null;

    let modeEdit = false;

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

    function tampilkanFeedback(pesan, jenis = "error") {
        let feedback = el.feedback;

        if (!feedback) {
            feedback = buatElemen(
                "div",
                "recommendation-feedback"
            );

            feedback.id = "rekomendasiFeedback";

            feedback.setAttribute("role", "alert");

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

        el.feedback.hidden = true;
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

    function formatTanggalInput(tanggal, jam) {
        if (!tanggal || !jam) return "";

        return `${tanggal}T${jam}`;
    }

    function ubahKeInputWaktu(data) {
        if (!data) return "";

        if (data.includes("T")) {
            return data.slice(0, 16);
        }

        return data;
    }

    function formatWaktuRekomendasi(data) {
        if (!data) return "";

        if (data.mulaiLokal) {
            return ubahKeInputWaktu(data.mulaiLokal);
        }

        return formatTanggalInput(
            data.tanggal,
            data.waktuMulai
        );
    }

    function formatWaktuSelesai(data) {
        if (!data) return "";

        if (data.selesaiLokal) {
            return ubahKeInputWaktu(data.selesaiLokal);
        }

        return formatTanggalInput(
            data.tanggal,
            data.waktuSelesai
        );
    }

    function parseWaktuWIT(nilai) {
        if (!nilai) return NaN;

        return Date.parse(`${nilai}:00+09:00`);
    }

    // ==========================================
    // 4. MEMBUAT CARD ALTERNATIF
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

        // Tombol hapus hanya untuk alternatif kedua.
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

            const ikon = buatElemen(
                "i",
                "bi bi-trash"
            );

            tombolHapus.append(ikon);

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

        const labelMulai = buatElemen(
            "label",
            "",
            "Waktu Mulai"
        );

        const inputMulai = buatElemen("input");

        inputMulai.type = "datetime-local";

        inputMulai.required = true;

        inputMulai.name = `alternatifJadwal[${nomor - 1}][waktuMulai]`;

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

        const labelSelesai = buatElemen(
            "label",
            "",
            "Waktu Selesai"
        );

        const inputSelesai = buatElemen("input");

        inputSelesai.type = "datetime-local";

        inputSelesai.required = true;

        inputSelesai.name = `alternatifJadwal[${nomor - 1}][waktuSelesai]`;

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
    // 5. MENGAMBIL DATA ALTERNATIF
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
    // 6. MEMPERBARUI TOMBOL ALTERNATIF
    // ==========================================

    function perbaruiKontrolAlternatif() {
        const jumlah = el.daftarAlternatif.querySelectorAll(
            ".alternatif-card"
        ).length;

        if (el.tombolTambah) {
            el.tombolTambah.disabled =
                jumlah >= BATAS_ALTERNATIF;

            el.tombolTambah.title =
                jumlah >= BATAS_ALTERNATIF
                    ? "Maksimal dua alternatif jadwal."
                    : "Tambah alternatif jadwal";
        }

        const badge = document.querySelector(
            ".slot-badge"
        );

        if (badge) {
            badge.textContent =
                ` ${jumlah} dari ${BATAS_ALTERNATIF} slot`;
        }
    }

    // ==========================================
    // 7. MENAMBAHKAN ALTERNATIF
    // ==========================================

    function tambahAlternatif(data = {}) {
        const jumlah = el.daftarAlternatif.querySelectorAll(
            ".alternatif-card"
        ).length;

        if (jumlah >= BATAS_ALTERNATIF) {
            tampilkanFeedback(
                "Maksimal dua alternatif jadwal yang dapat diberikan."
            );

            return;
        }

        const nomor = jumlah + 1;

        const card = buatCardAlternatif(
            nomor,
            data
        );

        el.daftarAlternatif.append(card);

        perbaruiKontrolAlternatif();

        hapusFeedback();
    }

    // ==========================================
    // 8. MENGHAPUS ALTERNATIF
    // ==========================================

    function hapusAlternatif(nomor) {
        if (nomor <= MINIMAL_ALTERNATIF) {
            return;
        }

        const cards = Array.from(
            el.daftarAlternatif.querySelectorAll(
                ".alternatif-card"
            )
        );

        const card = cards.find(
            item =>
                Number(item.dataset.alternatif) === nomor
        );

        if (!card) return;

        card.remove();

        // Susun ulang nomor alternatif.
        const dataLama = ambilDataAlternatif();

        tampilkanAlternatif(dataLama);

        hapusFeedback();
    }

    // ==========================================
    // 9. MENAMPILKAN ALTERNATIF
    // ==========================================

    function tampilkanAlternatif(data = [{}]) {
        const daftar = data.slice(
            0,
            BATAS_ALTERNATIF
        );

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
    // 10. VALIDASI INPUT ALTERNATIF
    // ==========================================

    function tampilkanErrorInput(input, pesan) {
        const grup = input.closest(".form-group");

        const error = grup?.querySelector(".field-error");

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
        const grup = input.closest(".form-group");

        const error = grup?.querySelector(".field-error");

        input.removeAttribute("aria-invalid");

        if (error) {
            error.textContent = "";

            error.classList.remove("aktif");
        }
    }

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

        for (let index = 0; index < cards.length; index++) {
            const card = cards[index];

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
    // 11. MEMBUAT DATA FORMULIR
    // ==========================================

    function bentukDataRekomendasi() {
        const alternatif = validasiAlternatif();

        if (!alternatif) return null;

        return {
            pengajuanId: kasusAktif.pengajuanId,

            alternatifJadwal: alternatif,

            catatan: el.catatan?.value.trim() || ""
        };
    }

    // ==========================================
    // 12. MEMUAT DATA KASUS TERGESER
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

        if (el.idKasus) {
            el.idKasus.value = kasus.pengajuanId;
        }

        // Menampilkan detail kasus jika elemen tersedia.
        const namaPemohon = document.querySelector(
            '[data-field="nama-pemohon"]'
        );

        const namaKegiatan = document.querySelector(
            '[data-field="nama-kegiatan"]'
        );

        const alasan = document.querySelector(
            '[data-field="alasan-tergeser"]'
        );

        if (namaPemohon) {
            namaPemohon.textContent =
                kasus.namaPemohon || "-";
        }

        if (namaKegiatan) {
            namaKegiatan.textContent =
                kasus.namaKegiatan || "-";
        }

        if (alasan) {
            alasan.textContent =
                kasus.alasan || "-";
        }

        return kasus;
    }

    // ==========================================
    // 13. MEMUAT DATA EDIT REKOMENDASI
    // ==========================================

    function muatEditRekomendasi(kasus) {
        const rekomendasi = kasus.rekomendasiTerbaru;

        if (!rekomendasi) {
            throw new Error(
                "Data rekomendasi sebelumnya tidak ditemukan."
            );
        }

        if (
            !STATUS_AKTIF.has(
                String(rekomendasi.status || "").toLowerCase()
            )
        ) {
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
            alternatif = [
                {
                    tanggal: rekomendasi.tanggal,
                    waktuMulai: rekomendasi.waktuMulai,
                    waktuSelesai: rekomendasi.waktuSelesai
                }
            ];
        }

        tampilkanAlternatif(alternatif);

        if (el.catatan) {
            el.catatan.value =
                rekomendasi.catatan || "";
        }

        const tombolSubmit = ambilTombolSubmit();

        if (tombolSubmit) {
            tombolSubmit.textContent =
                "Simpan Perubahan Rekomendasi";
        }
    }

    // ==========================================
    // 14. MENGAMBIL TOMBOL SUBMIT
    // ==========================================

    function ambilTombolSubmit() {
        return el.form.querySelector(
            '[type="submit"]'
        );
    }

    // ==========================================
    // 15. MEMPROSES PENGIRIMAN REKOMENDASI
    // ==========================================

    function kirimFormulir(event) {
        event.preventDefault();

        if (sedangMengirim) return;

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

            el.tombolKirim = tombol;

            if (tombol) {
                tombol.disabled = true;

                tombol.textContent = modeEdit
                    ? "Menyimpan perubahan..."
                    : "Mengirim rekomendasi...";
            }

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
                            rekomendasi: hasil.rekomendasiTerbaru
                        }
                    }
                )
            );

            if (tombol) {
                tombol.textContent = "Berhasil Diproses";
            }

            el.form.dataset.selesai = "true";

        } catch (error) {
            console.error(
                "SILAB: Gagal memproses rekomendasi.",
                error
            );

            tampilkanFeedback(error.message);

        } finally {
            sedangMengirim = false;

            const tombol = ambilTombolSubmit();

            if (
                tombol &&
                el.form.dataset.selesai !== "true"
            ) {
                tombol.disabled = false;

                tombol.textContent = modeEdit
                    ? "Simpan Perubahan Rekomendasi"
                    : "Kirim Rekomendasi";
            }
        }
    }

    // ==========================================
    // 16. EVENT TAMBAH ALTERNATIF
    // ==========================================

    if (el.tombolTambah) {
        el.tombolTambah.addEventListener(
            "click",
            () => tambahAlternatif()
        );
    }

    // ==========================================
    // 17. EVENT HAPUS ALTERNATIF
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
    // 18. EVENT VALIDASI INPUT
    // ==========================================

    el.daftarAlternatif.addEventListener(
        "input",
        event => {
            if (
                event.target.matches(
                    '[data-field="waktu-mulai"], [data-field="waktu-selesai"]'
                )
            ) {
                hapusErrorInput(event.target);

                hapusFeedback();

                el.form.dataset.selesai = "false";
            }
        }
    );

    // ==========================================
    // 19. EVENT SUBMIT FORM
    // ==========================================

    el.form.addEventListener(
        "submit",
        kirimFormulir
    );

    // ==========================================
    // 20. MEMULAI HALAMAN
    // ==========================================

    function inisialisasi() {
        try {
            // Menampilkan satu alternatif secara default.
            tampilkanAlternatif([{}]);

            const idKasus = ambilIdKasus();

            if (idKasus) {
                const kasus = muatKasus(idKasus);

                const modeURL = ambilParameterURL("mode");

                const editAktif =
                    modeURL === "edit" ||
                    el.form.dataset.mode === "edit";

                if (editAktif) {
                    muatEditRekomendasi(kasus);
                }
            }

            console.log(
                "SILAB: Modul rekomendasi jadwal berhasil dimuat."
            );

        } catch (error) {
            console.error(
                "SILAB: Inisialisasi rekomendasi gagal.",
                error
            );

            tampilkanFeedback(error.message);
        }
    }

    inisialisasi();

})(window, document);
