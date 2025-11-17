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
const DISCOVERABLE_EMOTES = ['happy','sad','angry','surprised','bothhands'];

// Hand detection state
let handsInstance = null;
let lastHandsResults = null;
let handBusy = false;

// Map detected dominant expression to a meme file and caption (loaded from JSON)
let brainrotMap = {
  happy: {src:'brainrot/goblin-laugh.jpg', text:'You are radiating chaotic joy'},
  sad: {src:'brainrot/goblin-cry.jpg', text:'Saddest brainrot energy'},
  angry: {src:'brainrot/goblin-tongue.png', text:'Weird vibe (fallback)'},
  surprised: {src:'brainrot/goblin-tongue.png', text:'Shook and brainrotten'},
  neutral: {src:'brainrot/goblin-laugh.jpg', text:'Neutral simmering brainrot'},
  disgusted: {src:'brainrot/goblin-greed.jpg', text:'Giga anger brainrot'},
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
    console.error('❌ Image failed to load, retrying without cache param:', cacheBusted);
    memeImg.onerror = null;
    memeImg.src = src; // fallback to raw src
  };
  memeImg.onload = () => {
    console.log('✅ Image loaded successfully:', src);
  };
  memeImg.src = cacheBusted;
  caption.textContent = text;
  console.log('🖼️ Setting meme to:', src, '| Caption:', text);
  
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
    // Ensure 6-7 track is stopped
    if (backgroundMusic) {
      try { backgroundMusic.pause(); backgroundMusic.currentTime = 0; } catch (_) {}
    }
  } else if (src.includes('goblin-laugh.jpg') && goblinLaughSound) {
    // Play goblin laugh sound if goblin-laugh.jpg is displayed
    goblinLaughSound.currentTime = 1; // Skip first 1 second, start from 1 second in
    goblinLaughSound.loop = false; // Make it loop continuously
    goblinLaughSound.play().catch(err => {
      console.warn('Could not play goblin laugh sound:', err);
    });
    // Stop goblin cry if it's playing
    if (goblinCrySound) {
      goblinCrySound.loop = false;
      goblinCrySound.pause();
      goblinCrySound.currentTime = 0;
    }
    // Ensure 6-7 track is stopped
    if (backgroundMusic) {
      try { backgroundMusic.pause(); backgroundMusic.currentTime = 0; } catch (_) {}
    }
  } else if (src.includes('cr-67.jpg') && backgroundMusic) {
    // Play 6-7 track for cr-67 emotion
    try {
      const desired = 'music/6-7-full.mp3';
      const sourceEl = backgroundMusic.querySelector && backgroundMusic.querySelector('source');
      if (sourceEl) { sourceEl.src = desired; } else { backgroundMusic.src = desired; }
      backgroundMusic.loop = false;
      backgroundMusic.currentTime = 0;
      backgroundMusic.load();
      backgroundMusic.play().catch(() => {});
    } catch (e) {
      console.warn('Failed to play 6-7 track:', e);
    }
    // Stop other sfx
    if (goblinCrySound) { goblinCrySound.loop = false; goblinCrySound.pause(); }
    if (goblinLaughSound) { goblinLaughSound.loop = false; goblinLaughSound.pause(); }
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
    // Also stop 6-7 track if playing
    if (backgroundMusic) {
      try {
        backgroundMusic.pause();
        backgroundMusic.currentTime = 0;
      } catch (_) {}
    }
  }
}

// Persistence: discovered emotes in localStorage
function getFoundEmotes() {
  try {
    return JSON.parse(localStorage.getItem('emotesFound') || '{}');
  } catch (_) { return {}; }
}
function saveFoundEmotes(found) {
  localStorage.setItem('emotesFound', JSON.stringify(found));
}
function recordEmoteFound(emote) {
  if (!DISCOVERABLE_EMOTES.includes(emote)) return;
  const found = getFoundEmotes();
  if (found[emote]) return;
  found[emote] = true;
  saveFoundEmotes(found);
  console.log('Emote discovered:', emote);
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
  // Debug: log all expression values
  console.log('Expression values:', Object.entries(expressions)
    .sort((a, b) => b[1] - a[1])
    .map(([name, val]) => `${name}: ${(val * 100).toFixed(1)}%`)
    .join(', '));
  console.log('Selected:', best.name, `(${(best.value * 100).toFixed(1)}%)`);
  return best.name;
}

