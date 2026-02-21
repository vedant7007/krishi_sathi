const jwt = require('jsonwebtoken');
const User = require('../models/User');

// In-memory challenge store (userId/sessionId → challenge)
const challengeStore = new Map();

const generateToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '7d' });

// Helper to build user response object
const userResponse = (u) => ({
  id: u._id,
  name: u.name,
  phone: u.phone,
  role: u.role,
  district: u.district,
  state: u.state,
  primaryCrop: u.primaryCrop,
  soilType: u.soilType,
  landHolding: u.landHolding,
  language: u.language,
  aadhaarNumber: u.aadhaarNumber,
  location: u.location,
  alertPreferences: u.alertPreferences,
  faceImage: u.faceImage,
});

// Detect RP ID and origin from request
function getRpConfig(req) {
  const origin = req.headers.origin || `${req.protocol}://${req.headers.host}`;
  // For localhost dev: rpID should be 'localhost'
  let rpID = req.headers.host?.split(':')[0] || 'localhost';
  return { rpID, rpName: 'KrishiSathi', origin };
}

// ─── WebAuthn Registration (authenticated user sets up biometric) ───

exports.registerOptions = async (req, res, next) => {
  try {
    const { generateRegistrationOptions } = await import('@simplewebauthn/server');
    const user = req.user;
    const { rpID, rpName } = getRpConfig(req);

    const existingCreds = (user.webauthnCredentials || []).map((c) => ({
      id: c.credentialID,
      transports: c.transports,
    }));

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userName: user.phone,
      userDisplayName: user.name,
      attestationType: 'none',
      excludeCredentials: existingCreds,
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    // Store challenge for verification
    challengeStore.set(user._id.toString(), options.challenge);
    setTimeout(() => challengeStore.delete(user._id.toString()), 5 * 60 * 1000);

    res.json({ success: true, data: options });
  } catch (error) {
    next(error);
  }
};

exports.registerVerify = async (req, res, next) => {
  try {
    const { verifyRegistrationResponse } = await import('@simplewebauthn/server');
    const user = req.user;
    const { rpID, origin } = getRpConfig(req);
    const expectedChallenge = challengeStore.get(user._id.toString());

    if (!expectedChallenge) {
      return res.status(400).json({ success: false, message: 'Challenge expired, try again' });
    }

    const verification = await verifyRegistrationResponse({
      response: req.body,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });

    if (!verification.verified || !verification.registrationInfo) {
      return res.status(400).json({ success: false, message: 'Verification failed' });
    }

    const { credential } = verification.registrationInfo;

    // Save credential to user
    user.webauthnCredentials.push({
      credentialID: credential.id,
      credentialPublicKey: Buffer.from(credential.publicKey).toString('base64'),
      counter: credential.counter,
      transports: req.body.response?.transports || [],
    });
    await user.save();

    challengeStore.delete(user._id.toString());

    res.json({ success: true, message: 'Biometric registered successfully' });
  } catch (error) {
    next(error);
  }
};

// ─── WebAuthn Authentication (passwordless login with biometric) ───

exports.loginOptions = async (req, res, next) => {
  try {
    const { generateAuthenticationOptions } = await import('@simplewebauthn/server');
    const { rpID } = getRpConfig(req);

    const options = await generateAuthenticationOptions({
      rpID,
      userVerification: 'preferred',
      // Empty allowCredentials = discoverable credential (resident key)
    });

    // Store challenge with a session key
    const sessionKey = `login_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    challengeStore.set(sessionKey, options.challenge);
    setTimeout(() => challengeStore.delete(sessionKey), 5 * 60 * 1000);

    res.json({ success: true, data: { ...options, sessionKey } });
  } catch (error) {
    next(error);
  }
};

exports.loginVerify = async (req, res, next) => {
  try {
    const { verifyAuthenticationResponse } = await import('@simplewebauthn/server');
    const { sessionKey, ...authResponse } = req.body;
    const { rpID, origin } = getRpConfig(req);

    const expectedChallenge = challengeStore.get(sessionKey);
    if (!expectedChallenge) {
      return res.status(400).json({ success: false, message: 'Challenge expired, try again' });
    }

    // Find user by credential ID
    const credentialID = authResponse.id;
    const user = await User.findOne({ 'webauthnCredentials.credentialID': credentialID });
    if (!user) {
      return res.status(401).json({ success: false, message: 'No account found for this biometric' });
    }

    const storedCred = user.webauthnCredentials.find((c) => c.credentialID === credentialID);

    const verification = await verifyAuthenticationResponse({
      response: authResponse,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: storedCred.credentialID,
        publicKey: new Uint8Array(Buffer.from(storedCred.credentialPublicKey, 'base64')),
        counter: storedCred.counter,
        transports: storedCred.transports,
      },
    });

    if (!verification.verified) {
      return res.status(401).json({ success: false, message: 'Biometric verification failed' });
    }

    // Update counter
    storedCred.counter = verification.authenticationInfo.newCounter;
    await user.save();

    challengeStore.delete(sessionKey);

    const token = generateToken(user._id, user.role);
    res.json({
      success: true,
      data: { token, user: userResponse(user) },
      message: 'Biometric login successful',
    });
  } catch (error) {
    next(error);
  }
};

// ─── Python Face Service helper ───

const FACE_SERVICE_URL = process.env.FACE_SERVICE_URL || 'http://localhost:5001';

async function callFaceService(endpoint, body) {
  // Dynamic import for fetch (Node 18+ has global fetch)
  const res = await fetch(`${FACE_SERVICE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── Encode face (called when user saves profile with faceImage) ───

exports.encodeFace = async (faceImage) => {
  try {
    const result = await callFaceService('/encode', { image: faceImage });
    if (result.success) return result.encoding;
    console.log('Face encode failed:', result.message);
    return null;
  } catch (err) {
    console.error('Face service /encode error:', err.message);
    return null;
  }
};

// ─── Face Login (OpenCV + DeepFace via Python service) ───

exports.faceLogin = async (req, res, next) => {
  try {
    const { faceImage } = req.body;

    if (!faceImage) {
      return res.status(400).json({ success: false, message: 'Face image is required' });
    }

    // Get all users who have stored face encodings
    const usersWithEncoding = await User.find({
      faceEncoding: { $exists: true, $not: { $size: 0 } },
    }).select('+faceEncoding');

    if (usersWithEncoding.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No registered faces found. Please register your face in Profile first.',
      });
    }

    // Build stored encodings array for Python service
    const stored = usersWithEncoding.map((u) => ({
      userId: u._id.toString(),
      name: u.name,
      encoding: u.faceEncoding,
    }));

    // Call Python face service to match
    const matchResult = await callFaceService('/match', {
      captured: faceImage,
      stored,
    });

    if (matchResult.success && matchResult.match) {
      const matchedUser = usersWithEncoding.find(
        (u) => u._id.toString() === matchResult.match.userId
      );

      if (matchedUser) {
        const token = generateToken(matchedUser._id, matchedUser.role);
        return res.json({
          success: true,
          data: { token, user: userResponse(matchedUser) },
          message: `Welcome back, ${matchedUser.name}!`,
          confidence: matchResult.match.confidence,
        });
      }
    }

    res.status(401).json({
      success: false,
      message: matchResult.message || 'Face not recognized. Please try again or use phone login.',
    });
  } catch (error) {
    console.error('Face login error:', error.message);
    // If Python service is down, give helpful error
    if (error.cause?.code === 'ECONNREFUSED') {
      return res.status(503).json({
        success: false,
        message: 'Face recognition service is not running. Try biometric or phone login.',
      });
    }
    next(error);
  }
};
