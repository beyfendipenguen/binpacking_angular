<?php
$secret_key = 'qzeoFLq6SSo7Dah8Y3C';

if (!isset($_GET['key']) || $_GET['key'] != $secret_key) {
    die('Erişim reddedildi.');
}

// AYARLAR
$repo_path = '/home/ind16aricodecom/repositories/binpacking_angular_test';
$branch_name = 'staging';

echo "<h2>IndustriCode Deployment Status</h2>";

// ---------------------------------------------------------
// ADIM 1: GIT PULL (Kodları Sunucuya Çek)
// Modül: VersionControl
// ---------------------------------------------------------
$cmd_pull = "uapi VersionControl update repository_root=$repo_path branch=$branch_name source_repository='{\"remote_name\":\"origin\"}' 2>&1";
exec($cmd_pull, $output_pull);

echo "<h3>Adim 1: Git Pull Islemi</h3><pre>";
print_r($output_pull);
echo "</pre>";

// ---------------------------------------------------------
// ADIM 2: DEPLOY TASKS (Dosyaları Kopyala)
// Modül: VersionControlDeployment (Burayı düzelttik)
// Fonksiyon: create
// ---------------------------------------------------------
$cmd_deploy = "uapi VersionControlDeployment create repository_root=$repo_path 2>&1";
exec($cmd_deploy, $output_deploy);

echo "<h3>Adim 2: Dosya Kopyalama (Deployment)</h3><pre>";
print_r($output_deploy);
echo "</pre>";

// Loglara da yazalım
error_log("Deploy Tetiklendi via Script. Pull Ciktisi: " . json_encode($output_pull) . " | Deploy Ciktisi: " . json_encode($output_deploy));
?>
