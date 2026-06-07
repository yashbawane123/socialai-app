import express from 'express';
import db from '../services/db.js';
import auth from '../middleware/auth.js';
import crypto from 'crypto';

const router = express.Router();

// Helper to seed pose templates if empty
const seedPoses = () => {
  try {
    const templates = db.collection('pose_templates').find().exec();
    if (templates.length === 0) {
      // 1. Gym Pose - Bicep Flex
      db.collection('pose_templates').insert({
        name: "Bicep Flex",
        category: "Gym",
        imageUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=400",
        landmarkData: {
          left_shoulder: { x: 0.35, y: 0.35 },
          right_shoulder: { x: 0.65, y: 0.35 },
          left_elbow: { x: 0.20, y: 0.25 },
          right_elbow: { x: 0.80, y: 0.25 },
          left_wrist: { x: 0.22, y: 0.12 },
          right_wrist: { x: 0.78, y: 0.12 },
          left_hip: { x: 0.40, y: 0.70 },
          right_hip: { x: 0.60, y: 0.70 }
        },
        difficulty: "Beginner"
      });

      // 2. Travel Pose - Looking Away
      db.collection('pose_templates').insert({
        name: "Looking Away",
        category: "Travel",
        imageUrl: "https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400",
        landmarkData: {
          left_shoulder: { x: 0.35, y: 0.40 },
          right_shoulder: { x: 0.65, y: 0.40 },
          left_elbow: { x: 0.30, y: 0.65 },
          right_elbow: { x: 0.70, y: 0.65 },
          left_wrist: { x: 0.30, y: 0.80 },
          right_wrist: { x: 0.70, y: 0.80 },
          left_hip: { x: 0.40, y: 0.75 },
          right_hip: { x: 0.60, y: 0.75 }
        },
        difficulty: "Beginner"
      });

      // 3. Fashion Pose - Model Lean
      db.collection('pose_templates').insert({
        name: "Model Lean",
        category: "Fashion",
        imageUrl: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=400",
        landmarkData: {
          left_shoulder: { x: 0.32, y: 0.38 },
          right_shoulder: { x: 0.68, y: 0.38 },
          left_elbow: { x: 0.25, y: 0.55 },
          right_elbow: { x: 0.78, y: 0.50 },
          left_wrist: { x: 0.32, y: 0.65 },
          right_wrist: { x: 0.78, y: 0.65 },
          left_hip: { x: 0.38, y: 0.72 },
          right_hip: { x: 0.62, y: 0.72 }
        },
        difficulty: "Intermediate"
      });

      // 4. Selfie Pose - Peace Selfie
      db.collection('pose_templates').insert({
        name: "Peace Selfie",
        category: "Selfie",
        imageUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400",
        landmarkData: {
          left_shoulder: { x: 0.25, y: 0.55 },
          right_shoulder: { x: 0.75, y: 0.55 },
          left_elbow: { x: 0.15, y: 0.75 },
          right_elbow: { x: 0.85, y: 0.40 },
          left_wrist: { x: 0.20, y: 0.90 },
          right_wrist: { x: 0.75, y: 0.20 },
          left_hip: { x: 0.35, y: 0.95 },
          right_hip: { x: 0.65, y: 0.95 }
        },
        difficulty: "Beginner"
      });

      // 5. Professional Pose - Presenter
      db.collection('pose_templates').insert({
        name: "Presenter Pose",
        category: "Professional",
        imageUrl: "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400",
        landmarkData: {
          left_shoulder: { x: 0.35, y: 0.35 },
          right_shoulder: { x: 0.65, y: 0.35 },
          left_elbow: { x: 0.25, y: 0.55 },
          right_elbow: { x: 0.80, y: 0.50 },
          left_wrist: { x: 0.30, y: 0.70 },
          right_wrist: { x: 0.90, y: 0.40 },
          left_hip: { x: 0.40, y: 0.70 },
          right_hip: { x: 0.60, y: 0.70 }
        },
        difficulty: "Intermediate"
      });

      console.log("🌱 Seeded 5 Pose Templates successfully.");
    }
  } catch (err) {
    console.error("Pose template seeding exception:", err);
  }
};

