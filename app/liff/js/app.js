// js/app.js (修复版本 - 解决 Rich Menu 页面路由问题)

// --- 全域設定 ---
const API_ROOT = window.APP_CONFIG.API_ROOT;
const LIFF_ID = window.APP_CONFIG.LIFF_ID;

let user_id = null;

// --- 初始化 ---
window.onload = async () => {
    console.log('页面开始加载...');
    
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

    // 3. 修复后的页面路由逻辑
    const targetView = determineTargetView();
    console.log('确定目标视图:', targetView);
    
    showPageByView(targetView);
};

/**
 * 确定目标页面视图 - 修复版本
 */
function determineTargetView() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // 方式1: 直接从 view 参数获取
    if (urlParams.has('view')) {
        const view = urlParams.get('view');
        console.log('从 view 参数获取:', view);
        return view;
    }
    
    // 方式2: 从 liff.state 参数中解析
    if (urlParams.has('liff.state')) {
        const liffState = decodeURIComponent(urlParams.get('liff.state'));
        console.log('LIFF State 原始值:', urlParams.get('liff.state'));
        console.log('LIFF State 解码后:', liffState);
        
        // 解析 liff.state 中的参数
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
            console.log('从 liff.state 解析出 view:', view);
            return view;
        }
    }
    
    // 方式3: 检查其他可能的参数格式
    const allParams = Object.fromEntries(urlParams.entries());
    console.log('所有 URL 参数:', allParams);
    
    // 检查是否有直接的视图参数
    for (const [key, value] of Object.entries(allParams)) {
        if (['scan', 'medication', 'alert', 'terms'].includes(key)) {
            console.log('从参数键名确定视图:', key);
            return key;
        }
        if (['scan', 'medication', 'alert', 'terms'].includes(value)) {
            console.log('从参数值确定视图:', value);
            return value;
        }
    }
    
    // 默认返回扫描页面
    console.log('使用默认视图: scan');
    return 'scan';
}

/**
 * 根据视图名称显示对应页面
 */
function showPageByView(view) {
    let pageId;
    
    switch(view) {
        case 'scan':
            pageId = 'page-scan';
            break;
        case 'medication':
            pageId = 'page-medication-list';
            // 预加载用药列表
            setTimeout(() => loadMedications(), 100);
            break;
        case 'alert':
            pageId = 'page-alert';
            // 预加载警戒页面
            setTimeout(() => initializeAlertPage(), 100);
            break;
        case 'terms':
            pageId = 'page-terms';
            break;
        default:
            console.warn('未知的视图类型:', view);
            pageId = 'page-scan';
    }
    
    console.log(`显示页面: ${view} -> ${pageId}`);
    showPage(pageId);
}

// --- 事件綁定 ---
function bindEvents() {
    // 绑定上传按钮事件
    const uploadBtn = document.getElementById('btn-upload');
    if (uploadBtn) {
        uploadBtn.addEventListener('click', handleUploadAndRecognize);
    }

    // 绑定文件选择事件
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

    // 绑定文件上传标签点击事件
    const uploadLabel = document.querySelector('.upload-label');
    if (uploadLabel && fileInput) {
        uploadLabel.addEventListener('click', () => {
            fileInput.click();
        });
    }

    // 绑定服务条款接受按钮
    const acceptTermsBtn = document.getElementById('btn-accept-terms');
    if (acceptTermsBtn) {
        acceptTermsBtn.addEventListener('click', () => {
            showToast('感谢您接受服务条款！', 'success');
            showPageByView('scan');
        });
    }
}

// --- UI 控制函式 ---
function showPage(pageId) {
    console.log('切换到页面:', pageId);
    
    // 隐藏所有页面
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
        page.style.display = 'none';
    });
    
    // 显示目标页面
    const targetPage = document.getElementById(pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        targetPage.style.display = 'block';
        console.log('成功显示页面:', pageId);
    } else {
        console.error(`找不到 ID 为 ${pageId} 的页面，回退到默认页面`);
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

// --- 用藥列表相關函式 ---

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
        updateProfileBtn.removeEventListener('click', updateUserProfile); // 避免重复绑定
        updateProfileBtn.addEventListener('click', updateUserProfile);
    }
    
    const analyzeBtn = document.getElementById('btn-analyze-interaction');
    if (analyzeBtn) {
        analyzeBtn.removeEventListener('click', analyzeDrugInteractions); // 避免重复绑定
        analyzeBtn.addEventListener('click', analyzeDrugInteractions);
    }
    
    loadUserProfile();
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
    document.getElementById('btn-cancel-edit')?.addEventListener('click', () => showPageByView('scan'));
}

/**
 * 步驟3：從編輯表單收集資料並呼叫 API 儲存
 */
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
        showPageByView('medication');
        await loadMedications();

    } catch (error) {
        console.error('儲存藥物失敗:', error);
        showToast(`儲存失敗: ${error.message}`, 'error');
    } finally {
        showLoading(false);
    }
}

// 全局函数，供 HTML 内联事件调用
window.showPageByView = showPageByView;
window.editMedication = editMedication;
window.deleteMedication = deleteMedication;