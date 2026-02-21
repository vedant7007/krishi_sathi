const AlertLog = require('../models/AlertLog');
const User = require('../models/User');
const { broadcastAlert } = require('../utils/twilio');
const { translateBatch } = require('../utils/gemini');

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

    // Normalize channels to object format for DB storage
    let channelsObj;
    if (Array.isArray(channels)) {
      channelsObj = {
        sms: channels.includes('sms'),
        whatsapp: channels.includes('whatsapp'),
        voice: channels.includes('voice'),
      };
    } else {
      channelsObj = channels || { sms: true, whatsapp: false, voice: false };
    }

    // Create alert log
    const alert = await AlertLog.create({
      type,
      severity,
      title,
      message,
      affectedDistricts: affectedDistricts || [],
      affectedStates: affectedStates || [],
      affectedCrops: affectedCrops || [],
      channels: channelsObj,
      recipientCount,
      sentBy: req.user._id,
      status: 'pending',
    });

    // --- Twilio broadcasting ---
    // Determine which channel names to broadcast on
    // Handle both array format ['sms','whatsapp'] and object format {sms:true,whatsapp:false}
    let alertChannels = [];
    if (Array.isArray(channels)) {
      alertChannels = channels;
    } else {
      const ch = channels || { sms: true, whatsapp: false, voice: false };
      if (ch.sms) alertChannels.push('sms');
      if (ch.whatsapp) alertChannels.push('whatsapp');
      if (ch.voice) alertChannels.push('voice');
    }

    // Query for the actual user documents (phone + alertPreferences) to pass to Twilio
    const recipients = await User.find(
      conditions.length > 0 ? userFilter : {},
      'phone alertPreferences'
    ).lean();

    const broadcastResult = await broadcastAlert(
      {
        title,
        message,
        severity,
        channels: alertChannels,
      },
      recipients
    );

    // Update the persisted alert with delivery results
    alert.status = broadcastResult.failed === 0 ? 'sent' : 'partial';
    alert.deliverySummary = {
      sent: broadcastResult.sent,
      failed: broadcastResult.failed,
    };
    await alert.save();

    console.log(
      `[Emergency] Alert "${title}" broadcast complete — sent: ${broadcastResult.sent}, failed: ${broadcastResult.failed}`
    );

    res.status(201).json({
      success: true,
      data: {
        alert,
        recipientCount,
        delivery: {
          sent: broadcastResult.sent,
          failed: broadcastResult.failed,
        },
      },
      message: `Alert created and broadcast successfully. ${broadcastResult.sent} messages sent, ${broadcastResult.failed} failed.`,
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/emergency/alerts?lang=hi
exports.getAlerts = async (req, res) => {
  try {
    const { type, severity, limit, lang } = req.query;

    const filter = {};
    if (type) filter.type = type;
    if (severity) filter.severity = severity.toUpperCase();

    const limitNum = Math.min(parseInt(limit, 10) || 20, 100);

    const alerts = await AlertLog.find(filter)
      .sort({ createdAt: -1 })
      .limit(limitNum)
      .populate('sentBy', 'name phone');

    let alertsData = alerts.map((a) => (a.toObject ? a.toObject() : a));

    // Batch-translate all alerts in a SINGLE Gemini call
    if (lang && lang !== 'en' && alertsData.length > 0) {
      alertsData = await translateBatch(alertsData, ['title', 'message'], lang);
    }

    res.json({
      success: true,
      data: {
        alerts: alertsData,
        count: alertsData.length,
      },
      message: `Found ${alertsData.length} alerts`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve alerts',
    });
  }
};

// DELETE /api/emergency/alerts/:id (admin only)
exports.deleteAlert = async (req, res, next) => {
  try {
    const alert = await AlertLog.findByIdAndDelete(req.params.id);
    if (!alert) {
      return res.status(404).json({ success: false, message: 'Alert not found' });
    }
    res.json({ success: true, data: { alert }, message: 'Alert deleted successfully' });
  } catch (error) {
    next(error);
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
