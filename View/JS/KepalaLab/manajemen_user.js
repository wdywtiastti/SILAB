(() => {
  "use strict";

  /*
   * SILAB - Manajemen User Kepala Laboratorium
   * Data simulasi menggunakan SILABStorage.
   */

  // =========================================
  // 1. KONFIGURASI
  // =========================================

  const STORAGE_KEY = window.SILABStorage?.KEYS?.USERS;

  const ITEMS_PER_PAGE = 10;

  const DEFAULT_USERS = [
    {
      id: "USR001",
      nama: "Ir. Salkin Lutfi S.T., M.Kom.",
      nipNpm: "0012058201",
      status: "aktif",
    },
    {
      id: "USR002",
      nama: "Widyawati Astuti",
      nipNpm: "0024088902",
      status: "aktif",
    },
    {
      id: "USR003",
      nama: "Desy Indriasty Faradaniyah",
      nipNpm: "0702211045",
      status: "aktif",
    },
    {
      id: "USR004",
      nama: "Yasir Muin S.T., M.Kom.",
      nipNpm: "0702221012",
      status: "aktif",
    },
    {
      id: "USR005",
      nama: "Laili Fadila",
      nipNpm: "0702221089",
      status: "nonaktif",
    },
    {
      id: "USR006",
      nama: "Jasmin",
      nipNpm: "0702221090",
      status: "nonaktif",
    },
    {
      id: "USR007",
      nama: "Ahmad Fauzan",
      nipNpm: "0702211032",
      status: "aktif",
    },
    {
      id: "USR008",
      nama: "Nurul Hidayah",
      nipNpm: "0702211056",
      status: "aktif",
    },
    {
      id: "USR009",
      nama: "Muhammad Rizky",
      nipNpm: "0702221043",
      status: "aktif",
    },
    {
      id: "USR010",
      nama: "Siti Rahmawati",
      nipNpm: "0702221067",
      status: "aktif",
    },
  ];

  // =========================================
  // 2. STATE
  // =========================================

  const state = {
    users: [],

    currentPage: 1,

    searchQuery: "",

    statusFilter: "semua",

    selectedUserId: null,

    deleteUserId: null,
  };

  // =========================================
  // 3. ELEMEN HTML
  // =========================================

  const elements = {
    userTable: document.querySelector(".user-table"),

    userTableBody: document.querySelector(".user-table tbody"),

    searchInput: document.querySelector(".search-box input"),

    filterButton: document.querySelector(".filter-button"),

    filterOptions: document.querySelectorAll(".filter-option"),

    summaryCards: document.querySelectorAll(".summary-card"),

    pagination: document.querySelector(".pagination"),

    tableFooter: document.querySelector(".table-footer"),

    addModal: document.getElementById("modal-tambah-user"),

    editModal: document.getElementById("modal-edit-user"),

    deleteModal: document.getElementById("modal-hapus-user"),

    addForm: document.querySelector(".form-tambah-user:not(.form-edit-user)"),

    editForm: document.querySelector(".form-edit-user"),
  };

  // =========================================
  // 4. FUNGSI PEMBANTU
  // =========================================

  // Membuat salinan data.
  function cloneData(data) {
    return JSON.parse(JSON.stringify(data));
  }

  // Membuat ID pengguna otomatis.
  function createUserId() {
    const highestId = state.users.reduce((highest, user) => {
      const number = Number(String(user.id).replace("USR", ""));

      return Math.max(highest, number || 0);
    }, 0);

    return `USR${String(highestId + 1).padStart(3, "0")}`;
  }

  // Memeriksa struktur data pengguna.
  function isValidUser(user) {
    return (
      user &&
      typeof user.id === "string" &&
      typeof user.nama === "string" &&
      typeof user.nipNpm === "string" &&
      ["aktif", "nonaktif", "menunggu_verifikasi", "ditolak"].includes(
        user.status,
      )
    );
  }

  // =========================================
  // 5. LOAD DATA PENGGUNA
  // =========================================

  function loadUsers() {
    if (!window.SILABStorage || !STORAGE_KEY) {
      console.error("SILABStorage atau key USERS tidak tersedia.");

      return false;
    }

    if (!window.SILABStorage.isAvailable()) {
      console.error("LocalStorage tidak tersedia.");

      return false;
    }

    // Jika belum ada data, gunakan data awal.
    if (!window.SILABStorage.exists(STORAGE_KEY)) {
      const initialUsers = cloneData(DEFAULT_USERS);

      const saved = window.SILABStorage.set(STORAGE_KEY, initialUsers);

      if (!saved) {
        console.error("Gagal menyimpan data awal pengguna.");

        return false;
      }

      state.users = initialUsers;

      return true;
    }

    // Mengambil data yang sudah tersimpan.
    const storedUsers = window.SILABStorage.get(STORAGE_KEY, []);

    // Memastikan struktur penyimpanan berbentuk array.
    if (!Array.isArray(storedUsers)) {
      console.error("Format data pengguna tidak valid.");

      return false;
    }

    // Memeriksa setiap data pengguna.
    if (!storedUsers.every(isValidUser)) {
      console.error("Ditemukan struktur data pengguna yang tidak valid.");

      return false;
    }

    state.users = storedUsers;

    return true;
  }

  // =========================================
  // 6. SAVE DATA PENGGUNA
  // =========================================

  function saveUsers() {
    if (!window.SILABStorage || !STORAGE_KEY) {
      console.error("SILABStorage tidak tersedia.");

      return false;
    }

    const saved = window.SILABStorage.set(STORAGE_KEY, state.users);

    if (!saved) {
      console.error("Gagal menyimpan perubahan data pengguna.");

      return false;
    }

    return true;
  }

  // =========================================
  // 7. RENDER TABEL PENGGUNA
  // =========================================

  // =========================================
  // 7. RENDER TABEL PENGGUNA
  // =========================================

  function renderUsers() {
    // Memastikan elemen tbody tersedia.
    if (!elements.userTableBody) {
      console.error("Elemen tbody tabel pengguna tidak ditemukan.");
      return;
    }

    // Mengambil data berdasarkan pencarian dan filter.
    const filteredUsers = getFilteredUsers();

    // Menghitung jumlah halaman.
    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);

    // Menentukan batas halaman.
    const maxPage = Math.max(1, totalPages);

    // Memastikan halaman aktif tetap valid.
    state.currentPage = Math.min(Math.max(1, state.currentPage), maxPage);

    // Menghitung indeks data.
    const startIndex = (state.currentPage - 1) * ITEMS_PER_PAGE;

    const endIndex = startIndex + ITEMS_PER_PAGE;

    // Mengambil data sesuai halaman.
    const displayedUsers = filteredUsers.slice(startIndex, endIndex);

    // Membersihkan isi tabel sebelumnya.
    elements.userTableBody.innerHTML = "";

    // =====================================
    // KONDISI DATA KOSONG
    // =====================================

    if (displayedUsers.length === 0) {
      const row = document.createElement("tr");

      const cell = document.createElement("td");

      cell.colSpan = 4;
      cell.className = "empty-table";

      cell.textContent = "Tidak ada pengguna yang ditemukan.";

      row.appendChild(cell);

      elements.userTableBody.appendChild(row);
    } else {
      // =====================================
      // MENAMPILKAN DATA PENGGUNA
      // =====================================

      displayedUsers.forEach((user) => {
        const row = document.createElement("tr");

        row.dataset.userId = user.id;

        // ---------------------------------
        // KOLOM 1: NAMA PENGGUNA
        // ---------------------------------

        const nameCell = document.createElement("td");

        nameCell.textContent = user.nama;

        // ---------------------------------
        // KOLOM 2: NIDN / NIM
        // ---------------------------------

        const identityCell = document.createElement("td");

        identityCell.textContent = user.nipNpm;

        // ---------------------------------
        // KOLOM 3: STATUS AKUN
        // ---------------------------------

        const statusCell = document.createElement("td");

        const statusBadge = document.createElement("span");

        statusBadge.className =
          user.status === "aktif" ? "account-active" : "account-inactive";

        statusBadge.textContent =
          user.status === "aktif" ? "Aktif" : "Nonaktif";

        statusCell.appendChild(statusBadge);

        // ---------------------------------
        // KOLOM 4: AKSI
        // ---------------------------------

        const actionCell = document.createElement("td");

        const actionButtons = document.createElement("div");

        actionButtons.className = "action-buttons";

        // Tombol Edit.
        const editButton = document.createElement("button");

        editButton.type = "button";
        editButton.className = "edit-button";

        editButton.dataset.action = "edit";
        editButton.dataset.userId = user.id;

        editButton.title = "Edit pengguna";

        editButton.setAttribute("aria-label", `Edit pengguna ${user.nama}`);

        editButton.innerHTML = '<i class="bi bi-pencil"></i> Edit';

        // Tombol Hapus.
        const deleteButton = document.createElement("button");

        deleteButton.type = "button";
        deleteButton.className = "delete-button";

        deleteButton.dataset.action = "delete";
        deleteButton.dataset.userId = user.id;

        deleteButton.title = "Hapus pengguna";

        deleteButton.setAttribute("aria-label", `Hapus pengguna ${user.nama}`);

        deleteButton.innerHTML = '<i class="bi bi-trash"></i> Hapus';

        // Menggabungkan tombol aksi.
        actionButtons.append(editButton, deleteButton);

        actionCell.appendChild(actionButtons);

        row.append(nameCell, identityCell, statusCell, actionCell);

        elements.userTableBody.appendChild(row);
      });
    }

    // =====================================
    // MEMPERBARUI KOMPONEN TABEL
    // =====================================

    renderPagination(filteredUsers.length);

    renderTableInfo(filteredUsers.length);

    renderSummary();
  }

  // =========================================
  // 8. FILTER DAN PENCARIAN PENGGUNA
  // =========================================

  function getFilteredUsers() {
    return state.users.filter((user) => {
      // Hanya akun aktif dan nonaktif.
      const manageableStatus = ["aktif", "nonaktif"].includes(user.status);

      const query = state.searchQuery.trim().toLowerCase();

      const matchesSearch =
        user.nama.toLowerCase().includes(query) ||
        user.nipNpm.toLowerCase().includes(query);

      const matchesStatus =
        state.statusFilter === "semua" || user.status === state.statusFilter;

      return manageableStatus && matchesSearch && matchesStatus;
    });
  }

  // =========================================
  // 9. RENDER RINGKASAN PENGGUNA
  // =========================================

  function renderSummary() {
    // Akun yang sudah dapat dikelola
    const managedUsers = state.users.filter((user) =>
      ["aktif", "nonaktif"].includes(user.status),
    );

    const totalUsers = managedUsers.length;

    const activeUsers = managedUsers.filter(
      (user) => user.status === "aktif",
    ).length;

    const inactiveUsers = managedUsers.filter(
      (user) => user.status === "nonaktif",
    ).length;

    // Akun yang belum diverifikasi
    const waitingUsers = state.users.filter(
      (user) => user.status === "menunggu_verifikasi",
    ).length;

    const cards = document.querySelectorAll(".summary-grid .summary-card");

    // KARTU TOTAL PENGGUNA
    if (cards[0]) {
      const totalLabel = cards[0].querySelector("h2");

      const activeLabel = cards[0].querySelector(".status-active");

      const inactiveLabel = cards[0].querySelector(".status-inactive");

      if (totalLabel) {
        totalLabel.textContent = totalUsers;
      }

      if (activeLabel) {
        activeLabel.innerHTML = `<i class="bi bi-circle-fill"></i> ${activeUsers} Aktif`;
      }

      if (inactiveLabel) {
        inactiveLabel.innerHTML = `<i class="bi bi-circle-fill"></i> ${inactiveUsers} Nonaktif`;
      }
    }

    // KARTU VERIFIKASI AKUN BARU
    if (cards[1]) {
      const verificationLabel = cards[1].querySelector(".verification-number");

      if (verificationLabel) {
        verificationLabel.textContent = `${waitingUsers} Akun`;
      }
    }
  }

  // =========================================  
  // 10. INFORMASI JUMLAH DATA TABEL
  // =========================================

  function renderTableInfo(totalData) {
    if (!elements.tableFooter) return;

    const info = elements.tableFooter.querySelector("p");

    if (!info) return;

    const start =
      totalData === 0 ? 0 : (state.currentPage - 1) * ITEMS_PER_PAGE + 1;

    const end = Math.min(state.currentPage * ITEMS_PER_PAGE, totalData);

    info.replaceChildren(document.createTextNode("Menampilkan "));

    const startStrong = document.createElement("strong");
    startStrong.textContent = start;

    const endStrong = document.createElement("strong");
    endStrong.textContent = end;

    const totalStrong = document.createElement("strong");
    totalStrong.textContent = totalData;

    info.append(
      startStrong,
      document.createTextNode("–"),
      endStrong,
      document.createTextNode(" dari "),
      totalStrong,
      document.createTextNode(" akun pengguna"),
    );
  }

  // =========================================
  // 11. RENDER PAGINATION
  // =========================================

  function renderPagination(totalData) {
    if (!elements.pagination) return;

    const totalPages = Math.ceil(totalData / ITEMS_PER_PAGE);

    elements.pagination.innerHTML = "";

    if (totalPages <= 1) return;

    // Tombol sebelumnya
    const previousButton = document.createElement("button");

    previousButton.type = "button";
    previousButton.className = "page-button";
    previousButton.textContent = "Sebelumnya";
    previousButton.dataset.page = "previous";
    previousButton.disabled = state.currentPage === 1;

    elements.pagination.appendChild(previousButton);

    // Nomor halaman
    for (let page = 1; page <= totalPages; page++) {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "page-number";
      button.textContent = page;
      button.dataset.page = page;

      if (page === state.currentPage) {
        button.classList.add("active-page");
        button.setAttribute("aria-current", "page");
      }

      elements.pagination.appendChild(button);
    }

    // Tombol berikutnya
    const nextButton = document.createElement("button");

    nextButton.type = "button";
    nextButton.className = "page-button";
    nextButton.textContent = "Berikutnya";
    nextButton.dataset.page = "next";
    nextButton.disabled = state.currentPage === totalPages;

    elements.pagination.appendChild(nextButton);
  }

  // =========================================
  // 12. NAVIGASI HALAMAN
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

    // Validasi batas halaman.
    if (!Number.isInteger(nextPage) || nextPage < 1 || nextPage > totalPages) {
      return;
    }

    state.currentPage = nextPage;

    renderUsers();
  }

  // =========================================
  // 15. MODAL DAN FORM
  // =========================================

  function openModal(modal) {
    if (modal) {
      modal.checked = true;
    }
  }

  function closeModal(modal) {
    if (modal) {
      modal.checked = false;
    }
  }

  function getUserFormData(form) {
    if (!form) return null;

    const nama = form.querySelector('[name="nama"]')?.value || "";

    const nipNpm = form.querySelector('[name="nip_npm"]')?.value || "";

    const password = form.querySelector('[name="password"]')?.value || "";

    const statusRadio = form.querySelector('[name="status"]:checked');

    const statusSelect = form.querySelector('select[name="status"]');

    const status = statusRadio?.value || statusSelect?.value || "aktif";

    return {
      nama: nama.trim(),
      nipNpm: nipNpm.trim(),
      password: password,
      status: status.toLowerCase(),
    };
  }

  // Validasi data pengguna.

  function validateUserData(data, requirePassword = false) {
    const errors = {};

    // Validasi nama
    if (!data.nama) {
      errors.nama = "Nama pengguna wajib diisi.";
    } else if (data.nama.length > 100) {
      errors.nama = "Nama pengguna maksimal 100 karakter.";
    }

    // Validasi NIP/NPM
    if (!data.nipNpm) {
      errors.nip_npm = "NIP/NPM wajib diisi.";
    } else if (!/^[0-9]+$/.test(data.nipNpm)) {
      errors.nip_npm = "NIP/NPM hanya boleh berisi angka.";
    }

    // Validasi password tambah pengguna
    if (requirePassword && !data.password) {
      errors.password = "Password wajib diisi.";
    } else if ((requirePassword || data.password) && data.password.length < 8) {
      errors.password = "Password minimal 8 karakter.";
    }

    // Validasi status
    if (!["aktif", "nonaktif"].includes(data.status)) {
      errors.status = "Status akun tidak valid.";
    }

    return errors;
  }

  function showFieldErrors(form, errors) {
    if (!form) return;

    // Bersihkan error sebelumnya.
    clearFieldErrors(form);

    Object.entries(errors).forEach(([fieldName, message]) => {
      const input = form.querySelector(`[name="${fieldName}"]`);

      const errorElement = form.querySelector(
        `[data-error-for="${fieldName}"]`,
      );

      if (input) {
        input.classList.add("field-invalid");
        input.setAttribute("aria-invalid", "true");
      }

      if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.add("show");
      }
    });
  }

  function clearFieldErrors(form, fieldName = null) {
    if (!form) return;

    const fields = fieldName ? [fieldName] : ["nama", "nip_npm", "password"];

    fields.forEach((name) => {
      const input = form.querySelector(`[name="${name}"]`);

      const errorElement = form.querySelector(`[data-error-for="${name}"]`);

      if (input) {
        input.classList.remove("field-invalid");
        input.removeAttribute("aria-invalid");
      }

      if (errorElement) {
        errorElement.textContent = "";
        errorElement.classList.remove("show");
      }
    });
  }

  // Memeriksa duplikasi NIDN/NIM.
  function isDuplicateIdentity(nipNpm, excludedId = null) {
    return state.users.some(
      (user) =>
        user.id !== excludedId &&
        user.nipNpm.toLowerCase() === nipNpm.toLowerCase(),
    );
  }

  // =========================================
  // 16. TAMBAH PENGGUNA
  // =========================================

  function addUser() {
    const data = getUserFormData(elements.addForm);

    if (!data) {
      console.error("Form tambah pengguna tidak ditemukan.");
      return;
    }

    const errors = validateUserData(data, true);

    if (isDuplicateIdentity(data.nipNpm)) {
      errors.nip_npm = "NIP/NPM sudah digunakan oleh pengguna lain.";
    }

    if (Object.keys(errors).length > 0) {
      showFieldErrors(elements.addForm, errors);
      return;
    }

    if (isDuplicateIdentity(data.nipNpm)) {
      showToast("NIDN/NIM sudah digunakan oleh pengguna lain.", "error");
      return;
    }

    const newUser = {
      id: createUserId(),
      nama: data.nama,
      nipNpm: data.nipNpm,
      password: data.password,
      status: data.status,
    };

    const previousUsers = cloneData(state.users);

    state.users.push(newUser);

    if (!saveUsers()) {
      state.users = previousUsers;

      showToast("Gagal menyimpan pengguna.", "error");

      return;
    }

    state.currentPage = 1;

    elements.addForm.reset();

    closeModal(elements.addModal);

    renderUsers();

    showToast("Pengguna berhasil ditambahkan.", "success");
  }

  // =========================================
  // 17. EDIT PENGGUNA
  // =========================================

  function openEditUser(userId) {
    const user = state.users.find((item) => item.id === userId);

    if (!user || !elements.editForm) {
      return;
    }

    const form = elements.editForm;

    const namaInput =
      form.querySelector('[name="nama"]') ||
      form.querySelector('[name="namaPengguna"]') ||
      form.querySelectorAll("input")[0];

    const identityInput =
      form.querySelector('[name="nip_npm"]') ||
      form.querySelector('[name="identitas"]') ||
      form.querySelectorAll("input")[1];

    const statusInput = form.querySelector(
      `[name="status"][value="${user.status}"]`,
    );

    if (namaInput) {
      namaInput.value = user.nama;
    }

    if (identityInput) {
      identityInput.value = user.nipNpm;
    }

    if (statusInput) {
      statusInput.checked = true;
    }

    state.selectedUserId = userId;

    openModal(elements.editModal);
  }

  function editUser() {
    const user = state.users.find((item) => item.id === state.selectedUserId);

    if (!user) {
      showToast("Pengguna yang akan diedit tidak ditemukan.", "error");

      return;
    }

    const data = getUserFormData(elements.editForm);

    if (!data) return;

    const errors = validateUserData(data, false);

    if (isDuplicateIdentity(data.nipNpm, user.id)) {
      errors.nip_npm = "NIP/NPM sudah digunakan oleh pengguna lain.";
    }

    if (Object.keys(errors).length > 0) {
      showFieldErrors(elements.editForm, errors);
      return;
    }

    if (isDuplicateIdentity(data.nipNpm, user.id)) {
      showToast("NIDN/NIM sudah digunakan oleh pengguna lain.", "error");

      return;
    }

    const previousUsers = cloneData(state.users);

    user.nama = data.nama;
    user.nipNpm = data.nipNpm;
    user.status = data.status;

    // Password hanya berubah jika diisi.
    if (data.password) {
      if (data.password.length < 8) {
        showToast("Password baru minimal 8 karakter.", "error");

        return;
      }

      user.password = data.password;
    }

    if (!saveUsers()) {
      state.users = previousUsers;

      showToast("Perubahan pengguna gagal disimpan.", "error");

      return;
    }

    state.selectedUserId = null;

    elements.editForm.reset();

    closeModal(elements.editModal);

    renderUsers();

    showToast("Data pengguna berhasil diperbarui.", "success");
  }

  // =========================================
  // 18. HAPUS PENGGUNA
  // =========================================

  function openDeleteUser(userId) {
    const user = state.users.find((item) => item.id === userId);

    if (!user) return;

    state.deleteUserId = userId;

    const deleteName =
      elements.deleteModal?.nextElementSibling?.querySelector(
        ".delete-user-name",
      );

    if (deleteName) {
      deleteName.textContent = user.nama;
    }

    openModal(elements.deleteModal);
  }

  function deleteUser() {
    if (!state.deleteUserId) return;

    const user = state.users.find((item) => item.id === state.deleteUserId);

    if (!user) {
      showToast("Pengguna tidak ditemukan.", "error");

      return;
    }

    const previousUsers = cloneData(state.users);

    state.users = state.users.filter((item) => item.id !== state.deleteUserId);

    if (!saveUsers()) {
      state.users = previousUsers;

      showToast("Pengguna gagal dihapus.", "error");

      return;
    }

    state.deleteUserId = null;

    closeModal(elements.deleteModal);

    renderUsers();

    showToast("Pengguna berhasil dihapus.", "success");
  }

  // =========================================
  // 19. TOAST NOTIFICATION
  // =========================================

  let toastTimer = null;

  function showToast(message, type = "success") {
    let toast = document.getElementById("userToast");

    if (!toast) {
      toast = document.createElement("div");

      toast.id = "userToast";
      toast.className = "user-toast";

      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");

      const icon = document.createElement("i");

      icon.className = "toast-icon";

      const text = document.createElement("span");

      text.className = "toast-message";

      toast.append(icon, text);

      document.body.appendChild(toast);
    }

    const icon = toast.querySelector(".toast-icon");
    const text = toast.querySelector(".toast-message");

    toast.className = `user-toast ${type}`;

    icon.className =
      type === "error"
        ? "bi bi-exclamation-circle-fill toast-icon"
        : "bi bi-check-circle-fill toast-icon";

    text.textContent = message;

    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  // =========================================
  // 20. EVENT LISTENER
  // =========================================

  function bindEvents() {
    // FORM TAMBAH PENGGUNA
    if (elements.addForm) {
      elements.addForm.addEventListener("submit", function (event) {
        event.preventDefault();
        addUser();
      });
    }

    // FORM EDIT PENGGUNA
    if (elements.editForm) {
      elements.editForm.addEventListener("submit", function (event) {
        event.preventDefault();
        editUser();
      });
    }

    // VALIDASI LANGSUNG SAAT INPUT DIUBAH
    [elements.addForm, elements.editForm].forEach((form) => {
      if (!form) return;

      form.addEventListener("input", function (event) {
        const input = event.target;
        const fieldName = input.name;

        if (!["nama", "nip_npm", "password"].includes(fieldName)) {
          return;
        }

        const value = input.value.trim();

        let errorMessage = "";

        if (fieldName === "nama" && value) {
          if (value.length > 100) {
            errorMessage = "Nama pengguna maksimal 100 karakter.";
          }
        }

        if (fieldName === "nip_npm" && value) {
          if (!/^[0-9]+$/.test(value)) {
            errorMessage = "NIP/NPM hanya boleh berisi angka.";
          }
        }

        if (fieldName === "password" && value) {
          if (value.length < 8) {
            errorMessage = "Password minimal 8 karakter.";
          }
        }

        if (errorMessage) {
          showFieldErrors(form, {
            [fieldName]: errorMessage,
          });
        } else {
          clearFieldErrors(form, fieldName);
        }
      });
    });

    // TOMBOL EDIT DAN HAPUS
    if (elements.userTableBody) {
      elements.userTableBody.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-action]");

        if (!button) return;

        const userId = button.dataset.userId;
        const action = button.dataset.action;

        if (!userId) return;

        if (action === "edit") {
          openEditUser(userId);
        }

        if (action === "delete") {
          openDeleteUser(userId);
        }
      });
    }

    // KONFIRMASI HAPUS
    const confirmDeleteButton = document.getElementById("confirm-delete-user");

    if (confirmDeleteButton) {
      confirmDeleteButton.addEventListener("click", deleteUser);
    }

    // PENCARIAN PENGGUNA
    if (elements.searchInput) {
      elements.searchInput.addEventListener("input", function () {
        state.searchQuery = this.value;
        state.currentPage = 1;

        renderUsers();
      });
    }

    // FILTER STATUS
    elements.filterOptions.forEach((option) => {
      option.addEventListener("click", function (event) {
        event.preventDefault();

        const href = this.getAttribute("href") || "";

        const url = new URL(href, window.location.href);

        const selectedStatus = url.searchParams.get("status");

        if (!["semua", "aktif", "nonaktif"].includes(selectedStatus)) {
          return;
        }

        state.statusFilter = selectedStatus;
        state.currentPage = 1;

        elements.filterOptions.forEach((item) => {
          item.classList.remove("selected");
        });

        this.classList.add("selected");

        renderUsers();
      });
    });

    // PAGINATION
    if (elements.pagination) {
      elements.pagination.addEventListener("click", function (event) {
        const button = event.target.closest("button[data-page]");

        if (!button || button.disabled) return;

        changePage(button.dataset.page);
      });
    }
  }

  // =========================================
  // 21. INISIALISASI APLIKASI
  // =========================================

  function init() {
    // Memuat data pengguna.
    const loaded = loadUsers();

    if (!loaded) {
      console.error("Manajemen User gagal diinisialisasi.");

      return;
    }

    // Memasang seluruh event listener.
    bindEvents();

    // Mengatur halaman awal.
    state.currentPage = 1;
    state.statusFilter = "semua";

    // Menampilkan data pengguna.
    renderUsers();

    console.log("Manajemen User berhasil diinisialisasi.");
  }

  // =========================================
  // 22. JALANKAN APLIKASI
  // =========================================

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
