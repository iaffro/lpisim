<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }

$dbPath = __DIR__ . '/data/leaderboard.db';
$db = new SQLite3($dbPath);
$db->busyTimeout(3000);
$db->exec('PRAGMA journal_mode=WAL');
$db->exec('
    CREATE TABLE IF NOT EXISTS scores (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        name    TEXT    NOT NULL,
        correct INTEGER NOT NULL,
        total   INTEGER NOT NULL,
        elapsed INTEGER NOT NULL,
        date    TEXT    NOT NULL
    )
');

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $stmt = $db->query('SELECT name, correct, total, elapsed, date FROM scores ORDER BY correct DESC, elapsed ASC LIMIT 200');
    $board = [];
    while ($row = $stmt->fetchArray(SQLITE3_ASSOC)) {
        $board[] = $row;
    }
    echo json_encode($board);
    exit;
}

if ($method === 'POST') {
    $raw   = file_get_contents('php://input');
    $input = json_decode($raw, true);

    if (!$input
        || !isset($input['name'], $input['correct'], $input['total'], $input['elapsed'])
        || !is_string($input['name'])
        || !is_numeric($input['correct'])
        || !is_numeric($input['total'])
        || !is_numeric($input['elapsed'])
    ) {
        http_response_code(400);
        echo json_encode(['error' => 'Invalid payload']);
        exit;
    }

    $stmt = $db->prepare('INSERT INTO scores (name, correct, total, elapsed, date) VALUES (:name, :correct, :total, :elapsed, :date)');
    $stmt->bindValue(':name',    htmlspecialchars(substr(trim($input['name']), 0, 30), ENT_QUOTES, 'UTF-8'));
    $stmt->bindValue(':correct', (int)$input['correct'],      SQLITE3_INTEGER);
    $stmt->bindValue(':total',   max(1, (int)$input['total']), SQLITE3_INTEGER);
    $stmt->bindValue(':elapsed', max(0, (int)$input['elapsed']), SQLITE3_INTEGER);
    $stmt->bindValue(':date',    date('n/j/Y'));
    $stmt->execute();

    echo json_encode(['ok' => true]);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);
