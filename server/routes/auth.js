const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile } = require('../controllers/authController');
const { registerOptions, registerVerify, loginOptions, loginVerify, faceLogin } = require('../controllers/webauthnController');
const { protect } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/profile', protect, updateProfile);

// WebAuthn biometric routes
router.post('/webauthn/register-options', protect, registerOptions);
router.post('/webauthn/register-verify', protect, registerVerify);
router.post('/webauthn/login-options', loginOptions);
router.post('/webauthn/login-verify', loginVerify);

// Face login
router.post('/face-login', faceLogin);

module.exports = router;
