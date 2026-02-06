/**
 * 小饭馆点单系统 - 前台业务逻辑 (v3.0 Firebase 同步版)
 */

// ========================================
// 本地存储配置
// ========================================
const LOCAL_STORAGE_KEY = 'restaurant_pos_state';

// ========================================
// 状态管理
// ========================================
const state = {
    menu: null,
    currentCategory: 'staple',
    cart: {
        food: [],
        drink: []
    },
    orderNumber: 1,
    orders: [],
    currentOrderId: null,
    isAddingDrink: false,
    currentComboType: null,
    selectedFlavor: 'hot'
};

// ========================================
// 初始化
// ========================================
const ACCESS_PASSWORD = '474679';

async function init() {
    // 全局错误捕获，防止白屏
    window.onerror = function (msg, url, line, col, error) {
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:0;left:0;right:0;background:rgba(255,0,0,0.9);color:white;padding:20px;z-index:9999;';
        div.innerHTML = `
            <h3>⚠️ 系统发生错误</h3>
            <p>${msg}</p>
            <small>${url}:${line}:${col}</small>
            <button onclick="this.parentElement.remove()" style="float:right;background:white;color:red;border:none;padding:5px 10px;">❌ 关闭</button>
        `;
        document.body.appendChild(div);
        return false;
    };

    window.onunhandledrejection = function (event) {
        const div = document.createElement('div');
        div.style.cssText = 'position:fixed;top:50px;left:0;right:0;background:rgba(255,165,0,0.9);color:white;padding:20px;z-index:9999;';
        div.innerHTML = `
            <h3>⚠️ 异步操作错误</h3>
            <p>${event.reason}</p>
            <button onclick="this.parentElement.remove()" style="float:right;background:white;color:orange;border:none;padding:5px 10px;">❌ 关闭</button>
        `;
        document.body.appendChild(div);
    };

    // 检查是否已验证
    if (sessionStorage.getItem('pos_authenticated') !== 'true') {
        const password = prompt('请输入访问密码：');
        if (password !== ACCESS_PASSWORD) {
            alert('密码错误！');
            document.body.innerHTML = '<div style="text-align:center;padding:100px;font-size:1.5rem;">⛔ 访问被拒绝</div>';
            return;
        }
        sessionStorage.setItem('pos_authenticated', 'true');
    }

    try {
        await loadMenu();
        loadStateFromLocal(); // 之前的 loadStateFromFirebase 改名或重写
        listenToLocalChanges(); // 之前的 listenToFirebaseChanges 改名
        renderCategories();
        renderMenu();
        renderCart();
        updateOrderNumber();
    } catch (e) {
        console.error('初始化错误:', e);
        alert('系统初始化失败，请刷新页面');
    }
}

// 加载菜单数据
async function loadMenu() {
    try {
        const response = await fetch('assets/menu.json');
        state.menu = await response.json();
    } catch (error) {
        console.error('加载菜单失败:', error);
    }
}

// 从 LocalStorage 加载状态
function loadStateFromLocal() {
    try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            state.orderNumber = data.orderNumber || 1;
            state.orders = data.orders || [];
        }
    } catch (error) {
        console.error('加载本地数据失败:', error);
    }
}

// 监听 LocalStorage 变化 (用于多窗口同步)
function listenToLocalChanges() {
    window.addEventListener('storage', (e) => {
        if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
            console.log('检测到数据更新，同步中...');
            const data = JSON.parse(e.newValue);
            state.orderNumber = data.orderNumber || state.orderNumber;
            state.orders = data.orders || [];

            // 刷新界面
            if (!state.isAddingDrink) {
                updateOrderNumber();
            }
            if (document.getElementById('historyModal').classList.contains('active')) {
                showOrderHistory();
            }
        }
    });
}

// 保存状态到 LocalStorage
function saveState() {
    const data = {
        orderNumber: state.orderNumber,
        orders: state.orders
    };
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}

