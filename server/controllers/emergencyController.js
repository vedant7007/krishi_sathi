const AlertLog = require('../models/AlertLog');
const User = require('../models/User');

// POST /api/emergency/alert (admin only)
exports.createAlert = async (req, res, next) => {
  try {
    const {
      type,
      severity,
      title,
      message,
      affectedDistricts,
      affectedStates,
      affectedCrops,
      channels,
    } = req.body;

    // Validate required fields
    if (!type || !severity || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Type, severity, title, and message are required',
      });
    }

    // Build user query to find affected farmers
    const userFilter = {};
    const conditions = [];

    if (affectedDistricts && affectedDistricts.length > 0) {
      conditions.push({
        district: {
          $in: affectedDistricts.map((d) => new RegExp(d, 'i')),
        },
      });
    }

    if (affectedStates && affectedStates.length > 0) {
      conditions.push({
        state: {
          $in: affectedStates.map((s) => new RegExp(s, 'i')),
        },
      });
    }

    if (affectedCrops && affectedCrops.length > 0) {
      conditions.push({
        primaryCrop: {
          $in: affectedCrops.map((c) => c.toLowerCase()),
        },
      });
    }

    if (conditions.length > 0) {
      userFilter.$or = conditions;
    }

    // Count affected users
    const recipientCount = await User.countDocuments(
      conditions.length > 0 ? userFilter : {}
    );

    // Create alert log
    const alert = await AlertLog.create({
      type,
      severity,
      title,
      message,
      affectedDistricts: affectedDistricts || [],
      affectedStates: affectedStates || [],
      affectedCrops: affectedCrops || [],
      channels: channels || { sms: true, whatsapp: false, voice: false },
      recipientCount,
      sentBy: req.user._id,
      status: 'pending',
    });

    res.status(201).json({
      success: true,
      data: {
        alert,
        recipientCount,
      },
      message: `Alert created successfully. ${recipientCount} farmers will be notified.`,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/emergency/alerts
exports.getAlerts = async (req, res) => {
  try {
    const { type, severity, limit } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (severity) filter.severity = severity.toUpperCase();

    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

    const alerts = await AlertLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .populate('sentBy', 'name phone');

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
      },
      message: `Found ${alerts.length} alerts`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alerts',
    });
  }
};

// GET /api/emergency/stats
exports.getAlertStats = async (req, res) => {
  try {
    const [byType, bySeverity, byStatus, totalRecipients] = await Promise.all([
      AlertLog.aggregate([
        { $group: { _id: '$type', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AlertLog.aggregate([
        { $group: { _id: '$severity', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      AlertLog.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      AlertLog.aggregate([
        { $group: { _id: null, total: { $sum: '$recipientCount' } } },
      ]),
    ]);

    const totalAlerts = await AlertLog.countDocuments();

    // Recent alerts (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const recentCount = await AlertLog.countDocuments({
      createdAt: { $gte: weekAgo },
    });

    res.json({
      success: true,
      data: {
        totalAlerts,
        recentAlerts: recentCount,
        totalRecipients: totalRecipients.length > 0 ? totalRecipients[0].total : 0,
        byType: byType.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        bySeverity: bySeverity.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        byStatus: byStatus.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
      },
      message: 'Alert statistics retrieved',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alert statistics',
    });
  }
};
