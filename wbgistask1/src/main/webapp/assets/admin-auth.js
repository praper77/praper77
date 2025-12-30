// 简易前端身份验证（适用于课程演示）
// 说明：这是纯前端校验，不适合生产环境。
// 你可以修改 ADMIN_PASS 为你的密码。
const ADMIN_PASS = 'whuaed2025'; // TODO: 修改为你自己的管理员密码

const loginDialog = document.getElementById('loginDialog');
const loginForm = document.getElementById('loginForm');
const loginPassword = document.getElementById('loginPassword');
const loginError = document.getElementById('loginError');
const loginCancel = document.getElementById('loginCancel');
const rememberMe = document.getElementById('rememberMe');

const adminContent = document.getElementById('adminContent');
const logoutLink = document.getElementById('logoutLink');

function isAuthenticated(){
  // 优先检查 sessionStorage；若选了记住登录则检查 localStorage
  const session = sessionStorage.getItem('admin_authed') === '1';
  const remembered = localStorage.getItem('admin_authed') === '1';
  return session || remembered;
}

function showAdmin(){
  adminContent.style.display = 'block';
  logoutLink.style.display = 'inline';
}
function hideAdmin(){
  adminContent.style.display = 'none';
  logoutLink.style.display = 'none';
}

function openLogin(){
  loginError.style.display = 'none';
  loginPassword.value = '';
  rememberMe.checked = false;
  loginDialog.showModal();
}
function closeLogin(){
  loginDialog.close();
}

loginForm.addEventListener('submit', (e)=>{
  e.preventDefault();
  const pass = loginPassword.value.trim();
  if (!pass) {
    loginError.textContent = '请输入密码';
    loginError.style.display = 'block';
    return;
  }
  if (pass !== ADMIN_PASS) {
    loginError.textContent = '密码错误';
    loginError.style.display = 'block';
    return;
  }
  // 通过验证
  sessionStorage.setItem('admin_authed', '1');
  if (rememberMe.checked) localStorage.setItem('admin_authed', '1');
  loginError.style.display = 'none';
  closeLogin();
  showAdmin();
});

loginCancel.addEventListener('click', ()=>{
  closeLogin();
  // 未登录则返回首页或保持隐藏
});

logoutLink.addEventListener('click', (e)=>{
  e.preventDefault();
  sessionStorage.removeItem('admin_authed');
  localStorage.removeItem('admin_authed');
  hideAdmin();
  openLogin();
});

// 初始化：进入页面时检查是否已登录
(function initAuth(){
  if (isAuthenticated()) {
    showAdmin();
  } else {
    hideAdmin();
    openLogin();
  }
})();