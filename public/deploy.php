<?php
$secret_key = 'qzeoFLq6SSo7Dah8Y3C';

if (!isset($_GET['key']) || $_GET['key'] != $secret_key) {
    die('Erişim reddedildi.');
}

// AYARLAR
// 1. Repo yolunu kontrol et (cPaneldekinin aynısı olmalı)
$repo_path = '/home/ind16aricodecom/repositories/binpacking_angular_test';

// 2. Hangi branch deploy edilecek? (Burası "staging" olmalı)
$branch_name = 'staging';

// LOGLAMA BAŞLANGICI
error_log("Deploy tetiklendi. Hedef Branch: " . $branch_name);

// KOMUTU HAZIRLA
$command = "uapi VersionControl update repository_root=$repo_path branch=$branch_name source_repository='{\"remote_name\":\"origin\"}' 2>&1";

// ÇALIŞTIR
exec($command, $output);

// LOGLAMA SONUCU (Burası cevabı error_log'a yazacak)
error_log("Deploy Sonucu: " . print_r($output, true));

// Ekrana da bas (Manuel tetiklemeler için)
echo "<pre>";
print_r($output);
echo "</pre>";
?>
