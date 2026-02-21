const Notification = require('../models/Notification');
const User = require('../models/User');
const MarketPrice = require('../models/MarketPrice');
const WeatherCache = require('../models/WeatherCache');
const GovernmentScheme = require('../models/GovernmentScheme');

// GET /api/notifications
exports.getNotifications = async (req, res, next) => {
  try {
    const { unreadOnly, type, page, limit } = req.query;
    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const filter = { userId: req.user._id };
    if (unreadOnly === 'true') {
      filter.read = false;
    }
    if (type && type !== 'all') {
      // Map short filter keys to notification types
      const typeMap = {
        weather: 'weather_alert',
        price: 'price_alert',
        scheme: 'scheme_update',
        emergency: 'emergency',
        crop_advisory: 'crop_advisory',
      };
      filter.type = typeMap[type] || type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: req.user._id, read: false }),
    ]);

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount,
        total,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/notifications/unread-count
exports.getUnreadCount = async (req, res, next) => {
  try {
    const unreadCount = await Notification.countDocuments({
      userId: req.user._id,
      read: false,
    });

    res.json({
      success: true,
      data: { unreadCount },
    });
  } catch (error) {
    next(error);
  }
};

// PUT /api/notifications/:id/read
exports.markAsRead = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    notification.read = true;
    await notification.save();

    res.json({ success: true, data: { notification } });
  } catch (error) {
    next(error);
  }
};

// PUT /api/notifications/read-all
exports.markAllAsRead = async (req, res, next) => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user._id, read: false },
      { $set: { read: true } }
    );

    res.json({
      success: true,
      data: { modifiedCount: result.modifiedCount },
    });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/notifications/:id
exports.deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (notification.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await notification.deleteOne();

    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// POST /api/notifications
// Admin only - create notification for a specific user or broadcast
exports.createNotification = async (req, res, next) => {
  try {
    const { userId, type, title, message, data, priority } = req.body;

    if (!type || !title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Type, title, and message are required',
      });
    }

    // Broadcast to all users if no userId
    if (!userId) {
      const users = await User.find({}).select('_id').lean();

      const notificationsToCreate = users.map((user) => ({
        userId: user._id,
        type,
        title,
        message,
        data: data || {},
        priority: priority || 'medium',
      }));

      const notifications = await Notification.insertMany(notificationsToCreate);

      return res.status(201).json({
        success: true,
        data: { count: notifications.length },
      });
    }

    const notification = await Notification.create({
      userId,
      type,
      title,
      message,
      data: data || {},
      priority: priority || 'medium',
    });

    res.status(201).json({
      success: true,
      data: { notification },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/notifications/generate
// Generate smart notifications with i18n keys for multilingual support
exports.generateSmartNotifications = async (req, res, next) => {
  try {
    const user = req.user;
    const created = [];

    // --- 1. Price Alert ---
    if (user.primaryCrop) {
      try {
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

        const recentPrice = await MarketPrice.findOne({
          crop: user.primaryCrop,
          date: { $gte: twentyFourHoursAgo },
        }).sort({ date: -1 }).lean();

        const previousPrice = await MarketPrice.findOne({
          crop: user.primaryCrop,
          date: { $gte: fortyEightHoursAgo, $lt: twentyFourHoursAgo },
        }).sort({ date: -1 }).lean();

        if (recentPrice && previousPrice && previousPrice.price > 0) {
          const pct = ((recentPrice.price - previousPrice.price) / previousPrice.price) * 100;

          if (pct > 5) {
            const notification = await Notification.create({
              userId: user._id,
              type: 'price_alert',
              title: `Price surge for ${user.primaryCrop}`,
              message: `${user.primaryCrop} price increased by ${pct.toFixed(1)}% at ${recentPrice.mandi}. Current: ₹${recentPrice.price}/quintal.`,
              data: {
                tKey: 'notif.priceSurgeTitle',
                mKey: 'notif.priceSurgeMsg',
                crop: user.primaryCrop,
                percent: pct.toFixed(1),
                mandi: recentPrice.mandi || 'local',
                price: recentPrice.price,
              },
              priority: pct > 15 ? 'high' : 'medium',
            });
            created.push(notification);
          }
        }
      } catch (err) {
        console.error('Price alert error:', err.message);
      }
    }

    // --- 2. Weather Alert ---
    if (user.location && user.location.address) {
      try {
        const locationKey = user.location.address.toLowerCase().trim();
        const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);

        const weatherCache = await WeatherCache.findOne({
          location: locationKey,
          fetchedAt: { $gte: threeHoursAgo },
        }).sort({ fetchedAt: -1 }).lean();

        if (weatherCache) {
          const current = weatherCache.current || {};
          const isExtreme =
            (current.rainfall && current.rainfall > 20) ||
            (current.windSpeed && current.windSpeed > 50) ||
            (current.temp && (current.temp > 45 || current.temp < 5));

          const forecast = weatherCache.forecast || [];
          const next2Days = forecast.slice(0, 2);
          const rainExpected = next2Days.some(
            (day) => day.rainProbability > 60 || day.rainfall > 10
          );

          if (isExtreme || rainExpected) {
            const loc = user.location.address;
            const notification = await Notification.create({
              userId: user._id,
              type: 'weather_alert',
              title: isExtreme ? 'Extreme weather warning' : 'Rain forecast alert',
              message: isExtreme
                ? `Extreme weather at ${loc}: ${current.temp}°C, rainfall ${current.rainfall || 0}mm.`
                : `Rain expected near ${loc} in next 2 days. Plan field activities accordingly.`,
              data: {
                tKey: isExtreme ? 'notif.extremeWeatherTitle' : 'notif.rainForecastTitle',
                mKey: isExtreme ? 'notif.extremeWeatherMsg' : 'notif.rainForecastMsg',
                location: loc,
                temp: current.temp,
                rainfall: current.rainfall || 0,
              },
              priority: isExtreme ? 'critical' : 'high',
            });
            created.push(notification);
          }
        }
      } catch (err) {
        console.error('Weather alert error:', err.message);
      }
    }

    // --- 3. Scheme Deadline ---
    try {
      const now = new Date();
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const expiringSchemes = await GovernmentScheme.find({
        status: 'active',
        deadline: { $gte: now, $lte: sevenDaysFromNow },
      }).lean();

      for (const scheme of expiringSchemes) {
        const isStateOk =
          !scheme.eligibility?.states?.length ||
          (user.state && scheme.eligibility.states.some(
            (s) => s.toLowerCase() === user.state.toLowerCase()
          ));

        const isCropOk =
          !scheme.eligibility?.crops?.length ||
          (user.primaryCrop && scheme.eligibility.crops.some(
            (c) => c.toLowerCase() === user.primaryCrop.toLowerCase()
          ));

        if (isStateOk && isCropOk) {
          const daysLeft = Math.ceil((scheme.deadline - now) / 86400000);

          const notification = await Notification.create({
            userId: user._id,
            type: 'scheme_update',
            title: `Scheme deadline: ${scheme.name}`,
            message: `"${scheme.name}" deadline in ${daysLeft} days. Apply now!`,
            data: {
              tKey: 'notif.schemeDeadlineTitle',
              mKey: 'notif.schemeDeadlineMsg',
              scheme: scheme.name,
              days: daysLeft,
            },
            priority: daysLeft <= 2 ? 'high' : 'medium',
          });
          created.push(notification);
        }
      }
    } catch (err) {
      console.error('Scheme notification error:', err.message);
    }

    res.status(201).json({
      success: true,
      data: { count: created.length },
    });
  } catch (error) {
    next(error);
  }
};