// ========================================
// 渲染函数
// ========================================

function renderCategories() {
    const container = document.getElementById('categories');
    const categories = state.isAddingDrink
        ? state.menu.categories.filter(c => c.isDrink)
        : state.menu.categories;

    container.innerHTML = categories.map(cat => `
    <button class="category-btn ${cat.id === state.currentCategory ? 'active' : ''}"
            onclick="selectCategory('${cat.id}')">
      <span class="icon">${cat.icon}</span>
      <span>${cat.name}</span>
    </button>
  `).join('');
}

function renderMenu() {
    const container = document.getElementById('menuGrid');
    const category = state.menu.categories.find(c => c.id === state.currentCategory);

    if (!category) {
        container.innerHTML = '<p style="text-align: center; color: #999;">暂无菜品</p>';
        return;
    }

    let html = '';

    if (category.type === 'combo') {
        const title = category.id === 'staple' ? '点主食' : '点炒饭';
        html = `
      <div class="menu-item" onclick="openComboModal('${category.id}')" style="grid-column: span 2;">
        <span class="emoji" style="font-size: 4rem;">${category.icon}</span>
        <span class="name" style="font-size: 1.2rem;">${title}</span>
        <span class="price" style="font-size: 0.9rem; color: #666;">可任意组合 • 1-10元</span>
      </div>
    `;
    } else if (category.type === 'weight') {
        html = `
      <div class="menu-item" onclick="openSoupModal()" style="grid-column: span 2;">
        <span class="emoji" style="font-size: 4rem;">${category.icon}</span>
        <span class="name" style="font-size: 1.2rem;">点汤类</span>
        <span class="price" style="font-size: 0.9rem; color: #666;">按斤计价 • 可自由搭配</span>
      </div>
    `;
    } else if (category.type === 'simple' || category.isDrink) {
        const items = state.menu.drinkItems || [];
        html = items.map((item, index) => `
      <div class="menu-item" onclick="addSimpleToCart('${item.id}')" style="animation-delay: ${index * 0.05}s">
        <span class="emoji">${item.icon}</span>
        <span class="name">${item.name}</span>
        <span class="price">¥${item.price}</span>
      </div>
    `).join('');
    }

    container.innerHTML = html;
}

function renderCart() {
    const container = document.getElementById('cartContent');
    const foodItems = state.cart.food;
    const drinkItems = state.cart.drink;

    if (foodItems.length === 0 && drinkItems.length === 0) {
        container.innerHTML = `
      <div class="cart-empty">
        <div class="icon">🛒</div>
        <p>${state.isAddingDrink ? '请选择要追加的饮料' : '购物车是空的'}</p>
      </div>
    `;
        updateTotal();
        return;
    }

    let html = '';

    if (foodItems.length > 0 || !state.isAddingDrink) {
        const foodPaid = state.currentOrderId ?
            (state.orders.find(o => o.id === state.currentOrderId)?.foodPaid || false) : false;

        html += `
      <div class="cart-section">
        <div class="section-header">
          <span class="section-title">🍜 点菜区</span>
          <div class="section-subtotal">
            <span>¥${calculateSubtotal(foodItems)}</span>
            ${state.currentOrderId ? `
              <span class="payment-status ${foodPaid ? 'paid' : 'unpaid'}" 
                    onclick="togglePayment('food')" style="cursor: pointer">
                ${foodPaid ? '🟢 已支付' : '🔴 未支付'}
              </span>
            ` : ''}
          </div>
        </div>
        <div class="section-items">
          ${foodItems.length > 0 ? foodItems.map((item, idx) => renderCartItem(item, 'food', idx)).join('') :
                '<p style="text-align: center; color: #999; padding: 10px;">暂无菜品</p>'}
        </div>
      </div>
    `;
    }

    if (drinkItems.length > 0 || state.isAddingDrink) {
        const drinkPaid = state.currentOrderId ?
            (state.orders.find(o => o.id === state.currentOrderId)?.drinkPaid || false) : false;

        html += `
      <div class="cart-section">
        <div class="section-header">
          <span class="section-title">🥤 饮料区</span>
          <div class="section-subtotal">
            <span>¥${calculateSubtotal(drinkItems)}</span>
            ${state.currentOrderId ? `
              <span class="payment-status ${drinkPaid ? 'paid' : 'unpaid'}"
                    onclick="togglePayment('drink')" style="cursor: pointer">
                ${drinkPaid ? '🟢 已支付' : '🔴 未支付'}
              </span>
            ` : ''}
          </div>
        </div>
        <div class="section-items">
          ${drinkItems.length > 0 ? drinkItems.map((item, idx) => renderCartItem(item, 'drink', idx)).join('') :
                '<p style="text-align: center; color: #999; padding: 10px;">暂无饮料</p>'}
        </div>
      </div>
    `;
    }

    container.innerHTML = html;
    updateTotal();
}

