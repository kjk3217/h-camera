// 전역 변수
const GEMINI_API_KEY = 'AIzaSyBJi0fiCu3A8ESdGkoDHkKY3fgRta5L3WU';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

let currentStream = null;
let capturedImageData = null;
let analysisHistory = [];

// DOM 요소
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const capturedImage = document.getElementById('captured-image');
const photoPreview = document.getElementById('photo-preview');

const startCameraBtn = document.getElementById('start-camera-btn');
const captureBtn = document.getElementById('capture-btn');
const retakeBtn = document.getElementById('retake-btn');
const analyzeBtn = document.getElementById('analyze-btn');
const historyBtn = document.getElementById('history-btn');

const loading = document.getElementById('loading');
const result = document.getElementById('result');
const historyContent = document.getElementById('history-content');

// 앱 초기화
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    loadHistory();
});

// 앱 초기화
function initializeApp() {
    startCameraBtn.addEventListener('click', startCamera);
    captureBtn.addEventListener('click', capturePhoto);
    retakeBtn.addEventListener('click', retakePhoto);
    analyzeBtn.addEventListener('click', analyzeFood);
    historyBtn.addEventListener('click', toggleHistory);
    
    // 서비스 워커 등록
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => console.log('SW registered'))
            .catch(error => console.log('SW registration failed'));
    }
    
    // PWA 설치 프롬프트
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        showInstallPrompt(e);
    });
}

// 카메라 시작
async function startCamera() {
    try {
        const constraints = {
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: 'environment' // 후면 카메라 사용
            }
        };
        
        currentStream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = currentStream;
        video.style.display = 'block';
        
        startCameraBtn.style.display = 'none';
        captureBtn.style.display = 'block';
        
    } catch (error) {
        console.error('카메라 접근 오류:', error);
        alert('카메라에 접근할 수 없습니다. 브라우저 설정을 확인해주세요.');
    }
}

// 사진 촬영
function capturePhoto() {
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    context.drawImage(video, 0, 0);
    capturedImageData = canvas.toDataURL('image/jpeg', 0.8);
    
    capturedImage.src = capturedImageData;
    video.style.display = 'none';
    photoPreview.style.display = 'block';
    
    captureBtn.style.display = 'none';
    retakeBtn.style.display = 'block';
    analyzeBtn.style.display = 'block';
    
    // 카메라 스트림 정지
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
}

// 다시 찍기
function retakePhoto() {
    photoPreview.style.display = 'none';
    retakeBtn.style.display = 'none';
    analyzeBtn.style.display = 'none';
    result.style.display = 'none';
    
    startCamera();
}

// 음식 분석
async function analyzeFood() {
    if (!capturedImageData) {
        alert('먼저 사진을 촬영해주세요.');
        return;
    }
    
    loading.style.display = 'block';
    result.style.display = 'none';
    
    try {
        const analysisResult = await callGeminiAPI(capturedImageData);
        displayResult(analysisResult);
        saveToHistory(analysisResult);
    } catch (error) {
        console.error('분석 오류:', error);
        alert('음식 분석 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
        loading.style.display = 'none';
    }
}

// Gemini API 호출
async function callGeminiAPI(imageData) {
    const base64Image = imageData.split(',')[1];
    
    const prompt = `
당신은 당뇨 관리 전문가입니다. 제공된 음식 사진을 분석하고 다음 정보를 JSON 형태로 제공해주세요:

1. 음식명 (한국어)
2. 음식 설명 (주요 재료와 조리법)
3. 예상 혈당 수치 (식후 2시간 기준, mg/dL)
4. 당뇨 위험도 상태 (normal/warning/danger)
5. 권장사항 (3개 이상)

JSON 형태:
{
  "foodName": "음식명",
  "description": "음식 설명",
  "predictedGlucose": 120,
  "status": "normal",
  "recommendations": ["권장사항1", "권장사항2", "권장사항3"]
}

혈당 수치는 다음 기준을 참고하세요:
- 정상: 70-140 mg/dL
- 경고: 140-200 mg/dL  
- 위험: 200+ mg/dL
`;
    
    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                {
                    inline_data: {
                        mime_type: "image/jpeg",
                        data: base64Image
                    }
                }
            ]
        }]
    };
    
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
        throw new Error(`API 호출 실패: ${response.status}`);
    }
    
    const data = await response.json();
    const responseText = data.candidates[0].content.parts[0].text;
    
    // JSON 파싱
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
    } else {
        throw new Error('응답 파싱 실패');
    }
}

