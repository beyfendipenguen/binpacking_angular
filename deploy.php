<?php
$secret_key = '5CUWpFvTW38bH4x3xx9';

if ($_GET['key'] != $secret_key) {
    die('Access denied.');
}

$cpanel_user = 'ind16aricodecom';
$repo_path = '/home/ind16aricodecom/repositories/binpacking_angular';

error_log("Deploy triggered: " . date("Y-m-d H:i:s"));

$command = "uapi VersionControl update repository_root=$repo_path branch=master source_repository='{\"remote_name\":\"origin\"}' 2>&1";

exec($command, $output);

echo "<pre>";
print_r($output);
echo "</pre>";
?>
