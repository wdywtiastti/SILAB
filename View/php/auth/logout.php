<?php

declare(strict_types=1);

require_once __DIR__ . "/sesi.php";

logoutSILAB();

header("Location: login.php");
exit;