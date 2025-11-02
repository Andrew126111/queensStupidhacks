// Brainrot Mirror script.js
const video = document.getElementById('video');
const overlay = document.getElementById('overlay');
const memeImg = document.getElementById('meme');
const caption = document.getElementById('caption');
const manualMoodSelect = document.getElementById('manualMood');
const backgroundMusic = document.getElementById('backgroundMusic');
const goblinCrySound = document.getElementById('goblinCrySound');
const goblinLaughSound = document.getElementById('goblinLaughSound');
const ctx = overlay.getContext && overlay.getContext('2d');

const MODELS_URL = '/models'; // place face-api model files here
const BRAINROT_MAP_URL = 'brainrotMap.json';

// Map detected dominant expression to a meme file and caption (loaded from JSON)
let brainrotMap = {
  happy: {src:'brainrot/goblin-laugh.jpg', text:'You are radiating chaotic joy'},
  sad: {src:'brainrot/goblin-cry.jpg', text:'Saddest brainrot energy'},
  angry: {src:'brainrot/goblin-greed.jpg', text:'Giga anger brainrot'},
  surprised: {src:'brainrot/goblin-tongue.png', text:'Shook and brainrotten'},
  neutral: {src:'brainrot/goblin-laugh.jpg', text:'Neutral simmering brainrot'},
  disgusted: {src:'brainrot/goblin-tongue.png', text:'Weird vibe (fallback)'},
  fearful: {src:'brainrot/goblin-cry.jpg', text:'Scared little brainrot'},
};

// Load brainrotMap.json configuration
async function loadBrainrotMap() {
  try {
    console.log('Loading brainrotMap.json...');
    const response = await fetch(`${BRAINROT_MAP_URL}?t=${Date.now()}`, { cache: 'no-cache' });
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

// Helper: set meme image with cache-busting and simple error fallback
function setMeme(src, text) {
  const cacheBusted = src + '?t=' + Date.now();
  memeImg.onerror = () => {
    console.error('Image failed to load, retrying without cache param:', cacheBusted);
    memeImg.onerror = null;
    memeImg.src = src; // fallback to raw src
  };
  memeImg.onload = () => {
    // no-op, but keeps last onerror scoped to this load
  };
  memeImg.src = cacheBusted;
  caption.textContent = text;
  console.log('Meme set to:', src);
  
  // Play goblin cry sound if goblin-cry.jpg is displayed
  if (src.includes('goblin-cry.jpg') && goblinCrySound) {
    goblinCrySound.currentTime = 1; // Skip first 1 second, start from 1 second in
    goblinCrySound.loop = true; // Make it loop continuously
    goblinCrySound.play().catch(err => {
      console.warn('Could not play goblin cry sound:', err);
    });
    // Stop goblin laugh if it's playing
    if (goblinLaughSound) {
      goblinLaughSound.loop = false;
      goblinLaughSound.pause();
      goblinLaughSound.currentTime = 0;
    }
  } else if (src.includes('goblin-laugh.jpg') && goblinLaughSound) {
    // Play goblin laugh sound if goblin-laugh.jpg is displayed
    goblinLaughSound.currentTime = 1; // Skip first 1 second, start from 1 second in
    goblinLaughSound.loop = true; // Make it loop continuously
    goblinLaughSound.play().catch(err => {
      console.warn('Could not play goblin laugh sound:', err);
    });
    // Stop goblin cry if it's playing
    if (goblinCrySound) {
      goblinCrySound.loop = false;
      goblinCrySound.pause();
      goblinCrySound.currentTime = 0;
    }
  } else {
    // Stop both sounds when other images are shown
    if (goblinCrySound) {
      goblinCrySound.loop = false;
      goblinCrySound.pause();
      goblinCrySound.currentTime = 0;
    }
    if (goblinLaughSound) {
      goblinLaughSound.loop = false;
      goblinLaughSound.pause();
      goblinLaughSound.currentTime = 0;
    }
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
  setMeme(map.src, map.text);
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

    // Set initial image with cache-busting
    setMeme(brainrotMap['neutral'].src, brainrotMap['neutral'].text);

    // 3) Background music disabled - not playing

    // 4) run detection loop
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
        const currentSrc = memeImg.src.split('/').pop().split('?')[0];
        if (currentSrc !== map.src.split('/').pop()) {
          setMeme(map.src, map.text);
          const source = manualMood ? 'manual override' : 'detected';
          console.log(`Expression ${source}:`, dominant, '->', map.src);
        }
      } else {
        // no face - check for manual override
        const manualMood = manualMoodSelect.value;
        if (manualMood) {
          // Use manual override even if no face detected
          const map = brainrotMap[manualMood] || brainrotMap['neutral'];
          const currentSrc = memeImg.src.split('/').pop().split('?')[0];
          if (currentSrc !== map.src.split('/').pop()) {
            setMeme(map.src, map.text);
            console.log('Manual override (no face):', manualMood, '->', map.src);
          }
        } else {
          // no face and no manual override
          caption.textContent = 'No face detected — strike a pose!';
          // optionally show neutral meme
          const map = brainrotMap['neutral'];
          const currentSrc = memeImg.src.split('/').pop().split('?')[0];
          if (currentSrc !== map.src.split('/').pop()) {
            setMeme(map.src, map.text);
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

// Start background music on first user interaction (fallback for autoplay restrictions)
function setupBackgroundMusicFallback() {
  const startMusic = async () => {
    if (backgroundMusic && backgroundMusic.paused) {
      try {
        await backgroundMusic.play();
        console.log('Background music started via user interaction');
      } catch (err) {
        console.warn('Failed to start background music:', err);
      }
    }
  };
  
  // Try to start music on any user interaction (using once: true to auto-remove listeners)
  ['click', 'touchstart', 'keydown'].forEach(event => {
    document.addEventListener(event, startMusic, { once: true });
  });
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
  
  // Background music fallback removed - music is disabled
  
  setup();
});
