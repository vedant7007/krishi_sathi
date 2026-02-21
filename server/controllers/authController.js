const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id, role) => {
  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// POST /api/auth/register
exports.register = async (req, res, next) => {
  try {
    const { name, phone, password, role, district, state, primaryCrop, soilType, landHolding, language, aadhaarNumber, location, alertPreferences, faceImage } = req.body;

    const existingUser = await User.findOne({ phone });
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'Phone number already registered' });
    }

    // Compute face encoding if faceImage provided
    let faceEncoding;
    if (faceImage) {
      try {
        const { encodeFace } = require('./webauthnController');
        faceEncoding = await encodeFace(faceImage);
      } catch { /* encoding is optional */ }
    }

    const user = await User.create({
      name, phone, password, role, district, state, primaryCrop, soilType, landHolding, language, aadhaarNumber, location, alertPreferences, faceImage,
      ...(faceEncoding ? { faceEncoding } : {}),
    });

    const token = generateToken(user._id, user.role);

    res.status(201).json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          district: user.district,
          state: user.state,
          primaryCrop: user.primaryCrop,
          soilType: user.soilType,
          landHolding: user.landHolding,
          language: user.language,
          aadhaarNumber: user.aadhaarNumber,
          location: user.location,
          alertPreferences: user.alertPreferences,
          faceImage: user.faceImage,
        },
      },
      message: 'Registration successful',
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/auth/login
exports.login = async (req, res, next) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ success: false, message: 'Please provide phone and password' });
    }

    const user = await User.findOne({ phone }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user._id, user.role);

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          district: user.district,
          state: user.state,
          primaryCrop: user.primaryCrop,
          soilType: user.soilType,
          landHolding: user.landHolding,
          language: user.language,
          aadhaarNumber: user.aadhaarNumber,
          location: user.location,
          alertPreferences: user.alertPreferences,
          faceImage: user.faceImage,
        },
      },
      message: 'Login successful',
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/auth/me
exports.getMe = async (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user._id,
        name: req.user.name,
        phone: req.user.phone,
        role: req.user.role,
        district: req.user.district,
        state: req.user.state,
        primaryCrop: req.user.primaryCrop,
        soilType: req.user.soilType,
        landHolding: req.user.landHolding,
        language: req.user.language,
        aadhaarNumber: req.user.aadhaarNumber,
        location: req.user.location,
        alertPreferences: req.user.alertPreferences,
        faceImage: req.user.faceImage,
        webauthnCredentials: (req.user.webauthnCredentials || []).map((c) => ({ credentialID: c.credentialID })),
      },
    },
  });
};

// PUT /api/auth/profile
exports.updateProfile = async (req, res, next) => {
  try {
    const allowed = ['name', 'district', 'state', 'primaryCrop', 'soilType', 'landHolding', 'language', 'alertPreferences', 'aadhaarNumber', 'location', 'faceImage'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // If faceImage is being saved, compute face encoding via Python service
    if (updates.faceImage) {
      try {
        const { encodeFace } = require('./webauthnController');
        const encoding = await encodeFace(updates.faceImage);
        if (encoding) {
          updates.faceEncoding = encoding;
          console.log(`Face encoding computed for user ${req.user._id} (${encoding.length} dims)`);
        }
      } catch (encErr) {
        console.log('Face encoding skipped:', encErr.message);
      }
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          phone: user.phone,
          role: user.role,
          district: user.district,
          state: user.state,
          primaryCrop: user.primaryCrop,
          soilType: user.soilType,
          landHolding: user.landHolding,
          language: user.language,
          aadhaarNumber: user.aadhaarNumber,
          location: user.location,
          alertPreferences: user.alertPreferences,
          faceImage: user.faceImage,
        },
      },
      message: 'Profile updated',
    });
  } catch (error) {
    next(error);
  }
};
