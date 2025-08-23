// js/app.js (修復版本 - 解決藥單上傳和顯示問題)

// --- 全域設定 ---
const API_ROOT = window.APP_CONFIG.API_ROOT;
const LIFF_ID = window.APP_CONFIG.LIFF_ID;

let user_id = null;

// --- 初始化 ---
window.onload = async () => {
    console.log('頁面開始載入...');
    
    // 1. LIFF 初始化與登入
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
            liff.login();
            return;
        }
        const profile = await liff.getProfile();
        user_id = profile.userId;
        console.log("LIFF 初始化成功，User ID:", user_id);
    } catch (e) {
        console.error("LIFF 初始化失敗:", e);
        user_id = "test_user_001";
        showToast("LIFF 初始化失敗，正以測試模式運行", "warning");
    }

    // 2. 綁定所有事件監聽器
    bindEvents();

    // 3. 修復後的頁面路由邏輯
    const targetView = determineTargetView();
    console.log('確定目標視圖:', targetView);
    
    showPageByView(targetView);
};

/**
 * 確定目標頁面視圖 - 修復版本
 */
function determineTargetView() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // 方式1: 直接從 view 參數取得
    if (urlParams.has('view')) {
        const view = urlParams.get('view');
        console.log('從 view 參數取得:', view);
        return view;
    }
    
    // 方式2: 從 liff.state 參數中解析
    if (urlParams.has('liff.state')) {
        const liffState = decodeURIComponent(urlParams.get('liff.state'));
        console.log('LIFF State 原始值:', urlParams.get('liff.state'));
        console.log('LIFF State 解碼後:', liffState);
        
        // 解析 liff.state 中的參數
        let stateParams;
        if (liffState.startsWith('?')) {
            stateParams = new URLSearchParams(liffState);
        } else if (liffState.startsWith('view=')) {
            stateParams = new URLSearchParams('?' + liffState);
        } else {
            stateParams = new URLSearchParams('?view=' + liffState);
        }
        
        if (stateParams.has('view')) {
            const view = stateParams.get('view');
            console.log('從 liff.state 解析出 view:', view);
            return view;
        }
    }
    
    // 方式3: 檢查其他可能的參數格式
    const allParams = Object.fromEntries(urlParams.entries());
    console.log('所有 URL 參數:', allParams);
    
    // 檢查是否有直接的視圖參數
    for (const [key, value] of Object.entries(allParams)) {
        if (['scan', 'medication', 'alert', 'terms'].includes(key)) {
            console.log('從參數鍵名確定視圖:', key);
            return key;
        }
        if (['scan', 'medication', 'alert', 'terms'].includes(value)) {
            console.log('從參數值確定視圖:', value);
            return value;
        }
    }
    
    // 預設返回掃描頁面
    console.log('使用預設視圖: scan');
    return 'scan';
}

/**
 * 根據視圖名稱顯示對應頁面
 */
function showPageByView(view) {
    let pageId;
    
    switch(view) {
        case 'scan':
            pageId = 'page-scan';
            break;
        case 'medication':
            pageId = 'page-medication-list';
            // 預載入用藥清單
            setTimeout(() => loadMedications(), 100);
            break;
        case 'alert':
            pageId = 'page-alert';
            // 預載入警戒頁面
            setTimeout(() => initializeAlertPage(), 100);
            break;
        case 'terms':
            pageId = 'page-terms';
            break;
        default:
            console.warn('未知的視圖類型:', view);
            pageId = 'page-scan';
    }
    
    console.log(`顯示頁面: ${view} -> ${pageId}`);
    showPage(pageId);
}

