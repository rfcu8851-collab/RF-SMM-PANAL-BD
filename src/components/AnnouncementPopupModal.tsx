import React, { useState, useEffect } from 'react';

export interface AnnouncementSlide {
  id: string;
  badge?: string;
  title: string;
  message: string;
  imageUrl?: string;
  actionText?: string;
  actionUrl?: string;
  theme?: 'amber' | 'blue' | 'emerald' | 'rose' | 'purple';
}

interface AnnouncementPopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  slides?: AnnouncementSlide[];
  singleTitle?: string;
  singleMessage?: string;
  singleBadge?: string;
  singleImageUrl?: string;
  singleActionText?: string;
  singleActionUrl?: string;
  onActionClick?: (url?: string) => void;
}

export const AnnouncementPopupModal: React.FC<AnnouncementPopupModalProps> = ({
  isOpen,
  onClose,
  slides,
  singleTitle,
  singleMessage,
  singleBadge,
  singleImageUrl,
  singleActionText,
  singleActionUrl,
  onActionClick,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [dontShowToday, setDontShowToday] = useState(false);

  // Compile active slides list
  const activeSlides: AnnouncementSlide[] = React.useMemo(() => {
    if (slides && slides.length > 0) {
      return slides;
    }

    // Default slides inspired by user screenshot & RF SMM PANEL announcements
    const fallbackList: AnnouncementSlide[] = [
      {
        id: 'slide-1',
        badge: singleBadge || 'ANNOUNCEMENT',
        title: singleTitle || '🔻 আপনাকে আমাদের গভীর কৃতজ্ঞতা জানাচ্ছি! 🔻',
        message:
          singleMessage ||
          '🙇‍♂️ আর এফ এসএমএম প্যানেল ব্যবহার করার জন্য আপনাকে আন্তরিক ধন্যবাদ। আমাদের ২৪/৭ অটোমেটিক বিকাশ, নগদ ও রকেট ডিপোজিট সিস্টেম সম্পূর্ণ সক্রিয় রয়েছে। যেকোনো অর্ডারে সর্বোচ্চ গতি নিশ্চিত করতে আমরা নিরবচ্ছিন্ন কাজ করছি।',
        imageUrl: singleImageUrl || '',
        actionText: singleActionText || 'টেলিগ্রাম চ্যানেলে জয়েন করুন ⚡',
        actionUrl: singleActionUrl || 'https://t.me/RF2_SMM',
        theme: 'amber',
      },
      {
        id: 'slide-2',
        badge: 'SPECIAL BONUS',
        title: '🎉 বিশেষ ডিপোজিট ক্যাশব্যাক বোনাস ধামাকা!',
        message:
          '💰 বিকাশ, নগদ বা রকেটে যেকোনো ডিপোজিটে পাচ্ছেন ইনস্ট্যান্ট ৫% থেকে ১০% পর্যন্ত ক্যাশব্যাক বোনাস! অফারটি সীমিত সময়ের জন্য প্রযোজ্য। যেকোনো প্রয়োজনে লাইভ সাপোর্ট সবসময় খোলা আছে।',
        imageUrl: '',
        actionText: 'ডিপোজিট করুন 💰',
        actionUrl: '#deposit',
        theme: 'emerald',
      },
      {
        id: 'slide-3',
        badge: 'FAST DELIVERY',
        title: '⚡ ফেসবুক, ইনস্টাগ্রাম ও টিকটক সার্ভিস সুপার ফাস্ট!',
        message:
          '🔥 ফেসবুক ফলোয়ার, রিয়েকশন, ইউটিউব ওয়াচটাইম ও টিকটক ভিউ এখন হাই স্পিড ও ড্রপলেস কোয়ালিটিতে প্রদান করা হচ্ছে। অর্ডার করার মাত্র ৫ মিনিটের মধ্যে কাজ শুরু হয়ে যায়!',
        imageUrl: '',
        actionText: 'সার্ভিস লিস্ট দেখুন 📋',
        actionUrl: '#services',
        theme: 'blue',
      },
    ];

    return fallbackList;
  }, [slides, singleTitle, singleMessage, singleBadge, singleImageUrl, singleActionText, singleActionUrl]);

  const currentSlide = activeSlides[currentIndex] || activeSlides[0];

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : activeSlides.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev < activeSlides.length - 1 ? prev + 1 : 0));
  };

  const handleClose = () => {
    if (dontShowToday) {
      try {
        const todayStr = new Date().toISOString().slice(0, 10);
        localStorage.setItem('rf_smm_announcement_dismissed_date', todayStr);
      } catch (_) {}
    }
    onClose();
  };

  const handleAction = () => {
    if (onActionClick && currentSlide.actionUrl) {
      onActionClick(currentSlide.actionUrl);
    }
  };

  useEffect(() => {
    if (currentIndex >= activeSlides.length) {
      setCurrentIndex(0);
    }
  }, [activeSlides.length, currentIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      {/* Modal Container */}
      <div className="relative w-full max-w-[370px] sm:max-w-[400px] flex flex-col items-center">
        {/* ========================================================================= */}
        {/* TOP ORNAMENTAL BANNER & CROWN HEADER (EXACTLY MATCHING USER SCREENSHOT)   */}
        {/* ========================================================================= */}
        <div className="relative w-full flex justify-center -mb-5 z-20 pointer-events-none">
          {/* Decorative Crown & Ribbon SVG Header */}
          <div className="relative flex flex-col items-center">
            <svg
              className="w-64 sm:w-72 h-auto filter drop-shadow-[0_8px_16px_rgba(0,0,0,0.6)]"
              viewBox="0 0 280 90"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                {/* Gold Arch Gradient */}
                <linearGradient id="goldArch" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFF176" />
                  <stop offset="30%" stopColor="#FBC02D" />
                  <stop offset="70%" stopColor="#F57F17" />
                  <stop offset="100%" stopColor="#FFD54F" />
                </linearGradient>

                {/* Festive Cyan Ribbon Gradient */}
                <linearGradient id="cyanRibbon" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00E5FF" />
                  <stop offset="50%" stopColor="#00B0FF" />
                  <stop offset="100%" stopColor="#0091EA" />
                </linearGradient>

                {/* Red Jewel Gradient */}
                <linearGradient id="redJewel" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FF5252" />
                  <stop offset="100%" stopColor="#C62828" />
                </linearGradient>
              </defs>

              {/* Carnival Crown Peaks */}
              <path
                d="M 60 70 L 40 25 L 75 42 L 95 10 L 115 42 L 140 18 L 165 42 L 185 10 L 205 42 L 240 25 L 220 70 Z"
                fill="url(#redJewel)"
                stroke="#FFE082"
                strokeWidth="2.5"
              />

              {/* Gold Crown Tips / Jewels */}
              <circle cx="40" cy="23" r="5.5" fill="#FFD54F" stroke="#FFF" strokeWidth="1.5" />
              <circle cx="95" cy="10" r="7" fill="#FFD54F" stroke="#FFF" strokeWidth="1.8" />
              <circle cx="140" cy="17" r="8" fill="#FFF9C4" stroke="#FFA000" strokeWidth="2" />
              <circle cx="185" cy="10" r="7" fill="#FFD54F" stroke="#FFF" strokeWidth="1.8" />
              <circle cx="240" cy="23" r="5.5" fill="#FFD54F" stroke="#FFF" strokeWidth="1.5" />

              {/* Arched Ribbon Header Base */}
              <path
                d="M 20 62 Q 140 38 260 62 L 250 86 Q 140 64 30 86 Z"
                fill="url(#cyanRibbon)"
                stroke="#80D8FF"
                strokeWidth="2"
              />

              {/* Golden Trim Borders */}
              <path
                d="M 20 62 Q 140 38 260 62"
                stroke="url(#goldArch)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <path
                d="M 30 86 Q 140 64 250 86"
                stroke="url(#goldArch)"
                strokeWidth="3.5"
                strokeLinecap="round"
              />

              {/* Floating Gold Stars */}
              <polygon points="35,32 37,38 43,38 38,42 40,48 35,44 30,48 32,42 27,38 33,38" fill="#FFD700" />
              <polygon points="245,32 247,38 253,38 248,42 250,48 245,44 240,48 242,42 237,38 243,38" fill="#FFD700" />
            </svg>

            {/* Embossed "Announcement" Text Over Ribbon */}
            <div className="absolute inset-x-0 bottom-1 flex justify-center items-center">
              <span className="text-white font-black text-lg sm:text-xl tracking-wider uppercase drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] font-sans">
                Announcement
              </span>
            </div>
          </div>
        </div>

        {/* Top Right Close Button (Golden Circle, exactly positioned) */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute -top-1 -right-1 sm:-right-2 z-30 w-9 h-9 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-200 p-0.5 shadow-xl hover:scale-110 active:scale-95 transition-transform flex items-center justify-center cursor-pointer border border-white/80"
          title="বন্ধ করুন"
        >
          <div className="w-full h-full rounded-full bg-slate-900/90 hover:bg-slate-900 flex items-center justify-center text-amber-300 hover:text-white text-sm font-black transition">
            <i className="fas fa-times"></i>
          </div>
        </button>

        {/* ========================================================================= */}
        {/* MODAL MAIN CARD CONTAINER (CYAN/TEAL BORDER & WHITE HIGH CONTRAST BODY)   */}
        {/* ========================================================================= */}
        <div className="w-full overflow-hidden rounded-3xl bg-slate-950 border-4 border-cyan-500/80 shadow-[0_15px_60px_rgba(0,176,255,0.35),0_0_25px_rgba(255,215,0,0.2)] pt-5 pb-4 px-3 sm:px-4 text-slate-900 flex flex-col relative">
          {/* Inner Poster / Graphic Banner */}
          <div className="w-full rounded-2xl overflow-hidden shadow-inner border-2 border-amber-400/50 mb-3 bg-gradient-to-r from-blue-900 via-indigo-950 to-blue-900 relative">
            {currentSlide.imageUrl ? (
              <img
                src={currentSlide.imageUrl}
                alt="Announcement Graphic"
                className="w-full h-36 sm:h-40 object-cover object-center"
              />
            ) : (
              /* Default Vibrant RF SMM Panel Graphic Poster (Matches user screenshot vibe) */
              <div className="w-full h-36 sm:h-40 bg-gradient-to-br from-blue-950 via-indigo-900 to-slate-950 flex flex-col items-center justify-center p-3 text-center relative overflow-hidden">
                {/* Background lighting accents */}
                <div className="absolute -left-6 -top-6 w-24 h-24 bg-cyan-400/20 rounded-full blur-xl pointer-events-none"></div>
                <div className="absolute -right-6 -bottom-6 w-28 h-28 bg-amber-400/25 rounded-full blur-xl pointer-events-none"></div>

                {/* Sparkling elements */}
                <i className="fas fa-sparkles text-amber-300 absolute top-2 left-3 text-xs animate-pulse"></i>
                <i className="fas fa-star text-yellow-400 absolute bottom-3 right-4 text-xs animate-spin" style={{ animationDuration: '6s' }}></i>

                {/* Brand Badge in poster */}
                <div className="px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 text-slate-950 font-black text-xs tracking-wider shadow-md mb-1.5 flex items-center gap-1.5 border border-white/60">
                  <i className="fas fa-crown text-[11px] text-amber-900"></i>
                  <span>RF SMM PANEL BANGLADESH</span>
                </div>

                {/* Catchy Promotion Headline */}
                <h4 className="text-white font-black text-sm sm:text-base leading-tight drop-shadow-md">
                  ⚡ ২৪/৭ অটোমেটিক ইনস্ট্যান্ট সার্ভিস
                </h4>
                <p className="text-amber-300 font-extrabold text-xs mt-1 drop-shadow">
                  বিকাশ, নগদ ও রকেটে দ্রুততম ডিপোজিট ও ডেলিভারি
                </p>

                {/* Subtag / Badge pill */}
                <div className="mt-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-white/15 border border-white/25 text-[10px] text-cyan-200 font-mono">
                  <i className="fas fa-bolt text-yellow-300 text-[9px]"></i>
                  <span>{currentSlide.badge || 'SPECIAL NOTICE'}</span>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* WHITE / CRISP TEXT CONTENT AREA (EXACTLY MATCHING USER SCREENSHOT)        */}
          {/* ========================================================================= */}
          <div className="w-full bg-white rounded-2xl p-4 shadow-md border border-slate-200 text-center flex flex-col justify-center min-h-[140px] relative">
            {/* Title with decorative markers */}
            <div className="flex items-center justify-center gap-1.5 text-rose-600 font-black text-sm sm:text-[15px] leading-snug">
              <span>🔻</span>
              <h3 className="text-slate-900 font-black tracking-tight">{currentSlide.title}</h3>
              <span>🔻</span>
            </div>

            {/* Message Body */}
            <div className="mt-2 text-xs sm:text-sm text-slate-700 font-medium leading-relaxed whitespace-pre-line text-center px-1">
              {currentSlide.message}
            </div>

            {/* Slide page indicator dots */}
            {activeSlides.length > 1 && (
              <div className="mt-3 flex items-center justify-center gap-1.5">
                {activeSlides.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      idx === currentIndex ? 'w-5 bg-amber-500' : 'w-2 bg-slate-300 hover:bg-slate-400'
                    }`}
                    title={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* BOTTOM DUAL GOLDEN PILL BUTTONS (◀ Previous & Next ▶)                      */}
          {/* ========================================================================= */}
          <div className="mt-3.5 w-full grid grid-cols-2 gap-2.5 sm:gap-3">
            {/* Previous Button */}
            <button
              type="button"
              onClick={handlePrev}
              className="py-2.5 px-3 rounded-full bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-500 hover:from-yellow-200 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-[0_4px_12px_rgba(245,158,11,0.5)] active:scale-95 transition-all flex items-center justify-center gap-1.5 border-2 border-yellow-200/80 cursor-pointer"
            >
              <i className="fas fa-caret-left text-sm text-amber-950"></i>
              <span>Previous</span>
            </button>

            {/* Next Button */}
            <button
              type="button"
              onClick={handleNext}
              className="py-2.5 px-3 rounded-full bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-500 hover:from-yellow-200 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm tracking-wide shadow-[0_4px_12px_rgba(245,158,11,0.5)] active:scale-95 transition-all flex items-center justify-center gap-1.5 border-2 border-yellow-200/80 cursor-pointer"
            >
              <span>Next</span>
              <i className="fas fa-caret-right text-sm text-amber-950"></i>
            </button>
          </div>

          {/* Optional Action Button (If actionText provided, e.g. Telegram / Deposit) */}
          {currentSlide.actionText && (
            <div className="mt-2.5 w-full">
              <button
                type="button"
                onClick={handleAction}
                className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-black text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer border border-cyan-300/40"
              >
                <span>{currentSlide.actionText}</span>
                <i className="fas fa-arrow-right text-[10px]"></i>
              </button>
            </div>
          )}

          {/* Bottom "Don't show again today" Checkbox & Close */}
          <div className="mt-2.5 flex items-center justify-between px-1 text-[11px] text-slate-400">
            <label className="flex items-center gap-1.5 cursor-pointer hover:text-white transition">
              <input
                type="checkbox"
                checked={dontShowToday}
                onChange={(e) => setDontShowToday(e.target.checked)}
                className="rounded border-slate-600 text-amber-500 focus:ring-amber-500 bg-slate-800 w-3.5 h-3.5 cursor-pointer"
              />
              <span>আজ আর দেখাবেন না</span>
            </label>

            <button
              type="button"
              onClick={handleClose}
              className="text-slate-400 hover:text-white transition underline cursor-pointer text-[11px]"
            >
              বন্ধ করুন (Close)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
