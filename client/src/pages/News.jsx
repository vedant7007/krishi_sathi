import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFarm } from '../context/FarmContext';
import { getNews } from '../services/newsService';
import { translateCrop, translateSoil, translateState, formatDate, getLang } from '../utils/translate';
import {
  Newspaper,
  Loader2,
  ChevronDown,
  ChevronUp,
  Bot,
  Calendar,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const CATEGORIES = [
  'all',
  'weather',
  'market',
  'policy',
  'technology',
  'advisory',
  'schemes',
];

const CATEGORY_COLORS = {
  weather: 'badge-blue',
  market: 'badge-green',
  policy: 'badge-yellow',
  technology: 'badge bg-purple-100 text-purple-800',
  advisory: 'badge bg-primary-100 text-primary-800',
  schemes: 'badge bg-orange-100 text-orange-800',
};

function NewsCard({ article, t }) {
  const [expanded, setExpanded] = useState(false);

  const dateStr = article.publishedAt || article.date;
  const formattedDate = dateStr
    ? formatDate(dateStr, { weekday: undefined, month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  const isAi = article.isAiGenerated || article.aiGenerated;

  // Truncate content for summary if no summary field
  const summaryText =
    article.summary ||
    article.description ||
    (article.content && article.content.length > 150
      ? article.content.substring(0, 150) + '...'
      : article.content) ||
    '';

  return (
    <div className="card">
      {/* Top badges row */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {article.category && (
          <span
            className={
              CATEGORY_COLORS[article.category] || 'badge bg-gray-100 text-gray-700'
            }
          >
            {t(`news.categories.${article.category}`, article.category)}
          </span>
        )}
        {isAi && (
          <span className="badge bg-indigo-100 text-indigo-700 flex items-center gap-1">
            <Bot className="w-3 h-3" />
            {t('news.aiGenerated')}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="font-bold text-gray-900 leading-tight">{article.title}</h3>

      {/* Summary */}
      {summaryText && (
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">
          {summaryText}
        </p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
        {formattedDate && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {formattedDate}
          </span>
        )}
        {article.source && <span>{article.source}</span>}
      </div>

      {/* Expand content */}
      {article.content && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1 text-primary-800 text-sm font-semibold mt-3 min-h-touch"
          >
            {expanded ? (
              <>
                {t('common.back')}
                <ChevronUp className="w-4 h-4" />
              </>
            ) : (
              <>
                {t('news.readMore')}
                <ChevronDown className="w-4 h-4" />
              </>
            )}
          </button>

          {expanded && (
            <div className="mt-2 pt-3 border-t border-gray-100">
              <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                {article.content}
              </p>
              {article.url && (
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-primary-800 text-sm font-semibold mt-3"
                >
                  <ExternalLink className="w-4 h-4" />
                  {t('news.viewOriginal')}
                </a>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, onPageChange, t }) {
  if (totalPages <= 1) return null;

  // Build page number array with ellipsis
  const pages = [];
  const maxVisible = 5;
  let start = Math.max(1, page - Math.floor(maxVisible / 2));
  let end = Math.min(totalPages, start + maxVisible - 1);
  if (end - start + 1 < maxVisible) {
    start = Math.max(1, end - maxVisible + 1);
  }

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  return (
    <div className="flex items-center justify-center gap-1 mt-4">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed min-h-touch min-w-touch flex items-center justify-center"
        aria-label="Previous page"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {start > 1 && (
        <>
          <button
            onClick={() => onPageChange(1)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50"
          >
            1
          </button>
          {start > 2 && <span className="text-gray-400 px-1">...</span>}
        </>
      )}

      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onPageChange(p)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            p === page
              ? 'bg-primary-800 text-white'
              : 'border border-gray-200 hover:bg-gray-50 text-gray-700'
          }`}
        >
          {p}
        </button>
      ))}

      {end < totalPages && (
        <>
          {end < totalPages - 1 && <span className="text-gray-400 px-1">...</span>}
          <button
            onClick={() => onPageChange(totalPages)}
            className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50"
          >
            {totalPages}
          </button>
        </>
      )}

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed min-h-touch min-w-touch flex items-center justify-center"
        aria-label="Next page"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

export default function News() {
  const { t } = useTranslation();
  const { language } = useFarm();

  const [category, setCategory] = useState('all');
  const [articles, setArticles] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchNews = useCallback(async (pageNum, cat) => {
    setLoading(true);
    setError('');

    try {
      // lang is auto-injected by newsService for server-side translation
      const response = await getNews({
        category: cat === 'all' ? undefined : cat,
        page: pageNum,
        limit: 10,
      });

      const inner = response?.data || response;
      const newArticles = inner?.news || inner?.articles || [];
      const pagination = inner?.pagination;

      setTotalPages(
        pagination?.totalPages || (newArticles.length >= 10 ? pageNum + 1 : pageNum)
      );
      setArticles(newArticles);
    } catch (err) {
      setError(err?.response?.data?.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    setPage(1);
    fetchNews(1, category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, language]);

  const handlePageChange = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    fetchNews(newPage, category);
    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <div className="bg-gradient-to-br from-purple-700 to-purple-900 text-white px-4 pt-6 pb-8 rounded-b-3xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Newspaper className="w-6 h-6" />
          {t('news.title')}
        </h1>
      </div>

      <div className="px-4 -mt-4 space-y-4">
        {/* Category Tabs - ALL translated */}
        <div className="flex overflow-x-auto gap-2 pb-1 -mx-1 px-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors min-h-touch ${
                category === cat
                  ? 'bg-primary-800 text-white'
                  : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
              }`}
            >
              {t(`news.categories.${cat}`, cat.charAt(0).toUpperCase() + cat.slice(1))}
            </button>
          ))}
        </div>

        {error && (
          <div className="card border-red-200 bg-red-50 text-alert-red text-sm font-medium">
            {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="card space-y-3">
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-5 w-3/4" />
                <div className="skeleton h-4 w-full" />
                <div className="skeleton h-4 w-2/3" />
              </div>
            ))}
          </div>
        )}

        {/* Articles Grid */}
        {!loading && articles.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {articles.map((article, i) => (
                <NewsCard
                  key={article._id || article.id || i}
                  article={article}
                  t={t}
                />
              ))}
            </div>

            {/* Pagination with page numbers */}
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
              t={t}
            />
          </>
        )}

        {/* Empty */}
        {!loading && articles.length === 0 && !error && (
          <div className="card text-center py-12">
            <Newspaper className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              {t('news.noNews')}
            </h3>
            <p className="text-sm text-gray-500 max-w-xs mx-auto">
              {t('news.noNewsDescription')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
