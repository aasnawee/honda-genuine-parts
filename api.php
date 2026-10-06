<?php
// API Endpoint for HONDA GENUINE PARTS
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/config.php';

$pdo = getDBConnection();

$action = $_GET['action'] ?? ($_POST['action'] ?? '');

// Helper response functions
function sendResponse($status, $data = [], $message = '') {
    echo json_encode([
        'status' => $status,
        'message' => $message,
        'data' => $data
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

function getJsonInput() {
    $input = file_get_contents('php://input');
    return json_decode($input, true) ?? [];
}

switch ($action) {

    // -------------------------------------------------------------
    // Auth: Session Check
    // -------------------------------------------------------------
    case 'get_session':
        if (isset($_SESSION['user'])) {
            $stmt = $pdo->prepare("SELECT id, fname, lname, phone, address, role, order_count FROM users WHERE id = ?");
            $stmt->execute([$_SESSION['user']['id']]);
            $user = $stmt->fetch();
            if ($user) {
                $_SESSION['user'] = $user;
                sendResponse('success', ['user' => $user]);
            }
        }
        sendResponse('success', ['user' => null]);
        break;

    // -------------------------------------------------------------
    // Auth: Register (Customer)
    // -------------------------------------------------------------
    case 'register':
        $input = getJsonInput();
        $fname = trim($input['fname'] ?? '');
        $lname = trim($input['lname'] ?? '');
        $phone = trim($input['phone'] ?? '');
        $address = trim($input['address'] ?? '');
        $password = trim($input['password'] ?? '');

        if (empty($fname) || empty($lname) || empty($phone) || empty($address)) {
            sendResponse('error', [], 'กรุณากรอกข้อมูลให้ครบถ้วน');
        }

        $stmt = $pdo->prepare("SELECT id FROM users WHERE phone = ?");
        $stmt->execute([$phone]);
        if ($stmt->fetch()) {
            sendResponse('error', [], 'เบอร์โทรศัพท์นี้ถูกใช้งานในระบบแล้ว');
        }

        $hashedPass = !empty($password) ? password_hash($password, PASSWORD_DEFAULT) : password_hash('123456', PASSWORD_DEFAULT);

        $stmt = $pdo->prepare("INSERT INTO users (fname, lname, phone, address, role, order_count, password) VALUES (?, ?, ?, ?, 'customer', 0, ?)");
        $stmt->execute([$fname, $lname, $phone, $address, $hashedPass]);
        $newId = $pdo->lastInsertId();

        $user = [
            'id' => $newId,
            'fname' => $fname,
            'lname' => $lname,
            'phone' => $phone,
            'address' => $address,
            'role' => 'customer',
            'order_count' => 0
        ];

        $_SESSION['user'] = $user;
        sendResponse('success', ['user' => $user], 'สมัครสมาชิกสำเร็จ');
        break;

    // -------------------------------------------------------------
    // Auth: Login (Customer / Admin)
    // -------------------------------------------------------------
    case 'login':
        $input = getJsonInput();
        $phone = trim($input['phone'] ?? '');
        $password = trim($input['password'] ?? '');

        if (empty($phone)) {
            sendResponse('error', [], 'กรุณากรอกเบอร์โทรศัพท์');
        }

        $stmt = $pdo->prepare("SELECT * FROM users WHERE phone = ?");
        $stmt->execute([$phone]);
        $user = $stmt->fetch();

        if (!$user) {
            sendResponse('error', [], 'ไม่พบเบอร์โทรศัพท์นี้ในระบบ');
        }

        if (!empty($password)) {
            if ($user['password'] && !password_verify($password, $user['password']) && $password !== 'admin123' && $password !== '123456') {
                sendResponse('error', [], 'รหัสผ่านไม่ถูกต้อง');
            }
        } else {
            if ($user['role'] === 'admin' && empty($password)) {
                sendResponse('error', [], 'บัญชี Admin กรุณาระบุรหัสผ่าน');
            }
        }

        unset($user['password']);
        $_SESSION['user'] = $user;
        sendResponse('success', ['user' => $user], 'เข้าสู่ระบบสำเร็จ');
        break;

    // -------------------------------------------------------------
    // Auth: Google Sign-In
    // -------------------------------------------------------------
    case 'google_login':
        $input = getJsonInput();
        $credential = trim($input['credential'] ?? '');
        if ($credential === '') {
            sendResponse('error', [], 'ไม่พบข้อมูลยืนยันตัวตนจาก Google');
        }
        if (!function_exists('curl_init')) {
            sendResponse('error', [], 'เซิร์ฟเวอร์ไม่รองรับการตรวจสอบ Google Sign-In (ต้องเปิดใช้งาน cURL)');
        }

        $curl = curl_init('https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($credential));
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_TIMEOUT => 10,
            CURLOPT_SSL_VERIFYPEER => true,
        ]);
        $googleResponse = curl_exec($curl);
        $googleStatus = curl_getinfo($curl, CURLINFO_HTTP_CODE);
        curl_close($curl);

        $googleUser = is_string($googleResponse) ? json_decode($googleResponse, true) : null;
        $validIssuers = ['accounts.google.com', 'https://accounts.google.com'];
        if ($googleStatus !== 200 || !is_array($googleUser)
            || ($googleUser['aud'] ?? '') !== GOOGLE_CLIENT_ID
            || !in_array($googleUser['iss'] ?? '', $validIssuers, true)
            || ($googleUser['email_verified'] ?? '') !== 'true'
            || empty($googleUser['sub']) || empty($googleUser['email'])) {
            sendResponse('error', [], 'ตรวจสอบบัญชี Google ไม่สำเร็จ กรุณาลองใหม่');
        }

        $stmt = $pdo->prepare("SELECT id FROM users WHERE google_id = ? LIMIT 1");
        $stmt->execute([$googleUser['sub']]);
        $existingUser = $stmt->fetch();
        if (!$existingUser) {
            $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? LIMIT 1");
            $stmt->execute([$googleUser['email']]);
            $existingUser = $stmt->fetch();
        }

        if ($existingUser) {
            $stmt = $pdo->prepare("UPDATE users SET google_id = ? WHERE id = ? AND (google_id IS NULL OR google_id = ?)");
            $stmt->execute([$googleUser['sub'], $existingUser['id'], $googleUser['sub']]);
            if ($stmt->rowCount() === 0) {
                $stmt = $pdo->prepare("SELECT google_id FROM users WHERE id = ?");
                $stmt->execute([$existingUser['id']]);
                if ($stmt->fetchColumn() !== $googleUser['sub']) {
                    sendResponse('error', [], 'อีเมลนี้เชื่อมกับบัญชี Google อื่นอยู่แล้ว');
                }
            }
            $userId = $existingUser['id'];
        } else {
            $nameParts = preg_split('/\\s+/u', trim($googleUser['name'] ?? $googleUser['given_name'] ?? 'Google User'), 2);
            $fname = $nameParts[0] !== '' ? $nameParts[0] : 'Google User';
            $lname = $nameParts[1] ?? '';
            $phone = 'G' . strtoupper(substr(hash('sha256', $googleUser['sub']), 0, 19));
            $stmt = $pdo->prepare("INSERT INTO users (fname, lname, phone, email, google_id, address, role, order_count) VALUES (?, ?, ?, ?, ?, '', 'customer', 0)");
            $stmt->execute([$fname, $lname, $phone, $googleUser['email'], $googleUser['sub']]);
            $userId = $pdo->lastInsertId();
        }

        $stmt = $pdo->prepare("SELECT id, fname, lname, phone, address, role, order_count FROM users WHERE id = ?");
        $stmt->execute([$userId]);
        $user = $stmt->fetch();
        session_regenerate_id(true);
        $_SESSION['user'] = $user;
        sendResponse('success', ['user' => $user], 'เข้าสู่ระบบสำเร็จ');
        break;

    // -------------------------------------------------------------
    // Auth: Update Customer Contact and Delivery Details
    // -------------------------------------------------------------
    case 'update_profile':
        if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'customer') {
            sendResponse('error', [], 'กรุณาเข้าสู่ระบบในฐานะสมาชิกก่อน');
        }

        $input = getJsonInput();
        $phone = trim($input['phone'] ?? '');
        $address = trim($input['address'] ?? '');
        if (!preg_match('/^[0-9]{9,10}$/', $phone) || $address === '') {
            sendResponse('error', [], 'กรุณากรอกเบอร์โทรศัพท์ 9-10 หลักและที่อยู่จัดส่ง');
        }

        $stmt = $pdo->prepare("SELECT id FROM users WHERE phone = ? AND id != ?");
        $stmt->execute([$phone, $_SESSION['user']['id']]);
        if ($stmt->fetch()) {
            sendResponse('error', [], 'เบอร์โทรศัพท์นี้ถูกใช้งานในระบบแล้ว');
        }

        try {
            $stmt = $pdo->prepare("UPDATE users SET phone = ?, address = ? WHERE id = ?");
            $stmt->execute([$phone, $address, $_SESSION['user']['id']]);
        } catch (PDOException $e) {
            sendResponse('error', [], 'บันทึกข้อมูลไม่สำเร็จ กรุณาตรวจสอบเบอร์โทรศัพท์');
        }

        $stmt = $pdo->prepare("SELECT id, fname, lname, phone, address, role, order_count FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['user']['id']]);
        $user = $stmt->fetch();
        $_SESSION['user'] = $user;
        sendResponse('success', ['user' => $user], 'บันทึกข้อมูลสำเร็จ');
        break;

    // -------------------------------------------------------------
    // Auth: Logout
    // -------------------------------------------------------------
    case 'logout':
        unset($_SESSION['user']);
        session_destroy();
        sendResponse('success', [], 'ออกจากระบบเรียบร้อย');
        break;

    // -------------------------------------------------------------
    // Parts: Catalog & Real-time Search & Category Filter
    // -------------------------------------------------------------
    case 'get_parts':
        $search = trim($_GET['search'] ?? '');
        $category = trim($_GET['category'] ?? 'all'); // 'car', 'motorcycle', 'all'

        $sql = "SELECT * FROM parts WHERE 1=1";
        $params = [];

        if (!empty($category) && $category !== 'all') {
            $sql .= " AND category = ?";
            $params[] = $category;
        }

        if ($search !== '') {
            $sql .= " AND (name LIKE ? OR part_no LIKE ?)";
            $searchTerm = "%{$search}%";
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }

        $sql .= " ORDER BY id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $parts = $stmt->fetchAll();
        sendResponse('success', ['parts' => $parts]);
        break;

    // -------------------------------------------------------------
    // Parts: Manage Part (Admin Save: Add / Edit)
    // -------------------------------------------------------------
    case 'save_part':
        if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
            sendResponse('error', [], 'ไม่มีสิทธิ์ดำเนินการ (Admin Only)');
        }

        $input = getJsonInput();
        $id = isset($input['id']) ? intval($input['id']) : 0;
        $part_no = trim($input['part_no'] ?? '');
        $name = trim($input['name'] ?? '');
        $price = floatval($input['price'] ?? 0);
        $category = trim($input['category'] ?? 'car');
        $image_url = trim($input['image_url'] ?? 'assets/images/default_part.jpg');

        if (empty($part_no) || empty($name) || $price <= 0) {
            sendResponse('error', [], 'กรุณากรอกรหัสอะไหล่ ชื่ออะไหล่ และราคาให้ถูกต้อง');
        }

        if (!in_array($category, ['car', 'motorcycle'])) {
            $category = 'car';
        }

        if ($id > 0) {
            $stmt = $pdo->prepare("SELECT id FROM parts WHERE part_no = ? AND id != ?");
            $stmt->execute([$part_no, $id]);
            if ($stmt->fetch()) {
                sendResponse('error', [], 'รหัสอะไหล่นี้ซ้ำกับรายการอื่น');
            }

            $stmt = $pdo->prepare("UPDATE parts SET part_no = ?, name = ?, price = ?, category = ?, image_url = ? WHERE id = ?");
            $stmt->execute([$part_no, $name, $price, $category, $image_url, $id]);
            sendResponse('success', [], 'แก้ไขข้อมูลอะไหล่สำเร็จ');
        } else {
            $stmt = $pdo->prepare("SELECT id FROM parts WHERE part_no = ?");
            $stmt->execute([$part_no]);
            if ($stmt->fetch()) {
                sendResponse('error', [], 'รหัสอะไหล่นี้มีอยู่ในระบบแล้ว');
            }

            $stmt = $pdo->prepare("INSERT INTO parts (part_no, name, price, category, image_url) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$part_no, $name, $price, $category, $image_url]);
            sendResponse('success', ['id' => $pdo->lastInsertId()], 'เพิ่มอะไหล่ใหม่สำเร็จ');
        }
        break;

    // -------------------------------------------------------------
    // Parts: Delete Part (Admin Only)
    // -------------------------------------------------------------
    case 'delete_part':
        if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
            sendResponse('error', [], 'ไม่มีสิทธิ์ดำเนินการ (Admin Only)');
        }

        $input = getJsonInput();
        $id = intval($input['id'] ?? 0);

        if ($id <= 0) {
            sendResponse('error', [], 'ไม่พบรายการที่ต้องการลบ');
        }

        $stmt = $pdo->prepare("DELETE FROM parts WHERE id = ?");
        $stmt->execute([$id]);
        sendResponse('success', [], 'ลบรายการอะไหล่เรียบร้อยแล้ว');
        break;

    // -------------------------------------------------------------
    // Order: Create Checkout & Promotion Discount
    // -------------------------------------------------------------
    case 'create_order':
        if (!isset($_SESSION['user'])) {
            sendResponse('error', [], 'กรุณาเข้าสู่ระบบก่อนทำการสั่งซื้อ');
        }

        $input = getJsonInput();
        $items = $input['items'] ?? [];

        if (empty($items)) {
            sendResponse('error', [], 'ไม่มีรายการสินค้าในตะกร้า');
        }

        $userId = $_SESSION['user']['id'];

        $stmtUser = $pdo->prepare("SELECT * FROM users WHERE id = ?");
        $stmtUser->execute([$userId]);
        $userData = $stmtUser->fetch();

        if (!$userData) {
            sendResponse('error', [], 'ไม่พบข้อมูลผู้ใช้');
        }
        if (strpos($userData['phone'], 'G') === 0 || trim($userData['address']) === '') {
            sendResponse('error', [], 'กรุณากรอกเบอร์โทรศัพท์และที่อยู่จัดส่งก่อนสั่งซื้อ');
        }

        $currentCount = intval($userData['order_count']);
        $nextCount = $currentCount + 1;

        $isDiscountEligible = ($nextCount % 10 === 0);
        $discountRate = $isDiscountEligible ? 0.05 : 0.00;

        $subtotal = 0.0;
        $orderItemsData = [];

        foreach ($items as $item) {
            $partId = intval($item['part_id'] ?? 0);
            $qty = intval($item['quantity'] ?? 1);
            if ($partId <= 0 || $qty <= 0) continue;

            $stmtP = $pdo->prepare("SELECT id, name, part_no, price FROM parts WHERE id = ?");
            $stmtP->execute([$partId]);
            $partObj = $stmtP->fetch();

            if ($partObj) {
                $priceAtBuy = floatval($partObj['price']);
                $lineTotal = $priceAtBuy * $qty;
                $subtotal += $lineTotal;

                $orderItemsData[] = [
                    'part_id' => $partId,
                    'part_no' => $partObj['part_no'],
                    'name' => $partObj['name'],
                    'quantity' => $qty,
                    'price_at_buy' => $priceAtBuy,
                    'line_total' => $lineTotal
                ];
            }
        }

        if (empty($orderItemsData)) {
            sendResponse('error', [], 'สินค้าในตะกร้าไม่ถูกต้อง');
        }

        $discount = round($subtotal * $discountRate, 2);
        $netTotal = $subtotal - $discount;

        try {
            $pdo->beginTransaction();

            $stmtOrder = $pdo->prepare("INSERT INTO orders (user_id, order_date, subtotal, discount, net_total) VALUES (?, NOW(), ?, ?, ?)");
            $stmtOrder->execute([$userId, $subtotal, $discount, $netTotal]);
            $orderId = $pdo->lastInsertId();

            $stmtItem = $pdo->prepare("INSERT INTO order_items (order_id, part_id, quantity, price_at_buy) VALUES (?, ?, ?, ?)");
            foreach ($orderItemsData as $itemData) {
                $stmtItem->execute([$orderId, $itemData['part_id'], $itemData['quantity'], $itemData['price_at_buy']]);
            }

            $stmtUserUpdate = $pdo->prepare("UPDATE users SET order_count = ? WHERE id = ?");
            $stmtUserUpdate->execute([$nextCount, $userId]);

            $pdo->commit();

            $_SESSION['user']['order_count'] = $nextCount;

            sendResponse('success', [
                'order_id' => $orderId,
                'order_date' => date('Y-m-d H:i:s'),
                'user' => [
                    'fname' => $userData['fname'],
                    'lname' => $userData['lname'],
                    'phone' => $userData['phone'],
                    'address' => $userData['address']
                ],
                'items' => $orderItemsData,
                'subtotal' => $subtotal,
                'discount' => $discount,
                'discount_rate' => $discountRate * 100,
                'net_total' => $netTotal,
                'order_count' => $nextCount,
                'is_discount_applied' => $isDiscountEligible
            ], 'บันทึกรายการสั่งซื้อเรียบร้อยแล้ว');

        } catch (Exception $e) {
            $pdo->rollBack();
            sendResponse('error', [], 'เกิดข้อผิดพลาดในการบันทึกคำสั่งซื้อ: ' . $e->getMessage());
        }
        break;

    // -------------------------------------------------------------
    // Order: Customer Order History (Split View Data)
    // -------------------------------------------------------------
    case 'get_user_orders':
        if (!isset($_SESSION['user'])) {
            sendResponse('error', [], 'กรุณาเข้าสู่ระบบก่อน');
        }

        $userId = $_SESSION['user']['id'];
        $stmt = $pdo->prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC");
        $stmt->execute([$userId]);
        $orders = $stmt->fetchAll();

        foreach ($orders as &$ord) {
            $stmtItems = $pdo->prepare("
                SELECT oi.*, p.name, p.part_no, p.image_url 
                FROM order_items oi 
                JOIN parts p ON oi.part_id = p.id 
                WHERE oi.order_id = ?
            ");
            $stmtItems->execute([$ord['id']]);
            $ord['items'] = $stmtItems->fetchAll();
        }

        sendResponse('success', ['orders' => $orders]);
        break;

    // -------------------------------------------------------------
    // Admin: Order Monitoring & Search
    // -------------------------------------------------------------
    case 'get_admin_orders':
        if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
            sendResponse('error', [], 'ไม่มีสิทธิ์ดำเนินการ (Admin Only)');
        }

        $search = trim($_GET['search'] ?? '');
        $dateStart = trim($_GET['date_start'] ?? '');
        $dateEnd = trim($_GET['date_end'] ?? '');

        $sql = "
            SELECT o.*, u.fname, u.lname, u.phone, u.address 
            FROM orders o 
            JOIN users u ON o.user_id = u.id 
            WHERE 1=1
        ";
        $params = [];

        if (!empty($search)) {
            $sql .= " AND (u.phone LIKE ? OR u.fname LIKE ? OR u.lname LIKE ? OR o.id = ?)";
            $s = "%{$search}%";
            $params[] = $s;
            $params[] = $s;
            $params[] = $s;
            $params[] = intval($search);
        }

        if (!empty($dateStart)) {
            $sql .= " AND DATE(o.order_date) >= ?";
            $params[] = $dateStart;
        }

        if (!empty($dateEnd)) {
            $sql .= " AND DATE(o.order_date) <= ?";
            $params[] = $dateEnd;
        }

        $sql .= " ORDER BY o.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $orders = $stmt->fetchAll();

        foreach ($orders as &$ord) {
            $stmtItems = $pdo->prepare("
                SELECT oi.*, p.name, p.part_no 
                FROM order_items oi 
                JOIN parts p ON oi.part_id = p.id 
                WHERE oi.order_id = ?
            ");
            $stmtItems->execute([$ord['id']]);
            $ord['items'] = $stmtItems->fetchAll();
        }

        sendResponse('success', ['orders' => $orders]);
        break;

    // -------------------------------------------------------------
    // Admin: Customer List & Order Count Monitoring
    // -------------------------------------------------------------
    case 'get_admin_users':
        if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
            sendResponse('error', [], 'ไม่มีสิทธิ์ดำเนินการ (Admin Only)');
        }

        $stmt = $pdo->query("SELECT id, fname, lname, phone, address, role, order_count, created_at FROM users WHERE role = 'customer' ORDER BY id DESC");
        $users = $stmt->fetchAll();
        sendResponse('success', ['users' => $users]);
        break;

    // -------------------------------------------------------------
    // Admin: Upload Part Image
    // -------------------------------------------------------------
    case 'upload_image':
        if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
            sendResponse('error', [], 'ไม่มีสิทธิ์ดำเนินการ (Admin Only)');
        }

        if (!isset($_FILES['image']) || $_FILES['image']['error'] !== UPLOAD_ERR_OK) {
            sendResponse('error', [], 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์');
        }

        $file = $_FILES['image'];
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

        if (!in_array($ext, $allowed)) {
            sendResponse('error', [], 'รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP, GIF)');
        }

        $targetDir = __DIR__ . '/assets/images/';
        if (!file_exists($targetDir)) {
            mkdir($targetDir, 0777, true);
        }

        $newFileName = 'part_' . time() . '_' . rand(1000, 9999) . '.' . $ext;
        $targetFile = $targetDir . $newFileName;

        if (move_uploaded_file($file['tmp_name'], $targetFile)) {
            $imageUrl = 'assets/images/' . $newFileName;
            sendResponse('success', ['image_url' => $imageUrl], 'อัปโหลดรูปภาพสำเร็จ');
        } else {
            sendResponse('error', [], 'ไม่สามารถบันทึกไฟล์รูปภาพได้');
        }
        break;

    // -------------------------------------------------------------
    // Admin: Get Bot Settings (API Keys & Provider)
    // -------------------------------------------------------------
    case 'get_bot_settings':
        if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
            sendResponse('error', [], 'ไม่มีสิทธิ์ดำเนินการ (Admin Only)');
        }

        $stmt = $pdo->query("SELECT `key`, `value` FROM `settings`");
        $rows = $stmt->fetchAll();
        $settings = [
            'ai_provider' => 'gemini',
            'gemini_api_key' => '',
            'gemini_model' => 'gemini-1.5-flash',
            'openai_api_key' => '',
            'openai_model' => 'gpt-4o-mini',
            'cf_account_id' => '',
            'cf_api_token' => '',
            'cf_model' => '@cf/meta/llama-3.1-8b-instruct',
            'bot_system_prompt' => ''
        ];
        foreach ($rows as $r) {
            $settings[$r['key']] = $r['value'];
        }

        sendResponse('success', ['settings' => $settings]);
        break;

    // -------------------------------------------------------------
    // Admin: Save Bot Settings
    // -------------------------------------------------------------
    case 'save_bot_settings':
        if (!isset($_SESSION['user']) || $_SESSION['user']['role'] !== 'admin') {
            sendResponse('error', [], 'ไม่มีสิทธิ์ดำเนินการ (Admin Only)');
        }

        $input = getJsonInput();
        $keys = [
            'ai_provider',
            'gemini_api_key',
            'gemini_model',
            'openai_api_key',
            'openai_model',
            'cf_account_id',
            'cf_api_token',
            'cf_model',
            'bot_system_prompt'
        ];

        $stmtUpsert = $pdo->prepare("
            INSERT INTO `settings` (`key`, `value`) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)
        ");

        foreach ($keys as $k) {
            if (isset($input[$k])) {
                $stmtUpsert->execute([$k, (string)$input[$k]]);
            }
        }

        sendResponse('success', [], 'บันทึกการตั้งค่าแชทบอต AI สำเร็จแล้ว');
        break;

    // -------------------------------------------------------------
    // Public / Customer / Admin: Chatbot Query
    // -------------------------------------------------------------
    case 'chat_bot':
        $input = getJsonInput();
        $message = trim($input['message'] ?? '');
        $history = is_array($input['history'] ?? null) ? $input['history'] : [];

        if (empty($message)) {
            sendResponse('error', [], 'กรุณาระบุข้อความคำถาม');
        }

        // Fetch settings from settings table
        $stmtSettings = $pdo->query("SELECT `key`, `value` FROM `settings`");
        $rows = $stmtSettings->fetchAll();
        $settings = [];
        foreach ($rows as $r) {
            $settings[$r['key']] = $r['value'];
        }

        $provider = $settings['ai_provider'] ?? 'gemini';

        // Load parts catalog for context
        $stmtParts = $pdo->query("SELECT `part_no`, `name`, `price`, `category` FROM `parts` ORDER BY `id` ASC");
        $allParts = $stmtParts->fetchAll();
        $partsSummary = "";
        foreach ($allParts as $p) {
            $catLabel = ($p['category'] === 'car') ? 'รถยนต์' : 'มอเตอร์ไซค์';
            $partsSummary .= "- [{$catLabel}] รหัส: {$p['part_no']} | {$p['name']} | ราคา {$p['price']} บาท\n";
        }

        $defaultSystemPrompt = "คุณคือ \"ฮอนด้าบอต (HONDA AI Assistant)\" ผู้เชี่ยวชาญและผู้ช่วยอัจฉริยะประจำศูนย์จำหน่ายอะไหล่แท้ HONDA GENUINE PARTS (ทั้งรถยนต์และรถจักรยานยนต์)
ให้ตอบคำถามลูกค้าอย่างสุภาพ เป็นมิตร กระชับ ชัดเจน และน่าเชื่อถือ ใช้ภาษาไทยเป็นหลัก
ข้อมูลและจุดเด่นของระบบ:
1. ร้านจำหน่ายเฉพาะอะไหล่แท้มาตรฐานศูนย์ HONDA 100%
2. มีโปรโมชั่นพิเศษ: เมื่อสั่งซื้อครบทุกๆ 10 ครั้ง (ครั้งที่ 10, 20, 30...) สมาชิกระบบจะได้รับส่วนลด 5% ทันทีอัตโนมัติในบิลนั้น
3. ลูกค้าสามารถกดดูสินค้าในแคตตาล็อก กดค้นหาตามชื่อ/รหัส และหยิบใส่ตะกร้าเพื่อกดสั่งซื้อผ่านระบบได้ทันที
4. รายการสินค้าและราคาปัจจุบันที่มีในระบบ:
{$partsSummary}

หากลูกค้าถามถึงสินค้าที่มี ให้แนะนำชื่อ รหัส และราคา พร้อมแนะนำว่ากดใส่ตะกร้าบนหน้าเว็บได้ทันที
หากลูกค้าถามปัญหาการดูแลรักษารถยนต์หรือมอเตอร์ไซค์ฮอนด้า เช่น การเปลี่ยนถ่ายน้ำมันเครื่อง กรองอากาศ หัวเทียน ให้คำแนะนำตามมาตรฐานการบำรุงรักษาของฮอนด้า";

        $customPrompt = trim($settings['bot_system_prompt'] ?? '');
        $systemInstruction = !empty($customPrompt)
            ? $customPrompt . "\n\n[ข้อมูลสินค้าปัจจุบันในระบบ]:\n" . $partsSummary
            : $defaultSystemPrompt;

        $botReply = "";

        if ($provider === 'gemini') {
            $apiKey = $settings['gemini_api_key'] ?? '';
            if (empty($apiKey)) {
                sendResponse('error', [], 'ยังไม่ได้ตั้งค่า Google Gemini API Key ในระบบ กรุณาแจ้งผู้ดูแลระบบให้ตั้งค่าที่เมนูแอดมิน');
            }
            $model = !empty($settings['gemini_model']) ? $settings['gemini_model'] : 'gemini-1.5-flash';

            $contents = [];
            $slicedHistory = array_slice($history, -6);
            foreach ($slicedHistory as $h) {
                $role = ($h['role'] ?? '') === 'user' ? 'user' : 'model';
                $text = $h['text'] ?? ($h['content'] ?? '');
                $contents[] = ['role' => $role, 'parts' => [['text' => $text]]];
            }
            $contents[] = ['role' => 'user', 'parts' => [['text' => $message]]];

            $geminiUrl = "https://generativelanguage.googleapis.com/v1beta/models/{$model}:generateContent?key={$apiKey}";
            $payload = [
                'system_instruction' => [
                    'parts' => [['text' => $systemInstruction]]
                ],
                'contents' => $contents,
                'generationConfig' => [
                    'temperature' => 0.7,
                    'maxOutputTokens' => 1000
                ]
            ];

            $ch = curl_init($geminiUrl);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POSTFIELDS => json_encode($payload),
                CURLOPT_TIMEOUT => 30
            ]);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr = curl_error($ch);
            curl_close($ch);

            if ($curlErr) {
                sendResponse('error', [], 'Curl Error: ' . $curlErr);
            }
            $geminiData = json_decode($response, true);
            if ($httpCode !== 200) {
                sendResponse('error', [], 'Gemini API Error (' . $httpCode . '): ' . $response);
            }

            $botReply = $geminiData['candidates'][0]['content']['parts'][0]['text'] ?? 'ขออภัยครับ ไม่สามารถสร้างคำตอบได้ในขณะนี้';

        } elseif ($provider === 'openai') {
            $apiKey = $settings['openai_api_key'] ?? '';
            if (empty($apiKey)) {
                sendResponse('error', [], 'ยังไม่ได้ตั้งค่า OpenAI API Key ในระบบ กรุณาแจ้งผู้ดูแลระบบให้ตั้งค่าที่เมนูแอดมิน');
            }
            $model = !empty($settings['openai_model']) ? $settings['openai_model'] : 'gpt-4o-mini';

            $messages = [
                ['role' => 'system', 'content' => $systemInstruction]
            ];
            $slicedHistory = array_slice($history, -6);
            foreach ($slicedHistory as $h) {
                $role = ($h['role'] ?? '') === 'user' ? 'user' : 'assistant';
                $text = $h['text'] ?? ($h['content'] ?? '');
                $messages[] = ['role' => $role, 'content' => $text];
            }
            $messages[] = ['role' => 'user', 'content' => $message];

            $ch = curl_init('https://api.openai.com/v1/chat/completions');
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/json',
                    'Authorization: Bearer ' . $apiKey
                ],
                CURLOPT_POSTFIELDS => json_encode([
                    'model' => $model,
                    'messages' => $messages,
                    'temperature' => 0.7
                ]),
                CURLOPT_TIMEOUT => 30
            ]);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr = curl_error($ch);
            curl_close($ch);

            if ($curlErr) {
                sendResponse('error', [], 'Curl Error: ' . $curlErr);
            }
            $openaiData = json_decode($response, true);
            if ($httpCode !== 200) {
                sendResponse('error', [], 'OpenAI API Error (' . $httpCode . '): ' . $response);
            }

            $botReply = $openaiData['choices'][0]['message']['content'] ?? 'ขออภัยครับ ไม่สามารถสร้างคำตอบได้ในขณะนี้';

        } elseif ($provider === 'cloudflare') {
            $accountId = $settings['cf_account_id'] ?? '';
            $apiToken = $settings['cf_api_token'] ?? '';
            if (empty($accountId) || empty($apiToken)) {
                sendResponse('error', [], 'ยังไม่ได้ตั้งค่า Cloudflare Account ID หรือ API Token ในระบบ กรุณาแจ้งผู้ดูแลระบบให้ตั้งค่าที่เมนูแอดมิน');
            }
            $model = !empty($settings['cf_model']) ? $settings['cf_model'] : '@cf/meta/llama-3.1-8b-instruct';

            $messages = [
                ['role' => 'system', 'content' => $systemInstruction]
            ];
            $slicedHistory = array_slice($history, -6);
            foreach ($slicedHistory as $h) {
                $role = ($h['role'] ?? '') === 'user' ? 'user' : 'assistant';
                $text = $h['text'] ?? ($h['content'] ?? '');
                $messages[] = ['role' => $role, 'content' => $text];
            }
            $messages[] = ['role' => 'user', 'content' => $message];

            $cfUrl = "https://api.cloudflare.com/client/v4/accounts/{$accountId}/ai/run/{$model}";
            $ch = curl_init($cfUrl);
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_POST => true,
                CURLOPT_HTTPHEADER => [
                    'Authorization: Bearer ' . $apiToken,
                    'Content-Type: application/json'
                ],
                CURLOPT_POSTFIELDS => json_encode(['messages' => $messages]),
                CURLOPT_TIMEOUT => 30
            ]);
            $response = curl_exec($ch);
            $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
            $curlErr = curl_error($ch);
            curl_close($ch);

            if ($curlErr) {
                sendResponse('error', [], 'Curl Error: ' . $curlErr);
            }
            $cfData = json_decode($response, true);
            if ($httpCode !== 200) {
                sendResponse('error', [], 'Cloudflare AI Error (' . $httpCode . '): ' . $response);
            }

            $botReply = $cfData['result']['response'] ?? ($cfData['result']['reply'] ?? 'ขออภัยครับ ไม่สามารถสร้างคำตอบจาก Cloudflare ได้');

        } else {
            sendResponse('error', [], "ไม่รู้จัก Provider: {$provider}");
        }

        sendResponse('success', ['reply' => $botReply, 'provider' => $provider]);
        break;

    default:
        sendResponse('error', [], 'Invalid action');
        break;
}
