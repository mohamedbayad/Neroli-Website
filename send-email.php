<?php
/**
 * send-email.php — Neroli Events Contact Form Handler (Hardened)
 *
 * Security features:
 *   1. Credentials loaded from .env (never hardcoded)
 *   2. Header injection protection (newlines stripped from name/email)
 *   3. CSRF token validation (session-based)
 *   4. Honeypot field ("website") — silent discard if filled
 *   5. IP-based rate limiting (3 submissions per 10 minutes)
 *   6. Full input sanitisation and output escaping
 *
 * Requirements:
 *   composer require phpmailer/phpmailer vlucas/phpdotenv
 */

// ─── SESSION & HEADERS ──────────────────────────────────────────────────────
session_start();
header('Content-Type: application/json; charset=utf-8');

// ─── LOAD DEPENDENCIES ──────────────────────────────────────────────────────
require __DIR__ . '/vendor/autoload.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\SMTP;
use PHPMailer\PHPMailer\Exception;
use Dotenv\Dotenv;

// ─── LOAD .ENV ───────────────────────────────────────────────────────────────
$dotenv = Dotenv::createImmutable(__DIR__);
$dotenv->load();
$dotenv->required(['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'FROM_EMAIL', 'TO_EMAIL']);

// ─── ONLY ACCEPT POST ────────────────────────────────────────────────────────
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed.']);
    exit;
}

// ─── CSRF VALIDATION ─────────────────────────────────────────────────────────
$submittedToken = $_POST['csrf_token'] ?? '';
if (empty($_SESSION['csrf_token']) || !hash_equals($_SESSION['csrf_token'], $submittedToken)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'message' => 'Invalid security token. Please refresh the page and try again.']);
    exit;
}
// Regenerate token after successful validation (one-time use)
$_SESSION['csrf_token'] = bin2hex(random_bytes(32));

// ─── HONEYPOT CHECK ──────────────────────────────────────────────────────────
// If the hidden "website" field is filled, it's a bot.
// Return fake success to avoid tipping off the bot.
if (!empty($_POST['website'] ?? '')) {
    echo json_encode(['success' => true, 'message' => 'Your message has been sent successfully.']);
    exit;
}

// ─── RATE LIMITING (IP-based, file-backed) ───────────────────────────────────
$rateLimitFile = __DIR__ . '/rate_limit.json';
$maxAttempts   = 3;
$windowSeconds = 600; // 10 minutes
$clientIp      = $_SERVER['REMOTE_ADDR'] ?? 'unknown';

$rateLimitData = [];
if (file_exists($rateLimitFile)) {
    $rateLimitData = json_decode(file_get_contents($rateLimitFile), true) ?: [];
}

// Purge expired entries
$now = time();
foreach ($rateLimitData as $ip => $timestamps) {
    $rateLimitData[$ip] = array_filter($timestamps, fn($ts) => ($now - $ts) < $windowSeconds);
    if (empty($rateLimitData[$ip])) {
        unset($rateLimitData[$ip]);
    }
}

// Check current IP
$ipAttempts = $rateLimitData[$clientIp] ?? [];
if (count($ipAttempts) >= $maxAttempts) {
    http_response_code(429);
    echo json_encode(['success' => false, 'message' => 'Too many requests. Please try again in a few minutes.']);
    // Save purged data before exiting
    file_put_contents($rateLimitFile, json_encode($rateLimitData), LOCK_EX);
    exit;
}

// Record this attempt
$rateLimitData[$clientIp][] = $now;
file_put_contents($rateLimitFile, json_encode($rateLimitData), LOCK_EX);

// ─── SANITISE INPUT ──────────────────────────────────────────────────────────
$name    = trim(strip_tags($_POST['name']    ?? ''));
$email   = trim(strip_tags($_POST['email']   ?? ''));
$message = trim(strip_tags($_POST['message'] ?? ''));

// Strip newlines/carriage returns to prevent header injection
$name  = str_replace(["\r", "\n", "%0a", "%0d"], '', $name);
$email = str_replace(["\r", "\n", "%0a", "%0d"], '', $email);

