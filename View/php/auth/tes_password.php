<?php
declare(strict_types=1);

require_once __DIR__ . "/../../config/database.php";

$npm = $_POST["npm"] ?? "";
$password = $_POST["password"] ?? "";

$hasil = null;
$akunDitemukan = false;
$panjangHash = null;

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    $stmt = $pdo->prepare(
        "SELECT password FROM users WHERE nip_npm = :npm LIMIT 1"
    );

    $stmt->execute([":npm" => trim($npm)]);

    $user = $stmt->fetch();

    if (!$user) {
        $hasil = "NPM TIDAK DITEMUKAN";
    } else {
        $akunDitemukan = true;
        $panjangHash = strlen($user["password"]);

        if (password_verify($password, $user["password"])) {
            $hasil = "PASSWORD COCOK";
        } else {
            $hasil = "PASSWORD TIDAK COCOK";
        }
    }
}
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Tes Password SILAB</title>
</head>
<body>

<h2>Pengujian Password SILAB</h2>

<form method="POST">

    <label>NIP/NPM</label><br>

    <input
        type="text"
        name="npm"
        value="<?= htmlspecialchars($npm) ?>"
        required
    >

    <br><br>

    <label>Password</label><br>

<input
    type="password"
    name="password"
    id="password"
    required
>

    <br><br>

    <button type="submit">Periksa Password</button>

</form>

<?php if ($hasil !== null): ?>

    <hr>

    <p>
        Akun ditemukan:
        <strong><?= $akunDitemukan ? "YA" : "TIDAK" ?></strong>
    </p>

    <?php if ($akunDitemukan): ?>
        <p>Panjang hash: <?= $panjangHash ?></p>
    <?php endif; ?>

    <h3><?= htmlspecialchars($hasil) ?></h3>

<?php endif; ?>

<script>
const form = document.querySelector("form");

form.addEventListener("submit", function () {
    sessionStorage.setItem(
        "tesPassword",
        document.getElementById("password").value
    );
});

window.addEventListener("pageshow", function () {
    const password = sessionStorage.getItem("tesPassword");

    if (password !== null) {
        document.getElementById("password").value = password;
        sessionStorage.removeItem("tesPassword");
    }
});
</script>

</body>
</html>
