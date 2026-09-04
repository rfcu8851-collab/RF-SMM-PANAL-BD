import React, { useState, useEffect, useRef } from 'react';
import { AnnouncementSlide } from './AnnouncementPopupModal';

interface HomePromoBannerProps {
  customSlides?: AnnouncementSlide[];
  onNavigateTab?: (tab: 'home' | 'orders' | 'funds' | 'profile' | 'admin') => void;
  onOpenReferral?: () => void;
  onOpenServicesModal?: () => void;
  onActionClick?: (url?: string) => void;
  userReferralCode?: string;
}

export const HomePromoBanner: React.FC<HomePromoBannerProps> = ({
  customSlides,
  onNavigateTab,
  onOpenReferral,
  onOpenServicesModal,
  onActionClick,
  userReferralCode,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Default rich promotional slides for RF SMM PANEL
  const defaultSlides: AnnouncementSlide[] = [
    {
      id: 'home-promo-1',
      badge: '🔥 SPECIAL OFFER',
      title: 'RF SMM PANEL — বাংলাদেশের বিশ্বস্ত সোশ্যাল মিডিয়া মার্কেটিং',
      message: 'ফেসবুক ফলোয়ার, লাইক, ইউটিউব ওয়াচটাইম, টিকটক ভিউ ও টেলিগ্রাম মেম্বার নিন সর্বোচ্চ স্পিড ও সাশ্রয়ী মূল্যে!',
      actionText: 'নতুন অর্ডার দিন 🛒',
      actionUrl: '#order-form',
      theme: 'amber',
    },
    {
      id: 'home-promo-2',
      badge: '⚡ INSTANT DEPOSIT',
      title: '২৪/৭ অটো ডিপোজিট — বিকাশ, নগদ ও রকেটে সেকেন্ডে ব্যালেন্স',
      message: 'অটোমেটিক পেমেন্ট ভেরিফিকেশন সিস্টেম। কোনো অপেক্ষা ছাড়াই ডিপোজিট করুন আর সাথে সাথে ব্যালেন্স যোগ করে সার্ভিস নিন!',
      actionText: 'ডিপোজিট করুন 💰',
      actionUrl: '#deposit',
      theme: 'emerald',
    },
    {
      id: 'home-promo-3',
      badge: '🎁 5% CASHBACK',
      title: 'বন্ধুদের রেফার করুন আর প্রতি ডিপোজিটে পান ৫% লাইফটাইম কমিশন!',
      message: 'আপনার রেফারেল লিংক শেয়ার করে ঘরে বসেই আনলিমিটেড ইনকাম করুন। রেফার করা বন্ধু ডিপোজিট করলেই ৫% সরাসরি মূল ব্যালেন্সে জমা হবে।',
      actionText: 'রেফারেল লিংক নিন 👥',
      actionUrl: '#referral',
      theme: 'purple',
    },
    {
      id: 'home-promo-4',
      badge: '📢 24/7 LIVE SUPPORT',
      title: 'অফিসিয়াল টেলিগ্রাম চ্যানেল ও ডেডিকেটেড হেল্পলাইন',
      message: 'সকল আপডেট, স্পেশাল ডিসকাউন্ট কোপন ও যেকোনো সমস্যায় সার্বক্ষণিক সাপোর্ট পেতে আমাদের অফিসিয়াল চ্যানেলে যুক্ত থাকুন।',
      actionText: 'টেলিগ্রামে জয়েন করুন ⚡',
      actionUrl: 'https://t.me/RF2_SMM',
      theme: 'blue',
    },
  ];

  // Merge admin custom slides (prioritizing custom slides with posters/custom announcements)
  const slides: AnnouncementSlide[] = React.useMemo(() => {
    if (customSlides && customSlides.length > 0) {
      // If admin configured custom slides, display them, or merge with default if only 1 slide
      if (customSlides.length >= 2) {
        return customSlides;
      }
      return [...customSlides, ...defaultSlides.slice(1)];
    }
    return defaultSlides;
  }, [customSlides]);

  // Autoplay slider (4.5s interval)
  useEffect(() => {
    if (slides.length <= 1 || isPaused) return;

    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, 4500);

    return () => clearInterval(timer);
  }, [slides.length, isPaused]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 40;
    const isRightSwipe = distance < -40;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleAction = (url?: string) => {
    if (!url) return;

    if (url === '#order-form') {
      const el = document.getElementById('order-form');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
      return;
    }

    if (url === '#deposit' || url === '#funds') {
      if (onNavigateTab) onNavigateTab('funds');
      return;
    }

    if (url === '#referral') {
      if (onOpenReferral) onOpenReferral();
      return;
    }

    if (url === '#services') {
      if (onOpenServicesModal) onOpenServicesModal();
      return;
    }

    if (onActionClick) {
      onActionClick(url);
    } else if (url.startsWith('http')) {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const currentSlide = slides[currentIndex] || slides[0];
  const theme = currentSlide?.theme || 'amber';

  // Theme styling helpers
  const themeGradients = {
    amber: 'from-amber-950/90 via-slate-900/95 to-yellow-950/80 border-amber-500/40 shadow-amber-500/10',
    blue: 'from-sky-950/90 via-slate-900/95 to-blue-950/80 border-sky-500/40 shadow-sky-500/10',
    emerald: 'from-emerald-950/90 via-slate-900/95 to-teal-950/80 border-emerald-500/40 shadow-emerald-500/10',
    rose: 'from-rose-950/90 via-slate-900/95 to-red-950/80 border-rose-500/40 shadow-rose-500/10',
    purple: 'from-purple-950/90 via-slate-900/95 to-indigo-950/80 border-purple-500/40 shadow-purple-500/10',
  };

  const badgeGradients = {
    amber: 'bg-gradient-to-r from-amber-500/20 to-yellow-500/20 text-amber-300 border-amber-500/40',
    blue: 'bg-gradient-to-r from-sky-500/20 to-blue-500/20 text-sky-300 border-sky-500/40',
    emerald: 'bg-gradient-to-r from-emerald-500/20 to-teal-500/20 text-emerald-300 border-emerald-500/40',
    rose: 'bg-gradient-to-r from-rose-500/20 to-red-500/20 text-rose-300 border-rose-500/40',
    purple: 'bg-gradient-to-r from-purple-500/20 to-indigo-500/20 text-purple-300 border-purple-500/40',
  };

  const buttonGradients = {
    amber: 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 shadow-amber-500/25',
    blue: 'bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white shadow-sky-500/25',
    emerald: 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-emerald-500/25',
    rose: 'bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-400 hover:to-red-500 text-white shadow-rose-500/25',
    purple: 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-400 hover:to-indigo-500 text-white shadow-purple-500/25',
  };

  const glowColors = {
    amber: 'bg-amber-500',
    blue: 'bg-sky-500',
    emerald: 'bg-emerald-500',
    rose: 'bg-rose-500',
    purple: 'bg-purple-500',
  };

  return (
    <div
      className="relative mb-5 group overflow-hidden select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Outer Banner Card Frame */}
      <div
        className={`relative overflow-hidden rounded-3xl p-4 sm:p-5 border transition-all duration-300 shadow-2xl bg-gradient-to-br ${
          themeGradients[theme] || themeGradients.amber
        }`}
      >
        {/* Ambient Glows */}
        <div
          className={`absolute -right-12 -top-12 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-25 transition-all duration-500 ${
            glowColors[theme] || 'bg-amber-500'
          }`}
        />
        <div
          className={`absolute -left-12 -bottom-12 w-48 h-48 rounded-full blur-3xl pointer-events-none opacity-20 transition-all duration-500 ${
            glowColors[theme] || 'bg-blue-500'
          }`}
        />

        {/* Decorative Grid Pattern Overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none opacity-40"></div>

        {/* Poster Image (if slide has custom image/poster) */}
        {currentSlide?.imageUrl && (
          <div className="mb-3.5 overflow-hidden rounded-2xl border border-white/15 max-h-48 sm:max-h-56 relative shadow-lg group-hover:scale-[1.01] transition-transform duration-300">
            <img
              src={currentSlide.imageUrl}
              alt="Promo Banner"
              className="w-full h-auto max-h-48 sm:max-h-56 object-cover rounded-2xl"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none"></div>
          </div>
        )}

        {/* Banner Content Container */}
        <div className="relative z-10">
          {/* Top Row: Badge, Live Counter, Slide Index */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-lg border font-mono tracking-wider flex items-center gap-1.5 shadow-sm ${
                  badgeGradients[theme] || badgeGradients.amber
                }`}
              >
                <i className="fas fa-bolt text-[9px] animate-pulse"></i>
                <span>{currentSlide?.badge || 'EXCLUSIVE OFFER'}</span>
              </span>

              <span className="hidden sm:inline-flex items-center gap-1 text-[9px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                ACTIVE
              </span>
            </div>

            {/* Slide Index Pill */}
            <div className="flex items-center gap-1.5 bg-black/40 border border-white/10 px-2 py-0.5 rounded-full text-[9px] font-mono text-slate-300">
              <span className="font-extrabold text-white">{currentIndex + 1}</span>
              <span className="text-slate-500">/</span>
              <span>{slides.length}</span>
            </div>
          </div>

          {/* Banner Title */}
          <h2 className="text-base sm:text-lg font-black text-white tracking-tight leading-snug drop-shadow-sm mb-1.5 line-clamp-2">
            {currentSlide?.title}
          </h2>

          {/* Banner Description / Subtitle */}
          <p className="text-xs sm:text-[13px] text-slate-300 leading-relaxed font-normal mb-4 line-clamp-2 drop-shadow">
            {currentSlide?.message}
          </p>

          {/* Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-white/10">
            {/* Primary Action Button */}
            <div className="flex items-center gap-2">
              {currentSlide?.actionText && (
                <button
                  type="button"
                  onClick={() => handleAction(currentSlide.actionUrl)}
                  className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg active:scale-95 transition cursor-pointer ${
                    buttonGradients[theme] || buttonGradients.amber
                  }`}
                >
                  <span>{currentSlide.actionText}</span>
                  <i className="fas fa-arrow-right text-[10px]"></i>
                </button>
              )}

              {/* Secondary Quick Action: 5% Referral or Funds */}
              {theme !== 'emerald' && (
                <button
                  type="button"
                  onClick={() => onNavigateTab && onNavigateTab('funds')}
                  className="hidden xs:flex px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-bold items-center gap-1.5 transition active:scale-95 cursor-pointer"
                >
                  <i className="fas fa-wallet text-amber-400 text-xs"></i>
                  <span>অ্যাড ব্যালেন্স</span>
                </button>
              )}
            </div>

            {/* Next / Previous Controls */}
            {slides.length > 1 && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="w-7 h-7 rounded-xl bg-black/40 hover:bg-white/15 border border-white/15 text-slate-200 hover:text-white flex items-center justify-center text-xs transition active:scale-90 cursor-pointer"
                  title="Previous Slide"
                >
                  <i className="fas fa-chevron-left text-[10px]"></i>
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="w-7 h-7 rounded-xl bg-black/40 hover:bg-white/15 border border-white/15 text-slate-200 hover:text-white flex items-center justify-center text-xs transition active:scale-90 cursor-pointer"
                  title="Next Slide"
                >
                  <i className="fas fa-chevron-right text-[10px]"></i>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Pagination Dots & Auto-advance line */}
        {slides.length > 1 && (
          <div className="flex items-center justify-center gap-1.5 mt-3 pt-2 border-t border-white/5 relative z-10">
            {slides.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`transition-all duration-300 rounded-full h-1.5 cursor-pointer ${
                  currentIndex === idx
                    ? 'w-6 bg-gradient-to-r from-amber-400 to-yellow-300 shadow-[0_0_8px_rgba(245,158,11,0.6)]'
                    : 'w-2 bg-white/20 hover:bg-white/40'
                }`}
                title={`Slide ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
