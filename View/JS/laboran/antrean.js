(function (window, document) {
    "use strict";

    const API_ANTREAN = "api/antrean.php";
    const API_TINDAKAN = "api/tindakan_antrean.php";
    const BATAS_PRESENSI_MENIT = 15;
    const INTERVAL_REFRESH = 30000;
    const ZONA_WIT = "+09:00";
    const PER_HALAMAN = 6;

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

    const STATUS = {
        menunggu: { label: "Menunggu Verifikasi", kelas: "verify" },
        verifikasi: { label: "Menunggu Verifikasi", kelas: "verify" },
        menunggu_verifikasi: { label: "Menunggu Verifikasi", kelas: "verify" },
        bentrok: { label: "Bentrok", kelas: "conflict" },
        tergeser: { label: "Tergeser", kelas: "displaced" },
        disetujui: { label: "Disetujui", kelas: "approved" },
        ditolak: { label: "Ditolak", kelas: "rejected" }
    };

    const STATUS_PENDING = ["menunggu", "verifikasi", "menunggu_verifikasi", "bentrok", "konflik", "tergeser"];
    const STATUS_PRESENSI = ["hadir", "presensi", "sudah_presensi", "tercatat", "digunakan", "sedang_berjalan", "berlangsung", "selesai", "checked_in", "check_in"];
    const STATUS_BOOKING_AKTIF = ["terjadwal", "disetujui", "berlangsung", "digunakan"];

    let daftarAntrean = [];
    let halamanAktif = 1;
    let filterAktif = "belum-disetujui";
    let fokusSebelumnya = null;
    let sedangMemuat = false;

    function teks(value) {
        return value === null || value === undefined || value === "" ? "-" : String(value);
    }

    function isiField(container, nama, value) {
        const target = container.querySelector(`[data-field="${nama}"]`);
        if (target) target.textContent = teks(value);
    }

    function norm(value) {
        return String(value || "").toLowerCase().trim().replace(/\s+/g, "_");
    }

    function statusItem(item) {
        // status dari API adalah status tampilan hasil pemeriksaan konflik.
        return norm(item.status || item.statusPengajuan || "menunggu");
    }

    function timestampMulai(item) {
        if (!item.tanggal || !item.waktuMulai) return null;
        const time = String(item.waktuMulai).length === 5 ? `${item.waktuMulai}:00` : item.waktuMulai;
        const value = Date.parse(`${String(item.tanggal).split("T")[0]}T${time}${ZONA_WIT}`);
        return Number.isFinite(value) ? value : null;
    }

    function sudahPresensi(item) {
        return STATUS_PRESENSI.includes(norm(item.statusPresensi));
    }

    function batasPresensiHabis(item) {
        const mulai = timestampMulai(item);
        return mulai !== null && Date.now() >= mulai + BATAS_PRESENSI_MENIT * 60000;
    }

    function masihMenungguPresensi(item) {
        return !sudahPresensi(item) && !batasPresensiHabis(item);
    }

    function formatTanggal(value) {
        if (!value) return "-";
        const match = String(value).split("T")[0].match(/^(\d{4})-(\d{2})-(\d{2})$/);
        return match ? `${match[3]}-${match[2]}-${match[1]}` : String(value);
    }

    function formatWaktu(item) {
        return `${formatTanggal(item.tanggal)} | ${teks(item.waktuMulai)} - ${teks(item.waktuSelesai)} WIT`;
    }

    async function requestAPI(url, options = {}) {
        const response = await fetch(url, {
            credentials: "same-origin",
            cache: "no-store",
            ...options
        });
        const raw = await response.text();
        let result;
        try {
            result = JSON.parse(raw);
        } catch (error) {
            console.error("Respons API bukan JSON:", raw);
            throw new Error("Respons server bukan JSON. Periksa URL API atau error PHP.");
        }
        if (!response.ok || result.success === false) {
            throw new Error(result.message || `Permintaan gagal (HTTP ${response.status}).`);
        }
        return result;
    }

    async function ambilDataAntrean() {
        const result = await requestAPI(API_ANTREAN, { method: "GET" });
        if (!Array.isArray(result.data)) throw new Error("Format data antrean dari API tidak valid.");
        return result.data;
    }

    async function kirimTindakan(aksi, idPengajuan) {
        // Penolakan tidak lagi mengirim atau meminta alasan.
        return requestAPI(API_TINDAKAN, {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ aksi, idPengajuan: Number(idPengajuan) })
        });
    }

    function ambilId(item) {
        return item.idPengajuan ?? item.id;
    }

    function cariItem(id) {
        return daftarAntrean.find(item => String(ambilId(item)) === String(id)) || null;
    }

    function urutkan(data) {
        return [...data].sort((a, b) => {
            const pa = Number(String(a.prioritas || "").match(/P([1-5])/i)?.[1] || 99);
            const pb = Number(String(b.prioritas || "").match(/P([1-5])/i)?.[1] || 99);
            if (pa !== pb) return pa - pb;
            return Number(b.skor || 0) - Number(a.skor || 0);
        });
    }

    function dataFilter() {
        return daftarAntrean.filter(item => {
            const status = statusItem(item);
            if (filterAktif === "belum-disetujui") return STATUS_PENDING.includes(status);
            if (filterAktif === "sudah-disetujui") {
                return (status === "disetujui" || status === "bentrok-disetujui") && masihMenungguPresensi(item);
            }
            return false;
        });
    }

    function renderJumlah() {
        const pending = daftarAntrean.filter(item => STATUS_PENDING.includes(statusItem(item))).length;
        const approved = daftarAntrean.filter(item =>
            (statusItem(item) === "disetujui" || statusItem(item) === "bentrok-disetujui") && masihMenungguPresensi(item)
        ).length;
        if (el.jumlahBelum) el.jumlahBelum.textContent = pending;
        if (el.jumlahSudah) el.jumlahSudah.textContent = approved;
        if (el.total) el.total.textContent = `${daftarAntrean.length} Pengajuan`;
    }

    function renderBaris(item) {
        const row = el.template.content.firstElementChild.cloneNode(true);
        const status = statusItem(item);
        const config = STATUS[status];
        isiField(row, "id", `#${ambilId(item)}`);
        isiField(row, "nama-kegiatan", item.namaKegiatan);
        isiField(row, "pemohon", item.namaPemohon);
        isiField(row, "rentang-waktu", formatWaktu(item));
        isiField(row, "kebutuhan", `PC: ${teks(item.kebutuhanPC)} | Kursi: ${teks(item.kebutuhanKursi)}`);
        isiField(row, "prioritas", item.prioritas || "Belum dihitung");
        isiField(row, "skor", item.skor === null || item.skor === undefined ? "Skor belum dihitung" : `Skor: ${item.skor}`);

        const badge = row.querySelector('[data-field="status"]');
        if (badge) {
            badge.className = "status-badge";
            badge.textContent = config?.label || status;
            if (config?.kelas) badge.classList.add(config.kelas);
            if (item.pesanKonflik) badge.title = item.pesanKonflik;
        }

        const button = row.querySelector("[data-aksi-detail]");
        if (button) {
            button.dataset.id = ambilId(item);
            button.innerHTML = status === "disetujui"
                ? '<i class="bi bi-eye"></i> Lihat Detail'
                : '<i class="bi bi-search"></i> Periksa &amp; Proses';
        }
        return row;
    }

    function renderPagination(total) {
        const pages = Math.max(1, Math.ceil(total / PER_HALAMAN));
        halamanAktif = Math.min(halamanAktif, pages);
        const start = total ? (halamanAktif - 1) * PER_HALAMAN + 1 : 0;
        const end = Math.min(halamanAktif * PER_HALAMAN, total);
        if (el.pagination) el.pagination.textContent = `Menampilkan ${start}-${end} dari ${total} pengajuan`;
        if (el.sebelumnya) el.sebelumnya.disabled = halamanAktif <= 1;
        if (el.berikutnya) el.berikutnya.disabled = halamanAktif >= pages || total === 0;
        if (el.nomorHalaman) {
            el.nomorHalaman.replaceChildren();
            for (let page = 1; page <= pages; page++) {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "pagination-btn";
                button.textContent = page;
                if (page === halamanAktif) button.classList.add("active");
                button.addEventListener("click", () => { halamanAktif = page; renderAntrean(); });
                el.nomorHalaman.append(button);
            }
        }
    }

    function renderAntrean() {
        const data = dataFilter();
        const start = (halamanAktif - 1) * PER_HALAMAN;
        const pageData = data.slice(start, start + PER_HALAMAN);
        const fragment = document.createDocumentFragment();
        if (!pageData.length) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 6;
            cell.className = "empty-message";
            cell.textContent = filterAktif === "belum-disetujui"
                ? "Belum ada pengajuan yang menunggu verifikasi."
                : "Belum ada booking yang menunggu presensi.";
            row.append(cell);
            fragment.append(row);
        } else {
            pageData.forEach(item => fragment.append(renderBaris(item)));
        }
        el.tabel.replaceChildren(fragment);
        renderPagination(data.length);
    }

    function notifikasi(message, type = "success") {
        if (!el.notifikasi) { window.alert(message); return; }
        const box = document.createElement("div");
        box.className = `notifikasi-antrean ${type}`;
        box.setAttribute("role", "status");
        box.textContent = message;
        el.notifikasi.replaceChildren(box);
        window.setTimeout(() => box.remove(), 3500);
    }

    function pesanModal(message) {
        let box = el.modal.querySelector(".aksi-feedback");
        if (!box) {
            box = document.createElement("div");
            box.className = "aksi-feedback";
            el.modal.querySelector(".review-modal-content")?.append(box);
        }
        box.textContent = message;
        box.setAttribute("role", "alert");
    }

    function tampilkanPanel(name) {
        el.modal.querySelectorAll("[data-panel]").forEach(panel => {
            panel.hidden = panel.dataset.panel !== name;
        });
    }

    function renderDaftarKonflik(item, panel) {
        if (!panel) return;
        panel.querySelector(".daftar-anggota-konflik")?.remove();
        const list = Array.isArray(item.daftarKonflik) ? item.daftarKonflik : [];
        if (!list.length) return;
        const wrap = document.createElement("div");
        wrap.className = "daftar-anggota-konflik";
        const heading = document.createElement("strong");
        heading.textContent = `Jadwal yang beririsan (${list.length})`;
        const ul = document.createElement("ul");
        list.forEach(other => {
            const li = document.createElement("li");
            li.textContent = `#${other.idPengajuan} · ${other.namaKegiatan || "Kegiatan"} · ${other.namaPemohon || "Pemohon"} · ${other.waktuMulai || "-"}-${other.waktuSelesai || "-"} WIT`;
            ul.append(li);
        });
        wrap.append(heading, ul);
        panel.append(wrap);
    }

    function bukaModal(id) {
        const item = cariItem(id);
        if (!item) { notifikasi("Data pengajuan tidak ditemukan.", "error"); return; }
        const status = statusItem(item);
        const config = STATUS[status];
        el.modal.dataset.pengajuanId = ambilId(item);
        el.modal.querySelector(".aksi-feedback")?.remove();
        isiField(el.modal, "label-id", `ID PENGAJUAN #${ambilId(item)}`);
        isiField(el.modal, "judul-kegiatan", item.namaKegiatan);
        isiField(el.modal, "nama-pemohon", item.namaPemohon);
        isiField(el.modal, "identifier", item.identifier);
        isiField(el.modal, "waktu", formatWaktu(item));
        isiField(el.modal, "jumlah-peserta", item.jumlahPeserta);
        isiField(el.modal, "kategori", item.kategori || "Belum ditentukan");
        isiField(el.modal, "kebutuhan-pc", item.kebutuhanPC);
        isiField(el.modal, "kebutuhan-kursi", item.kebutuhanKursi);
        isiField(el.modal, "skor-detail", item.skor ?? "Belum dihitung");

        const priority = el.modal.querySelector('[data-field="prioritas-detail"]');
        if (priority) priority.textContent = item.prioritas || "Belum dihitung";
        const statusBadge = el.modal.querySelector('[data-field="status-detail"]');
        if (statusBadge) {
            statusBadge.className = "status-badge";
            statusBadge.textContent = config?.label || status;
            if (config?.kelas) statusBadge.classList.add(config.kelas);
        }

        const cancelButton = el.modal.querySelector("[data-aksi-batalkan-persetujuan]");
        if (cancelButton) {
            const canCancel = norm(item.statusPengajuan) === "disetujui"
                && norm(item.statusBooking) === "terjadwal"
                && !sudahPresensi(item)
                && !batasPresensiHabis(item);
            cancelButton.hidden = !canCancel;
            cancelButton.disabled = !canCancel;
        }

        if (status === "bentrok") {
            tampilkanPanel("bentrok");
            isiField(el.modal, "pesan-bentrok", item.pesanKonflik || "Jadwal beririsan dengan pengajuan lain.");
            renderDaftarKonflik(item, el.modal.querySelector('[data-panel="bentrok"]'));
        } else if (status === "disetujui" && item.mengalamiKonflik) {
            tampilkanPanel("bentrok-disetujui");
            isiField(el.modal, "pesan-bentrok-disetujui", item.pesanKonflik || "Booking tetap berstatus disetujui, tetapi ada pengajuan baru yang beririsan.");
            renderDaftarKonflik(item, el.modal.querySelector('[data-panel="bentrok-disetujui"]'));
        } else if (status === "disetujui") {
            tampilkanPanel("disetujui");
        } else if (status === "tergeser") {
            tampilkanPanel("tergeser");
            isiField(el.modal, "pesan-tergeser", "Pengajuan memerlukan rekomendasi jadwal pengganti.");
        } else if (STATUS_PENDING.includes(status)) {
            tampilkanPanel("verifikasi");
        } else {
            tampilkanPanel("lainnya");
        }

        fokusSebelumnya = document.activeElement;
        el.modal.hidden = false;
        el.modal.setAttribute("aria-hidden", "false");
        el.modal.classList.add("is-open");
        el.modal.style.display = "flex";
        el.modal.querySelector(".review-modal-content")?.focus();
    }

    function tutupModal() {
        el.modal.classList.remove("is-open");
        el.modal.hidden = true;
        el.modal.setAttribute("aria-hidden", "true");
        el.modal.style.display = "none";
        delete el.modal.dataset.pengajuanId;
        if (fokusSebelumnya && document.contains(fokusSebelumnya)) fokusSebelumnya.focus();
        fokusSebelumnya = null;
    }

    async function muatAntrean() {
        if (sedangMemuat) return;
        sedangMemuat = true;
        try {
            daftarAntrean = urutkan(await ambilDataAntrean());
            renderJumlah();
            renderAntrean();
            console.info(`[SILAB] ${daftarAntrean.length} pengajuan dimuat dari database.`);
        } catch (error) {
            console.error("Gagal memuat antrean:", error);
            if (el.total) el.total.textContent = "Gagal memuat data";
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 6;
            cell.className = "empty-message";
            cell.textContent = error.message;
            row.append(cell);
            el.tabel.replaceChildren(row);
            notifikasi(error.message, "error");
        } finally {
            sedangMemuat = false;
        }
    }

    async function prosesSetujui(id) {
        const button = el.modal.querySelector(".btn-approve");
        if (button) button.disabled = true;
        try {
            const result = await kirimTindakan("setujui", id);
            tutupModal();
            await muatAntrean();
            notifikasi(result.message || "Pengajuan berhasil disetujui.");
        } catch (error) {
            pesanModal(error.message);
        } finally {
            if (button) button.disabled = false;
        }
    }

    async function prosesTolak(id) {
        const item = cariItem(id);
        if (!item || !STATUS_PENDING.includes(statusItem(item))) {
            pesanModal("Pengajuan tidak berada dalam antrean verifikasi.");
            return;
        }
        if (!window.confirm("Tolak pengajuan ini? Tindakan ini akan mengubah status pengajuan menjadi Ditolak.")) return;
        const button = el.modal.querySelector('[data-keputusan="ditolak"]');
        if (button) button.disabled = true;
        try {
            const result = await kirimTindakan("tolak", id);
            tutupModal();
            await muatAntrean();
            notifikasi(result.message || "Pengajuan berhasil ditolak.");
        } catch (error) {
            pesanModal(error.message);
        } finally {
            if (button) button.disabled = false;
        }
    }

    async function batalkanPersetujuan(id) {
        const item = cariItem(id);
        if (!item) { pesanModal("Data pengajuan tidak ditemukan."); return; }
        if (norm(item.statusBooking) !== "terjadwal" || sudahPresensi(item) || batasPresensiHabis(item)) {
            pesanModal("Booking tidak dapat dibatalkan karena tidak lagi memenuhi syarat pembatalan.");
            return;
        }
        if (!window.confirm("Batalkan persetujuan booking ini? Pengajuan akan dikembalikan ke antrean verifikasi.")) return;
        const button = el.modal.querySelector("[data-aksi-batalkan-persetujuan]");
        if (button) button.disabled = true;
        try {
            const result = await kirimTindakan("batalkan_persetujuan", id);
            tutupModal();
            filterAktif = "belum-disetujui";
            halamanAktif = 1;
            pilihFilter("belum-disetujui");
            await muatAntrean();
            notifikasi(result.message || "Persetujuan berhasil dibatalkan.");
        } catch (error) {
            pesanModal(error.message);
        } finally {
            if (button) button.disabled = false;
        }
    }

    function pilihFilter(value) {
        if (!["belum-disetujui", "sudah-disetujui"].includes(value)) return;
        filterAktif = value;
        halamanAktif = 1;
        el.filter.forEach(button => {
            const active = button.dataset.filterAntrean === value;
            button.classList.toggle("active", active);
            button.setAttribute("aria-pressed", String(active));
        });
        renderAntrean();
    }

    el.filter.forEach(button => button.addEventListener("click", () => pilihFilter(button.dataset.filterAntrean)));
    el.tabel.addEventListener("click", event => {
        const button = event.target.closest("[data-aksi-detail]");
        if (button) bukaModal(button.dataset.id);
    });

    el.modal.addEventListener("click", event => {
        if (event.target.closest("[data-tutup-modal]")) { tutupModal(); return; }
        const id = el.modal.dataset.pengajuanId;
        if (!id) return;
        if (event.target.closest(".btn-approve")) { prosesSetujui(id); return; }
        if (event.target.closest('[data-keputusan="ditolak"]')) { prosesTolak(id); return; }
        if (event.target.closest("[data-aksi-batalkan-persetujuan]")) { batalkanPersetujuan(id); return; }
        if (event.target.closest("[data-aksi-kirim-konflik]")) {
            pesanModal("Penerusan konflik ke Kepala Lab belum tersedia pada API konflik. Tidak ada perubahan database yang dilakukan.");
        }
    });

    if (el.sebelumnya) el.sebelumnya.addEventListener("click", () => {
        if (halamanAktif > 1) { halamanAktif--; renderAntrean(); }
    });
    if (el.berikutnya) el.berikutnya.addEventListener("click", () => {
        const pages = Math.ceil(dataFilter().length / PER_HALAMAN);
        if (halamanAktif < pages) { halamanAktif++; renderAntrean(); }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !el.modal.hidden) tutupModal();
    });
    document.addEventListener("visibilitychange", () => { if (!document.hidden) muatAntrean(); });
    window.addEventListener("focus", muatAntrean);
    window.setInterval(muatAntrean, INTERVAL_REFRESH);

    el.modal.hidden = true;
    el.modal.setAttribute("aria-hidden", "true");
    el.modal.style.display = "none";
    muatAntrean();
})(window, document);
