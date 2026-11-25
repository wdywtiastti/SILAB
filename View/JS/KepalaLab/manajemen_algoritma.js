(() => {
  "use strict";

  const FACILITY_API = "API/fasilitas.php";
  const RULE_API = "API/aturan.php";
  const CRITERIA_API = "API/kriteria.php";

  /*
   * SILAB - Manajemen Algoritma
   * Data simulasi disimpan melalui SILABStorage.
   * Modul ini hanya mengelola konfigurasi.
   */

  const DEFAULT_CONFIG = {
    rules: [],
    facilities: [],
    groups: [],
    facilityGroupWeight: 0,
    version: 1,
    updatedAt: null,
  };

  const STORAGE_KEY = window.SILABStorage?.KEYS?.ALGORITHM_CONFIG;

  const state = {
    selectedFacilityId: null,
    deleteFacilityId: null,
    config: null,
    selectedRuleId: null,
    selectedCriteriaId: null,
    deleteTarget: null,
    expandedBeforeRender: new Set(),
    pendingCriteriaWeights: {},
  };

  const elements = {
    facilityList: document.querySelector(".facility-list"),

    facilityCount: document.getElementById("facilityCount"),

    facilityCapacity: document.getElementById("facilityCapacity"),

    addFacilityToggle: document.getElementById("modalTambahFasilitas"),

    deleteFacilityToggle: document.getElementById("modalHapusFasilitas"),

    facilityForm: document.getElementById("facilityForm"),

    deleteFacilityButton: document.getElementById("btnDeleteFacility"),
    ruleList: document.querySelector(".rule-list"),
    ruleSummary: document.querySelector(".rule-summary"),
    expandAll: document.querySelector(".btn-expand-all"),

    addRuleToggle: document.getElementById("modalTambahAturan"),
    editRuleToggle: document.getElementById("modalEditAturan"),
    deleteRuleToggle: document.getElementById("modalHapusAturan"),

    addCriteriaToggle: document.getElementById("modalTambahKriteria"),
    editCriteriaToggle: document.getElementById("modalEditKriteria"),
    deleteCriteriaToggle: document.getElementById("modalHapusKriteria"),

    weightList: document.querySelector(".weight-list"),

    weightTotal: document.querySelector(".weight-total strong"),
    saveWeights: document.querySelector(".btn-save-weight"),

    facilityGroupSlider: document.getElementById("facilityGroupWeightSlider"),

    facilityGroupWeightValue: document.getElementById(
      "facilityGroupWeightValue",
    ),

    weightWarning: document.getElementById("weightWarning"),

    facilityWeightTotal: document.getElementById("totalFacilityWeightValue"),

    facilityWeightWarning: document.getElementById("facilityWeightWarning"),

    saveFacilityWeights: document.querySelector(".btn-save-facility-weight"),
  };

  // Menyalin objek agar data awal tidak berubah.
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  // =========================================
  // KONEKSI API MANAJEMEN FASILITAS
  // =========================================

  async function facilityApiRequest(action, payload = null) {
    try {
      const options = {
        method: payload ? "POST" : "GET",
        headers: {},
      };

      let url = FACILITY_API;

      if (payload) {
        options.headers["Content-Type"] = "application/json";

        options.body = JSON.stringify({
          action,
          ...payload,
        });
      }

      const response = await fetch(url, options);

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Permintaan API gagal.");
      }

      return result;
    } catch (error) {
      console.error("Kesalahan API fasilitas:", error);

      showMessage(error.message || "Gagal menghubungi server.", "error");

      throw error;
    }
  }

  // =========================================
  // KONEKSI API MANAJEMEN ATURAN
  // =========================================

  async function ruleApiRequest(action, payload = null) {
    try {
      const options = {
        method: payload ? "POST" : "GET",
        headers: {},
      };

      let url = RULE_API;

      if (payload) {
        options.headers["Content-Type"] = "application/json";

        options.body = JSON.stringify({
          action,
          ...payload,
        });
      }

      const response = await fetch(url, options);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Permintaan API aturan gagal.");
      }

      return result;
    } catch (error) {
      console.error("Kesalahan API aturan:", error);

      showMessage(error.message || "Gagal menghubungi server aturan.", "error");

      throw error;
    }
  }

  // =========================================
  // KONEKSI API MANAJEMEN KRITERIA
  // =========================================

  async function criteriaApiRequest(action, payload = null, idAturan = null) {
    try {
      let url = CRITERIA_API;

      if (idAturan !== null) {
        url += `?id_aturan=${encodeURIComponent(idAturan)}`;
      }

      const options = {
        method: payload ? "POST" : "GET",
        headers: {},
      };

      if (payload) {
        options.headers["Content-Type"] = "application/json";

        options.body = JSON.stringify({
          action,
          ...payload,
        });
      }

      const response = await fetch(url, options);
      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Permintaan API kriteria gagal.");
      }

      return result;
    } catch (error) {
      console.error("Kesalahan API kriteria:", error);

      showMessage(
        error.message || "Gagal menghubungi server kriteria.",
        "error",
      );

      throw error;
    }
  }

  // =========================================
  // MENGAMBIL KELOMPOK ATURAN DARI DATABASE
  // =========================================

  // =========================================
  // MENGAMBIL ATURAN DAN KRITERIA DARI DATABASE
  // =========================================

  async function loadRulesFromAPI() {
    try {
      const result = await ruleApiRequest("list");

      const rules = await Promise.all(
        result.data.map(async (item) => {
          // Ambil kriteria berdasarkan kelompok aturan.
          const criteriaResult = await criteriaApiRequest(
            "list",
            null,
            item.id_aturan,
          );

          return {
            id: String(item.id_aturan),
            name: item.nama_kelompok,
            description: item.catatan || "",
            weight: Number(item.bobot) || 0,
            ruleType: "scoring",

            criteria: criteriaResult.data.map((criteria, index) => ({
              id: String(criteria.id_aturan_kriteria),
              order: index + 1,
              name: criteria.nama_kriteria,
              description: criteria.catatan || "",
              weight: Number(criteria.bobot) || 0,
              active: true,
            })),
          };
        }),
      );

      state.config.rules = rules;

      renderRules();
      renderWeights();

      console.log("Aturan dan kriteria berhasil dimuat:", rules);
    } catch (error) {
      console.error("Gagal memuat aturan dan kriteria:", error);
    }
  }

  // Mengambil fasilitas dari database.

  async function loadFacilitiesFromAPI() {
    try {
      const result = await facilityApiRequest("list");

      state.config.facilities = result.data.map((item) => ({
        id: String(item.id_fasilitas),
        name: item.nama_fasilitas,
        capacity: Number(item.kapasitas_maksimum),
        weight: Number(item.bobot),
        description: item.deskripsi || "",
        active: true,
      }));

      // Ambil bobot utama fasilitas dari database.
      if (result.data.length > 0) {
        state.config.facilityGroupWeight =
          Number(result.data[0].bobot_utama) || 0;
      }

      renderFacilities();
      renderWeights();
    } catch (error) {
      console.error("Gagal memuat fasilitas:", error);
    }
  }

  // Membuat ID otomatis.
  function createId(prefix, records) {
    const highest = records.reduce((max, item) => {
      const match = String(item.id || "").match(/\d+$/);

      return match ? Math.max(max, Number(match[0])) : max;
    }, 0);

    return `${prefix}${String(highest + 1).padStart(3, "0")}`;
  }

  // Menyimpan konfigurasi.
  function saveConfig() {
    try {
      if (!window.SILABStorage || !STORAGE_KEY) {
        console.error("SILABStorage atau key tidak tersedia.");

        showMessage("Penyimpanan belum tersedia.", "error");

        return false;
      }

      // Simpan konfigurasi.
      const result = window.SILABStorage.set(STORAGE_KEY, state.config);

      if (result === false) {
        throw new Error("Storage menolak penyimpanan.");
      }

      // Verifikasi hasil penyimpanan.
      const verified = window.SILABStorage.get(STORAGE_KEY, null);

      if (
        !verified ||
        JSON.stringify(verified) !== JSON.stringify(state.config)
      ) {
        throw new Error("Verifikasi penyimpanan gagal.");
      }

      return true;
    } catch (error) {
      console.error("Gagal menyimpan konfigurasi:", error);

      showMessage("Gagal menyimpan data. Periksa Console.", "error");

      return false;
    }
  }

  // Mengambil konfigurasi.

  function loadConfig() {
    if (!window.SILABStorage || !STORAGE_KEY) {
      console.error("SILABStorage belum tersedia.");

      return clone(DEFAULT_CONFIG);
    }

    const stored = window.SILABStorage.get(STORAGE_KEY, null);

    // Tidak membuat data bawaan.
    if (!stored || typeof stored !== "object") {
      return clone(DEFAULT_CONFIG);
    }

    return {
      ...clone(DEFAULT_CONFIG),
      ...stored,

      facilityGroupWeight: Number(stored.facilityGroupWeight) || 0,

      // Pastikan fasilitas benar-benar dinamis.
      facilities: Array.isArray(stored.facilities)
        ? stored.facilities.map((facility) => ({
            ...facility,
            weight: Number(facility.weight) || 0,
          }))
        : [],

      // Struktur sementara untuk kompatibilitas renderer lama.
      rules: Array.isArray(stored.rules) ? stored.rules : [],

      groups: Array.isArray(stored.groups) ? stored.groups : [],
    };
  }

  // Menampilkan pesan.

  let toastTimer = null;

  function showMessage(message, type = "success") {
    let toast = document.getElementById("algorithmToast");

    // Membuat elemen toast jika belum tersedia.
    if (!toast) {
      toast = document.createElement("div");

      toast.id = "algorithmToast";
      toast.className = "algorithm-toast";

      toast.setAttribute("role", "status");
      toast.setAttribute("aria-live", "polite");

      const icon = document.createElement("i");

      icon.className = "toast-icon";

      const text = document.createElement("span");

      text.className = "toast-message";

      toast.append(icon, text);

      document.body.appendChild(toast);
    }

    // Mengatur tipe pesan.
    const icon = toast.querySelector(".toast-icon");
    const text = toast.querySelector(".toast-message");

    toast.className = `algorithm-toast ${type}`;

    icon.className =
      type === "error"
        ? "bi bi-exclamation-circle-fill toast-icon"
        : "bi bi-check-circle-fill toast-icon";

    text.textContent = message;

    // Memunculkan toast.
    requestAnimationFrame(() => {
      toast.classList.add("show");
    });

    // Mengatur waktu menghilang.
    clearTimeout(toastTimer);

    toastTimer = setTimeout(() => {
      toast.classList.remove("show");
    }, 3000);
  }

  function closeModal(toggle) {
    if (toggle) toggle.checked = false;
  }

  function openModal(toggle) {
    if (toggle) toggle.checked = true;
  }

  function getModalForm(toggle) {
    return toggle?.nextElementSibling?.querySelector("form.modal-form") || null;
  }

  function getFormFields(form) {
    if (!form) return {};

    return {
      inputs: [...form.querySelectorAll("input")],
      textareas: [...form.querySelectorAll("textarea")],
      selects: [...form.querySelectorAll("select")],
    };
  }

  function getRule(ruleId) {
    return state.config.rules.find((rule) => rule.id === ruleId) || null;
  }

  function getCriteria(rule, criteriaId) {
    return rule?.criteria.find((item) => item.id === criteriaId) || null;
  }

  // =========================================
  // MANAJEMEN FASILITAS
  // =========================================

  // Mengambil fasilitas berdasarkan ID.
  function getFacility(facilityId) {
    return (
      state.config.facilities.find((facility) => facility.id === facilityId) ||
      null
    );
  }

  // Menampilkan seluruh fasilitas.
  function renderFacilities() {
    const list = elements.facilityList;

    if (!list) return;

    list.innerHTML = "";

    const facilities = state.config.facilities;

    // Menghitung ringkasan.
    const totalCapacity = facilities.reduce(
      (total, facility) => total + (Number(facility.capacity) || 0),
      0,
    );

    if (elements.facilityCount) {
      elements.facilityCount.textContent = `${facilities.length} Fasilitas`;
    }

    if (elements.facilityCapacity) {
      elements.facilityCapacity.textContent = `${totalCapacity} Kapasitas`;
    }

    // Tampilan jika belum ada fasilitas.
    if (facilities.length === 0) {
      const empty = document.createElement("div");

      empty.className = "facility-empty";

      empty.textContent =
        "Belum ada fasilitas. Silakan tambahkan fasilitas laboratorium.";

      list.appendChild(empty);

      return;
    }

    // Menampilkan setiap fasilitas.
    facilities.forEach((facility) => {
      const item = document.createElement("div");

      item.className = "facility-item";
      item.dataset.facilityId = facility.id;

      const information = document.createElement("div");

      information.className = "facility-information";

      const name = document.createElement("strong");

      name.textContent = facility.name;

      const description = document.createElement("p");

      description.textContent = facility.description || "Tidak ada deskripsi.";

      information.append(name, description);

      const capacity = document.createElement("span");

      capacity.className = "facility-capacity";

      capacity.innerHTML =
        '<i class="bi bi-box-seam"></i> ' + `${Number(facility.capacity)} Unit`;

      const actions = document.createElement("div");

      actions.className = "facility-actions";

      const editButton = document.createElement("button");

      editButton.type = "button";
      editButton.className = "edit-button";
      editButton.dataset.action = "edit-facility";
      editButton.title = "Edit fasilitas";
      editButton.setAttribute("aria-label", "Edit fasilitas");

      editButton.innerHTML = '<i class="bi bi-pencil-square"></i>';

      const deleteButton = document.createElement("button");

      deleteButton.type = "button";
      deleteButton.className = "delete-button";
      deleteButton.dataset.action = "delete-facility";
      deleteButton.title = "Hapus fasilitas";
      deleteButton.setAttribute("aria-label", "Hapus fasilitas");

      deleteButton.innerHTML = '<i class="bi bi-trash3"></i>';

      actions.append(editButton, deleteButton);

      // Input bobot fasilitas
      const weightWrapper = document.createElement("div");
      weightWrapper.className = "facility-weight-control";

      const weightLabel = document.createElement("label");
      weightLabel.textContent = "Bobot (%)";

      const weightInput = document.createElement("input");

      weightInput.type = "number";
      weightInput.className = "facility-weight-input";
      weightInput.min = "0";
      weightInput.max = "100";
      weightInput.step = "1";
      weightInput.value = Number(facility.weight) || 0;

      weightInput.dataset.facilityId = facility.id;

      weightInput.setAttribute(
        "aria-label",
        `Bobot fasilitas ${facility.name}`,
      );

      weightWrapper.append(weightLabel, weightInput);

      // Gabungkan seluruh elemen
      item.append(information, capacity, weightWrapper, actions);

      list.appendChild(item);
    });
    updateFacilityWeightTotal();
  }

  // Membuka modal tambah fasilitas.
  function openAddFacilityModal() {
    const form = elements.facilityForm;

    if (!form) return;

    form.reset();

    state.selectedFacilityId = null;

    document.getElementById("facilityModalTitle").textContent =
      "Tambah Fasilitas";

    openModal(elements.addFacilityToggle);
  }

  // Membuka modal edit fasilitas.
  function openEditFacilityModal(facilityId) {
    const facility = getFacility(facilityId);

    const form = elements.facilityForm;

    if (!facility || !form) return;

    form.elements.facilityName.value = facility.name;

    form.elements.facilityCapacity.value = facility.capacity;

    form.elements.facilityDescription.value = facility.description || "";

    state.selectedFacilityId = facilityId;

    document.getElementById("facilityModalTitle").textContent =
      "Edit Fasilitas";

    openModal(elements.addFacilityToggle);
  }

  // Menyimpan fasilitas baru atau perubahan fasilitas.

  async function saveFacility(event) {
    event.preventDefault();

    const form = elements.facilityForm;
    if (!form) return;

    const name = form.elements.facilityName.value.trim();
    const capacityInput = form.elements.facilityCapacity.value;
    const description = form.elements.facilityDescription.value.trim();

    const capacity = Number(capacityInput);

    if (!name) {
      return showMessage("Nama fasilitas wajib diisi.", "error");
    }

    if (capacityInput === "" || !Number.isInteger(capacity) || capacity < 1) {
      return showMessage(
        "Kapasitas harus berupa bilangan bulat minimal 1.",
        "error",
      );
    }

    // Validasi nama duplikat.
    const duplicate = state.config.facilities.some(
      (facility) =>
        String(facility.id) !== String(state.selectedFacilityId) &&
        facility.name.toLowerCase() === name.toLowerCase(),
    );

    if (duplicate) {
      return showMessage("Nama fasilitas sudah digunakan.", "error");
    }

    try {
      // MODE EDIT
      if (state.selectedFacilityId) {
        await facilityApiRequest("update", {
          id_fasilitas: Number(state.selectedFacilityId),
          nama_fasilitas: name,
          kapasitas_maksimum: capacity,
          deskripsi: description,
        });

        showMessage("Fasilitas berhasil diperbarui.");
      }

      // MODE TAMBAH
      else {
        await facilityApiRequest("create", {
          nama_fasilitas: name,
          kapasitas_maksimum: capacity,
          deskripsi: description,
        });

        showMessage("Fasilitas berhasil ditambahkan.");
      }

      closeModal(elements.addFacilityToggle);

      state.selectedFacilityId = null;

      form.reset();

      // Ambil ulang data terbaru dari database.
      await loadFacilitiesFromAPI();
    } catch (error) {
      console.error("Gagal menyimpan fasilitas:", error);
    }
  }

  // Membuka konfirmasi hapus fasilitas.
  function confirmDeleteFacility(facilityId) {
    if (!getFacility(facilityId)) return;

    state.deleteFacilityId = facilityId;

    openModal(elements.deleteFacilityToggle);
  }

  // Menghapus fasilitas.

  // Menghapus fasilitas melalui API database.
  async function deleteFacility() {
    const facilityId = state.deleteFacilityId;

    if (!facilityId) return;

    try {
      // Hapus fasilitas melalui API.
      await facilityApiRequest("delete", {
        id_fasilitas: Number(facilityId),
      });

      // Tutup modal konfirmasi.
      closeModal(elements.deleteFacilityToggle);

      // Reset ID fasilitas yang dipilih.
      state.deleteFacilityId = null;

      // Ambil ulang data dari database.
      await loadFacilitiesFromAPI();

      showMessage("Fasilitas berhasil dihapus.");
    } catch (error) {
      console.error("Gagal menghapus fasilitas:", error);
    }
  }

  // Memperbarui ringkasan aturan dan kriteria.
  function renderSummary() {
    if (!elements.ruleSummary) return;

    const totalRules = state.config.rules.length;

    const totalCriteria = state.config.rules.reduce(
      (total, rule) => total + rule.criteria.length,
      0,
    );

    const items = elements.ruleSummary.querySelectorAll(
      ".rule-summary-item span",
    );

    if (items[0]) {
      items[0].textContent = `${totalRules} Aturan`;
    }

    if (items[1]) {
      items[1].textContent = `${totalCriteria} kriteria penilaian`;
    }
  }

  // Menampilkan seluruh Rule Base.
  function renderRules() {
    if (!elements.ruleList) return;

    state.expandedBeforeRender = new Set(
      [...elements.ruleList.querySelectorAll(".rule-item[open]")].map(
        (item) => item.dataset.ruleId,
      ),
    );

    elements.ruleList.innerHTML = "";

    if (state.config.rules.length === 0) {
      const empty = document.createElement("p");

      empty.className = "rule-empty";

      empty.textContent =
        "Belum ada aturan. Pilih Tambah Aturan untuk membuat aturan baru.";

      empty.style.cssText =
        "padding:18px 8px;color:#8291A9;font-size:11px;text-align:center;";

      elements.ruleList.appendChild(empty);

      renderSummary();
      return;
    }

    state.config.rules.forEach((rule) => {
      const details = document.createElement("details");

      details.className = "rule-item";
      details.dataset.ruleId = rule.id;

      details.open =
        state.expandedBeforeRender.size === 0
          ? true
          : state.expandedBeforeRender.has(rule.id);

      const summary = document.createElement("summary");

      summary.className = "rule-item-header";

      const main = document.createElement("div");

      main.className = "rule-main-info";
      const heading = document.createElement("h4");

      heading.textContent = rule.name;

      const description = document.createElement("p");

      description.textContent =
        rule.description || rule.parameter || "Tidak ada deskripsi aturan.";

      main.append(heading, description);

      const actions = document.createElement("div");

      actions.className = "rule-actions";

      const chevron = document.createElement("i");

      chevron.className = "bi bi-chevron-down rule-chevron";

      actions.appendChild(chevron);

      actions.append(
        makeActionButton(
          "edit-button",
          "bi-pencil-square",
          "Edit aturan",
          "edit-rule",
        ),

        makeActionButton(
          "delete-button",
          "bi-trash3",
          "Hapus aturan",
          "delete-rule",
        ),
      );

      summary.append(main, actions);

      details.appendChild(summary);

      // Bagian detail aturan.
      const detail = document.createElement("div");

      detail.className = "rule-detail";

      const criteriaHeading = document.createElement("div");

      criteriaHeading.className = "criteria-heading";

      const criteriaTitle = document.createElement("h5");

      criteriaTitle.textContent = `KRITERIA (${rule.criteria.length})`;

      const addCriteria = document.createElement("button");

      addCriteria.type = "button";
      addCriteria.className = "btn-add-criteria";
      addCriteria.dataset.action = "add-criteria";

      addCriteria.innerHTML = '<i class="bi bi-plus-lg"></i> Tambah Kriteria';

      criteriaHeading.append(criteriaTitle, addCriteria);

      const criteriaList = document.createElement("div");

      criteriaList.className = "criteria-list";

      [...rule.criteria]
        .sort((a, b) => Number(a.order) - Number(b.order))
        .forEach((criteria) => {
          const row = document.createElement("div");

          row.className = "criteria-item";
          row.dataset.criteriaId = criteria.id;

          const information = document.createElement("div");
          information.className = "criteria-information";

          const name = document.createElement("strong");
          name.textContent = criteria.name;

          const text = document.createElement("p");
          text.textContent = criteria.description || "";

          information.append(name, text);

          // Input persentase dengan tombol panah atas/bawah.
          const criteriaWeight = document.createElement("input");

          criteriaWeight.type = "number";
          criteriaWeight.className = "criteria-weight-input";
          criteriaWeight.min = "0";
          criteriaWeight.max = "100";
          criteriaWeight.step = "1";
          const pendingValue =
            state.pendingCriteriaWeights[rule.id]?.[criteria.id];

          criteriaWeight.value =
            pendingValue !== undefined
              ? pendingValue
              : Number(criteria.weight) || 0;
          criteriaWeight.dataset.criteriaId = criteria.id;
          criteriaWeight.dataset.ruleId = rule.id;
          criteriaWeight.setAttribute(
            "aria-label",
            `Persentase ${criteria.name}`,
          );

          const criteriaActions = document.createElement("div");
          criteriaActions.className = "criteria-actions";

          criteriaActions.append(
            makeActionButton(
              "edit-button",
              "bi-pencil-square",
              "Edit kriteria",
              "edit-criteria",
            ),
            makeActionButton(
              "delete-button",
              "bi-trash3",
              "Hapus kriteria",
              "delete-criteria",
            ),
          );

          row.append(information, criteriaWeight, criteriaActions);
          criteriaList.appendChild(row);
        });

      if (rule.criteria.length === 0) {
        const emptyCriteria = document.createElement("p");

        emptyCriteria.textContent = "Belum ada kriteria untuk aturan ini.";

        emptyCriteria.style.cssText =
          "padding:12px;color:#8291A9;font-size:10px;";

        criteriaList.appendChild(emptyCriteria);
      }

      detail.append(criteriaHeading, criteriaList);

      // Ringkasan total persentase kriteria
      const totalWeightRow = document.createElement("div");
      totalWeightRow.className = "criteria-total-row";

      const totalWeightLabel = document.createElement("span");
      totalWeightLabel.textContent = "Total Persentase";

      const totalWeightValue = document.createElement("strong");
      totalWeightValue.className = "criteria-total-value";
      totalWeightValue.dataset.ruleId = rule.id;

      totalWeightRow.append(totalWeightLabel, totalWeightValue);

      detail.appendChild(totalWeightRow);

      // Tombol simpan perubahan bobot kriteria.
      const saveCriteriaButton = document.createElement("button");

      saveCriteriaButton.type = "button";
      saveCriteriaButton.className = "btn-save-criteria-weights";
      saveCriteriaButton.dataset.action = "save-criteria-weights";
      saveCriteriaButton.dataset.ruleId = rule.id;

      saveCriteriaButton.innerHTML =
        'Simpan Perubahan';

      const hasPendingChanges =
        Object.keys(state.pendingCriteriaWeights[rule.id] || {}).length > 0;

      saveCriteriaButton.hidden = !hasPendingChanges;
      saveCriteriaButton.disabled = !hasPendingChanges;
      detail.appendChild(saveCriteriaButton);

      details.appendChild(detail);

      elements.ruleList.appendChild(details);
      updateCriteriaWeightTotal(rule.id);
    });

    renderSummary();
    updateExpandButton();
  }

  // Membuat tombol aksi.
  function makeActionButton(className, iconName, title, action) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = className;
    button.title = title;

    button.setAttribute("aria-label", title);

    button.dataset.action = action;

    const icon = document.createElement("i");

    icon.className = `bi ${iconName}`;

    button.appendChild(icon);

    return button;
  }

  // Memperbarui tombol buka/tutup semua aturan.
  function updateExpandButton() {
    if (!elements.expandAll) return;

    const allItems = [
      ...(elements.ruleList?.querySelectorAll(".rule-item") || []),
    ];

    const allOpen = allItems.length > 0 && allItems.every((item) => item.open);

    elements.expandAll.innerHTML = allOpen
      ? '<i class="bi bi-arrows-angle-contract"></i> Tutup Semua'
      : '<i class="bi bi-arrows-angle-expand"></i> Buka Semua';
  }

  function renderWeights() {
    const weightList = elements.weightList;

    if (!weightList) return;

    weightList.innerHTML = "";

    // Tampilkan seluruh kelompok aturan secara dinamis.
    state.config.rules.forEach((rule) => {
      const weight = Number(rule.weight) || 0;

      const item = document.createElement("div");
      item.className = "weight-item";

      const heading = document.createElement("div");
      heading.className = "weight-heading";

      const information = document.createElement("div");

      const title = document.createElement("strong");
      title.textContent = rule.name;

      const description = document.createElement("small");
      description.textContent = "Bobot kelompok penilaian.";

      information.append(title, description);

      const valueLabel = document.createElement("span");
      valueLabel.className = "weight-value";
      valueLabel.textContent = `${weight}%`;

      heading.append(information, valueLabel);

      const slider = document.createElement("input");

      slider.type = "range";
      slider.className = "weight-slider";
      slider.min = "0";
      slider.max = "100";
      slider.step = "1";
      slider.value = weight;
      slider.dataset.ruleId = rule.id;

      item.append(heading, slider);

      weightList.appendChild(item);
    });

    // Tetap tampilkan bobot Fasilitas Laboratorium.
    if (elements.facilityGroupSlider) {
      elements.facilityGroupSlider.value =
        Number(state.config.facilityGroupWeight) || 0;
    }

    // Hitung total seluruh bobot.
    updateWeightTotal();
  }

  // =========================================
  // PEMBOBOTAN FASILITAS
  // =======================================

  // Menghitung total bobot fasilitas.
  function updateFacilityWeightTotal() {
    const inputs = document.querySelectorAll(".facility-weight-input");

    let total = 0;
    let valid = true;

    inputs.forEach((input) => {
      const value = Number(input.value);

      if (
        input.value === "" ||
        !Number.isInteger(value) ||
        value < 0 ||
        value > 100
      ) {
        input.setCustomValidity("Bobot harus berupa bilangan bulat 0–100.");

        valid = false;
        return;
      }

      input.setCustomValidity("");
      total += value;
    });

    if (!valid) {
      if (elements.facilityWeightWarning) {
        elements.facilityWeightWarning.textContent =
          "Periksa kembali bobot fasilitas.";

        elements.facilityWeightWarning.style.display = "block";
      }

      return null;
    }

    if (elements.facilityWeightTotal) {
      elements.facilityWeightTotal.textContent = `${total}%`;

      elements.facilityWeightTotal.classList.toggle(
        "weight-over-limit",
        total > 100,
      );
    }

    if (elements.facilityWeightWarning) {
      if (total !== 100) {
        elements.facilityWeightWarning.textContent = `Total bobot saat ini ${total}%. Total harus tepat 100%.`;

        elements.facilityWeightWarning.style.display = "block";
      } else {
        elements.facilityWeightWarning.style.display = "none";
      }
    }

    return total;
  }

  // Menyimpan bobot fasilitas.

  async function saveFacilityWeights() {
    // Validasi total bobot harus tepat 100%.
    const total = updateFacilityWeightTotal();

    if (total === null) {
      showMessage("Periksa kembali bobot fasilitas.", "error");
      return;
    }

    if (total !== 100) {
      showMessage("Total bobot fasilitas harus tepat 100%.", "error");
      return;
    }

    // Ambil seluruh input bobot fasilitas.
    const inputs = [...document.querySelectorAll(".facility-weight-input")];

    const weights = inputs.map((input) => ({
      id_fasilitas: Number(input.dataset.facilityId),
      bobot: Number(input.value),
    }));

    try {
      // Kirim bobot ke database melalui API.
      await facilityApiRequest("save_weights", {
        weights: weights,
      });

      // Ambil ulang data terbaru dari database.
      await loadFacilitiesFromAPI();

      showMessage("Pembobotan fasilitas berhasil disimpan.");
    } catch (error) {
      console.error("Gagal menyimpan bobot fasilitas:", error);
    }
  }

  // Menghitung total persentase kriteria, termasuk perubahan sementara.
  function updateCriteriaWeightTotal(ruleId) {
    const rule = getRule(ruleId);
    if (!rule || !elements.ruleList) return 0;

    const pending = state.pendingCriteriaWeights[ruleId] || {};

    const total = rule.criteria.reduce((sum, criteria) => {
      const value = Object.prototype.hasOwnProperty.call(pending, criteria.id)
        ? pending[criteria.id]
        : criteria.weight;

      return sum + (value === "" ? 0 : Number(value) || 0);
    }, 0);

    const display = elements.ruleList.querySelector(
      `.criteria-total-value[data-rule-id="${ruleId}"]`,
    );

    if (display) {
      display.textContent = `${total}%`;
      display.classList.toggle("valid", total === 100);
      display.classList.toggle("invalid", total !== 100);
    }

    return total;
  }

  // Menghitung total bobot.

  function updateWeightTotal() {
    const sliders =
      elements.weightList?.querySelectorAll(".weight-slider") || [];

    let total = 0;

    // Hitung bobot Jenis Kegiatan.
    sliders.forEach((slider) => {
      const value = Number(slider.value);

      total += value;

      const label = slider
        .closest(".weight-item")
        ?.querySelector(".weight-value");

      if (label) {
        label.textContent = `${value}%`;
      }

      const rule = getRule(slider.dataset.ruleId);

      if (rule) {
        rule.weight = value;
      }
    });

    // Hitung bobot Fasilitas Laboratorium.
    const facilitySlider = elements.facilityGroupSlider;

    if (facilitySlider) {
      const facilityWeight = Number(facilitySlider.value);

      state.config.facilityGroupWeight = facilityWeight;

      total += facilityWeight;

      if (elements.facilityGroupWeightValue) {
        elements.facilityGroupWeightValue.textContent = `${facilityWeight}%`;
      }
    }

    // Tampilkan total gabungan.
    if (elements.weightTotal) {
      elements.weightTotal.textContent = `${total}%`;

      elements.weightTotal.classList.toggle("weight-over-limit", total > 100);
    }

    // Tampilkan peringatan.
    if (elements.weightWarning) {
      elements.weightWarning.textContent = `Total bobot saat ini ${total}%. Total harus tepat 100%.`;

      elements.weightWarning.style.display = total === 100 ? "none" : "block";
    }

    return total;
  }

  // Membuka modal tambah aturan.
  function openAddRuleModal() {
    const form = getModalForm(elements.addRuleToggle);

    if (!form) return;

    form.reset();

    state.selectedRuleId = null;

    openModal(elements.addRuleToggle);
  }

  // Membuka modal edit aturan.

  function openEditRuleModal(ruleId) {
    const rule = getRule(ruleId);
    const form = getModalForm(elements.editRuleToggle);

    if (!rule || !form) return;

    form.elements.ruleName.value = rule.name;
    form.elements.ruleDescription.value = rule.description || "";

    state.selectedRuleId = ruleId;

    openModal(elements.editRuleToggle);
  }

  // Membuka modal tambah kriteria.

  function openAddCriteriaModal(ruleId) {
    const rule = getRule(ruleId);
    const form = getModalForm(elements.addCriteriaToggle);

    if (!rule || !form) return;

    if (rule.name.toLowerCase().includes("waktu pengajuan")) {
      showMessage("FCFS tidak menerima kriteria berbobot.", "error");
      return;
    }

    form.reset();

    form.elements.criteriaRuleName.value = rule.name;

    state.selectedRuleId = ruleId;
    state.selectedCriteriaId = null;

    openModal(elements.addCriteriaToggle);
  }

  function openEditCriteriaModal(ruleId, criteriaId) {
    const rule = getRule(ruleId);
    const criteria = getCriteria(rule, criteriaId);
    const form = getModalForm(elements.editCriteriaToggle);

    if (!rule || !criteria || !form) return;

    form.elements.criteriaRuleName.value = rule.name;
    form.elements.criteriaName.value = criteria.name;
    form.elements.criteriaDescription.value = criteria.description || "";

    state.selectedRuleId = ruleId;
    state.selectedCriteriaId = criteriaId;

    openModal(elements.editCriteriaToggle);
  }

  // Validasi form aturan.

  function validateRuleForm(name) {
    if (!name.trim()) {
      return "Nama aturan wajib diisi.";
    }

    if (name.trim().length > 100) {
      return "Nama aturan maksimal 100 karakter.";
    }

    return null;
  }

  // Menyimpan aturan baru.

  // Menyimpan kelompok aturan baru ke database.
  async function saveNewRule() {
    const form = getModalForm(elements.addRuleToggle);

    if (!form) return;

    const name = form.elements.ruleName.value.trim();
    const description = form.elements.ruleDescription.value.trim();

    const error = validateRuleForm(name);

    if (error) {
      return showMessage(error, "error");
    }

    // Validasi nama duplikat.
    const duplicate = state.config.rules.some(
      (rule) => rule.name.toLowerCase() === name.toLowerCase(),
    );

    if (duplicate) {
      return showMessage("Nama aturan tersebut sudah digunakan.", "error");
    }

    try {
      // Simpan ke database melalui API.
      await ruleApiRequest("create", {
        nama_kelompok: name,
        catatan: description,
      });

      // Tutup modal dan kosongkan form.
      form.reset();
      closeModal(elements.addRuleToggle);

      // Ambil ulang data dari database.
      await loadRulesFromAPI();

      showMessage("Kelompok aturan berhasil ditambahkan.");
    } catch (error) {
      console.error("Gagal menambahkan kelompok aturan:", error);
    }
  }

  // Menyimpan perubahan aturan.

  async function saveEditedRule() {
    const rule = getRule(state.selectedRuleId);
    const form = getModalForm(elements.editRuleToggle);

    if (!rule || !form) return;

    const name = form.elements.ruleName.value.trim();
    const description = form.elements.ruleDescription.value.trim();

    const error = validateRuleForm(name);

    if (error) {
      return showMessage(error, "error");
    }

    const duplicate = state.config.rules.some(
      (item) =>
        item.id !== rule.id && item.name.toLowerCase() === name.toLowerCase(),
    );

    if (duplicate) {
      return showMessage("Nama aturan tersebut sudah digunakan.", "error");
    }

    try {
      await ruleApiRequest("update", {
        id_aturan: Number(rule.id),
        nama_kelompok: name,
        catatan: description,
      });

      closeModal(elements.editRuleToggle);

      await loadRulesFromAPI();

      showMessage("Perubahan aturan berhasil disimpan.");
    } catch (error) {
      console.error("Gagal mengedit aturan:", error);
    }
  }

  // Menyimpan kriteria baru.

  // Menyimpan kriteria baru ke database.
  async function saveNewCriteria() {
    const form = getModalForm(elements.addCriteriaToggle);
    if (!form) return;

    const rule = getRule(state.selectedRuleId);

    if (!rule) {
      return showMessage("Kelompok aturan tidak ditemukan.", "error");
    }

    const name = form.elements.criteriaName.value.trim();
    const description = form.elements.criteriaDescription.value.trim();

    if (!name) {
      return showMessage("Nama kriteria wajib diisi.", "error");
    }

    if (name.length > 100) {
      return showMessage("Nama kriteria maksimal 100 karakter.", "error");
    }

    const duplicate = rule.criteria.some(
      (item) => item.name.toLowerCase() === name.toLowerCase(),
    );

    if (duplicate) {
      return showMessage("Nama kriteria sudah digunakan.", "error");
    }

    try {
      // Simpan kriteria melalui API.
      await criteriaApiRequest("create", {
        id_aturan: Number(rule.id),
        nama_kriteria: name,
        catatan: description,
      });

      // Tutup modal.
      closeModal(elements.addCriteriaToggle);
      form.reset();

      // Ambil ulang data dari database.
      await loadRulesFromAPI();

      showMessage("Kriteria berhasil ditambahkan.");
    } catch (error) {
      console.error("Gagal menambahkan kriteria:", error);
    }
  }

  // Menyimpan perubahan informasi kriteria.

  async function saveEditedCriteria() {
    const rule = getRule(state.selectedRuleId);
    const criteria = getCriteria(rule, state.selectedCriteriaId);
    const form = getModalForm(elements.editCriteriaToggle);

    if (!rule || !criteria || !form) return;

    const name = form.elements.criteriaName.value.trim();
    const description = form.elements.criteriaDescription.value.trim();

    if (!name) {
      return showMessage("Nama kriteria wajib diisi.", "error");
    }

    if (name.length > 100) {
      return showMessage("Nama kriteria maksimal 100 karakter.", "error");
    }

    const duplicate = rule.criteria.some(
      (item) =>
        item.id !== criteria.id &&
        item.name.toLowerCase() === name.toLowerCase(),
    );

    if (duplicate) {
      return showMessage("Nama kriteria sudah digunakan.", "error");
    }

    try {
      // Simpan perubahan melalui API.
      await criteriaApiRequest("update", {
        id_aturan_kriteria: Number(criteria.id),
        nama_kriteria: name,
        catatan: description,
      });

      // Tutup modal edit.
      closeModal(elements.editCriteriaToggle);

      // Ambil ulang data dari database.
      await loadRulesFromAPI();

      showMessage("Informasi kriteria berhasil diperbarui.");
    } catch (error) {
      console.error("Gagal memperbarui kriteria:", error);
    }
  }

  // Menghapus aturan atau kriteria terpilih.

  async function deleteSelectedTarget() {
    if (!state.deleteTarget) return;

    const target = state.deleteTarget;

    try {
      // =====================================
      // HAPUS KELOMPOK ATURAN MELALUI API
      // =====================================

      if (target.type === "rule") {
        await ruleApiRequest("delete", {
          id_aturan: Number(target.ruleId),
        });

        closeModal(elements.deleteRuleToggle);

        state.deleteTarget = null;

        await loadRulesFromAPI();

        showMessage("Kelompok aturan berhasil dihapus.");

        return;
      }

      // =====================================
      // HAPUS KRITERIA MELALUI API DATABASE
      // =====================================

      if (target.type === "criteria") {
        await criteriaApiRequest("delete", {
          id_aturan_kriteria: Number(target.criteriaId),
        });

        // Tutup modal konfirmasi.
        closeModal(elements.deleteCriteriaToggle);

        // Bersihkan data sementara.
        delete state.pendingCriteriaWeights[target.ruleId];

        state.deleteTarget = null;

        // Ambil ulang data dari database.
        await loadRulesFromAPI();

        showMessage("Kriteria berhasil dihapus.");

        return;
      }
    } catch (error) {
      console.error("Gagal menghapus data:", error);
    }
  }

  // Menyimpan pembobotan kriteria satu kelompok.

  // Menyimpan pembobotan kriteria satu kelompok ke database.
  async function saveCriteriaWeights(ruleId) {
    const rule = getRule(ruleId);
    if (!rule) return;

    const pending = state.pendingCriteriaWeights[ruleId] || {};

    if (rule.criteria.length === 0) {
      return showMessage("Belum ada kriteria untuk kelompok ini.", "error");
    }

    const proposedWeights = rule.criteria.map((criteria) => {
      const value = Object.prototype.hasOwnProperty.call(pending, criteria.id)
        ? pending[criteria.id]
        : criteria.weight;

      return {
        id: criteria.id,
        weight: Number(value),
      };
    });

    // Validasi bobot.
    const invalid = proposedWeights.some(
      (item) =>
        !Number.isInteger(item.weight) || item.weight < 0 || item.weight > 100,
    );

    if (invalid) {
      showMessage("Setiap bobot harus berupa bilangan bulat 0–100.", "error");
      return;
    }

    // Validasi total harus tepat 100%.
    const total = proposedWeights.reduce((sum, item) => sum + item.weight, 0);

    if (total !== 100) {
      showMessage(`Total bobot kriteria ${total}%. Harus tepat 100%.`, "error");
      return;
    }

    try {
      // Simpan bobot melalui API database.
      await criteriaApiRequest("save_weights", {
        id_aturan: Number(rule.id),

        weights: proposedWeights.map((item) => ({
          id_aturan_kriteria: Number(item.id),
          bobot: item.weight,
        })),
      });

      // Hapus perubahan sementara setelah berhasil.
      delete state.pendingCriteriaWeights[ruleId];

      // Ambil ulang data terbaru dari database.
      await loadRulesFromAPI();

      showMessage("Persentase kriteria berhasil disimpan ke database.");
    } catch (error) {
      console.error("Gagal menyimpan pembobotan kriteria:", error);
    }
  }

  // Menyimpan pembobotan kelompok.

  async function saveWeights() {
    const total = updateWeightTotal();

    if (total !== 100) {
      showMessage(`Total bobot utama ${total}%. Harus tepat 100%.`, "error");
      return;
    }

    const weights = state.config.rules.map((rule) => ({
      id_aturan: Number(rule.id),
      bobot: Number(rule.weight),
    }));

    const facilityWeight = Number(elements.facilityGroupSlider?.value) || 0;

    try {
      await ruleApiRequest("save_main_weights", {
        weights: weights,
        bobot_utama_fasilitas: facilityWeight,
      });

      // Ambil ulang data dari database.
      await loadRulesFromAPI();
      await loadFacilitiesFromAPI();

      showMessage("Seluruh bobot utama berhasil disimpan ke database.");
    } catch (error) {
      console.error("Gagal menyimpan bobot utama:", error);
    }
  }

  function updateCriteriaWeightTotal(ruleId) {
    const rule = getRule(ruleId);
    if (!rule) return;

    const pending = state.pendingCriteriaWeights[ruleId] || {};

    const total = rule.criteria.reduce((sum, criteria) => {
      const value = Object.prototype.hasOwnProperty.call(pending, criteria.id)
        ? pending[criteria.id]
        : criteria.weight;

      return sum + (value === "" ? 0 : Number(value) || 0);
    }, 0);

    const display = elements.ruleList.querySelector(
      `.criteria-total-value[data-rule-id="${ruleId}"]`,
    );

    if (!display) return;

    display.textContent = `${total}%`;

    display.classList.toggle("valid", total === 100);
    display.classList.toggle("invalid", total !== 100);
  }

  // Memasang seluruh event listener.
  function bindEvents() {
    // Membuka modal tambah aturan.
    document
      .querySelector(".btn-add-rule")
      ?.addEventListener("click", (event) => {
        event.preventDefault();

        openAddRuleModal();
      });

    elements.ruleList?.addEventListener("input", (event) => {
      if (!event.target.matches(".criteria-weight-input")) return;

      const input = event.target;
      const ruleId = input.dataset.ruleId;
      const criteriaId = input.dataset.criteriaId;

      const rule = getRule(ruleId);
      const criteria = getCriteria(rule, criteriaId);

      if (!criteria) return;

      const button = elements.ruleList.querySelector(
        `.btn-save-criteria-weights[data-rule-id="${ruleId}"]`,
      );

      if (!state.pendingCriteriaWeights[ruleId]) {
        state.pendingCriteriaWeights[ruleId] = {};
      }

      const value = input.value;

      if (value === "") {
        input.setCustomValidity("");
        state.pendingCriteriaWeights[ruleId][criteriaId] = "";
      } else {
        const number = Number(value);

        if (!Number.isInteger(number) || number < 0 || number > 100) {
          input.setCustomValidity(
            "Persentase harus berupa bilangan bulat 0–100.",
          );
          input.reportValidity();
          return;
        }

        input.setCustomValidity("");

        if (number === Number(criteria.weight)) {
          delete state.pendingCriteriaWeights[ruleId][criteriaId];
        } else {
          state.pendingCriteriaWeights[ruleId][criteriaId] = number;
        }
      }

      const hasChanges =
        Object.keys(state.pendingCriteriaWeights[ruleId]).length > 0;

      updateCriteriaWeightTotal(ruleId);

      if (button) {
        button.hidden = !hasChanges;
        button.disabled = !hasChanges;
      }

      if (!hasChanges) {
        delete state.pendingCriteriaWeights[ruleId];
      }
    });

    // Menangani aksi aturan dan kriteria.
    elements.ruleList?.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-action]");

      if (!actionButton) return;

      const ruleElement = actionButton.closest(".rule-item");

      const ruleId = ruleElement?.dataset.ruleId;

      const criteriaElement = actionButton.closest(".criteria-item");

      const criteriaId = criteriaElement?.dataset.criteriaId;

      const action = actionButton.dataset.action;

      if (action === "edit-rule") {
        event.preventDefault();
        event.stopPropagation();

        openEditRuleModal(ruleId);
      } else if (action === "save-criteria-weights") {
        event.preventDefault();
        event.stopPropagation();

        saveCriteriaWeights(ruleId);
      } else if (action === "delete-rule") {
        event.preventDefault();
        event.stopPropagation();

        state.deleteTarget = {
          type: "rule",
          ruleId,
        };

        openModal(elements.deleteRuleToggle);
      } else if (action === "add-criteria") {
        event.preventDefault();

        openAddCriteriaModal(ruleId);
      } else if (action === "edit-criteria") {
        event.preventDefault();
        event.stopPropagation();

        openEditCriteriaModal(ruleId, criteriaId);
      } else if (action === "delete-criteria") {
        event.preventDefault();
        event.stopPropagation();

        state.deleteTarget = {
          type: "criteria",
          ruleId,
          criteriaId,
        };

        openModal(elements.deleteCriteriaToggle);
      }
    });

    // Membuka dan menutup seluruh Rule Base.
    elements.expandAll?.addEventListener("click", () => {
      const items = [
        ...(elements.ruleList?.querySelectorAll(".rule-item") || []),
      ];

      const shouldOpen = items.some((item) => !item.open);

      items.forEach((item) => {
        item.open = shouldOpen;
      });

      updateExpandButton();
    });

    elements.ruleList?.addEventListener("toggle", updateExpandButton, true);

    // Tombol simpan aturan baru.
    const addRuleForm = getModalForm(elements.addRuleToggle);

    if (addRuleForm) {
      addRuleForm.addEventListener("submit", (event) => {
        event.preventDefault();
        saveNewRule();
      });
    }

    // Tombol simpan perubahan aturan.
    getModalForm(elements.editRuleToggle)
      ?.querySelector(".btn-save-rule")
      ?.addEventListener("click", saveEditedRule);

    // Tombol simpan kriteria baru.
    getModalForm(elements.addCriteriaToggle)
      ?.querySelector(".btn-save-rule")
      ?.addEventListener("click", saveNewCriteria);

    // Tombol simpan perubahan kriteria.
    getModalForm(elements.editCriteriaToggle)
      ?.querySelector(".btn-save-rule")
      ?.addEventListener("click", saveEditedCriteria);

    // Konfirmasi hapus aturan.
    elements.deleteRuleToggle?.nextElementSibling
      ?.querySelector(".btn-delete-confirm")
      ?.addEventListener("click", deleteSelectedTarget);

    // Konfirmasi hapus kriteria.
    elements.deleteCriteriaToggle?.nextElementSibling
      ?.querySelector(".btn-delete-confirm")
      ?.addEventListener("click", deleteSelectedTarget);

    // Mencegah form melakukan reload.
    document.querySelectorAll(".modal-form").forEach((form) => {
      form.addEventListener("submit", (event) => event.preventDefault());
    });

    // Memperbarui total bobot ketika slider digerakkan.

    document.addEventListener("input", (event) => {
      // Slider Jenis Kegiatan.
      if (event.target.matches(".weight-slider")) {
        updateWeightTotal();
      }

      // Slider Fasilitas Laboratorium.
      if (event.target.matches(".facility-group-weight-slider")) {
        updateWeightTotal();
      }
    });

    // Menyimpan perubahan bobot.
    elements.saveWeights?.addEventListener("click", saveWeights);
    // Menyimpan pembobotan fasilitas
    elements.saveFacilityWeights?.addEventListener(
      "click",
      saveFacilityWeights,
    );

    // =========================================
    // EVENT MANAJEMEN FASILITAS
    // =========================================

    // Tombol tambah fasilitas.
    elements.facilityList?.addEventListener("click", (event) => {
      const button = event.target.closest("[data-action]");

      if (!button) return;

      const item = button.closest(".facility-item");

      const facilityId = item?.dataset.facilityId;

      const action = button.dataset.action;

      if (action === "edit-facility") {
        openEditFacilityModal(facilityId);
      }

      if (action === "delete-facility") {
        confirmDeleteFacility(facilityId);
      }
    });

    // Menyimpan fasilitas.
    elements.facilityForm?.addEventListener("submit", saveFacility);

    // Konfirmasi hapus fasilitas.
    elements.deleteFacilityButton?.addEventListener("click", deleteFacility);
  }

  // Inisialisasi halaman.
  async function init() {
    if (!elements.ruleList) {
      console.error("Elemen .rule-list tidak ditemukan.");
      return;
    }

    state.config = loadConfig();

    // Memasang event listener.
    bindEvents();

    // Mengambil kelompok aturan dari database.
    await loadRulesFromAPI();

    // Mengambil fasilitas langsung dari database.
    await loadFacilitiesFromAPI();

    console.log("Manajemen Algoritma SILAB berhasil dimuat.");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