// --- 事件綁定 (修復版本) ---
function bindEvents() {
    console.log('開始綁定事件監聽器...');
    
    // 綁定文件輸入框變化事件 (修復重點)
    const fileInput = document.getElementById('prescriptionUpload');
    if (fileInput) {
        // 移除舊的事件監聽器（如果存在）
        fileInput.removeEventListener('change', handleFileSelect);
        // 綁定新的事件監聽器
        fileInput.addEventListener('change', handleFileSelect);
        console.log('已綁定文件選擇事件');
    } else {
        console.error('找不到文件輸入框元素 #prescriptionUpload');
    }

    // 綁定上傳按鈕事件
    const uploadBtn = document.getElementById('btn-upload');
    if (uploadBtn) {
        uploadBtn.removeEventListener('click', handleUploadAndRecognize);
        uploadBtn.addEventListener('click', handleUploadAndRecognize);
        console.log('已綁定上傳按鈕事件');
    } else {
        console.error('找不到上傳按鈕元素 #btn-upload');
    }

    // 修復上傳標籤點擊事件
    const uploadLabel = document.querySelector('.upload-label');
    if (uploadLabel && fileInput) {
        uploadLabel.removeEventListener('click', triggerFileSelect);
        uploadLabel.addEventListener('click', triggerFileSelect);
        console.log('已綁定上傳標籤點擊事件');
    } else {
        console.error('找不到上傳標籤或文件輸入框');
    }

    // 綁定服務條款接受按鈕
    const acceptTermsBtn = document.getElementById('btn-accept-terms');
    if (acceptTermsBtn) {
        acceptTermsBtn.removeEventListener('click', handleAcceptTerms);
        acceptTermsBtn.addEventListener('click', handleAcceptTerms);
    }

    console.log('事件監聽器綁定完成');
}

// --- 新增獨立的事件處理函數 ---

/**
 * 觸發文件選擇
 */
function triggerFileSelect(event) {
    event.preventDefault();
    event.stopPropagation();
    console.log('觸發文件選擇...');
    
    const fileInput = document.getElementById('prescriptionUpload');
    if (fileInput) {
        fileInput.click();
    }
}

/**
 * 處理文件選擇事件 (修復重點)
 */
function handleFileSelect(event) {
    console.log('文件選擇事件觸發');
    
    const file = event.target.files[0];
    const previewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('prescription-image-preview');
    const uploadBtn = document.getElementById('btn-upload');
    
    // 檢查必要元素是否存在
    if (!previewContainer || !imagePreview) {
        console.error('找不到預覽相關的DOM元素');
        showToast('頁面元素缺失，請重新整理頁面重試', 'error');
        return;
    }

    if (!file) {
        console.log('沒有選擇文件，隱藏預覽');
        previewContainer.style.display = 'none';
        imagePreview.src = '#';
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.textContent = '請先選擇圖片';
        }
        return;
    }

    // 驗證文件類型
    if (!file.type.startsWith('image/')) {
        console.error('選擇的文件不是圖片類型:', file.type);
        showToast('請選擇圖片文件 (JPG、PNG、GIF 等)', 'warning');
        previewContainer.style.display = 'none';
        imagePreview.src = '#';
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.textContent = '請選擇圖片文件';
        }
        return;
    }

    // 檢查文件大小 (限制為 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
        console.error('文件太大:', file.size, '位元組');
        showToast('圖片文件太大，請選擇小於 10MB 的圖片', 'warning');
        previewContainer.style.display = 'none';
        imagePreview.src = '#';
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.textContent = '圖片太大';
        }
        return;
    }

    console.log('開始讀取並預覽圖片:', file.name, file.size, '位元組');

    // 使用 FileReader 讀取並預覽圖片
    const reader = new FileReader();
    
    reader.onload = function(e) {
        console.log('圖片讀取成功，開始顯示預覽');
        try {
            imagePreview.src = e.target.result;
            previewContainer.style.display = 'block';
            
            // 啟用上傳按鈕
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.textContent = '🔍 開始辨識';
            }
            
            console.log('圖片預覽顯示成功');
            showToast('圖片已選擇，可以開始辨識', 'success');
            
        } catch (error) {
            console.error('顯示圖片預覽時出錯:', error);
            showToast('圖片預覽失敗，請重新選擇', 'error');
            previewContainer.style.display = 'none';
        }
    };
    
    reader.onerror = function(error) {
        console.error('讀取圖片文件失敗:', error);
        showToast('讀取圖片文件失敗，請重新選擇', 'error');
        previewContainer.style.display = 'none';
        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.textContent = '讀取失敗';
        }
    };
    
    // 開始讀取文件
    reader.readAsDataURL(file);
}

/**
 * 處理服務條款接受
 */
function handleAcceptTerms() {
    showToast('感謝您接受服務條款！', 'success');
    showPageByView('scan');
}

// --- UI 控制函式 ---
function showPage(pageId) {
    console.log('切換到頁面:', pageId);
    
    // 隱藏所有頁面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });
    
    // 示目標頁面
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        targetPage.style.display = 'block';
        console.log('成功顯示頁面:', pageId);
    } else {
        console.error(`找不到 ID 為 ${pageId} 的頁面，回退到預設頁面`);
        const defaultPage = document.getElementById('page-scan');
        if (defaultPage) {
            defaultPage.classList.add('active');
            defaultPage.style.display = 'block';
        }
    }
}

