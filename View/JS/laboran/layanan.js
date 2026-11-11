
/**
 * LAYANAN DATA SILAB
 *
 * Mengelola:
 * 1. Penyimpanan data simulasi melalui LocalStorage.
 * 2. Sinkronisasi data antarmodul dan antartab.
 * 3. Pengelolaan booking dan antrean.
 * 4. Pengelolaan kasus pengguna tergeser.
 * 5. Pengiriman rekomendasi jadwal.
 * 6. Pengeditan rekomendasi maksimal 24 jam.
 * 7. Pembatalan rekomendasi.
 * 8. Validasi waktu, kapasitas, dan bentrokan jadwal.
 *
 * Sumber data awal: data_uji.js
 */

(function (window) {
    "use strict";


    // =====================================================
    // 1. KONFIGURASI
    // =====================================================

    const STORAGE_KEY = "silab_laboran_v1";

    const DATA_SEED = window.SILAB_DATA_SEED;

    const KOLEKSI = [
        "bookings",
        "antrean",
        "penggunaTergeser",
        "rekomendasi"
    ];

    const KAPASITAS_PC = 36;
    const KAPASITAS_KURSI = 36;

    const BATAS_EDIT = 24 * 60 * 60 * 1000;

    const ZONA_WIT = 9 * 60 * 60 * 1000;

    const STATUS_ANTREAN_AKTIF = new Set([
        "verifikasi",
        "bentrok"
    ]);

    const STATUS_REKOMENDASI_AKTIF = new Set([
        "menunggu_rekomendasi",
        "rekomendasi_dikirim"
    ]);

    const STATUS_REKOMENDASI_AKHIR = new Set([
        "diterima",
        "ditolak",
        "kedaluwarsa",
        "dibatalkan"
    ]);

    const STATUS_JADWAL_AKTIF = new Set([
        "terjadwal",
        "disetujui",
        "dikonfirmasi",
        "aktif",
        "approved"
    ]);

    let dataAktif = null;
    let gunakanMemori = false;
    let dataMemori = null;


    // =====================================================
    // 2. PEMERIKSAAN DATA AWAL
    // =====================================================

    if (!DATA_SEED) {
        console.error(
            "SILAB: data_uji.js harus dimuat sebelum layanan.js."
        );

        return;
    }

    if (
        !KOLEKSI.every(koleksi =>
            Array.isArray(DATA_SEED[koleksi])
        )
    ) {
        console.error(
            "SILAB: Struktur data simulasi tidak valid."
        );

        return;
    }


    // =====================================================
    // 3. UTILITAS DASAR
    // =====================================================

    // Membuat salinan data agar sumber asli tidak berubah.
    function clone(data) {
        return JSON.parse(JSON.stringify(data));
    }


    // Memastikan koleksi tersedia.
    function validasiKoleksi(koleksi) {
        if (!KOLEKSI.includes(koleksi)) {
            throw new Error(
                `Koleksi "${koleksi}" tidak ditemukan.`
            );
        }
    }


    // Memeriksa struktur objek penyimpanan.
    function strukturValid(data) {
        return (
            data !== null &&
            typeof data === "object" &&
            !Array.isArray(data)
        );
    }


    // Memeriksa apakah ID sudah tersedia.
    function sudahAda(daftar, id) {
        return daftar.some(item =>
            String(item.id) === String(id)
        );
    }


    // Menggabungkan data simulasi tanpa menimpa data lama.
    function gabungkanDataAwal(data) {
        KOLEKSI.forEach(koleksi => {
            if (!Array.isArray(data[koleksi])) {
                data[koleksi] = [];
            }

            DATA_SEED[koleksi].forEach(item => {
                if (
                    item.id !== undefined &&
                    !sudahAda(data[koleksi], item.id)
                ) {
                    data[koleksi].push(clone(item));
                }
            });
        });

        return data;
    }


    // =====================================================
    // 4. PENGELOLAAN KASUS TERGESER
    // =====================================================

    // Membuat ID kasus tergeser yang unik.
    function buatIdKasus(pengajuanId, daftarKasus) {
        const dasar = `CASE-${pengajuanId}`;

        let id = dasar;
        let nomor = 2;

        while (sudahAda(daftarKasus, id)) {
            id = `${dasar}-${nomor}`;
            nomor += 1;
        }

        return id;
    }


    // Mengambil pengajuan berdasarkan ID.
    function cariPengajuan(data, id) {
        if (!id) {
            return null;
        }

        return (
            data.antrean.find(item =>
                String(item.id) === String(id)
            ) ||
            null
        );
    }


    // Mengambil data booking atau pengajuan penggeser.
    function cariPenggeser(data, id) {
        if (!id) {
            return null;
        }

        return (
            data.antrean.find(item =>
                String(item.id) === String(id)
            ) ||
            data.bookings.find(item =>
                String(item.id) === String(id)
            ) ||
            null
        );
    }


    // Mengambil kasus berdasarkan ID kasus atau ID pengajuan.
    function cariKasus(data, id) {
        if (!id) {
            return null;
        }

        return data.penggunaTergeser.find(kasus =>
            String(kasus.id) === String(id) ||
            String(kasus.pengajuanId) === String(id)
        ) || null;
    }


    // Membandingkan relasi rekomendasi dengan kasus.
    function rekomendasiTerhubung(rekomendasi, kasus) {
        const referensi = [
            rekomendasi.caseId,
            rekomendasi.kasusId,
            rekomendasi.pengajuanId,
            rekomendasi.antreanId
        ];

        return referensi.some(id =>
            id !== undefined &&
            id !== null &&
            (
                String(id) === String(kasus.id) ||
                String(id) === String(kasus.pengajuanId)
            )
        );
    }


    // Mengambil rekomendasi terbaru berdasarkan waktu pengiriman.
    function cariRekomendasiTerbaru(data, kasus) {
        const daftar = data.rekomendasi.filter(item =>
            rekomendasiTerhubung(item, kasus)
        );

        daftar.sort((a, b) => {
            const waktuA = Date.parse(
                a.dikirimPada || a.dibuatPada || ""
            ) || 0;

            const waktuB = Date.parse(
                b.dikirimPada || b.dibuatPada || ""
            ) || 0;

            return waktuB - waktuA;
        });

        return daftar[0] || null;
    }


    // Membuat kasus otomatis untuk pengajuan tergeser.
    function pastikanKasusTergeser(data, pengajuan) {
        let kasus = cariKasus(data, pengajuan.id);

        if (!kasus) {
            kasus = {
                id: buatIdKasus(
                    pengajuan.id,
                    data.penggunaTergeser
                ),

                pengajuanId: pengajuan.id,

                pengajuanPenggeserId:
                    pengajuan.pengajuanPenggeserId ?? null,

                alasan:
                    pengajuan.alasanTergeser ||
                    "Jadwal tergeser akibat pengajuan dengan prioritas lebih tinggi.",

                status: "menunggu_rekomendasi",

                dibuatPada: new Date().toISOString(),

                arsip: false
            };

            data.penggunaTergeser.push(kasus);

        } else {
            kasus.pengajuanId = pengajuan.id;

            if (
                pengajuan.pengajuanPenggeserId !== undefined
            ) {
                kasus.pengajuanPenggeserId =
                    pengajuan.pengajuanPenggeserId;
            }

            if (pengajuan.alasanTergeser) {
                kasus.alasan = pengajuan.alasanTergeser;
            }

            const status = String(
                kasus.status || ""
            ).toLowerCase();

            kasus.arsip =
                STATUS_REKOMENDASI_AKHIR.has(status);
        }

        return kasus;
    }


    // Menyamakan status kasus dengan status rekomendasi.
    function sinkronkanKasusDenganRekomendasi(data) {
        data.penggunaTergeser.forEach(kasus => {
            const pengajuan = cariPengajuan(
                data,
                kasus.pengajuanId
            );

            if (!pengajuan) {
                kasus.arsip = true;
                return;
            }

            if (
                String(pengajuan.status).toLowerCase() !==
                "tergeser"
            ) {
                kasus.arsip = true;
                return;
            }

            const rekomendasi = cariRekomendasiTerbaru(
                data,
                kasus
            );

            if (rekomendasi) {
                const status = String(
                    rekomendasi.status || ""
                ).toLowerCase();

                if (
                    STATUS_REKOMENDASI_AKTIF.has(status) ||
                    STATUS_REKOMENDASI_AKHIR.has(status)
                ) {
                    kasus.status = status;
                }

                kasus.rekomendasiId = rekomendasi.id;

                kasus.dikirimPada =
                    rekomendasi.dikirimPada ||
                    kasus.dikirimPada;

                kasus.kedaluwarsaPada =
                    rekomendasi.kedaluwarsaPada ||
                    rekomendasi.batasEditPada ||
                    kasus.kedaluwarsaPada;
            }

            kasus.arsip = STATUS_REKOMENDASI_AKHIR.has(
                String(kasus.status || "").toLowerCase()
            );
        });
    }


    // =====================================================
    // 5. NORMALISASI DATA
    // =====================================================

    function normalisasiData(data, gabungkanSeed = false) {
        const hasil = clone(data);

        KOLEKSI.forEach(koleksi => {
            if (!Array.isArray(hasil[koleksi])) {
                hasil[koleksi] = [];
            }
        });

        // Seed hanya digabung ketika inisialisasi atau reset.
        if (gabungkanSeed) {
            gabungkanDataAwal(hasil);
        }

        // Memastikan setiap pengajuan tergeser mempunyai kasus.
        hasil.antrean.forEach(pengajuan => {
            if (
                String(pengajuan.status).toLowerCase() ===
                "tergeser"
            ) {
                pastikanKasusTergeser(
                    hasil,
                    pengajuan
                );
            }
        });

        sinkronkanKasusDenganRekomendasi(hasil);

        return hasil;
    }


    // =====================================================
    // 6. PENYIMPANAN LOCALSTORAGE
    // =====================================================

    // Membaca data tersimpan.
    function bacaPenyimpanan() {
        try {
            const tersimpan =
                window.localStorage.getItem(STORAGE_KEY);

            if (!tersimpan) {
                return null;
            }

            return JSON.parse(tersimpan);

        } catch (error) {
            gunakanMemori = true;

            console.warn(
                "SILAB: LocalStorage tidak tersedia. Menggunakan penyimpanan memori.",
                error
            );

            return dataMemori;
        }
    }


    // Memberitahukan perubahan kepada modul lain.
    function beritahuPerubahan(detail = {}) {
        window.dispatchEvent(
            new CustomEvent("silab:data-changed", {
                detail: {
                    ...detail,
                    waktuPerubahan: new Date().toISOString()
                }
            })
        );
    }


    // Menyimpan seluruh data.
    function simpanPenyimpanan(data, detail = {}) {
        const salinan = clone(data);

        dataAktif = salinan;

        if (gunakanMemori) {
            dataMemori = clone(salinan);

        } else {
            try {
                window.localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify(salinan)
                );

            } catch (error) {
                gunakanMemori = true;
                dataMemori = clone(salinan);

                console.warn(
                    "SILAB: Penyimpanan gagal. Data hanya tersedia selama halaman aktif.",
                    error
                );
            }
        }

        beritahuPerubahan({
            data: clone(salinan),
            ...detail
        });
    }


    // Memuat data tersimpan atau data simulasi.
    function inisialisasi() {
        const tersimpan = bacaPenyimpanan();

        const data = strukturValid(tersimpan)
            ? normalisasiData(tersimpan, true)
            : normalisasiData(DATA_SEED, true);

        simpanPenyimpanan(data, {
            tindakan: "inisialisasi"
        });

        console.log("SILAB: Data berhasil dimuat.", {
            bookings: data.bookings.length,
            antrean: data.antrean.length,
            penggunaTergeser: data.penggunaTergeser.length,
            rekomendasi: data.rekomendasi.length
        });
    }


    // =====================================================
    // 7. FUNGSI PENGAMBILAN DATA
    // =====================================================

    function getData() {
        return clone(dataAktif);
    }


    function getAll(koleksi) {
        validasiKoleksi(koleksi);

        return clone(dataAktif[koleksi]);
    }


    function getById(koleksi, id) {
        validasiKoleksi(koleksi);

        const item = dataAktif[koleksi].find(item =>
            String(item.id) === String(id)
        );

        return item ? clone(item) : null;
    }


    // Mengambil pengajuan yang masih perlu diproses Laboran.
    function getAntreanAktif() {
        return getAll("antrean").filter(item =>
            STATUS_ANTREAN_AKTIF.has(
                String(item.status || "").toLowerCase()
            )
        );
    }


    // Menggabungkan data kasus dengan pengajuan aslinya.
    function gabungkanDetailKasus(data, kasus) {
        const pengajuan = cariPengajuan(
            data,
            kasus.pengajuanId
        );

        if (!pengajuan) {
            return null;
        }

        const hasil = {
            ...clone(pengajuan),
            ...clone(kasus)
        };

        // ID tetap menggunakan ID kasus tergeser.
        hasil.id = kasus.id;

        hasil.pengajuanId = pengajuan.id;

        hasil.statusPengajuan = pengajuan.status;

        hasil.pengajuanAsli = clone(pengajuan);

        const penggeserId =
            kasus.pengajuanPenggeserId ??
            pengajuan.pengajuanPenggeserId;

        const penggeser = cariPenggeser(
            data,
            penggeserId
        );

        hasil.namaPenggeser = penggeser
            ? (
                penggeser.namaPemohon ||
                penggeser.namaKegiatan ||
                penggeser.id
            )
            : "Informasi penggeser belum tersedia.";

        hasil.alasan =
            kasus.alasan ||
            pengajuan.alasanTergeser ||
            "Informasi alasan pergeseran belum tersedia.";

        const rekomendasi = cariRekomendasiTerbaru(
            data,
            kasus
        );

        hasil.rekomendasiTerbaru = rekomendasi
            ? clone(rekomendasi)
            : null;

        hasil.kedaluwarsaPada =
            kasus.kedaluwarsaPada ||
            rekomendasi?.kedaluwarsaPada ||
            rekomendasi?.batasEditPada ||
            null;

        return hasil;
    }


    // Mengambil kasus tergeser berdasarkan ID.
    // Bisa menggunakan ID kasus maupun ID pengajuan.
    function getKasusTergeserById(id) {
        const kasus = cariKasus(dataAktif, id);

        if (!kasus || kasus.arsip === true) {
            return null;
        }

        return gabungkanDetailKasus(
            dataAktif,
            kasus
        );
    }


    // Mengambil seluruh kasus tergeser yang masih aktif.
    function getKasusTergeserAktif() {
        return dataAktif.penggunaTergeser
            .filter(kasus => {
                const status = String(
                    kasus.status || ""
                ).toLowerCase();

                const pengajuan = cariPengajuan(
                    dataAktif,
                    kasus.pengajuanId
                );

                return (
                    kasus.arsip !== true &&
                    STATUS_REKOMENDASI_AKTIF.has(status) &&
                    pengajuan &&
                    String(pengajuan.status).toLowerCase() ===
                        "tergeser"
                );
            })
            .map(kasus =>
                gabungkanDetailKasus(dataAktif, kasus)
            )
            .filter(Boolean)
            .map(clone);
    }


    // Mengambil rekomendasi berdasarkan kasus.
    function getRekomendasiByKasusId(id) {
        const kasus = cariKasus(dataAktif, id);

        if (!kasus) {
            return null;
        }

        const rekomendasi = cariRekomendasiTerbaru(
            dataAktif,
            kasus
        );

        return rekomendasi
            ? clone(rekomendasi)
            : null;
    }


    // Mengambil data berdasarkan tanggal.
    // Data tanggal lain tetap dipertahankan.
    function getRiwayatByTanggal(koleksi, tanggal) {
        validasiKoleksi(koleksi);

        return getAll(koleksi).filter(item =>
            String(item.tanggal || "") === String(tanggal)
        );
    }


    // =====================================================
    // 8. UTILITAS WAKTU WIT
    // =====================================================

    // Mengubah datetime-local menjadi timestamp WIT.
    function parsingWIT(nilai) {
        if (typeof nilai !== "string") {
            return NaN;
        }

        const cocok = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(
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

        return hasil === `${cocok[1]}T${cocok[2]}`
            ? waktu
            : NaN;
    }


    // Mengambil timestamp jadwal dari data booking/rekomendasi.
    function parsingWaktuItem(nilai, tanggal) {
        if (!nilai) {
            return NaN;
        }

        const waktu = String(nilai);

        if (/^\d{4}-\d{2}-\d{2}T/.test(waktu)) {
            const lokal = parsingWIT(
                waktu.slice(0, 16)
            );

            if (Number.isFinite(lokal)) {
                return lokal;
            }

            // Mendukung data lama yang menyimpan ISO dengan zona waktu.
            return Date.parse(waktu);
        }

        if (
            tanggal &&
            /^\d{2}:\d{2}/.test(waktu)
        ) {
            return parsingWIT(
                `${tanggal}T${waktu.slice(0, 5)}`
            );
        }

        return NaN;
    }


    // Mengambil interval waktu sebuah data.
    function ambilInterval(item) {
        const mulai = parsingWaktuItem(
            item.waktuMulai,
            item.tanggal
        );

        const selesai = parsingWaktuItem(
            item.waktuSelesai,
            item.tanggal
        );

        if (
            !Number.isFinite(mulai) ||
            !Number.isFinite(selesai) ||
            selesai <= mulai
        ) {
            return null;
        }

        return {
            mulai,
            selesai
        };
    }


    // =====================================================
    // 9. VALIDASI BENTROK JADWAL
    // =====================================================

    function cariBentrokJadwal(
        data,
        mulai,
        selesai,
        rekomendasiDikecualikan = null
    ) {
        // Memeriksa booking yang masih aktif.
        for (const booking of data.bookings) {
            const status = String(
                booking.status || "terjadwal"
            ).toLowerCase();

            if (!STATUS_JADWAL_AKTIF.has(status)) {
                continue;
            }

            const interval = ambilInterval(booking);

            if (!interval) {
                continue;
            }

            const bentrok =
                mulai < interval.selesai &&
                selesai > interval.mulai;

            if (bentrok) {
                return {
                    jenis: "booking",
                    id: booking.id,
                    nama:
                        booking.namaKegiatan ||
                        booking.namaPemohon ||
                        booking.id
                };
            }
        }

        // Memeriksa rekomendasi yang sudah dikirim atau diterima.
        for (const rekomendasi of data.rekomendasi) {
            if (
                String(rekomendasi.id) ===
                String(rekomendasiDikecualikan)
            ) {
                continue;
            }

            const status = String(
                rekomendasi.status || ""
            ).toLowerCase();

            if (
                ![
                    "rekomendasi_dikirim",
                    "diterima"
                ].includes(status)
            ) {
                continue;
            }

            const interval = ambilInterval(rekomendasi);

            if (!interval) {
                continue;
            }

            const bentrok =
                mulai < interval.selesai &&
                selesai > interval.mulai;

            if (bentrok) {
                return {
                    jenis: "rekomendasi",
                    id: rekomendasi.id,
                    nama: rekomendasi.id
                };
            }
        }

        return null;
    }


    // =====================================================
    // 10. VALIDASI REKOMENDASI
    // =====================================================

    function validasiJadwalRekomendasi(
        kasus,
        detail,
        rekomendasiDikecualikan = null
    ) {
        if (
            !detail ||
            !detail.waktuMulai ||
            !detail.waktuSelesai
        ) {
            return {
                valid: false,
                pesan: "Waktu mulai dan selesai wajib diisi."
            };
        }

        const mulai = parsingWIT(
            detail.waktuMulai
        );

        const selesai = parsingWIT(
            detail.waktuSelesai
        );

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

        // Memeriksa kebutuhan fasilitas.
        const kebutuhanPC = Number(kasus.kebutuhanPC);
        const kebutuhanKursi = Number(kasus.kebutuhanKursi);

        if (
            !Number.isInteger(kebutuhanPC) ||
            !Number.isInteger(kebutuhanKursi) ||
            kebutuhanPC < 0 ||
            kebutuhanKursi < 0
        ) {
            return {
                valid: false,
                pesan: "Data kebutuhan PC atau kursi tidak valid."
            };
        }

        if (kebutuhanPC > KAPASITAS_PC) {
            return {
                valid: false,
                pesan: `Kebutuhan PC melebihi kapasitas laboratorium (${KAPASITAS_PC} unit).`
            };
        }

        if (kebutuhanKursi > KAPASITAS_KURSI) {
            return {
                valid: false,
                pesan: `Kebutuhan kursi melebihi kapasitas laboratorium (${KAPASITAS_KURSI} unit).`
            };
        }

        // Memeriksa bentrokan dengan jadwal aktif.
        const bentrok = cariBentrokJadwal(
            dataAktif,
            mulai,
            selesai,
            rekomendasiDikecualikan
        );

        if (bentrok) {
            return {
                valid: false,
                pesan:
                    `Jadwal bertabrakan dengan ${bentrok.nama} (${bentrok.id}). Silakan pilih waktu lain.`
            };
        }

        return {
            valid: true,
            mulai,
            selesai
        };
    }


    // =====================================================
    // 11. MENAMBAHKAN DATA
    // =====================================================

    function tambah(koleksi, item) {
        validasiKoleksi(koleksi);

        if (
            !item ||
            typeof item !== "object" ||
            Array.isArray(item) ||
            item.id === undefined ||
            item.id === null ||
            String(item.id).trim() === ""
        ) {
            throw new Error(
                "Data wajib memiliki ID yang valid."
            );
        }

        const data = clone(dataAktif);

        if (sudahAda(data[koleksi], item.id)) {
            throw new Error(
                `ID "${item.id}" sudah digunakan.`
            );
        }

        data[koleksi].push(clone(item));

        if (koleksi === "antrean") {
            if (
                String(item.status).toLowerCase() ===
                "tergeser"
            ) {
                pastikanKasusTergeser(data, item);
            }
        }

        if (koleksi === "rekomendasi") {
            sinkronkanKasusDenganRekomendasi(data);
        }

        simpanPenyimpanan(data, {
            koleksi,
            tindakan: "tambah",
            id: item.id
        });

        return clone(item);
    }


    // =====================================================
    // 12. MEMPERBARUI DATA
    // =====================================================

    function update(koleksi, id, perubahan) {
        validasiKoleksi(koleksi);

        if (
            !perubahan ||
            typeof perubahan !== "object" ||
            Array.isArray(perubahan)
        ) {
            throw new Error(
                "Perubahan data tidak valid."
            );
        }

        const data = clone(dataAktif);

        const index = data[koleksi].findIndex(item =>
            String(item.id) === String(id)
        );

        if (index === -1) {
            throw new Error(
                `Data dengan ID "${id}" tidak ditemukan.`
            );
        }

        const idAsli = data[koleksi][index].id;

        data[koleksi][index] = {
            ...data[koleksi][index],
            ...clone(perubahan),
            id: idAsli
        };

        const itemTerbaru = data[koleksi][index];

        if (koleksi === "antrean") {
            if (
                String(itemTerbaru.status).toLowerCase() ===
                "tergeser"
            ) {
                pastikanKasusTergeser(
                    data,
                    itemTerbaru
                );

            } else {
                data.penggunaTergeser.forEach(kasus => {
                    if (
                        String(kasus.pengajuanId) ===
                        String(id)
                    ) {
                        kasus.arsip = true;
                    }
                });
            }
        }

        if (koleksi === "penggunaTergeser") {
            const status = String(
                itemTerbaru.status || ""
            ).toLowerCase();

            if (STATUS_REKOMENDASI_AKHIR.has(status)) {
                itemTerbaru.arsip = true;

            } else if (
                STATUS_REKOMENDASI_AKTIF.has(status)
            ) {
                itemTerbaru.arsip = false;
            }
        }

        if (koleksi === "rekomendasi") {
            sinkronkanKasusDenganRekomendasi(data);
        }

        simpanPenyimpanan(data, {
            koleksi,
            tindakan: "update",
            id
        });

        return clone(itemTerbaru);
    }


    // =====================================================
    // 13. MENGHAPUS DATA
    // =====================================================

    function hapus(koleksi, id) {
        validasiKoleksi(koleksi);

        const data = clone(dataAktif);

        const index = data[koleksi].findIndex(item =>
            String(item.id) === String(id)
        );

        if (index === -1) {
            return false;
        }

        data[koleksi].splice(index, 1);

        // Kasus terkait tetap dipertahankan sebagai arsip.
        if (koleksi === "antrean") {
            data.penggunaTergeser.forEach(kasus => {
                if (
                    String(kasus.pengajuanId) ===
                    String(id)
                ) {
                    kasus.arsip = true;
                }
            });
        }

        if (koleksi === "penggunaTergeser") {
            data.rekomendasi = data.rekomendasi.filter(
                rekomendasi =>
                    String(rekomendasi.caseId) !== String(id) &&
                    String(rekomendasi.kasusId) !== String(id)
            );
        }

        simpanPenyimpanan(data, {
            koleksi,
            tindakan: "hapus",
            id
        });

        return true;
    }


    // =====================================================
    // 14. PENGIRIMAN REKOMENDASI
    // =====================================================

    function kirimRekomendasi(kasusId, detail) {
        const data = clone(dataAktif);

        const kasus = cariKasus(data, kasusId);

        if (!kasus || kasus.arsip === true) {
            throw new Error(
                "Kasus tergeser tidak ditemukan atau sudah diarsipkan."
            );
        }

        if (
            String(kasus.status).toLowerCase() !==
            "menunggu_rekomendasi"
        ) {
            throw new Error(
                "Kasus tidak lagi menunggu rekomendasi."
            );
        }

        const pengajuan = cariPengajuan(
            data,
            kasus.pengajuanId
        );

        if (
            !pengajuan ||
            String(pengajuan.status).toLowerCase() !==
            "tergeser"
        ) {
            throw new Error(
                "Pengajuan asli tidak tersedia atau statusnya sudah berubah."
            );
        }

        // Memastikan belum ada rekomendasi aktif.
        const rekomendasiLama = cariRekomendasiTerbaru(
            data,
            kasus
        );

        if (
            rekomendasiLama &&
            !STATUS_REKOMENDASI_AKHIR.has(
                String(rekomendasiLama.status).toLowerCase()
            )
        ) {
            throw new Error(
                "Kasus ini sudah memiliki rekomendasi aktif."
            );
        }

        const validasi = validasiJadwalRekomendasi(
            kasus,
            detail
        );

        if (!validasi.valid) {
            throw new Error(validasi.pesan);
        }

        const sekarang = new Date();

        const waktuKirim = sekarang.toISOString();

        const kedaluwarsa = new Date(
            sekarang.getTime() + BATAS_EDIT
        ).toISOString();

        const rekomendasi = {
            id: `REC-${kasus.id}-${Date.now()}`,

            caseId: kasus.id,
            kasusId: kasus.id,

            pengajuanId: pengajuan.id,
            antreanId: pengajuan.id,

            tanggal: detail.waktuMulai.slice(0, 10),

            waktuMulai: detail.waktuMulai,
            waktuSelesai: detail.waktuSelesai,

            catatan: String(
                detail.catatan || ""
            ).trim(),

            status: "rekomendasi_dikirim",

            dibuatPada: waktuKirim,
            dikirimPada: waktuKirim,
            diperbaruiPada: waktuKirim,

            kedaluwarsaPada: kedaluwarsa,
            batasEditPada: kedaluwarsa
        };

        data.rekomendasi.push(rekomendasi);

        // Memperbarui status kasus.
        kasus.status = "rekomendasi_dikirim";

        kasus.rekomendasiId = rekomendasi.id;

        kasus.dikirimPada = waktuKirim;

        kasus.kedaluwarsaPada = kedaluwarsa;

        kasus.diperbaruiPada = waktuKirim;

        kasus.arsip = false;

        simpanPenyimpanan(data, {
            koleksi: "rekomendasi",
            tindakan: "kirim",
            id: rekomendasi.id,
            kasusId: kasus.id
        });

        return getKasusTergeserById(kasus.id);
    }


    // =====================================================
    // 15. PENGEDITAN REKOMENDASI
    // =====================================================

    function editRekomendasi(kasusId, detail) {
        const data = clone(dataAktif);

        const kasus = cariKasus(data, kasusId);

        if (!kasus || kasus.arsip === true) {
            throw new Error(
                "Kasus tergeser tidak ditemukan."
            );
        }

        if (
            String(kasus.status).toLowerCase() !==
            "rekomendasi_dikirim"
        ) {
            throw new Error(
                "Status kasus tidak memungkinkan pengeditan."
            );
        }

        const rekomendasi = cariRekomendasiTerbaru(
            data,
            kasus
        );

        if (
            !rekomendasi ||
            String(rekomendasi.status).toLowerCase() !==
            "rekomendasi_dikirim"
        ) {
            throw new Error(
                "Rekomendasi aktif tidak ditemukan."
            );
        }

        // Batas edit dihitung dari pengiriman pertama.
        const waktuKirim = Date.parse(
            rekomendasi.dikirimPada ||
            kasus.dikirimPada ||
            ""
        );

        const batasEdit = Date.parse(
            rekomendasi.kedaluwarsaPada ||
            rekomendasi.batasEditPada ||
            kasus.kedaluwarsaPada ||
            ""
        );

        if (
            !Number.isFinite(waktuKirim) ||
            !Number.isFinite(batasEdit) ||
            Date.now() < waktuKirim ||
            Date.now() >= batasEdit
        ) {
            throw new Error(
                "Batas pengeditan rekomendasi selama 24 jam telah berakhir."
            );
        }

        const validasi = validasiJadwalRekomendasi(
            kasus,
            detail,
            rekomendasi.id
        );

        if (!validasi.valid) {
            throw new Error(validasi.pesan);
        }

        const sekarang = new Date().toISOString();

        // Memperbarui rekomendasi yang sama.
        rekomendasi.tanggal =
            detail.waktuMulai.slice(0, 10);

        rekomendasi.waktuMulai =
            detail.waktuMulai;

        rekomendasi.waktuSelesai =
            detail.waktuSelesai;

        rekomendasi.catatan = String(
            detail.catatan || ""
        ).trim();

        rekomendasi.diperbaruiPada = sekarang;

        // dikirimPada dan kedaluwarsaPada tidak berubah.
        kasus.diperbaruiPada = sekarang;

        kasus.kedaluwarsaPada = new Date(
            batasEdit
        ).toISOString();

        simpanPenyimpanan(data, {
            koleksi: "rekomendasi",
            tindakan: "edit",
            id: rekomendasi.id,
            kasusId: kasus.id
        });

        return getKasusTergeserById(kasus.id);
    }


    // =====================================================
    // 16. PEMBATALAN REKOMENDASI
    // =====================================================

    function batalkanRekomendasi(kasusId) {
        const data = clone(dataAktif);

        const kasus = cariKasus(data, kasusId);

        if (!kasus) {
            throw new Error(
                "Kasus tergeser tidak ditemukan."
            );
        }

        const rekomendasi = cariRekomendasiTerbaru(
            data,
            kasus
        );

        if (
            !rekomendasi ||
            String(rekomendasi.status).toLowerCase() !==
            "rekomendasi_dikirim"
        ) {
            throw new Error(
                "Tidak ada rekomendasi aktif yang dapat dibatalkan."
            );
        }

        const batasEdit = Date.parse(
            rekomendasi.kedaluwarsaPada ||
            rekomendasi.batasEditPada ||
            ""
        );

        if (
            !Number.isFinite(batasEdit) ||
            Date.now() >= batasEdit
        ) {
            throw new Error(
                "Batas pembatalan rekomendasi selama 24 jam telah berakhir."
            );
        }

        const sekarang = new Date().toISOString();

        rekomendasi.status = "dibatalkan";

        rekomendasi.dibatalkanPada = sekarang;

        rekomendasi.diperbaruiPada = sekarang;

        kasus.status = "dibatalkan";

        kasus.dibatalkanPada = sekarang;

        kasus.arsip = true;

        simpanPenyimpanan(data, {
            koleksi: "rekomendasi",
            tindakan: "batalkan",
            id: rekomendasi.id,
            kasusId: kasus.id
        });

        return getById(
            "penggunaTergeser",
            kasus.id
        );
    }


    // =====================================================
    // 17. VALIDASI BATAS EDIT 24 JAM
    // =====================================================

    function masihDalamWaktuEdit(waktuKirim) {
        if (!waktuKirim) {
            return false;
        }

        const waktu = Date.parse(waktuKirim);

        if (!Number.isFinite(waktu)) {
            return false;
        }

        const selisih = Date.now() - waktu;

        return (
            selisih >= 0 &&
            selisih < BATAS_EDIT
        );
    }


    // =====================================================
    // 18. VALIDASI PRESENSI
    // =====================================================

    function updatePresensi(bookingId, status) {
        const statusValid = [
            "digunakan",
            "tidak_digunakan"
        ];

        if (!statusValid.includes(status)) {
            throw new Error(
                "Status presensi tidak valid."
            );
        }

        return update("bookings", bookingId, {
            presensi: {
                status,
                waktuValidasi: new Date().toISOString()
            }
        });
    }


    // =====================================================
    // 19. RESET DATA SIMULASI
    // =====================================================

    function reset() {
        const data = normalisasiData(
            DATA_SEED,
            true
        );

        simpanPenyimpanan(data, {
            tindakan: "reset"
        });

        return clone(data);
    }


    // =====================================================
    // 20. SINKRONISASI ANTARTAB
    // =====================================================

    window.addEventListener(
        "storage",
        function (event) {
            if (
                event.key !== STORAGE_KEY ||
                gunakanMemori
            ) {
                return;
            }

            if (event.newValue === null) {
                console.warn(
                    "SILAB: Penyimpanan dihapus dari tab lain."
                );

                return;
            }

            try {
                const dataBaru = JSON.parse(
                    event.newValue
                );

                if (!strukturValid(dataBaru)) {
                    return;
                }

                dataAktif = normalisasiData(
                    dataBaru,
                    false
                );

                beritahuPerubahan({
                    data: clone(dataAktif),
                    external: true,
                    tindakan: "sinkronisasi"
                });

            } catch (error) {
                console.error(
                    "SILAB: Gagal membaca perubahan penyimpanan.",
                    error
                );
            }
        }
    );


    // =====================================================
    // 21. INISIALISASI LAYANAN
    // =====================================================

    inisialisasi();


// =====================================================
// MENGAMBIL DATA KASUS UNTUK HALAMAN REKOMENDASI
// =====================================================

function getRekomendasiAktif() {

    // Mengambil seluruh kasus tergeser yang masih aktif.
    const daftarKasus = getKasusTergeserAktif();

    return daftarKasus.map(kasus => {

        // Mengambil pengajuan asli berdasarkan relasinya.
        const pengajuan = getById(
            "antrean",
            kasus.pengajuanId
        );

        // Mengabaikan kasus yang tidak memiliki pengajuan.
        if (!pengajuan) {
            return null;
        }

        // Mengambil riwayat rekomendasi berdasarkan ID kasus.
        const riwayat = getRekomendasiByKasusId(
            kasus.id
        );

        // Mendukung hasil berupa array maupun satu objek.
        const daftarRekomendasi = Array.isArray(riwayat)
            ? riwayat
            : riwayat
                ? [riwayat]
                : [];

        // Mengambil rekomendasi terakhir jika tersedia.
        const rekomendasiTerbaru =
            kasus.rekomendasiTerbaru ||
            daftarRekomendasi[
                daftarRekomendasi.length - 1
            ] ||
            null;

        // Menggabungkan data pengajuan dan kasus.
        return {
            ...pengajuan,
            ...kasus,

            // ID kasus tetap digunakan untuk aksi Laboran.
            id: kasus.id,

            // Mempertahankan relasi pengajuan asli.
            pengajuanId: pengajuan.id,
            pengajuan: pengajuan,

            // Menyertakan rekomendasi terakhir.
            rekomendasiTerbaru
        };
    }).filter(Boolean);
}



    // =====================================================
    // 22. PUBLIKASI FUNGSI UNTUK SELURUH MODUL
    // =====================================================

    window.SILABService = Object.freeze({

        // Pengambilan data.
        getData,
        getAll,
        getById,
        getAntreanAktif,
        getKasusTergeserAktif,
        getKasusTergeserById,
        getRekomendasiByKasusId,
        getRekomendasiAktif,
        getRiwayatByTanggal,

        // Pengelolaan data.
        tambah,
        update,
        hapus,
        reset,

        // Presensi.
        updatePresensi,

        // Rekomendasi.
        kirimRekomendasi,
        editRekomendasi,
        batalkanRekomendasi,

        // Validasi.
        validasiJadwalRekomendasi,
        masihDalamWaktuEdit
    });


    console.log(
        "SILAB: Layanan data berhasil dimuat."
    );

})(window);
