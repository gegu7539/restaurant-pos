/**
 * 小饭馆点单系统 - 厨房显示页面逻辑
 */

// ========================================
// 状态
// ========================================
let orders = [];

// ========================================
// 初始化
// ========================================
function init() {
    loadOrders();
    renderOrders();

    // 监听 localStorage 变化（跨标签页同步）
    window.addEventListener('storage', (e) => {
        if (e.key === 'restaurant_pos_state') {
            loadOrders();
            renderOrders();
            // 播放提示音（如果有新订单）
            playNotification();
        }
    });

    // 定时刷新（备用）
    setInterval(() => {
        loadOrders();
        renderOrders();
    }, 5000);
}

// 加载订单数据
function loadOrders() {
    const saved = localStorage.getItem('restaurant_pos_state');
    if (saved) {
        const data = JSON.parse(saved);
        orders = data.orders || [];
    }
}

// 保存状态
function saveState() {
    const saved = localStorage.getItem('restaurant_pos_state');
    const data = saved ? JSON.parse(saved) : { orderNumber: 1, orders: [] };
    data.orders = orders;
    localStorage.setItem('restaurant_pos_state', JSON.stringify(data));
}

// ========================================
// 渲染
// ========================================
function renderOrders() {
    const container = document.getElementById('ordersGrid');

    // 按时间倒序，未完成的在前
    const sortedOrders = [...orders].sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        return new Date(b.createdAt) - new Date(a.createdAt);
    });

    // 更新待处理数量
    const pendingCount = orders.filter(o => o.status !== 'completed').length;
    document.getElementById('orderCount').textContent = `待处理: ${pendingCount}`;

    if (sortedOrders.length === 0) {
        container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 60px; color: #999;">
        <div style="font-size: 4rem; margin-bottom: 16px;">📋</div>
        <p style="font-size: 1.2rem;">暂无订单</p>
        <p>等待前台提交新订单...</p>
      </div>
    `;
        return;
    }

    container.innerHTML = sortedOrders.map(order => renderOrderCard(order)).join('');
}

function renderOrderCard(order) {
    const time = new Date(order.createdAt).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit'
    });

    const isCompleted = order.status === 'completed';

    return `
    <div class="order-card ${isCompleted ? 'completed' : ''} ${order.isNew ? 'new-order' : ''}">
      <div class="order-card-header">
        <h3>#${String(order.number).padStart(3, '0')}</h3>
        <span class="order-time">${time}</span>
      </div>
      
      <div class="order-card-body">
        ${order.foods.length > 0 ? `
          <div class="order-section">
            <div class="order-section-title">
              <span>🍲 点菜</span>
              <span class="payment-status ${order.foodPaid ? 'paid' : 'unpaid'}">
                ${order.foodPaid ? '🟢 已支付' : '🔴 未支付'}
              </span>
            </div>
            ${order.foods.map(item => `
              <div class="order-item">
                <span>${item.image} ${item.name}</span>
                <span>×${item.quantity}</span>
              </div>
            `).join('')}
            <div class="order-item" style="font-weight: 600; border-top: 1px dashed #ddd; padding-top: 8px; margin-top: 8px;">
              <span>小计</span>
              <span>¥${order.foodTotal}</span>
            </div>
          </div>
        ` : ''}
        
        ${order.drinks.length > 0 ? `
          <div class="order-section">
            <div class="order-section-title">
              <span>🥤 饮料</span>
              <span class="payment-status ${order.drinkPaid ? 'paid' : 'unpaid'}">
                ${order.drinkPaid ? '🟢 已支付' : '🔴 未支付'}
              </span>
            </div>
            ${order.drinks.map(item => `
              <div class="order-item">
                <span>${item.image} ${item.name}</span>
                <span>×${item.quantity}</span>
              </div>
            `).join('')}
            <div class="order-item" style="font-weight: 600; border-top: 1px dashed #ddd; padding-top: 8px; margin-top: 8px;">
              <span>小计</span>
              <span>¥${order.drinkTotal}</span>
            </div>
          </div>
        ` : ''}
      </div>
      
      <div class="order-card-footer">
        <span class="order-total">总计: ¥${order.total}</span>
        ${isCompleted ? `
          <span class="btn btn-outline" style="pointer-events: none; opacity: 0.6;">✅ 已完成</span>
        ` : `
          <button class="btn btn-success" onclick="completeOrder(${order.id})">
            ✅ 完成
          </button>
        `}
      </div>
    </div>
  `;
}

// ========================================
// 交互
// ========================================

// 标记订单完成
function completeOrder(orderId) {
    const order = orders.find(o => o.id === orderId);
    if (order) {
        order.status = 'completed';
        order.completedAt = new Date().toISOString();
        saveState();
        renderOrders();
    }
}

// 播放通知音（可选）
function playNotification() {
    // 可以添加音频提示
    // const audio = new Audio('assets/notification.mp3');
    // audio.play();
}

// ========================================
// 启动
// ========================================
init();
