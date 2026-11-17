<?php

session_start();

require_once __DIR__ . "/../../config/database.php";

$error = "";
$berhasil = false;

// Hanya boleh membuat akun awal jika tabel masih kosong
$stmt = $pdo->query("SELECT COUNT(*) FROM users");
$totalUsers = (int) $stmt->fetchColumn();

if ($totalUsers > 0) {
    exit("Akun awal sudah dibuat. Hapus file ini dari server.");
}

if ($_SERVER["REQUEST_METHOD"] === "POST") {

    $nipNpm = trim($_POST["nip_npm"] ?? "");
    $nama = trim($_POST["nama"] ?? "");
    $noTelepon = trim($_POST["no_telepon"] ?? "");
    $password = $_POST["password"] ?? "";

    if (
        $nipNpm === "" ||
        $nama === "" ||
        $noTelepon === "" ||
        $password === ""
    ) {
        $error = "Semua kolom wajib diisi.";

    } elseif (!preg_match('/^[0-9]+$/', $nipNpm)) {
        $error = "NIP/NPM harus berupa angka.";

    } elseif (strlen($password) < 8) {
        $error = "Password minimal 8 karakter.";

    } else {

        try {

            $passwordHash = password_hash(
                $password,
                PASSWORD_DEFAULT
            );

            $sql = "
                INSERT INTO users
                (role, nip_npm, nama, no_telepon, password, status)
                VALUES
                (:role, :nip_npm, :nama, :no_telepon, :password, :status)
            ";

            $stmt = $pdo->prepare($sql);

            $stmt->execute([
                ":role" => "kepala_lab",
                ":nip_npm" => $nipNpm,
                ":nama" => $nama,
                ":no_telepon" => $noTelepon,
                ":password" => $passwordHash,
                ":status" => "aktif"
            ]);

            $berhasil = true;

        } catch (PDOException $e) {
            error_log($e->getMessage());
            $error = "Gagal membuat akun. Periksa data yang dimasukkan.";
        }
    }
}
?>

<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <title>Buat Akun Kepala Lab | SILAB</title>
</head>
<body>

    <h2>Buat Akun Kepala Laboratorium</h2>

    <?php if ($berhasil): ?>

        <p>Akun Kepala Lab berhasil dibuat!</p>
        <p>Silakan hapus file buat_kepala_lab.php dari server.</p>
        <a href="/HTML/auth/login.php">Ke halaman login</a>

    <?php else: ?>

        <?php if ($error): ?>
            <p style="color:red;">
                <?= htmlspecialchars($error) ?>
            </p>
        <?php endif; ?>

        <form method="POST">

            <label>NIP</label><br>
            <input type="text" name="nip_npm"
                   inputmode="numeric" required><br><br>

            <label>Nama Lengkap</label><br>
            <input type="text" name="nama" required><br><br>

            <label>Nomor Telepon</label><br>
            <input type="text" name="no_telepon" required><br><br>

            <label>Password</label><br>
            <input type="password" name="password"
                   minlength="8" required><br><br>

            <button type="submit">Buat Akun Kepala Lab</button>

        </form>

    <?php endif; ?>

</body>
</html>