function showLoading(isLoading, message = '載入中...') {
    const loader = document.getElementById('loading-overlay');
    if (loader) {
        loader.querySelector('.loading-text').textContent = message;
        loader.style.display = isLoading ? 'flex' : 'none';
    }
}

function showToast(message, type = 'info') {
    console.log(`[${type.toUpperCase()}] ${message}`);
    
    // 創建一個更好的提示顯示方式
    const toastContainer = document.getElementById('toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // 樣式
    toast.style.cssText = `
        background: ${type === 'error' ? '#ef4444' : type === 'warning' ? '#f59e0b' : type === 'success' ? '#10b981' : '#3b82f6'};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        margin-bottom: 8px;
        animation: slideIn 0.3s ease-out;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    
    toastContainer.appendChild(toast);
    
    // 3秒後自動消失
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
            if (toast.parentNode) {
                toast.parentNode.removeChild(toast);
            }
        }, 300);
    }, 3000);
    
    // 後備方案：仍然使用 alert
    if (!document.getElementById('toast-container')) {
        alert(message);
    }
}

function createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 10000;
        max-width: 300px;
    `;
    
    // 添加 CSS 動畫
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
    document.body.appendChild(container);
    
    return container;
}

// --- 核心功能函式 ---

/**
 * 步驟1：處理上傳與辨識藥單 (修復版本)
 */
async function handleUploadAndRecognize() {
    console.log('開始處理藥單上傳和辨識');
    
    const fileInput = document.getElementById('prescriptionUpload');
    if (!fileInput) {
        console.error('找不到文件輸入框');
        showToast('頁面錯誤：找不到文件選擇器', 'error');
        return;
    }
    
    if (!fileInput.files || fileInput.files.length === 0) {
        console.warn('沒有選擇文件');
        showToast('請先選擇一張藥單照片！', 'warning');
        return;
    }
    
    const selectedFile = fileInput.files[0];
    console.log('選擇的文件:', selectedFile.name, selectedFile.size, '位元組');
    
    // 再次驗證文件類型
    if (!selectedFile.type.startsWith('image/')) {
        console.error('選擇的文件不是圖片:', selectedFile.type);
        showToast('請選擇圖片文件', 'error');
        return;
    }
    
    if (!user_id) {
        console.error('使用者ID不存在');
        showToast('無法取得使用者資訊，請重新載入頁面。', 'error');
        return;
    }

    showLoading(true, '藥單辨識中，請稍候...');
    
    try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('user_id', user_id);
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Taipei';
        formData.append('user_timezone', userTimezone);

        console.log('準備發送到API:', `${API_ROOT}/prescription/recognize`);
        console.log('使用者ID:', user_id);
        console.log('時區:', userTimezone);

        const res = await fetch(`${API_ROOT}/prescription/recognize`, {
            method: 'POST',
            body: formData
        });

        console.log('API響應狀態:', res.status);

        if (!res.ok) {
            const errorText = await res.text();
            console.error('API錯誤響應:', errorText);
            
            let errorMessage = '辨識失敗，請稍後再試';
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.detail || errorMessage;
            } catch (e) {
                errorMessage = `伺服器回應錯誤，狀態碼: ${res.status}`;
            }
            throw new Error(errorMessage);
        }

        const data = await res.json();
        console.log('辨識結果:', data);

        if (!data.medications || data.medications.length === 0) {
            console.warn('沒有辨識出藥物資訊');
            showToast('無法從圖片中辨識出用藥資訊，請嘗試更清晰的照片。', 'info');
            return;
        }

        console.log(`成功辨識出 ${data.medications.length} 種藥物`);
        renderMedicationEditForm(data.medications);
        showPage('page-medication-edit');
        showToast(`成功辨識出 ${data.medications.length} 種藥物！`, 'success');

    } catch (error) {
        console.error("辨識失敗:", error);
        showToast(`處理失敗: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// --- 用藥清單相關函式 ---

async function loadMedications() {
    if (!user_id) {
        console.error('無法載入用藥清單：user_id 為空');
        showToast('無法載入用藥清單：使用者資訊缺失', 'error');
        return;
    }
    
    showLoading(true, '正在載入用藥清單...');
    
    try {
        console.log(`正在載入使用者 ${user_id} 的用藥清單...`);
        
        const response = await fetch(`${API_ROOT}/medications/user/${user_id}`);
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: `載入失敗: ${response.status}` }));
            throw new Error(errorData.detail || `載入失敗: ${response.status}`);
        }
        
        const medications = await response.json();
        console.log('成功載入用藥清單:', medications);
        
        displayMedicationList(medications);
        
    } catch (error) {
        console.error("載入用藥清單失敗:", error);
        showToast(`載入用藥清單失敗: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

function displayMedicationList(medications) {
    let container = document.getElementById('medication-list-container');
    
    if (!container) {
        console.log('用藥管理頁面容器不存在，正在創建...');
        createMedicationListPage();
        container = document.getElementById('medication-list-container');
    }
    
    if (!container) {
        console.error('無法創建或找到用藥管理頁面容器');
        return;
    }
    
    container.innerHTML = '';
    
    if (!medications || medications.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8">
                <p class="text-gray-500 mb-4">目前沒有用藥紀錄</p>
                <button onclick="showPageByView('scan')" class="btn-primary">
                    新增用藥紀錄
                </button>
            </div>
        `;
        return;
    }
    
    let listHtml = '<div class="medication-list space-y-4">';
    
    medications.forEach(med => {
        const statusClass = med.status === '已停藥' ? 'bg-gray-100' : 'bg-white';
        const statusText = med.status === '已停藥' ? '已停藥' : '進行中';
        
        listHtml += `
            <div class="${statusClass} p-4 rounded-lg shadow border">
                <div class="flex justify-between items-start mb-2">
                    <h3 class="text-lg font-bold text-blue-600">${med.name || '未知藥物'}</h3>
                    <span class="px-2 py-1 text-xs rounded ${med.status === '已停藥' ? 'bg-gray-200 text-gray-600' : 'bg-green-100 text-green-800'}">${statusText}</span>
                </div>
                <div class="space-y-1 text-sm text-gray-700">
                    <p><strong>作用:</strong> ${med.effect || '未指定'}</p>
                    <p><strong>劑量:</strong> ${med.dose || '未指定'}</p>
                    <p><strong>頻率:</strong> ${med.frequency || '未指定'}</p>
                    <p><strong>服藥期間:</strong> ${med.start_date || '未指定'} ~ ${med.end_date || '長期'}</p>
                </div>
                <div class="mt-3 flex space-x-2">
                    <button onclick="editMedication(${med.id})" class="btn-secondary text-xs">編輯</button>
                    <button onclick="deleteMedication(${med.id})" class="btn-danger text-xs">刪除</button>
                </div>
            </div>
        `;
    });
    
    listHtml += '</div>';
    
    listHtml += `
        <div class="mt-6 text-center">
            <button onclick="showPageByView('scan')" class="btn-primary">
                新增用藥紀錄
            </button>
        </div>
    `;
    
    container.innerHTML = listHtml;
}

function createMedicationListPage() {
    let medicationPage = document.getElementById('page-medication-list');
    
    if (!medicationPage) {
        medicationPage = document.createElement('div');
        medicationPage.id = 'page-medication-list';
        medicationPage.className = 'page';
        medicationPage.style.display = 'none';
        
        medicationPage.innerHTML = `
            <h3>用藥管理</h3>
            <div id="medication-list-container">
                <p class="text-center text-gray-500">載入中...</p>
            </div>
        `;
        
        const mainContainer = document.querySelector('main');
        if (mainContainer) {
            mainContainer.appendChild(medicationPage);
            console.log('成功創建用藥管理頁面');
        } else {
            console.error('找不到主容器，無法添加用藥管理頁面');
        }
    }
}

/**
 * 編輯藥物功能 - 完整實作
 */
async function editMedication(medicationId) {
    if (!medicationId) {
        showToast('無效的藥物 ID', 'error');
        return;
    }
    
    showLoading(true, '載入藥物資料中...');
    
    try {
        // 1. 從後端 API 獲取藥物詳細資料
        const response = await fetch(`${API_ROOT}/medications/user/${user_id}`);
        
        if (!response.ok) {
            throw new Error('載入藥物資料失敗');
        }
        
        const medications = await response.json();
        const medication = medications.find(med => med.id === medicationId);
        
        if (!medication) {
            throw new Error('找不到指定的藥物');
        }
        
        console.log('載入要編輯的藥物:', medication);
        
        // 2. 將藥物資料轉換為編輯表單格式
        const medicationForEdit = [{
            id: medication.id,
            name: medication.name || '',
            effect: medication.effect || '',
            dose: medication.dose || '',
            frequency: medication.frequency || '',
            start_date: medication.start_date || '',
            end_date: medication.end_date || '',
            status: medication.status || '進行中',
            remind_times: medication.remind_times || []
        }];
        
        // 3. 渲染編輯表單
        renderMedicationEditForm(medicationForEdit, true); // true 表示是編輯模式
        
        // 4. 切換到編輯頁面
        showPage('page-medication-edit');
        
    } catch (error) {
        console.error('載入藥物編輯資料失敗:', error);
        showToast(`載入失敗: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

async function deleteMedication(medicationId) {
    if (!confirm('確定要刪除這筆用藥紀錄嗎？')) {
        return;
    }
    
    try {
        const response = await fetch(`${API_ROOT}/medications/${medicationId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error('刪除失敗');
        }
        
        showToast('用藥紀錄已刪除', 'success');
        await loadMedications();
        
    } catch (error) {
        console.error('刪除藥物失敗:', error);
        showToast('刪除失敗', 'error');
    }
}

// --- 藥物警戒相關函式 ---

/**
 * 載入使用者個人資料
 */
async function loadUserProfile() {
    if (!user_id) {
        showToast('無法載入個人資料：使用者資訊缺失', 'error');
        return;
    }
    
    try {
        showLoading(true, '載入個人資料中...');
        
        const response = await fetch(`${API_ROOT}/user-profile/${user_id}`);
        
        if (!response.ok) {
            throw new Error(`載入個人資料失敗: ${response.status}`);
        }
        
        const profile = await response.json();
        console.log('成功載入個人資料:', profile);
        
        populateProfileForm(profile);
        
    } catch (error) {
        console.error('載入個人資料失敗:', error);
        showToast(`載入個人資料失敗: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * 將個人資料填入表單
 */
function populateProfileForm(profile) {
    const allFields = [
        // 飲食習慣
        'diet_alcohol', 'diet_caffeine', 'diet_grapefruit', 'diet_milk', 
        'diet_high_fat', 'diet_high_vitamin_k', 'diet_tyramine',
        
        // 保健食品/中藥
        'supp_st_johns_wort', 'supp_ginkgo', 'supp_ginseng', 'supp_garlic',
        'supp_grape_seed', 'supp_fish_oil', 'supp_omega3', 'supp_licorice', 'supp_red_yeast_rice',
        
        // 個人病史
        'history_asthma', 'history_diabetes', 'history_hypertension', 'history_liver_dysfunction',
        'history_kidney_dysfunction', 'history_gastric_ulcer', 'history_epilepsy', 'history_arrhythmia',
        
        // 特殊生理狀況
        'condition_pregnancy', 'condition_breastfeeding', 'condition_infant', 'condition_elderly', 'condition_obesity'
    ];
    
    allFields.forEach(fieldName => {
        const checkbox = document.getElementById(fieldName);
        if (checkbox) {
            checkbox.checked = profile[fieldName] || false;
        }
    });
}

/**
 * 更新使用者個人資料
 */
async function updateUserProfile() {
    if (!user_id) {
        showToast('無法更新個人資料：使用者資訊缺失', 'error');
        return;
    }
    
    try {
        showLoading(true, '更新個人資料中...');
        
        const profileData = collectProfileFormData();
        
        const response = await fetch(`${API_ROOT}/user-profile/${user_id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(profileData)
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: `更新失敗: ${response.status}` }));
            throw new Error(errorData.detail || '更新個人資料失敗');
        }
        
        const updatedProfile = await response.json();
        console.log('成功更新個人資料:', updatedProfile);
        
        showToast('個人資料已成功更新！', 'success');
        
    } catch (error) {
        console.error('更新個人資料失敗:', error);
        showToast(`更新個人資料失敗: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

/**
 * 收集表單資料
 */
function collectProfileFormData() {
    const allFields = [
        // 飲食習慣
        'diet_alcohol', 'diet_caffeine', 'diet_grapefruit', 'diet_milk', 
        'diet_high_fat', 'diet_high_vitamin_k', 'diet_tyramine',
        
        // 保健食品/中藥
        'supp_st_johns_wort', 'supp_ginkgo', 'supp_ginseng', 'supp_garlic',
        'supp_grape_seed', 'supp_fish_oil', 'supp_omega3', 'supp_licorice', 'supp_red_yeast_rice',
        
        // 個人病史
        'history_asthma', 'history_diabetes', 'history_hypertension', 'history_liver_dysfunction',
        'history_kidney_dysfunction', 'history_gastric_ulcer', 'history_epilepsy', 'history_arrhythmia',
        
        // 特殊生理狀況
        'condition_pregnancy', 'condition_breastfeeding', 'condition_infant', 'condition_elderly', 'condition_obesity'
    ];
    
    const profileData = {};
    
    allFields.forEach(fieldName => {
        const checkbox = document.getElementById(fieldName);
        if (checkbox) {
            profileData[fieldName] = checkbox.checked;
        }
    });
    
    return profileData;
}

/**
 * 執行藥物交互作用分析
 */
async function analyzeDrugInteractions() {
    if (!user_id) {
        showToast('無法進行分析：使用者資訊缺失', 'error');
        return;
    }
    
    try {
        showLoading(true, '正在進行藥物交互作用分析，請稍候...');
        
        const response = await fetch(`${API_ROOT}/alert/analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: user_id
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: `分析失敗: ${response.status}` }));
            throw new Error(errorData.detail || '藥物交互作用分析失敗');
        }
        
        const analysisResult = await response.json();
        console.log('藥物交互作用分析結果:', analysisResult);
        
        displayAnalysisResult(analysisResult);
        
        showToast('藥物交互作用分析完成！', 'success');
        
    } catch (error) {
        console.error('藥物交互作用分析失敗:', error);
        showToast(`分析失敗: ${error.message}`, 'error');
        
        const resultContainer = document.getElementById('analysis-result-container');
        if (resultContainer) {
            resultContainer.style.display = 'none';
        }
    } finally {
        showLoading(false);
    }
}

/**
 * 顯示分析結果
 */
function displayAnalysisResult(analysisResult) {
    const resultContainer = document.getElementById('analysis-result-container');
    const contentElement = document.getElementById('analysis-result-content');
    const disclaimerElement = document.getElementById('disclaimer-text');
    
    if (!resultContainer || !contentElement) {
        console.error('找不到分析結果顯示元素');
        return;
    }
    
    contentElement.textContent = analysisResult.analysis_result || analysisResult || '分析結果載入失敗';
    
    if (disclaimerElement) {
        disclaimerElement.textContent = '本分析結果僅供參考，不可取代專業醫療建議。如有疑問，請諮詢您的醫師或藥師。';
    }
    
    resultContainer.style.display = 'block';
    
    resultContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * 初始化藥物警戒頁面
 */
function initializeAlertPage() {
    const updateProfileBtn = document.getElementById('btn-update-profile');
    if (updateProfileBtn) {
        updateProfileBtn.removeEventListener('click', updateUserProfile); // 避免重複綁定
        updateProfileBtn.addEventListener('click', updateUserProfile);
    }
    
    const analyzeBtn = document.getElementById('btn-analyze-interaction');
    if (analyzeBtn) {
        analyzeBtn.removeEventListener('click', analyzeDrugInteractions); // 避免重複綁定
        analyzeBtn.addEventListener('click', analyzeDrugInteractions);
    }
    
    loadUserProfile();
}

/**
 * 步驟2：根據辨識結果，動態生成可編輯的表單
 */
function renderMedicationEditForm(medications) {
    console.log('開始渲染藥物編輯表單，藥物數量:', medications.length);
    
    const container = document.getElementById('medication-edit-form-container');
    if (!container) {
        console.error('找不到藥物編輯表單容器');
        return;
    }

    let formHtml = '';
    medications.forEach((med, index) => {
        console.log(`渲染藥物 ${index + 1}:`, med.name);
        
        formHtml += `
            <div class="medication-card bg-white p-4 rounded-lg shadow mb-4" data-index="${index}">
                <h3 class="text-lg font-bold text-blue-600 border-b pb-2 mb-3">藥物 ${index + 1}</h3>
                <div class="space-y-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">藥物名稱 <span class="text-red-500">*</span></label>
                        <input type="text" value="${escapeHtml(med.name || '')}" data-field="name" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" required>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">藥物作用</label>
                        <input type="text" value="${escapeHtml(med.effect || '')}" data-field="effect" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">劑量</label>
                        <input type="text" value="${escapeHtml(med.dose || '')}" data-field="dose" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">頻率</label>
                        <input type="text" value="${escapeHtml(med.frequency || '')}" data-field="frequency" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">開始日期</label>
                        <input type="date" value="${med.start_date || ''}" data-field="start_date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">結束日期 (可選)</label>
                        <input type="date" value="${med.end_date || ''}" data-field="end_date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">
                            <input type="checkbox" data-field="is_discontinued" class="mr-2">
                            是否停藥
                        </label>
                    </div>
                </div>
            </div>
        `;
    });

    formHtml += `
        <div class="mt-6 flex justify-end space-x-4">
            <button type="button" id="btn-cancel-edit" class="btn-secondary">取消</button>
            <button type="button" id="btn-save-medications" class="btn-primary">儲存所有藥物</button>
        </div>
    `;

    container.innerHTML = formHtml;
    
    // 綁定保存按鈕事件
    const saveBtn = document.getElementById('btn-save-medications');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveMedicationFromForm);
        console.log('已綁定保存按鈕事件');
    }
    
    // 綁定取消按鈕事件
    const cancelBtn = document.getElementById('btn-cancel-edit');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            if (confirm('確定要取消編輯嗎？未保存的資料將會遺失。')) {
                showPageByView('scan');
            }
        });
        console.log('已綁定取消按鈕事件');
    }
    
    console.log('藥物編輯表單渲染完成');
}

/**
 * HTML 轉義函數，防止 XSS 攻擊
 */
function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, function(m) { return map[m]; });
}

/**
 * 步驟3：從編輯表單收集資料並呼叫 API 儲存 (修復版本)
 */
async function saveMedicationFromForm() {
    console.log('開始保存藥物資訊');
    showLoading(true, '正在儲存用藥紀錄...');

    const medicationCards = document.querySelectorAll('#medication-edit-form-container .medication-card');
    const medicationsPayload = [];

    console.log(`找到 ${medicationCards.length} 個藥物卡片`);

    medicationCards.forEach((card, index) => {
        console.log(`處理藥物卡片 ${index + 1}`);
        
        const medication = {
            user_id: user_id
        };
        
        // 收集基本字段
        card.querySelectorAll('input[data-field]').forEach(input => {
            const field = input.dataset.field;
            let value = input.value || null;
            
            // 特殊處理日期字段
            if ((field === 'start_date' || field === 'end_date') && value === '') {
                value = null;
            }
            
            // 特殊處理複選框字段
            if (input.type === 'checkbox') {
                if (field === 'is_discontinued') {
                    medication.status = input.checked ? '已停藥' : '進行中';
                }
            } else {
                medication[field] = value;
            }
        });
        
        console.log(`藥物 ${index + 1} 數據:`, medication);
        
        // 驗證必要字段
        if (medication.name && medication.name.trim() !== '') {
            medicationsPayload.push(medication);
            console.log(`藥物 ${index + 1} 已添加到保存列表`);
        } else {
            console.warn(`藥物 ${index + 1} 缺少名稱，跳過保存`);
        }
    });

    if (medicationsPayload.length === 0) {
        console.warn('沒有有效的藥物數據可保存');
        showToast('請至少填寫一個藥物的名稱！', 'warning');
        showLoading(false);
        return;
    }

    try {
        console.log('準備傳送的資料:', JSON.stringify(medicationsPayload, null, 2));
        
        const res = await fetch(`${API_ROOT}/medications/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(medicationsPayload)
        });

        console.log('API 響應狀態:', res.status);

        if (!res.ok) {
            const errorText = await res.text();
            console.error('API 錯誤響應:', errorText);
            
            let errorMessage = '儲存失敗';
            try {
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.detail || errorMessage;
            } catch (e) {
                errorMessage = `儲存失敗，狀態碼: ${res.status}`;
            }
            throw new Error(errorMessage);
        }

        const savedMedications = await res.json();
        console.log('成功儲存藥物:', savedMedications);
        
        showToast(`成功儲存 ${savedMedications.length} 筆用藥紀錄！`, 'success');
        showPageByView('medication');
        
        // 延遲載入藥物清單，確保頁面切換完成
        setTimeout(() => {
            loadMedications();
        }, 300);

    } catch (error) {
        console.error('儲存藥物失敗:', error);
        showToast(`儲存失敗: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// 全域函數，供 HTML 內聯事件調用
window.showPageByView = showPageByView;
window.editMedication = editMedication;
window.deleteMedication = deleteMedication;