const News = require('../models/News');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { translateBatch } = require('../utils/gemini');

// GET /api/news?category=market&lang=hi&page=1&limit=10
exports.getNews = async (req, res) => {
  try {
    const { category, page, limit, region, lang } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = Math.min(parseInt(limit, 10) || 10, 50);
    const skip = (pageNum - 1) * limitNum;

    const filter = {};
    if (category) filter.category = category.toLowerCase();
    if (region) filter.region = new RegExp(region, 'i');

    const [news, total] = await Promise.all([
      News.find(filter)
        .sort({ publishedAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .select('title summary content category source imageUrl language tags region publishedAt isAiGenerated'),
      News.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(total / limitNum);
    let newsData = news.map((n) => n.toObject ? n.toObject() : n);

    // Batch-translate all articles in a SINGLE Gemini call
    if (lang && lang !== 'en' && newsData.length > 0) {
      newsData = await translateBatch(newsData, ['title', 'summary', 'content'], lang);
    }

    res.json({
      success: true,
      data: {
        news: newsData,
        pagination: { page: pageNum, limit: limitNum, total, totalPages, hasNextPage: pageNum < totalPages, hasPrevPage: pageNum > 1 },
      },
      message: `Found ${newsData.length} news articles`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve news' });
  }
};

// GET /api/news/:id
exports.getNewsById = async (req, res) => {
  try {
    const article = await News.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ success: false, message: 'News article not found' });
    }
    res.json({ success: true, data: { article }, message: 'News article retrieved successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve news article' });
  }
};

// POST /api/news/generate — AI news generation via Gemini
exports.generateAiNews = async (req, res) => {
  try {
    const { category = 'advisory', language = 'en', topic } = req.body;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({ success: false, message: 'Gemini API key not configured' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const langMap = { en: 'English', hi: 'Hindi', te: 'Telugu' };
    const langName = langMap[language] || 'English';

    const prompt = `Write a short Indian agriculture news article in ${langName} about ${topic || category}.
Category: ${category}
Requirements:
- Title (one line)
- Summary (one line)
- Content (2-3 paragraphs, informative for Indian farmers)
- 3-5 relevant tags

Respond in this exact JSON format:
{"title": "...", "summary": "...", "content": "...", "tags": ["...", "..."]}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ success: false, message: 'Failed to parse AI response' });
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const article = await News.create({
      title: parsed.title,
      content: parsed.content,
      summary: parsed.summary,
      category,
      source: 'KrishiSathi AI (Gemini)',
      language,
      isAiGenerated: true,
      tags: parsed.tags || [],
      region: 'India',
      publishedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      data: { article },
      message: 'AI news article generated successfully',
    });
  } catch (error) {
    console.error('Gemini news generation error:', error.message);
    res.status(500).json({ success: false, message: 'Failed to generate AI news' });
  }
};
