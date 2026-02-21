const CropRule = require('../models/CropRule');
const MarketPrice = require('../models/MarketPrice');
const GovernmentScheme = require('../models/GovernmentScheme');
const News = require('../models/News');
const User = require('../models/User');
const AlertLog = require('../models/AlertLog');

// ==================== CropRule CRUD ====================

// GET /api/admin/crop-rules
exports.getCropRules = async (req, res) => {
  try {
    const { crop, soilType, season } = req.query;

    const filter = {};
    if (crop) filter.crop = crop.toLowerCase();
    if (soilType) filter.soilType = soilType.toLowerCase();
    if (season) filter.season = season.toLowerCase();

    const cropRules = await CropRule.find(filter).sort({ crop: 1, soilType: 1 });

    res.json({
      success: true,
      data: {
        cropRules,
        count: cropRules.length,
      },
      message: `Found ${cropRules.length} crop rules`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve crop rules',
    });
  }
};

// POST /api/admin/crop-rules
exports.createCropRule = async (req, res, next) => {
  try {
    const {
      crop, soilType, season, region,
      fertilizer, irrigation, pest, sowing, harvest, msp,
    } = req.body;

    if (!crop) {
      return res.status(400).json({
        success: false,
        message: 'Crop is required',
      });
    }

    // Check for duplicate
    const existing = await CropRule.findOne({
      crop: crop.toLowerCase(),
      soilType: soilType || 'any',
      season: season || 'any',
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: `Crop rule already exists for ${crop} with soilType=${soilType || 'any'} and season=${season || 'any'}`,
      });
    }

    const cropRule = await CropRule.create({
      crop: crop.toLowerCase(),
      soilType: soilType || 'any',
      season: season || 'any',
      region: region || 'any',
      fertilizer,
      irrigation,
      pest,
      sowing,
      harvest,
      msp,
    });

    res.status(201).json({
      success: true,
      data: { cropRule },
      message: 'Crop rule created successfully',
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/crop-rules/:id
exports.updateCropRule = async (req, res, next) => {
  try {
    const cropRule = await CropRule.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!cropRule) {
      return res.status(404).json({
        success: false,
        message: 'Crop rule not found',
      });
    }

    res.json({
      success: true,
      data: { cropRule },
      message: 'Crop rule updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/crop-rules/:id
exports.deleteCropRule = async (req, res, next) => {
  try {
    const cropRule = await CropRule.findByIdAndDelete(req.params.id);

    if (!cropRule) {
      return res.status(404).json({
        success: false,
        message: 'Crop rule not found',
      });
    }

    res.json({
      success: true,
      data: { cropRule },
      message: 'Crop rule deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ==================== MarketPrice CRUD ====================

// GET /api/admin/market-prices
exports.getMarketPrices = async (req, res) => {
  try {
    const { crop, state, mandi, limit } = req.query;

    const filter = {};
    if (crop) filter.crop = crop.toLowerCase();
    if (state) filter.state = new RegExp(state, 'i');
    if (mandi) filter.mandi = new RegExp(mandi, 'i');

    const limitNum = Math.min(parseInt(limit, 10) || 50, 500);

    const prices = await MarketPrice.find(filter)
      .sort({ date: -1 })
      .limit(limitNum);

    res.json({
      success: true,
      data: {
        prices,
        count: prices.length,
      },
      message: `Found ${prices.length} market prices`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve market prices',
    });
  }
};

// POST /api/admin/market-prices
exports.createMarketPrice = async (req, res, next) => {
  try {
    const { crop, mandi, state, district, price, minPrice, maxPrice, unit, date, source } = req.body;

    if (!crop || !mandi || !price || !date) {
      return res.status(400).json({
        success: false,
        message: 'Crop, mandi, price, and date are required',
      });
    }

    const marketPrice = await MarketPrice.create({
      crop: crop.toLowerCase(),
      mandi,
      state,
      district,
      price,
      minPrice: minPrice || price,
      maxPrice: maxPrice || price,
      unit: unit || '₹/quintal',
      date: new Date(date),
      source: source || 'manual',
    });

    res.status(201).json({
      success: true,
      data: { marketPrice },
      message: 'Market price entry created successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ==================== GovernmentScheme CRUD ====================

// POST /api/admin/schemes
exports.createScheme = async (req, res, next) => {
  try {
    const {
      name, shortName, description, benefits, eligibility,
      documents, applicationUrl, deadline, status, ministry, category,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: 'Scheme name is required',
      });
    }

    const scheme = await GovernmentScheme.create({
      name,
      shortName,
      description,
      benefits,
      eligibility,
      documents,
      applicationUrl,
      deadline: deadline ? new Date(deadline) : undefined,
      status: status || 'active',
      ministry,
      category,
    });

    res.status(201).json({
      success: true,
      data: { scheme },
      message: 'Government scheme created successfully',
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/schemes/:id
exports.updateScheme = async (req, res, next) => {
  try {
    const scheme = await GovernmentScheme.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Government scheme not found',
      });
    }

    res.json({
      success: true,
      data: { scheme },
      message: 'Government scheme updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/schemes/:id
exports.deleteScheme = async (req, res, next) => {
  try {
    const scheme = await GovernmentScheme.findByIdAndDelete(req.params.id);

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Government scheme not found',
      });
    }

    res.json({
      success: true,
      data: { scheme },
      message: 'Government scheme deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ==================== News CRUD ====================

// POST /api/admin/news
exports.createNews = async (req, res, next) => {
  try {
    const {
      title, content, summary, category, source,
      imageUrl, language, isAiGenerated, tags, region,
    } = req.body;

    if (!title || !content || !category) {
      return res.status(400).json({
        success: false,
        message: 'Title, content, and category are required',
      });
    }

    const article = await News.create({
      title,
      content,
      summary,
      category,
      source,
      imageUrl,
      language: language || 'en',
      isAiGenerated: isAiGenerated || false,
      tags: tags || [],
      region,
      publishedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      data: { article },
      message: 'News article created successfully',
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/news/:id
exports.updateNews = async (req, res, next) => {
  try {
    const article = await News.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'News article not found',
      });
    }

    res.json({
      success: true,
      data: { article },
      message: 'News article updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/admin/news/:id
exports.deleteNews = async (req, res, next) => {
  try {
    const article = await News.findByIdAndDelete(req.params.id);

    if (!article) {
      return res.status(404).json({
        success: false,
        message: 'News article not found',
      });
    }

    res.json({
      success: true,
      data: { article },
      message: 'News article deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};

// ==================== User Management ====================

// GET /api/admin/users
exports.getUsers = async (req, res) => {
  try {
    const { search, role } = req.query;
    const filter = {};
    if (search) {
      const regex = new RegExp(search, 'i');
      filter.$or = [{ name: regex }, { phone: regex }];
    }
    if (role) filter.role = role;

    const users = await User.find(filter)
      .select('-password -faceEncoding -webauthnCredentials')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { users, count: users.length },
      message: `Found ${users.length} users`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve users' });
  }
};

// DELETE /api/admin/users/:id
exports.deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: { user }, message: 'User deleted successfully' });
  } catch (error) {
    next(error);
  }
};

// PUT /api/admin/users/:id/role
exports.updateUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['farmer', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role must be farmer or admin' });
    }
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'Cannot change your own role' });
    }
    const user = await User.findByIdAndUpdate(
      req.params.id, { role }, { new: true, runValidators: true }
    ).select('-password -faceEncoding -webauthnCredentials');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.json({ success: true, data: { user }, message: `User role updated to ${role}` });
  } catch (error) {
    next(error);
  }
};

// ==================== Missing GET endpoints ====================

// GET /api/admin/schemes
exports.getAdminSchemes = async (req, res) => {
  try {
    const schemes = await GovernmentScheme.find().sort({ createdAt: -1 });
    res.json({ success: true, data: { schemes, count: schemes.length }, message: `Found ${schemes.length} schemes` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve schemes' });
  }
};

// GET /api/admin/news
exports.getAdminNews = async (req, res) => {
  try {
    const news = await News.find().sort({ createdAt: -1 });
    res.json({ success: true, data: { news, count: news.length }, message: `Found ${news.length} news articles` });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve news' });
  }
};

// ==================== Dashboard Stats ====================

// GET /api/admin/stats
exports.getDashboardStats = async (req, res) => {
  try {
    const [
      userCount,
      farmerCount,
      adminCount,
      cropRuleCount,
      priceCount,
      schemeCount,
      activeSchemeCount,
      newsCount,
      alertCount,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'farmer' }),
      User.countDocuments({ role: 'admin' }),
      CropRule.countDocuments(),
      MarketPrice.countDocuments(),
      GovernmentScheme.countDocuments(),
      GovernmentScheme.countDocuments({ status: 'active' }),
      News.countDocuments(),
      AlertLog.countDocuments(),
    ]);

    // Recent activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [recentUsers, recentAlerts, recentNews] = await Promise.all([
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      AlertLog.countDocuments({ createdAt: { $gte: weekAgo } }),
      News.countDocuments({ createdAt: { $gte: weekAgo } }),
    ]);

    res.json({
      success: true,
      data: {
        users: {
          total: userCount,
          farmers: farmerCount,
          admins: adminCount,
          newThisWeek: recentUsers,
        },
        cropRules: cropRuleCount,
        marketPrices: priceCount,
        schemes: {
          total: schemeCount,
          active: activeSchemeCount,
        },
        news: {
          total: newsCount,
          newThisWeek: recentNews,
        },
        alerts: {
          total: alertCount,
          newThisWeek: recentAlerts,
        },
      },
      message: 'Dashboard statistics retrieved',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard statistics',
    });
  }
};