// Length limits
$name    = mb_substr($name, 0, 100);
$email   = mb_substr($email, 0, 254);
$message = mb_substr($message, 0, 5000);

if (empty($name) || empty($email) || empty($message)) {
    echo json_encode(['success' => false, 'message' => 'All fields are required.']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(['success' => false, 'message' => 'Invalid email address.']);
    exit;
}

// ─── CONFIGURATION FROM .ENV ─────────────────────────────────────────────────
$smtpHost   = $_ENV['SMTP_HOST'];
$smtpPort   = (int) $_ENV['SMTP_PORT'];
$smtpSecure = ($smtpPort === 465) ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
$smtpUser   = $_ENV['SMTP_USER'];
$smtpPass   = $_ENV['SMTP_PASS'];
$fromEmail  = $_ENV['FROM_EMAIL'];
$fromName   = $_ENV['FROM_NAME']  ?? 'Neroli Events';
$toEmail    = $_ENV['TO_EMAIL'];
$toName     = $_ENV['TO_NAME']    ?? 'Neroli Events Team';

// ─── SEND EMAIL ──────────────────────────────────────────────────────────────
$mail = new PHPMailer(true);

try {
    // Server settings
    $mail->isSMTP();
    $mail->Host       = $smtpHost;
    $mail->SMTPAuth   = true;
    $mail->Username   = $smtpUser;
    $mail->Password   = $smtpPass;
    $mail->SMTPSecure = $smtpSecure;
    $mail->Port       = $smtpPort;
    $mail->CharSet    = 'UTF-8';

    // Sender & recipient
    $mail->setFrom($fromEmail, $fromName);
    $mail->addAddress($toEmail, $toName);

    // Reply-To (already sanitised above)
    $mail->addReplyTo($email, $name);

    // Email content — HTML (all user data escaped)
    $safeName    = htmlspecialchars($name,    ENT_QUOTES, 'UTF-8');
    $safeEmail   = htmlspecialchars($email,   ENT_QUOTES, 'UTF-8');
    $safeMessage = nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8'));

    $mail->isHTML(true);
    $mail->Subject = "New Inquiry from {$safeName} — Neroli Events";
    $mail->Body    = "
        <div style='font-family: Georgia, serif; color: #121212; max-width: 600px; margin: auto; padding: 32px;'>
            <p style='font-size:11px; letter-spacing:0.2em; text-transform:uppercase; color:#BFA078; margin-bottom:8px;'>New Inquiry</p>
            <h2 style='font-size:28px; font-style:italic; margin-bottom:24px;'>Neroli Events — Contact Form</h2>
            <hr style='border:none; border-top:1px solid #E6E2D8; margin-bottom:24px;'>
            <p style='font-size:13px; color:#7A7A7A; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.1em;'>Name</p>
            <p style='font-size:16px; margin-bottom:20px;'>{$safeName}</p>
            <p style='font-size:13px; color:#7A7A7A; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.1em;'>Email</p>
            <p style='font-size:16px; margin-bottom:20px;'><a href='mailto:{$safeEmail}' style='color:#BFA078;'>{$safeEmail}</a></p>
            <p style='font-size:13px; color:#7A7A7A; margin-bottom:6px; text-transform:uppercase; letter-spacing:0.1em;'>Message</p>
            <p style='font-size:16px; line-height:1.8;'>{$safeMessage}</p>
            <hr style='border:none; border-top:1px solid #E6E2D8; margin-top:32px;'>
            <p style='font-size:11px; color:#7A7A7A; margin-top:16px;'>Sent via nerolievents.com contact form</p>
        </div>
    ";

    // Plain-text alternative (no HTML, safe from injection)
    $mail->AltBody = "New inquiry from " . $name . " (" . $email . "):\n\n" . $message;

    $mail->send();

    echo json_encode(['success' => true, 'message' => 'Your message has been sent successfully.']);

} catch (Exception $e) {
    // Log the real error server-side; return generic message to client
    error_log("PHPMailer Error: " . $mail->ErrorInfo);
    echo json_encode([
        'success' => false,
        'message' => 'We could not send your message right now. Please try again later.'
    ]);
}
