/**
 * 小饭馆点单系统 - 厨房显示逻辑 (v3.0 Firebase 同步版)
 */

// ========================================
// 本地存储配置
// ========================================
const LOCAL_STORAGE_KEY = 'restaurant_pos_state';

// ========================================
// 状态管理
// ========================================
const state = {
  orders: [],
  lastOrderCount: 0,
  orderNumber: 1 // 需要同步保存此字段，否则会覆盖前台数据
};

// ========================================
// 初始化
// ========================================
const ACCESS_PASSWORD = '474679';

function init() {
  // 全局错误捕获
  window.onerror = function (msg, url, line, col, error) {
    document.body.innerHTML += `
            <div style="position:fixed;top:0;left:0;right:0;background:red;color:white;padding:20px;z-index:9999;">
                <h3>⚠️ 厨房显示错误</h3>
                <p>${msg}</p>
                <small>${url}:${line}:${col}</small>
            </div>
        `;
    return false;
  };

  // 检查是否已验证 - 已移除，方便本地调试
  // if (sessionStorage.getItem('pos_authenticated') !== 'true') {
  //   const password = prompt('请输入访问密码：');
  //   if (password !== ACCESS_PASSWORD) {
  //     alert('密码错误！');
  //     document.body.innerHTML = '<div style="text-align:center;padding:100px;font-size:1.5rem;">⛔ 访问被拒绝</div>';
  //     return;
  //   }
  //   sessionStorage.setItem('pos_authenticated', 'true');
  // }

  loadStateFromLocal();
  listenToLocalChanges();
  renderOrders();
}

// 从 LocalStorage 加载状态
function loadStateFromLocal() {
  try {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (saved) {
      const data = JSON.parse(saved);
      state.orders = data.orders || [];
      state.orderNumber = data.orderNumber || 1;
      checkNewOrders();
    }
  } catch (error) {
    console.error('加载本地数据失败:', error);
  }
}

// 监听 LocalStorage 变化
function listenToLocalChanges() {
  console.log('开始监听本地数据...');

  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_STORAGE_KEY && e.newValue) {
      console.log('收到数据更新');
      const data = JSON.parse(e.newValue);

      // 更新状态
      state.orders = data.orders || [];
      state.orderNumber = data.orderNumber || state.orderNumber;

      renderOrders();
      checkNewOrders();
    }
  });

  // 轮询备份（防止同页面或其他情况漏掉事件）
  setInterval(() => {
    loadStateFromLocal();
    renderOrders();
  }, 2000);
}

// 保存订单到 LocalStorage
function saveOrders() {
  // 保持与 app.js 一致的数据结构
  const data = {
    orderNumber: state.orderNumber,
    orders: state.orders
  };

  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
}

// 保存订单到 Firebase


// ========================================
// 渲染函数
// ========================================

function renderOrders() {
  const container = document.getElementById('ordersGrid');
  // 显示未完成订单和最近的截断标记
  const list = state.orders.filter(o => o.status !== 'completed' || o.isSeparator);

  // 更新待处理数量
  const pendingCount = list.filter(o => !o.isSeparator).length;
  document.getElementById('orderCount').textContent = `待处理: ${pendingCount} 单`;

  if (list.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px; color: #999;">
        <div style="font-size: 4rem; margin-bottom: 20px;">🍳</div>
        <p style="font-size: 1.2rem;">暂无待处理订单</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map(order => renderOrderCard(order)).join('');
}

function renderOrderCard(order) {
  if (order.isSeparator) {
    return `
            <div style="grid-column: 1/-1; text-align: center; color: #999; margin: 20px 0; border-top: 1px dashed #ddd; padding-top: 20px;">
                ${order.separatorText}
            </div>
        `;
  }

  const time = new Date(order.createdAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
  // ... rest of the function (需要返回原始的模板字符串)

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
            ${order.foods.map((item, idx) => `
              <div class="order-item ${item.completed ? 'completed' : ''}" 
                   onclick="toggleItemStatus(${order.id}, 'food', ${idx})"
                   title="点击标记为已出餐">
                <span>${item.icon || '🍽️'} ${item.name} ×${item.quantity}</span>
                <span>${item.completed ? '✅' : ''} ¥${item.price * item.quantity}</span>
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
            ${order.drinks.map((item, idx) => `
              <div class="order-item ${item.completed ? 'completed' : ''}"
                   onclick="toggleItemStatus(${order.id}, 'drink', ${idx})"
                   title="点击标记为已出餐">
                <span>${item.icon || '🥤'} ${item.name} ×${item.quantity}</span>
                <span>${item.completed ? '✅' : ''} ¥${item.price * item.quantity}</span>
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

// 切换单个菜品的完成状态
function toggleItemStatus(orderId, type, index) {
  const order = state.orders.find(o => o.id === orderId);
  if (!order) return;

  const list = type === 'food' ? order.foods : order.drinks;
  if (!list || !list[index]) return;

  // 初始化 completed 属性（如果不存在）
  if (typeof list[index].completed === 'undefined') {
    list[index].completed = false;
  }

  list[index].completed = !list[index].completed;
  saveOrders();
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
