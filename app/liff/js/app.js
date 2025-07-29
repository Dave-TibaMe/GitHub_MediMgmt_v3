// js/app.js (2025-07-26 全面重構升級版 - 已修正 API 路徑重複問題)

// --- 全域設定 ---
// 確保 config.js 已定義 window.APP_CONFIG
const API_ROOT = window.APP_CONFIG.API_ROOT; // 假設 API_ROOT 已包含 /api
const LIFF_ID = window.APP_CONFIG.LIFF_ID;

let user_id = null; // 用來儲存 LIFF 使用者 ID

// --- 初始化 ---
window.onload = async () => {
    // 1. LIFF 初始化與登入
    try {
        await liff.init({ liffId: LIFF_ID });
        if (!liff.isLoggedIn()) {
            liff.login();
            return; // 登入後會重新導向，中斷後續執行
        }
        const profile = await liff.getProfile();
        user_id = profile.userId;
        console.log("LIFF 初始化成功，User ID:", user_id);
    } catch (e) {
        console.error("LIFF 初始化失敗:", e);
        user_id = "test_user_001"; // 提供測試用 ID
        showToast("LIFF 初始化失敗，正以測試模式運行", "warning");
    }

    // 2. 綁定所有事件監聽器
    bindEvents();

    // 3. 根據 URL 參數決定顯示哪個頁面
    const urlParams = new URLSearchParams(window.location.search);
    const view = urlParams.get('view') || 'scan'; // 預設顯示掃描頁
    const pageId = view === 'medication' ? 'page-medication-list' : `page-${view}`;
    showPage(pageId);

    // 預先載入對應頁面的資料
    if (pageId === 'page-medication-list') {
        loadMedications();
    } else if (pageId === 'page-alert') {
        analyzeDrug();
    }
};

// --- 事件綁定 ---
function bindEvents() {
    document.getElementById('btn-upload')?.addEventListener('click', handleUploadAndRecognize);

    const fileInput = document.getElementById('prescriptionUpload');
    const previewContainer = document.getElementById('image-preview-container');
    const imagePreview = document.getElementById('prescription-image-preview');

    if (fileInput && previewContainer && imagePreview) {
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

    document.getElementById('btn-load-medications')?.addEventListener('click', () => {
        showPage('page-medication-list');
        loadMedications();
    });
    document.getElementById('btn-analyze-alerts')?.addEventListener('click', () => {
        showPage('page-alert');
        analyzeDrug();
    });
}

// --- UI 控制函式 ---
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = 'none';
    });
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.style.display = 'block';
    } else {
        console.error(`找不到 ID 為 ${pageId} 的頁面`);
        document.getElementById('page-scan').style.display = 'block';
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

/**
 * 步驟1：處理上傳與辨識藥單
 */
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
    formData.append('timezone', userTimezone);

    try {
        // 【修正】移除重複的 /api。路徑直接從 /prescription 開始
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

/**
 * 步驟2：根據辨識結果，動態生成可編輯的表單
 */
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

/**
 * 步驟3：從編輯表單收集資料並呼叫 API 儲存
 */
async function saveMedicationFromForm() {
    showLoading(true, '正在儲存用藥紀錄...');

    const medicationCards = document.querySelectorAll('#medication-edit-form-container .medication-card');
    const medicationsPayload = [];

    medicationCards.forEach(card => {
        const medication = {};
        card.querySelectorAll('input[data-field]').forEach(input => {
            const field = input.dataset.field;
            medication[field] = input.value || null; // 將空字串轉為 null
        });
        medicationsPayload.push(medication);
    });

    try {
        // 【修正】在路徑結尾加上斜線 "/"，以匹配 FastAPI 的路由定義
        const res = await fetch(`${API_ROOT}/medications/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: user_id,
                medications: medicationsPayload
            })
        });

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ detail: `儲存失敗，狀態碼: ${res.status}` }));
            throw new Error(errorData.detail || '儲存失敗');
        }

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

// --- 其他頁面功能函式 ---

async function loadMedications() {
    if (!user_id) return;
    showLoading(true, '正在載入用藥清單...');
    try {
        // 【修正】移除重複的 /api。路徑直接從 /medications 開始
        const response = await fetch(`${API_ROOT}/medications/user/${user_id}`);
        if (!response.ok) {
            throw new Error(`載入失敗: ${response.status}`);
        }
        const medications = await response.json();
        displayMedicationList(medications);
    } catch (error) {
        console.error("載入用藥清單失敗:", error);
        showToast(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function displayMedicationList(medications) {
    const container = document.getElementById('medication-list-container');
    if (!container) return;
    container.innerHTML = '';
    if (!medications || medications.length === 0) {
        container.innerHTML = '<p class="text-center text-gray-500">目前沒有用藥紀錄。</p>';
        return;
    }
    medications.forEach(med => {
        container.innerHTML += `
            <div class="bg-white p-4 rounded-lg shadow mb-3">
                <h3 class="text-lg font-bold">${med.name}</h3>
                <p><strong>作用:</strong> ${med.effect}</p>
                <p><strong>用法:</strong> ${med.dose}, ${med.frequency}</p>
                <p><strong>期間:</strong> ${med.start_date} ~ ${med.end_date || '長期'}</p>
            </div>
        `;
    });
}

async function analyzeDrug() {
    showToast('藥物交互作用分析功能尚未實作。', 'info');
}
