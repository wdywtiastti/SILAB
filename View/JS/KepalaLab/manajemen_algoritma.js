(() => {
  "use strict";

  /*
   * SILAB - Manajemen Algoritma
   * Data simulasi disimpan melalui SILABStorage.
   * Modul ini hanya mengelola konfigurasi.
   */

  const STORAGE_KEY = window.SILABStorage?.KEYS?.ALGORITHM_CONFIG;

  const DEFAULT_CONFIG = {
    rules: [
      {
        id: "RB001",
        name: "Jenis Kegiatan",
        parameter: "Kategori kegiatan",
        description:
          "Mengklasifikasikan jenis kegiatan peminjaman laboratorium berdasarkan tingkat kepentingan akademik dan organisasi untuk menentukan prioritas penggunaan.",
        criteria: [
          {
            id: "CR001",
            order: 1,
            name: "Kelas Pengganti",
            description:
              "Kegiatan pengganti perkuliahan yang memiliki kepentingan akademik.",
          },
          {
            id: "CR002",
            order: 2,
            name: "Asistensi dan Responsi",
            description:
              "Kegiatan pendampingan pembelajaran dan penguatan pemahaman materi.",
          },
          {
            id: "CR003",
            order: 3,
            name: "HMTI",
            description:
              "Kegiatan organisasi Himpunan Mahasiswa Teknik Informatika.",
          },
          {
            id: "CR004",
            order: 4,
            name: "Belajar Mandiri",
            description:
              "Kegiatan belajar mandiri yang dilakukan oleh mahasiswa.",
          },
        ],
      },
      {
        id: "RB002",
        name: "Waktu Pengajuan",
        parameter: "Urutan waktu pengajuan (FCFS)",
        description:
          "Menentukan prioritas pengajuan berdasarkan urutan waktu pengiriman permohonan untuk menyelesaikan bentrokan jadwal dengan kebutuhan fasilitas yang sama.",
        criteria: [
          {
            id: "CR005",
            order: 1,
            name: "Urutan Waktu Pengajuan (FCFS)",
            description:
              "Apabila terjadi bentrokan dengan kebutuhan PC dan kursi yang sama, pengajuan yang dikirim lebih dahulu akan diprioritaskan (FCFS).",
          },
        ],
      },
      {
        id: "RB003",
        name: "Fasilitas Laboratorium",
        parameter: "Jumlah PC dan kursi",
        description:
          "Memeriksa kebutuhan fasilitas komputer dan kursi yang diajukan pengguna agar tidak melebihi kapasitas laboratorium.",
        criteria: [
          {
            id: "CR006",
            order: 1,
            name: "PC",
            description: "Jumlah PC yang diajukan maksimal 36 unit.",
          },
          {
            id: "CR007",
            order: 2,
            name: "Kursi",
            description: "Jumlah kursi yang diajukan maksimal 36 unit.",
          },
        ],
      },
    ],

    weights: {
      jenisKegiatan: 35,
      waktuPengajuan: 20,
      kebutuhanFasilitas: 15,
    },
  };

  const state = {
    config: null,
    selectedRuleId: null,
    selectedCriteriaId: null,
    deleteTarget: null,
    expandedBeforeRender: new Set(),
  };

  const elements = {
    ruleList: document.querySelector(".rule-list"),
    ruleSummary: document.querySelector(".rule-summary"),
    expandAll: document.querySelector(".btn-expand-all"),

    addRuleToggle: document.getElementById("modalTambahAturan"),
    editRuleToggle: document.getElementById("modalEditAturan"),
    deleteRuleToggle: document.getElementById("modalHapusAturan"),

    addCriteriaToggle: document.getElementById("modalTambahKriteria"),
    editCriteriaToggle: document.getElementById("modalEditKriteria"),
    deleteCriteriaToggle: document.getElementById("modalHapusKriteria"),

    weightSliders: [...document.querySelectorAll(".weight-slider")],

    weightTotal: document.querySelector(".weight-total strong"),
    saveWeights: document.querySelector(".btn-save-weight"),
  };

  // Menyalin objek agar data awal tidak berubah.
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
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
    if (!window.SILABStorage || !STORAGE_KEY) {
      console.error("SILABStorage atau key ALGORITHM_CONFIG tidak tersedia.");

      showMessage(
        "Penyimpanan SILAB belum tersedia. Periksa storage.js.",
        "error",
      );

      return false;
    }

    const saved = window.SILABStorage.set(STORAGE_KEY, state.config);

    if (!saved) {
      showMessage("Perubahan gagal disimpan ke LocalStorage.", "error");

      return false;
    }

    return true;
  }

  // Mengambil konfigurasi.
  function loadConfig() {
    if (!window.SILABStorage || !STORAGE_KEY) {
      console.error(
        "Pastikan storage.js dimuat sebelum manajemen_algoritma.js.",
      );

      return clone(DEFAULT_CONFIG);
    }

    const stored = window.SILABStorage.get(STORAGE_KEY, null);

    if (
      !stored ||
      !Array.isArray(stored.rules) ||
      !stored.weights ||
      typeof stored.weights !== "object"
    ) {
      const initial = clone(DEFAULT_CONFIG);

      window.SILABStorage.set(STORAGE_KEY, initial);

      return initial;
    }

    return {
      rules: stored.rules.map((rule) => ({
        ...rule,
        criteria: Array.isArray(rule.criteria) ? rule.criteria : [],
      })),

      weights: {
        ...DEFAULT_CONFIG.weights,
        ...stored.weights,
      },
    };
  }

  // Menampilkan pesan.
  function showMessage(message, type = "success") {
    let feedback = document.getElementById("algorithmFeedback");

    if (!feedback) {
      feedback = document.createElement("p");

      feedback.id = "algorithmFeedback";
      feedback.setAttribute("role", "status");
      feedback.setAttribute("aria-live", "polite");

      feedback.style.cssText =
        "margin:10px 0 0;font-size:11px;line-height:1.5;";

      const panel = document.querySelector(".rule-base-panel");

      if (panel) {
        panel.appendChild(feedback);
      }
    }

    feedback.textContent = message;

    feedback.style.color = type === "error" ? "#B42318" : "#07875E";
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

      heading.append(document.createTextNode(`${rule.id} `));

      const separator = document.createElement("span");

      separator.textContent = "|";

      heading.append(separator, document.createTextNode(` ${rule.name}`));

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

          name.textContent = `${criteria.order}. ${criteria.name}`;

          const text = document.createElement("p");

          text.textContent = criteria.description || "";

          information.append(name, text);

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

          row.append(information, criteriaActions);

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

      details.appendChild(detail);

      elements.ruleList.appendChild(details);
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

  // Menampilkan konfigurasi bobot.
  function renderWeights() {
    const values = [
      state.config.weights.jenisKegiatan,
      state.config.weights.waktuPengajuan,
      state.config.weights.kebutuhanFasilitas,
    ];

    elements.weightSliders.forEach((slider, index) => {
      const value = Number(values[index] ?? 0);

      slider.value = value;

      const valueLabel = slider
        .closest(".weight-item")
        ?.querySelector(".weight-value");

      if (valueLabel) {
        valueLabel.textContent = `${value}%`;
      }
    });

    updateWeightTotal();
  }

  // Menghitung total bobot.
  function updateWeightTotal() {
    const total = elements.weightSliders.reduce(
      (sum, slider) => sum + Number(slider.value || 0),
      0,
    );

    if (elements.weightTotal) {
      elements.weightTotal.textContent = `${total}%`;
    }

    return total;
  }

  // Membuka modal tambah aturan.
  function openAddRuleModal() {
    const form = getModalForm(elements.addRuleToggle);

    if (!form) return;

    form.reset();

    const { inputs } = getFormFields(form);

    if (inputs[0]) {
      inputs[0].value = createId("RB", state.config.rules);
    }

    state.selectedRuleId = null;

    openModal(elements.addRuleToggle);
  }

  // Membuka modal edit aturan.
  function openEditRuleModal(ruleId) {
    const rule = getRule(ruleId);

    const form = getModalForm(elements.editRuleToggle);

    if (!rule || !form) return;

    const { inputs, textareas } = getFormFields(form);

    if (inputs[0]) inputs[0].value = rule.id;
    if (inputs[1]) inputs[1].value = rule.name;
    if (inputs[2]) inputs[2].value = rule.parameter || "";

    if (textareas[0]) {
      textareas[0].value = rule.description || "";
    }

    state.selectedRuleId = ruleId;

    openModal(elements.editRuleToggle);
  }

  // Membuka modal tambah kriteria.
  function openAddCriteriaModal(ruleId) {
    const rule = getRule(ruleId);

    const form = getModalForm(elements.addCriteriaToggle);

    if (!rule || !form) return;

    form.reset();

    const { inputs, selects } = getFormFields(form);

    if (selects[0]) {
      selects[0].innerHTML = "";

      state.config.rules.forEach((item) => {
        const option = document.createElement("option");

        option.value = item.id;

        option.textContent = `${item.id} - ${item.name}`;

        option.selected = item.id === ruleId;

        selects[0].appendChild(option);
      });
    }

    const nextOrder =
      rule.criteria.reduce(
        (max, item) => Math.max(max, Number(item.order) || 0),
        0,
      ) + 1;

    if (inputs[0]) {
      inputs[0].value = nextOrder;
    }

    state.selectedRuleId = ruleId;
    state.selectedCriteriaId = null;

    openModal(elements.addCriteriaToggle);
  }

  // Membuka modal edit kriteria.
  function openEditCriteriaModal(ruleId, criteriaId) {
    const rule = getRule(ruleId);

    const criteria = getCriteria(rule, criteriaId);

    const form = getModalForm(elements.editCriteriaToggle);

    if (!rule || !criteria || !form) return;

    const { inputs, textareas } = getFormFields(form);

    if (inputs[0]) {
      inputs[0].value = `${rule.id} - ${rule.name}`;
    }

    if (inputs[1]) {
      inputs[1].value = criteria.order;
    }

    if (inputs[2]) {
      inputs[2].value = criteria.name;
    }

    if (textareas[0]) {
      textareas[0].value = criteria.description || "";
    }

    state.selectedRuleId = ruleId;
    state.selectedCriteriaId = criteriaId;

    openModal(elements.editCriteriaToggle);
  }

  // Validasi form aturan.
  function validateRuleForm(name, parameter) {
    if (!name.trim()) {
      return "Nama aturan wajib diisi.";
    }

    if (!parameter.trim()) {
      return "Kebutuhan atau parameter aturan wajib diisi.";
    }

    if (name.trim().length > 100) {
      return "Nama aturan maksimal 100 karakter.";
    }

    return null;
  }

  // Menyimpan aturan baru.
  function saveNewRule() {
    const form = getModalForm(elements.addRuleToggle);

    const { inputs, textareas } = getFormFields(form);

    const id = inputs[0]?.value || createId("RB", state.config.rules);

    const name = inputs[1]?.value || "";

    const parameter = inputs[2]?.value || "";

    const description = textareas[0]?.value || "";

    const error = validateRuleForm(name, parameter);

    if (error) {
      return showMessage(error, "error");
    }

    const duplicate = state.config.rules.some(
      (rule) => rule.name.toLowerCase() === name.trim().toLowerCase(),
    );

    if (duplicate) {
      return showMessage("Nama aturan tersebut sudah digunakan.", "error");
    }

    state.config.rules.push({
      id,
      name: name.trim(),
      parameter: parameter.trim(),
      description: description.trim(),
      criteria: [],
    });

    if (saveConfig()) {
      closeModal(elements.addRuleToggle);

      renderRules();

      showMessage("Aturan baru berhasil ditambahkan.");
    }
  }

  // Menyimpan perubahan aturan.
  function saveEditedRule() {
    const rule = getRule(state.selectedRuleId);

    const form = getModalForm(elements.editRuleToggle);

    if (!rule || !form) return;

    const { inputs, textareas } = getFormFields(form);

    const name = inputs[1]?.value || "";

    const parameter = inputs[2]?.value || "";

    const description = textareas[0]?.value || "";

    const error = validateRuleForm(name, parameter);

    if (error) {
      return showMessage(error, "error");
    }

    const duplicate = state.config.rules.some(
      (item) =>
        item.id !== rule.id &&
        item.name.toLowerCase() === name.trim().toLowerCase(),
    );

    if (duplicate) {
      return showMessage("Nama aturan tersebut sudah digunakan.", "error");
    }

    rule.name = name.trim();

    rule.parameter = parameter.trim();

    rule.description = description.trim();

    if (saveConfig()) {
      closeModal(elements.editRuleToggle);

      renderRules();

      showMessage("Perubahan aturan berhasil disimpan.");
    }
  }

  // Menyimpan kriteria baru.
  function saveNewCriteria() {
    const form = getModalForm(elements.addCriteriaToggle);

    const { inputs, textareas, selects } = getFormFields(form);

    const ruleId = selects[0]?.value;

    const rule = getRule(ruleId);

    const order = Number(inputs[0]?.value);

    const name = inputs[1]?.value || "";

    const description = textareas[0]?.value || "";

    if (!rule) {
      return showMessage("Pilih aturan yang valid.", "error");
    }

    if (!Number.isInteger(order) || order < 1) {
      return showMessage(
        "Nomor urut harus berupa bilangan bulat minimal 1.",
        "error",
      );
    }

    if (!name.trim()) {
      return showMessage("Nama kriteria wajib diisi.", "error");
    }

    if (!description.trim()) {
      return showMessage("Deskripsi kriteria wajib diisi.", "error");
    }

    if (rule.criteria.some((item) => Number(item.order) === order)) {
      return showMessage(
        "Nomor urut tersebut sudah digunakan pada aturan ini.",
        "error",
      );
    }

    const allCriteria = state.config.rules.flatMap((item) => item.criteria);

    rule.criteria.push({
      id: createId("CR", allCriteria),
      order,
      name: name.trim(),
      description: description.trim(),
    });

    rule.criteria.sort((a, b) => Number(a.order) - Number(b.order));

    if (saveConfig()) {
      closeModal(elements.addCriteriaToggle);

      renderRules();

      showMessage("Kriteria berhasil ditambahkan.");
    }
  }

  // Menyimpan perubahan kriteria.
  function saveEditedCriteria() {
    const rule = getRule(state.selectedRuleId);

    const criteria = getCriteria(rule, state.selectedCriteriaId);

    const form = getModalForm(elements.editCriteriaToggle);

    if (!rule || !criteria || !form) return;

    const { inputs, textareas } = getFormFields(form);

    const order = Number(inputs[1]?.value);

    const name = inputs[2]?.value || "";

    const description = textareas[0]?.value || "";

    if (!Number.isInteger(order) || order < 1) {
      return showMessage(
        "Nomor urut harus berupa bilangan bulat minimal 1.",
        "error",
      );
    }

    if (!name.trim()) {
      return showMessage("Nama kriteria wajib diisi.", "error");
    }

    if (!description.trim()) {
      return showMessage("Deskripsi kriteria wajib diisi.", "error");
    }

    if (
      rule.criteria.some(
        (item) => item.id !== criteria.id && Number(item.order) === order,
      )
    ) {
      return showMessage(
        "Nomor urut tersebut sudah digunakan pada aturan ini.",
        "error",
      );
    }

    criteria.order = order;

    criteria.name = name.trim();

    criteria.description = description.trim();

    rule.criteria.sort((a, b) => Number(a.order) - Number(b.order));

    if (saveConfig()) {
      closeModal(elements.editCriteriaToggle);

      renderRules();

      showMessage("Perubahan kriteria berhasil disimpan.");
    }
  }

  // Menghapus aturan atau kriteria terpilih.
  function deleteSelectedTarget() {
    if (!state.deleteTarget) return;

    if (state.deleteTarget.type === "rule") {
      state.config.rules = state.config.rules.filter(
        (rule) => rule.id !== state.deleteTarget.ruleId,
      );
    } else {
      const rule = getRule(state.deleteTarget.ruleId);

      if (rule) {
        rule.criteria = rule.criteria.filter(
          (item) => item.id !== state.deleteTarget.criteriaId,
        );

        // Merapikan nomor urut setelah penghapusan.
        rule.criteria
          .sort((a, b) => Number(a.order) - Number(b.order))
          .forEach((item, index) => {
            item.order = index + 1;
          });
      }
    }

    if (saveConfig()) {
      closeModal(
        state.deleteTarget.type === "rule"
          ? elements.deleteRuleToggle
          : elements.deleteCriteriaToggle,
      );

      state.deleteTarget = null;

      renderRules();

      showMessage("Data berhasil dihapus.");
    }
  }

  // Menyimpan konfigurasi bobot.
  function saveWeights() {
    state.config.weights = {
      jenisKegiatan: Number(elements.weightSliders[0]?.value || 0),

      waktuPengajuan: Number(elements.weightSliders[1]?.value || 0),

      kebutuhanFasilitas: Number(elements.weightSliders[2]?.value || 0),
    };

    if (saveConfig()) {
      updateWeightTotal();

      showMessage("Konfigurasi bobot berhasil disimpan.");
    }
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
    getModalForm(elements.addRuleToggle)
      ?.querySelector(".btn-save-rule")
      ?.addEventListener("click", saveNewRule);

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
    elements.weightSliders.forEach((slider) => {
      slider.addEventListener("input", updateWeightTotal);
    });

    // Menyimpan perubahan bobot.
    elements.saveWeights?.addEventListener("click", saveWeights);
  }

  // Inisialisasi halaman.
  function init() {
    if (!elements.ruleList) {
      console.error("Elemen .rule-list tidak ditemukan.");

      return;
    }

    state.config = loadConfig();

    renderRules();

    renderWeights();

    bindEvents();

    console.log("Manajemen Algoritma SILAB berhasil dimuat.");
  }

  document.addEventListener("DOMContentLoaded", init);
})();
