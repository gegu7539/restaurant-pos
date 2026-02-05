/**
 * 小饭馆点单系统 - 前台业务逻辑
 */

// ========================================
// 状态管理
// ========================================
const state = {
    menu: { categories: [], items: [] },
    currentCategory: 'hot',
    cart: {
        food: [],    // 点菜区
        drink: []    // 饮料区
    },
    orderNumber: 1,
    orders: [],           // 所有订单
    currentOrderId: null, // 当前操作的订单ID（用于追加饮料）
    isAddingDrink: false  // 是否处于追加饮料模式
};

// ========================================
// 初始化
// ========================================
async function init() {
    await loadMenu();
    loadState();
    renderCategories();
    renderMenu();
    renderCart();
    updateOrderNumber();
}

// 加载菜单数据
async function loadMenu() {
    try {
        const response = await fetch('assets/menu.json');
        state.menu = await response.json();
    } catch (error) {
        console.error('加载菜单失败:', error);
        // 使用备用数据
        state.menu = {
            categories: [
                { id: 'hot', name: '热菜', icon: '🍲' },
                { id: 'drink', name: '饮料', icon: '🥤', isDrink: true }
            ],
            items: [
                { id: 1, name: '红烧肉', price: 38, category: 'hot', image: '🥩' },
                { id: 14, name: '可乐', price: 5, category: 'drink', image: '🥤' }
            ]
        };
    }
}

// 从 localStorage 加载状态
function loadState() {
    const saved = localStorage.getItem('restaurant_pos_state');
    if (saved) {
        const data = JSON.parse(saved);
        state.orderNumber = data.orderNumber || 1;
        state.orders = data.orders || [];
    }
}

// 保存状态到 localStorage
function saveState() {
    const data = {
        orderNumber: state.orderNumber,
        orders: state.orders
    };
    localStorage.setItem('restaurant_pos_state', JSON.stringify(data));
    // 触发 storage 事件，通知厨房页面
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'restaurant_pos_state',
        newValue: JSON.stringify(data)
    }));
}

// ========================================
// 渲染函数
// ========================================

