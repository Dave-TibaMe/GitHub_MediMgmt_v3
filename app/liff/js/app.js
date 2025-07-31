// app/liff/js/app.js (修正版 - 改善路由處理)

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
            console.log('使用者未登入，執行登入...');
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

    // 3. 解析並處理路由參數
    const targetView = parseRouteParameters();
    console.log('解析到的目標頁面:', targetView);
    
    // 4. 顯示對應頁面並載入資料
    await showPageAndLoadData(targetView);
};

// --- 路由參數解析 ---
function parseRouteParameters() {
    const urlParams = new URLSearchParams(window.location.search);
    console.log('完整 URL:', window.location.href);
    console.log('查詢參數:', window.location.search);
    
    let view = 'scan'; // 預設值
    
    // 方法1: 直接檢查 view 參數
    if (urlParams.has('view')) {
        view = urlParams.get('view');
        console.log('從直接 view 參數取得:', view);
        return view;
    }
    
    // 方法2: 檢查 LIFF 的 liff.state 參數
    if (urlParams.has('liff.state')) {
        const liffState = decodeURIComponent(urlParams.get('liff.state'));
        console.log('LIFF State 原始值:', urlParams.get('liff.state'));
        console.log('LIFF State 解碼後:', liffState);
        
        // 解析 liff.state 中的參數
        if (liffState.startsWith('?')) {
            const stateParams = new URLSearchParams(liffState);
            if (stateParams.has('view')) {
                view = stateParams.get('view');
                console.log('從 liff.state 取得 view:', view);
                return view;
            }
        }
        
        // 有時候 liff.state 直接是 view 的值
        if (['scan', 'medication', 'alert', 'terms'].includes(liffState)) {
            view = liffState;
            console.log('liff.state 直接是 view 值:', view);
            return view;
        }
    }
    
    // 方法3: 檢查 URL fragment (#)
    const hash = window.location.hash;
    if (hash) {
        const hashView = hash.substring(1); // 移除 # 字符
        if (['scan', 'medication', 'alert', 'terms'].includes(hashView)) {
            view = hashView;
            console.log('從 URL fragment 取得 view:', view);
            return view;
        }
    }
    
    // 方法4: 檢查所有可能的參數名稱
    const possibleParams = ['page', 'section', 'tab', 'route'];
    for (const param of possibleParams) {
        if (urlParams.has(param)) {
            const paramValue = urlParams.get(param);
            if (['scan', 'medication', 'alert', 'terms'].includes(paramValue)) {
                view = paramValue;
                console.log(`從 ${param} 參數取得 view:`, view);
                return view;
            }
        }
    }
    
    console.log('使用預設 view:', view);
    return view;
}

// --- 顯示頁面並載入資料 ---
async function showPageAndLoadData(view) {
    // 根據 view 參數對應到正確的頁面 ID
    let pageId, pageTitle;
    
    switch(view) {
        case 'scan':
            pageId = 'page-scan';
            pageTitle = '藥單掃描';
            break;
        case 'medication':
            pageId = 'page-medication-list';
            pageTitle = '用藥管理';
            break;
        case 'alert':
            pageId = 'page-alert';
            pageTitle = '藥物警戒';
            break;
        case 'terms':
            pageId = 'page-terms';
            pageTitle = '服務條款';
            break;
        default:
            pageId = 'page-scan';
            pageTitle = '藥單掃描';
            view = 'scan';
    }
    
    console.log(`顯示頁面: ${pageTitle} (${pageId})`);
    
    // 確保頁面存在，如果不存在則創建
    ensurePageExists(pageId, view);
    
    // 顯示頁面
    showPage(pageId);
    
    // 根據頁面類型載入對應資料
    try {
        if (view === 'medication') {
            console.log('載入用藥管理資料...');
            await loadMedications();
        } else if (view === 'alert') {
            console.log('載入藥物警戒頁面...');
            showAlertPage();
        } else if (view === 'terms') {
            console.log('載入服務條款...');
            showTermsPage();
        }
    } catch (error) {
        console.error(`載入 ${pageTitle} 資料時發生錯誤:`, error);
        showToast(`載入 ${pageTitle} 資料失敗`, 'error');
    }
}