function renderCartItem(item, type, index) {
    let detailsHtml = '';
    if (item.details) {
        detailsHtml = `<div class="cart-item-details">${item.details}</div>`;
    }
    if (item.remark) {
        detailsHtml += `<div class="cart-item-remark">备注: ${item.remark}</div>`;
    }

    return `
    <div class="cart-item">
      <span class="emoji">${item.icon || '🍽️'}</span>
      <div class="info">
        <div class="name">${item.name}</div>
        <div class="price">¥${item.price}</div>
        ${detailsHtml}
      </div>
      <div class="quantity-control">
        <button class="qty-btn" onclick="changeQuantity(${index}, '${type}', -1)">−</button>
        <span class="quantity">${item.quantity}</span>
        <button class="qty-btn" onclick="changeQuantity(${index}, '${type}', 1)">+</button>
      </div>
      <button class="delete-btn" onclick="removeFromCart(${index}, '${type}')">🗑️</button>
    </div>
  `;
}

function calculateSubtotal(items) {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function updateTotal() {
    const foodTotal = calculateSubtotal(state.cart.food);
    const drinkTotal = calculateSubtotal(state.cart.drink);
    const total = foodTotal + drinkTotal;

    document.getElementById('totalAmount').textContent = `¥${total}`;
    document.getElementById('submitBtn').disabled = total === 0;

    const btn = document.getElementById('submitBtn');
    btn.textContent = state.isAddingDrink ? '确认追加饮料' : '提交订单';
}

function updateOrderNumber() {
    const container = document.getElementById('orderNumber');
    if (state.isAddingDrink && state.currentOrderId) {
        const orderNum = String(state.orders.find(o => o.id === state.currentOrderId)?.number || '').padStart(3, '0');
        container.innerHTML = `
            追加饮料到订单 #${orderNum}
            <button onclick="exitAddDrinkMode()" style="
                background: rgba(255,255,255,0.3);
                border: none;
                border-radius: 50%;
                width: 24px;
                height: 24px;
                margin-left: 8px;
                cursor: pointer;
                font-size: 14px;
            ">❌</button>
        `;
    } else {
        container.textContent = `订单号: #${String(state.orderNumber).padStart(3, '0')}`;
    }
}

// ========================================
// 组合点单弹窗
// ========================================

function openComboModal(type) {
    state.currentComboType = type;
    state.selectedFlavor = 'hot';

    const modal = document.getElementById('comboModal');
    const title = document.getElementById('comboModalTitle');
    const flavorSection = document.getElementById('flavorSection');

    title.textContent = type === 'staple' ? '🍜 主食组合' : '🍳 炒饭组合';
    flavorSection.style.display = type === 'staple' ? 'block' : 'none';

    renderComboItems();
    renderFlavorOptions();
    updateComboSubtotal();

    document.querySelector('input[name="spicy"][value="no"]').checked = true;
    document.getElementById('comboRemark').value = '';

    modal.classList.add('active');
}

function renderComboItems() {
    const container = document.getElementById('comboItems');
    const items = state.menu.comboItems;
    const prices = state.menu.priceOptions;

    container.innerHTML = items.map(item => `
    <div class="combo-item-row">
      <span class="item-name">${item.icon} ${item.name}</span>
      <select class="price-select" id="price_${item.id}" onchange="updateComboSubtotal()">
        <option value="0">不要</option>
        ${prices.map(p => `<option value="${p}">¥${p}</option>`).join('')}
      </select>
    </div>
  `).join('');
}

function renderFlavorOptions() {
    const container = document.getElementById('flavorOptions');
    const options = state.menu.flavorOptions;

    container.innerHTML = options.map(opt => `
    <button class="flavor-btn ${opt.id === state.selectedFlavor ? 'active' : ''}"
            onclick="selectFlavor('${opt.id}')">
      ${opt.icon} ${opt.name}
    </button>
  `).join('');
}

function selectFlavor(flavorId) {
    state.selectedFlavor = flavorId;
    renderFlavorOptions();
}

function updateComboSubtotal() {
    const items = state.menu.comboItems;
    let total = 0;
    items.forEach(item => {
        const select = document.getElementById(`price_${item.id}`);
        total += parseInt(select.value) || 0;
    });
    document.getElementById('comboSubtotal').textContent = `¥${total}`;
}

function addComboToCart() {
    const items = state.menu.comboItems;
    const selectedItems = [];
    let total = 0;

    items.forEach(item => {
        const select = document.getElementById(`price_${item.id}`);
        const price = parseInt(select.value) || 0;
        if (price > 0) {
            selectedItems.push({ name: item.name, price, icon: item.icon });
            total += price;
        }
    });

    if (selectedItems.length === 0) {
        alert('请至少选择一种食材');
        return;
    }

    const flavor = state.currentComboType === 'staple'
        ? state.menu.flavorOptions.find(f => f.id === state.selectedFlavor)
        : null;
    const spicy = document.querySelector('input[name="spicy"]:checked').value === 'yes';
    const remark = document.getElementById('comboRemark').value.trim();

    const itemNames = selectedItems.map(i => `${i.price}元${i.name}`).join('+');
    const typeName = state.currentComboType === 'staple' ? '主食' : '炒饭';
    let details = '';
    if (flavor) details += flavor.name;
    if (spicy) details += (details ? '，' : '') + '加辣🌶️';

    const cartItem = {
        id: Date.now(),
        name: `${typeName}: ${itemNames}`,
        price: total,
        quantity: 1,
        icon: state.currentComboType === 'staple' ? '🍜' : '🍳',
        details: details,
        remark: remark,
        type: state.currentComboType
    };

    state.cart.food.push(cartItem);
    renderCart();
    closeComboModal();
}

function closeComboModal() {
    document.getElementById('comboModal').classList.remove('active');
}

// ========================================
// 汤类点单弹窗
// ========================================

function openSoupModal() {
    const container = document.getElementById('soupItems');
    const items = state.menu.soupItems;

    container.innerHTML = items.map(item => `
    <div class="soup-item-row">
      <div class="item-info">
        <span class="item-name">${item.icon} ${item.name}</span>
        <span class="item-price">¥${item.price}/${item.unit}</span>
      </div>
      <input type="number" class="weight-input" id="weight_${item.id}" 
             min="0" step="0.1" value="0" placeholder="0"
             onchange="updateSoupSubtotal()">
      <span class="unit">${item.unit}</span>
    </div>
  `).join('');

    updateSoupSubtotal();
    document.getElementById('soupModal').classList.add('active');
}

function updateSoupSubtotal() {
    const items = state.menu.soupItems;
    let total = 0;
    items.forEach(item => {
        const input = document.getElementById(`weight_${item.id}`);
        const weight = parseFloat(input.value) || 0;
        total += weight * item.price;
    });
    document.getElementById('soupSubtotal').textContent = `¥${total.toFixed(0)}`;
}

function addSoupToCart() {
    const items = state.menu.soupItems;
    const selectedItems = [];
    let total = 0;

    items.forEach(item => {
        const input = document.getElementById(`weight_${item.id}`);
        const weight = parseFloat(input.value) || 0;
        if (weight > 0) {
            selectedItems.push({ name: item.name, weight, price: item.price, icon: item.icon });
            total += weight * item.price;
        }
    });

    if (selectedItems.length === 0) {
        alert('请至少选择一种汤');
        return;
    }

    const itemNames = selectedItems.map(i => `${i.name}${i.weight}斤`).join('+');

    const cartItem = {
        id: Date.now(),
        name: `汤类: ${itemNames}`,
        price: Math.round(total),
        quantity: 1,
        icon: '🍲',
        details: selectedItems.map(i => `${i.name} ${i.weight}斤×¥${i.price}=¥${i.weight * i.price}`).join('，'),
        type: 'soup'
    };

    state.cart.food.push(cartItem);
    renderCart();
    closeSoupModal();
}

function closeSoupModal() {
    document.getElementById('soupModal').classList.remove('active');
}

// ========================================
// 简单菜品（饮料）
// ========================================

function addSimpleToCart(itemId) {
    const item = state.menu.drinkItems.find(i => String(i.id) === String(itemId));
    if (!item) return;

    const existingIndex = state.cart.drink.findIndex(i => String(i.id) === String(itemId));

    if (existingIndex >= 0) {
        state.cart.drink[existingIndex].quantity++;
    } else {
        state.cart.drink.push({
            id: item.id,
            name: item.name,
            price: item.price,
            icon: item.icon,
            quantity: 1
        });
    }

    renderCart();
}

// ========================================
// 购物车操作
// ========================================

function selectCategory(categoryId) {
    state.currentCategory = categoryId;
    renderCategories();
    renderMenu();
}

function changeQuantity(index, type, delta) {
    const item = state.cart[type][index];
    if (!item) return;

    item.quantity += delta;

    if (item.quantity <= 0) {
        removeFromCart(index, type);
    } else {
        renderCart();
    }
}

function removeFromCart(index, type) {
    state.cart[type].splice(index, 1);
    renderCart();
}

// ========================================
// 订单提交
// ========================================

function submitOrder() {
    const foodItems = state.cart.food;
    const drinkItems = state.cart.drink;

    if (foodItems.length === 0 && drinkItems.length === 0) return;

    if (state.isAddingDrink && state.currentOrderId) {
        const order = state.orders.find(o => o.id === state.currentOrderId);
        if (order) {
            drinkItems.forEach(newItem => {
                const existing = order.drinks.find(d => d.id === newItem.id);
                if (existing) {
                    existing.quantity += newItem.quantity;
                } else {
                    order.drinks.push({ ...newItem });
                }
            });
            order.drinkTotal = calculateSubtotal(order.drinks);
            order.total = order.foodTotal + order.drinkTotal;
            order.updatedAt = new Date().toISOString();
        }
        exitAddDrinkMode();
    } else {
        const order = {
            id: Date.now(),
            number: state.orderNumber,
            foods: [...foodItems],
            drinks: [...drinkItems],
            foodTotal: calculateSubtotal(foodItems),
            drinkTotal: calculateSubtotal(drinkItems),
            total: calculateSubtotal(foodItems) + calculateSubtotal(drinkItems),
            foodPaid: false,
            drinkPaid: false,
            status: 'pending',
            createdAt: new Date().toISOString()
        };

        state.orders.push(order);
        state.orderNumber++;
    }

    saveState();
    state.cart = { food: [], drink: [] };
    renderCart();
    updateOrderNumber();

    alert(state.isAddingDrink ? '饮料追加成功！' : '订单提交成功！');
}

function togglePayment(type) {
    if (!state.currentOrderId) return;

    const order = state.orders.find(o => o.id === state.currentOrderId);
    if (!order) return;

    if (type === 'food') {
        order.foodPaid = !order.foodPaid;
    } else {
        order.drinkPaid = !order.drinkPaid;
    }

    saveState();
    renderCart();
}

// ========================================
// 订单历史
// ========================================

function showOrderHistory() {
    const container = document.getElementById('ordersList');
    // 显示未完成订单和最近的截断标记
    const list = state.orders.filter(o => o.status !== 'completed' || o.isSeparator);

    if (list.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">暂无进行中的订单</p>';
    } else {
        container.innerHTML = list.map(order => {
            if (order.isSeparator) {
                // 确保截断标记的时间显示正确
                return `<div style="text-align: center; color: #999; margin: 10px 0; font-size: 0.8rem;">${order.separatorText}</div>`;
            }
            return `
      <div class="order-list-item" onclick="selectOrderForDrink('${order.id}')">
        <span>#${String(order.number).padStart(3, '0')}</span>
        <span>¥${order.total}</span>
        <span style="font-size: 0.8rem; color: #999;">
          ${new Date(order.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    `}).join('');
    }

    document.getElementById('historyModal').classList.add('active');
}

function clearOrderHistory() {
    showConfirm('清空历史订单', '确定要清空所有已完成的历史订单吗？（未完成的订单会保留）', () => {
        // 保留未完成的订单
        const pendingOrders = state.orders.filter(o => o.status !== 'completed');
        state.orders = pendingOrders;
        saveState();
        showOrderHistory(); // 刷新显示
        updateOrderNumber();
        alert('历史订单已清空！');
    });
}

function selectOrderForDrink(orderId) {
    // 兼容字符串和数字类型的 ID
    const id = Number(orderId);
    const order = state.orders.find(o => o.id === id);
    if (!order) return;

    state.isAddingDrink = true;
    state.currentOrderId = id;
    state.cart = {
        food: [...order.foods],
        drink: [...order.drinks]
    };
    state.currentCategory = 'drink';

    closeHistoryModal();
    renderCategories();
    renderMenu();
    renderCart();
    updateOrderNumber();
}

function exitAddDrinkMode() {
    state.isAddingDrink = false;
    state.currentOrderId = null;
    state.cart = { food: [], drink: [] };
    state.currentCategory = 'staple';

    renderCategories();
    renderMenu();
    renderCart();
    updateOrderNumber();
}

function closeHistoryModal() {
    document.getElementById('historyModal').classList.remove('active');
}

// ========================================
// 其他功能
// ========================================

function resetOrderNumber() {
    showConfirm('重置订单编号', '确定要将订单编号重置为 #001 吗？（历史订单将保留并添加分隔标记）', () => {
        // 添加截断标记订单
        const separator = {
            id: Date.now(),
            number: 0,
            isSeparator: true,
            separatorText: `── 编号重置 ${new Date().toLocaleString('zh-CN')} ──`,
            foods: [],
            drinks: [],
            foodTotal: 0,
            drinkTotal: 0,
            total: 0,
            status: 'completed',
            createdAt: new Date().toISOString()
        };
        state.orders.push(separator);
        state.orderNumber = 1;
        saveState();
        updateOrderNumber();
        alert('订单编号已重置！');
    });
}

function openKitchen() {
    window.open('kitchen.html', '_blank');
}

function showConfirm(title, message, onConfirm) {
    document.getElementById('confirmTitle').textContent = title;
    document.getElementById('confirmMessage').textContent = message;
    document.getElementById('confirmBtn').onclick = () => {
        onConfirm();
        closeConfirmModal();
    };
    document.getElementById('confirmModal').classList.add('active');
}

function closeConfirmModal() {
    document.getElementById('confirmModal').classList.remove('active');
}



function toggleCartExpand() {
    // 切换展开/收起状态（仅移动端生效，由 CSS 控制）
    document.getElementById('cartPanel').classList.toggle('expanded');
}

// ========================================
// 启动
// ========================================
init();
