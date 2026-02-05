/**
 * 小饭馆点单系统 - 厨房显示逻辑 (v3.0 Firebase 同步版)
 */

// ========================================
// Firebase 配置
// ========================================
const firebaseConfig = {
  databaseURL: "https://restaurant-pos-f8ce4-default-rtdb.firebaseio.com"
};

// 初始化 Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// ========================================
// 状态管理
// ========================================
const state = {
  orders: [],
  lastOrderCount: 0
};

// ========================================
// 初始化
// ========================================
function init() {
  renderOrders();
  listenToFirebaseChanges();
}

// 监听 Firebase 实时变化
function listenToFirebaseChanges() {
  database.ref('pos').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
      state.orders = data.orders ? Object.values(data.orders) : [];
      renderOrders();
      checkNewOrders();
    }
  });
}

// 保存订单到 Firebase
function saveOrders() {
  const ordersObj = {};
  state.orders.forEach(order => {
    ordersObj[order.id] = order;
  });

  database.ref('pos/orders').set(ordersObj).catch(error => {
    console.error('保存到 Firebase 失败:', error);
  });
}

// ========================================
// 渲染函数
// ========================================

function renderOrders() {
  const container = document.getElementById('ordersGrid');
  const pendingOrders = state.orders.filter(o => o.status !== 'completed');

  // 更新待处理数量
  document.getElementById('orderCount').textContent = `待处理: ${pendingOrders.length} 单`;

  if (pendingOrders.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #999;">
        <div style="font-size: 4rem; margin-bottom: 20px;">🍳</div>
        <p style="font-size: 1.2rem;">暂无待处理订单</p>
      </div>
    `;
    return;
  }

  container.innerHTML = pendingOrders.map(order => renderOrderCard(order)).join('');
}

function renderOrderCard(order) {
  const time = new Date(order.createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  return `
    <div class="order-card ${order.status === 'completed' ? 'completed' : ''}">
      <div class="order-card-header">
        <h3>#${String(order.number).padStart(3, '0')}</h3>
        <span class="order-time">${time}</span>
      </div>
      
      <div class="order-card-body">
        ${order.foods && order.foods.length > 0 ? `
          <div class="order-section">
            <div class="order-section-title">
              <span>🍜 点菜</span>
              <span class="payment-status ${order.foodPaid ? 'paid' : 'unpaid'}"
                    onclick="togglePayment(${order.id}, 'food')" style="cursor: pointer">
                ${order.foodPaid ? '🟢 已付' : '🔴 未付'}
              </span>
            </div>
            ${order.foods.map(item => `
              <div class="order-item">
                <span>${item.icon || '🍽️'} ${item.name} ×${item.quantity}</span>
                <span>¥${item.price * item.quantity}</span>
              </div>
              ${item.details ? `<div style="font-size: 0.8rem; color: #666; margin-left: 24px;">${item.details}</div>` : ''}
              ${item.remark ? `<div style="font-size: 0.75rem; color: #4ECDC4; margin-left: 24px; font-style: italic;">备注: ${item.remark}</div>` : ''}
            `).join('')}
            <div class="order-item" style="font-weight: 600; border-top: 1px dashed #ddd; margin-top: 8px; padding-top: 8px;">
              <span>小计</span>
              <span>¥${order.foodTotal}</span>
            </div>
          </div>
        ` : ''}
        
        ${order.drinks && order.drinks.length > 0 ? `
          <div class="order-section">
            <div class="order-section-title">
              <span>🥤 饮料</span>
              <span class="payment-status ${order.drinkPaid ? 'paid' : 'unpaid'}"
                    onclick="togglePayment(${order.id}, 'drink')" style="cursor: pointer">
                ${order.drinkPaid ? '🟢 已付' : '🔴 未付'}
              </span>
            </div>
            ${order.drinks.map(item => `
              <div class="order-item">
                <span>${item.icon || '🥤'} ${item.name} ×${item.quantity}</span>
                <span>¥${item.price * item.quantity}</span>
              </div>
            `).join('')}
            <div class="order-item" style="font-weight: 600; border-top: 1px dashed #ddd; margin-top: 8px; padding-top: 8px;">
              <span>小计</span>
              <span>¥${order.drinkTotal}</span>
            </div>
          </div>
        ` : ''}
      </div>
      
      <div class="order-card-footer">
        <span class="order-total">总计: ¥${order.total}</span>
        <button class="btn btn-success" onclick="completeOrder(${order.id})">
          ✅ 完成
        </button>
      </div>
    </div>
  `;
}

// ========================================
// 订单操作
// ========================================

function togglePayment(orderId, type) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;

  if (type === 'food') {
    order.foodPaid = !order.foodPaid;
  } else {
    order.drinkPaid = !order.drinkPaid;
  }

  saveOrders();
}

function completeOrder(orderId) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;

  order.status = 'completed';
  order.completedAt = new Date().toISOString();

  saveOrders();
}

// ========================================
// 新订单提醒
// ========================================

function checkNewOrders() {
  const pendingCount = state.orders.filter(o => o.status !== 'completed').length;

  if (pendingCount > state.lastOrderCount) {
    playNotificationSound();
    showNotification();
  }

  state.lastOrderCount = pendingCount;
}

function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.3;

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2);

    setTimeout(() => {
      const osc2 = audioContext.createOscillator();
      osc2.connect(gainNode);
      osc2.frequency.value = 1000;
      osc2.type = 'sine';
      osc2.start();
      osc2.stop(audioContext.currentTime + 0.2);
    }, 250);
  } catch (e) {
    console.log('无法播放提示音');
  }
}

function showNotification() {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('🍳 新订单', {
      body: '有新订单需要处理！',
      icon: '🍜'
    });
  }
}

// 请求通知权限
if ('Notification' in window && Notification.permission === 'default') {
  Notification.requestPermission();
}

// ========================================
// 导航
// ========================================

function goBack() {
  window.location.href = 'index.html';
}

// ========================================
// 启动
// ========================================
init();
