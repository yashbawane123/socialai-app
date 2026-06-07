import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, Check, Sparkles, RefreshCw, Sliders, Play, Award, HelpCircle } from 'lucide-react';
import { useAuth, API_BASE } from '../hooks/useAuth';

export default function PoseCoachCamera({ onClose, onPostCreate }) {
  const { token } = useAuth();
  
  // Refs
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const selectedTemplateRef = useRef(null);
  const lastAnalyzeTimeRef = useRef(0);
  const isCapturingRef = useRef(false);
  
  const latestLandmarksRef = useRef(null);
  const latestLandmarksTimeRef = useRef(0);
  const isProcessingFrameRef = useRef(false);

  // Lists & Choices
  const [templates, setTemplates] = useState([]);
  const [recommendedPoses, setRecommendedPoses] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [selectedScene, setSelectedScene] = useState('indoor');

  // Real-Time Stats
  const [score, setScore] = useState(0);
  const [guidance, setGuidance] = useState(['Waiting for body tracking...']);
  const [nextRecommendation, setNextRecommendation] = useState(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [autoCaptureEnabled, setAutoCaptureEnabled] = useState(true);
  const [flashActive, setFlashActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  // Capture State
  const [capturedImage, setCapturedImage] = useState(null);
  const [postCaption, setPostCaption] = useState('Strike a pose! Managed to hit a perfect match score! 📸 #AIPoseCoach');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [postError, setPostError] = useState(null);

  // Sync ref
  useEffect(() => {
    selectedTemplateRef.current = selectedTemplate;
  }, [selectedTemplate]);

  // Fetch all templates initially
  const fetchAllPoses = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/poses`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
        setRecommendedPoses(data);
        if (data.length > 0) {
          setSelectedTemplate(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load poses:", err);
      setErrorMsg("Failed to load pose templates from backend.");
    }
  };

  // Fetch scene recommended templates
  const fetchScenePoses = async (scene) => {
    try {
      const res = await fetch(`${API_BASE}/api/poses/recommended?scene=${scene}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRecommendedPoses(data);
        if (data.length > 0) {
          setSelectedTemplate(data[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load scene recommendations:", err);
    }
  };

  useEffect(() => {
    fetchAllPoses();
  }, []);

  const handleSceneChange = (e) => {
    const scene = e.target.value;
    setSelectedScene(scene);
    fetchScenePoses(scene);
  };

  // Similarity Analyzer
  const analyzePose = async (landmarks) => {
    if (!selectedTemplateRef.current) return;
    try {
      const payload = {
        targetPoseId: selectedTemplateRef.current.id,
        landmarks: {
          left_shoulder: { x: landmarks[11].x, y: landmarks[11].y },
          right_shoulder: { x: landmarks[12].x, y: landmarks[12].y },
          left_elbow: { x: landmarks[13].x, y: landmarks[13].y },
          right_elbow: { x: landmarks[14].x, y: landmarks[14].y },
          left_wrist: { x: landmarks[15].x, y: landmarks[15].y },
          right_wrist: { x: landmarks[16].x, y: landmarks[16].y },
          left_hip: { x: landmarks[23].x, y: landmarks[23].y },
          right_hip: { x: landmarks[24].x, y: landmarks[24].y }
        }
      };

      const res = await fetch(`${API_BASE}/api/poses/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        setScore(data.poseScore);
        setGuidance(data.correctionSuggestions || []);
        if (data.recommendedPose) {
          setNextRecommendation(data.recommendedPose);
        }
      }
    } catch (err) {
      console.error("Pose analysis API error:", err);
    }
  };

  const analyzePoseThrottled = (landmarks) => {
    const now = Date.now();
    if (now - lastAnalyzeTimeRef.current > 300) {
      lastAnalyzeTimeRef.current = now;
      analyzePose(landmarks);
    }
  };

  // Draw helpers
  const drawUserSkeleton = (ctx, landmarks, width, height) => {
    const connections = [
      [11, 12], // shoulder-shoulder
      [11, 13], // left shoulder-elbow
      [13, 15], // left elbow-wrist
      [12, 14], // right shoulder-elbow
      [14, 16], // right elbow-wrist
      [11, 23], // left shoulder-hip
      [12, 24], // right shoulder-hip
      [23, 24]  // hip-hip
    ];

    ctx.lineWidth = 4;
    ctx.strokeStyle = '#00f0ff'; // Neon Cyan
    ctx.fillStyle = '#00f0ff';

    // Draw lines
    connections.forEach(([i1, i2]) => {
      const p1 = landmarks[i1];
      const p2 = landmarks[i2];
      if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    });

    // Draw joints
    [11, 12, 13, 14, 15, 16, 23, 24].forEach((idx) => {
      const p = landmarks[idx];
      if (p && p.visibility > 0.5) {
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, 6, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  const drawTargetSkeleton = (ctx, targetPose, width, height) => {
    if (!targetPose || !targetPose.landmarkData) return;
    const data = targetPose.landmarkData;

    const connections = [
      ['left_shoulder', 'right_shoulder'],
      ['left_shoulder', 'left_elbow'],
      ['left_elbow', 'left_wrist'],
      ['right_shoulder', 'right_elbow'],
      ['right_elbow', 'right_wrist'],
      ['left_shoulder', 'left_hip'],
      ['right_shoulder', 'right_hip'],
      ['left_hip', 'right_hip']
    ];

    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)'; // Semi-transparent Green
    ctx.fillStyle = 'rgba(34, 197, 94, 0.7)';

    connections.forEach(([k1, k2]) => {
      const p1 = data[k1];
      const p2 = data[k2];
      if (p1 && p2) {
        ctx.beginPath();
        ctx.moveTo(p1.x * width, p1.y * height);
        ctx.lineTo(p2.x * width, p2.y * height);
        ctx.stroke();
      }
    });

    // Draw joint targets
    Object.keys(data).forEach((key) => {
      const p = data[key];
      if (p) {
        ctx.beginPath();
        ctx.arc(p.x * width, p.y * height, 8, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
  };

  // Camera capture triggers
  const capturePhoto = () => {
    if (isCapturingRef.current) return;
    isCapturingRef.current = true;

    // Flash animation trigger
    setFlashActive(true);
    setTimeout(() => setFlashActive(false), 200);

    const canvas = canvasRef.current;
    if (!canvas) return;

    // Capture clean frame from hidden video element
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (videoRef.current) {
      tempCtx.drawImage(videoRef.current, 0, 0, tempCanvas.width, tempCanvas.height);
    } else {
      tempCtx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
    }

    const dataUrl = tempCanvas.toDataURL('image/jpeg');
    setCapturedImage(dataUrl);
    setPostCaption(`Struck a pose with AI Pose Coach! Hit a match accuracy score of ${score}%! 📸 #AIPoseCoach`);
  };

  // Check auto capture condition
  useEffect(() => {
    if (autoCaptureEnabled && score >= 95 && !capturedImage && !isCapturingRef.current) {
      capturePhoto();
    }
  }, [score, autoCaptureEnabled, capturedImage]);

  // Robust Camera & MediaPipe Initialization Loop
  useEffect(() => {
    let active = true;
    let activeStream = null;
    let poseInstance = null;
    let animationFrameId = null;
    let detectIntervalId = null;
    let poseRetryCount = 0;
    const maxPoseRetries = 20;

    const startCamera = async () => {
      const constraintOptions = [
        { video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }, audio: false },
        { video: { facingMode: 'user' }, audio: false },
        { video: true, audio: false }
      ];

      let stream = null;
      let lastErr = null;

      for (const constraints of constraintOptions) {
        try {
          console.log("Attempting camera access with constraints:", constraints);
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (stream) break; // Success!
        } catch (err) {
          console.warn("Failed camera constraints:", constraints, err);
          lastErr = err;
        }
      }

      if (!stream) {
        console.error("All camera constraints failed:", lastErr);
        let msg = "Failed to start camera feed. ";
        if (lastErr) {
          if (lastErr.name === 'NotAllowedError' || lastErr.name === 'PermissionDeniedError') {
            msg += "Permission denied. Please grant camera access in your browser or application settings.";
          } else if (lastErr.name === 'NotFoundError' || lastErr.name === 'DevicesNotFoundError') {
            msg += "No camera device found.";
          } else if (lastErr.name === 'NotReadableError' || lastErr.name === 'TrackStartError') {
            msg += "Camera is already in use by another application.";
          } else {
            msg += `Error: ${lastErr.message || lastErr.name || 'Unknown error'}`;
          }
        }
        
        if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          msg += " (Note: Mobile/Remote browsers block camera access on HTTP. Make sure you are using an HTTPS connection/tunnel).";
        }
        
        setErrorMsg(msg);
        setIsModelLoading(false);
        return;
      }

      if (!active) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      activeStream = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(e => console.error("Video play failed:", e));
      }

      startDrawingLoop();
    };

    const startDrawingLoop = () => {
      const draw = () => {
        if (!active) return;
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, canvas.width, canvas.height);

          // Draw target skeleton (unmirrored, browser CSS mirrors visually)
          if (selectedTemplateRef.current) {
            drawTargetSkeleton(ctx, selectedTemplateRef.current, canvas.width, canvas.height);
          }

          // Draw user skeleton (unmirrored, browser CSS mirrors visually)
          if (latestLandmarksRef.current && (Date.now() - latestLandmarksTimeRef.current < 1500)) {
            drawUserSkeleton(ctx, latestLandmarksRef.current, canvas.width, canvas.height);
          }
        }
        animationFrameId = requestAnimationFrame(draw);
      };
      animationFrameId = requestAnimationFrame(draw);
    };

    const initPoseModel = () => {
      if (!window.Pose) {
        poseRetryCount++;
        if (poseRetryCount > maxPoseRetries) {
          console.error("MediaPipe Pose scripts failed to load after retries.");
          setErrorMsg("Could not load AI Pose tracking model from CDN. AI coaching is disabled, but you can still use the camera to take a photo manually.");
          setIsModelLoading(false);
          return;
        }
        console.log(`MediaPipe Pose script not loaded yet. Retry ${poseRetryCount}/${maxPoseRetries}...`);
        setTimeout(initPoseModel, 500);
        return;
      }

      try {
        poseInstance = new window.Pose({
          locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`
        });

        poseInstance.setOptions({
          modelComplexity: 1,
          smoothLandmarks: true,
          enableSegmentation: false,
          smoothSegmentation: false,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        poseInstance.onResults((results) => {
          if (!active) return;
          setIsModelLoading(false);

          if (results.poseLandmarks) {
            latestLandmarksRef.current = results.poseLandmarks;
            latestLandmarksTimeRef.current = Date.now();
            analyzePoseThrottled(results.poseLandmarks);
          }
        });

        // Run pose tracking at throttled interval (every 250ms) to avoid CPU spikes
        detectIntervalId = setInterval(async () => {
          if (!active || !poseInstance || isProcessingFrameRef.current) return;
          const video = videoRef.current;
          if (video && video.readyState >= 2) {
            isProcessingFrameRef.current = true;
            try {
              await poseInstance.send({ image: video });
            } catch (err) {
              console.error("Pose processing error:", err);
            } finally {
              isProcessingFrameRef.current = false;
            }
          }
        }, 250);

      } catch (err) {
        console.error("MediaPipe initialization error:", err);
        setErrorMsg("Failed to initialize Pose tracking engine. Manual photo capture is still available.");
        setIsModelLoading(false);
      }
    };

    startCamera();
    initPoseModel();

    return () => {
      active = false;
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      if (detectIntervalId) {
        clearInterval(detectIntervalId);
      }
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (poseInstance) {
        try {
          poseInstance.close();
        } catch (e) {
          console.error("Error closing poseInstance:", e);
        }
      }
    };
  }, []);

  const handlePostSubmit = async () => {
    if (!capturedImage) return;
    setIsSubmitting(true);
    setPostError(null);
    try {
      const result = await onPostCreate(postCaption, [capturedImage]);
      if (result && result.error) {
        setPostError(result.error + (result.explanation ? `: ${result.explanation}` : ''));
      } else {
        onClose();
      }
    } catch (err) {
      console.error(err);
      setPostError("Failed to publish post.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getScoreColor = () => {
    if (score < 50) return 'text-red-400 border-red-500/30 bg-red-500/10';
    if (score < 85) return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
    if (score < 95) return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
    return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/98 backdrop-blur-3xl overflow-y-auto text-slate-100 select-none font-sans">
      
      {/* Header Panel */}
      <div className="sticky top-0 bg-slate-950/70 border-b border-slate-900/60 p-4 md:p-6 flex justify-between items-center z-10 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30">
            <Camera className="w-5 h-5 text-emerald-400 animate-pulse" />
          </div>
          <div>
            <h1 className="text-sm md:text-base font-extrabold uppercase tracking-widest bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent flex items-center gap-1.5">
              AI Pose Coach
            </h1>
            <p className="text-[10px] text-slate-500">Real-Time Posture Alignment & Capture Assistant</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-full text-slate-400 hover:text-white transition-all cursor-pointer"
        >
          <X className="w-4.5 h-4.5" />
        </button>
      </div>

      {/* Main Area */}
      {!capturedImage ? (
        <div className="flex-1 flex flex-col lg:flex-row p-4 md:p-6 gap-6 max-w-7xl mx-auto w-full">
          
          {/* Camera Frame Column */}
          <div className="flex-1 flex flex-col items-center justify-center space-y-4">
            
            {/* Camera Frame Container */}
            <div className="relative w-full max-w-xl aspect-[4/3] rounded-3xl overflow-hidden border border-slate-900 shadow-2xl bg-slate-900/40">
              
              {/* Visible Mirror Video Feed */}
              <video
                ref={videoRef}
                className="w-full h-full object-cover transform scale-x-[-1]"
                playsInline
                muted
                autoPlay
              />

              {/* Transparent Canvas Overlay for Skeletal Landmarks */}
              <canvas
                ref={canvasRef}
                width="640"
                height="480"
                className="absolute inset-0 w-full h-full object-cover pointer-events-none transform scale-x-[-1]"
              />

              {/* Screen Flash Overlay */}
              {flashActive && (
                <div className="absolute inset-0 bg-white z-20 animate-ping duration-150" />
              )}

              {/* Model Spinner Loader */}
              {isModelLoading && (
                <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center z-10 space-y-3">
                  <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin" />
                  <p className="text-xs text-slate-400 animate-pulse">Initializing Pose Tracking Model...</p>
                </div>
              )}

              {/* HUD Banner overlay: Score & Guidance */}
              {!isModelLoading && (
                <div className="absolute bottom-4 left-4 right-4 bg-slate-950/80 backdrop-blur-md border border-slate-800 rounded-2xl p-3 flex items-center justify-between z-10">
                  <div className="space-y-1 flex-1 pr-4">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Coach Suggestion</p>
                    <p className="text-xs font-semibold text-slate-200">
                      {guidance[0] || 'Move into frame to start coaching'}
                    </p>
                  </div>
                  <div className={`px-4 py-2 border rounded-xl flex flex-col items-center justify-center flex-shrink-0 min-w-[70px] ${getScoreColor()}`}>
                    <span className="text-lg font-black">{score}%</span>
                    <span className="text-[9px] uppercase font-bold tracking-tight">Match</span>
                  </div>
                </div>
              )}
            </div>

            {/* Manual Camera Action Row */}
            {!isModelLoading && (
              <div className="flex items-center gap-4">
                <button
                  onClick={capturePhoto}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-full font-bold text-xs shadow-lg shadow-emerald-500/15 flex items-center gap-2 transform active:scale-95 transition-all cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  Capture Photo
                </button>
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 px-4 py-2 rounded-full text-xs">
                  <input
                    type="checkbox"
                    id="autoCapture"
                    checked={autoCaptureEnabled}
                    onChange={(e) => setAutoCaptureEnabled(e.target.checked)}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-0 cursor-pointer"
                  />
                  <label htmlFor="autoCapture" className="cursor-pointer font-semibold text-slate-400 hover:text-slate-200 select-none">
                    Auto-capture at 95%+ Match
                  </label>
                </div>
              </div>
            )}

            {errorMsg && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-2xl px-4 py-2.5 max-w-md text-center">
                ⚠️ {errorMsg}
              </div>
            )}
          </div>

          {/* Side Coaching Dashboard */}
          <div className="w-full lg:w-80 flex flex-col space-y-6">
            
            {/* Target Pose Template Card */}
            {selectedTemplate && (
              <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] uppercase font-bold px-2.5 py-1 bg-emerald-500/15 text-emerald-400 rounded-full border border-emerald-500/20">
                      {selectedTemplate.category}
                    </span>
                    <h2 className="text-base font-extrabold text-slate-200 mt-2">{selectedTemplate.name}</h2>
                  </div>
                  <span className="text-[10px] text-slate-500 font-bold">{selectedTemplate.difficulty}</span>
                </div>
                
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-900 bg-slate-950">
                  <img
                    src={selectedTemplate.imageUrl}
                    alt={selectedTemplate.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent flex items-end p-3">
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                      Try to match the ghost outlines!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Scene Simulator selector */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 space-y-3 text-left">
              <label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                Scene Simulator
              </label>
              <select
                value={selectedScene}
                onChange={handleSceneChange}
                className="w-full px-4 py-2.5 bg-slate-950 border border-slate-900 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-emerald-500/50 transition-all cursor-pointer"
              >
                <option value="indoor">🏠 Indoor Cozy Studio</option>
                <option value="gym">🏋️ Gym Workouts</option>
                <option value="beach">🏖️ Beach Wanderlust</option>
                <option value="street">🏙️ Urban Streetwalk</option>
                <option value="office">💼 Executive Office</option>
              </select>
              <p className="text-[9px] text-slate-500 leading-normal">
                Changes target pose templates to matching environmental settings for ideal background matching.
              </p>
            </div>

            {/* Detailed guidance corrections panel */}
            <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 space-y-3.5 text-left flex-1 min-h-[120px]">
              <h3 className="text-[10px] uppercase font-bold text-slate-500">Pose Alignment Tasks</h3>
              <div className="space-y-2.5">
                {guidance.map((item, idx) => (
                  <div key={idx} className="flex gap-2.5 items-start text-xs text-slate-300">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-[9px] font-bold mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Recommendation banner */}
            {nextRecommendation && (
              <div className="bg-gradient-to-br from-emerald-500/5 to-teal-500/5 border border-emerald-500/10 rounded-3xl p-4 flex items-center gap-3 text-left">
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-slate-900 flex-shrink-0">
                  <img src={nextRecommendation.previewImage} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1">
                  <p className="text-[9px] uppercase font-bold text-emerald-400">Next Pose Recommendation</p>
                  <p className="text-xs font-bold text-slate-300">{nextRecommendation.name}</p>
                </div>
                <button
                  onClick={() => {
                    const matched = templates.find(t => t.id === nextRecommendation.id);
                    if (matched) {
                      setSelectedTemplate(matched);
                      setNextRecommendation(null);
                    }
                  }}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-300 transition-all cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        
        /* Captured Preview Dialog */
        <div className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full space-y-6">
          <div className="bg-slate-900/40 border border-slate-900 rounded-3xl p-5 space-y-4 w-full text-left">
            <h2 className="text-base font-extrabold text-slate-200 flex items-center gap-1.5">
              <Award className="w-5 h-5 text-emerald-400" />
              Photo Captured Successfully!
            </h2>
            <p className="text-xs text-slate-500">Review your picture and compose your caption below before publishing.</p>

            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-slate-900 bg-slate-950">
              <img
                src={capturedImage}
                alt="Captured pose photo"
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 right-3 px-3 py-1.5 bg-emerald-500 text-white rounded-full text-xs font-extrabold shadow-lg">
                Score: {score}% Match
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] uppercase font-bold text-slate-400">Add Caption</label>
              <textarea
                value={postCaption}
                onChange={(e) => setPostCaption(e.target.value)}
                placeholder="Write something about your pose session..."
                className="w-full bg-slate-950 border border-slate-900 rounded-xl p-3 text-sm text-slate-100 placeholder-slate-600 outline-none resize-none font-medium leading-relaxed"
                rows="3.5"
              />
            </div>

            {postError && (
              <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
                ⚠️ {postError}
              </div>
            )}
          </div>

          <div className="flex gap-4 w-full">
            <button
              onClick={() => {
                setCapturedImage(null);
                isCapturingRef.current = false;
                setPostError(null);
              }}
              className="flex-1 py-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-full font-bold text-xs transition-all cursor-pointer"
            >
              Discard & Retake
            </button>
            <button
              onClick={handlePostSubmit}
              disabled={isSubmitting || !postCaption.trim()}
              className="flex-1 py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white rounded-full font-bold text-xs shadow-lg shadow-emerald-500/15 flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
            >
              {isSubmitting ? 'Publishing...' : 'Post to Feed'}
            </button>
          </div>
        </div>
      )}

      {/* Bottom Poses Selection Carousel */}
      {!capturedImage && recommendedPoses.length > 0 && (
        <div className="sticky bottom-0 bg-slate-950/90 border-t border-slate-900/60 p-4 md:p-6 backdrop-blur-md">
          <div className="max-w-7xl mx-auto w-full space-y-3">
            <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Select Pose Target Template</p>
            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
              {recommendedPoses.map((pose) => (
                <div
                  key={pose.id}
                  onClick={() => setSelectedTemplate(pose)}
                  className={`flex items-center gap-3 p-2.5 rounded-2xl border cursor-pointer flex-shrink-0 transition-all duration-300 w-56 select-none ${
                    selectedTemplate?.id === pose.id
                      ? 'border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_12px_rgba(16,185,129,0.15)] scale-[1.02]'
                      : 'border-slate-900 hover:border-slate-800 bg-slate-900/20'
                  }`}
                >
                  <div className="w-12 h-12 rounded-xl overflow-hidden border border-slate-900/60 bg-slate-950 flex-shrink-0">
                    <img src={pose.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <div className="text-left">
                    <div className="text-xs font-bold text-slate-200 line-clamp-1">{pose.name}</div>
                    <div className="text-[9px] text-slate-500">{pose.difficulty} • {pose.category}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
