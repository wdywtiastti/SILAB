
/**
 * MODUL BUAT REKOMENDASI SILAB
 *
 * Mengelola:
 * 1. Pengambilan data kasus tergeser.
 * 2. Penampilan detail pengajuan.
 * 3. Validasi jadwal alternatif.
 * 4. Pengiriman rekomendasi.
 * 5. Pengeditan rekomendasi dalam batas 24 jam.
 * 6. Penampilan rekomendasi yang sudah dikirim.
 * 7. Navigasi kembali ke daftar rekomendasi.
 *
 * Seluruh pengelolaan data dilakukan melalui SILABService.
 */

(function (window, document) {
    "use strict";


    // =====================================================
    // 1. KONFIGURASI DAN ELEMEN HALAMAN
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

    const form = document.getElementById("formRekomendasi");

    const inputMulai = document.getElementById("waktu-mulai");
    const inputSelesai = document.getElementById("waktu-selesai");
    const inputCatatan = document.getElementById("catatan");

    const feedback = document.getElementById("feedbackRekomendasi");

    const tombolKirim = document.getElementById(
        "btnKirimRekomendasi"
    );

    const statusHalaman = document.getElementById(
        "statusRekomendasi"
    );


    // =====================================================
    // 2. KONSTANTA STATUS
    // =====================================================

    const STATUS_MENUNGGU = "menunggu_rekomendasi";

    const STATUS_TERKIRIM = "rekomendasi_dikirim";

    const STATUS_AKHIR = [
        "diterima",
        "ditolak",
        "kedaluwarsa",
        "dibatalkan"
    ];

    const ZONA_WIT = 9 * 60 * 60 * 1000;

    let kasusAktif = null;
    let rekomendasiAktif = null;

    let sedangMenyimpan = false;
    let selesaiDisimpan = false;


    // =====================================================
    // 3. PEMERIKSAAN KOMPONEN
    // =====================================================

    if (
        !layanan ||
        !form ||
        !inputMulai ||
        !inputSelesai ||
        !inputCatatan ||
        !feedback ||
        !tombolKirim ||
        !statusHalaman
    ) {
        console.error(
            "SILAB: Elemen halaman atau layanan rekomendasi tidak tersedia."
        );

        return;
    }

    if (
        typeof layanan.getKasusTergeserById !== "function" ||
        typeof layanan.kirimRekomendasi !== "function" ||
        typeof layanan.editRekomendasi !== "function"
    ) {
        console.error(
            "SILAB: Layanan rekomendasi belum menggunakan versi terbaru."
        );

        return;
    }


    // =====================================================
    // 4. UTILITAS TAMPILAN
    // =====================================================

    // Menampilkan pesan informasi.
    function tampilkanPesan(pesan, jenis = "info") {
        feedback.textContent = pesan;
        feedback.dataset.jenis = jenis;
    }


    // Mengubah status halaman.
    function ubahStatusHalaman(teks) {
        statusHalaman.textContent = teks;
    }


    // Mengubah label tombol utama.
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


    // Mengatur kondisi formulir.
    function aturForm(nonaktif) {
        inputMulai.disabled = nonaktif;
        inputSelesai.disabled = nonaktif;
        inputCatatan.disabled = nonaktif;
        tombolKirim.disabled = nonaktif;
    }


    // Mengisi detail pengajuan.
    function isiRincian(kunci, nilai) {
        const elemen = document.querySelector(
            `[data-detail="${kunci}"]`
        );

        if (elemen) {
            elemen.textContent =
                nilai === null ||
                nilai === undefined ||
                nilai === ""
                    ? "-"
                    : String(nilai);
        }
    }


    // =====================================================
    // 5. UTILITAS FORMAT WAKTU
    // =====================================================

    // Mengubah jam menjadi format tampilan.
    function formatJam(jam) {
        if (!jam) {
            return "-";
        }

        return String(jam).slice(0, 5).replace(":", ".");
    }


    // Mengubah tanggal menjadi format Indonesia.
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


    // Mengubah waktu datetime-local menjadi timestamp WIT.
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


    // Mengambil nilai datetime-local dari rekomendasi lama.
    function ambilNilaiWaktu(rekomendasi, jenis) {
        const kunci = jenis === "mulai"
            ? "waktuMulai"
            : "waktuSelesai";

        const alternatif = jenis === "mulai"
            ? "mulaiLokal"
            : "selesaiLokal";

        const nilai = rekomendasi[kunci] ||
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
    // 6. MENAMPILKAN JADWAL ASAL
    // =====================================================

    function formatJadwalAsal(kasus) {
        let tanggal = kasus.tanggal || "";
        let jamMulai = kasus.waktuMulai || "";
        let jamSelesai = kasus.waktuSelesai || "";

        if (kasus.jadwalAsal) {
            const cocok = String(kasus.jadwalAsal).match(
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
    // 7. MENAMPILKAN DETAIL KASUS
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
    // 8. MENGAMBIL REKOMENDASI TERBARU
    // =====================================================

    function ambilRekomendasiTerbaru(kasus) {
        if (kasus.rekomendasiTerbaru) {
            return kasus.rekomendasiTerbaru;
        }

        const daftar = layanan.getAll("rekomendasi");

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
                Date.parse(b.dikirimPada || b.dibuatPada) || 0
            ) -
            (
                Date.parse(a.dikirimPada || a.dibuatPada) || 0
            )
        );

        return hasil[0] || null;
    }


    // =====================================================
    // 9. MENAMPILKAN REKOMENDASI TERSIMPAN
    // =====================================================

    function tampilkanRekomendasiTersimpan(rekomendasi) {
        const mulai = ambilNilaiWaktu(
            rekomendasi,
            "mulai"
        );

        const selesai = ambilNilaiWaktu(
            rekomendasi,
            "selesai"
        );

        inputMulai.value = mulai;
        inputSelesai.value = selesai;
        inputCatatan.value = rekomendasi.catatan || "";

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
            keterangan[status] || "Rekomendasi Tersimpan"
        );

        const batas =
            rekomendasi.kedaluwarsaPada ||
            rekomendasi.expiresAt ||
            rekomendasi.batasRespons;

        if (batas) {
            const tanggalBatas = new Date(batas);

            tampilkanPesan(
                `Batas konfirmasi pengguna: ${tanggalBatas.toLocaleString("id-ID", {
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
    // 10. MENGATUR TOMBOL KEMBALI
    // =====================================================

    function ubahMenjadiTombolKembali() {
        selesaiDisimpan = true;

        tombolKirim.type = "button";
        tombolKirim.disabled = false;

        ubahLabelTombol(
            "Kembali ke Daftar Rekomendasi"
        );

        tombolKirim.addEventListener(
            "click",
            kembaliKeDaftar,
            { once: true }
        );
    }


    function kembaliKeDaftar() {
        window.location.href = "rekomendasi_jadwal.html";
    }


    // =====================================================
    // 11. MENGATUR BATAS WAKTU INPUT
    // =====================================================

    function aturBatasInput() {
        const sekarang = waktuSekarangWIT();

        inputMulai.min = sekarang;
        inputSelesai.min = sekarang;
    }


    inputMulai.addEventListener("change", function () {
        inputSelesai.min = this.value;

        if (
            inputSelesai.value &&
            inputSelesai.value <= this.value
        ) {
            inputSelesai.value = "";
        }
    });


    // =====================================================
    // 12. VALIDASI FORMULIR
    // =====================================================

    function validasiForm() {
        const nilaiMulai = inputMulai.value;
        const nilaiSelesai = inputSelesai.value;

        if (!nilaiMulai || !nilaiSelesai) {
            return {
                valid: false,
                pesan: "Waktu mulai dan waktu selesai wajib diisi."
            };
        }

        const mulai = parsingWIT(nilaiMulai);
        const selesai = parsingWIT(nilaiSelesai);

        if (
            !Number.isFinite(mulai) ||
            !Number.isFinite(selesai)
        ) {
            return {
                valid: false,
                pesan: "Format tanggal atau waktu tidak valid."
            };
        }

        if (mulai <= Date.now()) {
            return {
                valid: false,
                pesan: "Jadwal rekomendasi harus berada di masa mendatang."
            };
        }

        if (selesai <= mulai) {
            return {
                valid: false,
                pesan: "Waktu selesai harus lebih besar dari waktu mulai."
            };
        }

        return {
            valid: true,
            mulai,
            selesai
        };
    }


    // =====================================================
    // 13. MEMUAT DATA KASUS TERGESER
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
            // Mengambil kasus melalui layanan data.
            kasusAktif = layanan.getKasusTergeserById(
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


            // MODE EDIT REKOMENDASI.
            if (modeEdit) {
                if (
                    statusKasus !== STATUS_TERKIRIM ||
                    !rekomendasiAktif ||
                    rekomendasiAktif.status !== STATUS_TERKIRIM
                ) {
                    aturForm(true);

                    ubahStatusHalaman("Tidak Dapat Diedit");

                    tampilkanPesan(
                        "Rekomendasi tidak tersedia untuk diedit atau statusnya sudah berubah.",
                        "error"
                    );

                    return;
                }

                const batas = Date.parse(
                    kasusAktif.kedaluwarsaPada ||
                    rekomendasiAktif.kedaluwarsaPada ||
                    ""
                );

                if (
                    !Number.isFinite(batas) ||
                    Date.now() >= batas
                ) {
                    aturForm(true);

                    ubahStatusHalaman("Batas Edit Berakhir");

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

                ubahStatusHalaman("Edit Rekomendasi");

                ubahLabelTombol("Simpan Perubahan");

                aturBatasInput();

                inputMulai.min = waktuSekarangWIT();
                inputSelesai.min = inputMulai.value ||
                    waktuSekarangWIT();

                tampilkanPesan(
                    "Mode edit aktif. Perubahan hanya dapat dilakukan selama rekomendasi masih dalam batas 24 jam.",
                    "info"
                );

                return;
            }


            // MODE LIHAT REKOMENDASI.
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

                ubahLabelTombol("Kembali ke Daftar Rekomendasi");

                tombolKirim.disabled = false;
                tombolKirim.type = "button";

                tombolKirim.addEventListener(
                    "click",
                    kembaliKeDaftar
                );

                return;
            }


            // KASUS SUDAH MEMILIKI REKOMENDASI AKTIF.
            if (
                statusKasus === STATUS_TERKIRIM &&
                rekomendasiAktif
            ) {
                tampilkanRekomendasiTersimpan(
                    rekomendasiAktif
                );

                aturForm(true);

                ubahStatusHalaman("Rekomendasi Telah Dikirim");

                tombolKirim.type = "button";
                tombolKirim.disabled = false;

                ubahLabelTombol(
                    "Kembali ke Daftar Rekomendasi"
                );

                tombolKirim.addEventListener(
                    "click",
                    kembaliKeDaftar
                );

                return;
            }


            // HANYA KASUS MENUNGGU REKOMENDASI YANG DAPAT DIPROSES.
            if (statusKasus !== STATUS_MENUNGGU) {
                aturForm(true);

                ubahStatusHalaman("Tidak Dapat Diproses");

                tampilkanPesan(
                    "Kasus ini tidak sedang menunggu rekomendasi atau sudah diproses.",
                    "error"
                );

                return;
            }


            // MODE BUAT REKOMENDASI BARU.
            aturForm(false);
            aturBatasInput();

            ubahStatusHalaman("Menunggu Rekomendasi");

            ubahLabelTombol("Kirim Rekomendasi");

            tampilkanPesan(
                `Data kasus ${kasusAktif.id} berhasil dimuat. Silakan tentukan jadwal alternatif.`,
                "info"
            );

            console.log(
                "SILAB: Kasus tergeser berhasil dimuat.",
                kasusAktif.id
            );

        } catch (error) {
            console.error(
                "SILAB: Gagal memuat kasus.",
                error
            );

            aturForm(true);

            tampilkanPesan(
                error.message || "Gagal mengambil data kasus.",
                "error"
            );
        }
    }


    // =====================================================
    // 14. MENYIMPAN REKOMENDASI
    // =====================================================

    function simpanRekomendasi(event) {
        event.preventDefault();

        if (selesaiDisimpan) {
            kembaliKeDaftar();
            return;
        }

        if (sedangMenyimpan || !kasusAktif) {
            return;
        }

        // Memeriksa ulang data kasus terbaru.
        const kasusTerbaru =
            layanan.getKasusTergeserById(
                kasusAktif.id
            );

        if (!kasusTerbaru) {
            tampilkanPesan(
                "Kasus tergeser tidak lagi tersedia.",
                "error"
            );

            aturForm(true);
            return;
        }

        const hasilValidasi = validasiForm();

        if (!hasilValidasi.valid) {
            tampilkanPesan(
                hasilValidasi.pesan,
                "error"
            );

            return;
        }

        const detail = {
            waktuMulai: inputMulai.value,
            waktuSelesai: inputSelesai.value,
            catatan: inputCatatan.value.trim()
        };

        sedangMenyimpan = true;

        tombolKirim.disabled = true;

        ubahLabelTombol(
            modeEdit
                ? "Menyimpan Perubahan..."
                : "Mengirim Rekomendasi..."
        );

        try {
            let hasil;

            if (modeEdit) {
                // Mengedit rekomendasi yang sudah dikirim.
                hasil = layanan.editRekomendasi(
                    kasusAktif.id,
                    detail
                );

            } else {
                // Mengirim rekomendasi baru.
                hasil = layanan.kirimRekomendasi(
                    kasusAktif.id,
                    detail
                );
            }

            if (!hasil) {
                throw new Error(
                    "Layanan tidak mengembalikan data rekomendasi."
                );
            }

            kasusAktif = hasil;

            rekomendasiAktif =
                hasil.rekomendasiTerbaru ||
                ambilRekomendasiTerbaru(hasil);

            // Mengunci formulir setelah berhasil disimpan.
            aturForm(true);

            ubahStatusHalaman(
                modeEdit
                    ? "Perubahan Berhasil Disimpan"
                    : "Rekomendasi Berhasil Dikirim"
            );

            tampilkanPesan(
                modeEdit
                    ? "Perubahan rekomendasi berhasil disimpan. Batas waktu 24 jam tidak diperpanjang."
                    : "Rekomendasi berhasil dikirim dan tersimpan. Kasus tetap berada dalam daftar rekomendasi.",
                "sukses"
            );

            // Tombol kirim berubah menjadi tombol kembali.
            ubahMenjadiTombolKembali();

            console.log(
                modeEdit
                    ? "SILAB: Rekomendasi berhasil diedit."
                    : "SILAB: Rekomendasi berhasil dikirim.",
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
    // 15. EVENT FORM
    // =====================================================

    form.addEventListener(
        "submit",
        simpanRekomendasi
    );


    // Menghapus pesan error ketika input diperbaiki.
    [
        inputMulai,
        inputSelesai,
        inputCatatan
    ].forEach(input => {
        input.addEventListener("input", function () {
            if (feedback.dataset.jenis === "error") {
                feedback.textContent = "";
                delete feedback.dataset.jenis;
            }
        });
    });


    // Tombol kembali tambahan jika tersedia pada HTML.
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
    // 16. MENJALANKAN MODUL
    // =====================================================

    muatKasus();

    console.log(
        "SILAB: Modul buat rekomendasi berhasil diinisialisasi."
    );

})(window, document);
