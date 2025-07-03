// 전역 변수
const GEMINI_API_KEY = 'AIzaSyBJi0fiCu3A8ESdGkoDHkKY3fgRta5L3WU';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

let currentStream = null;
let capturedImageData = null;
let analysisHistory = [];
let isAnalyzing = false;

// DOM 요소
const loadingScreen = document.getElementById('loading-screen');
const mainScreen = document.getElementById('main-screen');
const cameraScreen = document.getElementById('camera-screen');
const foodCaptureBtn = document.getElementById('food-capture-btn');
const backToMainBtn = document.getElementById('back-to-main-btn');

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const capturedImage = document.getElementById('captured-image');
const photoPreview = document.getElementById('photo-preview');
const cameraPlaceholder = document.getElementById('camera-placeholder');

const startCameraBtn = document.getElementById('start-camera-btn');
const cameraBtn = document.getElementById('camera-btn');
const retakeBtn = document.getElementById('retake-btn');
const analyzeBtn = document.getElementById('analyze-btn');
const closeResultBtn = document.getElementById('close-result-btn');

const loading = document.getElementById('loading');
const resultCard = document.getElementById('result-card');
const errorMessage = document.getElementById('error-message');
const errorCloseBtn = document.getElementById('error-close-btn');

// 앱 초기화
document.addEventListener('DOMContentLoaded', function() {
   initializeApp();
   showLoadingScreen();
   
   // 2초 후 메인 화면 표시
   setTimeout(() => {
       hideLoadingScreen();
       showMainScreen();
   }, 2000);
});

// 로딩 스크린 표시
function showLoadingScreen() {
   loadingScreen.style.display = 'flex';
   mainScreen.style.display = 'none';
   cameraScreen.style.display = 'none';
}

// 로딩 스크린 숨김
function hideLoadingScreen() {
   loadingScreen.style.opacity = '0';
   setTimeout(() => {
       loadingScreen.style.display = 'none';
   }, 500);
}

// 앱 초기화
function initializeApp() {
   // 메인 화면 이벤트
   foodCaptureBtn.addEventListener('click', showCameraScreen);
   backToMainBtn.addEventListener('click', showMainScreen);
   
   // 카메라 화면 이벤트
   startCameraBtn.addEventListener('click', startCamera);
   cameraBtn.addEventListener('click', capturePhoto);
   retakeBtn.addEventListener('click', retakePhoto);
   analyzeBtn.addEventListener('click', analyzeFood);
   closeResultBtn.addEventListener('click', closeResult);
   
   // 에러 메시지 이벤트
   errorCloseBtn.addEventListener('click', closeError);
   
   // 키보드 이벤트
   document.addEventListener('keydown', handleKeydown);
   
   // 서비스 워커 등록
   registerServiceWorker();
   
   // PWA 설치 프롬프트
   window.addEventListener('beforeinstallprompt', (e) => {
       e.preventDefault();
       // 3초 후 설치 프롬프트 표시
       setTimeout(() => {
           showInstallPrompt(e);
       }, 3000);
   });
   
   // PWA 상태 확인
   checkPWAStatus();
   checkForUpdates();
}

// 서비스 워커 등록
async function registerServiceWorker() {
   if ('serviceWorker' in navigator) {
       try {
           const registration = await navigator.serviceWorker.register('./sw.js');
           console.log('✅ 서비스 워커 등록 성공:', registration);
       } catch (error) {
           console.error('❌ 서비스 워커 등록 실패:', error);
       }
   }
}

// 키보드 이벤트 처리
function handleKeydown(event) {
   if (event.key === 'Escape') {
       if (resultCard.style.display === 'block') {
           closeResult();
       } else if (cameraScreen.style.display === 'block') {
           showMainScreen();
       }
   } else if (event.key === 'Enter' || event.key === ' ') {
       if (mainScreen.style.display === 'flex') {
           showCameraScreen();
       }
   }
}

// 메인 화면 보기
function showMainScreen() {
   mainScreen.style.display = 'flex';
   cameraScreen.style.display = 'none';
   
   // 카메라 스트림 정지
   stopCameraStream();
   
   // 상태 초기화
   resetCameraState();
   
   // 페이지 제목 업데이트
   document.title = '음식 분석 앱';
}

