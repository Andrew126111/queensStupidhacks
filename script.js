// Brainrot Mirror script.js
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const memeImg = document.getElementById('meme');
const caption = document.getElementById('caption');
const manualMoodSelect = document.getElementById('manualMood');
const ctx = overlay.getContext && overlay.getContext('2d');

const MODELS_URL = '/models'; // place face-api model files here
const BRAINROT_MAP_URL = 'brainrotMap.json';

// Map detected dominant expression to a meme file and caption (loaded from JSON)
let brainrotMap = {
  happy: {src:'brainrot/happy.gif', text:'You are radiating chaotic joy'},
  sad: {src:'brainrot/sad.gif', text:'Saddest brainrot energy'},
  angry: {src:'brainrot/angry.gif', text:'Giga anger brainrot'},
  surprised: {src:'brainrot/surprised.gif', text:'Shook and brainrotten'},
  neutral: {src:'brainrot/neutral.gif', text:'Neutral simmering brainrot'},
  disgusted: {src:'brainrot/neutral.gif', text:'Weird vibe (fallback)'},
  fearful: {src:'brainrot/neutral.gif', text:'Scared little brainrot'},
};

// Load brainrotMap.json configuration
async function loadBrainrotMap() {
  try {
    console.log('Loading brainrotMap.json...');
    const response = await fetch(BRAINROT_MAP_URL);
    if (!response.ok) {
      throw new Error(`Failed to load ${BRAINROT_MAP_URL}: ${response.status}`);
    }
    const loadedMap = await response.json();
    brainrotMap = loadedMap;
    console.log('brainrotMap.json loaded successfully:', brainrotMap);
    
    // Update dropdown options to match loaded map
    updateManualMoodDropdown();
  } catch (err) {
    console.warn('Failed to load brainrotMap.json, using default map:', err);
    // Keep default map
  }
}

// Update manual mood dropdown to match loaded brainrotMap
function updateManualMoodDropdown() {
  // Clear existing options except "Auto"
  while (manualMoodSelect.children.length > 1) {
    manualMoodSelect.removeChild(manualMoodSelect.lastChild);
  }
  
  // Add options from loaded map
  Object.keys(brainrotMap).forEach(key => {
    const option = document.createElement('option');
    option.value = key;
    option.textContent = key.charAt(0).toUpperCase() + key.slice(1);
    manualMoodSelect.appendChild(option);
  });
}

// Utility: choose best expression from the face-api expression probabilities
function getDominantExpression(expressions) {
  let best = {name:'neutral', value:0};
  for (const [name, value] of Object.entries(expressions)) {
    if (value > best.value) { best = {name, value}; }
  }
  return best.name;
}

// Function to apply mood (used by manual override)
function applyMood(mood) {
  const map = brainrotMap[mood] || brainrotMap['neutral'];
  memeImg.src = map.src;
  caption.textContent = map.text;
  console.log('Manual mood applied:', mood, '->', map.src);
}

async function setup() {
  try {
    console.log('Setting up Brainrot Mirror...');
    
    // 0) Load brainrotMap.json first
    await loadBrainrotMap();
    
    // 1) start webcam
    console.log('Requesting camera access...');
    const stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: 'user'}, audio:false});
    video.srcObject = stream;
    
    // Wait for video metadata to load before sizing overlay
    await new Promise((resolve, reject) => {
      video.addEventListener('loadedmetadata', () => {
        console.log('Video metadata loaded:', video.videoWidth, 'x', video.videoHeight);
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          reject(new Error('Video dimensions are zero'));
          return;
        }
        resolve();
      }, { once: true });
      video.addEventListener('error', (e) => {
        reject(new Error('Video load error: ' + e.message));
      }, { once: true });
      video.play().catch(reject);
    });

    // size overlay to video
    overlay.width = video.videoWidth;
    overlay.height = video.videoHeight;
    overlay.style.width = video.offsetWidth + 'px';
    overlay.style.height = video.offsetHeight + 'px';
    console.log('Overlay sized to:', overlay.width, 'x', overlay.height);

    // 2) load face-api models
    console.log('Loading face-api models from:', MODELS_URL);
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
        faceapi.nets.faceExpressionNet.loadFromUri(MODELS_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODELS_URL)
      ]);
      console.log('All models loaded successfully');
    } catch (modelErr) {
      console.error('Model loading error:', modelErr);
      throw new Error('Failed to load models. Check console for CORS/404 errors. Ensure model files are in ' + MODELS_URL);
    }

    caption.textContent = 'Models loaded — scanning...';

    // 3) run detection loop
    detectLoop();
  } catch (err) {
    console.error('Setup error:', err);
    caption.textContent = 'Error: ' + (err.message || err);
  }
}

