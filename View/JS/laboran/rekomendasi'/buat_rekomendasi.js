
/**
 * MODUL BUAT REKOMENDASI SILAB
 *
 * Mengelola:
 * 1. Memuat data kasus tergeser.
 * 2. Menampilkan rincian pengajuan.
 * 3. Memvalidasi jadwal alternatif.
 * 4. Mengirim rekomendasi.
 * 5. Mengedit rekomendasi selama 24 jam.
 * 6. Menampilkan rekomendasi tersimpan.
 * 7. Menampilkan notifikasi keberhasilan.
 * 8. Mengatur tombol kembali.
 */

(function (window, document) {
    "use strict";


    // =====================================================
    // 1. DEPENDENSI DAN ELEMEN
    // =====================================================

    const layanan = window.SILABService;

    const parameter = new URLSearchParams(
        window.location.search
    );

    const idReferensi =
        parameter.get("pengajuan") ||
        parameter.get("kasusId");

    const mode = parameter.get("mode") || "buat";

    const modeEdit = mode === "edit";
    const modeLihat = mode === "lihat";


    // Elemen formulir.
    const form = document.getElementById(
        "formRekomendasi"
    );

    const inputMulai = document.getElementById(
        "waktu-mulai"
    );

    const inputSelesai = document.getElementById(
        "waktu-selesai"
    );

    const inputCatatan = document.getElementById(
        "catatan"
    );


    // Elemen validasi.
    const errorMulai = document.getElementById(
        "errorWaktuMulai"
    );

    const errorSelesai = document.getElementById(
        "errorWaktuSelesai"
    );

    const feedback = document.getElementById(
        "feedbackRekomendasi"
    );


    // Elemen tombol dan status.
    const tombolKirim = document.getElementById(
        "btnKirimRekomendasi"
    );

    const statusHalaman = document.getElementById(
        "statusRekomendasi"
    );


    // =====================================================
    // 2. KONSTANTA
    // =====================================================

    const STATUS_TERKIRIM = "rekomendasi_dikirim";

    const STATUS_MENUNGGU = [
        "tergeser",
        "menunggu_rekomendasi",
        "perlu_rekomendasi",
        "belum_direkomendasikan"
    ];

    const ZONA_WIT = 9 * 60 * 60 * 1000;

    const BATAS_KONFIRMASI = 24 * 60 * 60 * 1000;


    // =====================================================
    // 3. VARIABEL MODUL
    // =====================================================

    let kasusAktif = null;

    let rekomendasiAktif = null;

    let sedangMenyimpan = false;

    let selesaiDisimpan = false;

    let sudahValidasi = false;

    let timerToast = null;


    // =====================================================
    // 4. PEMERIKSAAN KOMPONEN
    // =====================================================

    if (
        !form ||
        !inputMulai ||
        !inputSelesai ||
        !inputCatatan ||
        !errorMulai ||
        !errorSelesai ||
        !feedback ||
        !tombolKirim ||
        !statusHalaman
    ) {
        console.error(
            "SILAB: Elemen halaman rekomendasi tidak lengkap."
        );

        return;
    }


    if (!layanan) {
        console.error(
            "SILAB: SILABService tidak ditemukan."
        );

        tampilkanPesan(
            "Layanan SILAB belum dimuat. Periksa urutan script.",
            "error"
        );

        aturForm(true);

        return;
    }


    if (
        typeof layanan.getKasusTergeserById !== "function" ||
        typeof layanan.kirimRekomendasi !== "function"
    ) {
        tampilkanPesan(
            "Fungsi layanan rekomendasi belum tersedia. Periksa layanan.js.",
            "error"
        );

        aturForm(true);

        return;
    }


    if (
        modeEdit &&
        typeof layanan.editRekomendasi !== "function"
    ) {
        tampilkanPesan(
            "Fungsi edit rekomendasi belum tersedia pada layanan.js.",
            "error"
        );

        aturForm(true);

        return;
    }


    // =====================================================
    // 5. UTILITAS TAMPILAN
    // =====================================================

    // Menampilkan pesan umum.
    function tampilkanPesan(pesan, jenis = "info") {
        feedback.textContent = pesan;

        feedback.dataset.jenis = jenis;

        feedback.style.display = "block";

        feedback.setAttribute(
            "role",
            jenis === "error" ? "alert" : "status"
        );
    }


    // Menghapus pesan umum.
    function hapusPesan() {
        feedback.textContent = "";

        feedback.style.display = "none";

        delete feedback.dataset.jenis;
    }


    // Mengubah status halaman.
    function ubahStatusHalaman(teks) {
        statusHalaman.textContent = teks;
    }


    // Mengubah label tombol.
    function ubahLabelTombol(teks) {
        const label = tombolKirim.querySelector(
            "[data-label-submit]"
        );

        if (label) {
            label.textContent = teks;
        } else {
            tombolKirim.textContent = teks;
        }
    }


    // Mengunci atau membuka formulir.
    function aturForm(nonaktif) {
        inputMulai.disabled = nonaktif;

        inputSelesai.disabled = nonaktif;

        inputCatatan.disabled = nonaktif;

        tombolKirim.disabled = nonaktif;
    }


    // Mengisi rincian pengajuan.
    function isiRincian(kunci, nilai) {
        const elemen = document.querySelector(
            `[data-detail="${kunci}"]`
        );

        if (!elemen) return;

        elemen.textContent =
            nilai === null ||
            nilai === undefined ||
            nilai === ""
                ? "-"
                : String(nilai);
    }


    // =====================================================
    // 6. NOTIFIKASI TOAST
    // =====================================================

    function tampilkanToast(pesan) {
        let toast = document.getElementById(
            "toastRekomendasi"
        );

        if (!toast) {
            toast = document.createElement("div");

            toast.id = "toastRekomendasi";

            toast.className = "toast-rekomendasi";

            toast.setAttribute("role", "status");

            toast.setAttribute(
                "aria-live",
                "polite"
            );

            const ikon = document.createElement("i");

            ikon.className = "bi bi-check-circle-fill";

            const teks = document.createElement("span");

            teks.className = "toast-pesan";

            toast.append(ikon, teks);

            document.body.append(toast);
        }

        toast.querySelector(
            ".toast-pesan"
        ).textContent = pesan;

        toast.classList.remove("aktif");

        // Memastikan animasi dapat dijalankan kembali.
        void toast.offsetWidth;

        toast.classList.add("aktif");

        window.clearTimeout(timerToast);

        timerToast = window.setTimeout(() => {
            toast.classList.remove("aktif");
        }, 3500);
    }


    // =====================================================
    // 7. UTILITAS WAKTU WIT
    // =====================================================

    function formatJam(jam) {
        if (!jam) return "-";

        return String(jam)
            .slice(0, 5)
            .replace(":", ".");
    }


    function formatTanggal(tanggal) {
        const cocok = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
            String(tanggal || "")
        );

        if (!cocok) {
            return "Tanggal belum tersedia";
        }

        const nilai = new Date(
            Number(cocok[1]),
            Number(cocok[2]) - 1,
            Number(cocok[3])
        );

        return new Intl.DateTimeFormat("id-ID", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric"
        }).format(nilai);
    }


    // Mengubah datetime-local menjadi timestamp WIT.
    function parsingWIT(nilai) {
        if (typeof nilai !== "string") {
            return NaN;
        }

        const cocok = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/.exec(
            nilai
        );

        if (!cocok) {
            return NaN;
        }

        const waktu = Date.parse(
            `${cocok[1]}T${cocok[2]}:00+09:00`
        );

        if (!Number.isFinite(waktu)) {
            return NaN;
        }

        const hasil = new Date(
            waktu + ZONA_WIT
        ).toISOString().slice(0, 16);

        return hasil === nilai ? waktu : NaN;
    }


    // Mengambil waktu sekarang berdasarkan WIT.
    function waktuSekarangWIT() {
        return new Date(
            Date.now() + ZONA_WIT
        ).toISOString().slice(0, 16);
    }


    // Mengambil waktu dari rekomendasi tersimpan.
    function ambilNilaiWaktu(rekomendasi, jenis) {
        const kunci = jenis === "mulai"
            ? "waktuMulai"
            : "waktuSelesai";

        const alternatif = jenis === "mulai"
            ? "mulaiLokal"
            : "selesaiLokal";

        const nilai =
            rekomendasi[kunci] ||
            rekomendasi[alternatif];

        if (
            typeof nilai === "string" &&
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(nilai)
        ) {
            return nilai.slice(0, 16);
        }

        if (
            typeof nilai === "string" &&
            /^\d{2}:\d{2}/.test(nilai) &&
            rekomendasi.tanggal
        ) {
            return `${rekomendasi.tanggal}T${nilai.slice(0, 5)}`;
        }

        return "";
    }


    // =====================================================
    // 8. MENAMPILKAN JADWAL ASAL
    // =====================================================

    function formatJadwalAsal(kasus) {
        let tanggal = kasus.tanggal || "";

        let jamMulai = kasus.waktuMulai || "";

        const jamSelesai = kasus.waktuSelesai || "";

        if (kasus.jadwalAsal) {
            const cocok = String(
                kasus.jadwalAsal
            ).match(
                /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/
            );

            if (cocok) {
                tanggal = cocok[1];

                jamMulai = cocok[2];
            }
        }

        return {
            tanggal: formatTanggal(tanggal),

            jam: jamMulai && jamSelesai
                ? `${formatJam(jamMulai)}–${formatJam(jamSelesai)} WIT`
                : jamMulai
                    ? `${formatJam(jamMulai)} WIT`
                    : "-"
        };
    }


    // =====================================================
    // 9. MENAMPILKAN DETAIL KASUS
    // =====================================================

    function tampilkanKasus(kasus) {
        const jadwal = formatJadwalAsal(kasus);

        isiRincian(
            "namaPemohon",
            kasus.namaPemohon
        );

        isiRincian(
            "nipNpm",
            `NIP/NPM: ${kasus.nipNpm || "-"}`
        );

        isiRincian(
            "kategoriPrioritas",
            `${kasus.kategori || "-"} • ${kasus.prioritas || "-"}`
        );

        isiRincian(
            "namaKegiatan",
            kasus.namaKegiatan
        );

        isiRincian(
            "kebutuhan",
            `Kebutuhan: ${kasus.kebutuhanPC ?? 0} PC • ${kasus.kebutuhanKursi ?? 0} Kursi`
        );

        isiRincian(
            "jadwalAsalTanggal",
            jadwal.tanggal
        );

        isiRincian(
            "jadwalAsalJam",
            jadwal.jam
        );

        isiRincian(
            "namaPenggeser",
            kasus.namaPenggeser ||
            "Informasi penggeser belum tersedia."
        );

        isiRincian(
            "alasan",
            kasus.alasan ||
            "Informasi alasan pergeseran belum tersedia."
        );
    }


    // =====================================================
    // 10. MENGAMBIL REKOMENDASI TERSIMPAN
    // =====================================================

    function ambilRekomendasiTerbaru(kasus) {
        if (kasus.rekomendasiTerbaru) {
            return kasus.rekomendasiTerbaru;
        }

        if (typeof layanan.getAll !== "function") {
            return null;
        }

        const daftar =
            layanan.getAll("rekomendasi") || [];

        const hasil = daftar.filter(item =>
            [
                item.caseId,
                item.kasusId,
                item.pengajuanId,
                item.antreanId
            ].some(id =>
                id !== undefined &&
                id !== null &&
                (
                    String(id) === String(kasus.id) ||
                    String(id) === String(kasus.pengajuanId)
                )
            )
        );

        hasil.sort((a, b) =>
            (
                Date.parse(
                    b.dikirimPada || b.dibuatPada
                ) || 0
            ) -
            (
                Date.parse(
                    a.dikirimPada || a.dibuatPada
                ) || 0
            )
        );

        return hasil[0] || null;
    }


    // Mengambil batas konfirmasi rekomendasi.
    function ambilBatasKonfirmasi(rekomendasi) {
        const batas =
            rekomendasi.kedaluwarsaPada ||
            rekomendasi.expiresAt ||
            rekomendasi.batasRespons;

        if (batas) {
            const waktu = Date.parse(batas);

            if (Number.isFinite(waktu)) {
                return waktu;
            }
        }

        const dibuat =
            rekomendasi.dikirimPada ||
            rekomendasi.dibuatPada ||
            rekomendasi.createdAt;

        const waktuDibuat = Date.parse(
            dibuat || ""
        );

        return Number.isFinite(waktuDibuat)
            ? waktuDibuat + BATAS_KONFIRMASI
            : NaN;
    }


    // =====================================================
    // 11. MENAMPILKAN REKOMENDASI TERSIMPAN
    // =====================================================

    function tampilkanRekomendasiTersimpan(rekomendasi) {
        inputMulai.value = ambilNilaiWaktu(
            rekomendasi,
            "mulai"
        );

        inputSelesai.value = ambilNilaiWaktu(
            rekomendasi,
            "selesai"
        );

        inputCatatan.value =
            rekomendasi.catatan || "";

        const status = String(
            rekomendasi.status || ""
        ).toLowerCase();

        const keterangan = {
            rekomendasi_dikirim: "Rekomendasi Telah Dikirim",
            diterima: "Rekomendasi Diterima",
            ditolak: "Rekomendasi Ditolak",
            kedaluwarsa: "Rekomendasi Kedaluwarsa",
            dibatalkan: "Rekomendasi Dibatalkan"
        };

        ubahStatusHalaman(
            keterangan[status] ||
            "Rekomendasi Tersimpan"
        );

        const batas = ambilBatasKonfirmasi(
            rekomendasi
        );

        if (Number.isFinite(batas)) {
            tampilkanPesan(
                `Batas konfirmasi pengguna: ${new Date(batas).toLocaleString("id-ID", {
                    timeZone: "Asia/Jayapura"
                })}.`,
                "sukses"
            );
        } else {
            tampilkanPesan(
                "Data rekomendasi berhasil dimuat.",
                "sukses"
            );
        }
    }


    // =====================================================
    // 12. VALIDASI INPUT
    // =====================================================

    // Menampilkan error pada input.
    function tampilkanError(input, elemenError, pesan) {
        input.setAttribute(
            "aria-invalid",
            "true"
        );

        elemenError.textContent = pesan;

        elemenError.classList.add("aktif");
    }


    // Menghapus error pada input.
    function hapusError(input, elemenError) {
        input.removeAttribute("aria-invalid");

        elemenError.textContent = "";

        elemenError.classList.remove("aktif");
    }


    // Membersihkan seluruh error.
    function bersihkanPesanValidasi() {
        hapusError(
            inputMulai,
            errorMulai
        );

        hapusError(
            inputSelesai,
            errorSelesai
        );

        hapusPesan();
    }


    // Validasi waktu mulai.
    function validasiMulai() {
        const nilai = inputMulai.value;

        if (!nilai) {
            tampilkanError(
                inputMulai,
                errorMulai,
                "Tanggal dan waktu mulai wajib diisi."
            );

            return false;
        }

        const waktu = parsingWIT(nilai);

        if (!Number.isFinite(waktu)) {
            tampilkanError(
                inputMulai,
                errorMulai,
                "Format tanggal dan waktu mulai tidak valid."
            );

            return false;
        }

        if (waktu <= Date.now()) {
            tampilkanError(
                inputMulai,
                errorMulai,
                "Waktu mulai harus berada di masa mendatang."
            );

            return false;
        }

        hapusError(
            inputMulai,
            errorMulai
        );

        return true;
    }


    // Validasi waktu selesai.
    function validasiSelesai() {
        const nilai = inputSelesai.value;

        if (!nilai) {
            tampilkanError(
                inputSelesai,
                errorSelesai,
                "Tanggal dan waktu selesai wajib diisi."
            );

            return false;
        }

        const selesai = parsingWIT(nilai);

        if (!Number.isFinite(selesai)) {
            tampilkanError(
                inputSelesai,
                errorSelesai,
                "Format tanggal dan waktu selesai tidak valid."
            );

            return false;
        }

        if (selesai <= Date.now()) {
            tampilkanError(
                inputSelesai,
                errorSelesai,
                "Waktu selesai harus berada di masa mendatang."
            );

            return false;
        }

        if (inputMulai.value) {
            const mulai = parsingWIT(
                inputMulai.value
            );

            if (
                Number.isFinite(mulai) &&
                selesai <= mulai
            ) {
                tampilkanError(
                    inputSelesai,
                    errorSelesai,
                    "Waktu selesai harus lebih besar dari waktu mulai."
                );

                return false;
            }
        }

        hapusError(
            inputSelesai,
            errorSelesai
        );

        return true;
    }


    // Validasi keseluruhan formulir.
    function validasiForm() {
        const mulaiValid = validasiMulai();

        const selesaiValid = validasiSelesai();

        if (!mulaiValid || !selesaiValid) {
            return {
                valid: false,
                pesan: "Periksa kembali tanggal dan waktu rekomendasi."
            };
        }

        return {
            valid: true,
            mulai: parsingWIT(inputMulai.value),
            selesai: parsingWIT(inputSelesai.value)
        };
    }


    // =====================================================
    // 13. BATAS WAKTU INPUT
    // =====================================================

    function aturBatasInput() {
        const sekarang = waktuSekarangWIT();

        inputMulai.min = sekarang;

        inputSelesai.min = sekarang;
    }


    // =====================================================
    // 14. TOMBOL KEMBALI
    // =====================================================

    function kembaliKeDaftar() {
        window.location.href =
            "rekomendasi_jadwal.html";
    }


    // Menghilangkan tombol batal dan mengubah
    // tombol kirim menjadi tombol kembali.
    function ubahMenjadiTombolKembali() {
        selesaiDisimpan = true;

        const tombolBatal = form.querySelector(
            ".btn-batal"
        );

        if (tombolBatal) {
            tombolBatal.remove();
        }

        tombolKirim.type = "button";

        tombolKirim.disabled = false;

        tombolKirim.classList.add(
            "btn-kembali"
        );

        tombolKirim.replaceChildren();

        const ikon = document.createElement("i");

        ikon.className = "bi bi-arrow-left";

        const label = document.createElement("span");

        label.textContent = "Kembali";

        tombolKirim.append(
            ikon,
            label
        );

        tombolKirim.onclick = kembaliKeDaftar;
    }


    // =====================================================
    // 15. MEMUAT DATA KASUS
    // =====================================================

    function muatKasus() {
        if (!idReferensi) {
            aturForm(true);

            tampilkanPesan(
                "ID kasus tidak ditemukan. Silakan kembali ke daftar rekomendasi.",
                "error"
            );

            return;
        }

        try {
            kasusAktif =
                layanan.getKasusTergeserById(
                    idReferensi
                );

            if (!kasusAktif) {
                aturForm(true);

                tampilkanPesan(
                    `Kasus ${idReferensi} tidak ditemukan.`,
                    "error"
                );

                return;
            }

            tampilkanKasus(kasusAktif);

            rekomendasiAktif =
                ambilRekomendasiTerbaru(kasusAktif);

            const statusKasus = String(
                kasusAktif.status || ""
            ).toLowerCase();

            const statusRekomendasi = String(
                rekomendasiAktif?.status || ""
            ).toLowerCase();


            // MODE EDIT.
            if (modeEdit) {
                if (
                    statusKasus !== STATUS_TERKIRIM ||
                    !rekomendasiAktif ||
                    statusRekomendasi !== STATUS_TERKIRIM
                ) {
                    aturForm(true);

                    ubahStatusHalaman(
                        "Tidak Dapat Diedit"
                    );

                    tampilkanPesan(
                        "Rekomendasi tidak tersedia untuk diedit atau statusnya sudah berubah.",
                        "error"
                    );

                    return;
                }

                const batas = ambilBatasKonfirmasi(
                    rekomendasiAktif
                );

                if (
                    !Number.isFinite(batas) ||
                    Date.now() >= batas
                ) {
                    aturForm(true);

                    ubahStatusHalaman(
                        "Batas Edit Berakhir"
                    );

                    tampilkanPesan(
                        "Rekomendasi sudah melewati batas waktu edit 24 jam.",
                        "error"
                    );

                    return;
                }

                tampilkanRekomendasiTersimpan(
                    rekomendasiAktif
                );

                aturForm(false);

                ubahStatusHalaman(
                    "Edit Rekomendasi"
                );

                ubahLabelTombol(
                    "Simpan Perubahan"
                );

                aturBatasInput();

                inputSelesai.min =
                    inputMulai.value ||
                    waktuSekarangWIT();

                tampilkanPesan(
                    "Mode edit aktif. Batas konfirmasi 24 jam tidak diperpanjang.",
                    "info"
                );

                return;
            }


            // MODE LIHAT.
            if (modeLihat) {
                if (!rekomendasiAktif) {
                    aturForm(true);

                    tampilkanPesan(
                        "Belum ada rekomendasi untuk kasus ini.",
                        "info"
                    );

                    return;
                }

                tampilkanRekomendasiTersimpan(
                    rekomendasiAktif
                );

                aturForm(true);

                ubahMenjadiTombolKembali();

                return;
            }


            // REKOMENDASI SUDAH TERKIRIM.
            if (
                statusKasus === STATUS_TERKIRIM &&
                rekomendasiAktif
            ) {
                tampilkanRekomendasiTersimpan(
                    rekomendasiAktif
                );

                aturForm(true);

                tampilkanPesan(
                    "Rekomendasi sudah dikirim dan sedang menunggu konfirmasi pengguna.",
                    "sukses"
                );

                ubahMenjadiTombolKembali();

                return;
            }


            // MEMERIKSA STATUS KASUS.
            if (
                statusKasus &&
                !STATUS_MENUNGGU.includes(statusKasus)
            ) {
                aturForm(true);

                ubahStatusHalaman(
                    "Tidak Dapat Diproses"
                );

                tampilkanPesan(
                    `Kasus berstatus "${statusKasus}" dan tidak dapat diberikan rekomendasi baru.`,
                    "error"
                );

                return;
            }


            // FORM REKOMENDASI BARU.
            aturForm(false);

            aturBatasInput();

            ubahStatusHalaman(
                "Menunggu Rekomendasi"
            );

            ubahLabelTombol(
                "Kirim Rekomendasi"
            );

            tampilkanPesan(
                `Data kasus ${kasusAktif.id} berhasil dimuat. Silakan tentukan jadwal alternatif.`,
                "info"
            );

            console.log(
                "SILAB: Kasus tergeser berhasil dimuat.",
                kasusAktif
            );

        } catch (error) {
            console.error(
                "SILAB: Gagal memuat kasus.",
                error
            );

            aturForm(true);

            tampilkanPesan(
                error.message ||
                "Gagal mengambil data kasus.",
                "error"
            );
        }
    }


    // =====================================================
    // 16. EVENT VALIDASI INPUT
    // =====================================================

    // Mengubah batas waktu selesai ketika waktu mulai berubah.
    inputMulai.addEventListener("change", function () {
        inputSelesai.min =
            this.value || waktuSekarangWIT();

        if (
            inputSelesai.value &&
            inputSelesai.value <= this.value
        ) {
            inputSelesai.value = "";
        }

        if (sudahValidasi || inputMulai.value) {
            validasiMulai();
        }

        if (sudahValidasi || inputSelesai.value) {
            validasiSelesai();
        }
    });


    // Memvalidasi waktu mulai ketika diperbaiki.
    inputMulai.addEventListener("input", function () {
        if (
            sudahValidasi ||
            inputMulai.hasAttribute("aria-invalid")
        ) {
            validasiMulai();
        }

        if (
            sudahValidasi ||
            inputSelesai.hasAttribute("aria-invalid")
        ) {
            validasiSelesai();
        }
    });


    // Memvalidasi waktu selesai ketika diperbaiki.
    inputSelesai.addEventListener("input", function () {
        if (
            sudahValidasi ||
            inputSelesai.hasAttribute("aria-invalid")
        ) {
            validasiSelesai();
        }
    });


    // Validasi ketika pengguna meninggalkan input.
    inputMulai.addEventListener("blur", function () {
        if (sudahValidasi || inputMulai.value) {
            validasiMulai();
        }
    });


    inputSelesai.addEventListener("blur", function () {
        if (sudahValidasi || inputSelesai.value) {
            validasiSelesai();
        }
    });


    // Menghilangkan pesan umum jika kedua input valid.
    function periksaPesanValidasi() {
        if (
            inputMulai.value &&
            inputSelesai.value &&
            validasiMulai() &&
            validasiSelesai()
        ) {
            if (feedback.dataset.jenis === "error") {
                hapusPesan();
            }
        }
    }


    inputMulai.addEventListener(
        "change",
        periksaPesanValidasi
    );

    inputSelesai.addEventListener(
        "change",
        periksaPesanValidasi
    );


    // =====================================================
    // 17. MENYIMPAN REKOMENDASI
    // =====================================================

    async function simpanRekomendasi(event) {
        event.preventDefault();

        if (selesaiDisimpan) {
            kembaliKeDaftar();

            return;
        }

        if (sedangMenyimpan || !kasusAktif) {
            return;
        }


        // VALIDASI INPUT.
        sudahValidasi = true;

        const hasilValidasi = validasiForm();

        if (!hasilValidasi.valid) {
            tampilkanPesan(
                hasilValidasi.pesan,
                "error"
            );

            // Fokus ke input pertama yang bermasalah.
            if (
                inputMulai.getAttribute("aria-invalid") === "true"
            ) {
                inputMulai.focus();
            } else {
                inputSelesai.focus();
            }

            return;
        }


        bersihkanPesanValidasi();


        try {
            // Memastikan kasus masih tersedia.
            const kasusTerbaru =
                layanan.getKasusTergeserById(
                    kasusAktif.id
                );

            if (!kasusTerbaru) {
                throw new Error(
                    "Kasus tergeser tidak lagi tersedia."
                );
            }


            // Memastikan status kasus belum berubah.
            const statusTerbaru = String(
                kasusTerbaru.status || ""
            ).toLowerCase();

            if (
                !modeEdit &&
                statusTerbaru &&
                !STATUS_MENUNGGU.includes(statusTerbaru)
            ) {
                throw new Error(
                    "Status kasus telah berubah. Silakan muat ulang halaman."
                );
            }


            // Data rekomendasi.
            const detail = {
                waktuMulai: inputMulai.value,

                waktuSelesai: inputSelesai.value,

                catatan: inputCatatan.value.trim()
            };


            // Mengunci tombol ketika proses berjalan.
            sedangMenyimpan = true;

            tombolKirim.disabled = true;

            ubahLabelTombol(
                modeEdit
                    ? "Menyimpan Perubahan..."
                    : "Mengirim Rekomendasi..."
            );


            // Menjalankan layanan.
            const hasil = modeEdit
                ? await layanan.editRekomendasi(
                    kasusAktif.id,
                    detail
                )
                : await layanan.kirimRekomendasi(
                    kasusAktif.id,
                    detail
                );


            // Memeriksa hasil penyimpanan.
            if (
                hasil === false ||
                hasil === null ||
                hasil === undefined ||
                hasil?.success === false
            ) {
                throw new Error(
                    hasil?.pesan ||
                    hasil?.message ||
                    "Layanan gagal menyimpan rekomendasi."
                );
            }


            // Mengambil kembali data terbaru.
            const dataTerbaru =
                layanan.getKasusTergeserById(
                    kasusAktif.id
                );

            if (dataTerbaru) {
                kasusAktif = dataTerbaru;

            } else if (
                hasil &&
                typeof hasil === "object"
            ) {
                kasusAktif = hasil;
            }


            // Mengambil rekomendasi terbaru.
            rekomendasiAktif =
                kasusAktif.rekomendasiTerbaru ||
                ambilRekomendasiTerbaru(kasusAktif);


            // Mengunci seluruh input.
            aturForm(true);


            // Memperbarui status halaman.
            ubahStatusHalaman(
                modeEdit
                    ? "Perubahan Berhasil Disimpan"
                    : "Rekomendasi Berhasil Dikirim"
            );


            // Menghilangkan pesan validasi.
            bersihkanPesanValidasi();


            // Menampilkan notifikasi keberhasilan.
            tampilkanToast(
                modeEdit
                    ? "Perubahan rekomendasi berhasil disimpan."
                    : "Rekomendasi berhasil dikirim dan menunggu konfirmasi pengguna."
            );


            // Mengubah tombol menjadi tombol kembali.
            ubahMenjadiTombolKembali();


            console.log(
                "SILAB: Rekomendasi berhasil disimpan.",
                {
                    kasus: kasusAktif.id,
                    rekomendasi: rekomendasiAktif?.id
                }
            );


        } catch (error) {
            console.error(
                "SILAB: Gagal menyimpan rekomendasi.",
                error
            );

            tampilkanPesan(
                error.message ||
                "Terjadi kesalahan saat menyimpan rekomendasi.",
                "error"
            );

            tombolKirim.disabled = false;

            ubahLabelTombol(
                modeEdit
                    ? "Simpan Perubahan"
                    : "Kirim Rekomendasi"
            );

        } finally {
            sedangMenyimpan = false;
        }
    }


    // =====================================================
    // 18. EVENT FORM
    // =====================================================

    form.addEventListener(
        "submit",
        simpanRekomendasi
    );


    // =====================================================
    // 19. TOMBOL KEMBALI TAMBAHAN
    // =====================================================

    const tombolKembali = document.querySelector(
        "[data-kembali-rekomendasi]"
    );

    if (tombolKembali) {
        tombolKembali.addEventListener(
            "click",
            kembaliKeDaftar
        );
    }


    // =====================================================
    // 20. INISIALISASI
    // =====================================================

    muatKasus();

    console.log(
        "SILAB: Modul buat rekomendasi berhasil diinisialisasi."
    );

})(window, document);