// 결과 표시
function displayResult(analysisResult) {
    document.getElementById('food-name').textContent = analysisResult.foodName;
    document.getElementById('food-description').textContent = analysisResult.description;
    document.getElementById('glucose-level').textContent = analysisResult.predictedGlucose;
    
    const statusElement = document.getElementById('prediction-status');
    statusElement.className = `prediction-status status-${analysisResult.status}`;
    
    let statusText = '';
    switch(analysisResult.status) {
        case 'normal':
            statusText = '✅ 정상 범위';
            break;
        case 'warning':
            statusText = '⚠️ 주의 필요';
            break;
        case 'danger':
            statusText = '🚨 위험 범위';
            break;
    }
    statusElement.textContent = statusText;
    
    const recommendationsList = document.getElementById('recommendations-list');
    recommendationsList.innerHTML = '';
    analysisResult.recommendations.forEach(rec => {
        const li = document.createElement('li');
        li.textContent = rec;
        recommendationsList.appendChild(li);
    });
    
    result.style.display = 'block';
}

// 히스토리 저장
function saveToHistory(analysisResult) {
    const historyItem = {
        date: new Date().toLocaleString('ko-KR'),
        ...analysisResult,
        image: capturedImageData
    };
    
    analysisHistory.unshift(historyItem);
    
    // 최대 10개까지만 저장
    if (analysisHistory.length > 10) {
        analysisHistory = analysisHistory.slice(0, 10);
    }
    
    localStorage.setItem('diabetesAnalysisHistory', JSON.stringify(analysisHistory));
}

// 히스토리 로드
function loadHistory() {
    const saved = localStorage.getItem('diabetesAnalysisHistory');
    if (saved) {
        analysisHistory = JSON.parse(saved);
    }
}

// 히스토리 토글
function toggleHistory() {
    if (historyContent.style.display === 'none') {
        displayHistory();
        historyContent.style.display = 'block';
        historyBtn.textContent = '📋 기록 닫기';
    } else {
        historyContent.style.display = 'none';
        historyBtn.textContent = '📋 분석 기록 보기';
    }
}

// 히스토리 표시
function displayHistory() {
    const historyList = document.getElementById('history-list');
    historyList.innerHTML = '';
    
    if (analysisHistory.length === 0) {
        historyList.innerHTML = '<p style="text-align: center; color: #666;">아직 분석 기록이 없습니다.</p>';
        return;
    }
    
    analysisHistory.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        historyItem.innerHTML = `
            <div class="history-item-date">${item.date}</div>
            <div class="history-item-food">${item.foodName}</div>
            <div class="history-item-glucose">${item.predictedGlucose} mg/dL</div>
        `;
        historyList.appendChild(historyItem);
    });
}

// PWA 설치 프롬프트 표시
function showInstallPrompt(deferredPrompt) {
    const installPrompt = document.createElement('div');
    installPrompt.className = 'install-prompt';
    installPrompt.innerHTML = `
        <span>📱 홈화면에 앱을 설치하시겠습니까?</span>
        <button id="install-yes">설치</button>
        <button id="install-no">취소</button>
    `;
    
    document.body.appendChild(installPrompt);
    
    document.getElementById('install-yes').addEventListener('click', () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('PWA 설치됨');
            }
            installPrompt.remove();
        });
    });
    
    document.getElementById('install-no').addEventListener('click', () => {
        installPrompt.remove();
    });
}

// 오류 처리
window.addEventListener('error', (e) => {
    console.error('앱 오류:', e.error);
});

// 온라인/오프라인 상태 처리
window.addEventListener('online', () => {
    console.log('온라인 상태');
});

window.addEventListener('offline', () => {
    console.log('오프라인 상태');
    alert('인터넷 연결이 끊어졌습니다. 분석 기능이 제한될 수 있습니다.');
});