// 카메라 화면 보기
function showCameraScreen() {
   mainScreen.style.display = 'none';
   cameraScreen.style.display = 'block';
   resetCameraState();
   
   // 페이지 제목 업데이트
   document.title = '음식 촬영 - 음식 분석 앱';
}

// 카메라 스트림 정지
function stopCameraStream() {
   if (currentStream) {
       currentStream.getTracks().forEach(track => {
           track.stop();
           console.log('📷 카메라 스트림 정지');
       });
       currentStream = null;
   }
}

// 카메라 상태 초기화
function resetCameraState() {
   video.style.display = 'none';
   photoPreview.style.display = 'none';
   cameraPlaceholder.style.display = 'flex';
   
   startCameraBtn.style.display = 'block';
   cameraBtn.style.display = 'none';
   retakeBtn.style.display = 'none';
   analyzeBtn.style.display = 'none';
   resultCard.style.display = 'none';
   loading.style.display = 'none';
   
   // 분석 상태 초기화
   isAnalyzing = false;
   capturedImageData = null;
}

// 카메라 시작
async function startCamera() {
   try {
       showLoading('카메라를 시작하고 있습니다...');
       
       const constraints = {
           video: {
               width: { ideal: 1280, max: 1920 },
               height: { ideal: 720, max: 1080 },
               facingMode: 'environment' // 후면 카메라 사용
           }
       };
       
       currentStream = await navigator.mediaDevices.getUserMedia(constraints);
       video.srcObject = currentStream;
       
       // 비디오 로드 완료 대기
       await new Promise((resolve) => {
           video.onloadedmetadata = () => {
               resolve();
           };
       });
       
       hideLoading();
       video.style.display = 'block';
       cameraPlaceholder.style.display = 'none';
       startCameraBtn.style.display = 'none';
       cameraBtn.style.display = 'block';
       
       console.log('📷 카메라 시작 완료');
       
   } catch (error) {
       hideLoading();
       console.error('❌ 카메라 접근 오류:', error);
       
       let errorMsg = '카메라에 접근할 수 없습니다.';
       if (error.name === 'NotAllowedError') {
           errorMsg = '카메라 권한이 거부되었습니다.\n브라우저 설정에서 카메라 권한을 허용해주세요.';
       } else if (error.name === 'NotFoundError') {
           errorMsg = '카메라를 찾을 수 없습니다.\n카메라가 연결되어 있는지 확인해주세요.';
       } else if (error.name === 'NotReadableError') {
           errorMsg = '카메라가 다른 앱에서 사용 중입니다.\n다른 앱을 종료하고 다시 시도해주세요.';
       }
       
       showError(errorMsg);
   }
}

// 사진 촬영
function capturePhoto() {
   try {
       const context = canvas.getContext('2d');
       
       // 캔버스 크기를 비디오 크기에 맞춤
       canvas.width = video.videoWidth;
       canvas.height = video.videoHeight;
       
       // 비디오 프레임을 캔버스에 그리기
       context.drawImage(video, 0, 0, canvas.width, canvas.height);
       
       // 이미지 데이터 추출 (품질 0.9)
       capturedImageData = canvas.toDataURL('image/jpeg', 0.9);
       
       // 촬영된 이미지 표시
       capturedImage.src = capturedImageData;
       video.style.display = 'none';
       photoPreview.style.display = 'block';
       
       // 버튼 상태 변경
       cameraBtn.style.display = 'none';
       retakeBtn.style.display = 'block';
       analyzeBtn.style.display = 'block';
       
       // 카메라 스트림 정지
       stopCameraStream();
       
       console.log('📸 사진 촬영 완료');
       
   } catch (error) {
       console.error('❌ 사진 촬영 실패:', error);
       showError('사진 촬영에 실패했습니다.\n다시 시도해주세요.');
   }
}

// 다시 찍기
function retakePhoto() {
   photoPreview.style.display = 'none';
   retakeBtn.style.display = 'none';
   analyzeBtn.style.display = 'none';
   resultCard.style.display = 'none';
   
   capturedImageData = null;
   startCamera();
}

