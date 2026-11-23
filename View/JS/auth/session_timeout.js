
(() => {
    const BATAS_WAKTU = 5 * 60 * 1000; // 5 menit

    const LOGOUT_URL =
        "/SILAB/View/html/auth/logout.php";

    let timer;

    function mulaiTimer() {
        clearTimeout(timer);

        timer = setTimeout(() => {
            alert(
                "Sesi Anda telah berakhir karena tidak ada aktivitas selama 5 menit."
            );

            window.location.replace(
                LOGOUT_URL + "?reason=timeout"
            );

        }, BATAS_WAKTU);
    }

    const aktivitas = [
        "mousemove",
        "mousedown",
        "keydown",
        "scroll",
        "touchstart",
        "click"
    ];

    aktivitas.forEach(event => {
        document.addEventListener(
            event,
            mulaiTimer,
            { passive: true }
        );
    });

    // Mulai hitungan saat halaman dibuka
    mulaiTimer();

})();