// --- 確保頁面存在 ---
function ensurePageExists(pageId, view) {
    let page = document.getElementById(pageId);
    
    if (!page) {
        console.log(`頁面 ${pageId} 不存在，正在創建...`);
        
        const mainContainer = document.querySelector('main');
        if (!mainContainer) {
            console.error('找不到主容器');
            return;
        }
        
        page = document.createElement('div');
        page.id = pageId;
        page.className = 'page';
        page.style.display = 'none';
        
        // 根據頁面類型設定內容
        switch(view) {
            case 'medication':
                page.innerHTML = `
                    <h3>用藥管理</h3>
                    <div id="medication-list-container">
                        <p class="text-center text-gray-500">載入中...</p>
                    </div>
                `;
                break;
            case 'alert':
                page.innerHTML = `
                    <h3>藥物警戒</h3>
                    <div id="alert-container">
                        <p class="text-center text-gray-500">載入中...</p>
                    </div>
                `;
                break;
            case 'terms':
                page.innerHTML = `
                    <h3>服務條款</h3>
                    <div id="terms-container">
                        <p class="text-center text-gray-500">載入中...</p>
                    </div>
                `;
                break;
        }
        
        mainContainer.appendChild(page);
        console.log(`成功創建 ${pageId} 頁面`);
    }
}

// --- 事件綁定 ---
function bindEvents() {
    // 藥單上傳相關事件
    document.getElementById('btn-upload')?.addEventListener('click', handleUploadAndRecognize);

    const fileInput = document.getElementById('prescriptionUpload');
    const previewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('prescription-image-preview');

    if (fileInput && previewContainer && imagePreview) {
        // 點擊上傳標籤觸發檔案選擇
        document.querySelector('.upload-label')?.addEventListener('click', () => {
            fileInput.click();
        });
        
        // 檔案選擇變更事件
        fileInput.addEventListener('change', (event) => {
            const file = event.target.files[0];
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    imagePreview.src = e.target.result;
                    previewContainer.style.display = 'block';
                };
                reader.readAsDataURL(file);
            } else {
                previewContainer.style.display = 'none';
                imagePreview.src = '#';
            }
        });
    }

    // 導航按鈕事件
    document.getElementById('btn-load-medications')?.addEventListener('click', () => {
        showPage('page-medication-list');
        loadMedications();
    });
    
    document.getElementById('btn-analyze-alerts')?.addEventListener('click', () => {
        showPage('page-alert');
        showAlertPage();
    });
}