// 음식 분석
async function analyzeFood() {
   if (!capturedImageData) {
       showError('촬영된 사진이 없습니다.\n먼저 사진을 촬영해주세요.');
       return;
   }
   
   if (isAnalyzing) {
       return; // 이미 분석 중
   }
   
   isAnalyzing = true;
   analyzeBtn.disabled = true;
   analyzeBtn.textContent = '분석 중...';
   
   showLoading('음식을 분석하고 있습니다...');
   
   try {
       const analysisResult = await callGeminiAPI(capturedImageData);
       hideLoading();
       displayResult(analysisResult);
       saveToHistory(analysisResult);
       
       console.log('🔍 음식 분석 완료:', analysisResult);
       
   } catch (error) {
       hideLoading();
       console.error('❌ 분석 오류:', error);
       
       let errorMsg = '음식 분석 중 오류가 발생했습니다.';
       if (error.message.includes('API 호출 실패')) {
           errorMsg = '네트워크 연결을 확인하고 다시 시도해주세요.';
       } else if (error.message.includes('응답 파싱 실패')) {
           errorMsg = '분석 결과를 처리하는 중 오류가 발생했습니다.\n다시 시도해주세요.';
       }
       
       showError(errorMsg);
   } finally {
       isAnalyzing = false;
       analyzeBtn.disabled = false;
       analyzeBtn.textContent = '분석 하기';
   }
}

