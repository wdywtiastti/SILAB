/* =========================================
   SILAB - REKOMENDASI PENGGUNA
   TERHUBUNG DENGAN DATABASE MYSQL
========================================= */

(() => {
  "use strict";

  const API = "API_rekomendasi.php";

  const $ = (selector) => document.querySelector(selector);

  const options = $("#recommendation-options");
  const acceptButton = $("#btn-accept-recommendation");
  const modal = $("#accept-modal");
  const rejectModal = $("#reject-modal");

  let recommendation = null;
  let selected = null;
  let busy = false;

  // =====================================
  // NOTIFIKASI
  // =====================================

  function feedback(message, error = false) {
    const box = $("#recommendation-feedback");

    if (!box) return;

    box.textContent = message;
    box.classList.toggle("error", error);
    box.classList.add("show");

    window.setTimeout(() => {
      box.classList.remove("show");
    }, 4000);
  }

  // =====================================
  // REQUEST API
  // =====================================

  async function api(action, method = "GET", data = {}) {
    const url =
      method === "GET" ? `${API}?action=${encodeURIComponent(action)}` : API;

    const response = await fetch(url, {
      method: method,
      credentials: "same-origin",
      cache: "no-store",

      headers: {
        Accept: "application/json",

        ...(method === "POST" ? { "Content-Type": "application/json" } : {}),
      },

      ...(method === "POST"
        ? {
            body: JSON.stringify({
              action,
              ...data,
            }),
          }
        : {}),
    });

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error(
        "Server tidak mengirim JSON. Periksa API_rekomendasi.php.",
      );
    }

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Permintaan gagal diproses.");
    }

    return result;
  }

  // =====================================
  // FORMAT TANGGAL
  // =====================================

  function formatDate(value) {
    if (!value) return "-";

    const date = new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  }

  // =====================================
  // FORMAT JAM
  // =====================================

  function formatTime(value) {
    if (!value) return "-";

    const date = new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(date.getTime())) return "-";

    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  // =====================================
  // TAMPILKAN / SEMBUNYIKAN ELEMEN
  // =====================================

  function setVisible(element, visible) {
    if (element) {
      element.hidden = !visible;
    }
  }

  // =====================================
  // TAMPILAN KOSONG
  // =====================================

  function empty(message) {
    options.replaceChildren();

    const paragraph = document.createElement("p");

    paragraph.textContent = message;

    options.appendChild(paragraph);

    acceptButton.disabled = true;

    setVisible($("#recommendation-action"), false);

    setVisible($(".recommendation-reject"), false);
  }

  // =====================================
  // RENDER REKOMENDASI
  // =====================================

  function render(data) {
    recommendation = data;
    selected = null;

    if (!data) {
      empty("Saat ini belum ada rekomendasi jadwal yang menunggu respons.");

      $(".context-heading span").textContent =
        "Tidak ada tawaran rekomendasi aktif.";

      $(".context-content > p").textContent =
        "Tawaran jadwal dari Laboran akan muncul di halaman ini.";

      $(".response-deadline span").textContent =
        "Tidak ada batas respons aktif";

      $("#selected-schedule-name").textContent = "Belum ada jadwal dipilih";

      $("#selected-schedule-time").textContent =
        "Silakan tunggu rekomendasi dari Laboran.";

      return;
    }

    // Informasi pengajuan.
    $(".context-heading span").textContent =
      data.nama_kegiatan || "Pengajuan Anda";

    $(".context-content > p").textContent =
      data.catatan ||
      "Laboran memberikan pilihan jadwal pengganti untuk pengajuan Anda.";

    // Batas waktu respons.
    $(".response-deadline span").textContent = data.batas_waktu
      ? `Batas respons: ${new Date(
          data.batas_waktu.replace(" ", "T"),
        ).toLocaleString("id-ID")}`
      : "Batas respons belum ditentukan";

    $("#selected-schedule-name").textContent = "Belum ada jadwal dipilih";

    $("#selected-schedule-time").textContent =
      "Silakan pilih salah satu rekomendasi.";

    options.replaceChildren();

    if (!Array.isArray(data.alternatives) || data.alternatives.length === 0) {
      empty("Laboran belum menambahkan alternatif jadwal.");
      return;
    }

    // Buat kartu alternatif.
    data.alternatives.forEach((item, index) => {
      const card = document.createElement("label");

      card.className = "recommendation-option";

      const radio = document.createElement("input");

      radio.type = "radio";
      radio.name = "pilihan-jadwal";
      radio.value = item.id;

      const content = document.createElement("div");

      content.className = "recommendation-option-content";

      const heading = document.createElement("div");

      heading.className = "recommendation-date";

      const title = document.createElement("h3");

      title.textContent = `Pilihan Jadwal ${index + 1}`;

      const status = document.createElement("span");

      status.className = "recommendation-type";

      status.textContent = item.status || "Menunggu";

      heading.append(title, status);

      const session = document.createElement("div");

      session.className = "recommendation-session";

      session.textContent =
        `${formatDate(item.waktuMulai)} | ` +
        `${formatTime(item.waktuMulai)} – ` +
        `${formatTime(item.waktuSelesai)} WIT`;

      content.append(heading, session);

      card.append(radio, content);

      options.appendChild(card);

      // Pilih alternatif.
      radio.addEventListener("change", () => {
        selected = item;

        $("#selected-schedule-name").textContent = title.textContent;

        $("#selected-schedule-time").textContent = session.textContent;

        acceptButton.disabled = false;

        options
          .querySelectorAll(".recommendation-option")
          .forEach((element) => {
            element.classList.remove("is-selected");
          });

        card.classList.add("is-selected");
      });
    });

    setVisible($("#recommendation-action"), true);

    setVisible($(".recommendation-reject"), true);

    acceptButton.disabled = true;
  }

  // =====================================
  // AMBIL DATA DARI DATABASE
  // =====================================

  async function load() {
    empty("Memuat rekomendasi jadwal...");

    try {
      const result = await api("list");

      const nama = result.data.nama_pengguna || "Pengguna";

      // Perbarui nama navbar jika elemennya tersedia.
      const navbarName = $("#userNavbarName");

      if (navbarName) {
        navbarName.textContent = nama;
      }

      // Perbarui nama dropdown jika elemennya tersedia.
      const profileName = $("#profileUserName");

      if (profileName) {
        profileName.textContent = nama;
      }

      // Tampilkan rekomendasi.
      render(result.data.recommendation);
    } catch (error) {
      empty(error.message);

      feedback(error.message, true);
    }
  }

  // =====================================
  // TUTUP MODAL
  // =====================================

  function closeAccept() {
    modal?.classList.remove("show");
  }

  function closeReject() {
    rejectModal?.classList.remove("show");
  }

  // =====================================
  // BUKA MODAL PENERIMAAN
  // =====================================

  acceptButton.addEventListener("click", () => {
    if (!recommendation || !selected || busy) {
      feedback("Pilih salah satu jadwal terlebih dahulu.", true);

      return;
    }

    $("#confirmation-name").textContent = $(
      "#selected-schedule-name",
    ).textContent;

    $("#confirmation-time").textContent = $(
      "#selected-schedule-time",
    ).textContent;

    modal.classList.add("show");
  });

  $("#btn-cancel-accept")?.addEventListener("click", closeAccept);

  $(".recommendation-modal-backdrop")?.addEventListener("click", closeAccept);

  // =====================================
  // KONFIRMASI PENERIMAAN
  // =====================================

  $("#btn-confirm-accept")?.addEventListener("click", async () => {
    if (!recommendation || !selected || busy) return;

    busy = true;

    const button = $("#btn-confirm-accept");

    button.disabled = true;

    try {
      const result = await api("accept", "POST", {
        id_rekomendasi: recommendation.id_rekomendasi,

        id_alternatif_rekomendasi: selected.id,
      });

      closeAccept();

      feedback(result.message);

      await load();
    } catch (error) {
      feedback(error.message, true);
    } finally {
      busy = false;

      button.disabled = false;
    }
  });

  // =====================================
  // BUKA MODAL PENOLAKAN
  // =====================================

  $(".recommendation-reject")?.addEventListener("click", (event) => {
    event.preventDefault();

    if (recommendation && !busy) {
      rejectModal.classList.add("show");
    }
  });

  $(".btn-reject-cancel")?.addEventListener("click", (event) => {
    event.preventDefault();

    closeReject();
  });

  $(".reject-modal-backdrop")?.addEventListener("click", (event) => {
    event.preventDefault();

    closeReject();
  });

  // =====================================
  // KONFIRMASI PENOLAKAN
  // =====================================

  $(".btn-reject-confirm")?.addEventListener("click", async (event) => {
    event.preventDefault();

    if (!recommendation || busy) return;

    busy = true;

    try {
      const result = await api("reject", "POST", {
        id_rekomendasi: recommendation.id_rekomendasi,
      });

      closeReject();

      feedback(result.message);

      await load();
    } catch (error) {
      feedback(error.message, true);
    } finally {
      busy = false;
    }
  });

  // =====================================
  // INISIALISASI
  // =====================================

  load();
})();
