const GEMINI_API_KEY = 'AIzaSyBJi0fiCu3A8ESdGkoDHkKY3fgRta5L3WU';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

let currentImageData = null;
let deferredPrompt = null;

document.addEventListener('DOMContentLoaded', function() {
    const captureBtn = document.getElementById('captureBtn');
    
    // 서비스 워커 등록
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('서비스 워커 등록 성공:', registration);
                
                // 업데이트 확인
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            if (confirm('새 버전이 있습니다. 업데이트하시겠습니까?')) {
                                window.location.reload();
                            }
                        }
                    });
                });
            })
            .catch(error => {
                console.error('서비스 워커 등록 실패:', error);
            });
    }
    
    // PWA 설치 프롬프트
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        
        // 설치 프롬프트 표시
        if (!window.matchMedia('(display-mode: standalone)').matches) {
            setTimeout(() => {
                const installPrompt = document.getElementById('installPrompt');
                if (installPrompt) {
                    installPrompt.style.display = 'block';
                }
            }, 3000);
        }
    });
    
    // 설치 버튼 이벤트
    const installBtn = document.getElementById('installBtn');
    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            const installPrompt = document.getElementById('installPrompt');
            if (installPrompt) {
                installPrompt.style.display = 'none';
            }
            
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log('설치 선택:', outcome);
                deferredPrompt = null;
            }
        });
    }
    
    // 취소 버튼 이벤트
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            const installPrompt = document.getElementById('installPrompt');
            if (installPrompt) {
                installPrompt.style.display = 'none';
            }
        });
    }
    
    // 앱 설치 확인
    window.addEventListener('appinstalled', () => {
        console.log('PWA 설치 완료');
        deferredPrompt = null;
    });
    
    // 메인 버튼 이벤트
    if (captureBtn) {
        captureBtn.addEventListener('click', openCamera);
    }
    
    // 주기적인 캐시 정리
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        setInterval(() => {
            navigator.serviceWorker.controller.postMessage({
                command: 'trimCaches'
            });
        }, 60000);
    }
});

// 전역 함수들
window.retakePhoto = retakePhoto;
window.analyzeImage = analyzeImage;
window.goHome = goHome;

function openCamera() {
    const cameraContainer = document.createElement('div');
    cameraContainer.className = 'camera-container';
    cameraContainer.style.display = 'flex';
    cameraContainer.style.flexDirection = 'column';
    cameraContainer.style.justifyContent = 'center';
    cameraContainer.style.alignItems = 'center';
    
    // 1:1 비율 비디오 컨테이너 생성
    const videoContainer = document.createElement('div');
    videoContainer.style.width = '90vw';
    videoContainer.style.maxWidth = '400px';
    videoContainer.style.aspectRatio = '1/1';
    videoContainer.style.overflow = 'hidden';
    videoContainer.style.borderRadius = '20px';
    videoContainer.style.border = '3px solid white';
    videoContainer.style.position = 'relative';
    
    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';
    
    const controls = document.createElement('div');
    controls.className = 'camera-controls';
    
    const captureButton = document.createElement('button');
    captureButton.className = 'camera-button';
    captureButton.onclick = () => takePictureSquare(video, videoContainer);
    captureButton.setAttribute('aria-label', '사진 촬영');
    
    controls.appendChild(captureButton);
    
    videoContainer.appendChild(video);
    cameraContainer.appendChild(videoContainer);
    cameraContainer.appendChild(controls);
    
    document.body.appendChild(cameraContainer);
    
    // 카메라 권한 요청
    navigator.mediaDevices.getUserMedia({ 
        video: { 
            facingMode: 'environment',
            width: { ideal: 1920 },
            height: { ideal: 1920 }
        },
        audio: false
    })
    .then(stream => {
        video.srcObject = stream;
    })
    .catch(err => {
        console.error('카메라 접근 오류:', err);
        if (err.name === 'NotAllowedError') {
            alert('카메라 권한을 허용해주세요.');
        } else {
            alert('카메라에 접근할 수 없습니다.');
        }
        closeCamera();
    });
}

function closeCamera() {
    const cameraContainer = document.querySelector('.camera-container');
    if (cameraContainer) {
        const video = cameraContainer.querySelector('video');
        if (video && video.srcObject) {
            video.srcObject.getTracks().forEach(track => track.stop());
        }
        cameraContainer.remove();
    }
}

function takePictureSquare(video, container) {
    const canvas = document.createElement('canvas');
    
    // 컨테이너의 실제 크기를 기준으로 캡처
    const containerRect = container.getBoundingClientRect();
    const size = Math.min(containerRect.width, containerRect.height);
    
    // 고해상도로 캡처 (실제 표시 크기의 2배)
    const captureSize = size * 2;
    canvas.width = captureSize;
    canvas.height = captureSize;
    
    const ctx = canvas.getContext('2d');
    
    // 비디오에서 정사각형 영역 계산
    const videoAspect = video.videoWidth / video.videoHeight;
    let sourceSize, sx, sy;
    
    if (videoAspect > 1) {
        // 가로가 더 긴 경우
        sourceSize = video.videoHeight;
        sx = (video.videoWidth - sourceSize) / 2;
        sy = 0;
    } else {
        // 세로가 더 긴 경우
        sourceSize = video.videoWidth;
        sx = 0;
        sy = (video.videoHeight - sourceSize) / 2;
    }
    
    // 정사각형으로 크롭하여 캔버스에 그리기
    ctx.drawImage(video, sx, sy, sourceSize, sourceSize, 0, 0, captureSize, captureSize);
    
    currentImageData = canvas.toDataURL('image/jpeg', 0.85);
    
    closeCamera();
    showCaptureResult();
}

