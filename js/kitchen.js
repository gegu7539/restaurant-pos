/**
 * 小饭馆点单系统 - 厨房显示逻辑 (v3.0 Firebase 同步版)
 */

// ========================================
// Firebase 配置
// ========================================
const firebaseConfig = {
  databaseURL: "https://restaurant-pos-f8ce4-default-rtdb.firebaseio.com"
};

// 初始化 Firebase 变量（延迟赋值）
let database;
let auth;

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
    // 尝试初始化 Firebase
    if (typeof firebase === 'undefined') throw new Error('Firebase SDK 未加载');
    if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
    database = firebase.database();
    auth = firebase.auth();

    auth.signInAnonymously().then(() => {
      console.log('Firebase 匿名登录成功');
      renderOrders();
      listenToFirebaseChanges();

      // 监听 Auth 状态变化，如果掉线自动重连
      auth.onAuthStateChanged(user => {
        if (user) {
          console.log('用户已登录:', user.uid);
        } else {
          console.log('用户未登录');
          auth.signInAnonymously();
        }
      });
    }).catch(error => {
      console.error('Firebase 登录失败:', error);
      alert('警告：无法连接云端数据库（可能是未开启匿名验证）。\n无法获取实时订单！');
      // 降级：虽然无法获取实时订单，但渲染包含空状态的界面
      renderOrders();
    });
  } catch (e) {
    console.error(e);
    alert('系统错误: ' + e.message);
  }
}

// 监听 Firebase 实时变化
function listenToFirebaseChanges() {
  console.log('开始监听 Firebase...');

  // 监听连接状态
  database.ref('.info/connected').on('value', (snap) => {
    if (snap.val() === true) {
      console.log('✅ Firebase 已连接');
      document.getElementById('orderCount').style.color = '#4CAF50';
    } else {
      console.log('❌ Firebase 未连接');
      document.getElementById('orderCount').style.color = '#f44336';
    }
  });

  database.ref('pos').on('value', (snapshot) => {
    console.log('收到 Firebase 数据更新');
    const data = snapshot.val();
    if (data) {
      state.orders = data.orders ? Object.values(data.orders) : [];
      console.log('订单数量:', state.orders.length);
      renderOrders();
      checkNewOrders();
    }
  }, (error) => {
    console.error('Firebase 监听错误:', error);
    alert('Firebase 连接失败，请检查数据库规则是否已设置为公开读写');
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