// GET all templates
router.get('/', auth, (req, res) => {
  try {
    seedPoses();
    const poses = db.collection('pose_templates').find().exec();
    res.json(poses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET recommended poses
router.get('/recommended', auth, (req, res) => {
  try {
    const { scene } = req.query;
    seedPoses();
    let poses = db.collection('pose_templates').find().exec();
    if (scene) {
      const categoryMap = {
        'gym': 'Gym',
        'beach': 'Travel',
        'street': 'Fashion',
        'mountain': 'Travel',
        'cafe': 'Casual',
        'office': 'Professional',
        'indoor': 'Selfie'
      };
      const category = categoryMap[scene.toLowerCase()];
      if (category) {
        poses = poses.filter(p => p.category === category);
      }
    }
    res.json(poses);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST analyze pose landmarks
router.post('/analyze', auth, async (req, res) => {
  try {
    const { landmarks, targetPoseId } = req.body;

    if (!landmarks) {
      return res.status(400).json({ error: 'User landmarks are required.' });
    }

    seedPoses();
    let targetPose = null;
    if (targetPoseId) {
      targetPose = db.collection('pose_templates').findOne({ id: targetPoseId });
    }

    if (!targetPose) {
      return res.json({
        poseScore: 0,
        correctionSuggestions: ['Select a target pose template.'],
        recommendedPose: null
      });
    }

    const targetLandmarks = targetPose.landmarkData;
    const userLandmarks = landmarks;

    let score = 100;
    const corrections = [];

    const jointsToCheck = [
      { name: 'Left Shoulder', uKey: 'left_shoulder', tKey: 'left_shoulder' },
      { name: 'Right Shoulder', uKey: 'right_shoulder', tKey: 'right_shoulder' },
      { name: 'Left Elbow', uKey: 'left_elbow', tKey: 'left_elbow' },
      { name: 'Right Elbow', uKey: 'right_elbow', tKey: 'right_elbow' },
      { name: 'Left Wrist', uKey: 'left_wrist', tKey: 'left_wrist' },
      { name: 'Right Wrist', uKey: 'right_wrist', tKey: 'right_wrist' }
    ];

    let totalDist = 0;
    let validJoints = 0;

    for (const joint of jointsToCheck) {
      const uPoint = userLandmarks[joint.uKey];
      const tPoint = targetLandmarks[joint.tKey];

      if (uPoint && tPoint) {
        const dx = uPoint.x - tPoint.x;
        const dy = uPoint.y - tPoint.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        totalDist += dist;
        validJoints++;

        // Direct postural guidance calculations
        if (dist > 0.12) {
          if (dy > 0.08) {
            corrections.push(`Raise your ${joint.name}`);
          } else if (dy < -0.08) {
            corrections.push(`Lower your ${joint.name}`);
          } else if (dx > 0.08) {
            corrections.push(`Move your ${joint.name} to the left`);
          } else if (dx < -0.08) {
            corrections.push(`Move your ${joint.name} to the right`);
          }
        }
      }
    }

    if (validJoints > 0) {
      const avgDist = totalDist / validJoints;
      // Closer the distance, higher the score
      score = Math.max(0, Math.min(100, Math.round(100 - (avgDist * 220))));
    }

    if (corrections.length === 0) {
      corrections.push('Excellent! Hold this pose.');
    }

    // AI recommendation rotation suggestion
    const allPoses = db.collection('pose_templates').find().exec();
    const otherPoses = allPoses.filter(p => p.id !== targetPoseId);
    const recommendedPose = otherPoses.length > 0 ? otherPoses[Math.floor(Math.random() * otherPoses.length)] : null;

    res.json({
      poseScore: score,
      correctionSuggestions: corrections.slice(0, 3),
      recommendedPose: recommendedPose ? {
        id: recommendedPose.id,
        name: recommendedPose.name,
        category: recommendedPose.category,
        previewImage: recommendedPose.imageUrl
      } : null
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