function showCaptureResult() {
    const resultContainer = document.createElement('div');
    resultContainer.className = 'capture-result';
    resultContainer.style.display = 'flex';
    
    resultContainer.innerHTML = `
        <div class="capture-preview">
            <img class="captured-image" src="${currentImageData}" alt="촬영된 음식">
        </div>
        <div class="capture-actions">
            <button class="action-button retake-button" onclick="retakePhoto()">다시 촬영</button>
            <button class="action-button analyze-button" onclick="analyzeImage()">분석 하기</button>
        </div>
        <div class="analysis-results" id="analysisResults"></div>
    `;
    
    document.body.appendChild(resultContainer);
}

function retakePhoto() {
    const resultContainer = document.querySelector('.capture-result');
    if (resultContainer) {
        resultContainer.remove();
    }
    currentImageData = null;
    openCamera();
}

async function analyzeImage() {
    const analyzeBtn = document.querySelector('.analyze-button');
    if (!analyzeBtn || !currentImageData) return;
    
    analyzeBtn.disabled = true;
    analyzeBtn.textContent = '분석 중...';
    
    try {
        const base64Data = currentImageData.split(',')[1];
        
        const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        {
                            text: `너는 지금부터 당뇨 환자를 위한 식단 분석 전문가야. 
                            다음에 첨부된 음식 사진을 보고 아래와 같은 항목을 알려줘:
                            
                            1. 음식의 종류와 주요 재료는 무엇인지 추정해줘. 
                            2. 당뇨 환자 기준으로 이 음식이 혈당을 얼마나 올릴 수 있는지 예측해줘. 
                            3. 예상되는 혈당 지수(GI, Glycemic Index)와 탄수화물 함량은 어느 정도일지 추정해줘. 
                            4. 이 음식이 고혈당을 유발할 위험이 있는 이유가 있다면 설명해줘. 
                            5. 당뇨 환자가 이 음식을 먹을 때 주의할 점이나 대체 음식 제안도 해줘.
                            
                            응답은 다음 JSON 형식으로 줘:
                            {
                                "foodName": "음식 이름 (추정)",
                                "bloodSugarImpact": "높음 / 중간 / 낮음",
                                "mainIngredients": "주요 성분",
                                "estimatedGI": "예상 GI (숫자)",
                                "estimatedCarbs": "탄수화물 양 (대략)",
                                "dietaryAdvice": "식이 조언"
                            }`
                        },
                        {
                            inlineData: {
                                mimeType: 'image/jpeg',
                                data: base64Data
                            }
                        }
                    ]
                }],
                generationConfig: {
                    temperature: 0.4,
                    topK: 32,
                    topP: 1,
                    maxOutputTokens: 1024,
                }
            })
        });
        
        if (!response.ok) {
            throw new Error('API 요청 실패');
        }
        
        const data = await response.json();
        
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('유효하지 않은 응답');
        }
        
        const result = data.candidates[0].content.parts[0].text;
        
        try {
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('JSON 형식을 찾을 수 없습니다');
            }
            
            const analysisData = JSON.parse(jsonMatch[0]);
            showAnalysisResult(analysisData);
        } catch (e) {
            console.error('JSON 파싱 오류:', e);
            alert('분석 결과를 처리하는 중 오류가 발생했습니다.');
        }
        
    } catch (error) {
        console.error('분석 오류:', error);
        alert('음식 분석 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
        analyzeBtn.disabled = false;
        analyzeBtn.textContent = '분석 하기';
    }
}

function showAnalysisResult(data) {
    const resultsDiv = document.getElementById('analysisResults');
    if (!resultsDiv) return;
    
    let impactClass = '';
    if (data.bloodSugarImpact === '높음') {
        impactClass = 'blood-sugar-high';
    } else if (data.bloodSugarImpact === '중간') {
        impactClass = 'blood-sugar-medium';
    } else {
        impactClass = 'blood-sugar-low';
    }
    
    resultsDiv.innerHTML = `
        <div class="result-card">
            <h3 class="result-title">■ 분석 결과 ■</h3>
            <div class="result-content">
                <div class="result-item">
                    <span class="result-label">음식 이름:</span> ${data.foodName || '알 수 없음'}
                </div>
                <div class="result-item">
                    <span class="result-label">혈당 영향도:</span> 
                    <span class="${impactClass}">${data.bloodSugarImpact || '중간'}</span>
                </div>
                <div class="result-item">
                    <span class="result-label">주요 성분:</span> ${data.mainIngredients || '정보 없음'}
                </div>
                <div class="result-item">
                    <span class="result-label">예상 GI:</span> ${data.estimatedGI || '정보 없음'}
                </div>
                <div class="result-item">
                    <span class="result-label">탄수화물:</span> ${data.estimatedCarbs || '정보 없음'}
                </div>
                <div class="result-item">
                    <span class="result-label">식이 조언:</span><br>${data.dietaryAdvice || '일반적인 주의사항을 따르세요.'}
                </div>
            </div>
        </div>
        <button class="home-button" onclick="goHome()">처음으로</button>
    `;
    
    resultsDiv.style.display = 'block';
    resultsDiv.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function goHome() {
    const resultContainer = document.querySelector('.capture-result');
    if (resultContainer) {
        resultContainer.remove();
    }
    currentImageData = null;
}
