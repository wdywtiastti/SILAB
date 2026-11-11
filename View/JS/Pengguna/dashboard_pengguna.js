
/* =========================================
   SILAB - DASHBOARD PENGGUNA
   DATA DUMMY MELALUI CONSOLE
   TANPA STORAGE
========================================= */

(() => {
    "use strict";

    // =====================================
    // 1. IDENTITAS PENGGUNA
    // =====================================

    const namaPengguna = document.querySelector(
        ".user-navbar-name"
    )?.textContent.trim() || "";

    const slotContainer = document.querySelector(
        "#user-slot-list"
    );

    const tanggalElement = document.querySelector(
        "#user-current-date"
    );

    if (!slotContainer) {
        console.error(
            "Elemen #user-slot-list tidak ditemukan."
        );
        return;
    }


    // =====================================
    // 2. DATA DUMMY SEMENTARA
    // =====================================

    const dashboardData = {
        jadwal: []
    };


    // =====================================
    // 3. FUNGSI TANGGAL HARI INI
    // =====================================

    function getTanggalHariIni() {
        const sekarang = new Date();

        const tahun = sekarang.getFullYear();
        const bulan = String(
            sekarang.getMonth() + 1
        ).padStart(2, "0");

        const tanggal = String(
            sekarang.getDate()
        ).padStart(2, "0");

        return `${tahun}-${bulan}-${tanggal}`;
    }


    function renderTanggal() {
        if (!tanggalElement) return;

        const sekarang = new Date();

        tanggalElement.textContent =
            new Intl.DateTimeFormat("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }).format(sekarang);
    }


    // =====================================
    // 4. FORMAT WAKTU
    // =====================================

    function formatWaktu(waktu) {
        return waktu.replace(":", ".");
    }


    function toMinutes(waktu) {
        if (
            typeof waktu !== "string" ||
            !/^([01]\d|2[0-3]):[0-5]\d$/.test(waktu)
        ) {
            return null;
        }

        const [jam, menit] = waktu.split(":").map(Number);

        return jam * 60 + menit;
    }


    // =====================================
    // 5. STATUS OTOMATIS
    // =====================================

    function getStatusJadwal(item) {
        const sekarang = new Date();

        const menitSekarang =
            sekarang.getHours() * 60 +
            sekarang.getMinutes();

        const mulai = toMinutes(item.mulai);
        const selesai = toMinutes(item.selesai);

        if (mulai === null || selesai === null || mulai >= selesai) {
            return {
                teks: "Waktu tidak valid",
                className: "user-status-invalid"
            };
        }

        if (menitSekarang < mulai) {
            return {
                teks: "Disetujui",
                className: "user-status-approved"
            };
        }

        if (menitSekarang < selesai) {
            return {
                teks: "Sedang Berlangsung",
                className: "user-status-ongoing"
            };
        }

        return {
            teks: "Selesai",
            className: "user-status-finished"
        };
    }


    // =====================================
    // 6. MEMBUAT ELEMEN HTML
    // =====================================

    function buatElemen(tag, className, text) {
        const element = document.createElement(tag);

        if (className) {
            element.className = className;
        }

        if (text !== undefined) {
            element.textContent = text;
        }

        return element;
    }


    // =====================================
    // 7. RENDER SATU KARTU JADWAL
    // =====================================

    function renderKartuJadwal(item) {
        const article = buatElemen(
            "article",
            "user-slot-card"
        );

        // WAKTU
        const waktu = buatElemen(
            "div",
            "user-slot-time",
            `${formatWaktu(item.mulai)} – ${formatWaktu(item.selesai)}`
        );

        // DETAIL JADWAL
        const detail = buatElemen(
            "div",
            "user-slot-detail"
        );

        const title = buatElemen(
            "div",
            "user-slot-title"
        );

        const kegiatan = buatElemen(
            "h4",
            "",
            item.kegiatan
        );

        const badgePC = buatElemen(
            "span",
            "user-requirement-badge",
            `Kebutuhan PC: ${item.pc}`
        );

        const badgeKursi = buatElemen(
            "span",
            "user-requirement-badge",
            `Kebutuhan Kursi: ${item.kursi}`
        );

        title.append(
            kegiatan,
            badgePC,
            badgeKursi
        );

        const informasi = buatElemen("p");

        informasi.append(
            document.createTextNode(
                item.kelas || "Penggunaan Laboratorium"
            )
        );

        const pemisah = buatElemen("span", "", "•");

        informasi.append(
            pemisah,
            document.createTextNode(
                `Pemohon: ${item.pemohon}`
            )
        );

        detail.append(title, informasi);

        // STATUS
        const statusWrapper = buatElemen(
            "div",
            "user-slot-status"
        );

        const statusData = getStatusJadwal(item);

        const status = buatElemen(
            "span",
            statusData.className
        );

        const icon = buatElemen("i", "bi bi-circle-fill");

        status.append(
            icon,
            document.createTextNode(statusData.teks)
        );

        statusWrapper.appendChild(status);

        article.append(
            waktu,
            detail,
            statusWrapper
        );

        return article;
    }


    // =====================================
    // 8. RENDER KONDISI KOSONG
    // =====================================

    function renderKosong() {
        const empty = buatElemen(
            "div",
            "user-schedule-empty"
        );

        const icon = buatElemen(
            "i",
            "bi bi-calendar-x"
        );

        const title = buatElemen(
            "h4",
            "",
            "Belum Ada Jadwal Hari Ini"
        );

        const description = buatElemen(
            "p",
            "",
            "Anda belum memiliki jadwal penggunaan laboratorium yang disetujui untuk hari ini."
        );

        empty.append(icon, title, description);

        slotContainer.replaceChildren(empty);
    }


    // =====================================
    // 9. FILTER JADWAL PENGGUNA
    // =====================================

    function getJadwalHariIni() {
        const tanggalHariIni = getTanggalHariIni();

        return dashboardData.jadwal
            .filter(item => {

                const pemilikCocok =
                    item.pemohon.trim().toLowerCase() ===
                    namaPengguna.toLowerCase();

                const tanggalCocok =
                    item.tanggal === tanggalHariIni;

                const statusValid = [
                    "disetujui",
                    "terjadwal"
                ].includes(item.status);

                return (
                    pemilikCocok &&
                    tanggalCocok &&
                    statusValid
                );
            })
            .sort((a, b) =>
                a.mulai.localeCompare(b.mulai)
            );
    }


    // =====================================
    // 10. RENDER SELURUH JADWAL
    // =====================================

    function renderJadwalHariIni() {
        renderTanggal();

        const jadwal = getJadwalHariIni();

        slotContainer.replaceChildren();

        if (jadwal.length === 0) {
            renderKosong();
            return;
        }

        jadwal.forEach(item => {
            slotContainer.appendChild(
                renderKartuJadwal(item)
            );
        });
    }


    // =====================================
    // 11. VALIDASI DATA DUMMY
    // =====================================

    function validasiJadwal(item) {
        if (!item || typeof item !== "object") {
            return false;
        }

        const wajib = [
            "id",
            "tanggal",
            "pemohon",
            "kegiatan",
            "mulai",
            "selesai",
            "pc",
            "kursi",
            "status"
        ];

        if (!wajib.every(key =>
            Object.prototype.hasOwnProperty.call(item, key)
        )) {
            return false;
        }

        if (
            typeof item.id !== "string" ||
            typeof item.pemohon !== "string" ||
            typeof item.kegiatan !== "string"
        ) {
            return false;
        }

        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(item.tanggal) ||
            !Number.isInteger(item.pc) ||
            !Number.isInteger(item.kursi) ||
            item.pc < 0 ||
            item.kursi < 0
        ) {
            return false;
        }

        const mulai = toMinutes(item.mulai);
        const selesai = toMinutes(item.selesai);

        if (
            mulai === null ||
            selesai === null ||
            mulai >= selesai
        ) {
            return false;
        }

        if (![
            "disetujui",
            "terjadwal",
            "menunggu_verifikasi",
            "ditolak",
            "tergeser"
        ].includes(item.status)) {
            return false;
        }

        return true;
    }


    // =====================================
    // 12. API DATA DUMMY CONSOLE
    // =====================================

    window.SILABDashboardPenggunaDemo = {

        // Tambah data
        tambah: function(data) {

            if (!Array.isArray(data) || data.length === 0) {
                console.error(
                    "Data harus berupa array dan tidak boleh kosong."
                );
                return false;
            }

            const idAda = new Set(
                dashboardData.jadwal.map(item => item.id)
            );

            for (const item of data) {

                if (!validasiJadwal(item)) {
                    console.error(
                        "Format jadwal tidak valid:",
                        item
                    );
                    return false;
                }

                if (idAda.has(item.id)) {
                    console.error(
                        `ID jadwal ${item.id} sudah digunakan.`
                    );
                    return false;
                }

                idAda.add(item.id);
            }

            dashboardData.jadwal.push(
                ...structuredClone(data)
            );

            renderJadwalHariIni();

            console.log(
                `${data.length} data dummy berhasil ditambahkan.`
            );

            return true;
        },

        // Lihat data
        lihat: function() {
            return structuredClone(dashboardData.jadwal);
        },

        // Lihat jadwal hari ini
        lihatHariIni: function() {
            return structuredClone(getJadwalHariIni());
        },

        // Kosongkan data
        hapusSemua: function() {
            dashboardData.jadwal.length = 0;

            renderJadwalHariIni();

            console.log(
                "Seluruh data dummy dashboard pengguna dikosongkan."
            );
        },

        // Render ulang
        render: renderJadwalHariIni
    };


    // =====================================
    // 13. INISIALISASI
    // =====================================

    renderJadwalHariIni();

    console.log(
        "Dashboard Pengguna SILAB berhasil diinisialisasi."
    );

})();