// 渲染分类导航
function renderCategories() {
    const container = document.getElementById('categories');

    // 如果是追加饮料模式，只显示饮料分类
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

// 渲染菜品网格
function renderMenu() {
    const container = document.getElementById('menuGrid');
    const items = state.menu.items.filter(item => item.category === state.currentCategory);

    container.innerHTML = items.map((item, index) => `
    <div class="menu-item" onclick="addToCart(${item.id})" style="animation-delay: ${index * 0.05}s">
      <span class="emoji">${item.image}</span>
      <span class="name">${item.name}</span>
      <span class="price">¥${item.price}</span>
    </div>
  `).join('');
}

// 渲染购物车
function renderCart() {
    const container = document.getElementById('cartContent');
    const foodItems = state.cart.food;
    const drinkItems = state.cart.drink;

    if (foodItems.length === 0 && drinkItems.length === 0) {
        container.innerHTML = `
      <div class="cart-empty">
        <div class="icon">🛒</div>
        <p>${state.isAddingDrink ? '请选择要追加的饮料' : '购物车是空的'}</p>
        <p>${state.isAddingDrink ? '点击饮料添加到订单' : '点击菜品添加到购物车'}</p>
      </div>
    `;
        updateTotal();
        return;
    }

    let html = '';

    // 点菜区
    if (foodItems.length > 0 || !state.isAddingDrink) {
        const foodPaid = state.currentOrderId ?
            (state.orders.find(o => o.id === state.currentOrderId)?.foodPaid || false) : false;

        html += `
      <div class="cart-section">
        <div class="section-header">
          <span class="section-title">🍲 点菜区</span>
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
          ${foodItems.length > 0 ? foodItems.map(item => renderCartItem(item, 'food')).join('') :
                '<p style="text-align: center; color: #999; padding: 10px;">暂无菜品</p>'}
        </div>
      </div>
    `;
    }

    // 饮料区
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
          ${drinkItems.length > 0 ? drinkItems.map(item => renderCartItem(item, 'drink')).join('') :
                '<p style="text-align: center; color: #999; padding: 10px;">暂无饮料</p>'}
        </div>
      </div>
    `;
    }

    container.innerHTML = html;
    updateTotal();
}

// 渲染单个购物车项
function renderCartItem(item, type) {
    return `
    <div class="cart-item">
      <span class="emoji">${item.image}</span>
      <div class="info">
        <div class="name">${item.name}</div>
        <div class="price">¥${item.price}</div>
      </div>
      <div class="quantity-control">
        <button class="qty-btn" onclick="changeQuantity(${item.id}, '${type}', -1)">−</button>
        <span class="quantity">${item.quantity}</span>
        <button class="qty-btn" onclick="changeQuantity(${item.id}, '${type}', 1)">+</button>
      </div>
      <button class="delete-btn" onclick="removeFromCart(${item.id}, '${type}')">🗑️</button>
    </div>
  `;
}

// 计算小计
function calculateSubtotal(items) {
    return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

// 更新总金额
function updateTotal() {
    const foodTotal = calculateSubtotal(state.cart.food);
    const drinkTotal = calculateSubtotal(state.cart.drink);
    const total = foodTotal + drinkTotal;

    document.getElementById('totalAmount').textContent = `¥${total}`;
    document.getElementById('submitBtn').disabled = total === 0;

    // 更新按钮文字
    const btn = document.getElementById('submitBtn');
    if (state.isAddingDrink) {
        btn.textContent = '确认追加饮料';
    } else {
        btn.textContent = '提交订单';
    }
}

// 更新订单号显示
function updateOrderNumber() {
    const display = state.isAddingDrink && state.currentOrderId
        ? `追加饮料到订单 #${String(state.orders.find(o => o.id === state.currentOrderId)?.number || '').padStart(3, '0')}`
        : `订单号: #${String(state.orderNumber).padStart(3, '0')}`;
    document.getElementById('orderNumber').textContent = display;
}

// ========================================
// 交互函数
// ========================================

// 选择分类
function selectCategory(categoryId) {
    state.currentCategory = categoryId;
    renderCategories();
    renderMenu();
}

// 添加到购物车
function addToCart(itemId) {
    const menuItem = state.menu.items.find(i => i.id === itemId);
    if (!menuItem) return;

    const category = state.menu.categories.find(c => c.id === menuItem.category);
    const targetCart = category?.isDrink ? 'drink' : 'food';

    // 如果是追加饮料模式，只允许添加饮料
    if (state.isAddingDrink && targetCart !== 'drink') {
        alert('追加模式下只能添加饮料');
        return;
    }

    const existingItem = state.cart[targetCart].find(i => i.id === itemId);

    if (existingItem) {
        existingItem.quantity++;
    } else {
        state.cart[targetCart].push({
            id: menuItem.id,
            name: menuItem.name,
            price: menuItem.price,
            image: menuItem.image,
            quantity: 1
        });
    }

    renderCart();
}

// 修改数量
function changeQuantity(itemId, type, delta) {
    const item = state.cart[type].find(i => i.id === itemId);
    if (!item) return;

    item.quantity += delta;

    if (item.quantity <= 0) {
        removeFromCart(itemId, type);
    } else {
        renderCart();
    }
}

// 从购物车移除
function removeFromCart(itemId, type) {
    state.cart[type] = state.cart[type].filter(i => i.id !== itemId);
    renderCart();
}

// 提交订单
function submitOrder() {
    const foodItems = state.cart.food;
    const drinkItems = state.cart.drink;

    if (foodItems.length === 0 && drinkItems.length === 0) return;

    if (state.isAddingDrink && state.currentOrderId) {
        // 追加饮料模式
        const order = state.orders.find(o => o.id === state.currentOrderId);
        if (order) {
            // 合并饮料
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

        // 退出追加模式
        exitAddDrinkMode();
    } else {
        // 新订单
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

    // 保存并清空购物车
    saveState();
    state.cart = { food: [], drink: [] };
    renderCart();
    updateOrderNumber();

    alert(state.isAddingDrink ? '饮料追加成功！' : '订单提交成功！');
}

// 切换支付状态
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

// 显示订单历史
function showOrderHistory() {
    const container = document.getElementById('ordersList');
    const pendingOrders = state.orders.filter(o => o.status !== 'completed');

    if (pendingOrders.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #999;">暂无进行中的订单</p>';
    } else {
        container.innerHTML = pendingOrders.map(order => `
      <div class="order-list-item" onclick="selectOrderForDrink(${order.id})">
        <span>#${String(order.number).padStart(3, '0')}</span>
        <span>¥${order.total}</span>
        <span style="font-size: 0.8rem; color: #999;">
          ${new Date(order.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    `).join('');
    }

    document.getElementById('historyModal').classList.add('active');
}

// 选择订单追加饮料
function selectOrderForDrink(orderId) {
    const order = state.orders.find(o => o.id === orderId);
    if (!order) return;

    // 进入追加饮料模式
    state.isAddingDrink = true;
    state.currentOrderId = orderId;
    state.cart = {
        food: [...order.foods],
        drink: [...order.drinks]
    };

    // 切换到饮料分类
    state.currentCategory = 'drink';

    closeHistoryModal();
    renderCategories();
    renderMenu();
    renderCart();
    updateOrderNumber();
}

// 退出追加饮料模式
function exitAddDrinkMode() {
    state.isAddingDrink = false;
    state.currentOrderId = null;
    state.cart = { food: [], drink: [] };
    state.currentCategory = 'hot';

    renderCategories();
    renderMenu();
    renderCart();
    updateOrderNumber();
}

// 关闭历史订单弹窗
function closeHistoryModal() {
    document.getElementById('historyModal').classList.remove('active');
}

// 重置订单编号
function resetOrderNumber() {
    showConfirm('重置订单编号', '确定要将订单编号重置为 #001 吗？', () => {
        state.orderNumber = 1;
        saveState();
        updateOrderNumber();
        alert('订单编号已重置！');
    });
}

// 打开厨房页面
function openKitchen() {
    window.open('kitchen.html', '_blank');
}

// 确认弹窗
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

// ========================================
// 启动
// ========================================
init();
