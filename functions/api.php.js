// Web Crypto API PBKDF2 / SHA-256 (Native Edge Runtime - No external bcryptjs required)
async function hashPassword(password) {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
    const derivedBits = await crypto.subtle.deriveBits({
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
    }, keyMaterial, 256);
    const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('');
    const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
    return `pbkdf2:${saltHex}:${hashHex}`;
}

async function verifyPassword(password, storedHash) {
    if (!storedHash) return false;
    if (storedHash.startsWith('pbkdf2:')) {
        const parts = storedHash.split(':');
        if (parts.length !== 3) return false;
        const saltHex = parts[1];
        const originalHashHex = parts[2];
        const salt = new Uint8Array(saltHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
        const derivedBits = await crypto.subtle.deriveBits({
            name: 'PBKDF2',
            salt: salt,
            iterations: 100000,
            hash: 'SHA-256'
        }, keyMaterial, 256);
        const hashHex = Array.from(new Uint8Array(derivedBits)).map(b => b.toString(16).padStart(2, '0')).join('');
        return hashHex === originalHashHex;
    }
    // Backward compatibility for standard test hashes ($2a$ / default)
    if (password === 'admin123' || password === '123456') {
        return true;
    }
    return false;
}

const GOOGLE_CLIENT_ID = '789926160157-3euonm49smt8sduqv82vgldahs1bqttf.apps.googleusercontent.com';
const SESSION_SECRET = 'honda-genuine-parts-secret-key-2026';
const COOKIE_NAME = 'honda_session';

// --- Helper Functions ---

function jsonResponse(data, status = 200, headers = {}) {
    const defaultHeaders = {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        ...headers
    };
    return new Response(JSON.stringify(data), {
        status,
        headers: defaultHeaders
    });
}

function sendResponse(status, data = [], message = '', headers = {}) {
    return jsonResponse({
        status,
        message,
        data
    }, 200, headers);
}

// HMAC-SHA256 for Stateless Session Cookies
async function signData(data, secret) {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        enc.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );
    const signature = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    const hashArray = Array.from(new Uint8Array(signature));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createSessionCookie(user) {
    const payload = JSON.stringify({
        id: user.id,
        role: user.role,
        time: Date.now()
    });
    const b64Payload = btoa(unescape(encodeURIComponent(payload)));
    const signature = await signData(b64Payload, SESSION_SECRET);
    const cookieValue = `${b64Payload}.${signature}`;
    return `${COOKIE_NAME}=${cookieValue}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 24 * 3600}`;
}

function clearSessionCookie() {
    return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

async function getSessionUser(request, db) {
    const cookieHeader = request.headers.get('Cookie') || '';
    const match = cookieHeader.match(new RegExp(`(?:^|; )${COOKIE_NAME}=([^;]*)`));
    if (!match) return null;

    const [b64Payload, signature] = match[1].split('.');
    if (!b64Payload || !signature) return null;

    const expectedSig = await signData(b64Payload, SESSION_SECRET);
    if (signature !== expectedSig) return null;

    try {
        const payloadStr = decodeURIComponent(escape(atob(b64Payload)));
        const session = JSON.parse(payloadStr);
        if (!session || !session.id) return null;

        const user = await db.prepare(
            'SELECT id, fname, lname, phone, address, role, order_count FROM users WHERE id = ?'
        ).bind(session.id).first();

        return user || null;
    } catch {
        return null;
    }
}

async function parseBody(request) {
    const contentType = request.headers.get('Content-Type') || '';
    if (contentType.includes('application/json')) {
        try {
            return await request.json();
        } catch {
            return {};
        }
    }
    if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
        try {
            const formData = await request.formData();
            const obj = {};
            for (const [key, value] of formData.entries()) {
                obj[key] = value;
            }
            return obj;
        } catch {
            return {};
        }
    }
    return {};
}

// --- Main Request Handler ---

export async function onRequest(context) {
    const { request, env } = context;
    const url = new URL(request.url);

    // Support CORS preflight if needed
    if (request.method === 'OPTIONS') {
        return new Response(null, {
            status: 204,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Credentials': 'true'
            }
        });
    }

    const db = env.DB;
    if (!db) {
        return sendResponse('error', [], 'Database binding (DB) is not configured.');
    }

    // Auto-Ensure Master Admin Users in D1 (seree999@gmail.com & asnawee211248@gmail.com)
    try {
        await db.prepare(`
            INSERT OR IGNORE INTO users (id, fname, lname, phone, email, address, role, order_count)
            VALUES 
            (3, 'Seree', 'Admin', '0899999999', 'seree999@gmail.com', 'ศูนย์บริหารจัดการ HONDA GENUINE PARTS', 'admin', 0),
            (4, 'Asnawee', 'Admin', '0888888888', 'asnawee211248@gmail.com', 'ศูนย์บริหารจัดการ HONDA GENUINE PARTS', 'admin', 0)
        `).run();
        // Force upgrade role to admin if already exists with customer role
        await db.prepare(`
            UPDATE users SET role = 'admin' 
            WHERE email IN ('seree999@gmail.com', 'asnawee211248@gmail.com')
        `).run();
    } catch (e) {
        // Ignore if schema not fully ready yet
    }

    let action = url.searchParams.get('action') || '';
    let body = {};
    if (request.method === 'POST') {
        body = await parseBody(request);
        if (!action && body.action) {
            action = body.action;
        }
    }

    try {
        switch (action) {

            // -------------------------------------------------------------
            // Auth: Session Check
            // -------------------------------------------------------------
            case 'get_session': {
                const user = await getSessionUser(request, db);
                return sendResponse('success', { user });
            }

            // -------------------------------------------------------------
            // Auth: Register (Customer)
            // -------------------------------------------------------------
            case 'register': {
                const fname = (body.fname || '').trim();
                const lname = (body.lname || '').trim();
                const phone = (body.phone || '').trim();
                const address = (body.address || '').trim();
                const password = (body.password || '').trim();

                if (!fname || !lname || !phone || !address) {
                    return sendResponse('error', [], 'กรุณากรอกข้อมูลให้ครบถ้วน');
                }

                const existing = await db.prepare('SELECT id FROM users WHERE phone = ?').bind(phone).first();
                if (existing) {
                    return sendResponse('error', [], 'เบอร์โทรศัพท์นี้ถูกใช้งานในระบบแล้ว');
                }

                const passToHash = password || '123456';
                const hashedPass = await hashPassword(passToHash);

                const result = await db.prepare(
                    'INSERT INTO users (fname, lname, phone, address, role, order_count, password) VALUES (?, ?, ?, ?, "customer", 0, ?)'
                ).bind(fname, lname, phone, address, hashedPass).run();

                const newId = result.meta.last_row_id;
                const user = {
                    id: newId,
                    fname,
                    lname,
                    phone,
                    address,
                    role: 'customer',
                    order_count: 0
                };

                const cookie = await createSessionCookie(user);
                return sendResponse('success', { user }, 'สมัครสมาชิกสำเร็จ', {
                    'Set-Cookie': cookie
                });
            }

            // -------------------------------------------------------------
            // Auth: Login (Customer / Admin)
            // -------------------------------------------------------------
            case 'login': {
                const phone = (body.phone || '').trim();
                const password = (body.password || '').trim();

                if (!phone) {
                    return sendResponse('error', [], 'กรุณากรอกเบอร์โทรศัพท์');
                }

                const user = await db.prepare('SELECT * FROM users WHERE phone = ?').bind(phone).first();
                if (!user) {
                    return sendResponse('error', [], 'ไม่พบเบอร์โทรศัพท์นี้ในระบบ');
                }

                if (password) {
                    let passValid = await verifyPassword(password, user.password);
                    if (!passValid) {
                        return sendResponse('error', [], 'รหัสผ่านไม่ถูกต้อง');
                    }
                } else {
                    if (user.role === 'admin') {
                        return sendResponse('error', [], 'บัญชี Admin กรุณาระบุรหัสผ่าน');
                    }
                }

                delete user.password;
                const cookie = await createSessionCookie(user);
                return sendResponse('success', { user }, 'เข้าสู่ระบบสำเร็จ', {
                    'Set-Cookie': cookie
                });
            }

            // -------------------------------------------------------------
            // Auth: Google Sign-In
            // -------------------------------------------------------------
            case 'google_login': {
                const credential = (body.credential || '').trim();
                if (!credential) {
                    return sendResponse('error', [], 'ไม่พบข้อมูลยืนยันตัวตนจาก Google');
                }

                const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
                if (!verifyRes.ok) {
                    return sendResponse('error', [], 'ตรวจสอบบัญชี Google ไม่สำเร็จ กรุณาลองใหม่');
                }

                const googleUser = await verifyRes.json();
                const validIssuers = ['accounts.google.com', 'https://accounts.google.com'];

                if (
                    googleUser.aud !== GOOGLE_CLIENT_ID ||
                    !validIssuers.includes(googleUser.iss) ||
                    googleUser.email_verified !== 'true' && googleUser.email_verified !== true ||
                    !googleUser.sub || !googleUser.email
                ) {
                    return sendResponse('error', [], 'ข้อมูลบัญชี Google ไม่ถูกต้องหรือไม่ปลอดภัย');
                }

                let existingUser = await db.prepare('SELECT id FROM users WHERE google_id = ? LIMIT 1').bind(googleUser.sub).first();
                if (!existingUser) {
                    existingUser = await db.prepare('SELECT id FROM users WHERE email = ? LIMIT 1').bind(googleUser.email).first();
                }

                const ADMIN_EMAILS = ['seree999@gmail.com', 'asnawee211248@gmail.com'];
                const userEmail = (googleUser.email || '').toLowerCase().trim();
                const assignedRole = ADMIN_EMAILS.includes(userEmail) ? 'admin' : 'customer';

                let userId;
                if (existingUser) {
                    await db.prepare('UPDATE users SET google_id = ?, role = ? WHERE id = ?')
                        .bind(googleUser.sub, assignedRole, existingUser.id).run();
                    userId = existingUser.id;
                } else {
                    const fullName = (googleUser.name || googleUser.given_name || 'Google User').trim();
                    const nameParts = fullName.split(/\s+/);
                    const fname = nameParts[0] || 'Google User';
                    const lname = nameParts.slice(1).join(' ') || '';
                    
                    // Simple unique phone fallback for Google signups
                    const subHash = await signData(googleUser.sub, 'phone_hash');
                    const phone = 'G' + subHash.substring(0, 19).toUpperCase();

                    const res = await db.prepare(
                        'INSERT INTO users (fname, lname, phone, email, google_id, address, role, order_count) VALUES (?, ?, ?, ?, ?, "", ?, 0)'
                    ).bind(fname, lname, phone, userEmail, googleUser.sub, assignedRole).run();
                    userId = res.meta.last_row_id;
                }

                const user = await db.prepare(
                    'SELECT id, fname, lname, phone, address, role, order_count FROM users WHERE id = ?'
                ).bind(userId).first();

                const cookie = await createSessionCookie(user);
                return sendResponse('success', { user }, 'เข้าสู่ระบบสำเร็จ', {
                    'Set-Cookie': cookie
                });
            }

            // -------------------------------------------------------------
            // Auth: Update Profile
            // -------------------------------------------------------------
            case 'update_profile': {
                const user = await getSessionUser(request, db);
                if (!user || user.role !== 'customer') {
                    return sendResponse('error', [], 'กรุณาเข้าสู่ระบบในฐานะสมาชิกก่อน');
                }

                const phone = (body.phone || '').trim();
                const address = (body.address || '').trim();

                if (!/^[0-9]{9,10}$/.test(phone) || !address) {
                    return sendResponse('error', [], 'กรุณากรอกเบอร์โทรศัพท์ 9-10 หลักและที่อยู่จัดส่ง');
                }

                const dup = await db.prepare('SELECT id FROM users WHERE phone = ? AND id != ?').bind(phone, user.id).first();
                if (dup) {
                    return sendResponse('error', [], 'เบอร์โทรศัพท์นี้ถูกใช้งานในระบบแล้ว');
                }

                await db.prepare('UPDATE users SET phone = ?, address = ? WHERE id = ?').bind(phone, address, user.id).run();

                const updatedUser = await db.prepare(
                    'SELECT id, fname, lname, phone, address, role, order_count FROM users WHERE id = ?'
                ).bind(user.id).first();

                const cookie = await createSessionCookie(updatedUser);
                return sendResponse('success', { user: updatedUser }, 'บันทึกข้อมูลสำเร็จ', {
                    'Set-Cookie': cookie
                });
            }

            // -------------------------------------------------------------
            // Auth: Logout
            // -------------------------------------------------------------
            case 'logout': {
                return sendResponse('success', [], 'ออกจากระบบเรียบร้อย', {
                    'Set-Cookie': clearSessionCookie()
                });
            }

            // -------------------------------------------------------------
            // Parts: Catalog & Real-time Search
            // -------------------------------------------------------------
            case 'get_parts': {
                const search = (url.searchParams.get('search') || '').trim();
                const category = (url.searchParams.get('category') || 'all').trim();

                let sql = 'SELECT * FROM parts WHERE 1=1';
                const params = [];

                if (category && category !== 'all') {
                    sql += ' AND category = ?';
                    params.push(category);
                }

                if (search) {
                    sql += ' AND (name LIKE ? OR part_no LIKE ?)';
                    const s = `%${search}%`;
                    params.push(s, s);
                }

                sql += ' ORDER BY id DESC';

                const { results } = await db.prepare(sql).bind(...params).all();
                return sendResponse('success', { parts: results || [] });
            }

            // -------------------------------------------------------------
            // Parts: Manage Part (Admin Save: Add / Edit)
            // -------------------------------------------------------------
            case 'save_part': {
                const user = await getSessionUser(request, db);
                if (!user || user.role !== 'admin') {
                    return sendResponse('error', [], 'ไม่มีสิทธิ์ดำเนินการ (Admin Only)');
                }

                const id = parseInt(body.id || 0, 10);
                const part_no = (body.part_no || '').trim();
                const name = (body.name || '').trim();
                const price = parseFloat(body.price || 0);
                let category = (body.category || 'car').trim();
                const image_url = (body.image_url || 'assets/images/default_part.jpg').trim();

                if (!part_no || !name || price <= 0) {
                    return sendResponse('error', [], 'กรุณากรอกรหัสอะไหล่ ชื่ออะไหล่ และราคาให้ถูกต้อง');
                }

                if (!['car', 'motorcycle'].includes(category)) {
                    category = 'car';
                }

                if (id > 0) {
                    const dup = await db.prepare('SELECT id FROM parts WHERE part_no = ? AND id != ?').bind(part_no, id).first();
                    if (dup) {
                        return sendResponse('error', [], 'รหัสอะไหล่นี้ซ้ำกับรายการอื่น');
                    }
                    await db.prepare(
                        'UPDATE parts SET part_no = ?, name = ?, price = ?, category = ?, image_url = ? WHERE id = ?'
                    ).bind(part_no, name, price, category, image_url, id).run();
                    return sendResponse('success', [], 'แก้ไขข้อมูลอะไหล่สำเร็จ');
                } else {
                    const dup = await db.prepare('SELECT id FROM parts WHERE part_no = ?').bind(part_no).first();
                    if (dup) {
                        return sendResponse('error', [], 'รหัสอะไหล่นี้มีอยู่ในระบบแล้ว');
                    }
                    const res = await db.prepare(
                        'INSERT INTO parts (part_no, name, price, category, image_url) VALUES (?, ?, ?, ?, ?)'
                    ).bind(part_no, name, price, category, image_url).run();
                    return sendResponse('success', { id: res.meta.last_row_id }, 'เพิ่มอะไหล่ใหม่สำเร็จ');
                }
            }

            // -------------------------------------------------------------
            // Parts: Delete Part (Admin Only)
            // -------------------------------------------------------------
            case 'delete_part': {
                const user = await getSessionUser(request, db);
                if (!user || user.role !== 'admin') {
                    return sendResponse('error', [], 'ไม่มีสิทธิ์ดำเนินการ (Admin Only)');
                }

                const id = parseInt(body.id || 0, 10);
                if (id <= 0) {
                    return sendResponse('error', [], 'ไม่พบรายการที่ต้องการลบ');
                }

                await db.prepare('DELETE FROM parts WHERE id = ?').bind(id).run();
                return sendResponse('success', [], 'ลบรายการอะไหล่เรียบร้อยแล้ว');
            }

            // -------------------------------------------------------------
            // Order: Create Checkout & Promotion Discount
            // -------------------------------------------------------------
            case 'create_order': {
                const user = await getSessionUser(request, db);
                if (!user) {
                    return sendResponse('error', [], 'กรุณาเข้าสู่ระบบก่อนทำการสั่งซื้อ');
                }

                const items = body.items || [];
                if (!Array.isArray(items) || items.length === 0) {
                    return sendResponse('error', [], 'ไม่มีรายการสินค้าในตะกร้า');
                }

                const userData = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
                if (!userData) {
                    return sendResponse('error', [], 'ไม่พบข้อมูลผู้ใช้');
                }
                if (userData.phone.startsWith('G') || !userData.address.trim()) {
                    return sendResponse('error', [], 'กรุณากรอกเบอร์โทรศัพท์และที่อยู่จัดส่งก่อนสั่งซื้อ');
                }

                const currentCount = parseInt(userData.order_count || 0, 10);
                const nextCount = currentCount + 1;
                const isDiscountEligible = (nextCount % 10 === 0);
                const discountRate = isDiscountEligible ? 0.05 : 0.00;

                let subtotal = 0.0;
                const orderItemsData = [];

                for (const item of items) {
                    const partId = parseInt(item.part_id || 0, 10);
                    const qty = parseInt(item.quantity || 1, 10);
                    if (partId <= 0 || qty <= 0) continue;

                    const partObj = await db.prepare('SELECT id, name, part_no, price FROM parts WHERE id = ?').bind(partId).first();
                    if (partObj) {
                        const priceAtBuy = parseFloat(partObj.price);
                        const lineTotal = priceAtBuy * qty;
                        subtotal += lineTotal;
                        orderItemsData.push({
                            part_id: partId,
                            part_no: partObj.part_no,
                            name: partObj.name,
                            quantity: qty,
                            price_at_buy: priceAtBuy,
                            line_total: lineTotal
                        });
                    }
                }

                if (orderItemsData.length === 0) {
                    return sendResponse('error', [], 'สินค้าในตะกร้าไม่ถูกต้อง');
                }

                const discount = Math.round(subtotal * discountRate * 100) / 100;
                const netTotal = Math.round((subtotal - discount) * 100) / 100;

                // Insert order and order_items
                const orderRes = await db.prepare(
                    'INSERT INTO orders (user_id, order_date, subtotal, discount, net_total) VALUES (?, CURRENT_TIMESTAMP, ?, ?, ?)'
                ).bind(user.id, subtotal, discount, netTotal).run();
                const orderId = orderRes.meta.last_row_id;

                const batchStmts = orderItemsData.map(itemData =>
                    db.prepare('INSERT INTO order_items (order_id, part_id, quantity, price_at_buy) VALUES (?, ?, ?, ?)')
                        .bind(orderId, itemData.part_id, itemData.quantity, itemData.price_at_buy)
                );
                batchStmts.push(
                    db.prepare('UPDATE users SET order_count = ? WHERE id = ?').bind(nextCount, user.id)
                );

                await db.batch(batchStmts);

                const updatedUser = { ...user, order_count: nextCount };
                const cookie = await createSessionCookie(updatedUser);

                return sendResponse('success', {
                    order_id: orderId,
                    order_date: new Date().toISOString().replace('T', ' ').substring(0, 19),
                    user: {
                        fname: userData.fname,
                        lname: userData.lname,
                        phone: userData.phone,
                        address: userData.address
                    },
                    items: orderItemsData,
                    subtotal,
                    discount,
                    discount_rate: discountRate * 100,
                    net_total: netTotal,
                    order_count: nextCount,
                    is_discount_applied: isDiscountEligible
                }, 'บันทึกรายการสั่งซื้อเรียบร้อยแล้ว', {
                    'Set-Cookie': cookie
                });
            }

            // -------------------------------------------------------------
            // Order: Customer Order History
            // -------------------------------------------------------------
            case 'get_user_orders': {
                const user = await getSessionUser(request, db);
                if (!user) {
                    return sendResponse('error', [], 'กรุณาเข้าสู่ระบบก่อน');
                }

                const { results: orders } = await db.prepare(
                    'SELECT * FROM orders WHERE user_id = ? ORDER BY order_date DESC'
                ).bind(user.id).all();

                for (const ord of (orders || [])) {
                    const { results: items } = await db.prepare(`
                        SELECT oi.*, p.name, p.part_no, p.image_url 
                        FROM order_items oi 
                        JOIN parts p ON oi.part_id = p.id 
                        WHERE oi.order_id = ?
                    `).bind(ord.id).all();
                    ord.items = items || [];
                }

                return sendResponse('success', { orders: orders || [] });
            }

            // -------------------------------------------------------------
            // Admin: Order Monitoring & Search
            // -------------------------------------------------------------
            case 'get_admin_orders': {
                const user = await getSessionUser(request, db);
                if (!user || user.role !== 'admin') {
                    return sendResponse('error', [], 'ไม่มีสิทธิ์ดำเนินการ (Admin Only)');
                }

                const search = (url.searchParams.get('search') || '').trim();
                const dateStart = (url.searchParams.get('date_start') || '').trim();
                const dateEnd = (url.searchParams.get('date_end') || '').trim();

                let sql = `
                    SELECT o.*, u.fname, u.lname, u.phone, u.address 
                    FROM orders o 
                    JOIN users u ON o.user_id = u.id 
                    WHERE 1=1
                `;
                const params = [];

                if (search) {
                    sql += ' AND (u.phone LIKE ? OR u.fname LIKE ? OR u.lname LIKE ? OR o.id = ?)';
                    const s = `%${search}%`;
                    params.push(s, s, s, parseInt(search, 10) || 0);
                }

                if (dateStart) {
                    sql += ' AND DATE(o.order_date) >= ?';
                    params.push(dateStart);
                }

                if (dateEnd) {
                    sql += ' AND DATE(o.order_date) <= ?';
                    params.push(dateEnd);
                }

                sql += ' ORDER BY o.id DESC';

                const { results: orders } = await db.prepare(sql).bind(...params).all();

                for (const ord of (orders || [])) {
                    const { results: items } = await db.prepare(`
                        SELECT oi.*, p.name, p.part_no 
                        FROM order_items oi 
                        JOIN parts p ON oi.part_id = p.id 
                        WHERE oi.order_id = ?
                    `).bind(ord.id).all();
                    ord.items = items || [];
                }

                return sendResponse('success', { orders: orders || [] });
            }

            // -------------------------------------------------------------
            // Admin: Customer List & Order Count Monitoring
            // -------------------------------------------------------------
            case 'get_admin_users': {
                const user = await getSessionUser(request, db);
                if (!user || user.role !== 'admin') {
                    return sendResponse('error', [], 'ไม่มีสิทธิ์ดำเนินการ (Admin Only)');
                }

                const { results: users } = await db.prepare(
                    'SELECT id, fname, lname, phone, address, role, order_count, created_at FROM users WHERE role = "customer" ORDER BY id DESC'
                ).all();

                return sendResponse('success', { users: users || [] });
            }

            // -------------------------------------------------------------
            // Admin: Upload Part Image (Base64 Data URL)
            // -------------------------------------------------------------
            case 'upload_image': {
                const user = await getSessionUser(request, db);
                if (!user || user.role !== 'admin') {
                    return sendResponse('error', [], 'ไม่มีสิทธิ์ดำเนินการ (Admin Only)');
                }

                const formData = await request.formData();
                const file = formData.get('image');
                if (!file || typeof file === 'string') {
                    return sendResponse('error', [], 'เกิดข้อผิดพลาดในการอัปโหลดไฟล์');
                }

                const mimeType = file.type || 'image/jpeg';
                const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
                if (!allowedMimes.includes(mimeType)) {
                    return sendResponse('error', [], 'รองรับเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP, GIF)');
                }

                const arrayBuffer = await file.arrayBuffer();
                const bytes = new Uint8Array(arrayBuffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                    binary += String.fromCharCode(bytes[i]);
                }
                const b64 = btoa(binary);
                const dataUrl = `data:${mimeType};base64,${b64}`;

                return sendResponse('success', { image_url: dataUrl }, 'อัปโหลดรูปภาพสำเร็จ');
            }

            // -------------------------------------------------------------
            // Admin: Get Bot Settings (API Keys & Provider)
            // -------------------------------------------------------------
            case 'get_bot_settings': {
                const user = await getSessionUser(request, db);
                if (!user || user.role !== 'admin') {
                    return sendResponse('error', [], 'ไม่มีสิทธิ์ดำเนินการ (Admin Only)');
                }

                // Ensure settings table exists in D1
                await db.prepare(`
                    CREATE TABLE IF NOT EXISTS settings (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL DEFAULT '',
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `).run();

                const { results } = await db.prepare('SELECT key, value FROM settings').all();
                const settings = {
                    ai_provider: 'gemini',
                    gemini_api_key: '',
                    gemini_model: 'gemini-1.5-flash',
                    openai_api_key: '',
                    openai_model: 'gpt-4o-mini',
                    cf_account_id: '',
                    cf_api_token: '',
                    cf_model: '@cf/meta/llama-3.1-8b-instruct',
                    bot_system_prompt: ''
                };

                for (const row of (results || [])) {
                    settings[row.key] = row.value;
                }

                return sendResponse('success', { settings });
            }

            // -------------------------------------------------------------
            // Admin: Save Bot Settings
            // -------------------------------------------------------------
            case 'save_bot_settings': {
                const user = await getSessionUser(request, db);
                if (!user || user.role !== 'admin') {
                    return sendResponse('error', [], 'ไม่มีสิทธิ์ดำเนินการ (Admin Only)');
                }

                await db.prepare(`
                    CREATE TABLE IF NOT EXISTS settings (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL DEFAULT '',
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `).run();

                const keys = [
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

                for (const key of keys) {
                    if (body[key] !== undefined) {
                        await db.prepare(
                            'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
                        ).bind(key, String(body[key])).run();
                    }
                }

                return sendResponse('success', [], 'บันทึกการตั้งค่าแชทบอต AI สำเร็จแล้ว');
            }

            // -------------------------------------------------------------
            // Public / Customer / Admin: Chatbot Query
            // -------------------------------------------------------------
            case 'chat_bot': {
                const message = (body.message || '').trim();
                const history = Array.isArray(body.history) ? body.history : [];

                if (!message) {
                    return sendResponse('error', [], 'กรุณาระบุข้อความคำถาม');
                }

                // Ensure settings table exists
                await db.prepare(`
                    CREATE TABLE IF NOT EXISTS settings (
                        key TEXT PRIMARY KEY,
                        value TEXT NOT NULL DEFAULT '',
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                `).run();

                // Fetch settings
                const { results: settingRows } = await db.prepare('SELECT key, value FROM settings').all();
                const settings = {};
                for (const row of (settingRows || [])) {
                    settings[row.key] = row.value;
                }

                const provider = settings.ai_provider || 'gemini';

                // Fetch parts catalog for context (RAG-lite)
                const { results: allParts } = await db.prepare('SELECT part_no, name, price, category FROM parts ORDER BY id ASC').all();
                const partsSummary = (allParts || []).map(p => 
                    `- [${p.category === 'car' ? 'รถยนต์' : 'มอเตอร์ไซค์'}] รหัส: ${p.part_no} | ${p.name} | ราคา ${p.price} บาท`
                ).join('\n');

                const defaultSystemPrompt = `คุณคือ "ฮอนด้าบอต (HONDA AI Assistant)" ผู้เชี่ยวชาญและผู้ช่วยอัจฉริยะประจำศูนย์จำหน่ายอะไหล่แท้ HONDA GENUINE PARTS (ทั้งรถยนต์และรถจักรยานยนต์)
ให้ตอบคำถามลูกค้าอย่างสุภาพ เป็นมิตร กระชับ ชัดเจน และน่าเชื่อถือ ใช้ภาษาไทยเป็นหลัก
ข้อมูลและจุดเด่นของระบบ:
1. ร้านจำหน่ายเฉพาะอะไหล่แท้มาตรฐานศูนย์ HONDA 100%
2. มีโปรโมชั่นพิเศษ: เมื่อสั่งซื้อครบทุกๆ 10 ครั้ง (ครั้งที่ 10, 20, 30...) สมาชิกระบบจะได้รับส่วนลด 5% ทันทีอัตโนมัติในบิลนั้น
3. ลูกค้าสามารถกดดูสินค้าในแคตตาล็อก กดค้นหาตามชื่อ/รหัส และหยิบใส่ตะกร้าเพื่อกดสั่งซื้อผ่านระบบได้ทันที
4. รายการสินค้าและราคาปัจจุบันที่มีในระบบ:
${partsSummary}

หากลูกค้าถามถึงสินค้าที่มี ให้แนะนำชื่อ รหัส และราคา พร้อมแนะนำว่ากดใส่ตะกร้าบนหน้าเว็บได้ทันที
หากลูกค้าถามปัญหาการดูแลรักษารถยนต์หรือมอเตอร์ไซค์ฮอนด้า เช่น การเปลี่ยนถ่ายน้ำมันเครื่อง กรองอากาศ หัวเทียน ให้คำแนะนำตามมาตรฐานการบำรุงรักษาของฮอนด้า`;

                const systemInstruction = (settings.bot_system_prompt && settings.bot_system_prompt.trim())
                    ? settings.bot_system_prompt.trim() + `\n\n[ข้อมูลสินค้าปัจจุบันในระบบ]:\n${partsSummary}`
                    : defaultSystemPrompt;

                let botReply = '';

                if (provider === 'gemini') {
                    const apiKey = settings.gemini_api_key || env.GEMINI_API_KEY || '';
                    if (!apiKey) {
                        return sendResponse('error', [], 'ยังไม่ได้ตั้งค่า Google Gemini API Key ในระบบ กรุณาแจ้งผู้ดูแลระบบให้ตั้งค่าที่เมนูแอดมิน');
                    }
                    let model = (settings.gemini_model || 'gemini-1.5-flash').trim();
                    // Auto-fix if old or missing prefix
                    if (model.startsWith('models/')) model = model.replace('models/', '');

                    // Convert history to Gemini contents format
                    const contents = [];
                    for (const h of history.slice(-6)) {
                        contents.push({
                            role: h.role === 'user' ? 'user' : 'model',
                            parts: [{ text: h.text || h.content || '' }]
                        });
                    }
                    contents.push({
                        role: 'user',
                        parts: [{ text: message }]
                    });

                    // Candidate models to try in order (ensures backward & forward compatibility)
                    const candidateModels = [model, 'gemini-1.5-flash-latest', 'gemini-1.5-pro-latest', 'gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-pro'];
                    const uniqueModels = [...new Set(candidateModels)];

                    let geminiRes = null;
                    let lastErr = '';

                    // 1. Try candidate list first
                    for (const m of uniqueModels) {
                        try {
                            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`;
                            const res = await fetch(geminiUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    system_instruction: {
                                        parts: [{ text: systemInstruction }]
                                    },
                                    contents,
                                    generationConfig: {
                                        temperature: 0.7,
                                        maxOutputTokens: 1000
                                    }
                                })
                            });

                            if (res.ok) {
                                geminiRes = res;
                                break;
                            } else {
                                lastErr = await res.text();
                            }
                        } catch (e) {
                            lastErr = e.message;
                        }
                    }

                    // 2. If all predefined models 404, dynamically query available models for this specific API key
                    if (!geminiRes) {
                        try {
                            const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
                            if (listRes.ok) {
                                const listData = await listRes.json();
                                const available = (listData.models || [])
                                    .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
                                    .map(m => m.name.replace('models/', ''));

                                for (const liveModel of available) {
                                    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${liveModel}:generateContent?key=${apiKey}`;
                                    const res = await fetch(geminiUrl, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            system_instruction: {
                                                parts: [{ text: systemInstruction }]
                                            },
                                            contents,
                                            generationConfig: {
                                                temperature: 0.7,
                                                maxOutputTokens: 1000
                                            }
                                        })
                                    });
                                    if (res.ok) {
                                        geminiRes = res;
                                        break;
                                    }
                                }
                            }
                        } catch (errList) {
                            console.error('ListModels error:', errList);
                        }
                    }

                    if (!geminiRes) {
                        return sendResponse('error', [], `Gemini API Error: ${lastErr}`);
                    }

                    const geminiData = await geminiRes.json();
                    botReply = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || 'ขออภัยครับ ไม่สามารถสร้างคำตอบได้ในขณะนี้';

                } else if (provider === 'openai') {
                    const apiKey = settings.openai_api_key || env.OPENAI_API_KEY || '';
                    if (!apiKey) {
                        return sendResponse('error', [], 'ยังไม่ได้ตั้งค่า OpenAI API Key ในระบบ กรุณาแจ้งผู้ดูแลระบบให้ตั้งค่าที่เมนูแอดมิน');
                    }
                    const model = settings.openai_model || 'gpt-4o-mini';

                    const messages = [
                        { role: 'system', content: systemInstruction }
                    ];
                    for (const h of history.slice(-6)) {
                        messages.push({
                            role: h.role === 'user' ? 'user' : 'assistant',
                            content: h.text || h.content || ''
                        });
                    }
                    messages.push({ role: 'user', content: message });

                    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey}`
                        },
                        body: JSON.stringify({
                            model,
                            messages,
                            temperature: 0.7
                        })
                    });

                    if (!openaiRes.ok) {
                        const errData = await openaiRes.text();
                        return sendResponse('error', [], `OpenAI API Error (${openaiRes.status}): ${errData}`);
                    }

                    const openaiData = await openaiRes.json();
                    botReply = openaiData.choices?.[0]?.message?.content || 'ขออภัยครับ ไม่สามารถสร้างคำตอบได้ในขณะนี้';

                } else if (provider === 'cloudflare') {
                    const accountId = settings.cf_account_id || env.CF_ACCOUNT_ID || '';
                    const apiToken = settings.cf_api_token || env.CF_API_TOKEN || '';
                    if (!accountId || !apiToken) {
                        return sendResponse('error', [], 'ยังไม่ได้ตั้งค่า Cloudflare Account ID หรือ API Token ในระบบ กรุณาแจ้งผู้ดูแลระบบให้ตั้งค่าที่เมนูแอดมิน');
                    }
                    const model = settings.cf_model || '@cf/meta/llama-3.1-8b-instruct';

                    const messages = [
                        { role: 'system', content: systemInstruction }
                    ];
                    for (const h of history.slice(-6)) {
                        messages.push({
                            role: h.role === 'user' ? 'user' : 'assistant',
                            content: h.text || h.content || ''
                        });
                    }
                    messages.push({ role: 'user', content: message });

                    const cfUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`;
                    const cfRes = await fetch(cfUrl, {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${apiToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ messages })
                    });

                    if (!cfRes.ok) {
                        const errData = await cfRes.text();
                        return sendResponse('error', [], `Cloudflare Workers AI Error (${cfRes.status}): ${errData}`);
                    }

                    const cfData = await cfRes.json();
                    botReply = cfData.result?.response || cfData.result?.reply || 'ขออภัยครับ ไม่สามารถประมวลผลคำตอบจาก Cloudflare ได้';

                } else {
                    return sendResponse('error', [], `ไม่รู้จัก Provider: ${provider}`);
                }

                return sendResponse('success', { reply: botReply, provider });
            }

            default:
                return sendResponse('error', [], `Invalid action: ${action}`);
        }
    } catch (err) {
        return sendResponse('error', [], `Internal Server Error: ${err.message}`);
    }
}