// Gemini API 호출
async function callGeminiAPI(imageData) {
   const base64Image = imageData.split(',')[1];
   
   const prompt = `
너는 지금부터 당뇨 환자를 위한 식단 분석 전문가야. 
다음에 첨부된 음식 사진을 보고 아래와 같은 항목을 정확히 분석해줘:

1. 음식의 종류와 주요 재료는 무엇인지 추정해줘. 
2. 당뇨 환자 기준으로 이 음식이 혈당을 얼마나 올릴 수 있는지 예측해줘. 
3. 예상되는 혈당 지수(GI, Glycemic Index)와 탄수화물 함량은 어느 정도일지 추정해줘. 
4. 이 음식이 고혈당을 유발할 위험이 있는 이유가 있다면 설명해줘. 
5. 당뇨 환자가 이 음식을 먹을 때 주의할 점이나 대체 음식 제안도 해줘.

응답은 다음과 같이 정확한 JSON 형태로만 줘:
{
 "foodName": "음식 이름 (추정)",
 "glucoseImpact": "낮음/중간/높음",
 "mainIngredients": "주요 성분 (간단히)",
 "expectedGI": "예상 GI 수치",
 "carbAmount": "탄수화물 양 (대략)",
 "dietaryAdvice": "식이 조언 (간단명료하게)"
}

중요: 반드시 유효한 JSON 형태로만 응답해야 해. 다른 텍스트는 포함하지 마.
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
       }],
       generationConfig: {
           temperature: 0.4,
           topK: 32,
           topP: 1,
           maxOutputTokens: 1024,
       }
   };
   
   const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
       method: 'POST',
       headers: {
           'Content-Type': 'application/json',
       },
       body: JSON.stringify(requestBody)
   });
   
   if (!response.ok) {
       throw new Error(`API 호출 실패: ${response.status} ${response.statusText}`);
   }
   
   const data = await response.json();
   const responseText = data.candidates[0].content.parts[0].text;
   
   console.log('🤖 Gemini API 응답:', responseText);
   
   // JSON 파싱
   try {
       const jsonMatch = responseText.match(/\{[\s\S]*\}/);
       if (jsonMatch) {
           return JSON.parse(jsonMatch[0]);
       } else {
           throw new Error('JSON 형태를 찾을 수 없습니다');
       }
   } catch (parseError) {
       console.error('❌ JSON 파싱 오류:', parseError);
       throw new Error('응답 파싱 실패');
   }
}

// 결과 표시
function displayResult(analysisResult) {
   try {
       // 음식 이름
       document.getElementById('food-name-result').textContent = analysisResult.foodName || '알 수 없는 음식';
       
       // 혈당 영향도
       const glucoseImpactElement = document.getElementById('glucose-impact');
       glucoseImpactElement.textContent = analysisResult.glucoseImpact || '중간';
       
       // 혈당 영향도에 따른 스타일 적용
       glucoseImpactElement.className = 'result-value';
       if (analysisResult.glucoseImpact === '낮음') {
           glucoseImpactElement.classList.add('impact-low');
       } else if (analysisResult.glucoseImpact === '높음') {
           glucoseImpactElement.classList.add('impact-high');
       } else {
           glucoseImpactElement.classList.add('impact-medium');
       }
       
       // 기타 정보
       document.getElementById('main-ingredients').textContent = analysisResult.mainIngredients || '정보 없음';
       document.getElementById('gi-value').textContent = analysisResult.expectedGI || '정보 없음';
       document.getElementById('carb-amount').textContent = analysisResult.carbAmount || '정보 없음';
       document.getElementById('dietary-advice').textContent = analysisResult.dietaryAdvice || '적당량 섭취를 권장합니다.';
       
       // 결과 카드 표시
       resultCard.style.display = 'block';
       
       // 페이지 제목 업데이트
       document.title = `${analysisResult.foodName} 분석 결과 - 음식 분석 앱`;
       
   } catch (error) {
       console.error('❌ 결과 표시 오류:', error);
       showError('분석 결과를 표시하는 중 오류가 발생했습니다.');
   }
}

// 결과 닫기
function closeResult() {
   resultCard.style.display = 'none';
   document.title = '음식 촬영 - 음식 분석 앱';
}

// 로딩 표시
function showLoading(message = '처리 중입니다...') {
   loading.style.display = 'block';
   const loadingText = loading.querySelector('p');
   if (loadingText) {
       loadingText.textContent = message;
   }
}

// 로딩 숨김
function hideLoading() {
   loading.style.display = 'none';
}

// 에러 표시
function showError(message) {
   document.getElementById('error-text').textContent = message;
   errorMessage.style.display = 'flex';
}

// 에러 닫기
function closeError() {
   errorMessage.style.display = 'none';
}

// 히스토리 저장
function saveToHistory(analysisResult) {
   try {
       const historyItem = {
           date: new Date().toLocaleString('ko-KR'),
           timestamp: Date.now(),
           ...analysisResult,
           image: capturedImageData
       };
       
       analysisHistory.unshift(historyItem);
       
       // 최대 20개까지만 저장
       if (analysisHistory.length > 20) {
           analysisHistory = analysisHistory.slice(0, 20);
       }
       
       console.log('💾 분석 결과 저장 완료');
       
   } catch (error) {
       console.error('❌ 히스토리 저장 실패:', error);
   }
}

// 히스토리 로드
function loadHistory() {
   // 세션 기반 히스토리 (페이지 새로고침 시 초기화)
   analysisHistory = [];
}

// PWA 설치 프롬프트 표시
function showInstallPrompt(deferredPrompt) {
   const installPrompt = document.createElement('div');
   installPrompt.className = 'install-prompt';
   installPrompt.innerHTML = `
       <div class="install-content">
           <h3>📱 앱 설치</h3>
           <p>홈 화면에 "음식 분석 앱"을 추가하여<br>더 편리하게 사용하세요!</p>
           <div class="install-buttons">
               <button id="install-yes" class="install-btn install-yes">설치하기</button>
               <button id="install-no" class="install-btn install-no">나중에</button>
           </div>
       </div>
   `;
   
   document.body.appendChild(installPrompt);
   
   // 설치 버튼 클릭
   document.getElementById('install-yes').addEventListener('click', () => {
       deferredPrompt.prompt();
       deferredPrompt.userChoice.then((choiceResult) => {
           if (choiceResult.outcome === 'accepted') {
               console.log('✅ PWA 설치 완료');
               showInstallSuccess();
           } else {
               console.log('❌ PWA 설치 취소');
           }
           installPrompt.remove();
       });
   });
   
   // 취소 버튼 클릭
   document.getElementById('install-no').addEventListener('click', () => {
       console.log('⏭️ PWA 설치 연기');
       installPrompt.remove();
   });
   
   // 배경 클릭 시 닫기
   installPrompt.addEventListener('click', (e) => {
       if (e.target === installPrompt) {
           installPrompt.remove();
       }
   });
   
   // 10초 후 자동 숨김
   setTimeout(() => {
       if (document.body.contains(installPrompt)) {
           installPrompt.remove();
       }
   }, 10000);
}

// 설치 성공 알림
function showInstallSuccess() {
   const successPrompt = document.createElement('div');
   successPrompt.className = 'install-success';
   successPrompt.innerHTML = `
       <div class="success-content">
           <h3>🎉 설치 완료!</h3>
           <p>홈 화면에서 "음식 분석 앱"을 확인하세요</p>
       </div>
   `;
   
   document.body.appendChild(successPrompt);
   
   // 3초 후 자동 제거
   setTimeout(() => {
       successPrompt.remove();
   }, 3000);
}

// PWA 상태 확인
function checkPWAStatus() {
   // 이미 설치된 PWA인지 확인
   if (window.matchMedia('(display-mode: standalone)').matches) {
       console.log('🎯 PWA 모드로 실행 중');
       document.body.classList.add('pwa-mode');
   }
   
   // iOS Safari에서 홈 화면 추가 확인
   if (window.navigator.standalone) {
       console.log('📱 iOS 홈 화면에서 실행 중');
       document.body.classList.add('ios-standalone');
   }
}

// 서비스 워커 업데이트 확인
function checkForUpdates() {
   if ('serviceWorker' in navigator) {
       navigator.serviceWorker.ready.then(registration => {
           registration.addEventListener('updatefound', () => {
               const newWorker = registration.installing;
               newWorker.addEventListener('statechange', () => {
                   if (newWorker.state === 'installed') {
                       if (navigator.serviceWorker.controller) {
                           showUpdatePrompt(newWorker);
                       }
                   }
               });
           });
       });
   }
}

// 업데이트 프롬프트 표시
function showUpdatePrompt(worker) {
   const updatePrompt = document.createElement('div');
   updatePrompt.className = 'update-prompt';
   updatePrompt.innerHTML = `
       <div class="update-content">
           <h3>🔄 업데이트 알림</h3>
           <p>새로운 버전이 있습니다.<br>업데이트하시겠습니까?</p>
           <div class="update-buttons">
               <button id="update-yes" class="update-btn update-yes">업데이트</button>
               <button id="update-no" class="update-btn update-no">나중에</button>
           </div>
       </div>
   `;
   
   document.body.appendChild(updatePrompt);
   
   document.getElementById('update-yes').addEventListener('click', () => {
       worker.postMessage({ type: 'SKIP_WAITING' });
       updatePrompt.remove();
       window.location.reload();
   });
   
   document.getElementById('update-no').addEventListener('click', () => {
       updatePrompt.remove();
   });
}

// 온라인/오프라인 상태 처리
window.addEventListener('online', () => {
   console.log('🌐 온라인 상태');
   hideOfflineMessage();
});

window.addEventListener('offline', () => {
   console.log('📡 오프라인 상태');
   showOfflineMessage();
});

// 오프라인 메시지 표시
function showOfflineMessage() {
   const offlineMessage = document.createElement('div');
   offlineMessage.id = 'offline-message';
   offlineMessage.className = 'offline-message';
   offlineMessage.innerHTML = `
       <div class="offline-content">
           <h3>📡 오프라인 모드</h3>
           <p>인터넷 연결이 끊어졌습니다.<br>분석 기능이 제한됩니다.</p>
       </div>
   `;
   
   document.body.appendChild(offlineMessage);
}

// 오프라인 메시지 숨김
function hideOfflineMessage() {
   const offlineMessage = document.getElementById('offline-message');
   if (offlineMessage) {
       offlineMessage.remove();
   }
}

// 전역 오류 처리
window.addEventListener('error', (e) => {
   console.error('❌ 전역 오류:', e.error);
   
   // 개발 모드가 아닌 경우에만 사용자에게 에러 표시
   if (location.hostname !== 'localhost') {
       showError('예상치 못한 오류가 발생했습니다.\n페이지를 새로고침해주세요.');
   }
});

// 처리되지 않은 Promise 거부 처리
window.addEventListener('unhandledrejection', (e) => {
   console.error('❌ 처리되지 않은 Promise 거부:', e.reason);
   e.preventDefault();
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', () => {
   stopCameraStream();
   console.log('🧹 앱 정리 완료');
});

console.log('🚀 음식 분석 앱 로드 완료');
