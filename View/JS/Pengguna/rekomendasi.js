/* =========================================
   SILAB - AKSI REKOMENDASI JADWAL
   SIMULASI TANPA DATABASE
========================================= */

(() => {
  "use strict";

  // =====================================
  // IDENTITAS PROFIL PENGGUNA
  // =====================================

  function tampilkanIdentitasNavbar() {
    const sesi = sesiSILAB.ambil();

    if (!sesi || !sesi.identifier || sesi.role !== "pengguna") {
      window.location.href = "../auth/login.html";
      return null;
    }

    const users = SILABStorage.get(SILABStorage.KEYS.USERS, []);

    if (!Array.isArray(users)) return null;

    const akun = users.find(
      (user) => String(user.nipNpm).trim() === String(sesi.identifier).trim(),
    );

    if (!akun || akun.status !== "aktif") {
      window.location.href = "../auth/login.html";
      return null;
    }

    const navbarName = document.getElementById("userNavbarName");
    const profileName = document.getElementById("profileUserName");

    if (navbarName) navbarName.textContent = akun.nama;
    if (profileName) profileName.textContent = akun.nama;

    return akun;
  }

  const akunLogin = tampilkanIdentitasNavbar();

  if (!akunLogin) return;

  // =====================================
  // 1. AMBIL ELEMEN HTML
  // =====================================

  const optionsContainer = document.querySelector("#recommendation-options");

  function getRadioPilihan() {
    return document.querySelectorAll('input[name="pilihan-jadwal"]');
  }
  const btnTerima = document.querySelector("#btn-accept-recommendation");

  const namaPilihan = document.querySelector("#selected-schedule-name");

  const waktuPilihan = document.querySelector("#selected-schedule-time");

  const modalTerima = document.querySelector("#accept-modal");

  const namaKonfirmasi = document.querySelector("#confirmation-name");

  const waktuKonfirmasi = document.querySelector("#confirmation-time");

  const feedback = document.querySelector("#recommendation-feedback");

  if (!btnTerima || !modalTerima || !optionsContainer) {
    console.error("Elemen rekomendasi belum lengkap. Periksa HTML.");
    return;
  }
  // =====================================
  // 2. DATA DUMMY DARI CONSOLE
  // =====================================

  let dataRekomendasiDummy = [];

  // =====================================
  // 2.1 STATUS SIMULASI REKOMENDASI
  // =====================================

  const statusRekomendasi = {
    pilihan: null,
    keputusan: "menunggu",
  };
  // =====================================
  // 3. MENGAMBIL DETAIL PILIHAN
  // =====================================

  function getDetailPilihan(radio) {
    const card = radio.closest(".recommendation-option");

    if (!card) return null;

    const nama = card.querySelector(".recommendation-date h3");

    const waktu = card.querySelector(".recommendation-session");

    const jenis = card.querySelector(".recommendation-type");

    return {
      value: radio.value,
      nama: nama?.textContent.trim() || "Jadwal rekomendasi",
      waktu: waktu?.textContent.trim() || "Waktu tidak tersedia",
      jenis: jenis?.textContent.trim() || "Rekomendasi",
    };
  }

  // =====================================
  // RENDER KARTU REKOMENDASI DUMMY
  // =====================================

  function renderRekomendasi() {
    optionsContainer.replaceChildren();

    if (dataRekomendasiDummy.length === 0) {
      const kosong = document.createElement("p");

      kosong.textContent = "Belum ada rekomendasi jadwal.";

      optionsContainer.appendChild(kosong);

      return;
    }

    dataRekomendasiDummy.forEach((item) => {
      const card = document.createElement("label");

      card.className = "recommendation-option";

      const radio = document.createElement("input");

      radio.type = "radio";
      radio.name = "pilihan-jadwal";
      radio.value = item.id;

      const content = document.createElement("div");

      content.className = "recommendation-option-content";

      const tanggal = document.createElement("div");

      tanggal.className = "recommendation-date";

      const judul = document.createElement("h3");

      judul.textContent = item.nama;

      const jenis = document.createElement("span");

      jenis.className = "recommendation-type";

      jenis.textContent = item.jenis;

      tanggal.append(judul, jenis);

      const waktu = document.createElement("div");

      waktu.className = "recommendation-session";

      waktu.textContent = `${item.tanggal} | ${item.waktuMulai} – ${item.waktuSelesai} WIT`;

      const kebutuhan = document.createElement("p");

      kebutuhan.textContent = `Peserta: ${item.jumlahPeserta} | PC: ${item.jumlahPC} | Kursi: ${item.jumlahKursi}`;

      const bentrok = document.createElement("p");

      bentrok.className = "recommendation-conflict-info";

      bentrok.textContent = item.jadwalBentrok
        ? `Jadwal bentrok: ${item.jadwalBentrok.nama} | ${item.jadwalBentrok.mulai} – ${item.jadwalBentrok.selesai} WIT`
        : "Tidak ada informasi jadwal bentrok.";

      content.append(tanggal, waktu, kebutuhan, bentrok);

      card.append(radio, content);

      optionsContainer.appendChild(card);
    });
  }
  // =====================================
  // 4. NOTIFIKASI
  // =====================================

  function tampilkanFeedback(pesan, error = false) {
    feedback.textContent = pesan;

    feedback.classList.toggle("error", error);
    feedback.classList.add("show");

    window.setTimeout(() => {
      feedback.classList.remove("show");
    }, 3500);
  }

  // =====================================
  // 5. MEMILIH REKOMENDASI
  // =====================================

  function pilihJadwal(radio) {
    if (statusRekomendasi.keputusan !== "menunggu") {
      return;
    }

    const detail = getDetailPilihan(radio);

    if (!detail) return;

    statusRekomendasi.pilihan = detail;

    namaPilihan.textContent = detail.nama;
    waktuPilihan.textContent = detail.waktu;

    btnTerima.disabled = false;

    document.querySelectorAll(".recommendation-option").forEach((option) => {
      option.classList.remove("is-selected");
    });

    radio.closest(".recommendation-option").classList.add("is-selected");
  }

  optionsContainer.addEventListener("change", (event) => {
    if (event.target.matches('input[name="pilihan-jadwal"]')) {
      pilihJadwal(event.target);
    }
  });

  // =====================================
  // 6. BUKA MODAL KONFIRMASI
  // =====================================

  btnTerima.addEventListener("click", () => {
    if (
      !statusRekomendasi.pilihan ||
      statusRekomendasi.keputusan !== "menunggu"
    ) {
      tampilkanFeedback(
        "Silakan pilih rekomendasi jadwal terlebih dahulu.",
        true,
      );
      return;
    }

    namaKonfirmasi.textContent = statusRekomendasi.pilihan.nama;

    waktuKonfirmasi.textContent = statusRekomendasi.pilihan.waktu;

    modalTerima.classList.add("show");
  });

  // =====================================
  // 7. TUTUP MODAL
  // =====================================

  function tutupModal() {
    modalTerima.classList.remove("show");
  }

  document
    .querySelector("#btn-cancel-accept")
    .addEventListener("click", tutupModal);

  document
    .querySelector(".recommendation-modal-backdrop")
    .addEventListener("click", tutupModal);

  // =====================================
  // 8. KONFIRMASI PENERIMAAN
  // =====================================

  document
    .querySelector("#btn-confirm-accept")
    .addEventListener("click", () => {
      if (!statusRekomendasi.pilihan) return;

      // Simpan pilihan untuk keperluan simulasi
      const pilihanDiterima = structuredClone(statusRekomendasi.pilihan);

      statusRekomendasi.keputusan = "diterima";

      // Tutup modal
      tutupModal();

      // Hapus seluruh tawaran rekomendasi
      dataRekomendasiDummy = [];

      // Reset pilihan
      statusRekomendasi.pilihan = null;

      // Render ulang halaman
      renderRekomendasi();

      // Nonaktifkan tombol
      btnTerima.disabled = true;

      // Tampilkan notifikasi
      tampilkanFeedback(
        "Rekomendasi berhasil diterima. Seluruh tawaran jadwal telah ditutup.",
      );

      console.log("Rekomendasi diterima:", pilihanDiterima);
    });

  // =====================================
  // 9. PENOLAKAN REKOMENDASI
  // =====================================

  const modalTolak = document.querySelector("#reject-modal");

  const btnTolak = document.querySelector(".btn-reject-confirm");

  const linkBatal = document.querySelector(".btn-reject-cancel");

  const backdropTolak = document.querySelector(".reject-modal-backdrop");
  const linkTolak = document.querySelector(".recommendation-reject");

  if (linkTolak && modalTolak) {
    linkTolak.addEventListener("click", (event) => {
      event.preventDefault();

      if (statusRekomendasi.keputusan !== "menunggu") {
        return;
      }

      modalTolak.classList.add("show");
    });
  }

  if (linkBatal) {
    linkBatal.addEventListener("click", (event) => {
      event.preventDefault();
      modalTolak.classList.remove("show");
    });
  }

  // Tutup modal ketika backdrop diklik
  if (backdropTolak) {
    backdropTolak.addEventListener("click", (event) => {
      event.preventDefault();
      modalTolak.classList.remove("show");
    });
  }

  if (btnTolak) {
    btnTolak.addEventListener("click", (event) => {
      event.preventDefault();

      if (statusRekomendasi.keputusan !== "menunggu") {
        return;
      }

      statusRekomendasi.keputusan = "ditolak";

      modalTolak.classList.remove("show");

      getRadioPilihan().forEach((radio) => {
        radio.disabled = true;
      });

      btnTerima.disabled = true;

      tampilkanFeedback(
        "Rekomendasi ditolak. Silakan lanjutkan pengajuan waktu lain secara manual.",
      );

      console.log("Rekomendasi ditolak:", statusRekomendasi);
    });
  }

  // =====================================
  // 12. API DATA DUMMY CONSOLE
  // =====================================

  window.SILABRekomendasiDemo = {
    // Memasukkan data dari Console
    tambah: function (data) {
      if (!Array.isArray(data) || data.length === 0) {
        console.error("Data harus berupa array dan tidak boleh kosong.");
        return false;
      }

      const wajib = [
        "id",
        "tanggal",
        "waktuMulai",
        "waktuSelesai",
        "nama",
        "jenis",
        "jumlahPC",
        "jumlahKursi",
        "jumlahPeserta",
      ];

      for (const item of data) {
        if (
          !item ||
          !wajib.every((key) => Object.prototype.hasOwnProperty.call(item, key))
        ) {
          console.error("Format data tidak lengkap:", item);
          return false;
        }
      }

      dataRekomendasiDummy = structuredClone(data);

      statusRekomendasi.pilihan = null;
      statusRekomendasi.keputusan = "menunggu";

      btnTerima.disabled = true;
      btnTerima.textContent = "Terima Rekomendasi";

      renderRekomendasi();

      console.log(
        "Berhasil menampilkan",
        data.length,
        "data dummy rekomendasi.",
      );

      return true;
    },

    // Melihat data
    lihat: function () {
      return structuredClone(dataRekomendasiDummy);
    },

    // Melihat keputusan pengguna
    lihatKeputusan: function () {
      return structuredClone(statusRekomendasi);
    },

    // Menghapus data dummy dari tampilan
    hapus: function () {
      dataRekomendasiDummy = [];

      statusRekomendasi.pilihan = null;
      statusRekomendasi.keputusan = "menunggu";

      btnTerima.disabled = true;

      renderRekomendasi();

      console.log("Data dummy berhasil dikosongkan.");
    },
  };

  console.log("Aksi rekomendasi SILAB berhasil diinisialisasi.");
})();
