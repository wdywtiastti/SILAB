(() => {
  "use strict";

  // =========================================
  // KONFIGURASI
  // =========================================

  const API_URL = "api_manajemen_user.php";
  const ITEMS_PER_PAGE = 10;

  const state = {
    users: [],
    currentPage: 1,
    searchQuery: "",
    statusFilter: "semua",
    selectedUserId: null,
    deleteUserId: null,
    loading: false,
  };

  const el = {
    tbody: document.getElementById("user-table-body"),
    search: document.querySelector(".search-box input"),
    filterButton: document.getElementById("filter-button"),
    filterOptions: document.querySelectorAll(".filter-option"),
    pagination: document.getElementById("user-pagination"),
    tableInfo: document.getElementById("table-info"),

    total: document.getElementById("total-users"),
    active: document.getElementById("active-users"),
    inactive: document.getElementById("inactive-users"),
    waiting: document.getElementById("waiting-users"),

    addModal: document.getElementById("modal-tambah-user"),
    editModal: document.getElementById("modal-edit-user"),
    deleteModal: document.getElementById("modal-hapus-user"),

    addForm: document.querySelector(".form-tambah-user:not(.form-edit-user)"),
    editForm: document.querySelector(".form-edit-user"),

    confirmDelete: document.getElementById("confirm-delete-user"),
  };

  // =========================================
  // TOAST
  // =========================================

  let toastTimer;

  function showToast(message, type = "success") {
    let toast = document.getElementById("userToast");

    if (!toast) {
      toast = document.createElement("div");
      toast.id = "userToast";
      toast.className = "user-toast";
      toast.innerHTML = `
        <i class="toast-icon"></i>
        <span class="toast-message"></span>
      `;
      document.body.appendChild(toast);
    }

    toast.className = `user-toast ${type}`;

    toast.querySelector(".toast-icon").className =
      type === "error"
        ? "bi bi-exclamation-circle-fill toast-icon"
        : "bi bi-check-circle-fill toast-icon";

    toast.querySelector(".toast-message").textContent = message;

    requestAnimationFrame(() => toast.classList.add("show"));

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  // =========================================
  // REQUEST API
  // =========================================

  async function requestAPI(action = null, data = null) {
    let url = API_URL;
    const options = {
      credentials: "same-origin",
      headers: {
        Accept: "application/json",
      },
    };

    if (action) {
      const formData = new FormData();

      formData.append("action", action);

      Object.entries(data || {}).forEach(([key, value]) => {
        formData.append(key, value);
      });

      options.method = "POST";
      options.body = formData;
    }

    const response = await fetch(url, options);

    let result;

    try {
      result = await response.json();
    } catch {
      throw new Error("Server tidak mengirim respons JSON yang valid.");
    }

    if (!response.ok || !result.success) {
      throw new Error(result.message || "Permintaan gagal.");
    }

    return result;
  }

  // =========================================
  // LOAD DATA MYSQL
  // =========================================

  async function loadUsers() {
    if (state.loading) return;

    state.loading = true;

    try {
      const result = await requestAPI();

      state.users = Array.isArray(result.users) ? result.users : [];

      state.summary = result.summary || {};

      renderAll();
    } catch (error) {
      console.error("LOAD USER:", error);
      showToast(error.message, "error");
    } finally {
      state.loading = false;
    }
  }

  // =========================================
  // RENDER SEMUA
  // =========================================

  function renderAll() {
    renderSummary();
    renderUsers();
    renderFilter();
  }

  // =========================================
  // RINGKASAN PENGGUNA
  // =========================================

  function renderSummary() {
    const summary = state.summary || {};

    if (el.total) {
      el.total.textContent = Number(summary.total || 0);
    }

    if (el.active) {
      el.active.innerHTML = `<i class="bi bi-circle-fill"></i> ${Number(summary.aktif || 0)} Aktif`;
    }

    if (el.inactive) {
      el.inactive.innerHTML = `<i class="bi bi-circle-fill"></i> ${Number(summary.nonaktif || 0)} Nonaktif`;
    }

    if (el.waiting) {
      el.waiting.textContent = `${Number(summary.menunggu || 0)} Akun`;
    }
  }

  // =========================================
  // FILTER DAN PENCARIAN
  // =========================================

  function getFilteredUsers() {
    const keyword = state.searchQuery.toLowerCase().trim();

    return state.users.filter((user) => {
      const matchesSearch =
        String(user.nama).toLowerCase().includes(keyword) ||
        String(user.nipNpm).toLowerCase().includes(keyword);

      const matchesStatus =
        state.statusFilter === "semua" || user.status === state.statusFilter;

      return matchesSearch && matchesStatus;
    });
  }

  function renderFilter() {
    if (!el.filterButton) return;

    const filtered = getFilteredUsers();

    const label = {
      semua: "Semua",
      aktif: "Aktif",
      nonaktif: "Nonaktif",
    };

    el.filterButton.textContent = `${label[state.statusFilter]} (${filtered.length})`;

    el.filterOptions.forEach((option) => {
      const url = new URL(option.getAttribute("href"), window.location.href);

      option.classList.toggle(
        "selected",
        url.searchParams.get("status") === state.statusFilter,
      );
    });
  }

  // =========================================
  // AVATAR
  // =========================================

  function getInitials(name) {
    return (
      String(name)
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((word) => word.charAt(0).toUpperCase())
        .join("") || "?"
    );
  }

  // =========================================
  // RENDER TABEL
  // =========================================

  function renderUsers() {
    if (!el.tbody) return;

    const users = getFilteredUsers();

    const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);

    state.currentPage = Math.min(
      Math.max(1, state.currentPage),
      Math.max(1, totalPages),
    );

    const start = (state.currentPage - 1) * ITEMS_PER_PAGE;

    const displayed = users.slice(start, start + ITEMS_PER_PAGE);

    el.tbody.innerHTML = "";

    if (displayed.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");

      cell.colSpan = 5;
      cell.className = "empty-table";
      cell.textContent = "Tidak ada pengguna yang ditemukan.";

      row.appendChild(cell);
      el.tbody.appendChild(row);
    } else {
      displayed.forEach((user) => {
        const row = document.createElement("tr");

        row.dataset.userId = user.id;

        // NAMA
        const nameCell = document.createElement("td");
        const nameWrapper = document.createElement("div");

        nameWrapper.className = "user-name";

        const avatar = document.createElement("div");

        avatar.className = `avatar ${Number(user.id) % 2 === 0 ? "purple-avatar" : "maroon-avatar"}`;

        avatar.textContent = getInitials(user.nama);

        const name = document.createElement("span");
        name.textContent = user.nama;

        nameWrapper.append(avatar, name);
        nameCell.appendChild(nameWrapper);

        // NPM
        const npmCell = document.createElement("td");
        npmCell.textContent = user.nipNpm;
        // ROLE
        const roleCell = document.createElement("td");

        const roleLabels = {
          kepala_lab: "Kepala Lab",
          laboran: "Laboran",
          pengguna: "Pengguna",
        };

        const roleBadge = document.createElement("span");

        roleBadge.className = `role-badge role-${user.role}`;
        roleBadge.textContent = roleLabels[user.role] || user.role;

        roleCell.appendChild(roleBadge);

        // STATUS
        const statusCell = document.createElement("td");
        const badge = document.createElement("span");

        badge.className =
          user.status === "aktif" ? "account-active" : "account-inactive";

        badge.textContent = user.status === "aktif" ? "Aktif" : "Nonaktif";

        statusCell.appendChild(badge);

        // AKSI
        const actionCell = document.createElement("td");
        const buttons = document.createElement("div");

        buttons.className = "action-buttons";

        const editButton = document.createElement("button");

        editButton.type = "button";
        editButton.className = "edit-button";
        editButton.dataset.action = "edit";
        editButton.dataset.userId = user.id;
        editButton.innerHTML = '<i class="bi bi-pencil"></i> Edit';

        const deleteButton = document.createElement("button");

        deleteButton.type = "button";
        deleteButton.className = "delete-button";
        deleteButton.dataset.action = "delete";
        deleteButton.dataset.userId = user.id;
        deleteButton.innerHTML = '<i class="bi bi-trash"></i> Hapus';

        buttons.append(editButton, deleteButton);
        actionCell.appendChild(buttons);

        row.append(nameCell, npmCell, roleCell, statusCell, actionCell);

        el.tbody.appendChild(row);
      });
    }

    renderPagination(users.length);
    renderTableInfo(users.length);
    renderFilter();
  }

  // =========================================
  // FOOTER TABEL
  // =========================================

  function renderTableInfo(total) {
    if (!el.tableInfo) return;

    const start =
      total === 0 ? 0 : (state.currentPage - 1) * ITEMS_PER_PAGE + 1;

    const end = Math.min(state.currentPage * ITEMS_PER_PAGE, total);

    el.tableInfo.textContent = `Menampilkan ${start}–${end} dari ${total} akun pengguna`;
  }

  // =========================================
  // PAGINATION
  // =========================================

  function renderPagination(total) {
    if (!el.pagination) return;

    const pages = Math.ceil(total / ITEMS_PER_PAGE);

    el.pagination.innerHTML = "";

    if (pages <= 1) return;

    const previous = document.createElement("button");

    previous.type = "button";
    previous.className = "page-button";
    previous.textContent = "Sebelumnya";
    previous.dataset.page = "previous";
    previous.disabled = state.currentPage === 1;

    el.pagination.appendChild(previous);

    for (let i = 1; i <= pages; i++) {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "page-number";
      button.textContent = i;
      button.dataset.page = i;

      if (i === state.currentPage) {
        button.classList.add("active-page");
      }

      el.pagination.appendChild(button);
    }

    const next = document.createElement("button");

    next.type = "button";
    next.className = "page-button";
    next.textContent = "Berikutnya";
    next.dataset.page = "next";
    next.disabled = state.currentPage === pages;

    el.pagination.appendChild(next);
  }

  function changePage(target) {
    const pages = Math.ceil(getFilteredUsers().length / ITEMS_PER_PAGE);

    if (target === "previous") {
      state.currentPage--;
    } else if (target === "next") {
      state.currentPage++;
    } else {
      state.currentPage = Number(target);
    }

    if (state.currentPage < 1 || state.currentPage > pages) return;

    renderUsers();
  }

  // =========================================
  // MODAL
  // =========================================

  function openModal(modal) {
    if (modal) modal.checked = true;
  }

  function closeModal(modal) {
    if (modal) modal.checked = false;
  }

  // =========================================
  // VALIDASI FORM
  // =========================================

  function clearErrors(form) {
    if (!form) return;

    form.querySelectorAll(".field-error").forEach((error) => {
      error.textContent = "";
      error.classList.remove("show");
    });

    form.querySelectorAll(".field-invalid").forEach((input) => {
      input.classList.remove("field-invalid");
    });
  }

  function showErrors(form, errors) {
    clearErrors(form);

    Object.entries(errors).forEach(([field, message]) => {
      const input = form.querySelector(`[name="${field}"]`);
      const error = form.querySelector(`[data-error-for="${field}"]`);

      if (input) input.classList.add("field-invalid");

      if (error) {
        error.textContent = message;
        error.classList.add("show");
      }
    });
  }

  function getFormData(form) {
    return {
      nama: form.querySelector('[name="nama"]')?.value.trim() || "",
      nip_npm: form.querySelector('[name="nip_npm"]')?.value.trim() || "",
      password: form.querySelector('[name="password"]')?.value || "",
      role: form.querySelector('[name="role"]')?.value || "pengguna",
      status: form.querySelector('[name="status"]:checked')?.value || "aktif",
    };
  }

  function validate(data, requirePassword = false) {
    const errors = {};

    if (!data.nama) {
      errors.nama = "Nama wajib diisi.";
    } else if (data.nama.length > 100) {
      errors.nama = "Nama maksimal 100 karakter.";
    }

    if (!data.nip_npm) {
      errors.nip_npm = "NIP/NPM wajib diisi.";
    } else if (data.nip_npm.length > 30 || !/^[0-9]+$/.test(data.nip_npm)) {
      errors.nip_npm = "NIP/NPM tidak valid.";
    }

    if (requirePassword && !data.password) {
      errors.password = "Password wajib diisi.";
    } else if (
      data.password &&
      (data.password.length < 8 || data.password.length > 72)
    ) {
      errors.password = "Password harus 8 sampai 72 karakter.";
    }

    return errors;
  }

  // =========================================
  // TAMBAH PENGGUNA
  // =========================================

  async function addUser() {
    const data = getFormData(el.addForm);
    const errors = validate(data, true);

    if (Object.keys(errors).length) {
      showErrors(el.addForm, errors);
      return;
    }

    try {
      await requestAPI("add", data);

      el.addForm.reset();
      closeModal(el.addModal);

      state.currentPage = 1;

      showToast("Pengguna berhasil ditambahkan.");

      await loadUsers();
    } catch (error) {
      if (error.message.includes("NIP/NPM")) {
        showErrors(el.addForm, {
          nip_npm: error.message,
        });
      } else {
        showToast(error.message, "error");
      }
    }
  }

  // =========================================
  // EDIT PENGGUNA
  // =========================================

  function openEditUser(id) {
    const user = state.users.find((item) => String(item.id) === String(id));

    if (!user || !el.editForm) return;

    el.editForm.reset();
    clearErrors(el.editForm);

    el.editForm.querySelector('[name="nama"]').value = user.nama;

    el.editForm.querySelector('[name="nip_npm"]').value = user.nipNpm;

    const status = el.editForm.querySelector(
      `[name="status"][value="${user.status}"]`,
    );

    if (status) status.checked = true;

    const roleSelect = el.editForm.querySelector('[name="role"]');

    if (roleSelect) {
      roleSelect.value = user.role;
    }

    state.selectedUserId = user.id;

    openModal(el.editModal);
  }

  async function editUser() {
    const data = getFormData(el.editForm);
    const errors = validate(data, false);
    const validRoles = ["kepala_lab", "laboran", "pengguna"];

    if (!validRoles.includes(data.role)) {
      errors.role = "Silakan pilih role yang valid.";
    }
    if (Object.keys(errors).length) {
      showErrors(el.editForm, errors);
      return;
    }

    try {
      await requestAPI("update", {
        ...data,
        id_user: state.selectedUserId,
      });

      state.selectedUserId = null;

      el.editForm.reset();
      closeModal(el.editModal);

      showToast("Data pengguna berhasil diperbarui.");

      await loadUsers();
    } catch (error) {
      if (error.message.includes("NIP/NPM")) {
        showErrors(el.editForm, {
          nip_npm: error.message,
        });
      } else {
        showToast(error.message, "error");
      }
    }
  }

  // =========================================
  // HAPUS PENGGUNA
  // =========================================

  function openDeleteUser(id) {
    const user = state.users.find((item) => String(item.id) === String(id));

    if (!user) return;

    state.deleteUserId = user.id;

    const name = document.querySelector(".delete-user-name");

    if (name) name.textContent = user.nama;

    openModal(el.deleteModal);
  }

  async function deleteUser() {
    if (!state.deleteUserId) return;

    try {
      await requestAPI("delete", {
        id_user: state.deleteUserId,
      });

      state.deleteUserId = null;

      closeModal(el.deleteModal);

      showToast("Pengguna berhasil dihapus.");

      await loadUsers();
    } catch (error) {
      showToast(error.message, "error");
    }
  }

  // =========================================
  // EVENT LISTENER
  // =========================================

  function bindEvents() {
    // FORM TAMBAH
    el.addForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      addUser();
    });

    // FORM EDIT
    el.editForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      editUser();
    });

    // VALIDASI SAAT INPUT
    [el.addForm, el.editForm].forEach((form) => {
      form?.addEventListener("input", () => {
        clearErrors(form);
      });
    });

    // AKSI TABEL
    el.tbody?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");

      if (!button) return;

      if (button.dataset.action === "edit") {
        openEditUser(button.dataset.userId);
      }

      if (button.dataset.action === "delete") {
        openDeleteUser(button.dataset.userId);
      }
    });

    // KONFIRMASI HAPUS
    el.confirmDelete?.addEventListener("click", deleteUser);

    // PENCARIAN
    el.search?.addEventListener("input", (event) => {
      state.searchQuery = event.target.value;
      state.currentPage = 1;
      renderUsers();
    });

    // FILTER
    el.filterOptions.forEach((option) => {
      option.addEventListener("click", (event) => {
        event.preventDefault();

        const url = new URL(option.getAttribute("href"), window.location.href);

        const status = url.searchParams.get("status");

        if (!["semua", "aktif", "nonaktif"].includes(status)) {
          return;
        }

        state.statusFilter = status;
        state.currentPage = 1;

        const dropdown = document.querySelector(".status-filter");

        if (dropdown) dropdown.open = false;

        renderUsers();
      });
    });

    // PAGINATION
    el.pagination?.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-page]");

      if (!button || button.disabled) return;

      changePage(button.dataset.page);
    });
  }

  // =========================================
  // INISIALISASI
  // =========================================

  async function init() {
    bindEvents();
    await loadUsers();

    console.log("Manajemen User terhubung ke database MySQL.");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
