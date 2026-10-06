/**
 * HONDA GENUINE PARTS - Application Frontend JavaScript
 * Brand Requirement: HONDA must always be RED in the UI
 * Category Selector Support: Cars & Motorcycles
 */

document.addEventListener('DOMContentLoaded', () => {
    // Global Application State
    const App = {
        user: null,
        cart: JSON.parse(localStorage.getItem('honda_cart') || '[]'),
        parts: [],
        userOrders: [],
        selectedOrder: null,
        adminOrders: [],
        adminUsers: [],
        activeTab: 'catalog', // 'catalog', 'history', 'admin'
        selectedCategory: 'all' // 'all', 'car', 'motorcycle'
    };

    // Initialize Application
    init();

    async function init() {
        bindEvents();
        await checkSession();
        await fetchParts();
        updateCartBadge();
    }

    // -------------------------------------------------------------
    // Event Listeners
    // -------------------------------------------------------------
    function bindEvents() {
        // Navigation links
        document.getElementById('navCatalog')?.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab('catalog');
        });

        document.getElementById('navHistory')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (!App.user) {
                openModal('loginModal');
                return;
            }
            switchTab('history');
            fetchUserOrders();
        });

        document.getElementById('navAdmin')?.addEventListener('click', (e) => {
            e.preventDefault();
            if (!App.user || App.user.role !== 'admin') {
                showToast('เข้าถึงได้เฉพาะผู้ดูแลระบบ (Admin) เท่านั้น', 'error');
                return;
            }
            switchTab('admin');
            fetchAdminParts();
        });

        document.getElementById('cartNavBtn')?.addEventListener('click', () => {
            openCartModal();
        });

        // Real-time Search Input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    fetchParts(e.target.value.trim(), App.selectedCategory);
                }, 200);
            });
        }

        // Category Filter Buttons
        document.querySelectorAll('.category-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                App.selectedCategory = btn.getAttribute('data-category');
                const searchVal = document.getElementById('searchInput')?.value.trim() || '';
                fetchParts(searchVal, App.selectedCategory);
            });
        });

        // Auth Forms
        document.getElementById('loginForm')?.addEventListener('submit', handleLogin);
        document.getElementById('registerForm')?.addEventListener('submit', handleRegister);
        document.getElementById('profileForm')?.addEventListener('submit', handleProfileUpdate);
        document.getElementById('googleSignInFallback')?.addEventListener('click', () => {
            window.initializeGoogleSignIn();
            if (!window.google?.accounts?.id) {
                showToast('โหลด Google Sign-In ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตและลองใหม่', 'error');
                return;
            }
            window.google.accounts.id.prompt((notification) => {
                if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
                    showToast('Google Sign-In ถูกบล็อกโดยเบราว์เซอร์ กรุณาลองอีกครั้ง', 'error');
                }
            });
        });
        document.getElementById('btnLogout')?.addEventListener('click', handleLogout);

        // Buttons for switching auth modals
        document.getElementById('btnShowRegister')?.addEventListener('click', () => {
            closeModal('loginModal');
            openModal('registerModal');
        });

        document.getElementById('btnShowLogin')?.addEventListener('click', () => {
            closeModal('registerModal');
            openModal('loginModal');
        });

        // Modal Close Buttons
        document.querySelectorAll('.modal-close, .btn-modal-close').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-overlay');
                if (modal) closeModal(modal.id);
            });
        });

        // Admin Tab Buttons
        document.getElementById('adminTabParts')?.addEventListener('click', () => {
            switchAdminSubTab('parts');
            fetchAdminParts();
        });
        document.getElementById('adminTabOrders')?.addEventListener('click', () => {
            switchAdminSubTab('orders');
            fetchAdminOrders();
        });
        document.getElementById('adminTabUsers')?.addEventListener('click', () => {
            switchAdminSubTab('users');
            fetchAdminUsers();
        });
        document.getElementById('adminTabBot')?.addEventListener('click', () => {
            switchAdminSubTab('bot');
            fetchBotSettings();
        });

        // Admin Part Form
        document.getElementById('partForm')?.addEventListener('submit', handleSavePart);
        document.getElementById('btnAddPartModal')?.addEventListener('click', () => {
            openPartEditModal();
        });

        // Admin Filter Forms
        document.getElementById('btnFilterAdminOrders')?.addEventListener('click', () => {
            fetchAdminOrders();
        });

        // Admin Bot Settings
        document.getElementById('botSettingsForm')?.addEventListener('submit', handleSaveBotSettings);
        document.getElementById('botAiProvider')?.addEventListener('change', handleProviderChange);
        document.getElementById('btnTestBotApi')?.addEventListener('click', handleTestBotApi);

        // Chatbot Widget Floating FAB & Window
        document.getElementById('chatbotFab')?.addEventListener('click', toggleChatWindow);
        document.getElementById('btnCloseChat')?.addEventListener('click', closeChatWindow);
        document.getElementById('btnClearChat')?.addEventListener('click', clearChatHistory);
        document.getElementById('chatInputForm')?.addEventListener('submit', handleSendChatMessage);

        // Chat FAQ Chips
        document.querySelectorAll('.chat-quick-chips .chip-btn').forEach(chip => {
            chip.addEventListener('click', () => {
                const query = chip.getAttribute('data-query');
                if (query) {
                    sendUserMessage(query);
                }
            });
        });
    }

    // -------------------------------------------------------------
    // Tab & View Navigation
    // -------------------------------------------------------------
    function switchTab(tabName) {
        App.activeTab = tabName;
        
        document.getElementById('catalogSection').style.display = 'none';
        document.getElementById('historySection').style.display = 'none';
        document.getElementById('adminSection').style.display = 'none';
        document.getElementById('heroBanner').style.display = 'none';

        document.querySelectorAll('.nav-link').forEach(el => el.classList.remove('active'));

        if (tabName === 'catalog') {
            document.getElementById('catalogSection').style.display = 'block';
            document.getElementById('heroBanner').style.display = 'block';
            document.getElementById('navCatalog')?.classList.add('active');
        } else if (tabName === 'history') {
            document.getElementById('historySection').style.display = 'block';
            document.getElementById('navHistory')?.classList.add('active');
        } else if (tabName === 'admin') {
            document.getElementById('adminSection').style.display = 'block';
            document.getElementById('navAdmin')?.classList.add('active');
        }
    }

    function switchAdminSubTab(subTab) {
        document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.classList.remove('active'));
        document.getElementById('adminPartsSubSection').style.display = 'none';
        document.getElementById('adminOrdersSubSection').style.display = 'none';
        document.getElementById('adminUsersSubSection').style.display = 'none';
        document.getElementById('adminBotSubSection').style.display = 'none';

        if (subTab === 'parts') {
            document.getElementById('adminTabParts')?.classList.add('active');
            document.getElementById('adminPartsSubSection').style.display = 'block';
        } else if (subTab === 'orders') {
            document.getElementById('adminTabOrders')?.classList.add('active');
            document.getElementById('adminOrdersSubSection').style.display = 'block';
        } else if (subTab === 'users') {
            document.getElementById('adminTabUsers')?.classList.add('active');
            document.getElementById('adminUsersSubSection').style.display = 'block';
        } else if (subTab === 'bot') {
            document.getElementById('adminTabBot')?.classList.add('active');
            document.getElementById('adminBotSubSection').style.display = 'block';
        }
    }

    // -------------------------------------------------------------
    // Auth Operations
    // -------------------------------------------------------------
    async function checkSession() {
        try {
            const res = await fetch('api.php?action=get_session');
            const result = await res.json();
            if (result.status === 'success' && result.data.user) {
                App.user = result.data.user;
                renderUserUI();
                promptProfileCompletion();
            } else {
                App.user = null;
                renderUserUI();
            }
        } catch (err) {
            console.error('Session check error:', err);
        }
    }

    async function handleLogin(e) {
        e.preventDefault();
        const phone = document.getElementById('loginPhone').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        try {
            const res = await fetch('api.php?action=login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, password })
            });
            const result = await res.json();
            if (result.status === 'success') {
                App.user = result.data.user;
                renderUserUI();
                closeModal('loginModal');
                showToast('เข้าสู่ระบบสำเร็จ!', 'success');
                if (App.user.role === 'admin') {
                    switchTab('admin');
                    fetchAdminParts();
                } else {
                    switchTab('catalog');
                }
            } else {
                showToast(result.message || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
            }
        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
        }
    }

    window.initializeGoogleSignIn = function() {
        const button = document.getElementById('googleSignInButton');
        if (!button || !window.google?.accounts?.id || button.dataset.initialized) return;

        window.google.accounts.id.initialize({
            client_id: button.dataset.clientId,
            callback: handleGoogleCredential,
            auto_select: false
        });
        window.google.accounts.id.renderButton(button, {
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left',
            width: 320
        });
        if (button.querySelector('iframe')) {
            document.getElementById('googleSignInFallback').hidden = true;
        }
        button.dataset.initialized = 'true';
    };
    window.initializeGoogleSignIn();

    async function handleGoogleCredential(response) {
        try {
            const res = await fetch('api.php?action=google_login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credential: response.credential })
            });
            const result = await res.json();
            if (result.status !== 'success') {
                showToast(result.message || 'เข้าสู่ระบบ Google ไม่สำเร็จ', 'error');
                return;
            }

            App.user = result.data.user;
            renderUserUI();
            closeModal('loginModal');
            showToast('เข้าสู่ระบบด้วย Google สำเร็จ!', 'success');
            switchTab('catalog');
            promptProfileCompletion();
        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
        }
    }

    function needsProfileCompletion(user = App.user) {
        return Boolean(user && user.role === 'customer'
            && (String(user.phone || '').startsWith('G') || !String(user.address || '').trim()));
    }

    function promptProfileCompletion() {
        if (!needsProfileCompletion()) return;
        const phoneInput = document.getElementById('profilePhone');
        phoneInput.value = String(App.user.phone || '').startsWith('G') ? '' : App.user.phone;
        document.getElementById('profileAddress').value = App.user.address || '';
        openModal('profileModal');
    }

    async function handleProfileUpdate(e) {
        e.preventDefault();
        const phone = document.getElementById('profilePhone').value.trim();
        const address = document.getElementById('profileAddress').value.trim();
        if (!/^[0-9]{9,10}$/.test(phone) || !address) {
            showToast('กรุณากรอกเบอร์โทรศัพท์ 9-10 หลักและที่อยู่จัดส่ง', 'error');
            return;
        }

        try {
            const res = await fetch('api.php?action=update_profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, address })
            });
            const result = await res.json();
            if (result.status !== 'success') {
                showToast(result.message || 'บันทึกข้อมูลไม่สำเร็จ', 'error');
                return;
            }

            App.user = result.data.user;
            renderUserUI();
            closeModal('profileModal');
            showToast('บันทึกข้อมูลติดต่อและจัดส่งแล้ว', 'success');
        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
        }
    }

    async function handleRegister(e) {
        e.preventDefault();
        const fname = document.getElementById('regFname').value.trim();
        const lname = document.getElementById('regLname').value.trim();
        const phone = document.getElementById('regPhone').value.trim();
        const address = document.getElementById('regAddress').value.trim();
        const password = document.getElementById('regPassword').value.trim();

        try {
            const res = await fetch('api.php?action=register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fname, lname, phone, address, password })
            });
            const result = await res.json();
            if (result.status === 'success') {
                App.user = result.data.user;
                renderUserUI();
                closeModal('registerModal');
                showToast('สมัครสมาชิกและเข้าสู่ระบบสำเร็จ!', 'success');
            } else {
                showToast(result.message || 'สมัครสมาชิกไม่สำเร็จ', 'error');
            }
        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
        }
    }

    async function handleLogout() {
        try {
            await fetch('api.php?action=logout', { method: 'POST' });
            App.user = null;
            renderUserUI();
            switchTab('catalog');
            showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
        } catch (err) {
            console.error('Logout error:', err);
        }
    }

    function renderUserUI() {
        const userContainer = document.getElementById('userNavContainer');
        if (!userContainer) return;

        if (App.user) {
            const roleBadge = App.user.role === 'admin' 
                ? '<span class="user-role-tag role-admin">ADMIN</span>' 
                : '<span class="user-role-tag role-customer">CUSTOMER</span>';
            
            const countInfo = App.user.role === 'customer' 
                ? `<span style="font-size:0.75rem; color:#9CA3AF; margin-left:0.3rem;">(บิลที่ ${App.user.order_count})</span>` 
                : '';

            userContainer.innerHTML = `
                <div class="user-pill">
                    ${roleBadge}
                    <span>${escapeHtml(App.user.fname)} ${escapeHtml(App.user.lname)}</span>
                    ${countInfo}
                </div>
                <button class="btn-secondary" id="btnLogout" style="padding:0.35rem 0.75rem; font-size:0.85rem;">ออกจากระบบ</button>
            `;
            document.getElementById('btnLogout')?.addEventListener('click', handleLogout);

            const adminNavLi = document.getElementById('adminNavLi');
            if (adminNavLi) {
                adminNavLi.style.display = (App.user.role === 'admin') ? 'block' : 'none';
            }
        } else {
            userContainer.innerHTML = `
                <button class="btn-auth" onclick="document.getElementById('navCatalog').click(); document.getElementById('loginPhone').value=''; openModal('loginModal');">เข้าสู่ระบบ / สมัครสมาชิก</button>
            `;
            const adminNavLi = document.getElementById('adminNavLi');
            if (adminNavLi) {
                adminNavLi.style.display = 'none';
            }
        }

        updateHeroPromotionBanner();
    }

    function updateHeroPromotionBanner() {
        const heroBanner = document.getElementById('heroBanner');
        if (!heroBanner) return;

        if (App.user && App.user.role === 'customer') {
            const nextCount = parseInt(App.user.order_count || 0) + 1;
            const remainder = nextCount % 10;
            let promoText = '';

            if (remainder === 0) {
                promoText = `🎉 🎉 ยินดีด้วย! การสั่งซื้อครั้งนี้คือ **การสั่งซื้อครั้งที่ ${nextCount}** ของคุณ รับ **ส่วนลด 5% อัตโนมัติ** ทันที!`;
            } else {
                const needed = 10 - remainder;
                promoText = `🎁 คุณสั่งซื้อไปแล้ว ${App.user.order_count} ครั้ง (สั่งซื้ออีก ${needed} ครั้ง รับส่วนลด 5% ในการสั่งซื้อครั้งที่ ${nextCount + needed})`;
            }

            document.getElementById('heroPromoBox').innerHTML = promoText;
        } else {
            document.getElementById('heroPromoBox').innerHTML = `🎁 พิเศษสำหรับสมาชิก: เมื่อสั่งซื้อครบทุกๆ 10 ครั้ง (ครั้งที่ 10, 20, 30...) รับส่วนลด 5% อัตโนมัติ!`;
        }
    }

    // -------------------------------------------------------------
    // Catalog & Real-time Search & Category Filter
    // -------------------------------------------------------------
    async function fetchParts(searchQuery = '', category = App.selectedCategory) {
        try {
            let url = `api.php?action=get_parts&category=${encodeURIComponent(category)}`;
            if (searchQuery) {
                url += `&search=${encodeURIComponent(searchQuery)}`;
            }
            const res = await fetch(url);
            const result = await res.json();
            if (result.status === 'success') {
                App.parts = result.data.parts || [];
                renderCatalogGrid(App.parts);
            }
        } catch (err) {
            console.error('Fetch parts error:', err);
        }
    }

    function renderCatalogGrid(parts) {
        const grid = document.getElementById('partsGrid');
        const countSpan = document.getElementById('searchCount');
        if (!grid) return;

        let catText = 'ทั้งหมด';
        if (App.selectedCategory === 'car') catText = 'รถยนต์';
        else if (App.selectedCategory === 'motorcycle') catText = 'รถจักรยานยนต์';

        if (countSpan) {
            countSpan.textContent = `พบอะไหล่ (${catText}) ${parts.length} รายการ`;
        }

        if (parts.length === 0) {
            grid.innerHTML = `
                <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; background: #FFF; border-radius: 12px;">
                    <p style="font-size: 1.1rem; color: var(--honda-text-muted);">ไม่พบรายการอะไหล่ในหมวดหมู่นี้</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = parts.map(part => {
            const catBadge = part.category === 'motorcycle'
                ? `<span class="part-cat-badge part-cat-mc">🛵 รถจักรยานยนต์</span>`
                : `<span class="part-cat-badge part-cat-car">🚗 รถยนต์</span>`;

            return `
                <div class="part-card">
                    <div class="part-img-wrapper">
                        <img src="${escapeHtml(part.image_url)}" alt="${escapeHtml(part.name)}" class="part-img" onerror="this.src='assets/images/default_part.jpg'">
                        <span class="part-no-badge">${escapeHtml(part.part_no)}</span>
                        ${catBadge}
                    </div>
                    <div class="part-body">
                        <h3 class="part-name">${escapeHtml(part.name)}</h3>
                        <div class="part-footer">
                            <div class="part-price">฿${formatNumber(part.price)}</div>
                            <button class="btn-add-cart" data-id="${part.id}">
                                <span>🛒 เพิ่มลงตะกร้า</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.btn-add-cart').forEach(btn => {
            btn.addEventListener('click', () => {
                const partId = parseInt(btn.getAttribute('data-id'));
                addToCart(partId);
            });
        });
    }

    // -------------------------------------------------------------
    // Shopping Cart Operations
    // -------------------------------------------------------------
    function addToCart(partId) {
        const part = App.parts.find(p => p.id === partId);
        if (!part) return;

        const existingItem = App.cart.find(item => item.part_id === partId);
        if (existingItem) {
            existingItem.quantity += 1;
        } else {
            App.cart.push({
                part_id: part.id,
                part_no: part.part_no,
                name: part.name,
                price: parseFloat(part.price),
                image_url: part.image_url,
                quantity: 1
            });
        }

        saveCart();
        updateCartBadge();
        showToast(`เพิ่ม "${part.name}" ลงในตะกร้าเรียบร้อย`, 'success');
    }

    function updateCartQty(partId, change) {
        const itemIndex = App.cart.findIndex(i => i.part_id === partId);
        if (itemIndex > -1) {
            App.cart[itemIndex].quantity += change;
            if (App.cart[itemIndex].quantity <= 0) {
                App.cart.splice(itemIndex, 1);
            }
        }
        saveCart();
        updateCartBadge();
        renderCartModalContent();
    }

    function saveCart() {
        localStorage.setItem('honda_cart', JSON.stringify(App.cart));
    }

    function updateCartBadge() {
        const totalCount = App.cart.reduce((sum, item) => sum + item.quantity, 0);
        const badge = document.getElementById('cartBadge');
        if (badge) {
            badge.textContent = totalCount;
            badge.style.display = totalCount > 0 ? 'inline-block' : 'none';
        }
    }

    function openCartModal() {
        renderCartModalContent();
        openModal('cartModal');
    }

    function renderCartModalContent() {
        const body = document.getElementById('cartModalBody');
        const footer = document.getElementById('cartModalFooter');
        if (!body) return;

        if (App.cart.length === 0) {
            body.innerHTML = `
                <div style="text-align: center; padding: 2.5rem;">
                    <p style="font-size: 1.1rem; color: var(--honda-text-muted);">ตะกร้าสินค้าของคุณยังว่างเปล่า</p>
                </div>
            `;
            if (footer) footer.style.display = 'none';
            return;
        }

        let subtotal = 0;

        const tableRows = App.cart.map(item => {
            const lineTotal = item.price * item.quantity;
            subtotal += lineTotal;
            return `
                <tr>
                    <td style="width: 50px;">
                        <img src="${escapeHtml(item.image_url)}" style="width:40px; height:40px; object-fit:cover; border-radius:4px;" onerror="this.src='assets/images/default_part.jpg'">
                    </td>
                    <td>
                        <div style="font-weight:700;">${escapeHtml(item.name)}</div>
                        <div style="font-size:0.75rem; color:var(--honda-text-muted); font-family:monospace;">${escapeHtml(item.part_no)}</div>
                    </td>
                    <td class="text-right">฿${formatNumber(item.price)}</td>
                    <td class="text-center" style="white-space:nowrap;">
                        <button class="cart-qty-btn btn-qty-minus" data-id="${item.part_id}">-</button>
                        <span class="cart-qty-val">${item.quantity}</span>
                        <button class="cart-qty-btn btn-qty-plus" data-id="${item.part_id}">+</button>
                    </td>
                    <td class="text-right" style="font-weight:700; color:var(--honda-dark);">฿${formatNumber(lineTotal)}</td>
                </tr>
            `;
        }).join('');

        let nextCount = App.user ? (parseInt(App.user.order_count || 0) + 1) : 1;
        let isEligible = (nextCount % 10 === 0);
        let discountRate = isEligible ? 0.05 : 0.00;
        let discountAmount = Math.round(subtotal * discountRate * 100) / 100;
        let netTotal = subtotal - discountAmount;

        let promoNotice = '';
        if (isEligible) {
            promoNotice = `
                <div style="background:#DEF7EC; border:1px solid #31C48D; border-radius:6px; padding:0.6rem 0.8rem; margin-bottom:1rem; color:#03543F; font-size:0.88rem; font-weight:600;">
                    🎉 รับส่วนลด 5% อัตโนมัติ สำหรับการสั่งซื้อครั้งที่ ${nextCount} ของคุณ!
                </div>
            `;
        } else if (App.user && App.user.role === 'customer') {
            const remainder = nextCount % 10;
            const needed = 10 - remainder;
            promoNotice = `
                <div style="background:#F3F4F6; border:1px solid #E5E7EB; border-radius:6px; padding:0.5rem 0.8rem; margin-bottom:1rem; color:#4B5563; font-size:0.82rem;">
                    💡 สั่งซื้ออีก ${needed} ครั้ง เพื่อรับส่วนลด 5% อัตโนมัติในครั้งที่ ${nextCount + needed}
                </div>
            `;
        }

        body.innerHTML = `
            ${promoNotice}
            <table class="cart-table">
                <thead>
                    <tr>
                        <th colspan="2">รายการอะไหล่</th>
                        <th class="text-right">ราคา/ชิ้น</th>
                        <th class="text-center">จำนวน</th>
                        <th class="text-right">ราคารวม</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>

            <div class="cart-summary-box">
                <div class="cart-summary-row">
                    <span>ยอดรวมสินค้า (Subtotal)</span>
                    <span>฿${formatNumber(subtotal)}</span>
                </div>
                ${discountAmount > 0 ? `
                <div class="cart-summary-row" style="color:#059669; font-weight:600;">
                    <span>ส่วนลดสมาชิก (Promotion 5%)</span>
                    <span>-฿${formatNumber(discountAmount)}</span>
                </div>
                ` : ''}
                <div class="cart-summary-row total">
                    <span>ยอดสุทธิ (Net Total)</span>
                    <span>฿${formatNumber(netTotal)}</span>
                </div>
            </div>
        `;

        if (footer) {
            footer.style.display = 'flex';
            footer.innerHTML = `
                <button class="btn-secondary btn-modal-close" onclick="closeModal('cartModal')">ปิดหน้าต่าง</button>
                <button class="btn-primary" id="btnCheckout" style="display:flex; align-items:center; gap:0.5rem;">
                    <span>🚀 ดำเนินการสั่งซื้อและออกใบเสร็จ</span>
                </button>
            `;
            document.getElementById('btnCheckout')?.addEventListener('click', handleCheckout);
        }

        body.querySelectorAll('.btn-qty-minus').forEach(btn => {
            btn.addEventListener('click', () => updateCartQty(parseInt(btn.getAttribute('data-id')), -1));
        });
        body.querySelectorAll('.btn-qty-plus').forEach(btn => {
            btn.addEventListener('click', () => updateCartQty(parseInt(btn.getAttribute('data-id')), 1));
        });
    }

    async function handleCheckout() {
        if (!App.user) {
            closeModal('cartModal');
            openModal('loginModal');
            showToast('กรุณาเข้าสู่ระบบก่อนสั่งซื้อสินค้า', 'info');
            return;
        }

        if (needsProfileCompletion()) {
            closeModal('cartModal');
            promptProfileCompletion();
            showToast('กรุณากรอกข้อมูลติดต่อและจัดส่งก่อนสั่งซื้อ', 'info');
            return;
        }

        if (App.cart.length === 0) return;

        const payload = {
            items: App.cart.map(i => ({ part_id: i.part_id, quantity: i.quantity }))
        };

        try {
            const res = await fetch('api.php?action=create_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();

            if (result.status === 'success') {
                App.cart = [];
                saveCart();
                updateCartBadge();
                closeModal('cartModal');

                if (App.user) {
                    App.user.order_count = result.data.order_count;
                    renderUserUI();
                }

                showToast('สั่งซื้อสินค้าสำเร็จ!', 'success');
                renderReceiptModal(result.data);
                openModal('receiptModal');
            } else {
                showToast(result.message || 'เกิดข้อผิดพลาดในการสั่งซื้อ', 'error');
            }
        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
        }
    }

    // -------------------------------------------------------------
    // Receipt & Print Functionality
    // -------------------------------------------------------------
    function renderReceiptModal(orderData) {
        const receiptContainer = document.getElementById('printableReceipt');
        if (!receiptContainer) return;

        const itemsHtml = orderData.items.map((item, idx) => `
            <tr>
                <td class="text-center">${idx + 1}</td>
                <td>${escapeHtml(item.part_no)}</td>
                <td>${escapeHtml(item.name)}</td>
                <td class="text-right">฿${formatNumber(item.price_at_buy)}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-right">฿${formatNumber(item.line_total)}</td>
            </tr>
        `).join('');

        const discountRow = orderData.discount > 0 ? `
            <tr>
                <td colspan="5" class="text-right" style="font-weight:600; color:#059669;">ส่วนลดพิเศษ (${orderData.discount_rate}%):</td>
                <td class="text-right" style="font-weight:600; color:#059669;">-฿${formatNumber(orderData.discount)}</td>
            </tr>
        ` : '';

        receiptContainer.innerHTML = `
            <div class="receipt-card">
                <div class="receipt-header">
                    <div>
                        <div class="receipt-logo">
                            <span class="brand-honda">HONDA</span> GENUINE PARTS
                        </div>
                        <div style="font-size:0.85rem; color:var(--honda-text-muted); margin-top:0.2rem;">
                            อะไหล่แท้ฮอนด้า การันตีคุณภาพและมาตรฐานศูนย์บริการ
                        </div>
                    </div>
                    <div class="receipt-meta">
                        <div class="receipt-meta-title">ใบเสร็จรับเงิน / Receipt</div>
                        <div>เลขที่ใบสั่งซื้อ: <strong>#ORD-${String(orderData.order_id).padStart(5, '0')}</strong></div>
                        <div>วันที่ออกใบเสร็จ: ${formatDate(orderData.order_date)}</div>
                    </div>
                </div>

                <div class="receipt-customer-box">
                    <div class="receipt-customer-title">ข้อมูลลูกค้า (Customer Details)</div>
                    <div><strong>ชื่อ-นามสกุล:</strong> ${escapeHtml(orderData.user.fname)} ${escapeHtml(orderData.user.lname)}</div>
                    <div><strong>เบอร์โทรศัพท์ (Username):</strong> ${escapeHtml(orderData.user.phone)}</div>
                    <div><strong>ที่อยู่จัดส่ง:</strong> ${escapeHtml(orderData.user.address)}</div>
                    <div style="margin-top:0.3rem; font-size:0.8rem; color:#4B5563;">
                        * ประวัติการสั่งซื้อรวมทั้งหมดของผู้ใช้: <strong>${orderData.order_count} ครั้ง</strong>
                    </div>
                </div>

                <table class="receipt-table">
                    <thead>
                        <tr>
                            <th class="text-center" style="width:40px;">#</th>
                            <th>รหัสอะไหล่</th>
                            <th>รายการสินค้า</th>
                            <th class="text-right">ราคา/หน่วย</th>
                            <th class="text-center">จำนวน</th>
                            <th class="text-right">จำนวนเงิน</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="5" class="text-right" style="font-weight:600;">ยอดรวมสินค้า:</td>
                            <td class="text-right" style="font-weight:600;">฿${formatNumber(orderData.subtotal)}</td>
                        </tr>
                        ${discountRow}
                        <tr style="font-size:1.1rem; border-top:2px solid var(--honda-dark);">
                            <td colspan="5" class="text-right" style="font-weight:800; color:var(--honda-red);">ยอดรวมสุทธิ (Net Total):</td>
                            <td class="text-right" style="font-weight:800; color:var(--honda-red);">฿${formatNumber(orderData.net_total)}</td>
                        </tr>
                    </tfoot>
                </table>

                <div style="margin-top:2rem; display:flex; justify-content:space-between; align-items:flex-end; font-size:0.85rem; color:var(--honda-text-muted);">
                    <div>
                        <p>ขอบคุณที่ไว้วางใจเลือกใช้บริการ <span class="brand-honda">HONDA</span> GENUINE PARTS</p>
                        <p>กรณีมีข้อสงสัยเกี่ยวกับอะไหล่ โปรดติดต่อศูนย์บริการฮอนด้าใกล้บ้านท่าน</p>
                    </div>
                    <div style="text-align:center; border-top:1px solid #D1D5DB; width:180px; padding-top:0.4rem;">
                        ผู้ออกใบเสร็จ / Authorized Signature
                    </div>
                </div>
            </div>
        `;

        document.getElementById('btnPrintReceipt')?.addEventListener('click', () => {
            window.print();
        });
    }

    // -------------------------------------------------------------
    // Order History Split View
    // -------------------------------------------------------------
    async function fetchUserOrders() {
        if (!App.user) return;
        try {
            const res = await fetch('api.php?action=get_user_orders');
            const result = await res.json();
            if (result.status === 'success') {
                App.userOrders = result.data.orders || [];
                renderSplitViewOrders(App.userOrders);
            }
        } catch (err) {
            console.error('Fetch user orders error:', err);
        }
    }

    function renderSplitViewOrders(orders) {
        const leftPane = document.getElementById('splitOrderList');
        const rightPane = document.getElementById('splitOrderDetail');
        if (!leftPane || !rightPane) return;

        if (orders.length === 0) {
            leftPane.innerHTML = `
                <div style="padding:2rem; text-align:center; color:var(--honda-text-muted);">
                    ไม่พบประวัติการสั่งซื้อ
                </div>
            `;
            rightPane.innerHTML = `
                <div style="text-align:center; padding:5rem 2rem; color:var(--honda-text-muted);">
                    <div style="font-size:3rem; margin-bottom:1rem;">🧾</div>
                    <h3>ยังไม่มีข้อมูลคำสั่งซื้อ</h3>
                    <p>เลือกซื้ออะไหล่แท้ฮอนด้าและทำรายการสั่งซื้อเพื่อดูประวัติที่นี่</p>
                </div>
            `;
            return;
        }

        leftPane.innerHTML = orders.map((ord, idx) => `
            <div class="order-history-item ${idx === 0 ? 'active' : ''}" data-id="${ord.id}">
                <div class="order-item-id">
                    <span>#ORD-${String(ord.id).padStart(5, '0')}</span>
                    <span style="font-size:0.75rem; font-weight:normal; background:#E5E7EB; padding:0.1rem 0.4rem; border-radius:4px;">สำเร็จ</span>
                </div>
                <div class="order-item-date">📅 ${formatDate(ord.order_date)}</div>
                <div class="order-item-total">฿${formatNumber(ord.net_total)} (${ord.items.length} รายการ)</div>
            </div>
        `).join('');

        renderSplitOrderDetail(orders[0]);

        leftPane.querySelectorAll('.order-history-item').forEach(item => {
            item.addEventListener('click', () => {
                leftPane.querySelectorAll('.order-history-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                const orderId = parseInt(item.getAttribute('data-id'));
                const targetOrder = orders.find(o => parseInt(o.id) === orderId);
                if (targetOrder) renderSplitOrderDetail(targetOrder);
            });
        });
    }

    function renderSplitOrderDetail(ord) {
        const rightPane = document.getElementById('splitOrderDetail');
        if (!rightPane || !ord) return;

        const itemsHtml = ord.items.map((item, idx) => `
            <tr>
                <td class="text-center">${idx + 1}</td>
                <td>${escapeHtml(item.part_no)}</td>
                <td>${escapeHtml(item.name)}</td>
                <td class="text-right">฿${formatNumber(item.price_at_buy)}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-right">฿${formatNumber(item.price_at_buy * item.quantity)}</td>
            </tr>
        `).join('');

        const discountRow = parseFloat(ord.discount) > 0 ? `
            <tr>
                <td colspan="5" class="text-right" style="font-weight:600; color:#059669;">ส่วนลดพิเศษ (Promotion):</td>
                <td class="text-right" style="font-weight:600; color:#059669;">-฿${formatNumber(ord.discount)}</td>
            </tr>
        ` : '';

        rightPane.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                <h3 style="font-size:1.2rem; font-weight:800; color:var(--honda-dark);">
                    รายละเอียดบิล #ORD-${String(ord.id).padStart(5, '0')}
                </h3>
                <button class="btn-primary" id="btnPrintHistoryDetail" style="display:flex; align-items:center; gap:0.4rem; padding:0.45rem 0.9rem; font-size:0.88rem;">
                    🖨️ พิมพ์ใบเสร็จ
                </button>
            </div>

            <div class="receipt-card" id="printableReceiptHistory">
                <div class="receipt-header">
                    <div>
                        <div class="receipt-logo"><span class="brand-honda">HONDA</span> GENUINE PARTS</div>
                        <div style="font-size:0.85rem; color:var(--honda-text-muted);">ศูนย์อะไหล่แท้มาตรฐานฮอนด้า</div>
                    </div>
                    <div class="receipt-meta">
                        <div class="receipt-meta-title">ใบเสร็จรับเงิน</div>
                        <div>วันที่สั่งซื้อ: ${formatDate(ord.order_date)}</div>
                    </div>
                </div>

                <div class="receipt-customer-box">
                    <div><strong>ลูกค้า:</strong> ${escapeHtml(App.user.fname)} ${escapeHtml(App.user.lname)} (${escapeHtml(App.user.phone)})</div>
                    <div><strong>ที่อยู่จัดส่ง:</strong> ${escapeHtml(App.user.address)}</div>
                </div>

                <table class="receipt-table">
                    <thead>
                        <tr>
                            <th class="text-center">#</th>
                            <th>รหัสอะไหล่</th>
                            <th>รายการอะไหล่</th>
                            <th class="text-right">ราคาซื้อ ณ วันนั้น</th>
                            <th class="text-center">จำนวน</th>
                            <th class="text-right">ราคารวม</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colspan="5" class="text-right" style="font-weight:600;">ยอดรวมสินค้า:</td>
                            <td class="text-right" style="font-weight:600;">฿${formatNumber(ord.subtotal)}</td>
                        </tr>
                        ${discountRow}
                        <tr style="font-size:1.1rem; border-top:2px solid var(--honda-dark);">
                            <td colspan="5" class="text-right" style="font-weight:800; color:var(--honda-red);">ยอดรวมสุทธิ:</td>
                            <td class="text-right" style="font-weight:800; color:var(--honda-red);">฿${formatNumber(ord.net_total)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        document.getElementById('btnPrintHistoryDetail')?.addEventListener('click', () => {
            const receiptHtml = document.getElementById('printableReceiptHistory').outerHTML;
            const printContainer = document.getElementById('printableReceipt');
            if (printContainer) {
                printContainer.innerHTML = receiptHtml;
                window.print();
            }
        });
    }

    // -------------------------------------------------------------
    // Admin Sub-Tab Operations
    // -------------------------------------------------------------
    async function fetchAdminParts() {
        try {
            const res = await fetch('api.php?action=get_parts&category=all');
            const result = await res.json();
            if (result.status === 'success') {
                renderAdminPartsTable(result.data.parts || []);
            }
        } catch (err) {
            console.error('Fetch admin parts error:', err);
        }
    }

    function renderAdminPartsTable(parts) {
        const tbody = document.getElementById('adminPartsTbody');
        if (!tbody) return;

        tbody.innerHTML = parts.map(part => {
            const catLabel = part.category === 'motorcycle'
                ? `<span style="color:#DC2626; font-weight:700;">🛵 รถจักรยานยนต์</span>`
                : `<span style="color:#2563EB; font-weight:700;">🚗 รถยนต์</span>`;

            return `
                <tr>
                    <td style="width:60px;">
                        <img src="${escapeHtml(part.image_url)}" style="width:45px; height:45px; object-fit:cover; border-radius:6px;" onerror="this.src='assets/images/default_part.jpg'">
                    </td>
                    <td>${catLabel}</td>
                    <td style="font-family:monospace; font-weight:700;">${escapeHtml(part.part_no)}</td>
                    <td style="font-weight:600;">${escapeHtml(part.name)}</td>
                    <td style="font-weight:700; color:var(--honda-red);">฿${formatNumber(part.price)}</td>
                    <td style="white-space:nowrap;">
                        <button class="btn-secondary btn-edit-part" data-part='${JSON.stringify(part).replace(/'/g, "&apos;")}' style="padding:0.3rem 0.6rem; font-size:0.8rem;">✏️ แก้ไข</button>
                        <button class="btn-primary btn-delete-part" data-id="${part.id}" style="padding:0.3rem 0.6rem; font-size:0.8rem; background:#DC2626;">🗑️ ลบ</button>
                    </td>
                </tr>
            `;
        }).join('');

        tbody.querySelectorAll('.btn-edit-part').forEach(btn => {
            btn.addEventListener('click', () => {
                const partObj = JSON.parse(btn.getAttribute('data-part'));
                openPartEditModal(partObj);
            });
        });

        tbody.querySelectorAll('.btn-delete-part').forEach(btn => {
            btn.addEventListener('click', () => {
                const partId = parseInt(btn.getAttribute('data-id'));
                if (confirm('คุณต้องการลบรายการอะไหล่นี้ใช่หรือไม่?')) {
                    deleteAdminPart(partId);
                }
            });
        });
    }

    function openPartEditModal(partObj = null) {
        document.getElementById('partId').value = partObj ? partObj.id : '';
        document.getElementById('partCategory').value = partObj ? partObj.category : 'car';
        document.getElementById('partNo').value = partObj ? partObj.part_no : '';
        document.getElementById('partName').value = partObj ? partObj.name : '';
        document.getElementById('partPrice').value = partObj ? partObj.price : '';
        document.getElementById('partImageUrl').value = partObj ? partObj.image_url : 'assets/images/default_part.jpg';
        document.getElementById('partImageFile').value = '';

        document.getElementById('partModalTitle').textContent = partObj ? '✏️ แก้ไขรายการอะไหล่' : '➕ เพิ่มรายการอะไหล่ใหม่';
        openModal('partModal');
    }

    async function handleSavePart(e) {
        e.preventDefault();
        const id = document.getElementById('partId').value;
        const category = document.getElementById('partCategory').value;
        const part_no = document.getElementById('partNo').value.trim();
        const name = document.getElementById('partName').value.trim();
        const price = parseFloat(document.getElementById('partPrice').value);
        let image_url = document.getElementById('partImageUrl').value.trim();
        const fileInput = document.getElementById('partImageFile');

        if (fileInput.files && fileInput.files[0]) {
            const formData = new FormData();
            formData.append('image', fileInput.files[0]);
            try {
                const uploadRes = await fetch('api.php?action=upload_image', {
                    method: 'POST',
                    body: formData
                });
                const uploadResult = await uploadRes.json();
                if (uploadResult.status === 'success') {
                    image_url = uploadResult.data.image_url;
                } else {
                    showToast(uploadResult.message || 'อัปโหลดรูปภาพไม่สำเร็จ', 'error');
                    return;
                }
            } catch (err) {
                showToast('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ', 'error');
                return;
            }
        }

        try {
            const res = await fetch('api.php?action=save_part', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, part_no, name, price, category, image_url })
            });
            const result = await res.json();

            if (result.status === 'success') {
                closeModal('partModal');
                showToast(result.message, 'success');
                fetchAdminParts();
                fetchParts();
            } else {
                showToast(result.message || 'บันทึกข้อมูลไม่สำเร็จ', 'error');
            }
        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
        }
    }

    async function deleteAdminPart(partId) {
        try {
            const res = await fetch('api.php?action=delete_part', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: partId })
            });
            const result = await res.json();
            if (result.status === 'success') {
                showToast(result.message, 'success');
                fetchAdminParts();
                fetchParts();
            } else {
                showToast(result.message || 'ลบข้อมูลไม่สำเร็จ', 'error');
            }
        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
        }
    }

    async function fetchAdminOrders() {
        const search = document.getElementById('adminOrderSearch')?.value.trim() || '';
        const dateStart = document.getElementById('adminOrderDateStart')?.value || '';
        const dateEnd = document.getElementById('adminOrderDateEnd')?.value || '';

        let query = `api.php?action=get_admin_orders&search=${encodeURIComponent(search)}&date_start=${dateStart}&date_end=${dateEnd}`;

        try {
            const res = await fetch(query);
            const result = await res.json();
            if (result.status === 'success') {
                renderAdminOrdersTable(result.data.orders || []);
            }
        } catch (err) {
            console.error('Fetch admin orders error:', err);
        }
    }

    function renderAdminOrdersTable(orders) {
        const tbody = document.getElementById('adminOrdersTbody');
        if (!tbody) return;

        if (orders.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="text-center" style="padding:2rem;">ไม่พบบิลการสั่งซื้อ</td></tr>`;
            return;
        }

        tbody.innerHTML = orders.map(ord => `
            <tr>
                <td style="font-weight:700;">#ORD-${String(ord.id).padStart(5, '0')}</td>
                <td>${formatDate(ord.order_date)}</td>
                <td>
                    <div style="font-weight:700;">${escapeHtml(ord.fname)} ${escapeHtml(ord.lname)}</div>
                    <div style="font-size:0.8rem; color:var(--honda-text-muted);">${escapeHtml(ord.phone)}</div>
                </td>
                <td class="text-right">฿${formatNumber(ord.subtotal)}</td>
                <td class="text-right" style="color:#059669;">-฿${formatNumber(ord.discount)}</td>
                <td class="text-right" style="font-weight:800; color:var(--honda-red);">฿${formatNumber(ord.net_total)}</td>
                <td class="text-center">
                    <button class="btn-secondary btn-view-admin-order" data-order='${JSON.stringify(ord).replace(/'/g, "&apos;")}' style="padding:0.25rem 0.55rem; font-size:0.8rem;">🔍 รายละเอียด</button>
                </td>
            </tr>
        `).join('');

        tbody.querySelectorAll('.btn-view-admin-order').forEach(btn => {
            btn.addEventListener('click', () => {
                const ordObj = JSON.parse(btn.getAttribute('data-order'));
                renderReceiptModal({
                    order_id: ordObj.id,
                    order_date: ordObj.order_date,
                    user: { fname: ordObj.fname, lname: ordObj.lname, phone: ordObj.phone, address: ordObj.address },
                    items: ordObj.items,
                    subtotal: parseFloat(ordObj.subtotal),
                    discount: parseFloat(ordObj.discount),
                    discount_rate: parseFloat(ordObj.subtotal) > 0 ? Math.round((parseFloat(ordObj.discount) / parseFloat(ordObj.subtotal)) * 100) : 0,
                    net_total: parseFloat(ordObj.net_total),
                    order_count: 0
                });
                openModal('receiptModal');
            });
        });
    }

    async function fetchAdminUsers() {
        try {
            const res = await fetch('api.php?action=get_admin_users');
            const result = await res.json();
            if (result.status === 'success') {
                renderAdminUsersTable(result.data.users || []);
            }
        } catch (err) {
            console.error('Fetch admin users error:', err);
        }
    }

    function renderAdminUsersTable(users) {
        const tbody = document.getElementById('adminUsersTbody');
        if (!tbody) return;

        if (users.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:2rem;">ไม่พบข้อมูลลูกค้าในระบบ</td></tr>`;
            return;
        }

        tbody.innerHTML = users.map(user => `
            <tr>
                <td style="font-weight:700;">#USR-${String(user.id).padStart(4, '0')}</td>
                <td>
                    <div style="font-weight:700;">${escapeHtml(user.fname)} ${escapeHtml(user.lname)}</div>
                    <div style="font-size:0.8rem; color:var(--honda-text-muted);">${escapeHtml(user.address)}</div>
                </td>
                <td style="font-family:monospace; font-weight:700;">${escapeHtml(user.phone)}</td>
                <td class="text-center">
                    <span class="badge ${user.order_count >= 10 ? 'badge-success' : 'badge-warning'}">
                        ${user.order_count} ครั้ง
                    </span>
                </td>
                <td>${formatDate(user.created_at)}</td>
            </tr>
        `).join('');
    }

    // -------------------------------------------------------------
    // Helper & Utility Functions
    // -------------------------------------------------------------
    window.openModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    };

    window.closeModal = function(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    };

    function formatNumber(num) {
        return (parseFloat(num) || 0).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }

    function formatDate(dateStr) {
        if (!dateStr) return '-';
        const d = new Date(dateStr.replace(/-/g, '/'));
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showToast(message, type = 'info') {
        const existingToast = document.getElementById('appToast');
        if (existingToast) existingToast.remove();

        const toast = document.createElement('div');
        toast.id = 'appToast';
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.right = '20px';
        toast.style.zIndex = '9999';
        toast.style.padding = '0.75rem 1.25rem';
        toast.style.borderRadius = '8px';
        toast.style.color = '#FFF';
        toast.style.fontWeight = '600';
        toast.style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.2)';
        toast.style.transition = 'all 0.3s';

        if (type === 'success') toast.style.backgroundColor = '#10B981';
        else if (type === 'error') toast.style.backgroundColor = '#EF4444';
        else toast.style.backgroundColor = '#3B82F6';

        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // -------------------------------------------------------------
    // Admin Bot Settings Management
    // -------------------------------------------------------------
    window.toggleKeyVisibility = function(inputId) {
        const input = document.getElementById(inputId);
        if (input) {
            input.type = input.type === 'password' ? 'text' : 'password';
        }
    };

    function handleProviderChange() {
        const provider = document.getElementById('botAiProvider')?.value;
        const geminiCard = document.getElementById('providerCardGemini');
        const openaiCard = document.getElementById('providerCardOpenai');
        const cfCard = document.getElementById('providerCardCloudflare');

        if (geminiCard) geminiCard.style.display = provider === 'gemini' ? 'block' : 'none';
        if (openaiCard) openaiCard.style.display = provider === 'openai' ? 'block' : 'none';
        if (cfCard) cfCard.style.display = provider === 'cloudflare' ? 'block' : 'none';

        updateChatProviderIndicator(provider);
    }

    function updateChatProviderIndicator(provider) {
        const indicator = document.getElementById('chatProviderIndicator');
        if (!indicator) return;

        if (provider === 'gemini') {
            indicator.textContent = 'ออนไลน์ (Gemini AI)';
        } else if (provider === 'openai') {
            indicator.textContent = 'ออนไลน์ (OpenAI ChatGPT)';
        } else if (provider === 'cloudflare') {
            indicator.textContent = 'ออนไลน์ (Cloudflare AI)';
        }
    }

    async function fetchBotSettings() {
        try {
            const res = await fetch('api.php?action=get_bot_settings');
            const result = await res.json();
            if (result.status === 'success' && result.data.settings) {
                const s = result.data.settings;
                const provSelect = document.getElementById('botAiProvider');
                if (provSelect && s.ai_provider) {
                    provSelect.value = s.ai_provider;
                }
                if (document.getElementById('geminiApiKey')) document.getElementById('geminiApiKey').value = s.gemini_api_key || '';
                if (document.getElementById('geminiModel') && s.gemini_model) document.getElementById('geminiModel').value = s.gemini_model;
                if (document.getElementById('openaiApiKey')) document.getElementById('openaiApiKey').value = s.openai_api_key || '';
                if (document.getElementById('openaiModel') && s.openai_model) document.getElementById('openaiModel').value = s.openai_model;
                if (document.getElementById('cfAccountId')) document.getElementById('cfAccountId').value = s.cf_account_id || '';
                if (document.getElementById('cfApiToken')) document.getElementById('cfApiToken').value = s.cf_api_token || '';
                if (document.getElementById('cfModel') && s.cf_model) document.getElementById('cfModel').value = s.cf_model;
                if (document.getElementById('botSystemPrompt')) document.getElementById('botSystemPrompt').value = s.bot_system_prompt || '';

                handleProviderChange();
            }
        } catch (err) {
            console.error('Fetch bot settings error:', err);
        }
    }

    async function handleSaveBotSettings(e) {
        e.preventDefault();
        const payload = {
            ai_provider: document.getElementById('botAiProvider')?.value || 'gemini',
            gemini_api_key: document.getElementById('geminiApiKey')?.value.trim() || '',
            gemini_model: document.getElementById('geminiModel')?.value || 'gemini-1.5-flash',
            openai_api_key: document.getElementById('openaiApiKey')?.value.trim() || '',
            openai_model: document.getElementById('openaiModel')?.value || 'gpt-4o-mini',
            cf_account_id: document.getElementById('cfAccountId')?.value.trim() || '',
            cf_api_token: document.getElementById('cfApiToken')?.value.trim() || '',
            cf_model: document.getElementById('cfModel')?.value || '@cf/meta/llama-3.1-8b-instruct',
            bot_system_prompt: document.getElementById('botSystemPrompt')?.value.trim() || ''
        };

        try {
            const res = await fetch('api.php?action=save_bot_settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await res.json();
            if (result.status === 'success') {
                showToast(result.message || 'บันทึกการตั้งค่าสำเร็จ!', 'success');
                updateChatProviderIndicator(payload.ai_provider);
            } else {
                showToast(result.message || 'บันทึกไม่สำเร็จ', 'error');
            }
        } catch (err) {
            showToast('เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์', 'error');
        }
    }

    async function handleTestBotApi() {
        const btn = document.getElementById('btnTestBotApi');
        const origText = btn.textContent;
        btn.disabled = true;
        btn.textContent = '⏳ กำลังทดสอบ...';

        try {
            const res = await fetch('api.php?action=chat_bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'ทดสอบระบบ: แนะนำอะไหล่สำหรับ Honda Wave หน่อยครับ',
                    history: []
                })
            });
            const result = await res.json();
            if (result.status === 'success') {
                alert(`✅ การเชื่อมต่อ AI สำเร็จ (${result.data.provider})!\n\nคำตอบตัวอย่าง:\n` + result.data.reply);
            } else {
                alert('❌ เกิดข้อผิดพลาด:\n' + result.message);
            }
        } catch (err) {
            alert('❌ เกิดข้อผิดพลาดในการเชื่อมต่อ: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = origText;
        }
    }

    // -------------------------------------------------------------
    // Chatbot Frontend Widget
    // -------------------------------------------------------------
    const chatHistory = JSON.parse(sessionStorage.getItem('honda_chat_history') || '[]');
    let isBotTyping = false;

    function toggleChatWindow() {
        const win = document.getElementById('chatWindow');
        if (!win) return;
        const isShown = win.style.display !== 'none';
        win.style.display = isShown ? 'none' : 'flex';
        if (!isShown) {
            const input = document.getElementById('chatInputText');
            input?.focus();
            scrollChatToBottom();
        }
    }

    function closeChatWindow() {
        const win = document.getElementById('chatWindow');
        if (win) win.style.display = 'none';
    }

    function clearChatHistory() {
        if (!confirm('ต้องการล้างประวัติการสนทนาทั้งหมดใช่หรือไม่?')) return;
        sessionStorage.removeItem('honda_chat_history');
        chatHistory.length = 0;
        const container = document.getElementById('chatMessages');
        if (container) {
            container.innerHTML = `
                <div class="chat-msg chat-msg-bot">
                    <div class="msg-bubble">
                        ประวัติการสนทนาถูกล้างแล้วครับ สอบถามเรื่องอะไหล่แท้ <span class="brand-honda">HONDA</span> ได้ใหม่ตลอดเวลาเลยครับ!
                    </div>
                    <span class="msg-time">เมื่อสักครู่</span>
                </div>
            `;
        }
    }

    function scrollChatToBottom() {
        const container = document.getElementById('chatMessages');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    function renderMessage(role, text, timeStr = 'เมื่อสักครู่') {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-msg ${role === 'user' ? 'chat-msg-user' : 'chat-msg-bot'}`;

        // Format basic markdown bolding & newlines
        let formattedText = escapeHtml(text)
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br>');

        msgDiv.innerHTML = `
            <div class="msg-bubble">${formattedText}</div>
            <span class="msg-time">${timeStr}</span>
        `;
        container.appendChild(msgDiv);
        scrollChatToBottom();
    }

    function renderTypingIndicator() {
        const container = document.getElementById('chatMessages');
        if (!container) return;

        const typingDiv = document.createElement('div');
        typingDiv.id = 'chatTypingIndicator';
        typingDiv.className = 'chat-msg chat-msg-bot';
        typingDiv.innerHTML = `
            <div class="msg-bubble chat-typing">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
            </div>
        `;
        container.appendChild(typingDiv);
        scrollChatToBottom();
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById('chatTypingIndicator');
        if (indicator) indicator.remove();
    }

    async function handleSendChatMessage(e) {
        e.preventDefault();
        const input = document.getElementById('chatInputText');
        const text = input?.value.trim();
        if (!text || isBotTyping) return;

        input.value = '';
        await sendUserMessage(text);
    }

    async function sendUserMessage(text) {
        if (isBotTyping) return;

        // Render user message in UI
        const now = new Date();
        const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        renderMessage('user', text, timeStr);

        chatHistory.push({ role: 'user', content: text, text: text });
        sessionStorage.setItem('honda_chat_history', JSON.stringify(chatHistory));

        isBotTyping = true;
        renderTypingIndicator();

        const sendBtn = document.getElementById('btnSendChat');
        if (sendBtn) sendBtn.disabled = true;

        try {
            const res = await fetch('api.php?action=chat_bot', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: chatHistory.slice(-8)
                })
            });

            removeTypingIndicator();
            const result = await res.json();

            if (result.status === 'success' && result.data.reply) {
                const botReply = result.data.reply;
                renderMessage('bot', botReply, timeStr);
                chatHistory.push({ role: 'model', content: botReply, text: botReply });
                sessionStorage.setItem('honda_chat_history', JSON.stringify(chatHistory));
                if (result.data.provider) {
                    updateChatProviderIndicator(result.data.provider);
                }
            } else {
                renderMessage('bot', '⚠️ ' + (result.message || 'ขออภัยครับ ไม่สามารถเชื่อมต่อกับ AI ได้ในขณะนี้ กรุณาตรวจสอบการตั้งค่า API Key ในระบบแอดมิน'));
            }
        } catch (err) {
            removeTypingIndicator();
            renderMessage('bot', '⚠️ เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์ กรุณาลองใหม่อีกครั้ง');
        } finally {
            isBotTyping = false;
            if (sendBtn) sendBtn.disabled = false;
            scrollChatToBottom();
        }
    }
});
