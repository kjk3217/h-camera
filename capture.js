if ('serviceWorker' in navigator)
  navigator.serviceWorker.register('sw.js');

const cameraInput=document.getElementById('cameraInput');
const previewImg=document.getElementById('previewImg');
const recaptureBtn=document.getElementById('recaptureBtn');
const shutterBtn=document.getElementById('shutterBtn');
const analyzeBtn=document.getElementById('analyzeBtn');
const resultCard=document.getElementById('resultCard');
const analysisText=document.getElementById('analysisText');

shutterBtn.addEventListener('click',()=>cameraInput.click());
recaptureBtn.addEventListener('click',resetCapture);

function resetCapture(){
  cameraInput.value='';
  previewImg.style.display='none';
  analyzeBtn.disabled=true;
  resultCard.classList.remove('show');
}

cameraInput.addEventListener('change',()=>{
  const file=cameraInput.files[0];
  if(!file) return;
  previewImg.src=URL.createObjectURL(file);
  previewImg.onload=()=>URL.revokeObjectURL(previewImg.src);
  previewImg.style.display='block';
  analyzeBtn.disabled=false;
});

analyzeBtn.addEventListener('click',async()=>{
  const file=cameraInput.files[0];
  if(!file) return alert('사진을 먼저 촬영해주세요!');
  analysisText.textContent='분석 중...';
  resultCard.classList.remove('show');

  const base64=await new Promise(res=>{const fr=new FileReader();fr.onload=()=>res(fr.result);fr.readAsDataURL(file);});

  const endpoint='https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=AIzaSyBJi0fiCu3A8ESdGkoDHkKY3fgRta5L3WU';
  const prompt=`너는 지금부터 당뇨 환자를 위한 식단 분석 전문가야.
1. 음식의 종류와 주요 재료 추정
2. 혈당 영향도 예측
3. 예상 GI·탄수화물
4. 고혈당 위험 원인
5. 섭취 시 주의·대체 음식
응답 형식:
- 음식 이름
- 혈당 영향도: 높음/중간/낮음
- 주요 성분
- 예상 GI / 탄수화물
- 식이 조언`;

  const body={contents:[{parts:[
    {inlineData:{mimeType:file.type,data:base64.split(',')[1]}},
    {text:prompt}
  ]}]};

  try{
    const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    const json=await res.json();
    const text=json?.candidates?.[0]?.content?.parts?.[0]?.text ?? '분석 실패';
    analysisText.textContent=text.trim();
  }catch(err){
    analysisText.textContent='오류: '+err.message;
  }
  resultCard.classList.add('show');
});
