
/**
 * LAYANAN DATA SILAB — LABORAN
 *
 * Mengelola:
 * 1. Penyimpanan data simulasi.
 * 2. Pengelolaan antrean pengajuan.
 * 3. Pengelolaan kasus pengguna tergeser.
 * 4. Pengiriman rekomendasi jadwal.
 * 5. Pengeditan rekomendasi dalam batas 24 jam.
 * 6. Pembatalan rekomendasi.
 * 7. Penyimpanan riwayat perubahan.
 * 8. Pemeriksaan kedaluwarsa rekomendasi.
 *
 * Penyimpanan sementara menggunakan localStorage.
 * Integrasi database PHP dilakukan pada tahap backend.
 */

(function (window) {
    "use strict";

    // =====================================================
    // 1. KONFIGURASI UTAMA
    // =====================================================

    const DATA_SEED = window.SILAB_DATA_SEED;
    const STORAGE_KEY = "silab_laboran_v1";

    if (!DATA_SEED) {
        console.error(
            "SILAB: muat data_uji.js sebelum layanan.js."
        );
        return;
    }

    const KOLEKSI = Object.keys(DATA_SEED);

    // Status yang tampil pada antrean.
    const ANTREAN_AKTIF = new Set([
        "verifikasi",
        "bentrok"
    ]);

    // Status yang tampil pada rekomendasi.
    const REKOMENDASI_AKTIF = new Set([
        "menunggu_rekomendasi",
        "rekomendasi_dikirim"
    ]);

    // Status akhir rekomendasi.
    const REKOMENDASI_AKHIR = new Set([
        "diterima",
        "ditolak",
        "kedaluwarsa"
    ]);

    // Konfigurasi laboratorium.
    // Sesuaikan dengan kapasitas dan jam operasional resmi.
    const KAPASITAS_PC = 36;
    const KAPASITAS_KURSI = 36;

    const JAM_BUKA = "07:30";
    const JAM_TUTUP = "18:00";

    // Batas respons pengguna: 24 jam.
    const BATAS_RESPONS_MS = 24 * 60 * 60 * 1000;

    let dataAktif = null;
    let dataMemori = null;
    let gunakanMemori = false;


    // =====================================================
    // 2. UTILITAS DATA
    // =====================================================

    // Membuat salinan agar data asli tidak berubah.
    function salin(data) {
        return JSON.parse(JSON.stringify(data));
    }

    // Menyeragamkan penulisan status.
    function statusNormal(status) {
        const nilai = String(status || "").toLowerCase();

        return ({
            rekomendasi_terkirim: "rekomendasi_dikirim",
            menunggu_konfirmasi: "rekomendasi_dikirim"
        })[nilai] || nilai;
    }

    // Memastikan koleksi tersedia.
    function validasiKoleksi(nama) {
        if (!Object.prototype.hasOwnProperty.call(DATA_SEED, nama)) {
            throw new Error(
                `Koleksi "${nama}" tidak ditemukan.`
            );
        }
    }

    // Memeriksa struktur penyimpanan.
    function strukturValid(data) {
        return (
            data &&
            typeof data === "object" &&
            !Array.isArray(data) &&
            KOLEKSI.every(
                nama => Array.isArray(data[nama])
            )
        );
    }

    // Mencari kasus berdasarkan ID kasus atau ID pengajuan.
    function cariKasus(data, id) {
        return data.penggunaTergeser.find(kasus =>
            String(kasus.id) === String(id) ||
            String(kasus.pengajuanId) === String(id)
        );
    }

    // Mengambil rekomendasi terbaru milik suatu kasus.
    function cariTerbaru(data, kasus) {
        const daftar = data.rekomendasi.filter(rec =>
            [
                rec.caseId,
                rec.kasusId,
                rec.antreanId,
                rec.pengajuanId,
                rec.idPengajuan
            ].some(id =>
                id !== undefined &&
                id !== null &&
                (
                    String(id) === String(kasus.id) ||
                    String(id) === String(kasus.pengajuanId)
                )
            )
        );

        return daftar[daftar.length - 1] || null;
    }

    // Membuat kasus tergeser jika belum tersedia.
    function pastikanKasus(data, pengajuan) {
        let kasus = data.penggunaTergeser.find(
            item =>
                String(item.pengajuanId) === String(pengajuan.id)
        );

        if (!kasus) {
            let id = `CASE-${pengajuan.id}`;
            let urutan = 2;

            while (
                data.penggunaTergeser.some(
                    item => item.id === id
                )
            ) {
                id = `CASE-${pengajuan.id}-${urutan++}`;
            }

            kasus = {
                id,
                pengajuanId: pengajuan.id,

                pengajuanPenggeserId:
                    pengajuan.pengajuanPenggeserId ?? null,

                alasan:
                    pengajuan.alasanTergeser ||
                    "Jadwal asal tergeser.",

                status: "menunggu_rekomendasi",
                dibuatPada: new Date().toISOString(),
                arsip: false
            };

            data.penggunaTergeser.push(kasus);
        }

        return kasus;
    }


    // =====================================================
    // 3. NORMALISASI DATA LAMA
    // =====================================================

    function normalisasi(data) {
        const hasil = salin(data);

        // Memastikan semua koleksi tersedia.
        KOLEKSI.forEach(nama => {
            if (!Array.isArray(hasil[nama])) {
                hasil[nama] = salin(DATA_SEED[nama]);
            }
        });

        // Menyeragamkan status antrean.
        hasil.antrean.forEach(item => {
            item.status = statusNormal(item.status);
        });

        // Menyeragamkan status rekomendasi.
        hasil.rekomendasi.forEach(item => {
            item.status = statusNormal(item.status);
        });

        // Memeriksa hubungan kasus dengan pengajuan.
        hasil.penggunaTergeser.forEach(kasus => {
        kasus.status = statusNormal(kasus.status);

        // Menyesuaikan status lama dengan standar terbaru.
        if (kasus.status === "tergeser") {
            kasus.status = "menunggu_rekomendasi";
        }

            const terhubung = hasil.antrean.some(
                pengajuan =>
                    String(pengajuan.id) ===
                    String(kasus.pengajuanId)
            );

            kasus.arsip = Boolean(kasus.arsip) || !terhubung;
        });

        // Membuat kasus untuk pengajuan tergeser.
        hasil.antrean.forEach(pengajuan => {
            if (
                ["tergeser", "rekomendasi_dikirim"]
                    .includes(pengajuan.status)
            ) {
                const kasus = pastikanKasus(
                    hasil,
                    pengajuan
                );

                if (
                    pengajuan.status === "rekomendasi_dikirim" &&
                    kasus.status === "menunggu_rekomendasi"
                ) {
                    kasus.status = "rekomendasi_dikirim";
                }
            }
        });

        // Menyinkronkan informasi rekomendasi terbaru.
        hasil.penggunaTergeser.forEach(kasus => {
            const terbaru = cariTerbaru(hasil, kasus);

            if (
                terbaru &&
                kasus.status === "menunggu_rekomendasi" &&
                statusNormal(terbaru.status) === "rekomendasi_dikirim"
            ) {
                kasus.status = "rekomendasi_dikirim";
                kasus.rekomendasiId = terbaru.id;
            }

            if (
                terbaru &&
                kasus.status === "rekomendasi_dikirim"
            ) {
                kasus.rekomendasiId = terbaru.id;

                kasus.dikirimPada ||=
                    terbaru.dikirimPada ||
                    terbaru.dibuatPada ||
                    null;

                kasus.kedaluwarsaPada ||=
                    terbaru.kedaluwarsaPada ||
                    terbaru.expiresAt ||
                    terbaru.batasRespons ||
                    null;
            }
        });

        return hasil;
    }


    // =====================================================
    // 4. PENYIMPANAN DATA
    // =====================================================

    // Memberitahukan modul lain ketika data berubah.
    function beritahu(external = false) {
        window.dispatchEvent(
            new CustomEvent("silab:data-changed", {
                detail: {
                    data: salin(dataAktif),
                    external
                }
            })
        );
    }

    // Menyimpan perubahan ke localStorage.
    function simpan(data, external = false) {
        const berikut = normalisasi(data);

        if (!external && !gunakanMemori) {
            try {
                window.localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify(berikut)
                );

            } catch (error) {
                gunakanMemori = true;

                console.warn(
                    "SILAB: localStorage tidak dapat digunakan; beralih ke memori.",
                    error
                );
            }
        }

        dataAktif = berikut;

        if (gunakanMemori) {
            dataMemori = salin(berikut);
        }

        beritahu(external);
    }

    // Membaca data dari localStorage.
    function baca() {
        try {
            const mentah =
                window.localStorage.getItem(STORAGE_KEY);

            return mentah ? JSON.parse(mentah) : null;

        } catch (error) {
            gunakanMemori = true;

            console.warn(
                "SILAB: tidak dapat membaca localStorage.",
                error
            );

            return dataMemori;
        }
    }


    // =====================================================
    // 5. PEMERIKSAAN KEDALUWARSA
    // =====================================================

    // Mengakhiri rekomendasi ketika batas 24 jam terlampaui.
    function periksaKedaluwarsa() {
        const perubahan = salin(dataAktif);
        let berubah = false;

        const sekarang = Date.now();

        for (const kasus of perubahan.penggunaTergeser) {
            if (
                statusNormal(kasus.status) !==
                "rekomendasi_dikirim"
            ) {
                continue;
            }

            const rec = cariTerbaru(perubahan, kasus);

            const batas =
                kasus.kedaluwarsaPada ||
                rec?.kedaluwarsaPada ||
                rec?.expiresAt ||
                rec?.batasRespons;

            const nilai = Date.parse(batas || "");

            if (
                Number.isFinite(nilai) &&
                sekarang >= nilai
            ) {
                kasus.status = "kedaluwarsa";
                kasus.diperbaruiPada =
                    new Date().toISOString();

                if (rec) {
                    rec.status = "kedaluwarsa";
                    rec.diperbaruiPada =
                        kasus.diperbaruiPada;
                }

                berubah = true;
            }
        }

        if (berubah) {
            simpan(perubahan);
        }
    }


    // =====================================================
    // 6. INISIALISASI DATA
    // =====================================================

    function inisialisasi() {
        const tersimpan = baca();

        const data = normalisasi(
            strukturValid(tersimpan)
                ? tersimpan
                : DATA_SEED
        );

        dataAktif = data;

        if (
            !strukturValid(tersimpan) ||
            JSON.stringify(tersimpan) !== JSON.stringify(data)
        ) {
            simpan(data);
        }

        periksaKedaluwarsa();
    }

    function bacaAktif(fungsi) {
        periksaKedaluwarsa();
        return fungsi();
    }


    // =====================================================
    // 7. FUNGSI PENGAMBILAN DATA
    // =====================================================

    function getData() {
        return bacaAktif(() => salin(dataAktif));
    }

    function getAll(koleksi) {
        validasiKoleksi(koleksi);

        return bacaAktif(
            () => salin(dataAktif[koleksi])
        );
    }

    function getById(koleksi, id) {
        validasiKoleksi(koleksi);

        return bacaAktif(() => {
            const item = dataAktif[koleksi].find(
                data => String(data.id) === String(id)
            );

            return item ? salin(item) : null;
        });
    }

    // Antrean hanya menampilkan verifikasi dan bentrok.
    function getAntreanAktif() {
        return bacaAktif(() =>
            salin(
                dataAktif.antrean.filter(item =>
                    ANTREAN_AKTIF.has(
                        statusNormal(item.status)
                    )
                )
            )
        );
    }

    // Mengambil data pengajuan penggeser.
    function getPengajuanPenggeser(id) {
        return bacaAktif(() => {
            const item =
                dataAktif.antrean.find(
                    data => String(data.id) === String(id)
                ) ||
                dataAktif.bookings.find(
                    data => String(data.id) === String(id)
                );

            return item ? salin(item) : null;
        });
    }


    // =====================================================
    // 8. PENGAMBILAN DATA KASUS TERGESER
    // =====================================================

    function bentukKasus(data, kasus) {
        const asal = data.antrean.find(
            item =>
                String(item.id) === String(kasus.pengajuanId)
        );

        if (!asal) return null;

        const terbaru = cariTerbaru(data, kasus);

        const penggeser =
            data.antrean.find(
                item =>
                    String(item.id) ===
                    String(kasus.pengajuanPenggeserId)
            ) ||
            data.bookings.find(
                item =>
                    String(item.id) ===
                    String(kasus.pengajuanPenggeserId)
            ) ||
            null;

        return {
            ...salin(asal),
            ...salin(kasus),

            id: kasus.id,
            kasusId: kasus.id,
            pengajuanId: asal.id,

            status: statusNormal(kasus.status),
            statusPengajuan: statusNormal(asal.status),

            pengajuanAsal: salin(asal),

            pengajuanPenggeser:
                penggeser ? salin(penggeser) : null,

            namaPenggeser:
                penggeser?.namaPemohon ||
                penggeser?.dosen ||
                null,

            rekomendasiTerbaru:
                terbaru ? salin(terbaru) : null
        };
    }

    function getKasusTergeser() {
        return bacaAktif(() =>
            dataAktif.penggunaTergeser
                .filter(kasus =>
                    !kasus.arsip &&
                    kasus.pengajuanId
                )
                .map(kasus =>
                    bentukKasus(dataAktif, kasus)
                )
                .filter(Boolean)
        );
    }

    function getKasusTergeserById(id) {
        return bacaAktif(() => {
            const kasus = cariKasus(dataAktif, id);

            return kasus && !kasus.arsip
                ? bentukKasus(dataAktif, kasus)
                : null;
        });
    }

    // Daftar aktif rekomendasi.
    function getRekomendasiAktif() {
        return getKasusTergeser().filter(kasus =>
            REKOMENDASI_AKTIF.has(
                statusNormal(kasus.status)
            )
        );
    }

    function getKasusPerluRekomendasi() {
        return getRekomendasiAktif();
    }

    // Riwayat status akhir.
    function getRiwayatRekomendasi() {
        return getKasusTergeser().filter(kasus =>
            REKOMENDASI_AKHIR.has(
                statusNormal(kasus.status)
            )
        );
    }


    // =====================================================
    // 9. CRUD DATA UMUM
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
                "Data wajib mempunyai ID yang valid."
            );
        }

        const data = getData();

        if (
            data[koleksi].some(
                existing =>
                    String(existing.id) === String(item.id)
            )
        ) {
            throw new Error(
                `ID "${item.id}" sudah digunakan.`
            );
        }

        data[koleksi].push(salin(item));

        simpan(data);

        return salin(item);
    }

    function update(koleksi, id, perubahan) {
        validasiKoleksi(koleksi);

        if (
            !perubahan ||
            typeof perubahan !== "object" ||
            Array.isArray(perubahan)
        ) {
            throw new Error("Perubahan data tidak valid.");
        }

        const data = getData();

        const index = data[koleksi].findIndex(
            item => String(item.id) === String(id)
        );

        if (index < 0) {
            throw new Error(
                `Data "${id}" tidak ditemukan.`
            );
        }

        const asli = data[koleksi][index];

        data[koleksi][index] = {
            ...asli,
            ...salin(perubahan),
            id: asli.id
        };

        if (
            koleksi === "antrean" &&
            data[koleksi][index].status === "tergeser"
        ) {
            pastikanKasus(data, data[koleksi][index]);
        }

        simpan(data);

        return salin(data[koleksi][index]);
    }

    function hapus(koleksi, id) {
        validasiKoleksi(koleksi);

        const data = getData();

        if (
            koleksi === "antrean" &&
            data.penggunaTergeser.some(
                kasus =>
                    String(kasus.pengajuanId) === String(id)
            )
        ) {
            throw new Error(
                "Pengajuan memiliki riwayat kasus dan tidak boleh dihapus."
            );
        }

        const jumlahAwal = data[koleksi].length;

        data[koleksi] = data[koleksi].filter(
            item => String(item.id) !== String(id)
        );

        if (jumlahAwal === data[koleksi].length) {
            return false;
        }

        simpan(data);

        return true;
    }

    function reset() {
        simpan(DATA_SEED);
        return getData();
    }

    function updatePresensi(bookingId, status) {
        if (
            !["digunakan", "tidak_digunakan"].includes(status)
        ) {
            throw new Error("Status presensi tidak valid.");
        }

        return update("bookings", bookingId, {
            presensi: {
                status,
                waktuValidasi: new Date().toISOString()
            }
        });
    }


    // =====================================================
    // 10. PENGELOLAAN KASUS TERGESER
    // =====================================================

    function tandaiTergeser(id, detail = {}) {
        const data = getData();

        const asal = data.antrean.find(
            item => String(item.id) === String(id)
        );

        if (!asal) {
            throw new Error("Pengajuan tidak ditemukan.");
        }

        const penggeser =
            detail.pengajuanPenggeserId ??
            asal.pengajuanPenggeserId ??
            null;

        if (
            penggeser &&
            ![...data.antrean, ...data.bookings].some(
                item => String(item.id) === String(penggeser)
            )
        ) {
            throw new Error(
                "Data pengajuan penggeser tidak ditemukan."
            );
        }

        asal.status = "tergeser";
        asal.pengajuanPenggeserId = penggeser;

        asal.alasanTergeser =
            detail.alasan ||
            asal.alasanTergeser ||
            "Jadwal asal tergeser.";

        asal.waktuTergeser =
            new Date().toISOString();

        const kasus = pastikanKasus(data, asal);

        simpan(data);

        return getKasusTergeserById(kasus.id);
    }


    // =====================================================
    // 11. UTILITAS WAKTU WIT
    // =====================================================

    // Memproses datetime-local sebagai waktu WIT (UTC+09).
    function parsingWaktuWIT(nilai) {
        if (typeof nilai !== "string") {
            return NaN;
        }

        const cocok =
            /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/
                .exec(nilai);

        if (cocok) {
            const tanggal = cocok[1];
            const jam = cocok[2];

            const iso =
                `${tanggal}T${jam}:00+09:00`;

            const waktu = Date.parse(iso);

            if (!Number.isFinite(waktu)) {
                return NaN;
            }

            const hasil =
                new Date(waktu).toISOString();

            const balik = new Date(
                Date.parse(hasil) + 9 * 3600000
            ).toISOString().slice(0, 16);

            return balik === `${tanggal}T${jam}`
                ? waktu
                : NaN;
        }

        if (!/(Z|[+-]\d{2}:\d{2})$/i.test(nilai)) {
            return NaN;
        }

        return Date.parse(nilai);
    }

    function waktuInputWIT(nilai) {
        const angka = parsingWaktuWIT(nilai);

        if (!Number.isFinite(angka)) {
            return null;
        }

        return new Date(
            angka + 9 * 3600000
        ).toISOString().slice(0, 16);
    }

    function rentang(data) {
        const mulai =
            data.waktuMulai || data.waktu_mulai;

        const selesai =
            data.waktuSelesai || data.waktu_selesai;

        return {
            awal: parsingWaktuWIT(mulai),
            akhir: parsingWaktuWIT(selesai)
        };
    }

    function tumpangTindih(a, b) {
        return (
            a.awal < b.akhir &&
            b.awal < a.akhir
        );
    }


    // =====================================================
    // 12. VALIDASI JADWAL REKOMENDASI
    // =====================================================

    function validasiJadwal(
        data,
        pengajuan,
        detail,
        rekomendasiSendiriId = null
    ) {
        const hasil = rentang(detail);

        if (
            !Number.isFinite(hasil.awal) ||
            !Number.isFinite(hasil.akhir)
        ) {
            throw new Error(
                "Tanggal dan jam rekomendasi tidak valid."
            );
        }

        if (hasil.akhir <= hasil.awal) {
            throw new Error(
                "Waktu selesai harus lebih besar dari waktu mulai."
            );
        }

        if (hasil.awal <= Date.now()) {
            throw new Error(
                "Jadwal rekomendasi harus berada di masa mendatang."
            );
        }

        const mulaiWIT = waktuInputWIT(
            detail.waktuMulai || detail.waktu_mulai
        );

        const selesaiWIT = waktuInputWIT(
            detail.waktuSelesai || detail.waktu_selesai
        );

        if (
            !mulaiWIT ||
            !selesaiWIT ||
            mulaiWIT.slice(0, 10) !== selesaiWIT.slice(0, 10) ||
            mulaiWIT.slice(11) < JAM_BUKA ||
            selesaiWIT.slice(11) > JAM_TUTUP
        ) {
            throw new Error(
                `Jadwal harus pada satu tanggal, pukul ${JAM_BUKA}–${JAM_TUTUP} WIT.`
            );
        }

        const pc = Number(pengajuan.kebutuhanPC);
        const kursi = Number(pengajuan.kebutuhanKursi);

        if (
            ![pc, kursi].every(
                nilai =>
                    Number.isInteger(nilai) &&
                    nilai >= 0
            ) ||
            pc > KAPASITAS_PC ||
            kursi > KAPASITAS_KURSI
        ) {
            throw new Error(
                "Kebutuhan melebihi kapasitas laboratorium atau tidak valid."
            );
        }

        // Memeriksa bentrok dengan jadwal peminjaman.
        for (const booking of data.bookings) {
            if (
                [
                    "dibatalkan",
                    "tergeser",
                    "ditolak"
                ].includes(statusNormal(booking.status)) ||
                booking.presensi?.status === "tidak_digunakan"
            ) {
                continue;
            }

            if (
                !booking.tanggal ||
                !booking.waktuMulai ||
                !booking.waktuSelesai
            ) {
                continue;
            }

            const sibuk = rentang({
                waktuMulai:
                    `${booking.tanggal}T${booking.waktuMulai}`,
                waktuSelesai:
                    `${booking.tanggal}T${booking.waktuSelesai}`
            });

            if (tumpangTindih(hasil, sibuk)) {
                throw new Error(
                    `Jadwal bentrok dengan peminjaman ${booking.id}.`
                );
            }
        }

        // Memeriksa bentrok dengan rekomendasi lain yang aktif.
        for (const rec of data.rekomendasi) {
            if (
                rec.id === rekomendasiSendiriId ||
                statusNormal(rec.status) !== "rekomendasi_dikirim"
            ) {
                continue;
            }

            const sibuk = rentang(rec);

            if (
                Number.isFinite(sibuk.awal) &&
                Number.isFinite(sibuk.akhir) &&
                tumpangTindih(hasil, sibuk)
            ) {
                throw new Error(
                    `Jadwal bentrok dengan rekomendasi ${rec.id}.`
                );
            }
        }

        return {
            awal: hasil.awal,
            akhir: hasil.akhir
        };
    }


    // =====================================================
    // 13. VALIDASI STATUS KASUS
    // =====================================================

    function validasiKasusBelumDirespons(
        data,
        id,
        status
    ) {
        const kasus = cariKasus(data, id);

        if (!kasus || kasus.arsip) {
            throw new Error(
                "Kasus tergeser tidak ditemukan."
            );
        }

        if (statusNormal(kasus.status) !== status) {
            throw new Error(
                `Rekomendasi tidak dapat diproses; status bukan ${status}.`
            );
        }

        return kasus;
    }

    function buatIdRekomendasi(data) {
        const dasar = `REK-${Date.now()}`;

        let id = dasar;
        let nomor = 2;

        while (
            data.rekomendasi.some(
                rec => rec.id === id
            )
        ) {
            id = `${dasar}-${nomor++}`;
        }

        return id;
    }


    // =====================================================
    // 14. MENGIRIM REKOMENDASI
    // =====================================================

    function kirimRekomendasi(id, detail = {}) {
        const data = getData();

        const kasus = validasiKasusBelumDirespons(
            data,
            id,
            "menunggu_rekomendasi"
        );

        const asal = data.antrean.find(
            item =>
                String(item.id) === String(kasus.pengajuanId)
        );

        if (!asal) {
            throw new Error(
                "Pengajuan asal tidak ditemukan."
            );
        }

        validasiJadwal(data, asal, detail);

        const dikirim = new Date();

        const akhir = new Date(
            dikirim.getTime() + BATAS_RESPONS_MS
        );

        const rec = {
            id: buatIdRekomendasi(data),

            caseId: kasus.id,
            kasusId: kasus.id,

            pengajuanId: asal.id,
            antreanId: asal.id,

            waktuMulai:
                detail.waktuMulai || detail.waktu_mulai,

            waktuSelesai:
                detail.waktuSelesai || detail.waktu_selesai,

            catatan: String(
                detail.catatan || ""
            ).trim(),

            status: "rekomendasi_dikirim",

            dibuatPada: dikirim.toISOString(),
            dikirimPada: dikirim.toISOString(),

            kedaluwarsaPada: akhir.toISOString(),

            riwayatPerubahan: []
        };

        data.rekomendasi.push(rec);

        Object.assign(kasus, {
            status: "rekomendasi_dikirim",
            rekomendasiId: rec.id,
            dikirimPada: rec.dikirimPada,
            kedaluwarsaPada: rec.kedaluwarsaPada
        });

        simpan(data);

        return getKasusTergeserById(kasus.id);
    }


    // =====================================================
    // 15. EDIT REKOMENDASI DALAM BATAS 24 JAM
    // =====================================================

    function editRekomendasi(id, detail = {}) {
        const data = getData();

        const kasus = validasiKasusBelumDirespons(
            data,
            id,
            "rekomendasi_dikirim"
        );

        const rec = cariTerbaru(data, kasus);

        if (
            !rec ||
            statusNormal(rec.status) !== "rekomendasi_dikirim"
        ) {
            throw new Error(
                "Rekomendasi tidak dapat diedit karena sudah tidak aktif."
            );
        }

        const batas = Date.parse(
            kasus.kedaluwarsaPada ||
            rec.kedaluwarsaPada ||
            ""
        );

        if (
            !Number.isFinite(batas) ||
            Date.now() >= batas
        ) {
            throw new Error(
                "Rekomendasi tidak dapat diedit karena batas 24 jam telah berakhir."
            );
        }

        const asal = data.antrean.find(
            item =>
                String(item.id) === String(kasus.pengajuanId)
        );

        if (!asal) {
            throw new Error(
                "Pengajuan asal tidak ditemukan."
            );
        }

        const perubahan = {
            waktuMulai:
                detail.waktuMulai || detail.waktu_mulai,

            waktuSelesai:
                detail.waktuSelesai || detail.waktu_selesai,

            catatan: String(
                detail.catatan ?? rec.catatan ?? ""
            ).trim()
        };

        // Memeriksa ulang bentrok dan kapasitas.
        validasiJadwal(
            data,
            asal,
            perubahan,
            rec.id
        );

        // Menyimpan kondisi rekomendasi sebelum diedit.
        rec.riwayatPerubahan ||= [];

        rec.riwayatPerubahan.push({
            waktuMulai: rec.waktuMulai,
            waktuSelesai: rec.waktuSelesai,
            catatan: rec.catatan,
            digantiPada: new Date().toISOString()
        });

        Object.assign(rec, perubahan, {
            diperbaruiPada: new Date().toISOString()
        });

        // Batas waktu tidak diperpanjang.
        // dikirimPada dan kedaluwarsaPada tetap.
        kasus.diperbaruiPada = rec.diperbaruiPada;

        simpan(data);

        return getKasusTergeserById(kasus.id);
    }


    // =====================================================
    // 16. MEMBATALKAN REKOMENDASI
    // =====================================================

    function batalkanRekomendasi(id, alasan) {
        const data = getData();

        const kasus = validasiKasusBelumDirespons(
            data,
            id,
            "rekomendasi_dikirim"
        );

        const rec = cariTerbaru(data, kasus);

        const batas = Date.parse(
            kasus.kedaluwarsaPada ||
            rec?.kedaluwarsaPada ||
            ""
        );

        if (
            !rec ||
            statusNormal(rec.status) !== "rekomendasi_dikirim" ||
            !Number.isFinite(batas) ||
            Date.now() >= batas
        ) {
            throw new Error(
                "Rekomendasi tidak dapat dibatalkan karena sudah tidak aktif."
            );
        }

        if (!String(alasan || "").trim()) {
            throw new Error(
                "Alasan pembatalan wajib diisi."
            );
        }

        const sekarang = new Date().toISOString();

        // Menyimpan riwayat pembatalan.
        Object.assign(rec, {
            status: "dibatalkan",
            alasanPembatalan: String(alasan).trim(),
            dibatalkanPada: sekarang,
            diperbaruiPada: sekarang
        });

        // Kasus kembali menunggu rekomendasi baru.
        Object.assign(kasus, {
            status: "menunggu_rekomendasi",
            rekomendasiId: null,
            dikirimPada: null,
            kedaluwarsaPada: null,
            diperbaruiPada: sekarang
        });

        simpan(data);

        return getKasusTergeserById(kasus.id);
    }


    // =====================================================
    // 17. MENYIMPAN RESPONS PENGGUNA
    // =====================================================

    function updateStatusRekomendasi(id, status) {
        const nilai = statusNormal(status);

        if (!REKOMENDASI_AKHIR.has(nilai)) {
            throw new Error(
                "Status respons tidak valid."
            );
        }

        const data = getData();

        const kasus = validasiKasusBelumDirespons(
            data,
            id,
            "rekomendasi_dikirim"
        );

        const rec = cariTerbaru(data, kasus);

        if (!rec) {
            throw new Error(
                "Rekomendasi aktif tidak ditemukan."
            );
        }

        const sekarang = new Date().toISOString();

        kasus.status = nilai;
        kasus.diperbaruiPada = sekarang;

        rec.status = nilai;
        rec.diperbaruiPada = sekarang;

        simpan(data);

        return getKasusTergeserById(kasus.id);
    }


    // =====================================================
    // 18. SINKRONISASI ANTAR-TAB
    // =====================================================

    window.addEventListener("storage", event => {
        if (
            event.key !== STORAGE_KEY ||
            gunakanMemori
        ) {
            return;
        }

        try {
            dataAktif = normalisasi(
                event.newValue
                    ? JSON.parse(event.newValue)
                    : DATA_SEED
            );

            beritahu(true);

        } catch (error) {
            console.warn(
                "SILAB: perubahan dari tab lain tidak valid.",
                error
            );
        }
    });


    // =====================================================
    // 19. INISIALISASI LAYANAN
    // =====================================================

    inisialisasi();

    // Menyediakan fungsi untuk seluruh modul Laboran.
    window.SILABService = Object.freeze({

        // Pengambilan data.
        getData,
        getAll,
        getById,

        // Antrean.
        getAntreanAktif,
        getPengajuanPenggeser,

        // Kasus tergeser.
        getKasusTergeser,
        getKasusTergeserById,
        getRekomendasiAktif,
        getKasusPerluRekomendasi,
        getRiwayatRekomendasi,

        // CRUD umum.
        tambah,
        update,
        hapus,
        reset,
        updatePresensi,

        // Pengelolaan kasus tergeser.
        tandaiTergeser,

        // Pengelolaan rekomendasi.
        kirimRekomendasi,
        editRekomendasi,
        batalkanRekomendasi,
        updateStatusRekomendasi
    });

    console.log(
        "SILAB: Layanan data Laboran berhasil diinisialisasi."
    );

})(window);