async function detectLoop() {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.5 });
  console.log('Starting detection loop...');
  
  setInterval(async () => {
    if (video.paused || video.ended) {
      console.warn('Video is paused or ended');
      return;
    }

    try {
      const result = await faceapi.detectSingleFace(video, options).withFaceLandmarks(true).withFaceExpressions();

      // clear overlay
      if (ctx) ctx.clearRect(0,0,overlay.width,overlay.height);

      if (result) {
        const dims = faceapi.matchDimensions(overlay, video, true);
        const resized = faceapi.resizeResults(result, dims);

        // draw landmark points
        if (ctx) {
          const points = resized.landmarks.positions;
          ctx.fillStyle = 'rgba(0,200,255,0.9)';
          points.forEach(p => ctx.fillRect(p.x-1.5, p.y-1.5, 3, 3));
        }

        // Check for manual override first
        const manualMood = manualMoodSelect.value;
        const dominant = manualMood || getDominantExpression(result.expressions);
        const map = brainrotMap[dominant] || brainrotMap['neutral'];
        const currentSrc = memeImg.src.split('/').pop();
        if (currentSrc !== map.src.split('/').pop()) {
          memeImg.src = map.src;
          caption.textContent = map.text;
          const source = manualMood ? 'manual override' : 'detected';
          console.log(`Expression ${source}:`, dominant, '->', map.src);
        }
      } else {
        // no face - check for manual override
        const manualMood = manualMoodSelect.value;
        if (manualMood) {
          // Use manual override even if no face detected
          const map = brainrotMap[manualMood] || brainrotMap['neutral'];
          const currentSrc = memeImg.src.split('/').pop();
          if (currentSrc !== map.src.split('/').pop()) {
            memeImg.src = map.src;
            caption.textContent = map.text;
            console.log('Manual override (no face):', manualMood, '->', map.src);
          }
        } else {
          // no face and no manual override
          caption.textContent = 'No face detected — strike a pose!';
          // optionally show neutral meme
          const map = brainrotMap['neutral'];
          const currentSrc = memeImg.src.split('/').pop();
          if (currentSrc !== map.src.split('/').pop()) {
            memeImg.src = map.src;
          }
        }
      }
    } catch (detectErr) {
      console.error('Detection error:', detectErr);
      // Continue running even if one detection fails
    }
  }, 400); // every 400ms
}

// Setup manual mood dropdown change handler
function setupManualMoodControl() {
  if (manualMoodSelect) {
    manualMoodSelect.addEventListener('change', (e) => {
      const selectedMood = e.target.value;
      if (selectedMood) {
        applyMood(selectedMood);
      }
    });
    console.log('Manual mood control initialized');
  }
}

// Wait for face-api.js to be available
function waitForFaceAPI(maxAttempts = 50, interval = 100) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    const checkFaceAPI = () => {
      attempts++;
      if (typeof faceapi !== 'undefined' && faceapi.nets) {
        console.log('face-api.js is available');
        resolve();
      } else if (attempts >= maxAttempts) {
        reject(new Error('face-api.js failed to load after ' + (maxAttempts * interval) + 'ms. Check the CDN URL.'));
      } else {
        setTimeout(checkFaceAPI, interval);
      }
    };
    checkFaceAPI();
  });
}

// start
window.addEventListener('load', async () => {
  console.log('Page loaded, waiting for face-api.js...');
  
  try {
    await waitForFaceAPI();
  } catch (err) {
    console.error('Error waiting for face-api.js:', err);
    caption.textContent = 'Error: face-api.js not loaded. Check console for details.';
    return;
  }
  
  // Setup manual mood control
  setupManualMoodControl();
  
  setup();
});
