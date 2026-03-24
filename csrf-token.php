<?php
/**
 * csrf-token.php — Generate a CSRF token for the contact form.
 * Called once via fetch() when the page loads.
 */
session_start();
header('Content-Type: application/json; charset=utf-8');

// Generate token if one doesn't exist yet
if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

echo json_encode(['csrf_token' => $_SESSION['csrf_token']]);
