// app/liff/js/config.js (修复版本)
window.APP_CONFIG = {
    API_ROOT: '/api',
    LIFF_ID: '2007810189-dBz0ZzVP'  // 请确认这个 ID 是否正确
};

// 调试用：在页面载入时显示设定资讯
console.log('APP_CONFIG 载入完成:', window.APP_CONFIG);
console.log('当前页面 URL:', window.location.href);
console.log('URL 参数:', window.location.search);

// 添加调试函数
window.debugLIFF = function() {
    console.log('=== LIFF 调试信息 ===');
    console.log('LIFF ID:', window.APP_CONFIG.LIFF_ID);
    console.log('当前 URL:', window.location.href);
    console.log('URL 参数:', new URLSearchParams(window.location.search));
    
    if (typeof liff !== 'undefined') {
        console.log('LIFF 是否已登录:', liff.isLoggedIn());
        console.log('LIFF 是否在 LINE 中:', liff.isInClient());
    } else {
        console.log('LIFF SDK 未载入');
    }
};

// 页面载入完成后自动执行调试
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        window.debugLIFF();
    }, 1000);
});