// Landmark helpers: add interpolated points along standard 68-landmark chains
function getLandmarkChains() {
  return [
    // jawline
    Array.from({length:17}, (_,i)=>i),
    // left eyebrow
    [17,18,19,20,21],
    // right eyebrow
    [22,23,24,25,26],
    // nose bridge
    [27,28,29,30],
    // lower nose
    [31,32,33,34,35],
    // left eye
    [36,37,38,39,40,41,36],
    // right eye
    [42,43,44,45,46,47,42],
    // outer mouth
    [48,49,50,51,52,53,54,55,56,57,58,59,48],
    // inner mouth
    [60,61,62,63,64,65,66,67,60]
  ];
}

function drawLandmarksWithSubdivisions(ctx, points, subdivisions = 2) {
  if (!ctx || !points || !points.length) return;
  // original landmarks
  ctx.fillStyle = 'rgba(0,200,255,0.9)';
  for (const p of points) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  // interpolated points along chains
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const chains = getLandmarkChains();
  for (const chain of chains) {
    for (let i = 0; i < chain.length - 1; i++) {
      const a = points[chain[i]];
      const b = points[chain[i+1]];
      if (!a || !b) continue;
      for (let s = 1; s <= subdivisions; s++) {
        const t = s / (subdivisions + 1);
        const x = a.x + (b.x - a.x) * t;
        const y = a.y + (b.y - a.y) * t;
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// Add denser hand points by interpolating between connections
function drawHandWithSubdivisions(ctx, landmarks, canvas, subdivisions = 2, color = '#ffffff') {
  if (!ctx || !landmarks || !Array.isArray(landmarks)) return;
  const w = canvas.width, h = canvas.height;
  try {
    const pairs = (typeof HAND_CONNECTIONS !== 'undefined') ? HAND_CONNECTIONS : [];
    // Base landmarks
    ctx.fillStyle = color;
    landmarks.forEach(p => {
      const x = p.x * w;
      const y = p.y * h;
      ctx.beginPath();
      ctx.arc(x, y, 1.8, 0, Math.PI * 2);
      ctx.fill();
    });
    // Interpolated points along each connection
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [aIdx, bIdx] of pairs) {
      const a = landmarks[aIdx];
      const b = landmarks[bIdx];
      if (!a || !b) continue;
      for (let s = 1; s <= subdivisions; s++) {
        const t = s / (subdivisions + 1);
        const x = (a.x + (b.x - a.x) * t) * w;
        const y = (a.y + (b.y - a.y) * t) * h;
        ctx.beginPath();
        ctx.arc(x, y, 1.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } catch (e) {
    // silent
  }
}

// Function to apply mood (used by manual override)
function applyMood(mood) {
  const map = brainrotMap[mood] || brainrotMap['neutral'];
  setMeme(map.src, map.text);
  console.log('Manual mood applied:', mood, '->', map.src);
  recordEmoteFound(mood);
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

    // 2.5) initialize MediaPipe Hands (if script is available)
    if (typeof Hands !== 'undefined') {
      console.log('Initializing MediaPipe Hands...');
      handsInstance = new Hands({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
      });
      handsInstance.setOptions({
        selfieMode: false,
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.6,
        minTrackingConfidence: 0.5
      });
      handsInstance.onResults((results) => {
        lastHandsResults = results;
      });
      // start hands processing loop
      startHandsLoop();
    } else {
      console.warn('MediaPipe Hands not available. Skipping hand detection.');
    }

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
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.5 });
  console.log('Starting detection loop...');
  
  setInterval(async () => {
    if (video.paused || video.ended) {
      console.warn('Video is paused or ended');
      return;
    }

    try {
      const result = await faceapi
        .detectSingleFace(video, options)
        .withFaceLandmarks(true)
        .withFaceExpressions();

      // clear overlay
      if (ctx) ctx.clearRect(0,0,overlay.width,overlay.height);

      if (result) {
        const dims = faceapi.matchDimensions(overlay, video, true);
        const resized = faceapi.resizeResults(result, dims);

        // draw face landmark points (with interpolated midpoints for denser overlay)
        if (ctx) {
          const points = resized.landmarks.positions;
          drawLandmarksWithSubdivisions(ctx, points, 2);
        }

        // draw hands (if last results available)
        if (ctx && lastHandsResults && Array.isArray(lastHandsResults.multiHandLandmarks)) {
          try {
            const handsLm = lastHandsResults.multiHandLandmarks;
            const handness = lastHandsResults.multiHandedness || [];
            for (let i = 0; i < handsLm.length; i++) {
              const lm = handsLm[i];
              const isLeft = handness[i] && handness[i].label === 'Left';
              const color = isLeft ? '#ff6464' : '#64ff64';
              if (typeof drawConnectors !== 'undefined' && typeof drawLandmarks !== 'undefined' && typeof HAND_CONNECTIONS !== 'undefined') {
                drawConnectors(ctx, lm, HAND_CONNECTIONS, { color, lineWidth: 4 });
                drawLandmarks(ctx, lm, { color, lineWidth: 1, radius: 2 });
              }
              // Always add extra interpolated points for denser tracing
              drawHandWithSubdivisions(ctx, lm, overlay, 2, color);
            }
          } catch (e) {
            console.warn('Hand draw error:', e);
          }
        }

        // Determine emotion, with two-hands override taking priority
        const manualMood = manualMoodSelect.value;
        const handsCount = (lastHandsResults && Array.isArray(lastHandsResults.multiHandLandmarks))
          ? lastHandsResults.multiHandLandmarks.length
          : 0;
        const baseEmotion = manualMood || getDominantExpression(result.expressions);
        const dominant = handsCount >= 2 ? 'bothhands' : baseEmotion;
        const map = brainrotMap[dominant] || brainrotMap['neutral'];
        const currentSrc = memeImg.src.split('/').pop().split('?')[0];
        const newSrc = map.src.split('/').pop();
        
        // Debug logging
        console.log('=== Detection Debug ===');
        console.log('Expressions:', result.expressions);
        console.log('Dominant expression:', baseEmotion);
        console.log('Hands count:', handsCount);
        console.log('Final dominant:', dominant);
        console.log('Current image:', currentSrc);
        console.log('New image:', newSrc);
        console.log('Should switch?', currentSrc !== newSrc);
        
        if (currentSrc !== newSrc) {
          setMeme(map.src, map.text);
          const source = handsCount >= 2 ? 'hands override' : (manualMood ? 'manual override' : 'detected');
          console.log(`✅ Expression ${source}:`, dominant, '->', map.src);
          recordEmoteFound(dominant);
        } else {
          console.log('⏸️ Image unchanged (same as current)');
        }
      } else {
        // no face - check for manual override
        const manualMood = manualMoodSelect.value;
        const handsCount = (lastHandsResults && Array.isArray(lastHandsResults.multiHandLandmarks))
          ? lastHandsResults.multiHandLandmarks.length
          : 0;
        if (handsCount >= 2) {
          const map = brainrotMap['bothhands'] || brainrotMap['neutral'];
          const currentSrc = memeImg.src.split('/').pop().split('?')[0];
          if (currentSrc !== map.src.split('/').pop()) {
            setMeme(map.src, map.text);
            console.log('Hands override (no face): bothhands ->', map.src);
            recordEmoteFound('bothhands');
          }
        } else if (manualMood) {
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

function startHandsLoop() {
  if (!handsInstance) return;
  const loop = async () => {
    if (!video || video.readyState < 2) {
      requestAnimationFrame(loop);
      return;
    }
    if (!handBusy) {
      try {
        handBusy = true;
        await handsInstance.send({ image: video });
      } catch (e) {
        console.warn('Hands send error:', e);
      } finally {
        handBusy = false;
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
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
