(() => {
  "use strict";

  // =========================================
  // 1. KONFIGURASI
  // =========================================

  const ITEMS_PER_PAGE = 10;

  // =========================================
  // 2. STATE APLIKASI
  // =========================================

  const state = {
    users: [],
    filteredUsers: [],
    searchQuery: "",
    currentPage: 1,
    selectedUserId: null,
  };

  // =========================================
  // 3. REFERENSI ELEMEN HTML
  // =========================================

  const elements = {
    waitingCount: document.getElementById("waiting-count"),

    verificationTotal: document.getElementById("verification-total"),

    searchInput: document.getElementById("search-verification"),

    tableBody: document.getElementById("verification-table-body"),

    tableInfo: document.getElementById("verification-info"),

    pagination: document.getElementById("verification-pagination"),

    approveModal: document.getElementById("modal-verifikasi"),

    rejectModal: document.getElementById("modal-tolak"),

    confirmApprove: document.getElementById("confirm-approve"),

    confirmReject: document.getElementById("confirm-reject"),

    rejectionReason: document.getElementById("rejection-reason"),

    rejectionError: document.getElementById("rejection-error"),
  };

  // =========================================
  // 4. MEMUAT DATA PENGGUNA
  // =========================================

  function loadUsers() {
    if (!window.SILABStorage) {
      console.error("SILABStorage belum tersedia.");

      return false;
    }

    const users = SILABStorage.get(SILABStorage.KEYS.USERS, []);

    if (!Array.isArray(users)) {
      console.error("Format data pengguna tidak valid.");

      return false;
    }

    state.users = users;

    return true;
  }

  // =========================================
  // 5. MENGAMBIL AKUN MENUNGGU VERIFIKASI
  // =========================================

  function getWaitingUsers() {
    return state.users.filter((user) => user.status === "menunggu_verifikasi");
  }

  // =========================================
  // 6. FILTER DAN PENCARIAN
  // =========================================

  function getFilteredUsers() {
    const waitingUsers = getWaitingUsers();

    const keyword = state.searchQuery.trim().toLowerCase();

    return waitingUsers.filter((user) => {
      const nama = (user.nama || "").toLowerCase();

      const nipNpm = (user.nipNpm || "").toLowerCase();

      return nama.includes(keyword) || nipNpm.includes(keyword);
    });
  }

  // =========================================
  // 7. RENDER RINGKASAN
  // =========================================

  function renderSummary() {
    const totalWaiting = getWaitingUsers().length;

    if (elements.waitingCount) {
      elements.waitingCount.textContent = totalWaiting;
    }

    if (elements.verificationTotal) {
      elements.verificationTotal.textContent = `Permintaan Verifikasi (${totalWaiting})`;
    }
  }

  // =========================================
  // 8. RENDER TABEL VERIFIKASI
  // =========================================

  function renderUsers() {
    if (!elements.tableBody) {
      console.error("Tabel verifikasi tidak ditemukan.");

      return;
    }

    const filteredUsers = getFilteredUsers();

    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);

    const maxPage = Math.max(1, totalPages);

    state.currentPage = Math.min(Math.max(1, state.currentPage), maxPage);

    const startIndex = (state.currentPage - 1) * ITEMS_PER_PAGE;

    const displayedUsers = filteredUsers.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE,
    );

    elements.tableBody.innerHTML = "";

    // KONDISI DATA KOSONG
    if (displayedUsers.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 4;
      cell.textContent = "Tidak ada akun yang menunggu verifikasi.";

      cell.className = "empty-table";

      row.appendChild(cell);

      elements.tableBody.appendChild(row);
    } else {
      displayedUsers.forEach((user) => {
        const row = document.createElement("tr");

        row.dataset.userId = user.id;

        // KOLOM NAMA
        const nameCell = document.createElement("td");

        const nameContainer = document.createElement("div");

        nameContainer.className = "user-info";

        const nameText = document.createElement("span");

        nameText.textContent = user.nama || "-";

        nameContainer.appendChild(nameText);
        nameCell.appendChild(nameContainer);

        // KOLOM NIP/NPM
        const identityCell = document.createElement("td");

        identityCell.textContent = user.nipNpm || "-";

        // KOLOM STATUS
        const statusCell = document.createElement("td");

        const statusBadge = document.createElement("span");

        statusBadge.className = "status-waiting";

        statusBadge.textContent = "Menunggu Verifikasi";

        statusCell.appendChild(statusBadge);

        // KOLOM AKSI
        const actionCell = document.createElement("td");

        const actionButtons = document.createElement("div");

        actionButtons.className = "action-buttons";

        const approveButton = document.createElement("button");

        approveButton.type = "button";
        approveButton.className = "approve-btn";

        approveButton.dataset.action = "approve";
        approveButton.dataset.userId = user.id;

        approveButton.innerHTML = '<i class="bi bi-check-lg"></i>';
        approveButton.title = "Verifikasi akun";
        approveButton.setAttribute("aria-label", "Verifikasi akun");

        const rejectButton = document.createElement("button");

        rejectButton.type = "button";
        rejectButton.className = "reject-btn";

        rejectButton.dataset.action = "reject";
        rejectButton.dataset.userId = user.id;

        rejectButton.innerHTML = '<i class="bi bi-x-lg"></i>';
        rejectButton.title = "Tolak akun";
        rejectButton.setAttribute("aria-label", "Tolak akun");

        actionButtons.append(approveButton, rejectButton);

        actionCell.appendChild(actionButtons);

        // GABUNGKAN SEL
        row.append(nameCell, identityCell, statusCell, actionCell);

        elements.tableBody.appendChild(row);
      });
    }

    renderTableInfo(filteredUsers.length);
    renderPagination(filteredUsers.length);
  }

  // =========================================
  // 9. INFORMASI TABEL
  // =========================================

  function renderTableInfo(totalData) {
    if (!elements.tableInfo) return;

    const start =
      totalData === 0 ? 0 : (state.currentPage - 1) * ITEMS_PER_PAGE + 1;

    const end = Math.min(state.currentPage * ITEMS_PER_PAGE, totalData);

    elements.tableInfo.textContent = `Menampilkan ${start}–${end} dari ${totalData} akun menunggu verifikasi`;
  }

  // =========================================
  // 10. PAGINATION
  // =========================================

  function renderPagination(totalData) {
    if (!elements.pagination) return;

    const totalPages = Math.ceil(totalData / ITEMS_PER_PAGE);

    elements.pagination.innerHTML = "";

    if (totalPages <= 1) return;

    const previousButton = document.createElement("button");

    previousButton.type = "button";
    previousButton.className = "page-btn";
    previousButton.textContent = "‹";
    previousButton.dataset.page = "previous";

    previousButton.disabled = state.currentPage === 1;

    elements.pagination.appendChild(previousButton);

    for (let page = 1; page <= totalPages; page++) {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "page-btn";

      button.textContent = page;
      button.dataset.page = page;

      if (page === state.currentPage) {
        button.classList.add("active");
      }

      elements.pagination.appendChild(button);
    }

    const nextButton = document.createElement("button");

    nextButton.type = "button";
    nextButton.className = "page-btn";
    nextButton.textContent = "›";
    nextButton.dataset.page = "next";

    nextButton.disabled = state.currentPage === totalPages;

    elements.pagination.appendChild(nextButton);
  }

  // =========================================
  // 11. NAVIGASI HALAMAN
  // =========================================

  function changePage(target) {
    const totalData = getFilteredUsers().length;

    const totalPages = Math.ceil(totalData / ITEMS_PER_PAGE);

    if (totalPages === 0) {
      state.currentPage = 1;
      renderUsers();
      return;
    }

    let nextPage = state.currentPage;

    if (target === "previous") {
      nextPage--;
    } else if (target === "next") {
      nextPage++;
    } else {
      nextPage = Number(target);
    }

    if (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > totalPages) {
      return;
    }

    state.currentPage = nextPage;

    renderUsers();
  }

  // =========================================
  // 12. MODAL KONFIRMASI
  // =========================================

  function closeModals() {
    elements.approveModal.checked = false;
    elements.rejectModal.checked = false;

    state.selectedUserId = null;

    elements.rejectionReason.value = "";
    elements.rejectionReason.removeAttribute("aria-invalid");
    elements.rejectionError.textContent = "";
  }

  function openVerificationModal(userId, action) {
    const user = state.users.find((item) => item.id === userId);

    if (!user || user.status !== "") {
      alert("Akun tidak tersedia untuk diverifikasi.");
      return;
    }

    closeModals();
    state.selectedUserId = userId;

    if (action === "approve") {
      elements.approveModal.checked = true;
    } else if (action === "reject") {
      elements.rejectModal.checked = true;
    }
  }

  // =========================================
  // 13. MENYIMPAN KEPUTUSAN VERIFIKASI
  // =========================================

  function processVerification(action) {
    const userId = state.selectedUserId;

    if (!userId) {
      alert("Tidak ada akun yang dipilih.");
      return;
    }

    if (!["approve", "reject"].includes(action)) {
      return;
    }

    let alasanPenolakan = null;

    if (action === "reject") {
      alasanPenolakan = elements.rejectionReason.value.trim();

      if (!alasanPenolakan) {
        elements.rejectionError.textContent = "Alasan penolakan wajib diisi.";

        elements.rejectionReason.setAttribute("aria-invalid", "true");

        elements.rejectionReason.focus();
        return;
      }
    }

    // Ambil ulang data terbaru sebelum mengubah status.
    const users = SILABStorage.get(SILABStorage.KEYS.USERS, null);

    if (!Array.isArray(users)) {
      alert("Data pengguna tidak dapat dibaca.");
      return;
    }

    const userIndex = users.findIndex((user) => user.id === userId);

    if (userIndex === -1 || users[userIndex].status !== "menunggu_verifikasi") {
      alert("Status akun sudah berubah atau akun tidak ditemukan.");

      closeModals();
      loadUsers();
      renderSummary();
      renderUsers();
      return;
    }

    const statusBaru = action === "approve" ? "aktif" : "ditolak";

    const updatedUsers = users.map((user, index) => {
      if (index !== userIndex) {
        return user;
      }

      return {
        ...user,
        status: statusBaru,
        tanggalVerifikasi: new Date().toISOString(),
        alasanPenolakan: action === "reject" ? alasanPenolakan : null,
      };
    });

    const berhasil = SILABStorage.set(SILABStorage.KEYS.USERS, updatedUsers);

    if (!berhasil) {
      showToast("Gagal menyimpan keputusan verifikasi.", "error");
      return;
    }

    closeModals();

    loadUsers();
    renderSummary();
    renderUsers();

    showToast(
      action === "approve"
        ? "Akun berhasil diverifikasi."
        : "Pengajuan akun berhasil ditolak.",
      "success",
    );
  }

  let verificationToastTimer = null;

  function showToast(message, type = "success") {
    let toast = document.getElementById("verificationToast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "verificationToast";
      toast.className = "verification-toast";

      toast.innerHTML = `
            <i class="bi toast-icon"></i>
            <span class="toast-message"></span>
        `;

      document.body.appendChild(toast);
    }

    const icon = toast.querySelector(".toast-icon");
    const text = toast.querySelector(".toast-message");

    toast.className = `verification-toast ${type}`;

    toast.setAttribute("role", type === "error" ? "alert" : "status");

    icon.className =
      type === "error"
        ? "bi bi-exclamation-circle-fill toast-icon"
        : "bi bi-check-circle-fill toast-icon";

    text.textContent = message;

    clearTimeout(verificationToastTimer);

    toast.classList.remove("show");

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.classList.add("show");
      });
    });

    verificationToastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  // =========================================
  // 12. EVENT LISTENER
  // =========================================

  function bindEvents() {
    // -------------------------------------
    // PENCARIAN AKUN
    // -------------------------------------

    if (elements.searchInput) {
      elements.searchInput.addEventListener("input", function () {
        state.searchQuery = this.value;

        state.currentPage = 1;

        renderUsers();
      });
    }

    // -------------------------------------
    // PAGINATION
    // -------------------------------------

    if (elements.pagination) {
      elements.pagination.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-page]");

        if (!button || button.disabled) {
          return;
        }

        changePage(button.dataset.page);
      });
    }

    // -----------------------------------------
    // TOMBOL TERIMA DAN TOLAK PADA TABEL
    // -----------------------------------------

    if (elements.tableBody) {
      elements.tableBody.addEventListener("click", (event) => {
        const button = event.target.closest(
          "button[data-action][data-user-id]",
        );

        if (!button) return;

        openVerificationModal(button.dataset.userId, button.dataset.action);
      });
    }

    // -----------------------------------------
    // KONFIRMASI PERSETUJUAN
    // -----------------------------------------

    if (elements.confirmApprove) {
      elements.confirmApprove.addEventListener("click", () =>
        processVerification("approve"),
      );
    }

    // -----------------------------------------
    // KONFIRMASI PENOLAKAN
    // -----------------------------------------

    if (elements.confirmReject) {
      elements.confirmReject.addEventListener("click", () =>
        processVerification("reject"),
      );
    }

    // -----------------------------------------
    // PEMBATALAN MODAL
    // -----------------------------------------

    [elements.approveModal, elements.rejectModal].forEach((modal) => {
      if (!modal) return;

      modal.addEventListener("change", () => {
        if (!modal.checked) {
          closeModals();
        }
      });
    });

    // -----------------------------------------
    // HAPUS ERROR KETIKA ALASAN DIPERBAIKI
    // -----------------------------------------

    if (elements.rejectionReason) {
      elements.rejectionReason.addEventListener("input", () => {
        elements.rejectionReason.removeAttribute("aria-invalid");

        elements.rejectionError.textContent = "";
      });
    }
  }

  // =========================================
  // 13. INISIALISASI APLIKASI
  // =========================================

  function init() {
    // Memuat data dari SILABStorage.
    const loaded = loadUsers();

    if (!loaded) {
      console.error("Gagal memuat data verifikasi akun.");

      return;
    }

    // Mengatur halaman awal.
    state.currentPage = 1;

    state.searchQuery = "";

    // Menghubungkan event listener.
    bindEvents();

    // Menampilkan ringkasan.
    renderSummary();

    // Menampilkan tabel.
    renderUsers();

    console.log("Halaman Verifikasi Akun berhasil diinisialisasi.");
  }

  // =========================================
  // 14. MENJALANKAN APLIKASI
  // =========================================

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