// --- UI 控制函式 ---
function showPage(pageId) {
    console.log(`切換到頁面: ${pageId}`);
    
    // 隱藏所有頁面
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    
    // 顯示目標頁面
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.style.display = 'block';
        console.log(`成功顯示頁面: ${pageId}`);
    } else {
        console.error(`找不到 ID 為 ${pageId} 的頁面`);
        // 回退到預設頁面
        const defaultPage = document.getElementById('page-scan');
        if (defaultPage) {
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
    alert(message);
}

// --- 核心功能函式 ---
async function handleUploadAndRecognize() {
    const fileInput = document.getElementById('prescriptionUpload');
    if (!fileInput.files || fileInput.files.length === 0) {
        showToast('請先選擇一張藥單照片！', 'warning');
        return;
    }
    if (!user_id) {
        showToast('無法獲取使用者資訊，請重新載入頁面。', 'error');
        return;
    }

    showLoading(true, '藥單辨識中，請稍候...');
    
    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('user_id', user_id);
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Taipei';
    formData.append('user_timezone', userTimezone);

    try {
        const res = await fetch(`${API_ROOT}/prescription/recognize`, {
            method: 'POST',
            body: formData
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ detail: `伺服器回應錯誤，狀態碼: ${res.status}` }));
            throw new Error(errorData.detail || '辨識失敗，請稍後再試');
        }

        const data = await res.json();
        if (!data.medications || data.medications.length === 0) {
            showToast('無法從圖片中辨識出用藥資訊，請嘗試更清晰的照片。', 'info');
            return;
        }

        renderMedicationEditForm(data.medications);
        showPage('page-medication-edit');

    } catch (error) {
        console.error("辨識失敗:", error);
        showToast(`處理失敗: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// --- 其他核心功能保持不變 ---
function renderMedicationEditForm(medications) {
    const container = document.getElementById('medication-edit-form-container');
    if (!container) return;

    let formHtml = '';
    medications.forEach((med, index) => {
        formHtml += `
            <div class="medication-card bg-white p-4 rounded-lg shadow mb-4" data-index="${index}">
                <h3 class="text-lg font-bold text-blue-600 border-b pb-2 mb-3">藥物 ${index + 1}</h3>
                <div class="space-y-3">
                    <div>
                        <label class="block text-sm font-medium text-gray-700">藥物名稱</label>
                        <input type="text" value="${med.name || ''}" data-field="name" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">藥物作用</label>
                        <input type="text" value="${med.effect || ''}" data-field="effect" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">劑量</label>
                        <input type="text" value="${med.dose || ''}" data-field="dose" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">頻率</label>
                        <input type="text" value="${med.frequency || ''}" data-field="frequency" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">開始日期</label>
                        <input type="date" value="${med.start_date || ''}" data-field="start_date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-gray-700">結束日期 (可選)</label>
                        <input type="date" value="${med.end_date || ''}" data-field="end_date" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm">
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
    document.getElementById('btn-save-medications')?.addEventListener('click', saveMedicationFromForm);
    document.getElementById('btn-cancel-edit')?.addEventListener('click', () => showPage('page-scan'));
}

async function saveMedicationFromForm() {
    showLoading(true, '正在儲存用藥紀錄...');

    const medicationCards = document.querySelectorAll('#medication-edit-form-container .medication-card');
    const medicationsPayload = [];

    medicationCards.forEach(card => {
        const medication = {
            user_id: user_id
        };
        
        card.querySelectorAll('input[data-field]').forEach(input => {
            const field = input.dataset.field;
            let value = input.value || null;
            
            if ((field === 'start_date' || field === 'end_date') && value === '') {
                value = null;
            }
            
            medication[field] = value;
        });
        
        if (medication.name && medication.name.trim() !== '') {
            medicationsPayload.push(medication);
        }
    });

    if (medicationsPayload.length === 0) {
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

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ detail: `儲存失敗，狀態碼: ${res.status}` }));
            throw new Error(errorData.detail || '儲存失敗');
        }

        const savedMedications = await res.json();
        console.log('成功儲存藥物:', savedMedications);
        
        showToast('用藥紀錄已成功儲存！', 'success');
        showPage('page-medication-list');
        await loadMedications();

    } catch (error) {
        console.error('儲存藥物失敗:', error);
        showToast(`儲存失敗: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

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
        ensurePageExists('page-medication-list', 'medication');
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
                <button onclick="showPage('page-scan')" class="btn-primary">
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
            <button onclick="showPage('page-scan')" class="btn-primary">
                新增用藥紀錄
            </button>
        </div>
    `;
    
    container.innerHTML = listHtml;
}

function editMedication(medicationId) {
    showToast(`編輯藥物功能尚未實作 (ID: ${medicationId})`, 'info');
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

function showAlertPage() {
    showToast('藥物交互作用分析功能尚未實作。', 'info');
}

function showTermsPage() {
    const container = document.getElementById('terms-container');
    if (container) {
        container.innerHTML = `
            <div class="bg-white p-6 rounded-lg shadow">
                <h4 class="text-lg font-bold mb-4">服務條款與免責聲明</h4>
                <div class="space-y-4 text-sm text-gray-700">
                    <p>1. 本系統僅提供用藥紀錄、提醒與資訊參考功能。</p>
                    <p>2. 任何用藥決定請務必諮詢專業醫療人員。</p>
                    <p>3. 本系統不承擔任何醫療責任。</p>
                    <p>4. 所有藥物交互作用分析結果僅供參考。</p>
                    <p>5. 使用者應自行承擔使用本系統的風險。</p>
                </div>
            </div>
        `;
    }
}