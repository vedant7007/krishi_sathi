const GovernmentScheme = require('../models/GovernmentScheme');
const { translateBatch, translateJSON } = require('../utils/gemini');

// GET /api/schemes?lang=hi
exports.getSchemes = async (req, res) => {
  try {
    const { category, status, state, lang } = req.query;

    const filter = {};
    if (category) filter.category = category.toLowerCase();
    if (status) {
      filter.status = status.toLowerCase();
    } else {
      filter.status = 'active';
    }
    if (state) {
      filter.$or = [
        { 'eligibility.states': new RegExp(state, 'i') },
        { 'eligibility.states': { $size: 0 } },
        { 'eligibility.states': { $exists: false } },
      ];
    }

    const schemes = await GovernmentScheme.find(filter).sort({ createdAt: -1 });
    let schemesData = schemes.map((s) => s.toObject ? s.toObject() : s);

    // Batch-translate all schemes in a SINGLE Gemini call
    if (lang && lang !== 'en' && schemesData.length > 0) {
      schemesData = await translateBatch(schemesData, ['name', 'description', 'benefits'], lang);
    }

    res.json({
      success: true,
      data: { schemes: schemesData, count: schemesData.length },
      message: `Found ${schemesData.length} schemes`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve schemes' });
  }
};

// GET /api/schemes/:id
exports.getSchemeById = async (req, res) => {
  try {
    const scheme = await GovernmentScheme.findById(req.params.id);
    if (!scheme) {
      return res.status(404).json({ success: false, message: 'Scheme not found' });
    }
    res.json({ success: true, data: { scheme }, message: 'Scheme retrieved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve scheme' });
  }
};

// POST /api/schemes/:id/eligibility
exports.checkEligibility = async (req, res) => {
  try {
    const scheme = await GovernmentScheme.findById(req.params.id);
    if (!scheme) {
      return res.status(404).json({ success: false, message: 'Scheme not found' });
    }

    const { landHolding, crop, state, category, lang } = req.body;
    const reasons = [];
    let eligible = true;
    const elig = scheme.eligibility || {};

    if (elig.landHoldingMax != null && landHolding != null) {
      if (landHolding > elig.landHoldingMax) {
        eligible = false;
        reasons.push(`Land holding (${landHolding} acres) exceeds maximum limit of ${elig.landHoldingMax} acres`);
      } else {
        reasons.push(`Land holding (${landHolding} acres) is within the ${elig.landHoldingMax} acre limit`);
      }
    }

    if (elig.landHoldingMin != null && landHolding != null) {
      if (landHolding < elig.landHoldingMin) {
        eligible = false;
        reasons.push(`Land holding (${landHolding} acres) is below minimum requirement of ${elig.landHoldingMin} acres`);
      } else {
        reasons.push(`Land holding (${landHolding} acres) meets the minimum ${elig.landHoldingMin} acre requirement`);
      }
    }

    if (elig.crops && elig.crops.length > 0 && crop) {
      const cropLower = crop.toLowerCase();
      const cropMatch = elig.crops.some((c) => c.toLowerCase() === cropLower);
      if (!cropMatch) {
        eligible = false;
        reasons.push(`Crop "${crop}" is not eligible. Eligible crops: ${elig.crops.join(', ')}`);
      } else {
        reasons.push(`Crop "${crop}" is eligible under this scheme`);
      }
    }

    if (elig.states && elig.states.length > 0 && state) {
      const stateMatch = elig.states.some((s) => s.toLowerCase() === state.toLowerCase());
      if (!stateMatch) {
        eligible = false;
        reasons.push(`State "${state}" is not covered. Covered states: ${elig.states.join(', ')}`);
      } else {
        reasons.push(`State "${state}" is covered under this scheme`);
      }
    }

    if (elig.categories && elig.categories.length > 0 && category) {
      const hasAll = elig.categories.includes('all');
      const categoryMatch = hasAll || elig.categories.some((c) => c.toLowerCase() === category.toLowerCase());
      if (!categoryMatch) {
        eligible = false;
        reasons.push(`Category "${category}" is not eligible. Eligible categories: ${elig.categories.join(', ')}`);
      } else {
        reasons.push(`Category "${category}" is eligible`);
      }
    }

    let finalReasons = reasons;
    if (lang && lang !== 'en' && reasons.length > 0) {
      try {
        const translated = await translateJSON(reasons, lang);
        if (Array.isArray(translated)) finalReasons = translated;
      } catch (err) {
        console.error('Eligibility translation error:', err.message);
      }
    }

    res.json({
      success: true,
      data: {
        eligible,
        reasons: finalReasons,
        scheme: {
          id: scheme._id,
          name: scheme.name,
          shortName: scheme.shortName,
          documents: scheme.documents,
          applicationUrl: scheme.applicationUrl,
          deadline: scheme.deadline,
        },
      },
      message: eligible ? 'You are eligible for this scheme!' : 'You are not eligible for this scheme',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to check eligibility' });
  }
};
