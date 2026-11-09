(function (window) {
  "use strict";

  // Memeriksa apakah input kosong
  function isRequired(value) {
    return value !== null && value !== undefined && String(value).trim() !== "";
  }

  // Menyediakan fungsi untuk seluruh halaman
  window.SILABValidation = Object.freeze({
    isRequired,
  });
})(window);
