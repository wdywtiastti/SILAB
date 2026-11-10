
(function (window, document) {
    "use strict";

    const layanan = window.SILABService;

    const parameter = new URLSearchParams(window.location.search);
    const kasusId =
    parameter.get("pengajuan") ||
    parameter.get("kasusId");
    const modeLihat = parameter.get("mode") === "lihat";

    const form = document.getElementById("formRekomendasi");
    const inputMulai = document.getElementById("waktu-mulai");
    const inputSelesai = document.getElementById("waktu-selesai");
    const inputCatatan = document.getElementById("catatan");

    const feedback = document.getElementById("feedbackRekomendasi");
    const tombolKirim = document.getElementById("btnKirimRekomendasi");
    const statusHalaman = document.getElementById("statusRekomendasi");

    // KONFIGURASI
    const KAPASITAS_PC = 36;
    const KAPASITAS_KURSI = 36;
    const BATAS_KONFIRMASI = 24 * 60 * 60 * 1000;

    const STATUS_MENUNGGU = "tergeser";
    const STATUS_TERKIRIM = "rekomendasi_dikirim";

    const STATUS_NONAKTIF = [
        "dibatalkan",
        "ditolak",
        "tidak_digunakan",
        "tergeser",
        "selesai",
        "kedaluwarsa",
        "expired",
        "rejected",
        "cancelled"
    ];

    let kasusAktif = null;
    let sedangMenyimpan = false;


    // MEMERIKSA KETERSEDIAAN MODUL
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
        console.error("SILAB: Modul rekomendasi gagal dimuat.");
        return;
    }


    // MENAMPILKAN PESAN
    function tampilkanPesan(pesan, jenis = "info") {
        feedback.textContent = pesan;
        feedback.dataset.jenis = jenis;
    }


    // MENGUBAH STATUS HALAMAN
    function ubahStatusHalaman(teks) {
        statusHalaman.textContent = teks;
    }


    // MENGUBAH LABEL TOMBOL
    function ubahLabelTombol(teks) {
        const label = tombolKirim.querySelector(
            "[data-label-submit]"
        );

        if (label) {
            label.textContent = teks;
        }
    }


    // MENGATUR KONDISI FORM
    function aturForm(nonaktif) {
        inputMulai.disabled = nonaktif;
        inputSelesai.disabled = nonaktif;
        inputCatatan.disabled = nonaktif;
        tombolKirim.disabled = nonaktif;
    }


    // MENGISI RINCIAN KASUS
    function isiRincian(kunci, nilai) {
        const elemen = document.querySelector(
            `[data-detail="${kunci}"]`
        );

        if (elemen) {
            elemen.textContent = nilai || "-";
        }
    }


    // MEMFORMAT JAM
    function formatJam(jam) {
        if (!jam) {
            return "-";
        }

        return String(jam).replace(":", ".");
    }


    // MEMFORMAT JADWAL ASAL
    function formatJadwalAsal(kasus) {
        let tanggal = "Tanggal belum tersedia";
        let jam = "-";

        if (kasus.jadwalAsal) {
            const cocok = String(kasus.jadwalAsal).match(
                /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/
            );

            if (cocok) {
                const tanggalAsal = new Date(
                    Number(cocok[1]),
                    Number(cocok[2]) - 1,
                    Number(cocok[3])
                );

                tanggal = new Intl.DateTimeFormat("id-ID", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                }).format(tanggalAsal);

                jam = `${cocok[4]}.${cocok[5]} WIT`;
            }
        } else if (kasus.tanggal) {
            const bagian = String(kasus.tanggal).split("-");

            if (bagian.length === 3) {
                const tanggalAsal = new Date(
                    Number(bagian[0]),
                    Number(bagian[1]) - 1,
                    Number(bagian[2])
                );

                tanggal = new Intl.DateTimeFormat("id-ID", {
                    weekday: "long",
                    day: "2-digit",
                    month: "long",
                    year: "numeric"
                }).format(tanggalAsal);
            }
        } else if (kasus.hari) {
            tanggal = kasus.hari;
        }

        if (kasus.waktuMulai && kasus.waktuSelesai) {
            jam =
                `${formatJam(kasus.waktuMulai)}–` +
                `${formatJam(kasus.waktuSelesai)} WIT`;
        }

        return {
            tanggal,
            jam
        };
    }


    // MENAMPILKAN DATA PENGAJUAN
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
            kasus.namaPenggeser || "Tidak tercatat pada data antrean."
        );

        isiRincian(
            "alasan",
            kasus.alasan || "Informasi alasan pergeseran belum tersedia."
        );
    }


    // MEMBUAT RENTANG WAKTU
    function buatRentang(tanggal, mulai, selesai) {
        if (!tanggal || !mulai || !selesai) {
            return null;
        }

        const waktuMulai = new Date(`${tanggal}T${mulai}`);
        const waktuSelesai = new Date(`${tanggal}T${selesai}`);

        if (
            Number.isNaN(waktuMulai.getTime()) ||
            Number.isNaN(waktuSelesai.getTime())
        ) {
            return null;
        }

        if (waktuSelesai <= waktuMulai) {
            waktuSelesai.setDate(
                waktuSelesai.getDate() + 1
            );
        }

        return {
            mulai: waktuMulai,
            selesai: waktuSelesai
        };
    }


    // MENGAMBIL RENTANG WAKTU DATA
    function ambilRentang(item) {
        if (item.mulai && item.selesai) {
            const mulai = new Date(item.mulai);
            const selesai = new Date(item.selesai);

            if (
                !Number.isNaN(mulai.getTime()) &&
                !Number.isNaN(selesai.getTime())
            ) {
                return {
                    mulai,
                    selesai
                };
            }
        }

        return buatRentang(
            item.tanggal,
            item.waktuMulai,
            item.waktuSelesai
        );
    }


    // MEMERIKSA BENTROK JADWAL
    function terjadiBentrok(rentangBaru, rentangLama) {
        return (
            rentangBaru.mulai < rentangLama.selesai &&
            rentangBaru.selesai > rentangLama.mulai
        );
    }


    // MEMERIKSA STATUS REKOMENDASI
    function rekomendasiMasihAktif(rekomendasi) {
        const status = String(
            rekomendasi.status || "menunggu_konfirmasi"
        ).toLowerCase();

        if (STATUS_NONAKTIF.includes(status)) {
            return false;
        }

        if (
            status === "menunggu_konfirmasi" &&
            rekomendasi.batasKonfirmasi
        ) {
            const batas = new Date(
                rekomendasi.batasKonfirmasi
            );

            if (
                !Number.isNaN(batas.getTime()) &&
                batas <= new Date()
            ) {
                return false;
            }
        }

        return true;
    }


    // MENCARI BENTROK JADWAL
    function cariBentrok(rentangBaru) {

        // Memeriksa jadwal peminjaman.
        const bookings = layanan.getAll("bookings");

        for (const booking of bookings) {
            const status = String(
                booking.status || ""
            ).toLowerCase();

            if (
                STATUS_NONAKTIF.includes(status) ||
                booking.presensi?.status === "tidak_digunakan"
            ) {
                continue;
            }

            const rentangLama = ambilRentang(booking);

            if (
                rentangLama &&
                terjadiBentrok(rentangBaru, rentangLama)
            ) {
                return (
                    `Jadwal bertabrakan dengan kegiatan ` +
                    `"${booking.namaKegiatan || "Peminjaman lain"}".`
                );
            }
        }


        // Memeriksa rekomendasi yang masih aktif.
        const daftarRekomendasi = layanan.getAll("rekomendasi");

        for (const rekomendasi of daftarRekomendasi) {
            if (!rekomendasiMasihAktif(rekomendasi)) {
                continue;
            }

            const rentangLama = ambilRentang(rekomendasi);

            if (
                rentangLama &&
                terjadiBentrok(rentangBaru, rentangLama)
            ) {
                return (
                    "Jadwal bertabrakan dengan rekomendasi " +
                    "yang masih aktif untuk pengguna lain."
                );
            }
        }

        return null;
    }


    // MEMERIKSA KAPASITAS LABORATORIUM
    function periksaKapasitas(kasus) {
        const jumlahPC = Number(kasus.kebutuhanPC);
        const jumlahKursi = Number(kasus.kebutuhanKursi);

        if (
            !Number.isFinite(jumlahPC) ||
            !Number.isFinite(jumlahKursi) ||
            jumlahPC < 0 ||
            jumlahKursi < 0
        ) {
            return "Data kebutuhan kapasitas tidak valid.";
        }

        if (jumlahPC > KAPASITAS_PC) {
            return (
                `Kebutuhan ${jumlahPC} PC melebihi ` +
                `kapasitas laboratorium (${KAPASITAS_PC} PC).`
            );
        }

        if (jumlahKursi > KAPASITAS_KURSI) {
            return (
                `Kebutuhan ${jumlahKursi} kursi melebihi ` +
                `kapasitas laboratorium (${KAPASITAS_KURSI} kursi).`
            );
        }

        return null;
    }


    // VALIDASI FORM REKOMENDASI
    function validasiForm() {
        const nilaiMulai = inputMulai.value;
        const nilaiSelesai = inputSelesai.value;

        if (!nilaiMulai || !nilaiSelesai) {
            return {
                valid: false,
                pesan: "Waktu mulai dan waktu selesai wajib diisi."
            };
        }

        const mulai = new Date(nilaiMulai);
        const selesai = new Date(nilaiSelesai);

        if (
            Number.isNaN(mulai.getTime()) ||
            Number.isNaN(selesai.getTime())
        ) {
            return {
                valid: false,
                pesan: "Format tanggal atau waktu tidak valid."
            };
        }

        if (mulai <= new Date()) {
            return {
                valid: false,
                pesan: "Jadwal pengganti harus berada pada waktu mendatang."
            };
        }

        if (selesai <= mulai) {
            return {
                valid: false,
                pesan: "Waktu selesai harus lebih besar dari waktu mulai."
            };
        }


        // Memeriksa kapasitas.
        const kesalahanKapasitas = periksaKapasitas(kasusAktif);

        if (kesalahanKapasitas) {
            return {
                valid: false,
                pesan: kesalahanKapasitas
            };
        }


        // Memeriksa bentrok.
        const rentangBaru = {
            mulai,
            selesai
        };

        const kesalahanBentrok = cariBentrok(rentangBaru);

        if (kesalahanBentrok) {
            return {
                valid: false,
                pesan: kesalahanBentrok
            };
        }

        return {
            valid: true,
            mulai,
            selesai
        };
    }


    // MENGATUR BATAS WAKTU INPUT
    function aturBatasInput() {
        const sekarang = new Date();

        const waktuLokal = new Date(
            sekarang.getTime() -
            sekarang.getTimezoneOffset() * 60000
        )
            .toISOString()
            .slice(0, 16);

        inputMulai.min = waktuLokal;
        inputSelesai.min = waktuLokal;
    }


    // MEMPERBARUI BATAS WAKTU SELESAI
    inputMulai.addEventListener("change", function () {
        inputSelesai.min = this.value;

        if (
            inputSelesai.value &&
            inputSelesai.value <= this.value
        ) {
            inputSelesai.value = "";
        }
    });


    // MENCARI REKOMENDASI BERDASARKAN ID ANTREAN
    function ambilRekomendasiKasus(kasus) {
        const daftar = layanan.getAll("rekomendasi");

        const hasil = daftar.filter(
            item => String(item.kasusId) === String(kasus.id)
        );

        hasil.sort((a, b) => {
            const waktuA = Date.parse(a.dibuatPada) || 0;
            const waktuB = Date.parse(b.dibuatPada) || 0;

            return waktuB - waktuA;
        });

        return hasil[0] || null;
    }


    // MEMULIHKAN KASUS YANG REKOMENDASINYA TIDAK AKTIF
    function pulihkanKasus(kasus, rekomendasi) {
        if (
            !rekomendasi ||
            rekomendasiMasihAktif(rekomendasi) ||
            kasus.status !== STATUS_TERKIRIM
        ) {
            return kasus;
        }

        const batas = new Date(
            rekomendasi.batasKonfirmasi
        );

        if (
            rekomendasi.status === "menunggu_konfirmasi" &&
            rekomendasi.batasKonfirmasi &&
            !Number.isNaN(batas.getTime()) &&
            batas <= new Date()
        ) {
            layanan.update("rekomendasi", rekomendasi.id, {
                status: "kedaluwarsa"
            });
        }

        layanan.update("antrean", kasus.id, {
            status: STATUS_MENUNGGU,
            rekomendasiId: null,
            batasKonfirmasi: null
        });

        return layanan.getById("antrean", kasus.id);
    }


    // MENAMPILKAN REKOMENDASI YANG SUDAH TERSIMPAN
    function tampilkanRekomendasiTersimpan(rekomendasi) {
        const mulaiLokal =
            rekomendasi.mulaiLokal ||
            `${rekomendasi.tanggal}T${rekomendasi.waktuMulai}`;

        const selesaiLokal =
            rekomendasi.selesaiLokal ||
            `${rekomendasi.tanggal}T${rekomendasi.waktuSelesai}`;

        inputMulai.value = mulaiLokal;
        inputSelesai.value = selesaiLokal;
        inputCatatan.value = rekomendasi.catatan || "";

        aturForm(true);

        const status = rekomendasi.status;

        const keterangan = {
            menunggu_konfirmasi: "Menunggu Konfirmasi Pengguna",
            diterima: "Rekomendasi Diterima",
            ditolak: "Rekomendasi Ditolak",
            kedaluwarsa: "Rekomendasi Kedaluwarsa"
        };

        ubahStatusHalaman(
            keterangan[status] || "Rekomendasi Tersimpan"
        );

        ubahLabelTombol("Rekomendasi Terkirim");

        if (rekomendasi.batasKonfirmasi) {
            const batas = new Date(
                rekomendasi.batasKonfirmasi
            );

            tampilkanPesan(
                `Rekomendasi tersimpan. Batas konfirmasi: ${batas.toLocaleString("id-ID")}.`,
                "sukses"
            );
        } else {
            tampilkanPesan(
                "Rekomendasi untuk pengajuan ini sudah tersimpan.",
                "sukses"
            );
        }
    }


    // MEMUAT DATA PENGAJUAN DARI ANTREAN
    function muatKasus() {
        if (!kasusId) {
            aturForm(true);

            tampilkanPesan(
                "ID pengajuan tidak ditemukan. Silakan kembali ke halaman Rekomendasi Jadwal.",
                "error"
            );

            return;
        }


        // Mengambil data langsung dari koleksi antrean.
        kasusAktif = layanan.getById(
            "antrean",
            kasusId
        );

        if (!kasusAktif) {
            aturForm(true);

            tampilkanPesan(
                `Pengajuan ${kasusId} tidak ditemukan dalam antrean.`,
                "error"
            );

            console.error(
                "SILAB: ID pengajuan tidak ditemukan:",
                kasusId
            );

            return;
        }


        // Menampilkan detail pengajuan.
        tampilkanKasus(kasusAktif);


        // Memeriksa rekomendasi sebelumnya.
        let rekomendasiTersimpan = ambilRekomendasiKasus(
            kasusAktif
        );


        // Memulihkan kasus jika rekomendasi lama sudah tidak aktif.
        kasusAktif = pulihkanKasus(
            kasusAktif,
            rekomendasiTersimpan
        );

        rekomendasiTersimpan = ambilRekomendasiKasus(
            kasusAktif
        );


        // Jika masih ada rekomendasi aktif, tampilkan dalam mode baca.
        if (
            rekomendasiTersimpan &&
            rekomendasiMasihAktif(rekomendasiTersimpan)
        ) {
            tampilkanRekomendasiTersimpan(
                rekomendasiTersimpan
            );

            return;
        }


        // Mode melihat tidak mengizinkan perubahan.
        if (modeLihat) {
            aturForm(true);

            ubahStatusHalaman("Mode Lihat");

            tampilkanPesan(
                "Belum ada rekomendasi aktif untuk pengajuan ini.",
                "info"
            );

            return;
        }


        // Hanya kasus tergeser yang dapat diberi rekomendasi.
        if (kasusAktif.status !== STATUS_MENUNGGU) {
            aturForm(true);

            ubahStatusHalaman("Tidak Dapat Diubah");

            tampilkanPesan(
                "Pengajuan ini tidak sedang berstatus tergeser atau sudah diproses.",
                "error"
            );

            return;
        }


        aturBatasInput();

        ubahStatusHalaman("Menunggu Rekomendasi");

        tampilkanPesan(
            `Data pengajuan ${kasusAktif.id} berhasil dimuat. Silakan tentukan jadwal pengganti.`,
            "info"
        );

        console.log(
            "SILAB: Data rekomendasi berhasil dimuat.",
            kasusAktif.id
        );
    }


    // MENYIMPAN REKOMENDASI
    function simpanRekomendasi(event) {
        event.preventDefault();

        if (sedangMenyimpan || !kasusAktif) {
            return;
        }


        // Memeriksa ulang status pengajuan.
        const kasusTerbaru = layanan.getById(
            "antrean",
            kasusId
        );

        if (
            !kasusTerbaru ||
            kasusTerbaru.status !== STATUS_MENUNGGU
        ) {
            tampilkanPesan(
                "Status pengajuan sudah berubah. Silakan muat ulang halaman.",
                "error"
            );

            aturForm(true);
            return;
        }


        // Mencegah rekomendasi ganda.
        const rekomendasiSebelumnya = ambilRekomendasiKasus(
            kasusTerbaru
        );

        if (
            rekomendasiSebelumnya &&
            rekomendasiMasihAktif(rekomendasiSebelumnya)
        ) {
            tampilkanPesan(
                "Pengajuan ini sudah memiliki rekomendasi yang masih aktif.",
                "error"
            );

            aturForm(true);
            return;
        }


        // Memvalidasi jadwal.
        const hasilValidasi = validasiForm();

        if (!hasilValidasi.valid) {
            tampilkanPesan(
                hasilValidasi.pesan,
                "error"
            );

            return;
        }


        sedangMenyimpan = true;
        tombolKirim.disabled = true;

        ubahLabelTombol("Menyimpan...");


        const sekarang = new Date();

        const idRekomendasi = `REK-${Date.now()}`;

        const batasKonfirmasi = new Date(
            sekarang.getTime() + BATAS_KONFIRMASI
        );

        const nilaiMulai = inputMulai.value;
        const nilaiSelesai = inputSelesai.value;


        // Menyusun data rekomendasi.
        const dataRekomendasi = {
            id: idRekomendasi,

            // Hubungan dengan pengajuan antrean.
            kasusId: kasusTerbaru.id,
            antreanId: kasusTerbaru.id,

            userId: kasusTerbaru.userId || null,

            namaPemohon: kasusTerbaru.namaPemohon,
            nipNpm: kasusTerbaru.nipNpm,

            namaKegiatan: kasusTerbaru.namaKegiatan,

            kategori: kasusTerbaru.kategori,
            prioritas: kasusTerbaru.prioritas,

            // Jadwal alternatif.
            tanggal: nilaiMulai.slice(0, 10),

            waktuMulai: nilaiMulai.slice(11, 16),
            waktuSelesai: nilaiSelesai.slice(11, 16),

            mulaiLokal: nilaiMulai,
            selesaiLokal: nilaiSelesai,

            mulai: hasilValidasi.mulai.toISOString(),
            selesai: hasilValidasi.selesai.toISOString(),

            // Kebutuhan pengguna.
            kebutuhanPC: kasusTerbaru.kebutuhanPC,
            kebutuhanKursi: kasusTerbaru.kebutuhanKursi,

            catatan: inputCatatan.value.trim(),

            // Status konfirmasi.
            status: "menunggu_konfirmasi",

            dibuatPada: sekarang.toISOString(),

            batasKonfirmasi: batasKonfirmasi.toISOString()
        };


        let rekomendasiTersimpan = false;

        try {

            // Menyimpan rekomendasi.
            layanan.tambah(
                "rekomendasi",
                dataRekomendasi
            );

            rekomendasiTersimpan = true;


            // Memperbarui status pengajuan antrean.
            layanan.update(
                "antrean",
                kasusTerbaru.id,
                {
                    status: STATUS_TERKIRIM,

                    rekomendasiId: idRekomendasi,

                    tanggalRekomendasi: sekarang.toISOString(),

                    batasKonfirmasi: batasKonfirmasi.toISOString()
                }
            );


            // Memperbarui tampilan halaman.
            tampilkanRekomendasiTersimpan(
                dataRekomendasi
            );

            console.log(
                "SILAB: Rekomendasi berhasil dikirim.",
                {
                    pengajuan: kasusTerbaru.id,
                    rekomendasi: idRekomendasi
                }
            );

        } catch (error) {

            // Menghapus data jika pembaruan antrean gagal.
            if (rekomendasiTersimpan) {
                layanan.hapus(
                    "rekomendasi",
                    idRekomendasi
                );
            }

            tampilkanPesan(
                error.message || "Rekomendasi gagal disimpan.",
                "error"
            );

            ubahLabelTombol("Kirim Rekomendasi");

            tombolKirim.disabled = false;

            console.error(
                "SILAB Rekomendasi:",
                error
            );

        } finally {
            sedangMenyimpan = false;
        }
    }


    // MENANGANI PENGIRIMAN FORM
    form.addEventListener(
        "submit",
        simpanRekomendasi
    );


    // MENGHAPUS PESAN ERROR KETIKA INPUT DIPERBAIKI
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


    // MENJALANKAN MODUL
    muatKasus();

    console.log(
        "SILAB: Modul buat rekomendasi berhasil dimuat."
    );

})(window, document);
