const express = require('express');
const router = express.Router();
const { getSchemes, getSchemeById, checkEligibility } = require('../controllers/schemesController');
const { protect } = require('../middleware/auth');

router.get('/', getSchemes);
router.get('/:id', getSchemeById);
router.post('/:id/eligibility', protect, checkEligibility);

module.exports = router;
