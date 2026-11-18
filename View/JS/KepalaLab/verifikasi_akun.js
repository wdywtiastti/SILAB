
(() => {
  "use strict";

  const API_URL = "api_verifikasi_akun.php";
  const ITEMS_PER_PAGE = 10;

  const state = {
    users: [],
    filteredUsers: [],
    searchQuery: "",
    currentPage: 1,
    selectedUserId: null,
    selectedAction: null,
    activeTab: "menunggu_verifikasi",
    loading: false
  };

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
    confirmReject: document.getElementById("confirm-reject")
  };

  // =========================================
  // TOAST
  // =========================================

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

    toast.className = `verification-toast ${type}`;
    toast.querySelector(".toast-icon").className =
      type === "error"
        ? "bi bi-exclamation-circle-fill toast-icon"
        : "bi bi-check-circle-fill toast-icon";

    toast.querySelector(".toast-message").textContent = message;
    toast.classList.add("show");

    clearTimeout(showToast.timer);

    showToast.timer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  // =========================================
  // MEMUAT DATA DATABASE
  // =========================================

  async function loadUsers() {
    if (state.loading) return;

    state.loading = true;

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        credentials: "same-origin",
        headers: {
          "Accept": "application/json"
        }
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal mengambil data.");
      }

      state.users = Array.isArray(result.users)
        ? result.users
        : [];

      renderAll();

    } catch (error) {
      console.error("Gagal memuat akun:", error);
      showToast(error.message, "error");
    } finally {
      state.loading = false;
    }
  }

  // =========================================
  // FILTER DATA
  // =========================================

  function getFilteredUsers() {
    const keyword = state.searchQuery.toLowerCase().trim();

    return state.users.filter(user => {
      if (user.status !== state.activeTab) {
        return false;
      }

      const nama = String(user.nama || "").toLowerCase();
      const npm = String(user.nipNpm || "").toLowerCase();

      return nama.includes(keyword) || npm.includes(keyword);
    });
  }

  // =========================================
  // RENDER SEMUA
  // =========================================

  function renderAll() {
    renderSummary();
    renderUsers();
    renderTabs();
  }

  function renderSummary() {
    const total = state.users.filter(
      user => user.status === "menunggu_verifikasi"
    ).length;

    if (elements.waitingCount) {
      elements.waitingCount.textContent = total;
    }
  }

  // =========================================
  // TAB STATUS
  // =========================================

  function renderTabs() {
    const pending = state.users.filter(
      user => user.status === "menunggu_verifikasi"
    ).length;

    const rejected = state.users.filter(
      user => user.status === "ditolak"
    ).length;

    const pendingButton = document.getElementById("tab-pending");
    const rejectedButton = document.getElementById("tab-rejected");

    if (pendingButton) {
      pendingButton.textContent = `Menunggu Verifikasi (${pending})`;
      pendingButton.classList.toggle(
        "active",
        state.activeTab === "menunggu_verifikasi"
      );
    }

    if (rejectedButton) {
      rejectedButton.textContent = `Ditolak (${rejected})`;
      rejectedButton.classList.toggle(
        "active",
        state.activeTab === "ditolak"
      );
    }

    if (elements.verificationTotal) {
      elements.verificationTotal.textContent =
        state.activeTab === "menunggu_verifikasi"
          ? `Permintaan Verifikasi (${pending})`
          : `Akun Ditolak (${rejected})`;
    }
  }

  // =========================================
  // RENDER TABEL
  // =========================================

  function renderUsers() {
    if (!elements.tableBody) return;

    state.filteredUsers = getFilteredUsers();

    const total = state.filteredUsers.length;
    const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

    state.currentPage = Math.min(
      Math.max(1, state.currentPage),
      Math.max(1, totalPages)
    );

    const start = (state.currentPage - 1) * ITEMS_PER_PAGE;

    const displayed = state.filteredUsers.slice(
      start,
      start + ITEMS_PER_PAGE
    );

    elements.tableBody.innerHTML = "";

    if (displayed.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 4;
      cell.className = "empty-table";
      cell.textContent =
        state.activeTab === "ditolak"
          ? "Tidak ada akun yang ditolak."
          : "Tidak ada akun yang menunggu verifikasi.";

      row.appendChild(cell);
      elements.tableBody.appendChild(row);

    } else {
      displayed.forEach(user => {
        const row = document.createElement("tr");

        // NAMA
        const nameCell = document.createElement("td");
        const nameContainer = document.createElement("div");
        nameContainer.className = "user-info";

        const name = document.createElement("span");
        name.textContent = user.nama || "-";

        nameContainer.appendChild(name);
        nameCell.appendChild(nameContainer);

        // NPM
        const identityCell = document.createElement("td");
        identityCell.textContent = user.nipNpm || "-";

        // STATUS
        const statusCell = document.createElement("td");
        const badge = document.createElement("span");

        badge.className =
          user.status === "ditolak"
            ? "status-rejected"
            : "status-waiting";

        badge.textContent =
          user.status === "ditolak"
            ? "Ditolak"
            : "Menunggu Verifikasi";

        statusCell.appendChild(badge);

        // AKSI
        const actionCell = document.createElement("td");
        const buttons = document.createElement("div");
        buttons.className = "action-buttons";

        if (user.status === "menunggu_verifikasi") {
          buttons.appendChild(
            createActionButton(
              "approve",
              user.id,
              "Verifikasi",
              "bi-check-lg",
              "approve-btn"
            )
          );

          buttons.appendChild(
            createActionButton(
              "reject",
              user.id,
              "Tolak",
              "bi-x-lg",
              "reject-btn"
            )
          );

        } else {
          buttons.appendChild(
            createActionButton(
              "reapprove",
              user.id,
              "Verifikasi Kembali",
              "bi-arrow-repeat",
              "approve-btn"
            )
          );
        }

        actionCell.appendChild(buttons);

        row.append(
          nameCell,
          identityCell,
          statusCell,
          actionCell
        );

        elements.tableBody.appendChild(row);
      });
    }

    renderTableInfo(total);
    renderPagination(total);
  }

  function createActionButton(action, id, title, icon, className) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = className;
    button.dataset.action = action;
    button.dataset.userId = id;
    button.title = title;
    button.setAttribute("aria-label", title);

    const iconElement = document.createElement("i");
    iconElement.className = `bi ${icon}`;

    button.appendChild(iconElement);

    return button;
  }

  // =========================================
  // INFORMASI TABEL
  // =========================================

  function renderTableInfo(total) {
    if (!elements.tableInfo) return;

    const start = total === 0
      ? 0
      : (state.currentPage - 1) * ITEMS_PER_PAGE + 1;

    const end = Math.min(
      state.currentPage * ITEMS_PER_PAGE,
      total
    );

    const label =
      state.activeTab === "ditolak"
        ? "akun ditolak"
        : "akun menunggu verifikasi";

    elements.tableInfo.textContent =
      `Menampilkan ${start}–${end} dari ${total} ${label}`;
  }

  // =========================================
  // PAGINATION
  // =========================================

  function renderPagination(total) {
    if (!elements.pagination) return;

    const pages = Math.ceil(total / ITEMS_PER_PAGE);

    elements.pagination.innerHTML = "";

    if (pages <= 1) return;

    const createPage = (label, value, disabled = false, active = false) => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "page-btn";
      button.textContent = label;
      button.dataset.page = value;
      button.disabled = disabled;

      if (active) button.classList.add("active");

      elements.pagination.appendChild(button);
    };

    createPage("‹", "previous", state.currentPage === 1);

    for (let i = 1; i <= pages; i++) {
      createPage(
        String(i),
        String(i),
        false,
        i === state.currentPage
      );
    }

    createPage("›", "next", state.currentPage === pages);
  }

  function changePage(target) {
    const pages = Math.ceil(
      state.filteredUsers.length / ITEMS_PER_PAGE
    );

    if (target === "previous") {
      state.currentPage--;
    } else if (target === "next") {
      state.currentPage++;
    } else {
      state.currentPage = Number(target);
    }

    if (
      state.currentPage < 1 ||
      state.currentPage > pages
    ) return;

    renderUsers();
  }

  // =========================================
  // MODAL
  // =========================================

  function closeModals() {
    if (elements.approveModal) elements.approveModal.checked = false;
    if (elements.rejectModal) elements.rejectModal.checked = false;

    state.selectedUserId = null;
    state.selectedAction = null;
  }

  function openModal(userId, action) {
    const user = state.users.find(
      item => String(item.id) === String(userId)
    );

    if (!user) {
      showToast("Akun tidak ditemukan.", "error");
      return;
    }

    if (
      action === "approve" &&
      user.status !== "menunggu_verifikasi"
    ) return;

    if (
      action === "reject" &&
      user.status !== "menunggu_verifikasi"
    ) return;

    if (
      action === "reapprove" &&
      user.status !== "ditolak"
    ) return;

    closeModals();

    state.selectedUserId = user.id;
    state.selectedAction = action;

    if (action === "reject") {
      elements.rejectModal.checked = true;
    } else {
      elements.approveModal.checked = true;

      const heading = document.querySelector(
        ".verifikasi-modal h2"
      );

      const paragraph = document.querySelector(
        ".verifikasi-modal .verification-modal-content p"
      );

      if (heading && paragraph) {
        if (action === "reapprove") {
          heading.textContent = "Verifikasi Kembali Akun?";
          paragraph.textContent =
            "Apakah Anda yakin ingin menyetujui kembali akun yang sebelumnya ditolak?";
        } else {
          heading.textContent = "Verifikasi Akun Pengguna?";
          paragraph.textContent =
            "Apakah Anda yakin ingin menyetujui akun pengguna ini?";
        }
      }

      elements.confirmApprove.innerHTML =
        action === "reapprove"
          ? '<i class="bi bi-arrow-repeat"></i> Ya, Verifikasi Kembali'
          : '<i class="bi bi-check-circle"></i> Ya, Verifikasi Akun';
    }
  }

  // =========================================
  // KIRIM PERUBAHAN KE DATABASE
  // =========================================

  async function processVerification(action) {
    const userId = state.selectedUserId;

    if (!userId) {
      showToast("Tidak ada akun yang dipilih.", "error");
      return;
    }

    const formData = new FormData();

    formData.append("user_id", userId);
    formData.append("action", action);

    try {
      const response = await fetch(API_URL, {
        method: "POST",
        credentials: "same-origin",
        body: formData
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal memperbarui akun.");
      }

      closeModals();

      showToast(result.message, "success");

      await loadUsers();

    } catch (error) {
      console.error(error);
      showToast(error.message, "error");
    }
  }

  // =========================================
  // EVENT
  // =========================================

  function bindEvents() {
    elements.searchInput?.addEventListener("input", event => {
      state.searchQuery = event.target.value;
      state.currentPage = 1;
      renderUsers();
    });

    elements.tableBody?.addEventListener("click", event => {
      const button = event.target.closest(
        "button[data-action][data-user-id]"
      );

      if (!button) return;

      openModal(
        button.dataset.userId,
        button.dataset.action
      );
    });

    elements.pagination?.addEventListener("click", event => {
      const button = event.target.closest("button[data-page]");

      if (!button || button.disabled) return;

      changePage(button.dataset.page);
    });

    elements.confirmApprove?.addEventListener("click", () => {
      processVerification(state.selectedAction);
    });

    elements.confirmReject?.addEventListener("click", () => {
      processVerification("reject");
    });

    document.getElementById("tab-pending")?.addEventListener("click", () => {
      state.activeTab = "menunggu_verifikasi";
      state.currentPage = 1;
      renderAll();
    });

    document.getElementById("tab-rejected")?.addEventListener("click", () => {
      state.activeTab = "ditolak";
      state.currentPage = 1;
      renderAll();
    });

    [elements.approveModal, elements.rejectModal].forEach(modal => {
      modal?.addEventListener("change", () => {
        if (!modal.checked) {
          state.selectedUserId = null;
          state.selectedAction = null;
        }
      });
    });
  }

  // =========================================
  // INISIALISASI
  // =========================================

  function init() {
    bindEvents();
    loadUsers();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

})();
