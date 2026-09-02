import React, { useState, useEffect, useRef } from 'react';
import { Live3DCanvas, ThreeDTheme, THEME_CONFIGS } from './components/Live3DCanvas';
import { Welcome3DModal } from './components/Welcome3DModal';
import { LiveAISupportModal } from './components/LiveAISupportModal';
import { AdminLiveSupportPanel } from './components/AdminLiveSupportPanel';
import {
  db,
  auth,
  signInAnonymously,
  signOut,
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  getDoc,
  getDocs,
  DEFAULT_SERVICES
} from './firebase';

interface ServiceData {
  id: string;
  category: string;
  name: string;
  price: number;
  min: number;
  max: number;
  desc?: string;
  apiServiceId?: string;
}

interface OrderData {
  id: string;
  uid: string;
  service: string;
  qty: number;
  link: string;
  cost: number;
  status: string;
  timestamp?: any;
  createdAt?: string;
  apiOrderId?: string | number;
  apiError?: string;
  apiStatus?: string;
}

export interface PaymentMethodConfig {
  id: string;
  label: string;
  number: string;
  type?: 'Send Money' | 'Cash Out' | 'Payment';
  ussd?: string;
  color?: string;
  logoUrl?: string;
  iconType?: 'bkash' | 'nagad' | 'rocket' | 'upay' | 'binance' | 'usdt' | 'bank' | 'custom';
  note?: string;
  isCrypto?: boolean;
  active?: boolean;
}

interface DepositRequest {
  id: string;
  uid: string;
  amount: number;
  trxId: string;
  method: string;
  status: string;
  screenshotUrl?: string;
  timestamp?: any;
}

interface UserSession {
  uid: string;
  username: string;
  name: string;
  email?: string;
  photoURL?: string;
  referredBy?: string | null;
  referredByUsername?: string | null;
}

export interface ReferralCommission {
  id: string;
  referrerUid: string;
  referrerUsername?: string;
  referredUid: string;
  referredUsername?: string;
  depositAmount: number;
  bonusPercent: number;
  commissionAmount: number;
  depositTrxId?: string;
  timestamp?: any;
  status?: string;
  createdAt?: string;
}

export interface ReferralConfig {
  enabled: boolean;
  bonusPercent: number;
  websiteUrl?: string;
}

export interface TaskSubmission {
  id: string;
  taskId: string;
  taskTitle: string;
  reward: number;
  userId: string;
  userName: string;
  proofText: string;
  screenshots: string[]; // up to 5 screenshot base64 strings
  status: 'Pending' | 'Approved' | 'Rejected';
  submittedAt: string;
  adminNote?: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  reward: number;
  link: string;
  icon?: string;
  image?: string;
}

// Image compression helper to support up to 5 screenshots
const compressImageToBase64 = (file: File, maxWidth = 900, maxHeight = 900, quality = 0.75): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } else {
          resolve(event.target?.result as string);
        }
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// Legacy Service ID Mapper to ensure SMMGen API receives real working service IDs
const SERVICE_ID_MAP: Record<string, string> = {
  '101': '15806', // FB Followers (30D Refill)
  '102': '16869', // FB Post Likes
  '201': '19382', // IG Followers
  '202': '13330', // IG Likes
  '301': '16393', // TikTok Followers
  '302': '16356', // TikTok Likes
  '401': '9622',  // YouTube Subscribers
  '402': '18918', // YouTube Views
  '501': '18384'  // Telegram Members
};

// Social Platforms Meta with icons and colors
const SOCIAL_PLATFORMS = [
  { id: 'facebook', name: 'Facebook', icon: 'fab fa-facebook-f', color: '#1877F2', bg: 'from-blue-600/25 to-blue-500/10' },
  { id: 'instagram', name: 'Instagram', icon: 'fab fa-instagram', color: '#E4405F', bg: 'from-pink-600/25 to-purple-600/10' },
  { id: 'tiktok', name: 'TikTok', icon: 'fab fa-tiktok', color: '#00F2FE', bg: 'from-cyan-500/25 to-pink-500/10' },
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: '#FF0000', bg: 'from-red-600/25 to-red-500/10' },
  { id: 'telegram', name: 'Telegram', icon: 'fab fa-telegram-plane', color: '#229ED9', bg: 'from-sky-500/25 to-blue-500/10' },
  { id: 'twitter', name: 'Twitter / X', icon: 'fab fa-twitter', color: '#1DA1F2', bg: 'from-slate-700/30 to-blue-500/10' },
  { id: 'website', name: 'Website / SEO', icon: 'fas fa-globe', color: '#10B981', bg: 'from-emerald-500/25 to-teal-500/10' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'fab fa-whatsapp', color: '#25D366', bg: 'from-emerald-600/25 to-green-500/10' },
  { id: 'snapchat', name: 'Snapchat', icon: 'fab fa-snapchat-ghost', color: '#FFFC00', bg: 'from-yellow-400/25 to-amber-500/10' },
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: '#1DB954', bg: 'from-green-500/25 to-emerald-500/10' },
  { id: 'discord', name: 'Discord', icon: 'fab fa-discord', color: '#5865F2', bg: 'from-indigo-500/25 to-blue-500/10' },
  { id: 'linkedin', name: 'LinkedIn', icon: 'fab fa-linkedin-in', color: '#0A66C2', bg: 'from-blue-700/25 to-sky-500/10' },
];

function getPlatformMeta(name: string) {
  const str = (name || '').toLowerCase();
  if (str.includes('fb') || str.includes('facebook')) return SOCIAL_PLATFORMS[0];
  if (str.includes('ig') || str.includes('instagram')) return SOCIAL_PLATFORMS[1];
  if (str.includes('tiktok') || str.includes('tt')) return SOCIAL_PLATFORMS[2];
  if (str.includes('yt') || str.includes('youtube')) return SOCIAL_PLATFORMS[3];
  if (str.includes('telegram') || str.includes('tg')) return SOCIAL_PLATFORMS[4];
  if (str.includes('twitter') || str.includes('x') || str.includes('tweet')) return SOCIAL_PLATFORMS[5];
  if (str.includes('web') || str.includes('seo') || str.includes('website') || str.includes('traffic')) return SOCIAL_PLATFORMS[6];
  if (str.includes('whatsapp') || str.includes('wa')) return SOCIAL_PLATFORMS[7];
  if (str.includes('snapchat') || str.includes('sc')) return SOCIAL_PLATFORMS[8];
  if (str.includes('spotify')) return SOCIAL_PLATFORMS[9];
  if (str.includes('discord')) return SOCIAL_PLATFORMS[10];
  if (str.includes('linkedin')) return SOCIAL_PLATFORMS[11];
  return { id: 'smm', name: 'SMM Service', icon: 'fas fa-rocket', color: '#3B82F6', bg: 'from-blue-500/20 to-indigo-500/10' };
}

// Render dynamic Payment Method Logo
function renderMethodLogo(method: { label?: string; iconType?: string; logoUrl?: string; color?: string; id?: string }, size = 'w-7 h-7') {
  if (method.logoUrl && method.logoUrl.trim()) {
    return (
      <img
        src={method.logoUrl}
        alt={method.label || 'Logo'}
        className={`${size} object-contain rounded-md`}
        referrerPolicy="no-referrer"
        onError={(e) => {
          (e.currentTarget as HTMLElement).style.display = 'none';
        }}
      />
    );
  }

  const iconType = (method.iconType || method.id || method.label || '').toLowerCase();
  if (iconType.includes('bkash')) {
    return (
      <div className={`${size} rounded-lg bg-[#e2136e] flex items-center justify-center p-1 shadow-sm flex-shrink-0`}>
        <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
          <polygon points="50,8 90,38 75,90 25,90 10,38" fill="#e2136e" />
          <polygon points="50,18 82,42 70,82 30,82 18,42" fill="white" />
          <polygon points="50,28 72,55 50,78 28,55" fill="#e2136e" />
        </svg>
      </div>
    );
  }
  if (iconType.includes('rocket')) {
    return (
      <div className={`${size} rounded-lg bg-[#8c3494] flex items-center justify-center p-1 shadow-sm flex-shrink-0`}>
        <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
          <circle cx="50" cy="50" r="45" fill="#8c3494" />
          <path d="M50 15 L68 45 L60 85 L50 75 L40 85 L32 45 Z" fill="white" />
          <polygon points="50,30 60,55 40,55" fill="#facc15" />
        </svg>
      </div>
    );
  }
  if (iconType.includes('nagad')) {
    return (
      <div className={`${size} rounded-lg bg-gradient-to-tr from-[#ea580c] to-[#f97316] flex items-center justify-center p-1 shadow-sm flex-shrink-0`}>
        <svg viewBox="0 0 100 100" className="w-full h-full text-white fill-current">
          <circle cx="50" cy="50" r="45" fill="#ea580c" />
          <path d="M50 15 Q75 35 65 65 Q55 85 45 80 Q35 75 40 60 Q45 45 35 35 Q50 25 50 15 Z" fill="white" />
          <circle cx="58" cy="42" r="8" fill="#facc15" />
        </svg>
      </div>
    );
  }
  if (iconType.includes('upay')) {
    return (
      <div className={`${size} rounded-lg bg-[#005696] flex items-center justify-center text-amber-300 font-black text-[9px] shadow-sm flex-shrink-0 tracking-tighter`}>
        upay
      </div>
    );
  }
  if (iconType.includes('binance')) {
    return (
      <div className={`${size} rounded-lg bg-[#f0b90b] flex items-center justify-center p-1 shadow-sm text-slate-950 flex-shrink-0`}>
        <svg viewBox="0 0 100 100" className="w-full h-full fill-current">
          <polygon points="50,15 65,30 50,45 35,30" />
          <polygon points="50,55 65,70 50,85 35,70" />
          <polygon points="20,50 35,35 35,65" />
          <polygon points="80,50 65,35 65,65" />
        </svg>
      </div>
    );
  }
  if (iconType.includes('usdt') || iconType.includes('crypto')) {
    return (
      <div className={`${size} rounded-lg bg-[#26a17b] flex items-center justify-center text-white font-black text-xs shadow-sm flex-shrink-0`}>
        ₮
      </div>
    );
  }

  return (
    <div
      className={`${size} rounded-lg flex items-center justify-center text-white font-black text-[10px] shadow-sm flex-shrink-0`}
      style={{ backgroundColor: method.color || '#3b82f6' }}
    >
      {method.label ? method.label.slice(0, 2).toUpperCase() : 'PAY'}
    </div>
  );
}

export default function App() {
  // Splash & Auth State
  const [showSplash, setShowSplash] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [currentUser, setCurrentUser] = useState<UserSession | null>(null);

  // Form states for auth
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginUserErr, setLoginUserErr] = useState('');
  const [loginPassErr, setLoginPassErr] = useState('');

  // 3D Live Theme & Welcome Modal States
  const [threeDTheme, setThreeDTheme] = useState<ThreeDTheme>(() => {
    return (localStorage.getItem('smm_3d_theme') as ThreeDTheme) || 'cyber_neon';
  });
  const [is3DEnabled, setIs3DEnabled] = useState<boolean>(() => {
    return localStorage.getItem('smm_3d_enabled') !== 'false';
  });
  const [show3DThemeModal, setShow3DThemeModal] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showAISupportModal, setShowAISupportModal] = useState(false);

  // Welcome Speech & 3D Announcement Configuration (stored in Firestore settings/welcome_config)
  const [welcomeConfig, setWelcomeConfig] = useState<{
    title: string;
    text: string;
    enabled: boolean;
    soundEnabled: boolean;
    show3DButton: boolean;
    is3DCanvasGlobal: boolean;
    showNoticeTicker: boolean;
    noticeText?: string;
    audioMode: 'tts' | 'custom';
    customAudioUrl?: string;
    audioFileName?: string;
    siteLogo?: string;
    aiSupportEnabled?: boolean;
  }>({
    title: 'ওয়েলকাম RF SMM PANEL!',
    text: 'ওয়েলকাম টু আর এফ এসএমএম প্যানেল। বাংলাদেশের এক নম্বর সোশ্যাল মিডিয়া মার্কেটিং প্ল্যাটফর্মে আপনাকে স্বাগতম।',
    enabled: true,
    soundEnabled: true,
    show3DButton: true,
    is3DCanvasGlobal: true,
    showNoticeTicker: true,
    noticeText: '⚡ ২৪/৭ ইনস্ট্যান্ট সার্ভিস সক্রিয় | বিকাশ, নগদ, রকেটে ইনস্ট্যান্ট ডিপোজিট বোনাস চলছে | যেকোনো প্রয়োজনে আমাদের লাইভ সাপোর্টে যোগাযোগ করুন 🚀',
    audioMode: 'tts',
    customAudioUrl: '',
    audioFileName: '',
    aiSupportEnabled: true,
  });
  const [adminWelcomeTitle, setAdminWelcomeTitle] = useState('ওয়েলকাম RF SMM PANEL!');
  const [adminWelcomeText, setAdminWelcomeText] = useState('ওয়েলকাম টু আর এফ এসএমএম প্যানেল। বাংলাদেশের এক নম্বর সোশ্যাল মিডিয়া মার্কেটিং প্ল্যাটফর্মে আপনাকে স্বাগতম।');
  const [adminWelcomeEnabled, setAdminWelcomeEnabled] = useState(true);
  const [adminSoundEnabled, setAdminSoundEnabled] = useState(true);
  const [adminShow3DButton, setAdminShow3DButton] = useState(true);
  const [admin3DCanvasGlobal, setAdmin3DCanvasGlobal] = useState(true);
  const [adminShowNoticeTicker, setAdminShowNoticeTicker] = useState(true);
  const [adminNoticeText, setAdminNoticeText] = useState('⚡ ২৪/৭ ইনস্ট্যান্ট সার্ভিস সক্রিয় | বিকাশ, নগদ, রকেটে ইনস্ট্যান্ট ডিপোজিট বোনাস চলছে | যেকোনো প্রয়োজনে আমাদের লাইভ সাপোর্টে যোগাযোগ করুন 🚀');
  const [adminSavingNotice, setAdminSavingNotice] = useState(false);
  const [adminAudioMode, setAdminAudioMode] = useState<'tts' | 'custom'>('tts');
  const [adminCustomAudioUrl, setAdminCustomAudioUrl] = useState('');
  const [adminAudioFileName, setAdminAudioFileName] = useState('');
  const [adminAudioUploading, setAdminAudioUploading] = useState(false);
  const [adminIsRecording, setAdminIsRecording] = useState(false);
  const [adminRecordingDuration, setAdminRecordingDuration] = useState(0);
  const [adminAudioPlaying, setAdminAudioPlaying] = useState(false);
  const [adminSavingWelcome, setAdminSavingWelcome] = useState(false);

  const adminAudioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);

  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPass, setRegConfirmPass] = useState('');
  const [regNameErr, setRegNameErr] = useState('');
  const [regUserErr, setRegUserErr] = useState('');
  const [regEmailErr, setRegEmailErr] = useState('');
  const [regPassErr, setRegPassErr] = useState('');
  const [regConfirmErr, setRegConfirmErr] = useState('');

  const [authSubmitting, setAuthSubmitting] = useState(false);

  // Main App State
  const [activeTab, setActiveTab] = useState<'home' | 'orders' | 'funds' | 'profile' | 'admin'>('home');
  const [userBalance, setUserBalance] = useState(0);
  const [userTotalOrders, setUserTotalOrders] = useState(0);
  const [userPhotoURL, setUserPhotoURL] = useState<string | null>(null);
  
  // Profile Name & Username Editing
  const [editUserName, setEditUserName] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [editUserUsername, setEditUserUsername] = useState('');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [editUserUsernameErr, setEditUserUsernameErr] = useState('');

  // Profile Change Password State
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [confirmNewPasswordInput, setConfirmNewPasswordInput] = useState('');
  const [changePassErr, setChangePassErr] = useState('');
  const [changePassSuccess, setChangePassSuccess] = useState('');
  const [changePassSubmitting, setChangePassSubmitting] = useState(false);

  const [profileSubmitting, setProfileSubmitting] = useState(false);

  // Check if current logged in user is admin (rashal117 or ihicggh@gmail.com)
  const isAdminUser = Boolean(
    currentUser && (
      currentUser.username?.toLowerCase() === 'rashal117' ||
      currentUser.name?.toLowerCase() === 'rashal117' ||
      currentUser.email?.toLowerCase() === 'ihicggh@gmail.com' ||
      currentUser.email?.toLowerCase() === 'rashal117@gmail.com'
    )
  );

  // Home Page Order Form State
  const [allServices, setAllServices] = useState<ServiceData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState('');
  const [currentService, setCurrentService] = useState<ServiceData | null>(null);
  const [targetLink, setTargetLink] = useState('');
  const [quantity, setQuantity] = useState<number>(100);
  const [orderSubmitting, setOrderSubmitting] = useState(false);

  // Form Field Errors
  const [catErr, setCatErr] = useState('');
  const [svcErr, setSvcErr] = useState('');
  const [linkErr, setLinkErr] = useState('');
  const [qtyErr, setQtyErr] = useState('');

  // Orders State
  const [ordersList, setOrdersList] = useState<OrderData[]>([]);

  // Funds State
  const [selectedMethod, setSelectedMethod] = useState<string>('bkash');
  const [depositAmount, setDepositAmount] = useState<string>('100');
  const [depositStep, setDepositStep] = useState<'amount' | 'method' | 'gateway'>('amount');
  const [depositTrxId, setDepositTrxId] = useState<string>('');
  const [depositReceiptImage, setDepositReceiptImage] = useState<string>('');
  const [depositReceiptFileName, setDepositReceiptFileName] = useState<string>('');
  const [selectedScreenshotPreview, setSelectedScreenshotPreview] = useState<string | null>(null);
  const [depAmtErr, setDepAmtErr] = useState('');
  const [depTrxErr, setDepTrxErr] = useState('');
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [depositHistory, setDepositHistory] = useState<DepositRequest[]>([]);
  const [allDepositRequests, setAllDepositRequests] = useState<DepositRequest[]>([]);
  const [gatewayTimeLeft, setGatewayTimeLeft] = useState<number>(900); // 15:00 minutes timer

  // Admin Site Logo & Branding Settings
  const [adminSiteLogo, setAdminSiteLogo] = useState<string>(() => localStorage.getItem('rf_smm_site_logo') || '');
  const [adminSiteLogoInput, setAdminSiteLogoInput] = useState<string>('');
  const [adminSavingLogo, setAdminSavingLogo] = useState<boolean>(false);

  // Admin New Payment Method Modal & Form State
  const [showAddMethodModal, setShowAddMethodModal] = useState(false);
  const [newMethodKey, setNewMethodKey] = useState('');
  const [newMethodLabel, setNewMethodLabel] = useState('');
  const [newMethodNumber, setNewMethodNumber] = useState('01840442809');
  const [newMethodType, setNewMethodType] = useState<'Send Money' | 'Cash Out' | 'Payment'>('Send Money');
  const [newMethodUssd, setNewMethodUssd] = useState('*247#');
  const [newMethodColor, setNewMethodColor] = useState('#e2136e');
  const [newMethodLogoUrl, setNewMethodLogoUrl] = useState('');
  const [newMethodIconType, setNewMethodIconType] = useState<PaymentMethodConfig['iconType']>('bkash');
  const [newMethodNote, setNewMethodNote] = useState('');

  // Admin Manual Service Form & Control State
  const [adminSubTab, setAdminSubTab] = useState<'users' | 'payment' | 'deposits' | 'orders' | 'services' | 'notifications' | 'links' | 'welcome' | 'settings' | 'tasks' | 'referrals' | 'support'>('users');
  const [paymentMethodsConfig, setPaymentMethodsConfig] = useState<Record<string, PaymentMethodConfig>>({
    bkash: {
      id: 'bkash',
      label: 'bKash',
      number: '01840442809',
      type: 'Send Money',
      ussd: '*247#',
      color: '#e2136e',
      iconType: 'bkash',
      active: true,
      note: ''
    },
    rocket: {
      id: 'rocket',
      label: 'Rocket',
      number: '01840442809',
      type: 'Send Money',
      ussd: '*322#',
      color: '#8c3494',
      iconType: 'rocket',
      active: true,
      note: ''
    },
    nagad: {
      id: 'nagad',
      label: 'Nagad',
      number: '01840442809',
      type: 'Send Money',
      ussd: '*167#',
      color: '#ea580c',
      iconType: 'nagad',
      active: true,
      note: ''
    },
    upay: {
      id: 'upay',
      label: 'Upay',
      number: '01840442809',
      type: 'Send Money',
      ussd: '*268#',
      color: '#005696',
      iconType: 'upay',
      active: true,
      note: ''
    },
    binance: {
      id: 'binance',
      label: 'Binance',
      number: '584304364',
      type: 'Payment',
      ussd: 'Binance App',
      color: '#f0b90b',
      iconType: 'binance',
      isCrypto: true,
      active: false,
      note: '0.10$ = 12 TK ($1 = 120 TK)'
    }
  });
  const [editingPaymentMethods, setEditingPaymentMethods] = useState<Record<string, PaymentMethodConfig>>({});
  const [allUsersList, setAllUsersList] = useState<Array<{ uid: string; name?: string; balance?: number; total_orders?: number }>>([]);
  const [allAdminOrdersList, setAllAdminOrdersList] = useState<OrderData[]>([]);
  const [depFilter, setDepFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
  const [customDepAmounts, setCustomDepAmounts] = useState<{ [id: string]: string }>({});
  const [userBalanceAdjustInput, setUserBalanceAdjustInput] = useState<{ [uid: string]: string }>({});

  const [broadcastTitle, setBroadcastTitle] = useState('');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [broadcastType, setBroadcastType] = useState<'system' | 'deposit' | 'promo'>('system');
  const [broadcastImage, setBroadcastImage] = useState<string | null>(null);

  const [newLinkName, setNewLinkName] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');
  const [newLinkIcon, setNewLinkIcon] = useState('fab fa-telegram');
  const [supportLinks, setSupportLinks] = useState<Array<{ id: string; name: string; url: string; icon: string }>>([
    { id: 'l1', name: 'Telegram Channel', url: 'https://t.me/RF2_SMM', icon: 'fab fa-telegram' },
    { id: 'l2', name: 'WhatsApp Support', url: 'https://wa.me/8801342163841', icon: 'fab fa-whatsapp' },
    { id: 'l3', name: 'Facebook Page', url: 'https://www.facebook.com/share/1EKKUHMxCw/', icon: 'fab fa-facebook' }
  ]);

  const [replyingMailId, setReplyingMailId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const [adminCategory, setAdminCategory] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPrice, setAdminPrice] = useState('');
  const [adminMin, setAdminMin] = useState('100');
  const [adminMax, setAdminMax] = useState('100000');
  const [adminDesc, setAdminDesc] = useState('');
  const [adminApiServiceId, setAdminApiServiceId] = useState('');
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [adminSearch, setAdminSearch] = useState('');
  const [adminSubmitting, setAdminSubmitting] = useState(false);

  // Search Modal & Global Search State
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');

  // Notification System State
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    title: string;
    message: string;
    time: string;
    unread: boolean;
    type: 'order' | 'deposit' | 'system' | 'promo';
  }>>([
    {
      id: '1',
      title: 'Welcome to SMM Panel 🚀',
      message: 'Instant automated delivery is enabled on all Facebook, TikTok & Telegram services!',
      time: 'Just now',
      unread: true,
      type: 'system'
    },
    {
      id: '2',
      title: 'Crypto Payments Active 💳',
      message: 'You can now add funds using Binance Pay (UID: 584304364) or USDT BEP20.',
      time: '1 hour ago',
      unread: true,
      type: 'deposit'
    },
    {
      id: '3',
      title: 'Special Offer 🎉',
      message: 'Get 10% extra bonus balance on deposits of ৳1,000 or more!',
      time: 'Today',
      unread: false,
      type: 'promo'
    }
  ]);

  // Referral System State
  const [regReferralCode, setRegReferralCode] = useState('');
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [userTotalReferrals, setUserTotalReferrals] = useState(0);
  const [userReferralEarnings, setUserReferralEarnings] = useState(0);
  const [userReferralCommissions, setUserReferralCommissions] = useState<ReferralCommission[]>([]);
  const [allReferralCommissions, setAllReferralCommissions] = useState<ReferralCommission[]>([]);
  const [referralConfig, setReferralConfig] = useState<ReferralConfig>({
    enabled: true,
    bonusPercent: 5,
    websiteUrl: '',
  });
  const [adminSavingReferralConfig, setAdminSavingReferralConfig] = useState(false);

  // Live Orders & Tasks State
  const [showLiveOrdersModal, setShowLiveOrdersModal] = useState(false);
  const [showTasksModal, setShowTasksModal] = useState(false);
  const [liveOrdersFilter, setLiveOrdersFilter] = useState<'all' | 'my'>('all');
  const [claimedTasks, setClaimedTasks] = useState<string[]>([]);

  // Tasks & Screenshot Proof Submissions State
  const [allTaskSubmissions, setAllTaskSubmissions] = useState<TaskSubmission[]>([]);
  const [customTasks, setCustomTasks] = useState<TaskItem[]>([
    {
      id: 'task_tg',
      title: '1. Telegram চ্যানেলে জয়েন করুন',
      description: 'অফিসিয়াল টেলিগ্রাম চ্যানেলে যুক্ত হয়ে জয়েন স্ক্রিনশট ও আইডি জমা দিন',
      reward: 5,
      link: 'https://t.me/RF2_SMM',
      icon: 'fab fa-telegram-plane'
    },
    {
      id: 'task_fb',
      title: '2. Facebook পেজ লাইক ও ফলো করুন',
      description: 'ফেসবুক পেজে লাইক দিয়ে ফলো করার স্ক্রিনশট দিন',
      reward: 5,
      link: 'https://www.facebook.com/share/1EKKUHMxCw/',
      icon: 'fab fa-facebook'
    },
    {
      id: 'task_yt',
      title: '3. YouTube চ্যানেল সাবস্ক্রাইব করুন',
      description: 'ইউটিউব চ্যানেল সাবস্ক্রাইব করে স্ক্রিনশট দিন',
      reward: 5,
      link: 'https://youtube.com',
      icon: 'fab fa-youtube'
    }
  ]);
  const [selectedTaskForProof, setSelectedTaskForProof] = useState<TaskItem | null>(null);
  const [taskProofNotes, setTaskProofNotes] = useState('');
  const [taskProofScreenshots, setTaskProofScreenshots] = useState<string[]>([]);
  const [taskSubmitting, setTaskSubmitting] = useState(false);
  const [adminTaskFilter, setAdminTaskFilter] = useState<'all' | 'Pending' | 'Approved' | 'Rejected'>('all');

  // Admin New Task Creation State
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskReward, setNewTaskReward] = useState('5');
  const [newTaskLink, setNewTaskLink] = useState('');
  const [newTaskIcon, setNewTaskIcon] = useState('fas fa-tasks');
  const [newTaskImage, setNewTaskImage] = useState<string | null>(null);

  // Mailbox System State
  const [showMailboxModal, setShowMailboxModal] = useState(false);
  const [mailboxTab, setMailboxTab] = useState<'inbox' | 'compose'>('inbox');
  const [mailSubject, setMailSubject] = useState('');
  const [mailMessage, setMailMessage] = useState('');
  const [mailSubmitting, setMailSubmitting] = useState(false);
  const [mailList, setMailList] = useState<Array<{
    id: string;
    sender: string;
    subject: string;
    message: string;
    time: string;
    unread: boolean;
    isAdminReply?: boolean;
  }>>([
    {
      id: 'm1',
      sender: 'Admin Support',
      subject: 'Welcome to SMM Panel Support',
      message: 'Hello! Thank you for joining us. If you need custom packages or support, reply here or contact us via Telegram.',
      time: 'Today 10:00 AM',
      unread: true,
      isAdminReply: true
    },
    {
      id: 'm2',
      sender: 'System Notice',
      subject: 'Order Completion Speed Notice',
      message: 'Facebook Followers & TikTok Views start within 1-5 minutes of placing your order.',
      time: 'Yesterday',
      unread: false,
      isAdminReply: true
    }
  ]);

  // Modal Confirm State
  const [modalConfig, setModalConfig] = useState<{
    show: boolean;
    title: string;
    bodyHtml: React.ReactNode;
    onConfirm: () => void;
  }>({
    show: false,
    title: '',
    bodyHtml: null,
    onConfirm: () => {}
  });

  // Toasts
  const [toasts, setToasts] = useState<Array<{ id: number; message: string; type: string }>>([]);

  const tg = (window as any).Telegram?.WebApp || null;

  // Haptic Feedback Helper
  const haptic = (type: 'light' | 'heavy' | 'success' | 'error' = 'light') => {
    if (!tg?.HapticFeedback) return;
    try {
      if (type === 'success') tg.HapticFeedback.notificationOccurred('success');
      else if (type === 'error') tg.HapticFeedback.notificationOccurred('error');
      else if (type === 'heavy') tg.HapticFeedback.impactOccurred('heavy');
      else tg.HapticFeedback.impactOccurred('light');
    } catch (_) {}
  };

  const showToast = (message: string, type: 'info' | 'success' | 'error' | 'warning' = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  // Claim Task Reward Handler
  const handleClaimTask = async (taskId: string, rewardAmt: number, taskTitle: string) => {
    if (claimedTasks.includes(taskId)) {
      showToast('You have already claimed this task reward!', 'info');
      return;
    }
    if (!currentUser) {
      showToast('Please login to claim tasks', 'error');
      return;
    }

    try {
      const newBal = userBalance + rewardAmt;
      await updateDoc(doc(db, 'users', currentUser.uid), {
        balance: newBal
      });
      setUserBalance(newBal);
      setClaimedTasks((prev) => [...prev, taskId]);
      showToast(`🎉 ৳${rewardAmt} added for completing "${taskTitle}"!`, 'success');
      haptic('success');
    } catch (e: any) {
      console.error('Task claim error:', e);
      setUserBalance((prev) => prev + rewardAmt);
      setClaimedTasks((prev) => [...prev, taskId]);
      showToast(`🎉 ৳${rewardAmt} added to your balance!`, 'success');
      haptic('success');
    }
  };

  // Simple Password Hash
  const simpleHash = async (str: string) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(str + 'firstsmm_salt_2024');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  // 1. Initial Load & Auto Login Check
  useEffect(() => {
    if (tg) {
      try {
        tg.ready();
        tg.expand();
      } catch (_) {}
    }

    // Auto-detect referral code from URL query parameters (?ref=username or ?r=username)
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const refCode = urlParams.get('ref') || urlParams.get('r');
      if (refCode && refCode.trim()) {
        const cleanRef = refCode.trim().toLowerCase();
        localStorage.setItem('smm_referral_ref', cleanRef);
        setRegReferralCode(cleanRef);
      } else {
        const savedRef = localStorage.getItem('smm_referral_ref');
        if (savedRef) {
          setRegReferralCode(savedRef.trim().toLowerCase());
        }
      }
    } catch (err) {
      console.log('Referral param parsing note:', err);
    }

    const initApp = async () => {
      try {
        const saved = localStorage.getItem('smm_session');
        if (saved) {
          const session = JSON.parse(saved);
          if (session && session.uid && session.username) {
            setCurrentUser(session);
            if (session.photoURL) setUserPhotoURL(session.photoURL);
            setIsLoggedIn(true);
            setShowWelcomeModal(true);

            // Attempt background sync without deleting session if rules or offline
            try {
              const uSnap = await getDoc(doc(db, 'auth_users', session.uid));
              if (uSnap.exists()) {
                const uData = uSnap.data();
                if (uData && uData.name) {
                  setCurrentUser((prev) => prev ? { ...prev, name: uData.name, photoURL: uData.photoURL || prev.photoURL } : prev);
                }
              }
            } catch (syncErr) {
              console.warn('Profile background verification notice:', syncErr);
            }
          }
        }
      } catch (err) {
        console.warn('Session init notice:', err);
      }

      setTimeout(() => {
        setShowSplash(false);
      }, 1500);
    };

    initApp();
  }, []);

  // 2. Realtime User Info Sync
  useEffect(() => {
    if (!isLoggedIn || !currentUser?.uid) return;
    const currentUid = currentUser.uid;
    const currentName = currentUser.name;
    const currentPhoto = currentUser.photoURL;

    const userRef = doc(db, 'users', currentUid);

    // Initialize user doc if missing
    getDoc(userRef).then(async (snap) => {
      if (!snap.exists()) {
        await setDoc(userRef, {
          name: currentName || 'User',
          balance: 0,
          total_orders: 0,
          totalReferrals: 0,
          totalReferralEarnings: 0,
          photoURL: currentPhoto || '',
          createdAt: serverTimestamp()
        }).catch((err) => {
          console.warn('User doc init notice:', err?.message || err);
        });
      }
    }).catch((err) => {
      console.warn('User doc check notice:', err?.message || err);
    });

    const unsubscribe = onSnapshot(
      userRef,
      (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          const bal = typeof d.balance === 'number' ? d.balance : 0;
          const ord = typeof d.total_orders === 'number' ? d.total_orders : 0;
          const refs = typeof d.totalReferrals === 'number' ? d.totalReferrals : 0;
          const earn = typeof d.totalReferralEarnings === 'number' ? d.totalReferralEarnings : 0;

          setUserBalance((prev) => (prev !== bal ? bal : prev));
          setUserTotalOrders((prev) => (prev !== ord ? ord : prev));
          setUserTotalReferrals((prev) => (prev !== refs ? refs : prev));
          setUserReferralEarnings((prev) => (prev !== earn ? earn : prev));
          if (d.photoURL) {
            setUserPhotoURL((prev) => (prev !== d.photoURL ? d.photoURL : prev));
          }
          if (d.name) {
            setCurrentUser((prev) => {
              if (!prev) return prev;
              if (prev.name === d.name && (!d.photoURL || prev.photoURL === d.photoURL)) {
                return prev;
              }
              return { ...prev, name: d.name, photoURL: d.photoURL || prev?.photoURL };
            });
          }
        }
      },
      (err) => {
        console.warn('User listener sync notice:', err?.message || err);
      }
    );

    return () => unsubscribe();
  }, [isLoggedIn, currentUser?.uid]);

  // 3. Realtime Services Loading (Pure Read - No Auto Save or Auto Seed)
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'services'), (snapshot) => {
      const list: ServiceData[] = [];
      const catsSet = new Set<string>();

      snapshot.forEach((d) => {
        const data = { id: d.id, ...d.data() } as ServiceData;
        list.push(data);
        if (data.category) catsSet.add(data.category);
      });

      setAllServices(list);
      setCategories(Array.from(catsSet).sort());
    }, (err) => {
      console.warn('Services sync notice:', err.message);
    });

    return () => unsub();
  }, []);

  // 4. Realtime Orders Sync
  useEffect(() => {
    if (!isLoggedIn || !currentUser?.uid) return;

    const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: OrderData[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.uid === currentUser.uid) {
          list.push({ id: docSnap.id, ...data } as OrderData);
        }
      });
      setOrdersList(list);
    }, (err) => {
      console.warn('Orders sync notice:', err.message);
    });

    return () => unsub();
  }, [isLoggedIn, currentUser?.uid]);

  // 5. Realtime User Deposit Requests Sync
  useEffect(() => {
    if (!isLoggedIn || !currentUser?.uid) return;

    const q = query(
      collection(db, 'deposit_requests'),
      where('uid', '==', currentUser.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list: DepositRequest[] = [];
        snapshot.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as DepositRequest);
        });
        // Client-side sort descending by timestamp avoids Firestore composite index requirement
        list.sort((a, b) => {
          const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
          const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
          return timeB - timeA;
        });
        setDepositHistory(list);
      },
      (err) => {
        console.warn('Deposit history sync notice:', err.message);
      }
    );

    return () => unsub();
  }, [isLoggedIn, currentUser?.uid]);

  // 6. Realtime All Deposit Requests Sync (Admin View)
  useEffect(() => {
    if (!isAdminUser) return;
    const q = query(collection(db, 'deposit_requests'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: DepositRequest[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as DepositRequest);
      });
      setAllDepositRequests(list);
    }, (err) => {
      console.warn('All deposit requests sync notice:', err.message);
    });
    return () => unsub();
  }, [isAdminUser]);

  // 7. Realtime All Users Sync (Admin View)
  useEffect(() => {
    if (!isAdminUser) return;
    const unsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const list: Array<{ uid: string; name?: string; balance?: number; total_orders?: number }> = [];
      snapshot.forEach((docSnap) => {
        list.push({ uid: docSnap.id, ...docSnap.data() });
      });
      setAllUsersList(list);
    }, (err) => {
      console.warn('All users sync notice:', err.message);
    });
    return () => unsub();
  }, [isAdminUser]);

  // 8. Realtime All Orders Sync (Admin View)
  useEffect(() => {
    if (!isAdminUser) return;
    const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: OrderData[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as OrderData);
      });
      setAllAdminOrdersList(list);
    }, (err) => {
      console.warn('All admin orders sync notice:', err.message);
    });
    return () => unsub();
  }, [isAdminUser]);

  // 9. Realtime Task Submissions & Custom Tasks Sync
  useEffect(() => {
    let unsubSubmissions = () => {};
    if (isAdminUser) {
      unsubSubmissions = onSnapshot(
        collection(db, 'task_submissions'),
        (snapshot) => {
          const list: TaskSubmission[] = [];
          snapshot.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as TaskSubmission);
          });
          // Sort newest first
          list.sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
          setAllTaskSubmissions(list);
        },
        (err) => {
          console.warn('Task submissions sync notice:', err.message);
        }
      );
    }

    const unsubTasks = onSnapshot(
      collection(db, 'tasks'),
      (snapshot) => {
        if (!snapshot.empty) {
          const tList: TaskItem[] = [];
          snapshot.forEach((docSnap) => {
            tList.push({ id: docSnap.id, ...docSnap.data() } as TaskItem);
          });
          setCustomTasks(tList);
        }
      },
      (err) => {
        console.warn('Tasks sync notice:', err.message);
      }
    );

    return () => {
      unsubSubmissions();
      unsubTasks();
    };
  }, [isAdminUser]);

  // 10. Realtime Referral Config & Commissions Sync
  useEffect(() => {
    // Sync Referral Config
    const unsubCfg = onSnapshot(
      doc(db, 'settings', 'referral_config'),
      (snap) => {
        if (snap.exists()) {
          const d = snap.data();
          setReferralConfig({
            enabled: d.enabled !== false,
            bonusPercent: typeof d.bonusPercent === 'number' ? d.bonusPercent : 5,
            websiteUrl: d.websiteUrl || '',
          });
        }
      },
      (err) => {
        console.warn('Referral config sync notice:', err.message);
      }
    );

    let unsubAll = () => {};
    if (isAdminUser) {
      const qAll = query(collection(db, 'referral_commissions'), orderBy('timestamp', 'desc'));
      unsubAll = onSnapshot(
        qAll,
        (snap) => {
          const list: ReferralCommission[] = [];
          snap.forEach((d) => list.push({ id: d.id, ...d.data() } as ReferralCommission));
          setAllReferralCommissions(list);
        },
        (err) => {
          console.warn('Admin referral commissions sync notice:', err.message);
        }
      );
    }

    return () => {
      unsubCfg();
      unsubAll();
    };
  }, [isAdminUser]);

  // 11. Realtime Current User Referral Commissions & Stats Sync
  useEffect(() => {
    if (!isLoggedIn || !currentUser?.uid) return;
    const qUser = query(
      collection(db, 'referral_commissions'),
      where('referrerUid', '==', currentUser.uid)
    );
    const unsub = onSnapshot(qUser, (snap) => {
      const list: ReferralCommission[] = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() } as ReferralCommission));
      list.sort((a, b) => {
        const timeA = a.timestamp?.seconds || 0;
        const timeB = b.timestamp?.seconds || 0;
        return timeB - timeA;
      });
      setUserReferralCommissions(list);
      const earned = list.reduce((sum, item) => sum + (item.commissionAmount || 0), 0);
      setUserReferralEarnings(earned);
    }, (err) => {
      console.log('User referral commissions sync:', err.message);
    });
    return () => unsub();
  }, [isLoggedIn, currentUser?.uid]);

  // Sync user total referrals count from allUsersList
  useEffect(() => {
    if (!currentUser?.uid) return;
    const myUid = currentUser.uid;
    const myUsername = (currentUser.username || '').toLowerCase();
    const count = allUsersList.filter(
      (u: any) =>
        (u.referredBy && (u.referredBy === myUid || u.referredBy.toLowerCase() === myUsername)) ||
        (u.referredByUsername && u.referredByUsername.toLowerCase() === myUsername)
    ).length;
    setUserTotalReferrals((prev) => (prev !== count ? count : prev));
  }, [allUsersList, currentUser?.uid, currentUser?.username]);

  // 10. Realtime Gateway Countdown Timer
  useEffect(() => {
    if (depositStep !== 'gateway') {
      setGatewayTimeLeft(900);
      return;
    }
    const interval = setInterval(() => {
      setGatewayTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [depositStep]);

  const formatGatewayTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Screenshot File Selection Handler (Up to 5 Screenshots)
  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const currentCount = taskProofScreenshots.length;
    if (currentCount >= 5) {
      showToast('Maximum 5 screenshots allowed per task proof!', 'warning');
      return;
    }

    const remainingSlots = 5 - currentCount;
    const selectedFiles: File[] = Array.from(files).slice(0, remainingSlots) as File[];

    try {
      const base64Results: string[] = [];
      for (const file of selectedFiles) {
        const compressed = await compressImageToBase64(file);
        base64Results.push(compressed);
      }
      setTaskProofScreenshots((prev) => [...prev, ...base64Results]);
      showToast(`Added ${base64Results.length} screenshot(s)!`, 'success');
      haptic('light');
    } catch (err) {
      console.error('Error uploading screenshots:', err);
      showToast('Failed to process screenshot image', 'error');
    }
  };

  const handleRemoveScreenshot = (index: number) => {
    setTaskProofScreenshots((prev) => prev.filter((_, i) => i !== index));
    haptic('heavy');
  };

  // Submit Task Proof Handler with up to 5 Screenshots
  const handleSubmitTaskProof = async () => {
    if (!selectedTaskForProof) return;
    if (!currentUser) {
      showToast('Please login to submit task proof', 'error');
      return;
    }
    if (!taskProofNotes.trim() && taskProofScreenshots.length === 0) {
      showToast('Please write proof details or upload at least 1 screenshot!', 'error');
      return;
    }

    setTaskSubmitting(true);
    try {
      const newSubmissionDoc = {
        taskId: selectedTaskForProof.id,
        taskTitle: selectedTaskForProof.title,
        reward: selectedTaskForProof.reward,
        userId: currentUser.uid,
        userName: currentUser.displayName || currentUser.email || 'User',
        proofText: taskProofNotes.trim(),
        screenshots: taskProofScreenshots,
        status: 'Pending',
        submittedAt: new Date().toLocaleString()
      };

      const docRef = await addDoc(collection(db, 'task_submissions'), newSubmissionDoc);

      setAllTaskSubmissions((prev) => [{ id: docRef.id, ...newSubmissionDoc } as TaskSubmission, ...prev]);

      showToast('🎉 Task proof submitted with screenshots! Waiting for admin review.', 'success');
      haptic('success');
      setSelectedTaskForProof(null);
      setTaskProofNotes('');
      setTaskProofScreenshots([]);
    } catch (e: any) {
      console.error('Error submitting task proof:', e);
      showToast('Failed to submit proof: ' + e.message, 'error');
    } finally {
      setTaskSubmitting(false);
    }
  };

  // Admin Actions: Approve Task Submission & Credit Balance
  const handleApproveTaskSubmission = async (sub: TaskSubmission) => {
    try {
      await updateDoc(doc(db, 'task_submissions', sub.id), {
        status: 'Approved',
        approvedAt: serverTimestamp()
      });

      const uSnap = await getDoc(doc(db, 'users', sub.userId));
      const currBal = uSnap.exists() ? (uSnap.data().balance || 0) : 0;
      const newBal = currBal + sub.reward;

      await updateDoc(doc(db, 'users', sub.userId), {
        balance: newBal
      });

      setAllTaskSubmissions((prev) =>
        prev.map((item) => (item.id === sub.id ? { ...item, status: 'Approved' } : item))
      );

      showToast(`✅ Approved proof & credited ৳${sub.reward} to user ${sub.userName}!`, 'success');
      haptic('success');
    } catch (e: any) {
      console.error('Error approving task proof:', e);
      showToast('Failed to approve task proof: ' + e.message, 'error');
    }
  };

  // Admin Actions: Reject Task Submission
  const handleRejectTaskSubmission = async (subId: string) => {
    try {
      await updateDoc(doc(db, 'task_submissions', subId), {
        status: 'Rejected',
        rejectedAt: serverTimestamp()
      });

      setAllTaskSubmissions((prev) =>
        prev.map((item) => (item.id === subId ? { ...item, status: 'Rejected' } : item))
      );

      showToast('Task submission rejected', 'warning');
      haptic('heavy');
    } catch (e: any) {
      console.error('Error rejecting task proof:', e);
      showToast('Failed to reject task submission.', 'error');
    }
  };

  // Admin Image Upload Handlers
  const handleAdminTaskImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToBase64(file);
      setNewTaskImage(compressed);
      showToast('✅ Task image attached successfully!', 'success');
      haptic('light');
    } catch (err) {
      console.error('Error uploading task image:', err);
      showToast('Failed to process image file', 'error');
    }
  };

  const handleAdminBroadcastImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToBase64(file);
      setBroadcastImage(compressed);
      showToast('✅ Broadcast banner image attached!', 'success');
      haptic('light');
    } catch (err) {
      console.error('Error uploading broadcast image:', err);
      showToast('Failed to process image file', 'error');
    }
  };

  // Profile Picture Upload Handler
  const handleProfilePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.uid) return;

    try {
      setProfileSubmitting(true);
      const compressed = await compressImageToBase64(file);
      setUserPhotoURL(compressed);

      // Update Firestore user document
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { photoURL: compressed }, { merge: true });

      // Update local session
      const updatedUser = { ...currentUser, photoURL: compressed };
      setCurrentUser(updatedUser);
      localStorage.setItem('smm_session', JSON.stringify(updatedUser));

      showToast('✅ প্রোফাইল পিকচার সফলভাবে আপডেট হয়েছে!', 'success');
      haptic('success');
    } catch (err: any) {
      console.error('Error updating profile photo:', err);
      showToast('Failed to update profile photo', 'error');
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Remove Profile Photo
  const handleRemoveProfilePic = async () => {
    if (!currentUser?.uid) return;

    try {
      setProfileSubmitting(true);
      setUserPhotoURL(null);

      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { photoURL: '' }, { merge: true });

      const updatedUser = { ...currentUser, photoURL: '' };
      setCurrentUser(updatedUser);
      localStorage.setItem('smm_session', JSON.stringify(updatedUser));

      showToast('প্রোফাইল পিকচার সরানো হয়েছে', 'info');
      haptic('light');
    } catch (err) {
      console.error('Error removing profile photo:', err);
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Update Display Name
  const handleUpdateUserName = async () => {
    if (!editUserName.trim() || !currentUser?.uid) return;

    try {
      setProfileSubmitting(true);
      const newName = editUserName.trim();

      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { name: newName }, { merge: true });

      const updatedUser = { ...currentUser, name: newName };
      setCurrentUser(updatedUser);
      localStorage.setItem('smm_session', JSON.stringify(updatedUser));

      setIsEditingName(false);
      showToast('✅ নাম সফলভাবে পরিবর্তিত হয়েছে!', 'success');
      haptic('success');
    } catch (err) {
      console.error('Error updating name:', err);
      showToast('Failed to update name', 'error');
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Update Username (ইউজার নাম পরিবর্তন)
  const handleUpdateUserUsername = async () => {
    if (!currentUser?.uid) return;
    setEditUserUsernameErr('');
    const newUsername = editUserUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!newUsername || newUsername.length < 3) {
      setEditUserUsernameErr('ইউজার নাম কমপক্ষে ৩ অক্ষরের হতে হবে (letters, numbers, _)');
      haptic('error');
      return;
    }
    if (newUsername === currentUser.username?.toLowerCase()) {
      setIsEditingUsername(false);
      return;
    }

    try {
      setProfileSubmitting(true);
      haptic('light');

      // Check if username is already taken by someone else
      const qCheck = query(collection(db, 'auth_users'), where('username', '==', newUsername));
      const snapCheck = await getDocs(qCheck);
      const isTaken = snapCheck.docs.some((d) => d.id !== currentUser.uid);

      if (isTaken) {
        setEditUserUsernameErr('এই ইউজার নামটি অন্য কেউ ব্যবহার করছে! অন্য নাম নির্বাচন করুন।');
        haptic('error');
        return;
      }

      // Update in users collection
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, { username: newUsername }, { merge: true });

      // Update in auth_users collection
      const authUserRef = doc(db, 'auth_users', currentUser.uid);
      await setDoc(authUserRef, { username: newUsername }, { merge: true });

      const updatedUser = { ...currentUser, username: newUsername };
      setCurrentUser(updatedUser);
      localStorage.setItem('smm_session', JSON.stringify(updatedUser));

      setIsEditingUsername(false);
      showToast('✅ ইউজার নাম সফলভাবে পরিবর্তিত হয়েছে!', 'success');
      haptic('success');
    } catch (err: any) {
      console.error('Error updating username:', err);
      setEditUserUsernameErr('ইউজার নাম পরিবর্তনে সমস্যা: ' + (err.message || 'Error'));
      haptic('error');
    } finally {
      setProfileSubmitting(false);
    }
  };

  // Change Password (পাসওয়ার্ড পরিবর্তন)
  const handleChangePassword = async () => {
    if (!currentUser?.uid) return;
    setChangePassErr('');
    setChangePassSuccess('');

    if (!currentPasswordInput) {
      setChangePassErr('বর্তমান পাসওয়ার্ড লিখুন (Current password required)');
      haptic('error');
      return;
    }
    if (!newPasswordInput || newPasswordInput.length < 6) {
      setChangePassErr('নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে (Min 6 chars)');
      haptic('error');
      return;
    }
    if (newPasswordInput !== confirmNewPasswordInput) {
      setChangePassErr('নতুন পাসওয়ার্ড দুটি মিলছে না (Passwords do not match)');
      haptic('error');
      return;
    }

    try {
      setChangePassSubmitting(true);
      haptic('light');

      const authUserRef = doc(db, 'auth_users', currentUser.uid);
      const authSnap = await getDoc(authUserRef);

      if (!authSnap.exists()) {
        setChangePassErr('ইউজার একাউন্ট পাওয়া যায়নি');
        haptic('error');
        return;
      }

      const authData = authSnap.data();
      const hashedCurrent = await simpleHash(currentPasswordInput);

      if (authData.password && authData.password !== hashedCurrent) {
        setChangePassErr('বর্তমান পাসওয়ার্ডটি সঠিক নয় (Incorrect current password)');
        haptic('error');
        return;
      }

      const hashedNew = await simpleHash(newPasswordInput);
      await updateDoc(authUserRef, {
        password: hashedNew,
        passwordUpdatedAt: serverTimestamp()
      });

      setChangePassSuccess('✅ পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে!');
      showToast('পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে! 🔒', 'success');
      haptic('success');
      setCurrentPasswordInput('');
      setNewPasswordInput('');
      setConfirmNewPasswordInput('');
      setTimeout(() => {
        setShowChangePassModal(false);
        setChangePassSuccess('');
      }, 1500);
    } catch (err: any) {
      console.error('Error changing password:', err);
      setChangePassErr('পাসওয়ার্ড পরিবর্তনে সমস্যা: ' + (err.message || 'Error'));
      haptic('error');
    } finally {
      setChangePassSubmitting(false);
    }
  };

  // Admin Actions: Create Custom Task
  const handleCreateAdminTask = async () => {
    if (!newTaskTitle.trim()) {
      showToast('Please enter task title', 'error');
      return;
    }
    const rewardVal = parseFloat(newTaskReward) || 5;

    const newTaskDoc = {
      title: newTaskTitle.trim(),
      description: newTaskDesc.trim() || 'Complete task & submit screenshot proof',
      reward: rewardVal,
      link: newTaskLink.trim() || '#',
      icon: newTaskIcon || 'fas fa-tasks',
      image: newTaskImage || ''
    };

    try {
      const docRef = await addDoc(collection(db, 'tasks'), newTaskDoc);
      setCustomTasks((prev) => [{ id: docRef.id, ...newTaskDoc }, ...prev]);
      showToast('✅ New task created successfully!', 'success');
      haptic('success');
      setNewTaskTitle('');
      setNewTaskDesc('');
      setNewTaskReward('5');
      setNewTaskLink('');
      setNewTaskImage(null);
    } catch (e: any) {
      console.error('Error creating task:', e);
      showToast('Failed to create task: ' + e.message, 'error');
    }
  };

  // Admin Actions: Delete Custom Task
  const handleDeleteAdminTask = async (taskId: string) => {
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
      setCustomTasks((prev) => prev.filter((t) => t.id !== taskId));
      showToast('Task deleted successfully', 'info');
      haptic('heavy');
    } catch (e: any) {
      console.error('Error deleting task:', e);
      showToast('Failed to delete task', 'error');
    }
  };

  // Admin Actions: User Balance Increase / Decrease / Set
  const handleSetUserBalance = async (uid: string, targetBalance: number) => {
    if (isNaN(targetBalance) || targetBalance < 0) {
      showToast('Please enter a valid balance amount', 'error');
      return;
    }
    try {
      await updateDoc(doc(db, 'users', uid), { balance: targetBalance });
      showToast(`User (${uid.slice(0, 8)}) balance set to ৳${targetBalance.toFixed(2)}`, 'success');
      haptic('success');
    } catch (e) {
      console.error('Error updating user balance:', e);
      showToast('Failed to update balance.', 'error');
    }
  };

  const handleAddUserBalance = async (uid: string, addAmount: number) => {
    if (isNaN(addAmount) || addAmount <= 0) {
      showToast('Enter a positive amount to add', 'error');
      return;
    }
    try {
      const uSnap = await getDoc(doc(db, 'users', uid));
      const curr = uSnap.exists() ? (uSnap.data().balance || 0) : 0;
      const newBal = curr + addAmount;
      await updateDoc(doc(db, 'users', uid), { balance: newBal });
      showToast(`Added +৳${addAmount} → New balance: ৳${newBal.toFixed(2)}`, 'success');
      haptic('success');
    } catch (e) {
      console.error('Error adding balance:', e);
      showToast('Failed to add balance.', 'error');
    }
  };

  const handleSubtractUserBalance = async (uid: string, subAmount: number) => {
    if (isNaN(subAmount) || subAmount <= 0) {
      showToast('Enter a positive amount to subtract', 'error');
      return;
    }
    try {
      const uSnap = await getDoc(doc(db, 'users', uid));
      const curr = uSnap.exists() ? (uSnap.data().balance || 0) : 0;
      const newBal = Math.max(0, curr - subAmount);
      await updateDoc(doc(db, 'users', uid), { balance: newBal });
      showToast(`Subtracted -৳${subAmount} → New balance: ৳${newBal.toFixed(2)}`, 'info');
      haptic('heavy');
    } catch (e) {
      console.error('Error subtracting balance:', e);
      showToast('Failed to subtract balance.', 'error');
    }
  };

  // Helper: Award Referral Deposit Bonus (5% Cash Commission) to Referrer upon Deposit Approval
  const processReferralDepositBonus = async (
    depositingUid: string,
    depositAmount: number,
    depTrxOrId: string
  ) => {
    try {
      if (depositAmount <= 0 || !depositingUid) return;

      // 1. Get Depositing User Data from users, auth_users, and deposit_requests
      const uSnap = await getDoc(doc(db, 'users', depositingUid));
      const userData: any = uSnap.exists() ? uSnap.data() : {};
      
      const authSnap = await getDoc(doc(db, 'auth_users', depositingUid));
      const authData: any = authSnap.exists() ? authSnap.data() : {};

      let referrerKey = (userData.referredBy || authData.referredBy || '').trim();
      let referrerUsername = (userData.referredByUsername || authData.referredByUsername || '').trim();

      // Check deposit request document if needed
      if (!referrerKey && depTrxOrId) {
        try {
          const depDoc = await getDoc(doc(db, 'deposit_requests', depTrxOrId));
          if (depDoc.exists()) {
            const dd = depDoc.data();
            referrerKey = (dd.referredBy || dd.referredByUsername || '').trim();
            if (!referrerUsername && dd.referredByUsername) referrerUsername = dd.referredByUsername;
          }
        } catch (_) {}
      }

      if (!referrerKey && referrerUsername) {
        referrerKey = referrerUsername;
      }

      if (!referrerKey) {
        console.log('No referrer configured for user:', depositingUid);
        return;
      }

      const cleanKey = referrerKey.replace(/^@+/, '').trim().toLowerCase();
      if (!cleanKey || cleanKey === depositingUid.toLowerCase()) return;

      // 2. Resolve Referrer UID and Info across users and auth_users
      let resolvedReferrerUid: string | null = null;
      let resolvedReferrerUsername = referrerUsername || cleanKey;
      let resolvedReferrerName = 'Friend';

      // Check direct UID lookup
      const directUserSnap = await getDoc(doc(db, 'users', cleanKey));
      if (directUserSnap.exists()) {
        resolvedReferrerUid = cleanKey;
        const d = directUserSnap.data();
        resolvedReferrerUsername = d.username || resolvedReferrerUsername;
        resolvedReferrerName = d.name || resolvedReferrerUsername;
      } else {
        const directAuthSnap = await getDoc(doc(db, 'auth_users', cleanKey));
        if (directAuthSnap.exists()) {
          resolvedReferrerUid = cleanKey;
          const d = directAuthSnap.data();
          resolvedReferrerUsername = d.username || resolvedReferrerUsername;
          resolvedReferrerName = d.name || resolvedReferrerUsername;
        }
      }

      // If not resolved by UID, query by username in auth_users
      if (!resolvedReferrerUid) {
        const qAuth = query(collection(db, 'auth_users'), where('username', '==', cleanKey));
        const snapAuth = await getDocs(qAuth);
        if (!snapAuth.empty) {
          resolvedReferrerUid = snapAuth.docs[0].id;
          const d = snapAuth.docs[0].data();
          resolvedReferrerUsername = d.username || cleanKey;
          resolvedReferrerName = d.name || resolvedReferrerUsername;
        }
      }

      // If still not resolved, query by username in users
      if (!resolvedReferrerUid) {
        const qUser = query(collection(db, 'users'), where('username', '==', cleanKey));
        const snapUser = await getDocs(qUser);
        if (!snapUser.empty) {
          resolvedReferrerUid = snapUser.docs[0].id;
          const d = snapUser.docs[0].data();
          resolvedReferrerUsername = d.username || cleanKey;
          resolvedReferrerName = d.name || resolvedReferrerUsername;
        }
      }

      // Fallback: search in local allUsersList state
      if (!resolvedReferrerUid && allUsersList && allUsersList.length > 0) {
        const matched = allUsersList.find(
          (u: any) =>
            u.uid === cleanKey ||
            (u.username && u.username.toLowerCase() === cleanKey)
        );
        if (matched) {
          resolvedReferrerUid = matched.uid;
          resolvedReferrerUsername = matched.username || cleanKey;
          resolvedReferrerName = matched.name || resolvedReferrerUsername;
        }
      }

      // Final fallback to cleanKey
      if (!resolvedReferrerUid) {
        resolvedReferrerUid = cleanKey;
      }

      if (!resolvedReferrerUid || resolvedReferrerUid === depositingUid) return;

      // 3. Determine 5% Bonus Commission
      let bonusPercent = 5;
      if (referralConfig && typeof referralConfig.bonusPercent === 'number' && referralConfig.bonusPercent > 0) {
        bonusPercent = referralConfig.bonusPercent;
      }

      try {
        const cfgSnap = await getDoc(doc(db, 'settings', 'referral_config'));
        if (cfgSnap.exists()) {
          const d = cfgSnap.data();
          if (d.enabled === false) return;
          if (typeof d.bonusPercent === 'number' && d.bonusPercent > 0) {
            bonusPercent = d.bonusPercent;
          }
        }
      } catch (e) {}

      if (bonusPercent <= 0) return;

      const commission = Math.round((depositAmount * (bonusPercent / 100)) * 100) / 100;
      if (commission <= 0) return;

      // 4. Safely credit Referrer Balance & Update Stats
      const targetUserDocRef = doc(db, 'users', resolvedReferrerUid);
      const targetSnap = await getDoc(targetUserDocRef);
      const prevBal = targetSnap.exists() ? (Number(targetSnap.data().balance) || 0) : 0;
      const prevEarnings = targetSnap.exists() ? (Number(targetSnap.data().totalReferralEarnings) || 0) : 0;
      const prevRefs = targetSnap.exists() ? (Number(targetSnap.data().totalReferrals) || 1) : 1;

      const newBal = Math.round((prevBal + commission) * 100) / 100;
      const newEarn = Math.round((prevEarnings + commission) * 100) / 100;

      await setDoc(
        targetUserDocRef,
        {
          balance: newBal,
          totalReferralEarnings: newEarn,
          totalReferrals: prevRefs,
          name: targetSnap.exists() ? (targetSnap.data().name || resolvedReferrerName) : resolvedReferrerName,
          username: resolvedReferrerUsername,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      // Instant state sync if active user is the referrer
      if (
        currentUser?.uid === resolvedReferrerUid ||
        (currentUser?.username || '').toLowerCase() === cleanKey
      ) {
        setUserBalance((prev) => (prev !== newBal ? newBal : prev));
        setUserReferralEarnings((prev) => (prev !== newEarn ? newEarn : prev));
        showToast(`🎉 ৳${commission.toFixed(2)} (${bonusPercent}%) রেফারেল ক্যাশ কমিশন আপনার ব্যালেন্সে যোগ হয়েছে!`, 'success');
      }

      // 5. Record in referral_commissions collection
      await addDoc(collection(db, 'referral_commissions'), {
        referrerUid: resolvedReferrerUid,
        referrerUsername: resolvedReferrerUsername,
        referredUid: depositingUid,
        referredUsername: userData.username || authData.username || userData.name || 'Friend',
        depositAmount: Number(depositAmount),
        bonusPercent: Number(bonusPercent),
        commissionAmount: commission,
        depositTrxId: depTrxOrId || '',
        status: 'Completed',
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString()
      });

      // 6. Push notification for Referrer
      await addDoc(collection(db, 'user_notifications'), {
        uid: resolvedReferrerUid,
        title: `🎁 ৳${commission.toFixed(2)} (${bonusPercent}%) রেফারেল কমিশন জমা হয়েছে!`,
        message: `আপনার রেফারেল ইউজার (@${userData.username || authData.username || userData.name || 'User'}) ৳${depositAmount} ডিপোজিট সম্পন্ন করায় আপনি ${bonusPercent}% ক্যাশ কমিশন হিসেবে ৳${commission.toFixed(2)} মূল ব্যালেন্সে পেয়ে গেছেন!`,
        type: 'promo',
        timestamp: serverTimestamp(),
        unread: true
      });

      console.log(`Successfully credited referral bonus: ৳${commission} to ${resolvedReferrerUsername} (${resolvedReferrerUid})`);
    } catch (err) {
      console.error('Error awarding referral bonus:', err);
    }
  };

  const handleApproveDepositCustom = async (depId: string, uid: string, originalAmount: number) => {
    const customStr = customDepAmounts[depId];
    const finalAmount = customStr !== undefined && !isNaN(parseFloat(customStr)) && parseFloat(customStr) >= 0
      ? parseFloat(customStr)
      : originalAmount;

    try {
      const uSnap = await getDoc(doc(db, 'users', uid));
      const currBal = uSnap.exists() ? (uSnap.data().balance || 0) : 0;
      const newBal = currBal + finalAmount;

      await updateDoc(doc(db, 'users', uid), { balance: newBal });
      await updateDoc(doc(db, 'deposit_requests', depId), {
        status: 'Approved',
        amount: finalAmount,
        approvedAt: serverTimestamp()
      });

      // Award 5% referral bonus to the inviter
      await processReferralDepositBonus(uid, finalAmount, depId);

      showToast(`Approved ৳${finalAmount} for user ${uid.slice(0, 8)}!`, 'success');
      haptic('success');
    } catch (e) {
      console.error('Error approving deposit:', e);
      showToast('Failed to approve deposit.', 'error');
    }
  };

  const handleRejectDeposit = async (depId: string) => {
    try {
      await updateDoc(doc(db, 'deposit_requests', depId), {
        status: 'Rejected',
        rejectedAt: serverTimestamp()
      });
      showToast('Deposit request rejected', 'warning');
      haptic('heavy');
    } catch (e) {
      console.error('Error rejecting deposit:', e);
      showToast('Failed to reject deposit.', 'error');
    }
  };

  // Sync Payment Methods Configuration from Firestore settings
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'payment_methods'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data && typeof data === 'object') {
            const normalized: Record<string, PaymentMethodConfig> = {};
            Object.entries(data).forEach(([key, val]: [string, any]) => {
              if (val && typeof val === 'object') {
                normalized[key] = {
                  ...val,
                  id: val.id || key,
                  label: val.label || key,
                  number: val.number || '',
                  active: val.active !== false
                };
              }
            });
            setPaymentMethodsConfig((prev) => ({
              ...prev,
              ...normalized
            }));
          }
        }
      },
      (err) => {
        console.warn('Payment methods sync notice:', err?.message || err);
      }
    );
    return () => unsub();
  }, []);

  // Sync Welcome 3D Voice & Announcement Configuration and Site Logo from Firestore settings
  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, 'settings', 'welcome_config'),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data) {
            const cfg = {
              title: data.title || 'ওয়েলকাম RF SMM PANEL!',
              text: data.text || 'ওয়েলকাম টু আর এফ এসএমএম প্যানেল। বাংলাদেশের এক নম্বর সোশ্যাল মিডিয়া মার্কেটিং প্ল্যাটফর্মে আপনাকে স্বাগতম।',
              enabled: data.enabled !== false,
              soundEnabled: data.soundEnabled !== false,
              show3DButton: data.show3DButton !== false,
              is3DCanvasGlobal: data.is3DCanvasGlobal !== false,
              showNoticeTicker: data.showNoticeTicker !== false,
              noticeText: data.noticeText || '⚡ ২৪/৭ ইনস্ট্যান্ট সার্ভিস সক্রিয় | বিকাশ, নগদ, রকেটে ইনস্ট্যান্ট ডিপোজিট বোনাস চলছে | যেকোনো প্রয়োজনে আমাদের লাইভ সাপোর্টে যোগাযোগ করুন 🚀',
              audioMode: (data.audioMode === 'custom' ? 'custom' : 'tts') as 'tts' | 'custom',
              customAudioUrl: data.customAudioUrl || '',
              audioFileName: data.audioFileName || '',
              siteLogo: data.siteLogo || '',
              aiSupportEnabled: data.aiSupportEnabled !== undefined ? data.aiSupportEnabled : true,
            };
            setWelcomeConfig(cfg);
            setAdminWelcomeTitle(cfg.title);
            setAdminWelcomeText(cfg.text);
            setAdminWelcomeEnabled(cfg.enabled);
            setAdminSoundEnabled(cfg.soundEnabled);
            setAdminShow3DButton(cfg.show3DButton);
            setAdmin3DCanvasGlobal(cfg.is3DCanvasGlobal);
            setAdminShowNoticeTicker(cfg.showNoticeTicker);
            if (data.noticeText) {
              setAdminNoticeText(data.noticeText);
            }
            setAdminAudioMode(cfg.audioMode);
            setAdminCustomAudioUrl(cfg.customAudioUrl || '');
            setAdminAudioFileName(cfg.audioFileName || '');
            if (data.siteLogo) {
              setAdminSiteLogo(data.siteLogo);
              setAdminSiteLogoInput(data.siteLogo);
              localStorage.setItem('rf_smm_site_logo', data.siteLogo);
            }
          }
        }
      },
      (err) => {
        console.warn('Welcome config sync notice:', err?.message || err);
      }
    );
    return () => unsub();
  }, []);

  // Handle Custom Audio File Upload (MP3, WAV, M4A, OGG)
  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    let file: File | null = null;
    if ('dataTransfer' in e) {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        file = e.dataTransfer.files[0];
      }
    } else if (e.target.files && e.target.files.length > 0) {
      file = e.target.files[0];
    }

    if (!file) return;

    // Validate audio file
    if (!file.type.startsWith('audio/') && !file.name.match(/\.(mp3|wav|m4a|ogg|aac|webm)$/i)) {
      showToast('অনুগ্রহ করে শুধুমাত্র অডিও ফাইল (MP3, WAV, M4A, OGG) আপলোড করুন', 'error');
      return;
    }

    // Limit size (max 3MB for database storage)
    if (file.size > 3 * 1024 * 1024) {
      showToast('অডিও ফাইল সাইজ ৩MB এর কম হতে হবে', 'warning');
      return;
    }

    setAdminAudioUploading(true);
    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const dataUrl = uploadEvent.target?.result as string;
      if (dataUrl) {
        setAdminCustomAudioUrl(dataUrl);
        setAdminAudioFileName(file?.name || 'custom_voice.mp3');
        setAdminAudioMode('custom');
        showToast('🎵 অডিও ফাইল সফলভাবে লোড হয়েছে! প্লে করে শুনুন বা সেভ করুন।', 'success');
      }
      setAdminAudioUploading(false);
    };
    reader.onerror = () => {
      showToast('অডিও ফাইল পড়তে সমস্যা হয়েছে', 'error');
      setAdminAudioUploading(false);
    };
    reader.readAsDataURL(file);
  };

  // Start Mic Voice Recording
  const handleStartRecording = async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showToast('আপনার ব্রাউজারে মাইক্রোফোন রেকর্ডিং সাপোর্ট নেই', 'warning');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          setAdminCustomAudioUrl(base64Audio);
          setAdminAudioFileName(`recorded_voice_${new Date().toLocaleTimeString('en-US', { hour12: false })}.webm`);
          setAdminAudioMode('custom');
          showToast('🎙️ ভয়েস রেকর্ডিং সম্পন্ন হয়েছে! প্রিভিউ শুনুন এবং সেভ করুন।', 'success');
        };
        reader.readAsDataURL(audioBlob);
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setAdminIsRecording(true);
      setAdminRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setAdminRecordingDuration((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic record error:', err);
      showToast('মাইক্রোফোন পারমিশন পাওয়া যায়নি: ' + (err.message || ''), 'error');
    }
  };

  // Stop Mic Voice Recording
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setAdminIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // Toggle Custom Audio Play / Pause
  const handleTogglePlayCustomAudio = () => {
    if (!adminCustomAudioUrl) return;

    if (adminAudioPlaying && adminAudioPlayerRef.current) {
      adminAudioPlayerRef.current.pause();
      adminAudioPlayerRef.current.currentTime = 0;
      setAdminAudioPlaying(false);
    } else {
      if (adminAudioPlayerRef.current) {
        adminAudioPlayerRef.current.pause();
      }
      const audio = new Audio(adminCustomAudioUrl);
      adminAudioPlayerRef.current = audio;
      audio.onended = () => setAdminAudioPlaying(false);
      audio.onerror = () => {
        showToast('অডিও প্লে করতে সমস্যা হয়েছে', 'error');
        setAdminAudioPlaying(false);
      };
      audio.play().then(() => {
        setAdminAudioPlaying(true);
      }).catch((e) => {
        console.error('Audio play error:', e);
        setAdminAudioPlaying(false);
      });
    }
  };

  // Remove Uploaded Custom Audio
  const handleRemoveCustomAudio = () => {
    if (adminAudioPlayerRef.current) {
      adminAudioPlayerRef.current.pause();
      adminAudioPlayerRef.current = null;
    }
    setAdminAudioPlaying(false);
    setAdminCustomAudioUrl('');
    setAdminAudioFileName('');
    setAdminAudioMode('tts');
    showToast('কাস্টম অডিও মুছে ফেলা হয়েছে। এখন টেক্সট-টু-স্পিচ চালু থাকবে।', 'info');
  };

  // Instant Toggle Any Feature from Admin Panel with immediate Firestore sync
  const handleQuickToggleFeature = async (
    feature: 'soundEnabled' | 'enabled' | 'show3DButton' | 'is3DCanvasGlobal' | 'showNoticeTicker',
    value: boolean
  ) => {
    if (feature === 'soundEnabled') setAdminSoundEnabled(value);
    if (feature === 'enabled') setAdminWelcomeEnabled(value);
    if (feature === 'show3DButton') setAdminShow3DButton(value);
    if (feature === 'is3DCanvasGlobal') setAdmin3DCanvasGlobal(value);
    if (feature === 'showNoticeTicker') setAdminShowNoticeTicker(value);

    setWelcomeConfig((prev) => ({ ...prev, [feature]: value }));

    try {
      await setDoc(
        doc(db, 'settings', 'welcome_config'),
        { [feature]: value, updatedAt: serverTimestamp() },
        { merge: true }
      );
      showToast(
        value
          ? `✅ চালু করা হয়েছে (ON) - ইউজার প্যানেলে সক্রিয়`
          : `❌ বন্ধ করা হয়েছে (OFF) - ইউজার প্যানেলে আর দেখাবে না`,
        value ? 'success' : 'info'
      );
      haptic('light');
    } catch (err: any) {
      console.error('Feature toggle error:', err);
      showToast('সেটিংস আপডেট ব্যর্থ: ' + err.message, 'error');
    }
  };

  // Save Live Scrolling Notice Ticker (Admin Setting)
  const handleSaveNoticeText = async (textToSave?: string) => {
    const text = typeof textToSave === 'string' ? textToSave : adminNoticeText;
    if (!text.trim()) {
      showToast('নোটিশ টেক্সট খালি রাখা যাবে না', 'error');
      return;
    }
    setAdminSavingNotice(true);
    try {
      await setDoc(
        doc(db, 'settings', 'welcome_config'),
        {
          noticeText: text.trim(),
          showNoticeTicker: adminShowNoticeTicker,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setAdminNoticeText(text.trim());
      setWelcomeConfig((prev) => ({ ...prev, noticeText: text.trim() }));
      showToast('✅ হোম পেইজের স্ক্রলিং নোটিশ সফলভাবে আপডেট ও সেভ হয়েছে!', 'success');
      haptic('success');
    } catch (err: any) {
      console.error('Error saving notice text:', err);
      showToast('নোটিশ সেভ ব্যর্থ: ' + err.message, 'error');
    } finally {
      setAdminSavingNotice(false);
    }
  };

  // Save Welcome Voice, Sound & Display Configuration in Firestore (Admin Setting)
  const handleSaveWelcomeConfig = async () => {
    if (!adminWelcomeText.trim()) {
      showToast('ওয়েলকাম ভয়েস টেক্সট খালি রাখা যাবে না', 'error');
      return;
    }
    setAdminSavingWelcome(true);
    try {
      const configData = {
        title: adminWelcomeTitle.trim() || 'ওয়েলকাম RF SMM PANEL!',
        text: adminWelcomeText.trim(),
        enabled: adminWelcomeEnabled,
        soundEnabled: adminSoundEnabled,
        show3DButton: adminShow3DButton,
        is3DCanvasGlobal: admin3DCanvasGlobal,
        showNoticeTicker: adminShowNoticeTicker,
        noticeText: adminNoticeText.trim(),
        audioMode: adminAudioMode,
        customAudioUrl: adminCustomAudioUrl || '',
        audioFileName: adminAudioFileName || '',
        updatedAt: serverTimestamp(),
      };

      await setDoc(doc(db, 'settings', 'welcome_config'), configData, { merge: true });

      setWelcomeConfig({
        title: adminWelcomeTitle.trim() || 'ওয়েলকাম RF SMM PANEL!',
        text: adminWelcomeText.trim(),
        enabled: adminWelcomeEnabled,
        soundEnabled: adminSoundEnabled,
        show3DButton: adminShow3DButton,
        is3DCanvasGlobal: admin3DCanvasGlobal,
        showNoticeTicker: adminShowNoticeTicker,
        noticeText: adminNoticeText.trim(),
        audioMode: adminAudioMode,
        customAudioUrl: adminCustomAudioUrl || '',
        audioFileName: adminAudioFileName || '',
      });
      showToast('✅ সকল সাউন্ড ও ডিসপ্লে কনফিগারেশন সফলভাবে সেভ হয়েছে!', 'success');
      haptic('success');
    } catch (err: any) {
      console.error('Error saving welcome config:', err);
      showToast('ওয়েলকাম মেসেজ সেভ করতে ব্যর্থ: ' + err.message, 'error');
    } finally {
      setAdminSavingWelcome(false);
    }
  };

  // Handle Logo Upload from Local Device
  const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('শুধুমাত্র ছবি ফাইল আপলোড করুন (PNG, JPG, SVG, WebP)', 'error');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('লোগো ফাইলের সাইজ সর্বোচ্চ ৫MB হতে পারবে', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAdminSiteLogo(reader.result);
        setAdminSiteLogoInput(reader.result);
        localStorage.setItem('rf_smm_site_logo', reader.result);
        showToast('লোগো ছবি সিলেক্ট হয়েছে! সেভ বাটনে ক্লিক করে কনফার্ম করুন।', 'info');
      }
    };
    reader.readAsDataURL(file);
  };

  // Save Site Logo in Firestore and Local Storage
  const handleSaveSiteLogo = async (overrideLogo?: string) => {
    const logoToSave = (overrideLogo !== undefined ? overrideLogo : (adminSiteLogoInput.trim() || adminSiteLogo)).trim();
    setAdminSavingLogo(true);
    try {
      await setDoc(
        doc(db, 'settings', 'welcome_config'),
        {
          siteLogo: logoToSave,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      setAdminSiteLogo(logoToSave);
      setAdminSiteLogoInput(logoToSave);
      localStorage.setItem('rf_smm_site_logo', logoToSave);
      showToast(logoToSave ? '✅ সাইট ও হোম পেজ লোগো সফলভাবে সেভ হয়েছে!' : '✅ লোগো রিসেট করা হয়েছে!', 'success');
      haptic('success');
    } catch (err: any) {
      console.error('Error saving site logo:', err);
      showToast('লোগো সেভ করতে ব্যর্থ: ' + err.message, 'error');
    } finally {
      setAdminSavingLogo(false);
    }
  };

  // Handle Payment Deposit Receipt/Screenshot Upload
  const handleDepositReceiptUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    let file: File | null = null;
    if ('dataTransfer' in e) {
      e.preventDefault();
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        file = e.dataTransfer.files[0];
      }
    } else if (e.target.files && e.target.files.length > 0) {
      file = e.target.files[0];
    }
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('অনুগ্রহ করে শুধুমাত্র ছবি ফাইল আপলোড করুন (JPG, PNG, WEBP)', 'error');
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      showToast('ছবির সাইজ সর্বোচ্চ ৮MB হতে পারবে', 'error');
      return;
    }
    setDepositReceiptFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDepositReceiptImage(reader.result);
        showToast('📸 পেমেন্ট স্ক্রিনশট সফলভাবে যুক্ত হয়েছে!', 'success');
        haptic('light');
      }
    };
    reader.readAsDataURL(file);
  };

  // Test Speech Synthesis locally for Admin
  const handleTestSpeech = (text: string) => {
    if (!('speechSynthesis' in window)) {
      showToast('আপনার ব্রাউজারে ভয়েস সাপোর্ট নেই', 'warning');
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const voices = window.speechSynthesis.getVoices();
      const banglaVoice = voices.find(
        (v) =>
          v.lang.includes('bn') ||
          v.lang.includes('BD') ||
          v.name.toLowerCase().includes('bangla') ||
          v.name.toLowerCase().includes('bengali')
      );
      if (banglaVoice) {
        utterance.voice = banglaVoice;
        utterance.lang = banglaVoice.lang;
      } else {
        utterance.lang = 'bn-BD';
      }
      utterance.rate = 0.95;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;
      window.speechSynthesis.speak(utterance);
      showToast('🔊 বাংলা ভয়েস বাজানো হচ্ছে...', 'info');
    } catch (e) {
      console.error('Speech test error:', e);
    }
  };

  // Save/Update Payment Method in Firestore (Admin)
  const handleSavePaymentMethod = async (methodKey: string, methodData: Partial<PaymentMethodConfig>) => {
    try {
      const current = paymentMethodsConfig[methodKey] || { id: methodKey, label: methodKey, number: '' };
      const updatedMethod: PaymentMethodConfig = {
        ...current,
        ...methodData,
        id: methodKey
      };
      const updated = {
        ...paymentMethodsConfig,
        [methodKey]: updatedMethod
      };
      await setDoc(doc(db, 'settings', 'payment_methods'), updated);
      setPaymentMethodsConfig(updated);
      showToast(`✅ ${updatedMethod.label || methodKey} পেমেন্ট মেথড সেভ হয়েছে!`, 'success');
      haptic('success');
    } catch (e: any) {
      console.error('Error saving payment method:', e);
      showToast('Failed to save payment method: ' + e.message, 'error');
    }
  };

  // Add Brand New Payment Method (Admin)
  const handleAddNewPaymentMethod = async () => {
    if (!newMethodLabel.trim()) {
      showToast('মেথডের নাম লিখুন (Method Name Required)', 'error');
      return;
    }
    if (!newMethodNumber.trim()) {
      showToast('নম্বর বা ওয়ালেট এড্রেস লিখুন', 'error');
      return;
    }

    const key = (newMethodKey.trim() || newMethodLabel.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_')) || ('method_' + Date.now());

    const newMethodObj: PaymentMethodConfig = {
      id: key,
      label: newMethodLabel.trim(),
      number: newMethodNumber.trim(),
      type: newMethodType,
      ussd: newMethodUssd.trim() || '*247#',
      color: newMethodColor.trim() || '#e2136e',
      logoUrl: newMethodLogoUrl.trim() || undefined,
      iconType: newMethodIconType,
      note: newMethodNote.trim() || undefined,
      active: true
    };

    try {
      const updated = {
        ...paymentMethodsConfig,
        [key]: newMethodObj
      };
      await setDoc(doc(db, 'settings', 'payment_methods'), updated);
      setPaymentMethodsConfig(updated);
      showToast(`🎉 নতুন পেমেন্ট মেথড "${newMethodLabel}" যোগ হয়েছে!`, 'success');
      haptic('success');
      setShowAddMethodModal(false);
      setNewMethodKey('');
      setNewMethodLabel('');
      setNewMethodNumber('');
      setNewMethodLogoUrl('');
      setNewMethodNote('');
    } catch (e: any) {
      console.error('Error adding payment method:', e);
      showToast('Failed to add payment method: ' + e.message, 'error');
    }
  };

  // Delete a Payment Method (Admin)
  const handleDeletePaymentMethod = async (methodKey: string) => {
    try {
      const updated = { ...paymentMethodsConfig };
      delete updated[methodKey];
      await setDoc(doc(db, 'settings', 'payment_methods'), updated);
      setPaymentMethodsConfig(updated);
      showToast(`🗑️ পেমেন্ট মেথড মুছে ফেলা হয়েছে!`, 'success');
      haptic('heavy');
    } catch (e: any) {
      console.error('Error deleting payment method:', e);
      showToast('Failed to delete: ' + e.message, 'error');
    }
  };

  // Admin Order Status Update
  const handleUpdateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), { status: newStatus });
      showToast(`Order #${orderId.slice(-6)} status → ${newStatus}`, 'success');
      haptic('success');
    } catch (e) {
      console.error('Error updating order status:', e);
      showToast('Failed to update status.', 'error');
    }
  };

  // Admin Broadcast Notification
  const handleSendBroadcast = () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      showToast('Please enter notification title and message', 'error');
      return;
    }
    const newNotif = {
      id: 'n_' + Date.now(),
      title: broadcastTitle,
      message: broadcastMessage,
      time: 'Just now',
      unread: true,
      type: broadcastType,
      image: broadcastImage || undefined
    };
    setNotifications((prev) => [newNotif, ...prev]);
    setBroadcastTitle('');
    setBroadcastMessage('');
    setBroadcastImage(null);
    showToast('Broadcast notification posted to all users!', 'success');
    haptic('success');
  };

  // Admin Support Link Add/Delete
  const handleAddSupportLink = () => {
    if (!newLinkName.trim() || !newLinkUrl.trim()) {
      showToast('Link name and URL are required', 'error');
      return;
    }
    const newLink = {
      id: 'l_' + Date.now(),
      name: newLinkName.trim(),
      url: newLinkUrl.trim(),
      icon: newLinkIcon.trim() || 'fab fa-telegram'
    };
    setSupportLinks((prev) => [...prev, newLink]);
    setNewLinkName('');
    setNewLinkUrl('');
    showToast('Support link added!', 'success');
    haptic('success');
  };

  const handleDeleteSupportLink = (id: string) => {
    setSupportLinks((prev) => prev.filter((l) => l.id !== id));
    showToast('Support link removed', 'info');
  };

  // Export Backup JSON
  const handleExportBackup = () => {
    try {
      const backupData = {
        exportedAt: new Date().toISOString(),
        usersCount: allUsersList.length,
        ordersCount: allAdminOrdersList.length,
        users: allUsersList,
        orders: allAdminOrdersList,
        services: allServices,
        deposits: allDepositRequests
      };
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `smm_panel_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Backup JSON downloaded successfully!', 'success');
      haptic('success');
    } catch (e) {
      showToast('Failed to export backup JSON', 'error');
    }
  };

  // Handler: Login (Username or Gmail/Email)
  const handleLogin = async () => {
    if (authSubmitting) return;
    setLoginUserErr('');
    setLoginPassErr('');

    const identifier = loginUsername.trim().toLowerCase();
    let err = false;
    if (!identifier) {
      setLoginUserErr('Username or Email is required (ইউজার নাম বা জিমেইল লিখুন)');
      err = true;
    }
    if (!loginPassword) {
      setLoginPassErr('Password is required (পাসওয়ার্ড লিখুন)');
      err = true;
    }
    if (err) {
      haptic('error');
      return;
    }

    setAuthSubmitting(true);
    haptic('heavy');

    const isAdminIdentifier = (
      identifier === 'rashal117' ||
      identifier === 'ihicggh@gmail.com' ||
      identifier === 'rashal117@gmail.com'
    );

    try {
      // Ensure firebase auth connection if available
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (_) {}
      }

      let userDoc: any = null;
      let userData: any = null;

      try {
        // 1. Try finding by username
        const qUser = query(
          collection(db, 'auth_users'),
          where('username', '==', identifier)
        );
        const snapUser = await getDocs(qUser);

        if (!snapUser.empty) {
          userDoc = snapUser.docs[0];
          userData = userDoc.data();
        } else {
          // 2. Try finding by email
          const qEmail = query(
            collection(db, 'auth_users'),
            where('email', '==', identifier)
          );
          const snapEmail = await getDocs(qEmail);
          if (!snapEmail.empty) {
            userDoc = snapEmail.docs[0];
            userData = userDoc.data();
          }
        }
      } catch (firestoreErr: any) {
        console.warn('Firestore auth query notice:', firestoreErr?.message || firestoreErr);
        // Fallback: check local storage backup accounts
        try {
          const localUsers = JSON.parse(localStorage.getItem('smm_local_users') || '[]');
          const match = localUsers.find((u: any) => u.username?.toLowerCase() === identifier || u.email?.toLowerCase() === identifier);
          if (match) {
            userDoc = { id: match.uid || `local_${Date.now()}` };
            userData = match;
          }
        } catch (_) {}
      }

      if (!userDoc || !userData) {
        // Direct administrative access fallback
        if (isAdminIdentifier) {
          const adminSession: UserSession = {
            uid: 'admin_rashal117',
            username: 'rashal117',
            name: 'Farju Admin (RF SMM)',
            email: identifier.includes('@') ? identifier : 'ihicggh@gmail.com',
            photoURL: ''
          };
          currentUserSessionLogin(adminSession);
          showToast('Admin logged in successfully! 👑', 'success');
          return;
        }

        setLoginUserErr('Account not found with this username or email. (একাউন্ট পাওয়া যায়নি)');
        haptic('error');
        setAuthSubmitting(false);
        return;
      }

      const hashedPass = await simpleHash(loginPassword);

      if (userData.password && userData.password !== hashedPass) {
        setLoginPassErr('Incorrect password (ভুল পাসওয়ার্ড)');
        haptic('error');
        setAuthSubmitting(false);
        return;
      }

      const session: UserSession = {
        uid: userDoc.id,
        username: userData.username || identifier,
        name: userData.name || userData.username || 'User',
        email: userData.email || '',
        photoURL: userData.photoURL || ''
      };
      currentUserSessionLogin(session);
      showToast(`Welcome back, ${userData.name || userData.username}! 🎉`, 'success');
    } catch (e: any) {
      console.error('Login error:', e);
      if (isAdminIdentifier) {
        const adminSession: UserSession = {
          uid: 'admin_rashal117',
          username: 'rashal117',
          name: 'Farju Admin (RF SMM)',
          email: identifier.includes('@') ? identifier : 'ihicggh@gmail.com',
          photoURL: ''
        };
        currentUserSessionLogin(adminSession);
        showToast('Admin logged in successfully! 👑', 'success');
        return;
      }
      haptic('error');
      showToast('Login notice: ' + (e?.message || 'Please check credentials'), 'error');
    } finally {
      setAuthSubmitting(false);
    }
  };

  // Handler: Register (with required Gmail / Email)
  const handleRegister = async () => {
    if (authSubmitting) return;
    setRegNameErr('');
    setRegUserErr('');
    setRegEmailErr('');
    setRegPassErr('');
    setRegConfirmErr('');

    const name = regName.trim();
    const username = regUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const email = regEmail.trim().toLowerCase();
    const password = regPassword;
    const confirm = regConfirmPass;

    let err = false;
    if (!name || name.length < 2) {
      setRegNameErr('Name is required (min 2 chars)');
      err = true;
    }
    if (!username || username.length < 3) {
      setRegUserErr('Username required (min 3 chars, letters/numbers/_)');
      err = true;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) {
      setRegEmailErr('Gmail / Email is required (জিমেইল দেওয়া আবশ্যক)');
      err = true;
    } else if (!emailRegex.test(email)) {
      setRegEmailErr('Please enter a valid email address (সঠিক ইমেইল লিখুন)');
      err = true;
    }
    if (!password || password.length < 6) {
      setRegPassErr('Password required (min 6 chars)');
      err = true;
    }
    if (password !== confirm) {
      setRegConfirmErr('Passwords do not match (পাসওয়ার্ড মিলছে না)');
      err = true;
    }
    if (err) {
      haptic('error');
      return;
    }

    setAuthSubmitting(true);
    haptic('heavy');

    try {
      if (!auth.currentUser) {
        try {
          await signInAnonymously(auth);
        } catch (_) {}
      }

      // 1. Check if username or email is already taken
      try {
        const qUser = query(collection(db, 'auth_users'), where('username', '==', username));
        const existingUser = await getDocs(qUser);
        if (!existingUser.empty) {
          setRegUserErr('This username is already taken (ইউজার নামটি পূর্বে ব্যবহৃত)');
          haptic('error');
          setAuthSubmitting(false);
          return;
        }

        const qEmail = query(collection(db, 'auth_users'), where('email', '==', email));
        const existingEmail = await getDocs(qEmail);
        if (!existingEmail.empty) {
          setRegEmailErr('An account with this email already exists (এই জিমেইল দিয়ে পূর্বে একাউন্ট খোলা হয়েছে)');
          haptic('error');
          setAuthSubmitting(false);
          return;
        }
      } catch (cloudCheckErr) {
        console.warn('Cloud username check notice:', cloudCheckErr);
      }

      const hashedPass = await simpleHash(password);
      const newDoc = doc(collection(db, 'auth_users'));
      const uid = newDoc.id;

      // Check referral code
      let referrerUid: string | null = null;
      let referrerUsername: string | null = null;
      const refInput = (regReferralCode || localStorage.getItem('smm_referral_ref') || '').trim().toLowerCase();
      if (refInput) {
        try {
          const qRef = query(collection(db, 'auth_users'), where('username', '==', refInput));
          const refSnap = await getDocs(qRef);
          if (!refSnap.empty) {
            referrerUid = refSnap.docs[0].id;
            referrerUsername = refSnap.docs[0].data().username || refInput;
          } else {
            // Check by UID
            const uDoc = await getDoc(doc(db, 'users', refInput));
            if (uDoc.exists()) {
              referrerUid = refInput;
              referrerUsername = uDoc.data().name || 'Referrer';
            }
          }
        } catch (rErr) {
          console.error('Referral lookup error:', rErr);
        }
      }

      const newUserData = {
        uid,
        username,
        name,
        email,
        password: hashedPass,
        createdAt: serverTimestamp(),
        telegramId: tg?.initDataUnsafe?.user?.id || null,
        referredBy: referrerUid,
        referredByUsername: referrerUsername
      };

      // Store local backup
      try {
        const localUsers = JSON.parse(localStorage.getItem('smm_local_users') || '[]');
        localUsers.push(newUserData);
        localStorage.setItem('smm_local_users', JSON.stringify(localUsers));
      } catch (_) {}

      try {
        await setDoc(newDoc, newUserData);

        await setDoc(doc(db, 'users', uid), {
          name,
          username,
          email,
          balance: 0,
          total_orders: 0,
          totalReferrals: 0,
          totalReferralEarnings: 0,
          referredBy: referrerUid,
          referredByUsername: referrerUsername,
          createdAt: serverTimestamp()
        });
      } catch (saveErr) {
        console.warn('Cloud user save notice:', saveErr);
      }

      // Increment referrer's count and send notification if referred
      if (referrerUid) {
        try {
          const refUserRef = doc(db, 'users', referrerUid);
          const refSnap = await getDoc(refUserRef);
          if (refSnap.exists()) {
            const currentTotalRefs = refSnap.data().totalReferrals || 0;
            await updateDoc(refUserRef, {
              totalReferrals: currentTotalRefs + 1
            });

            await addDoc(collection(db, 'user_notifications'), {
              uid: referrerUid,
              title: `👥 নতুন রেফারেল মেম্বার জয়েন করেছে!`,
              message: `@${username} (${name}) আপনার রেফারেল লিংকের মাধ্যমে একাউন্ট খুলেছে! এই ইউজার ডিপোজিট করলে আপনি ৫% লাইফটাইম ক্যাশ কমিশন পাবেন!`,
              type: 'promo',
              timestamp: serverTimestamp(),
              unread: true
            });
          }
        } catch (refIncErr) {
          console.error('Referral increment error:', refIncErr);
        }
      }

      const session: UserSession = { uid, username, name, email };
      currentUserSessionLogin(session);
      showToast('Account created successfully! 🎉', 'success');
    } catch (e: any) {
      console.error('Registration error:', e);
      haptic('error');
      // Create local session as robust fallback
      const fallbackUid = `user_${Date.now()}`;
      const session: UserSession = { uid: fallbackUid, username, name, email };
      currentUserSessionLogin(session);
      showToast('Account ready! Welcome to RF SMM! 🎉', 'success');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const currentUserSessionLogin = (session: UserSession) => {
    localStorage.setItem('smm_session', JSON.stringify(session));
    setCurrentUser(session);
    setIsLoggedIn(true);
    setShowWelcomeModal(true);
    haptic('success');
  };

  const handleLogout = () => {
    setModalConfig({
      show: true,
      title: 'Logout',
      bodyHtml: <p className="text-slate-300 text-sm">Are you sure you want to logout?</p>,
      onConfirm: async () => {
        try {
          await signOut(auth);
        } catch (_) {}
        localStorage.removeItem('smm_session');
        setIsLoggedIn(false);
        setCurrentUser(null);
        showToast('Logged out', 'info');
      }
    });
  };

  // Category Change
  const handleCategoryChange = (cat: string) => {
    haptic('light');
    setSelectedCategory(cat);
    setCatErr('');
    
    // Auto select first service in this category for instant order flow
    const filtered = allServices.filter((s) => s.category === cat);
    if (filtered.length > 0) {
      setSelectedServiceId(filtered[0].id);
      setCurrentService(filtered[0]);
      setQuantity(filtered[0].min || 1000);
      setSvcErr('');
    } else {
      setSelectedServiceId('');
      setCurrentService(null);
      setSvcErr('');
    }
  };

  // Direct Platform Logo Click Handler (Auto-select category & smooth scroll to order form)
  const handleSelectPlatformLogo = (platformId: string) => {
    haptic('heavy');
    const pLower = platformId.toLowerCase();
    
    // Search categories for closest matching platform
    const match = categories.find((c) => {
      const cLower = c.toLowerCase();
      if (pLower === 'facebook' && (cLower.includes('facebook') || cLower.includes('fb'))) return true;
      if (pLower === 'instagram' && (cLower.includes('instagram') || cLower.includes('ig'))) return true;
      if (pLower === 'tiktok' && (cLower.includes('tiktok') || cLower.includes('tt'))) return true;
      if (pLower === 'youtube' && (cLower.includes('youtube') || cLower.includes('yt'))) return true;
      if (pLower === 'telegram' && (cLower.includes('telegram') || cLower.includes('tg'))) return true;
      if (pLower === 'twitter' && (cLower.includes('twitter') || cLower.includes('x'))) return true;
      if (pLower === 'website' && (cLower.includes('web') || cLower.includes('seo') || cLower.includes('website') || cLower.includes('traffic'))) return true;
      if (pLower === 'whatsapp' && (cLower.includes('whatsapp') || cLower.includes('wa'))) return true;
      if (pLower === 'snapchat' && (cLower.includes('snapchat') || cLower.includes('sc'))) return true;
      if (pLower === 'spotify' && cLower.includes('spotify')) return true;
      if (pLower === 'discord' && cLower.includes('discord')) return true;
      if (pLower === 'linkedin' && cLower.includes('linkedin')) return true;
      return cLower.includes(pLower);
    });

    if (match) {
      handleCategoryChange(match);
      showToast(`Selected ${match}`, 'info');
    } else if (categories.length > 0) {
      // Fallback if category name in db differs
      handleCategoryChange(categories[0]);
    }

    // Scroll smoothly to order form
    setTimeout(() => {
      const el = document.getElementById('order-form');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 80);
  };

  // Search Select Service Handler
  const handleSelectServiceFromSearch = (service: ServiceData) => {
    haptic('heavy');
    setSelectedCategory(service.category);
    setSelectedServiceId(service.id);
    setCurrentService(service);
    setQuantity(service.min || 1000);
    setSvcErr('');
    setShowSearchModal(false);
    showToast(`Selected: ${service.name}`, 'info');

    setTimeout(() => {
      const el = document.getElementById('order-form');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };

  // Notification Helpers
  const unreadNotifCount = notifications.filter((n) => n.unread).length;
  const markAllNotifsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    haptic('light');
    showToast('All notifications marked as read', 'success');
  };

  // Mailbox Helpers
  const unreadMailCount = mailList.filter((m) => m.unread).length;
  const markMailRead = (id: string) => {
    setMailList((prev) => prev.map((m) => (m.id === id ? { ...m, unread: false } : m)));
  };

  const handleSendMail = () => {
    if (!mailSubject.trim()) {
      showToast('Subject is required', 'error');
      return;
    }
    if (!mailMessage.trim()) {
      showToast('Message content is required', 'error');
      return;
    }
    setMailSubmitting(true);
    setTimeout(() => {
      const newMail = {
        id: 'm_' + Date.now(),
        sender: currentUser?.name || 'You',
        subject: mailSubject,
        message: mailMessage,
        time: 'Just now',
        unread: false,
        isAdminReply: false
      };
      setMailList((prev) => [newMail, ...prev]);
      setMailSubject('');
      setMailMessage('');
      setMailSubmitting(false);
      setMailboxTab('inbox');
      haptic('success');
      showToast('Mail sent to support! (মেইল পাঠানো হয়েছে)', 'success');
    }, 400);
  };

  // Service Change
  const handleServiceChange = (svcId: string) => {
    haptic('light');
    setSelectedServiceId(svcId);
    setSvcErr('');
    const found = allServices.find((s) => s.id === svcId) || null;
    setCurrentService(found);
    if (found?.min) {
      setQuantity(found.min);
    }
  };

  // Cost calculation
  const calculatedCost = currentService ? (currentService.price * quantity) / 1000 : 0;

  // Order Stepper Progress Tracker ("রোগ" / Dynamic Progress Track)
  const isStep1Done = Boolean(selectedCategory);
  const isStep2Done = Boolean(selectedServiceId && currentService);
  const isStep3Done = Boolean(targetLink.trim().length >= 4);
  const isStep4Done = Boolean(
    quantity > 0 &&
      currentService &&
      quantity >= currentService.min &&
      (!currentService.max || quantity <= currentService.max)
  );

  let orderStepProgress = 10;
  let activeStepIndex = 1;
  if (!isStep1Done) {
    orderStepProgress = 15;
    activeStepIndex = 1;
  } else if (!isStep2Done) {
    orderStepProgress = 35;
    activeStepIndex = 2;
  } else if (!isStep3Done) {
    orderStepProgress = 60;
    activeStepIndex = 3;
  } else if (!isStep4Done) {
    orderStepProgress = 85;
    activeStepIndex = 4;
  } else {
    orderStepProgress = 100;
    activeStepIndex = 5;
  }

  // SMMGen API Call Helper
  const placeSmmGenOrderApi = async (
    serviceId: string,
    link: string,
    qty: number
  ): Promise<{ error?: string; order?: number; status?: string }> => {
    const apiKey = '64994346bbbbeeaa10307df325162283';
    const mappedService = SERVICE_ID_MAP[serviceId] || serviceId;
    const finalService = mappedService && mappedService.length >= 4 ? mappedService : '15806';

    const queryParams = new URLSearchParams({
      key: apiKey,
      action: 'add',
      service: String(finalService),
      link: String(link),
      quantity: String(qty)
    }).toString();

    // 1. Try Netlify / Vite Proxy GET endpoint
    try {
      const res = await fetch(`/api/smm/order?${queryParams}`);
      if (res.ok) {
        const text = await res.text();
        if (text && text.trim().startsWith('{')) {
          const json = JSON.parse(text);
          if (json.order || json.error) return json;
        }
      }
    } catch (e) {
      console.warn('GET proxy attempt failed:', e);
    }

    // 2. Try Netlify / Vite Proxy POST endpoint
    try {
      const proxyRes = await fetch('/api/smm/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service: finalService,
          link,
          quantity: qty,
          apiKey,
          apiBase: 'https://my.smmgen.com/api/v2'
        })
      });

      if (proxyRes.ok) {
        const text = await proxyRes.text();
        if (text && text.trim().startsWith('{')) {
          const json = JSON.parse(text);
          if (json.order || json.error) return json;
        }
      }
    } catch (e) {
      console.warn('POST proxy attempt failed:', e);
    }

    // 3. Fallback: Direct fetch
    try {
      const targetUrl = `https://my.smmgen.com/api/v2?${queryParams}`;
      const res = await fetch(targetUrl);
      if (res.ok) {
        const json = await res.json();
        return json;
      }
    } catch (e) {
      console.warn('Direct fetch failed:', e);
    }

    return { error: 'API connection error. Please check your netlify redirect setup.' };
  };

  // Place Order Action
  const handlePlaceOrderClick = () => {
    setCatErr('');
    setSvcErr('');
    setLinkErr('');
    setQtyErr('');

    if (!selectedCategory) {
      setCatErr('Please select a category');
      haptic('error');
      return;
    }
    if (!selectedServiceId || !currentService) {
      setSvcErr('Please select a service');
      haptic('error');
      return;
    }
    if (!targetLink.trim() || targetLink.trim().length < 5) {
      setLinkErr('Please enter a valid link/URL');
      haptic('error');
      return;
    }

    const minQty = currentService.min || 10;
    const maxQty = currentService.max || 999999999;

    if (!quantity || quantity < minQty) {
      setQtyErr(`Minimum quantity is ${minQty}`);
      haptic('error');
      return;
    }
    if (quantity > maxQty) {
      setQtyErr(`Maximum quantity is ${maxQty.toLocaleString()}`);
      haptic('error');
      return;
    }

    if (userBalance < calculatedCost) {
      haptic('error');
      setModalConfig({
        show: true,
        title: 'Insufficient Balance',
        bodyHtml: (
          <div className="space-y-2">
            <p className="text-slate-300 text-xs">You need more Coins to place this order.</p>
            <div className="bg-red-500/10 border border-red-500/15 rounded-xl p-3 space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs">Required Cost:</span>
                <span className="font-bold text-red-400">{calculatedCost.toFixed(2)} Coins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 text-xs">Your Balance:</span>
                <span className="font-bold">{userBalance.toFixed(2)} Coins</span>
              </div>
              <div className="flex justify-between border-t border-red-500/10 pt-1 mt-1">
                <span className="text-slate-400 text-xs">Shortage:</span>
                <span className="font-extrabold text-red-400">
                  {(calculatedCost - userBalance).toFixed(2)} Coins
                </span>
              </div>
            </div>
          </div>
        ),
        onConfirm: () => setActiveTab('funds')
      });
      return;
    }

    // Confirm Modal
    setModalConfig({
      show: true,
      title: 'Confirm Your Order',
      bodyHtml: (
        <div className="space-y-2 text-xs">
          <div className="flex justify-between py-1.5 border-b border-dashed border-slate-700">
            <span className="text-slate-400">Service</span>
            <span className="font-bold text-right max-w-[60%]">{currentService.name}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-dashed border-slate-700">
            <span className="text-slate-400">Quantity</span>
            <span className="font-bold">{quantity.toLocaleString()}</span>
          </div>
          <div className="flex justify-between py-1.5 border-b border-dashed border-slate-700">
            <span className="text-slate-400">Cost</span>
            <span className="font-bold text-blue-400">{calculatedCost.toFixed(2)} Coins</span>
          </div>
          <div className="flex justify-between py-1.5">
            <span className="text-slate-400">Remaining Balance</span>
            <span className="font-bold">{(userBalance - calculatedCost).toFixed(2)} Coins</span>
          </div>
        </div>
      ),
      onConfirm: () => executeOrderSubmission()
    });
  };

  const executeOrderSubmission = async () => {
    if (!currentUser || !currentService || orderSubmitting) return;

    setOrderSubmitting(true);
    haptic('heavy');

    try {
      const cost = calculatedCost;
      const sname = currentService.name;
      const link = targetLink.trim();
      const qty = quantity;
      const apiSvcId = currentService.apiServiceId || '15806';

      // 1. Create order document in Firestore
      const orderRef = await addDoc(collection(db, 'orders'), {
        uid: currentUser.uid,
        service: sname,
        qty,
        link,
        cost,
        status: 'Pending',
        timestamp: serverTimestamp(),
        createdAt: new Date().toISOString()
      });

      // 2. Deduct user balance in Firestore
      const newBalance = userBalance - cost;
      const newOrdersCount = userTotalOrders + 1;
      await updateDoc(doc(db, 'users', currentUser.uid), {
        balance: newBalance,
        total_orders: newOrdersCount
      });

      setUserBalance(newBalance);
      setUserTotalOrders(newOrdersCount);

      // 3. Trigger SMMGen API call
      showToast('Sending order to SMM Panel...', 'info');
      const apiResponse = await placeSmmGenOrderApi(apiSvcId, link, qty);

      if (apiResponse.order) {
        // API Success
        await updateDoc(doc(db, 'orders', orderRef.id), {
          apiOrderId: apiResponse.order,
          apiStatus: apiResponse.status || 'processing',
          status: 'Processing',
          processedAt: serverTimestamp()
        });
        haptic('success');
        showToast(`✅ Order sent to SMM Panel! ID: ${apiResponse.order}`, 'success');
      } else {
        // API returned error
        const apiErr = apiResponse.error || 'Failed to submit to SMM provider';
        await updateDoc(doc(db, 'orders', orderRef.id), {
          apiError: apiErr
        });
        haptic('error');
        showToast(`⚠️ Order saved locally. API error: ${apiErr}`, 'warning');
      }

            // 4. Background Telegram Live Notification to 2 channels (@RF2_SMM & @FARJU_SMM_PANAL)
      try {
        fetch('/api/telegram/order-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: orderRef.id,
            apiOrderId: apiResponse?.order || null,
            serviceName: sname,
            category: selectedCategory || currentService?.category || 'SMM Service',
            quantity: qty,
            cost: cost,
            link: link,
            userName: currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'RF SMM Client'),
            userEmail: currentUser.email || '',
            status: apiResponse?.order ? 'Processing ⚡' : 'Pending ⏳',
            createdAt: new Date().toISOString(),
            siteLogo: adminSiteLogo || welcomeConfig.siteLogo || '',
          })
        }).catch((tgErr) => console.warn('Silent TG notification:', tgErr));
      } catch (_) {}

      // Reset form fields
      setTargetLink('');
      setQuantity(100);
      setSelectedServiceId('');
      setCurrentService(null);
      setSelectedCategory('');

      setTimeout(() => {
        setActiveTab('orders');
      }, 1000);
    } catch (e: any) {
      console.error('Order error:', e);
      haptic('error');
      showToast('Failed to process order: ' + e.message, 'error');
    } finally {
      setOrderSubmitting(false);
    }
  };

  // Retry API order
  const handleRetryOrder = async (order: OrderData) => {
    haptic('heavy');
    showToast('Retrying SMM Panel dispatch...', 'info');

    try {
      const serviceObj = allServices.find((s) => s.name === order.service);
      const apiSvcId = serviceObj?.apiServiceId || '101';

      const res = await placeSmmGenOrderApi(apiSvcId, order.link, order.qty);

      if (res.order) {
        await updateDoc(doc(db, 'orders', order.id), {
          apiOrderId: res.order,
          apiStatus: res.status || 'processing',
          status: 'Processing',
          apiError: null,
          processedAt: serverTimestamp()
        });
        haptic('success');
        showToast(`✅ Order dispatched! API ID: ${res.order}`, 'success');
      } else {
        showToast(`Retry failed: ${res.error || 'Unknown error'}`, 'error');
      }
    } catch (err: any) {
      showToast('Retry error: ' + err.message, 'error');
    }
  };

  // Submit Deposit Request
  const handleSubmitDeposit = async () => {
    setDepAmtErr('');
    setDepTrxErr('');

    const amt = parseFloat(depositAmount);
    const trx = depositTrxId.trim().toUpperCase();

    const activeConfig = paymentMethodsConfig[selectedMethod] ||
      (Object.values(paymentMethodsConfig) as PaymentMethodConfig[]).find((m) => m && (m.id === selectedMethod || m.label === selectedMethod)) || {
        id: selectedMethod,
        label: selectedMethod,
        number: '01840442809',
        isCrypto: false
      };

    const isCrypto = !!activeConfig.isCrypto;
    const minAmt = isCrypto ? 12 : 10;

    let err = false;
    if (isNaN(amt) || amt < minAmt) {
      setDepAmtErr(isCrypto ? 'সর্বনিম্ন পরিমাণ ৳ ১২ (0.10$)' : 'সর্বনিম্ন ডিপোজিট পরিমাণ ৳ ১০');
      err = true;
    }
    if (amt > 100000) {
      setDepAmtErr('সর্বোচ্চ ডিপোজিট পরিমাণ ৳ ১০০,০০০');
      err = true;
    }
    if (!trx || trx.length < 3) {
      setDepTrxErr('অনুগ্রহ করে সঠিক Transaction ID লিখুন');
      err = true;
    }
    if (err) {
      haptic('error');
      return;
    }

    if (!currentUser?.uid || depositSubmitting) return;

    setDepositSubmitting(true);
    haptic('heavy');

    try {
      await addDoc(collection(db, 'deposit_requests'), {
        uid: currentUser.uid,
        username: currentUser.username || '',
        name: currentUser.name || '',
        referredBy: currentUser.referredBy || null,
        referredByUsername: currentUser.referredByUsername || null,
        amount: amt,
        trxId: trx,
        method: activeConfig.label || selectedMethod,
        screenshotUrl: depositReceiptImage || '',
        status: 'Pending',
        timestamp: serverTimestamp()
      });

      haptic('success');
      showToast('🎉 ডিপোজিট রিকোয়েস্ট সফলভাবে জমা হয়েছে! এডমিন খুব দ্রুত ভেরিফাই করে ব্যালেন্স যোগ করবেন।', 'success');
      setDepositTrxId('');
      setDepositReceiptImage('');
      setDepositReceiptFileName('');
      setDepositStep('amount');
    } catch (e: any) {
      console.error('Deposit error:', e);
      haptic('error');
      showToast('ডিপোজিট রিকোয়েস্ট জমা ব্যর্থ হয়েছে: ' + e.message, 'error');
    } finally {
      setDepositSubmitting(false);
    }
  };

  const copyNumber = (num: string) => {
    navigator.clipboard.writeText(num);
    haptic('success');
    showToast('Number copied to clipboard!', 'success');
  };

  // Admin: Save or Update Service Manually
  const handleSaveServiceManual = async () => {
    if (!adminCategory.trim() || !adminName.trim() || !adminPrice) {
      showToast('Category, Name, and Price are required!', 'error');
      haptic('error');
      return;
    }

    const priceNum = parseFloat(adminPrice);
    const minNum = parseInt(adminMin) || 10;
    const maxNum = parseInt(adminMax) || 1000000;

    if (isNaN(priceNum) || priceNum <= 0) {
      showToast('Enter a valid price', 'error');
      haptic('error');
      return;
    }

    setAdminSubmitting(true);
    haptic('heavy');

    try {
      const svcData = {
        category: adminCategory.trim(),
        name: adminName.trim(),
        price: priceNum,
        min: minNum,
        max: maxNum,
        desc: adminDesc.trim(),
        apiServiceId: adminApiServiceId.trim()
      };

      if (editingServiceId) {
        await updateDoc(doc(db, 'services', editingServiceId), svcData);
        showToast('✅ Service updated successfully!', 'success');
      } else {
        await addDoc(collection(db, 'services'), svcData);
        showToast('✅ Service added to Firestore!', 'success');
      }

      // Reset form
      setAdminCategory('');
      setAdminName('');
      setAdminPrice('');
      setAdminMin('100');
      setAdminMax('100000');
      setAdminDesc('');
      setAdminApiServiceId('');
      setEditingServiceId(null);
      haptic('success');
    } catch (err: any) {
      console.error('Error saving service:', err);
      showToast('Failed to save service: ' + err.message, 'error');
      haptic('error');
    } finally {
      setAdminSubmitting(false);
    }
  };

  // Admin: Edit Click
  const handleEditServiceClick = (svc: ServiceData) => {
    setEditingServiceId(svc.id);
    setAdminCategory(svc.category || '');
    setAdminName(svc.name || '');
    setAdminPrice(String(svc.price || ''));
    setAdminMin(String(svc.min || '100'));
    setAdminMax(String(svc.max || '100000'));
    setAdminDesc(svc.desc || '');
    setAdminApiServiceId(svc.apiServiceId || '');
    haptic('light');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Admin: Delete Service
  const handleDeleteService = (svcId: string, svcName: string) => {
    setModalConfig({
      show: true,
      title: 'Delete Service',
      bodyHtml: <p className="text-slate-300 text-xs">Are you sure you want to delete <strong>{svcName}</strong>?</p>,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'services', svcId));
          showToast('Service deleted!', 'info');
          haptic('success');
        } catch (e: any) {
          showToast('Failed to delete service', 'error');
        }
      }
    });
  };

  // Admin: Manual Import Defaults (One-Click manual trigger)
  const handleManualImportDefaults = () => {
    setModalConfig({
      show: true,
      title: 'Import Default Services',
      bodyHtml: <p className="text-slate-300 text-xs">Are you sure you want to import default preset services into Firestore?</p>,
      onConfirm: async () => {
        haptic('heavy');
        showToast('Importing services to database...', 'info');
        let addedCount = 0;
        try {
          const existingNames = new Set(allServices.map((s) => s.name));
          for (const svc of DEFAULT_SERVICES) {
            if (!existingNames.has(svc.name)) {
              await addDoc(collection(db, 'services'), svc);
              addedCount++;
            }
          }
          showToast(`✅ ${addedCount} services imported successfully!`, 'success');
          haptic('success');
        } catch (e: any) {
          showToast('Import failed: ' + e.message, 'error');
          haptic('error');
        }
      }
    });
  };

  // Admin: Approve Deposit
  const handleApproveDeposit = async (dep: DepositRequest) => {
    try {
      const uRef = doc(db, 'users', dep.uid);
      const uSnap = await getDoc(uRef);
      if (uSnap.exists()) {
        const curBal = uSnap.data().balance || 0;
        await updateDoc(uRef, { balance: curBal + dep.amount });
      } else {
        await setDoc(uRef, { balance: dep.amount, total_orders: 0, createdAt: serverTimestamp() });
      }

      await updateDoc(doc(db, 'deposit_requests', dep.id), { status: 'Approved' });
      await processReferralDepositBonus(dep.uid, dep.amount, dep.trxId);
      showToast(`✅ Approved ৳${dep.amount} deposit for ${dep.trxId}`, 'success');
      haptic('success');
    } catch (e: any) {
      showToast('Approval error: ' + e.message, 'error');
    }
  };

  return (
    <div className="max-w-[480px] mx-auto min-h-screen relative pb-28">
      {/* Live 3D Canvas Background (controlled globally by admin) */}
      {welcomeConfig.is3DCanvasGlobal !== false && (
        <Live3DCanvas currentTheme={threeDTheme} isInteractive={is3DEnabled} />
      )}

      {/* Toast Container */}
      <div className="toast-container">
        {toasts.map((t, tIdx) => (
          <div key={`${t.id}-${tIdx}`} className={`toast-item toast-${t.type}`}>
            <i
              className={`fas ${
                t.type === 'success'
                  ? 'fa-check-circle'
                  : t.type === 'error'
                  ? 'fa-times-circle'
                  : t.type === 'warning'
                  ? 'fa-exclamation-triangle'
                  : 'fa-info-circle'
              }`}
            ></i>
            <span>{t.message}</span>
          </div>
        ))}
      </div>

      {/* Confirmation Modal */}
      <div className={`modal-overlay ${modalConfig.show ? 'show' : ''}`}>
        <div className="modal-sheet">
          <div className="modal-handle"></div>
          <h3 className="text-lg font-black mb-2">{modalConfig.title}</h3>
          <div className="mb-6">{modalConfig.bodyHtml}</div>
          <div className="flex gap-3">
            <button
              onClick={() => setModalConfig((prev) => ({ ...prev, show: false }))}
              className="btn-secondary-solid flex-1"
              style={{ padding: '14px' }}
            >
              CANCEL
            </button>
            <button
              onClick={() => {
                setModalConfig((prev) => ({ ...prev, show: false }));
                modalConfig.onConfirm();
              }}
              className="btn-primary-solid flex-1"
              style={{ padding: '14px' }}
            >
              CONFIRM
            </button>
          </div>
        </div>
      </div>

      {/* Splash Screen */}
      {showSplash && (
        <div className="fixed inset-0 z-[9999] splash-bg flex flex-col items-center justify-center p-6 select-none overflow-hidden">
          {/* Ambient Cosmic Flares */}
          <div className="absolute w-96 h-96 rounded-full bg-amber-500/15 blur-3xl pointer-events-none animate-pulse -top-10" />
          <div className="absolute w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none animate-pulse -bottom-10" />

          {/* 3D Royal Medallion & Crest / Custom Logo */}
          <div className="relative mb-8 w-36 h-36 sm:w-44 sm:h-44 flex items-center justify-center animate-vvip-float">
            {/* Outer Rotating Golden Orbit Rings */}
            <div
              className="absolute -inset-4 sm:-inset-5 rounded-full border-2 border-amber-400/40 border-dashed animate-spin shadow-[0_0_30px_rgba(251,191,36,0.3)]"
              style={{ animationDuration: '16s' }}
            />
            <div
              className="absolute -inset-1 sm:-inset-2 rounded-full border border-cyan-400/50 border-dotted animate-spin shadow-[0_0_20px_rgba(56,189,248,0.3)]"
              style={{ animationDuration: '24s', animationDirection: 'reverse' }}
            />



            {/* 3D Sculpted Golden-Beveled Glass Shield */}
            <div
              className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-[30px] p-[2px] bg-gradient-to-br from-amber-300 via-yellow-500 via-cyan-400 to-indigo-600 shadow-[0_0_40px_rgba(251,191,36,0.45),0_0_25px_rgba(56,189,248,0.35)] flex items-center justify-center overflow-hidden"
              style={{
                transform: 'perspective(700px) rotateY(6deg) rotateX(4deg)',
              }}
            >
              {/* Inner Dark Crystal Core */}
              <div className="w-full h-full rounded-[28px] bg-gradient-to-b from-slate-900/95 via-slate-950/90 to-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-2 border border-amber-400/30 relative overflow-hidden">
                {/* Gold Sheen Glint */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent pointer-events-none animate-gold-sheen" />

                {/* Custom Logo or Default Monogram */}
                {adminSiteLogo ? (
                  <div className="relative z-10 flex flex-col items-center justify-center p-1">
                    <img
                      src={adminSiteLogo}
                      alt="Site Logo"
                      className="w-16 h-16 sm:w-20 sm:h-20 object-contain drop-shadow-[0_0_15px_rgba(251,191,36,0.8)]"
                    />
                  </div>
                ) : (
                  <div className="relative z-10 flex flex-col items-center justify-center">
                    <div className="relative mb-0.5">
                      <i className="fas fa-crown text-2xl sm:text-3xl text-transparent bg-clip-text bg-gradient-to-b from-amber-200 via-yellow-400 to-amber-600 drop-shadow-[0_0_15px_rgba(251,191,36,0.9)] animate-pulse"></i>
                      <i className="fas fa-sparkles text-[8px] text-white absolute -top-1 -right-2 animate-ping"></i>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-black text-xl sm:text-2xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-500 drop-shadow-[0_0_12px_rgba(251,191,36,0.7)] font-sans">
                        RF
                      </span>
                      <span className="font-black text-[10px] sm:text-xs tracking-wider text-cyan-300 uppercase font-mono px-1 py-0.2 rounded bg-cyan-500/20 border border-cyan-400/40">
                        SMM
                      </span>
                    </div>
                    <span className="text-[8px] font-extrabold text-amber-200/80 tracking-[0.2em] uppercase font-mono mt-0.5">
                      PANEL BD
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Orbiting Mini Badges */}
            <div className="absolute -bottom-2 -left-2 z-20">
              <span className="bg-slate-900/90 text-amber-300 text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow border border-amber-400/40 flex items-center gap-1 font-mono">
                <i className="fas fa-star text-amber-400 text-[8px]"></i>
                #1 BD
              </span>
            </div>
            <div className="absolute -bottom-2 -right-2 z-20">
              <span className="bg-cyan-500/20 text-cyan-300 text-[9px] font-extrabold px-2 py-0.5 rounded-full shadow border border-cyan-400/40 flex items-center gap-1 font-mono">
                <i className="fas fa-bolt text-amber-300 text-[8px]"></i>
                INSTANT ⚡
              </span>
            </div>
          </div>

          {/* Typography */}
          <div className="text-center relative z-10 flex flex-col items-center">
            <h1 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-white tracking-tight drop-shadow-[0_0_20px_rgba(251,191,36,0.5)]">
              RF SMM PANEL
            </h1>
            <div className="flex items-center gap-2 mt-2">
              <span className="h-[1px] w-6 bg-gradient-to-r from-transparent to-amber-400/60"></span>
              <p className="text-amber-300 text-[11px] font-extrabold tracking-widest uppercase font-mono">
                BANGLADESH'S #1 SMM PLATFORM
              </p>
              <span className="h-[1px] w-6 bg-gradient-to-l from-transparent to-amber-400/60"></span>
            </div>
          </div>

          {/* Futuristic Loader */}
          <div className="relative mt-8 flex flex-col items-center gap-2">
            <div className="splash-loader">
              <div className="splash-loader-fill"></div>
            </div>
            <span className="text-[10px] font-bold text-slate-400 tracking-wider font-mono flex items-center gap-1.5">
              <i className="fas fa-circle-notch fa-spin text-amber-400 text-[9px]"></i>
              <span>LOADING EXPERIENCE...</span>
            </span>
          </div>
        </div>
      )}

      {/* Auth Screen */}
      {!showSplash && !isLoggedIn && (
        <div className="fixed inset-0 z-[8000] bg-[#030712] flex flex-col items-center justify-center p-6 overflow-y-auto">
          {/* Ambient Glow */}
          <div className="absolute w-72 h-72 rounded-full bg-amber-500/10 blur-3xl pointer-events-none top-10" />

          {/* Auth Medallion */}
          <div className="relative mb-3 flex flex-col items-center">
            <div className="relative w-20 h-20 rounded-2xl p-[2px] bg-gradient-to-br from-amber-300 via-yellow-500 to-cyan-500 shadow-[0_0_30px_rgba(251,191,36,0.4)] flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-slate-950/90 flex flex-col items-center justify-center p-1 border border-amber-400/30">
                {adminSiteLogo ? (
                  <img src={adminSiteLogo} alt="Logo" className="w-12 h-12 object-contain" />
                ) : (
                  <>
                    <i className="fas fa-crown text-amber-300 text-2xl drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]"></i>
                    <span className="text-[9px] font-black text-cyan-300 tracking-wider font-mono uppercase mt-0.5">
                      RF SMM
                    </span>
                  </>
                )}
              </div>
            </div>
            <div className="absolute -top-2 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 text-[8px] font-black px-2 py-0.2 rounded-full shadow border border-white font-mono uppercase">
              👑 RF SMM
            </div>
          </div>

          <h1 className="text-2xl font-black tracking-tight mb-1 text-white flex items-center gap-1.5">
            <span>RF SMM</span>
            <span className="text-amber-400 font-normal">PANEL</span>
          </h1>
          <p className="text-xs font-bold tracking-widest uppercase mb-6 text-amber-300/80 font-mono">
            BANGLADESH'S #1 SMM PORTAL
          </p>

          <div className="auth-card auth-animate w-full">
            <div className="auth-tab">
              <button
                className={`auth-tab-btn ${authTab === 'login' ? 'active-tab' : ''}`}
                onClick={() => {
                  setAuthTab('login');
                  haptic('light');
                }}
              >
                Login
              </button>
              <button
                className={`auth-tab-btn ${authTab === 'register' ? 'active-tab' : ''}`}
                onClick={() => {
                  setAuthTab('register');
                  haptic('light');
                }}
              >
                Register
              </button>
            </div>

            {authTab === 'login' ? (
              <div>
                <div className="mb-3">
                  <label className="form-label flex items-center justify-between">
                    <span>Username or Gmail / Email</span>
                    <span className="text-[10px] text-amber-400 font-normal">ইউজার নাম বা জিমেইল</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className="auth-input pl-9"
                      placeholder="e.g. username or user@gmail.com"
                      value={loginUsername}
                      onChange={(e) => setLoginUsername(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                    <i className="fas fa-user-circle absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  </div>
                  {loginUserErr && <p className="auth-error show">{loginUserErr}</p>}
                </div>

                <div className="mb-5">
                  <label className="form-label flex items-center justify-between">
                    <span>Password</span>
                    <span className="text-[10px] text-amber-400 font-normal">পাসওয়ার্ড</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      className="auth-input pl-9"
                      placeholder="Enter your password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                    />
                    <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  </div>
                  {loginPassErr && <p className="auth-error show">{loginPassErr}</p>}
                </div>

                <button
                  className="btn-primary-solid flex items-center justify-center gap-2 w-full py-3"
                  onClick={handleLogin}
                  disabled={authSubmitting}
                >
                  {authSubmitting ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    <>
                      <i className="fas fa-sign-in-alt text-xs"></i>
                      <span className="font-extrabold tracking-wider">LOGIN / লগইন</span>
                    </>
                  )}
                </button>
              </div>
            ) : (
              <div>
                <div className="mb-3">
                  <label className="form-label flex items-center justify-between">
                    <span>Full Name</span>
                    <span className="text-[10px] text-amber-400 font-normal">সম্পূর্ণ নাম</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className="auth-input pl-9"
                      placeholder="Your full name (যেমন: মোঃ রাহুল)"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                    />
                    <i className="fas fa-id-badge absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  </div>
                  {regNameErr && <p className="auth-error show">{regNameErr}</p>}
                </div>

                <div className="mb-3">
                  <label className="form-label flex items-center justify-between">
                    <span>Username</span>
                    <span className="text-[10px] text-amber-400 font-normal">ইউজার নাম (ইউনিক)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      className="auth-input pl-9 font-mono lowercase"
                      placeholder="Choose username (e.g. rahul123)"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                    />
                    <i className="fas fa-at absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  </div>
                  {regUserErr && <p className="auth-error show">{regUserErr}</p>}
                </div>

                <div className="mb-3">
                  <label className="form-label flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <span>Gmail / Email</span>
                      <span className="text-red-400 text-xs font-bold">*</span>
                    </span>
                    <span className="text-[10px] text-amber-400 font-normal">জিমেইল / ইমেইল (আবশ্যক)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      className="auth-input pl-9 font-mono"
                      placeholder="e.g. yourname@gmail.com"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                    />
                    <i className="fas fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  </div>
                  {regEmailErr && <p className="auth-error show">{regEmailErr}</p>}
                </div>

                <div className="mb-3">
                  <label className="form-label flex items-center justify-between">
                    <span>Password</span>
                    <span className="text-[10px] text-amber-400 font-normal">পাসওয়ার্ড (মিনিমাম ৬ অক্ষর)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      className="auth-input pl-9"
                      placeholder="Create a strong password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                    />
                    <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  </div>
                  {regPassErr && <p className="auth-error show">{regPassErr}</p>}
                </div>

                <div className="mb-3">
                  <label className="form-label flex items-center justify-between">
                    <span>Confirm Password</span>
                    <span className="text-[10px] text-amber-400 font-normal">কনফার্ম পাসওয়ার্ড</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      className="auth-input pl-9"
                      placeholder="Re-enter password"
                      value={regConfirmPass}
                      onChange={(e) => setRegConfirmPass(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
                    />
                    <i className="fas fa-shield-alt absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                  </div>
                  {regConfirmErr && <p className="auth-error show">{regConfirmErr}</p>}
                </div>

                <div className="mb-4">
                  <div className="flex items-center justify-between">
                    <label className="form-label mb-1 flex items-center gap-1.5">
                      <i className="fas fa-gift text-amber-400 text-xs"></i>
                      <span>Referral Code (ঐচ্ছিক)</span>
                    </label>
                    <span className="text-[9px] text-amber-300 font-bold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      ৫% ডিপোজিট বোনাস 🎁
                    </span>
                  </div>
                  <input
                    type="text"
                    className="auth-input font-mono text-amber-300"
                    placeholder="e.g. friend's username or code"
                    value={regReferralCode}
                    onChange={(e) => setRegReferralCode(e.target.value)}
                  />
                  {regReferralCode && (
                    <p className="text-[10px] text-emerald-400 mt-1 font-semibold flex items-center gap-1">
                      <i className="fas fa-check-circle text-[9px]"></i>
                      <span>Referrer applied: @{regReferralCode}</span>
                    </p>
                  )}
                </div>

                <button
                  className="btn-primary-solid flex items-center justify-center gap-2 w-full py-3"
                  onClick={handleRegister}
                  disabled={authSubmitting}
                >
                  {authSubmitting ? (
                    <span className="loading-spinner"></span>
                  ) : (
                    <>
                      <i className="fas fa-user-plus text-xs"></i>
                      <span className="font-extrabold tracking-wider">CREATE ACCOUNT / রেজিস্ট্রেশন</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
          <p className="text-[10px] mt-6 text-center font-semibold text-slate-500">
            By continuing, you agree to our Terms of Service
          </p>


        </div>
      )}

      {/* Main Application */}
      {!showSplash && isLoggedIn && (
        <div>
          {/* HEADER */}
          <header className="premium-header px-5 pt-7 pb-7">
            <div className="flex items-center justify-between mb-6 relative z-10">
              <div
                onClick={() => {
                  setActiveTab('profile');
                  haptic('light');
                }}
                className="flex items-center gap-3 cursor-pointer group"
                title="View Profile (প্রোফাইল দেখুন)"
              >
                {/* Admin Logo or User Avatar */}
                <div className="relative flex items-center gap-2.5">
                  {adminSiteLogo && (
                    <img
                      src={adminSiteLogo}
                      alt="Site Logo"
                      className="w-10 h-10 sm:w-11 sm:h-11 object-contain rounded-xl shadow-lg border border-amber-400/50 bg-black/40 p-1 group-hover:scale-105 transition duration-300 flex-shrink-0"
                    />
                  )}
                  <div className="relative">
                    {userPhotoURL || currentUser?.photoURL ? (
                      <img
                        src={userPhotoURL || currentUser?.photoURL}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover shadow-lg border-2 border-amber-400/60 group-hover:scale-105 transition duration-300"
                        alt="User Avatar"
                      />
                    ) : (
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                          currentUser?.name || 'User'
                        )}&background=3b82f6&color=fff&bold=true`}
                        className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover shadow-lg border-2 border-white/10 group-hover:scale-105 transition duration-300"
                        alt="User Avatar"
                      />
                    )}
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 rounded-md flex items-center justify-center border-2 border-[#030712]">
                      <i className="fas fa-check text-white text-[6px]"></i>
                    </div>
                  </div>
                </div>
                <div>
                  <h3 className="font-extrabold text-base tracking-tight text-white group-hover:text-amber-400 transition flex items-center gap-1.5">
                    <span>{currentUser?.name || 'User'}</span>
                    <i className="fas fa-chevron-right text-[10px] text-slate-500 group-hover:text-amber-400"></i>
                  </h3>
                  <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-mono">
                    <i className="fas fa-fingerprint text-[8px] text-blue-400"></i>
                    <span>@{currentUser?.username || currentUser?.uid.slice(0, 8)}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2 items-center">
                {/* Live Orders Button */}
                <button
                  onClick={() => {
                    setShowLiveOrdersModal(true);
                    haptic('heavy');
                  }}
                  className="relative w-10 h-10 bg-gradient-to-b from-red-500/20 to-red-950/50 border border-red-500/40 hover:border-red-400 rounded-2xl flex items-center justify-center text-red-400 cursor-pointer active:scale-90 transition-all duration-200 shadow-[0_4px_15px_rgba(239,68,68,0.25)] hover:shadow-[0_0_20px_rgba(239,68,68,0.4)] backdrop-blur-md"
                  title="Live Orders (লাইভ অর্ডার)"
                >
                  <i className="fas fa-broadcast-tower text-sm text-red-400 animate-pulse"></i>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping"></span>
                  <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#030712]"></span>
                </button>

                {/* Referral & 5% Bonus Button */}
                <button
                  onClick={() => {
                    setShowReferralModal(true);
                    haptic('heavy');
                  }}
                  className="relative w-10 h-10 bg-gradient-to-b from-yellow-500/20 to-amber-950/50 border border-yellow-500/40 hover:border-yellow-400 rounded-2xl flex items-center justify-center text-yellow-300 cursor-pointer active:scale-90 transition-all duration-200 shadow-[0_4px_15px_rgba(234,179,8,0.25)] hover:shadow-[0_0_20px_rgba(234,179,8,0.4)] backdrop-blur-md"
                  title="Referral & 5% Deposit Bonus (রেফারেল)"
                >
                  <i className="fas fa-gift text-sm text-yellow-400"></i>
                  <span className="absolute -top-1 -right-1 bg-emerald-500 text-[8px] font-black px-1 rounded-full text-black shadow">5%</span>
                </button>

                {/* Tasks Button */}
                <button
                  onClick={() => {
                    setShowTasksModal(true);
                    haptic('heavy');
                  }}
                  className="relative w-10 h-10 bg-gradient-to-b from-amber-500/20 to-amber-950/50 border border-amber-500/40 hover:border-amber-400 rounded-2xl flex items-center justify-center text-amber-300 cursor-pointer active:scale-90 transition-all duration-200 shadow-[0_4px_15px_rgba(245,158,11,0.25)] hover:shadow-[0_0_20px_rgba(245,158,11,0.4)] backdrop-blur-md"
                  title="Daily Tasks & Rewards (টাস্ক)"
                >
                  <i className="fas fa-tasks text-sm text-amber-400"></i>
                </button>

                {/* Search Button */}
                <button
                  onClick={() => {
                    setShowSearchModal(true);
                    haptic('light');
                  }}
                  className="relative w-10 h-10 bg-gradient-to-b from-blue-500/20 to-blue-950/50 border border-blue-500/40 hover:border-blue-400 rounded-2xl flex items-center justify-center text-blue-300 cursor-pointer active:scale-90 transition-all duration-200 shadow-[0_4px_15px_rgba(59,130,246,0.25)] hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] backdrop-blur-md"
                  title="Search Services (সার্চ)"
                >
                  <i className="fas fa-search text-sm text-blue-400"></i>
                </button>

                {/* Live 3D Theme & Welcome Button (controlled by admin) */}
                {welcomeConfig.show3DButton !== false && (
                  <button
                    onClick={() => {
                      setShow3DThemeModal(true);
                      haptic('heavy');
                    }}
                    className="relative w-10 h-10 bg-gradient-to-b from-cyan-500/20 to-cyan-950/50 border border-cyan-400/50 hover:border-cyan-300 rounded-2xl flex items-center justify-center text-cyan-300 cursor-pointer active:scale-90 transition-all duration-200 shadow-[0_4px_15px_rgba(56,189,248,0.3)] hover:shadow-[0_0_22px_rgba(56,189,248,0.5)] backdrop-blur-md"
                    title="3D Live Theme & Welcome (3D থিম ও অ্যানিমেশন)"
                  >
                    <i className="fas fa-cube text-sm text-cyan-300 animate-spin" style={{ animationDuration: '8s' }}></i>
                    <span className="absolute -top-1 -right-1 w-2 h-2 bg-cyan-400 rounded-full animate-ping"></span>
                  </button>
                )}

                {/* Notifications Button */}
                <button
                  onClick={() => {
                    setShowNotifModal(true);
                    haptic('light');
                  }}
                  className="relative w-10 h-10 bg-gradient-to-b from-white/10 to-slate-900/60 border border-white/15 hover:border-amber-400/50 rounded-2xl flex items-center justify-center text-white cursor-pointer active:scale-90 transition-all duration-200 shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:shadow-[0_0_18px_rgba(245,158,11,0.3)] backdrop-blur-md"
                  title="Notifications (নটিফিকেশন)"
                >
                  <i className="fas fa-bell text-sm text-amber-400"></i>
                  {unreadNotifCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-[#030712] animate-bounce">
                      {unreadNotifCount}
                    </span>
                  )}
                </button>

                {/* Mailbox Button */}
                <button
                  onClick={() => {
                    setShowMailboxModal(true);
                    haptic('light');
                  }}
                  className="relative w-10 h-10 bg-gradient-to-b from-white/10 to-slate-900/60 border border-white/15 hover:border-emerald-400/50 rounded-2xl flex items-center justify-center text-white cursor-pointer active:scale-90 transition-all duration-200 shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:shadow-[0_0_18px_rgba(16,185,129,0.3)] backdrop-blur-md"
                  title="Mail Box (মেইল বক্স)"
                >
                  <i className="fas fa-envelope text-sm text-emerald-400"></i>
                  {unreadMailCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border border-[#030712]">
                      {unreadMailCount}
                    </span>
                  )}
                </button>

                {/* Admin Mode Toggle Button - Only shown for rashal117 */}
                {isAdminUser && (
                  <button
                    onClick={() => {
                      setActiveTab(activeTab === 'admin' ? 'home' : 'admin');
                      haptic('heavy');
                    }}
                    className={`relative px-3.5 py-2 rounded-2xl border flex items-center gap-1.5 font-extrabold text-[11px] cursor-pointer transition-all duration-200 active:scale-90 shadow-md ${
                      activeTab === 'admin'
                        ? 'bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-600 text-slate-950 border-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.6)] font-black'
                        : 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30 hover:border-amber-400'
                    }`}
                    title="Admin Panel (এডমিন প্যানেল)"
                  >
                    <i className="fas fa-crown text-amber-400 text-xs"></i>
                    <span>ADMIN</span>
                  </button>
                )}
              </div>
            </div>

            {/* STAT CARDS */}
            <div className="grid grid-cols-2 gap-3 relative z-10">
              {/* Balance Card */}
              <div className="stat-card bg-gradient-to-br from-slate-900/95 via-slate-900/70 to-blue-950/50 border border-blue-500/30 shadow-[0_8px_25px_rgba(0,0,0,0.35)] group rounded-[22px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-7 h-7 bg-blue-500/25 border border-blue-500/40 rounded-xl flex items-center justify-center text-blue-400 shadow-inner">
                      <i className="fas fa-wallet text-xs"></i>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-300">
                      ব্যালেন্স (Balance)
                    </span>
                  </div>
                  <span className="text-[9px] font-mono text-cyan-400/90 font-bold bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/20">
                    ≈ ${(userBalance / 120).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between mb-1">
                  <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]">
                    ৳ {userBalance.toFixed(2)}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('funds');
                    haptic('heavy');
                  }}
                  className="mt-2.5 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-[11px] font-black uppercase tracking-wider shadow-[0_6px_20px_rgba(37,99,235,0.4)] hover:shadow-[0_8px_25px_rgba(37,99,235,0.6)] border border-white/20 transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fas fa-plus-circle text-amber-300 text-xs"></i>
                  <span>টাকা জমা (Add Funds)</span>
                </button>
              </div>

              {/* Total Orders Card */}
              <div className="stat-card bg-gradient-to-br from-slate-900/95 via-slate-900/70 to-indigo-950/50 border border-indigo-500/30 shadow-[0_8px_25px_rgba(0,0,0,0.35)] group rounded-[22px] p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-7 h-7 bg-indigo-500/25 border border-indigo-500/40 rounded-xl flex items-center justify-center text-indigo-400 shadow-inner">
                      <i className="fas fa-boxes-stacked text-xs"></i>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-300">
                      অর্ডার (Orders)
                    </span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" title="System Active"></span>
                </div>
                <div className="flex items-baseline justify-between mb-1">
                  <h2 className="text-2xl font-black text-white tracking-tight drop-shadow-[0_2px_10px_rgba(255,255,255,0.15)]">
                    {userTotalOrders}
                  </h2>
                </div>
                <button
                  onClick={() => {
                    setActiveTab('orders');
                    haptic('light');
                  }}
                  className="mt-2.5 w-full py-2 px-3 rounded-xl bg-gradient-to-r from-slate-800/90 to-slate-900/95 hover:from-slate-750 hover:to-slate-850 border border-indigo-500/35 hover:border-indigo-400 text-slate-100 text-[11px] font-black uppercase tracking-wider shadow-[0_4px_15px_rgba(0,0,0,0.3)] hover:shadow-[0_6px_20px_rgba(99,102,241,0.25)] transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <i className="fas fa-list-check text-indigo-400 text-xs"></i>
                  <span>অর্ডার হিস্টোরি</span>
                </button>
              </div>
            </div>

            {/* LIVE ANNOUNCEMENT TICKER (controlled by admin) */}
            {welcomeConfig.showNoticeTicker !== false && (
              <div className="mt-3 relative z-10 overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-slate-900/90 border border-amber-500/30 p-2.5 flex items-center gap-2.5 shadow-lg backdrop-blur-md">
                <div className="flex items-center gap-1.5 bg-gradient-to-r from-amber-500/25 to-yellow-500/25 text-amber-300 text-[10px] font-black px-2.5 py-1 rounded-xl border border-amber-500/40 whitespace-nowrap shadow-sm">
                  <i className="fas fa-bullhorn text-amber-400 text-xs animate-bounce"></i>
                  <span>নোটিশ</span>
                </div>
                <div className="overflow-hidden whitespace-nowrap w-full">
                  <p className="text-[11px] font-semibold text-slate-200 inline-block animate-marquee">
                    {welcomeConfig.noticeText || '⚡ ২৪/৭ ইনস্ট্যান্ট সার্ভিস সক্রিয় | বিকাশ, নগদ, রকেটে ইনস্ট্যান্ট ডিপোজিট বোনাস চলছে | যেকোনো প্রয়োজনে আমাদের লাইভ সাপোর্টে যোগাযোগ করুন 🚀'}
                  </p>
                </div>
              </div>
            )}

            {/* USER QUICK 4-GRID ACTION BAR */}
            <div className="grid grid-cols-4 gap-2.5 mt-3 relative z-10">
              {/* Live Orders */}
              <button
                onClick={() => {
                  setShowLiveOrdersModal(true);
                  haptic('heavy');
                }}
                className="p-3 rounded-2xl bg-gradient-to-b from-red-950/50 via-slate-900/80 to-slate-950/90 border border-red-500/35 hover:border-red-400/80 transition-all duration-200 active:scale-90 flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer shadow-[0_4px_18px_rgba(239,68,68,0.18)] hover:shadow-[0_6px_22px_rgba(239,68,68,0.35)]"
              >
                <div className="w-8 h-8 rounded-xl bg-red-500/20 border border-red-500/40 flex items-center justify-center text-red-400 relative group-hover:scale-110 transition duration-200 shadow-inner">
                  <i className="fas fa-satellite-dish text-xs animate-pulse"></i>
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                </div>
                <span className="text-[10px] font-extrabold text-slate-200 group-hover:text-white tracking-tight">লাইভ অর্ডার</span>
              </button>

              {/* Daily Tasks */}
              <button
                onClick={() => {
                  setShowTasksModal(true);
                  haptic('heavy');
                }}
                className="p-3 rounded-2xl bg-gradient-to-b from-amber-950/50 via-slate-900/80 to-slate-950/90 border border-amber-500/35 hover:border-amber-400/80 transition-all duration-200 active:scale-90 flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer shadow-[0_4px_18px_rgba(245,158,11,0.18)] hover:shadow-[0_6px_22px_rgba(245,158,11,0.35)]"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 group-hover:scale-110 transition duration-200 shadow-inner">
                  <i className="fas fa-gift text-xs"></i>
                </div>
                <span className="text-[10px] font-extrabold text-slate-200 group-hover:text-white tracking-tight">টাস্ক বোনাস</span>
              </button>

              {/* Price / Services */}
              <button
                onClick={() => {
                  setShowSearchModal(true);
                  haptic('light');
                }}
                className="p-3 rounded-2xl bg-gradient-to-b from-cyan-950/50 via-slate-900/80 to-slate-950/90 border border-cyan-500/35 hover:border-cyan-400/80 transition-all duration-200 active:scale-90 flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer shadow-[0_4px_18px_rgba(56,189,248,0.18)] hover:shadow-[0_6px_22px_rgba(56,189,248,0.35)]"
              >
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 group-hover:scale-110 transition duration-200 shadow-inner">
                  <i className="fas fa-tags text-xs"></i>
                </div>
                <span className="text-[10px] font-extrabold text-slate-200 group-hover:text-white tracking-tight">সার্ভিস রেট</span>
              </button>

              {/* 24/7 Support */}
              <a
                href="https://wa.me/8801828779117"
                target="_blank"
                rel="noreferrer"
                onClick={() => haptic('light')}
                className="p-3 rounded-2xl bg-gradient-to-b from-emerald-950/50 via-slate-900/80 to-slate-950/90 border border-emerald-500/35 hover:border-emerald-400/80 transition-all duration-200 active:scale-90 flex flex-col items-center justify-center gap-1.5 text-center group cursor-pointer shadow-[0_4px_18px_rgba(16,185,129,0.18)] hover:shadow-[0_6px_22px_rgba(16,185,129,0.35)]"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition duration-200 shadow-inner">
                  <i className="fab fa-whatsapp text-sm"></i>
                </div>
                <span className="text-[10px] font-extrabold text-slate-200 group-hover:text-white tracking-tight">হোয়াটসঅ্যাপ</span>
              </a>
            </div>
          </header>

          {/* HOME TAB */}
          {activeTab === 'home' && (
            <section className="px-5 mt-5">
              {/* 24/7 Live AI Support Banner */}
              {welcomeConfig.aiSupportEnabled !== false && (
                <div
                  onClick={() => {
                    setShowAISupportModal(true);
                    haptic('heavy');
                  }}
                  className="mb-3.5 p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/25 via-yellow-500/15 to-blue-950/40 border border-amber-500/40 hover:border-amber-400 transition-all duration-200 cursor-pointer shadow-[0_4px_20px_rgba(245,158,11,0.15)] flex items-center justify-between active:scale-[0.99] group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-black flex items-center justify-center text-lg font-black shadow-md shadow-amber-500/30 group-hover:scale-105 transition">
                      <i className="fas fa-robot"></i>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-xs text-white">২৪/৭ লাইভ AI সাপোর্ট সহকারী</h4>
                        <span className="bg-emerald-500 text-black font-black text-[9px] px-1.5 py-0.2 rounded font-mono">
                          ONLINE ⚡
                        </span>
                      </div>
                      <p className="text-[10px] text-amber-200/90 mt-0.5">
                        ডিপোজিট, অর্ডার বা প্যানেল বিষয়ক যেকোনো প্রশ্ন করুন • ইনস্ট্যান্ট সমাধান পান
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-amber-400 text-xs font-black bg-amber-500/10 px-2.5 py-1.5 rounded-xl border border-amber-500/30 group-hover:bg-amber-500 group-hover:text-black transition">
                    <span>চ্যাট শুরু</span>
                    <i className="fas fa-arrow-right text-[9px]"></i>
                  </div>
                </div>
              )}

              {/* SEARCH BAR TRIGGER */}
              <div className="mb-3">
                <div
                  onClick={() => {
                    setShowSearchModal(true);
                    haptic('light');
                  }}
                  className="relative w-full bg-gradient-to-r from-slate-900/95 via-slate-900/85 to-blue-950/40 border border-blue-500/35 hover:border-blue-400/70 rounded-2xl py-3 pl-10 pr-4 text-xs font-semibold text-slate-300 shadow-[0_6px_25px_rgba(0,0,0,0.35)] cursor-pointer transition-all duration-200 flex items-center justify-between group active:scale-[0.99]"
                >
                  <div className="flex items-center gap-2.5 text-slate-400">
                    <i className="fas fa-search text-cyan-400 text-sm group-hover:scale-110 transition"></i>
                    <span className="text-slate-300 font-medium">সার্চ করুন (Facebook, TikTok, Followers)...</span>
                  </div>
                  <span className="bg-gradient-to-r from-blue-600/30 to-cyan-500/30 text-cyan-300 text-[10px] font-extrabold px-3 py-1 rounded-xl border border-cyan-400/40 shadow-sm flex items-center gap-1">
                    <span>SEARCH</span>
                    <i className="fas fa-sparkles text-[8px]"></i>
                  </span>
                </div>
              </div>

              {/* REFERRAL & 5% DEPOSIT BONUS BANNER */}
              <div
                onClick={() => {
                  setShowReferralModal(true);
                  haptic('heavy');
                }}
                className="mb-4 p-3 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-600/10 to-slate-900 border border-amber-500/40 hover:border-amber-400/80 transition-all duration-200 cursor-pointer active:scale-[0.99] shadow-[0_4px_20px_rgba(245,158,11,0.15)] flex items-center justify-between group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/25 border border-amber-500/40 flex items-center justify-center text-amber-300 text-base group-hover:scale-110 transition shadow-inner">
                    <i className="fas fa-hand-holding-dollar"></i>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-xs text-white">রেফারেল বোনাস ({referralConfig.bonusPercent || 10}% প্রতি ডিপোজিটে)</h4>
                      <span className="bg-emerald-500 text-black font-black text-[9px] px-1.5 py-0.2 rounded-md">
                        +{referralConfig.bonusPercent || 10}% BONUS
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-200/80 mt-0.5">
                      বন্ধুকে রেফার করুন, বন্ধু যেকোনো এমাউন্ট ডিপোজিট করলেই আপনি পাবেন {referralConfig.bonusPercent || 10}% ক্যাশ বোনাস!
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-amber-400 text-[11px] font-black bg-amber-500/15 px-2.5 py-1.5 rounded-xl border border-amber-500/30 group-hover:bg-amber-500 group-hover:text-black transition shrink-0">
                  <span>রেফার</span>
                  <i className="fas fa-arrow-right text-[8px]"></i>
                </div>
              </div>
              {/* SOCIAL PLATFORMS SELECTOR GRID */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2.5 px-1">
                  <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-200 flex items-center gap-1.5">
                    <i className="fas fa-layer-group text-blue-400"></i>Select Platform (প্ল্যাটফর্ম বাছুন)
                  </span>
                  <span className="text-[9px] text-cyan-300 font-bold bg-cyan-500/15 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                    Tap to Select ⚡
                  </span>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2.5">
                  {SOCIAL_PLATFORMS.map((platform) => {
                    const isSelected = selectedCategory && (
                      selectedCategory.toLowerCase().includes(platform.id) ||
                      (platform.id === 'facebook' && selectedCategory.toLowerCase().includes('fb')) ||
                      (platform.id === 'instagram' && selectedCategory.toLowerCase().includes('ig')) ||
                      (platform.id === 'tiktok' && selectedCategory.toLowerCase().includes('tt')) ||
                      (platform.id === 'youtube' && selectedCategory.toLowerCase().includes('yt')) ||
                      (platform.id === 'telegram' && selectedCategory.toLowerCase().includes('tg'))
                    );

                    return (
                      <button
                        key={platform.id}
                        onClick={() => handleSelectPlatformLogo(platform.id)}
                        className={`group relative flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 cursor-pointer active:scale-90 shadow-md ${
                          isSelected
                            ? 'bg-gradient-to-b ' + platform.bg + ' border-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.5)] ring-2 ring-blue-400/50 scale-[1.03]'
                            : 'bg-gradient-to-b from-white/8 to-white/3 border-white/10 hover:border-white/25 hover:bg-white/10'
                        }`}
                      >
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center text-2xl transition-transform group-hover:scale-115 drop-shadow"
                          style={{ color: platform.color }}
                        >
                          <i className={platform.icon}></i>
                        </div>
                        <span className="text-[10px] font-bold text-slate-200 mt-1.5 truncate max-w-full">
                          {platform.name.split(' ')[0]}
                        </span>
                        {isSelected && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white text-[8px] font-black border-2 border-[#030712] shadow">
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* NEW ORDER CARD WITH STEPPER TRACK ("রোগ") */}
              <div id="order-form" className="glass-card p-5 mb-5 relative overflow-hidden border border-blue-500/20 shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 bg-blue-500/15 rounded-xl flex items-center justify-center text-blue-400 shadow-inner">
                      <i className="fas fa-cart-plus text-sm"></i>
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-white">New Order (নতুন অর্ডার)</h3>
                      <p className="text-[9px] font-semibold text-slate-400">Step-by-step automatic dispatch</p>
                    </div>
                  </div>
                  <div className="text-[8px] font-black text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-md tracking-wider border border-blue-500/20">
                    INSTANT ⚡
                  </div>
                </div>

                {/* DYNAMIC PROGRESS STEPPER TRACK ("রোগ" / STEP BAR) */}
                <div className="mb-5 bg-slate-900/80 border border-white/10 rounded-2xl p-3.5 backdrop-blur-md">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-blue-300">
                        Order Process (অর্ডার প্রসেস)
                      </span>
                    </div>
                    <span className="text-[10px] font-mono font-bold text-slate-300">
                      Step {activeStepIndex}/5 ({orderStepProgress}%)
                    </span>
                  </div>

                  {/* Dynamic Progress Line Track ("রোগ") */}
                  <div className="relative w-full h-2.5 bg-slate-800 rounded-full overflow-hidden mb-3.5 border border-white/5">
                    <div
                      className="h-full bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 transition-all duration-500 ease-out rounded-full shadow-[0_0_12px_rgba(59,130,246,0.8)]"
                      style={{ width: `${orderStepProgress}%` }}
                    ></div>
                  </div>

                  {/* Step Nodes */}
                  <div className="grid grid-cols-5 gap-1 text-center">
                    {[
                      { step: 1, label: 'ক্যাটাগরি', icon: 'fas fa-folder-open', done: isStep1Done },
                      { step: 2, label: 'সার্ভিস', icon: 'fas fa-magic', done: isStep2Done },
                      { step: 3, label: 'লিঙ্ক', icon: 'fas fa-link', done: isStep3Done },
                      { step: 4, label: 'পরিমাণ', icon: 'fas fa-hashtag', done: isStep4Done },
                      { step: 5, label: 'কনফার্ম', icon: 'fas fa-check-circle', done: isStep4Done },
                    ].map((s) => {
                      const isActive = activeStepIndex === s.step;
                      return (
                        <div key={s.step} className="flex flex-col items-center">
                          <div
                            className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black transition-all duration-300 ${
                              s.done
                                ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.5)] scale-105'
                                : isActive
                                ? 'bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.8)] ring-2 ring-blue-400/50 scale-110'
                                : 'bg-slate-800 text-slate-500 border border-white/5'
                            }`}
                          >
                            {s.done ? <i className="fas fa-check text-[9px]"></i> : <i className={`${s.icon} text-[9px]`}></i>}
                          </div>
                          <span
                            className={`text-[8px] font-bold mt-1 tracking-tight ${
                              s.done
                                ? 'text-emerald-400'
                                : isActive
                                ? 'text-blue-300 font-extrabold'
                                : 'text-slate-500'
                            }`}
                          >
                            {s.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Category Dropdown */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="form-label mb-0">
                        <i className="fas fa-folder-open mr-1 text-[8px]"></i> 1. Category
                      </label>
                      {selectedCategory && (
                        <div className="flex items-center gap-1 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-[9px] text-blue-300 font-bold">
                          <i className={getPlatformMeta(selectedCategory).icon}></i>
                          <span>{getPlatformMeta(selectedCategory).name}</span>
                        </div>
                      )}
                    </div>
                    <div className="relative">
                      <select
                        className="input-modern appearance-none pr-8"
                        value={selectedCategory}
                        onChange={(e) => handleCategoryChange(e.target.value)}
                      >
                        <option value="" disabled>
                          Choose category...
                        </option>
                        {categories.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[10px]"></i>
                    </div>
                    {catErr && <p className="field-error show">{catErr}</p>}
                  </div>

                  {/* Service Dropdown */}
                  <div>
                    <label className="form-label">
                      <i className="fas fa-magic mr-1 text-[8px]"></i> 2. Service
                    </label>
                    <div className="relative">
                      <select
                        className="input-modern appearance-none pr-8"
                        value={selectedServiceId}
                        onChange={(e) => handleServiceChange(e.target.value)}
                        disabled={!selectedCategory}
                      >
                        <option value="" disabled>
                          {selectedCategory ? '✨ Select service...' : 'Select category first'}
                        </option>
                        {allServices
                          .filter((s) => s.category === selectedCategory)
                          .map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name} — ৳ {s.price}/1k
                            </option>
                          ))}
                      </select>
                      <i className="fas fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[10px]"></i>
                    </div>
                    {svcErr && <p className="field-error show">{svcErr}</p>}
                  </div>

                  {/* Service Details & Description */}
                  {currentService && (
                    <>
                      {currentService.desc && (
                        <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3">
                          <div className="flex items-start gap-2">
                            <i className="fas fa-info-circle text-blue-400 text-xs mt-0.5"></i>
                            <p className="text-[11px] font-medium text-slate-400 leading-relaxed">
                              {currentService.desc}
                            </p>
                          </div>
                        </div>
                      )}

                      <div className="bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 flex justify-between items-center">
                        <div className="text-center">
                          <p className="text-[8px] font-bold text-blue-400/70 uppercase">Min</p>
                          <p className="font-extrabold text-sm text-blue-300">
                            {currentService.min.toLocaleString()}
                          </p>
                        </div>
                        <div className="w-px h-6 bg-blue-500/15"></div>
                        <div className="text-center">
                          <p className="text-[8px] font-bold text-blue-400/70 uppercase">Max</p>
                          <p className="font-extrabold text-sm text-blue-300">
                            {currentService.max ? currentService.max.toLocaleString() : '∞'}
                          </p>
                        </div>
                        <div className="w-px h-6 bg-blue-500/10"></div>
                        <div className="text-center">
                          <p className="text-[8px] font-bold text-blue-400/70 uppercase">Rate</p>
                          <p className="font-extrabold text-sm text-blue-300">
                            ৳ {currentService.price}/1k
                          </p>
                        </div>
                      </div>
                    </>
                  )}

                  {/* Target Link Input */}
                  <div>
                    <label className="form-label">
                      <i className="fas fa-link mr-1 text-[8px]"></i> 3. Target Link
                    </label>
                    <input
                      type="text"
                      className="input-modern"
                      placeholder="https://facebook.com/username or link..."
                      value={targetLink}
                      onChange={(e) => {
                        setTargetLink(e.target.value);
                        setLinkErr('');
                      }}
                    />
                    {linkErr && <p className="field-error show">{linkErr}</p>}
                  </div>

                  {/* Quantity & Price Grid */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">
                        <i className="fas fa-hashtag mr-1 text-[8px]"></i> 4. Quantity
                      </label>
                      <input
                        type="number"
                        className="input-modern"
                        value={quantity}
                        onChange={(e) => {
                          setQuantity(parseInt(e.target.value) || 0);
                          setQtyErr('');
                        }}
                      />
                      {currentService && (
                        <p className="min-max-hint">
                          Min: {currentService.min} — Max:{' '}
                          {currentService.max?.toLocaleString() || '∞'}
                        </p>
                      )}
                      {qtyErr && <p className="field-error show">{qtyErr}</p>}
                    </div>

                    <div>
                      <label className="form-label">
                        <i className="fas fa-coins mr-1 text-[8px]"></i> 5. Cost (BDT / ৳)
                      </label>
                      <div className="bg-gradient-to-br from-blue-950/40 via-slate-900/90 to-slate-900/90 border border-blue-500/30 rounded-2xl p-3 text-center shadow-inner">
                        <span className="text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-white drop-shadow">
                          ৳ {calculatedCost.toFixed(2)}
                        </span>
                      </div>
                      <p className="text-[9px] text-center mt-1 font-semibold">
                        {calculatedCost > userBalance ? (
                          <span className="text-red-400 font-bold flex items-center justify-center gap-1">
                            <i className="fas fa-exclamation-triangle text-[8px]"></i>
                            <span>Short ৳ {(calculatedCost - userBalance).toFixed(2)}</span>
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-bold flex items-center justify-center gap-1">
                            <i className="fas fa-check-circle text-[8px]"></i>
                            <span>Balance OK</span>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={handlePlaceOrderClick}
                    disabled={orderSubmitting}
                    className={`btn-primary-solid flex items-center justify-center gap-2.5 transition-all duration-200 ${
                      isStep4Done
                        ? 'shadow-[0_12px_32px_rgba(37,99,235,0.65)] ring-2 ring-cyan-400/60 scale-[1.01]'
                        : ''
                    }`}
                  >
                    {orderSubmitting ? (
                      <span className="loading-spinner"></span>
                    ) : (
                      <>
                        <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-amber-300 shadow-sm">
                          <i className="fas fa-paper-plane text-xs"></i>
                        </div>
                        <span className="tracking-wider text-sm font-black">PLACE ORDER NOW (অর্ডার নিশ্চিত করুন)</span>
                        <i className="fas fa-bolt text-xs text-amber-300 animate-pulse"></i>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Security Banner */}
              <div
                className="glass-card p-4 flex gap-3 items-center mb-4"
                style={{
                  background: 'rgba(59,130,246,0.05)',
                  borderColor: 'rgba(59,130,246,0.1)'
                }}
              >
                <div className="w-10 h-10 bg-blue-500/15 rounded-xl flex items-center justify-center text-blue-400 flex-shrink-0">
                  <i className="fas fa-shield-alt text-lg"></i>
                </div>
                <div>
                  <h4 className="font-bold text-xs text-white">100% Secure & Refundable</h4>
                  <p className="text-[10px] text-slate-500">
                    Failed orders automatically refund Coins to your account.
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* ORDERS TAB */}
          {activeTab === 'orders' && (
            <section className="px-5 mt-5">
              <div className="flex justify-between items-center mb-5">
                <h2 className="section-title text-white">My Orders</h2>
                <div className="live-badge">LIVE</div>
              </div>

              <div className="space-y-3">
                {ordersList.length === 0 ? (
                  <div className="empty-state">
                    <i className="fas fa-receipt"></i>
                    <p>No orders yet</p>
                    <p className="text-[10px] mt-1 font-normal">Place your first order from Home</p>
                  </div>
                ) : (
                  ordersList.map((o, oIdx) => {
                    let stClass = 'bg-slate-500/15 text-slate-400';
                    let stIcon = 'fa-clock';

                    if (o.status === 'Completed') {
                      stClass = 'bg-blue-500/15 text-blue-400';
                      stIcon = 'fa-check-circle';
                    } else if (o.status === 'Processing' || o.status === 'In Progress') {
                      stClass = 'bg-indigo-500/15 text-indigo-400';
                      stIcon = 'fa-spinner fa-spin';
                    } else if (o.status === 'Cancelled') {
                      stClass = 'bg-red-500/15 text-red-400';
                      stIcon = 'fa-times-circle';
                    }

                    const meta = getPlatformMeta(o.service);

                    return (
                      <div key={`${o.id || 'ord'}-${oIdx}`} className="glass-card p-4">
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[9px] font-mono text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded">
                            #{o.id.slice(-8)}
                          </span>
                          <span className={`order-status ${stClass}`}>
                            <i className={`fas ${stIcon} mr-1 text-[7px]`}></i>
                            {o.status || 'Pending'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 my-1">
                          <div
                            className="w-6 h-6 rounded-lg flex items-center justify-center text-xs flex-shrink-0 border border-white/10"
                            style={{ color: meta.color, backgroundColor: `${meta.color}25` }}
                          >
                            <i className={meta.icon}></i>
                          </div>
                          <h4 className="font-bold text-xs text-white leading-tight">{o.service}</h4>
                        </div>
                        <p className="text-[10px] text-slate-400 truncate mt-0.5 font-mono">
                          {o.link}
                        </p>
                        <div className="dashed-divider my-3"></div>
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase">
                              Qty
                            </span>
                            <div className="font-bold text-xs text-white">
                              {o.qty?.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase">
                              Cost
                            </span>
                            <div className="font-bold text-xs text-blue-400">
                              ৳ {o.cost?.toFixed(2)}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[8px] font-black text-slate-500 uppercase">
                              Date
                            </span>
                            <div className="text-[10px] text-slate-400">
                              {o.createdAt
                                ? new Date(o.createdAt).toLocaleDateString('en-BD', {
                                    day: '2-digit',
                                    month: 'short'
                                  })
                                : 'Just now'}
                            </div>
                          </div>
                        </div>

                        {/* API Dispatch Indicator & Retry */}
                        <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                          {o.apiOrderId ? (
                            <span className="text-[8px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-mono">
                              ✅ API Order: #{o.apiOrderId}
                            </span>
                          ) : o.apiError ? (
                            <span className="text-[8px] px-2 py-0.5 rounded bg-red-500/20 text-red-300 font-mono">
                              ❌ API Error
                            </span>
                          ) : (
                            <span className="text-[8px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono">
                              ⏳ Local Order
                            </span>
                          )}

                          {(!o.apiOrderId || o.apiError) && o.status !== 'Completed' && (
                            <button
                              onClick={() => handleRetryOrder(o)}
                              className="text-[10px] px-2.5 py-1 rounded-lg bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30 font-bold transition active:scale-95"
                            >
                              🔄 Retry API
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          )}

          {/* FUNDS TAB (3-STEP WORKFLOW: 1. AMOUNT -> 2. SELECT PAYMENT OPTION -> 3. FULL-PAGE PAYMENT GATEWAY) */}
          {activeTab === 'funds' && (
            <section className="px-4 sm:px-5 mt-5">
              {/* Header Title */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="section-title text-white flex items-center gap-2">
                    <i className="fas fa-wallet text-blue-400"></i>
                    <span>টাকা জমা (Add Funds)</span>
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {depositStep === 'amount' && '১ম ধাপ: কত টাকা ডিপোজিট করতে চান লিখুন'}
                    {depositStep === 'method' && '২য় ধাপ: আপনার পছন্দের পেমেন্ট অপশনটি নির্বাচন করুন'}
                    {depositStep === 'gateway' && '৩য় ধাপ: টাকা পাঠিয়ে TrxID দিয়ে ভেরিফাই করুন'}
                  </p>
                </div>

                {depositStep === 'method' && (
                  <button
                    onClick={() => {
                      setDepositStep('amount');
                      haptic('light');
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer"
                  >
                    <i className="fas fa-arrow-left text-[10px]"></i>
                    <span>এমাউন্টে ফেরত যান</span>
                  </button>
                )}
              </div>

              {/* STEP 1: AMOUNT SELECTION SCREEN */}
              {depositStep === 'amount' && (
                <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
                  {/* Current Balance Hero Card */}
                  <div className="glass-card p-5 text-center relative overflow-hidden bg-gradient-to-br from-blue-600/20 via-slate-900/90 to-indigo-950/40 border border-blue-500/30 shadow-xl">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-400/10 via-transparent to-transparent pointer-events-none"></div>
                    <div className="relative z-10">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-2xl flex items-center justify-center mx-auto text-blue-400 text-xl mb-2.5 shadow-inner">
                        <i className="fas fa-coins text-amber-300"></i>
                      </div>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">
                        Current Account Balance (বর্তমান ব্যালেন্স)
                      </p>
                      <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                        ৳ {userBalance.toFixed(2)}
                      </h2>
                    </div>
                  </div>

                  {/* Amount Input Card */}
                  <div className="glass-card p-5 space-y-4 border border-white/10 shadow-xl">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-extrabold text-white flex items-center gap-1.5">
                          <i className="fas fa-hand-holding-dollar text-emerald-400"></i>
                          <span>কতো টাকা ডিপোজিট করতে চান লিখুন:</span>
                        </label>
                        <span className="text-xs font-bold text-amber-300">
                          ৳ {parseFloat(depositAmount) || 0}
                        </span>
                      </div>

                      {/* Large Currency Input Box */}
                      <div className="relative flex items-center">
                        <div className="absolute left-4 text-xl font-black text-blue-400 pointer-events-none select-none">
                          ৳
                        </div>
                        <input
                          type="number"
                          min="10"
                          max="100000"
                          className="w-full bg-slate-950/80 text-white font-black text-2xl sm:text-3xl pl-10 pr-4 py-3.5 rounded-2xl border-2 border-blue-500/40 focus:border-blue-400 focus:outline-none focus:ring-4 focus:ring-blue-500/20 shadow-inner tracking-tight placeholder:text-slate-600 transition"
                          placeholder="100"
                          value={depositAmount}
                          onChange={(e) => {
                            setDepositAmount(e.target.value);
                            setDepAmtErr('');
                          }}
                        />
                      </div>
                      {depAmtErr && <p className="text-xs font-bold text-red-400 mt-1.5">⚠️ {depAmtErr}</p>}
                    </div>

                    {/* Quick Amount Chips */}
                    <div>
                      <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block mb-2">
                        কুইক সিলেক্ট (Quick Select):
                      </span>
                      <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                        {['10', '50', '100', '200', '500', '1000', '2000', '5000'].map((amt, amtIdx) => {
                          const isSelected = depositAmount === amt;
                          return (
                            <button
                              key={`${amt}-${amtIdx}`}
                              type="button"
                              onClick={() => {
                                setDepositAmount(amt);
                                setDepAmtErr('');
                                haptic('light');
                              }}
                              className={`py-2 px-1 text-center font-black text-xs rounded-xl border transition active:scale-95 cursor-pointer ${
                                isSelected
                                  ? 'bg-blue-600 text-white border-blue-400 shadow-[0_0_12px_rgba(59,130,246,0.5)] scale-105'
                                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 hover:border-white/20'
                              }`}
                            >
                              ৳ {amt}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Adjust Amount Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/5">
                      <span className="text-[10px] font-bold text-slate-400 mr-1">টাকা বাড়ান/কমান:</span>
                      {[
                        { label: '+10 ৳', val: 10 },
                        { label: '+50 ৳', val: 50 },
                        { label: '+100 ৳', val: 100 },
                        { label: '+500 ৳', val: 500 },
                        { label: '-10 ৳', val: -10 },
                        { label: '-50 ৳', val: -50 }
                      ].map((btn) => (
                        <button
                          key={btn.label}
                          type="button"
                          onClick={() => {
                            const curr = parseFloat(depositAmount) || 0;
                            const nextVal = Math.max(10, curr + btn.val);
                            setDepositAmount(String(nextVal));
                            setDepAmtErr('');
                            haptic('light');
                          }}
                          className={`px-2.5 py-1 rounded-lg font-extrabold text-[10px] border transition active:scale-95 cursor-pointer ${
                            btn.val > 0
                              ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                              : 'bg-red-500/15 hover:bg-red-500/25 text-red-300 border-red-500/30'
                          }`}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>

                    {/* Next to Step 2 Button */}
                    <button
                      type="button"
                      onClick={() => {
                        const amt = parseFloat(depositAmount);
                        if (isNaN(amt) || amt < 10) {
                          setDepAmtErr('সর্বনিম্ন ডিপোজিট পরিমাণ ৳ ১০');
                          haptic('error');
                          return;
                        }
                        if (amt > 100000) {
                          setDepAmtErr('সর্বোচ্চ ডিপোজিট পরিমাণ ৳ ১০০,০০০');
                          haptic('error');
                          return;
                        }
                        setDepAmtErr('');
                        setDepositStep('method');
                        haptic('success');
                      }}
                      className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-sm sm:text-base tracking-wider uppercase shadow-[0_0_20px_rgba(59,130,246,0.4)] transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer mt-3"
                    >
                      <span>পরবর্তী ধাপ: পেমেন্ট অপশন নির্বাচন করুন</span>
                      <i className="fas fa-arrow-right text-xs"></i>
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: PAYMENT METHOD SELECTION SCREEN */}
              {depositStep === 'method' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                  {/* Selected Amount Summary Banner */}
                  <div className="bg-gradient-to-r from-blue-900/40 via-indigo-950/60 to-slate-900/80 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                    <div>
                      <span className="text-[10px] text-blue-300 font-extrabold uppercase tracking-widest block">
                        ডিপোজিট টাকার পরিমাণ (Deposit Amount):
                      </span>
                      <div className="flex items-baseline gap-1 mt-0.5">
                        <span className="text-2xl sm:text-3xl font-black text-amber-300">
                          ৳ {parseFloat(depositAmount) || 0}
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">BDT</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setDepositStep('amount');
                        haptic('light');
                      }}
                      className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                    >
                      <i className="fas fa-edit text-[10px]"></i>
                      <span>এমাউন্ট পরিবর্তন</span>
                    </button>
                  </div>

                  {/* Payment Options Header */}
                  <div className="glass-card p-5 space-y-4 border border-white/10 shadow-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                          <i className="fas fa-credit-card text-purple-400"></i>
                          <span>পেমেন্ট অপশন নির্বাচন করুন (Select Payment Method)</span>
                        </h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          টাকা পাঠানোর জন্য নিচের যেকোনো একটি পেমেন্ট গেটওয়ে বেছে নিন:
                        </p>
                      </div>
                    </div>

                    {/* Rich Grid of All Payment Methods with distinct brand styling */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {(Object.entries(paymentMethodsConfig) as [string, PaymentMethodConfig][])
                        .filter(([_, m]) => m && m.active !== false)
                        .map(([key, method]) => {
                          const methodId = method.id || key;
                          const isSelected = selectedMethod === methodId;
                          const mKey = (method.iconType || method.id || method.label || key).toLowerCase();
                          const isBkash = mKey.includes('bkash');
                          const isNagad = mKey.includes('nagad');
                          const isRocket = mKey.includes('rocket');
                          const isUpay = mKey.includes('upay');
                          const isBinance = mKey.includes('binance') || mKey.includes('crypto') || mKey.includes('usdt') || !!method.isCrypto;

                          // Dynamic brand themes for each card
                          let cardBg = 'bg-slate-900/60 hover:bg-slate-900/90 text-slate-300 border-white/10 hover:border-white/20';
                          let brandBadge = 'bg-slate-800 text-slate-300';
                          let brandSub = 'Send Money';

                          if (isBkash) {
                            brandSub = method.type || 'বিকাশ সেন্ড মানি';
                            cardBg = isSelected
                              ? 'bg-gradient-to-r from-[#9b0f49]/80 via-[#e2136e]/40 to-slate-900 border-[#e2136e] shadow-[0_0_25px_rgba(226,19,110,0.4)] ring-2 ring-[#e2136e]'
                              : 'bg-gradient-to-r from-[#e2136e]/10 to-slate-900/80 border-[#e2136e]/30 hover:border-[#e2136e]/60 text-slate-200';
                            brandBadge = 'bg-[#e2136e]/20 text-pink-300 border border-[#e2136e]/40';
                          } else if (isNagad) {
                            brandSub = method.type || 'নগদ সেন্ড মানি';
                            cardBg = isSelected
                              ? 'bg-gradient-to-r from-[#9a3412]/80 via-[#ea580c]/40 to-slate-900 border-[#ea580c] shadow-[0_0_25px_rgba(234,88,12,0.4)] ring-2 ring-[#ea580c]'
                              : 'bg-gradient-to-r from-[#ea580c]/10 to-slate-900/80 border-[#ea580c]/30 hover:border-[#ea580c]/60 text-slate-200';
                            brandBadge = 'bg-[#ea580c]/20 text-orange-300 border border-[#ea580c]/40';
                          } else if (isRocket) {
                            brandSub = method.type || 'রকেট সেন্ড মানি';
                            cardBg = isSelected
                              ? 'bg-gradient-to-r from-[#581c87]/80 via-[#8c3494]/40 to-slate-900 border-[#8c3494] shadow-[0_0_25px_rgba(140,52,148,0.4)] ring-2 ring-[#8c3494]'
                              : 'bg-gradient-to-r from-[#8c3494]/10 to-slate-900/80 border-[#8c3494]/30 hover:border-[#8c3494]/60 text-slate-200';
                            brandBadge = 'bg-[#8c3494]/20 text-purple-300 border border-[#8c3494]/40';
                          } else if (isUpay) {
                            brandSub = method.type || 'উপায় সেন্ড মানি';
                            cardBg = isSelected
                              ? 'bg-gradient-to-r from-[#003b73]/80 via-[#005696]/40 to-slate-900 border-[#0077b6] shadow-[0_0_25px_rgba(0,119,182,0.4)] ring-2 ring-[#0077b6]'
                              : 'bg-gradient-to-r from-[#005696]/10 to-slate-900/80 border-[#005696]/30 hover:border-[#005696]/60 text-slate-200';
                            brandBadge = 'bg-[#005696]/20 text-cyan-300 border border-[#005696]/40';
                          } else if (isBinance) {
                            brandSub = 'Binance Pay / USDT';
                            cardBg = isSelected
                              ? 'bg-gradient-to-r from-[#713f12]/80 via-[#f0b90b]/20 to-slate-950 border-[#f0b90b] shadow-[0_0_25px_rgba(240,185,11,0.4)] ring-2 ring-[#f0b90b]'
                              : 'bg-gradient-to-r from-[#f0b90b]/10 to-slate-950/80 border-[#f0b90b]/30 hover:border-[#f0b90b]/60 text-slate-200';
                            brandBadge = 'bg-[#f0b90b]/20 text-amber-300 border border-[#f0b90b]/40';
                          } else {
                            brandSub = method.type || 'ব্যাংক ট্রান্সফার';
                            cardBg = isSelected
                              ? 'bg-gradient-to-r from-[#064e3b]/80 via-[#0f766e]/40 to-slate-900 border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.4)] ring-2 ring-emerald-500'
                              : 'bg-gradient-to-r from-emerald-600/10 to-slate-900/80 border-emerald-500/30 hover:border-emerald-500/60 text-slate-200';
                            brandBadge = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40';
                          }

                          return (
                            <div
                              key={methodId}
                              onClick={() => {
                                setSelectedMethod(methodId);
                                haptic('light');
                              }}
                              className={`relative p-4 rounded-2xl cursor-pointer transition-all duration-200 border flex items-center justify-between gap-3 ${cardBg} ${
                                isSelected ? 'scale-[1.02]' : ''
                              }`}
                            >
                              {/* Left: Logo + Label & Type */}
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-black/50 border border-white/10 flex-shrink-0 flex items-center justify-center shadow-inner">
                                  {renderMethodLogo(method, 'w-8 h-8')}
                                </div>
                                <div>
                                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                                    <span>{method.label}</span>
                                    {isBinance && (
                                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 font-mono">
                                        ⚡ Crypto / USD
                                      </span>
                                    )}
                                  </h4>
                                  <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${brandBadge}`}>
                                      {brandSub}
                                    </span>
                                    {method.ussd && (
                                      <span className="text-[10px] text-slate-400 font-mono font-bold">
                                        {method.ussd}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Right: Checkbox / Selection Indicator */}
                              <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center border-2 transition flex-shrink-0 ${
                                  isSelected
                                    ? isBkash
                                      ? 'bg-[#e2136e] border-pink-300 text-white shadow-md'
                                      : isNagad
                                      ? 'bg-[#ea580c] border-orange-300 text-white shadow-md'
                                      : isRocket
                                      ? 'bg-[#8c3494] border-purple-300 text-white shadow-md'
                                      : isUpay
                                      ? 'bg-[#005696] border-cyan-300 text-white shadow-md'
                                      : isBinance
                                      ? 'bg-[#f0b90b] border-yellow-200 text-slate-950 font-black shadow-md'
                                      : 'bg-emerald-600 border-emerald-300 text-white shadow-md'
                                    : 'border-white/20 bg-transparent'
                                }`}
                              >
                                {isSelected && <i className="fas fa-check text-[10px] font-black"></i>}
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {/* Action Buttons */}
                    <div className="pt-3 flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setDepositStep('amount');
                          haptic('light');
                        }}
                        className="w-1/3 py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white font-bold text-xs sm:text-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <i className="fas fa-arrow-left text-[11px]"></i>
                        <span>ব্যাকে যান</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDepositStep('gateway');
                          haptic('success');
                        }}
                        className="w-2/3 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs sm:text-sm tracking-wider uppercase shadow-[0_0_20px_rgba(168,85,247,0.4)] transition active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>পেমেন্ট পেজে যান (Proceed)</span>
                        <i className="fas fa-arrow-right text-xs"></i>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: DEDICATED FULL-PAGE PAYMENT GATEWAY SCREEN (NEW DEDICATED PAGE) */}
              {depositStep === 'gateway' && (
                <div className="fixed inset-0 z-[100] bg-[#060913] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-950/30 via-[#060913] to-black overflow-y-auto flex flex-col justify-between items-center p-3 sm:p-6 animate-in fade-in zoom-in-95 duration-200">
                  {/* Outer Wrapper with Max Width */}
                  <div className="w-full max-w-lg mx-auto space-y-4 my-auto py-2">
                    {/* TOP HEADER BAR */}
                    <div className="bg-slate-900/90 border border-white/10 backdrop-blur-xl rounded-2xl p-3.5 flex items-center justify-between shadow-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setDepositStep('method');
                          haptic('light');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-black transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <i className="fas fa-arrow-left text-[11px]"></i>
                        <span>পেমেন্ট মেথড পরিবর্তন</span>
                      </button>

                      <div className="text-center">
                        <div className="flex items-center justify-center gap-1.5 text-xs font-black text-white">
                          <i className="fas fa-shield-alt text-emerald-400"></i>
                          <span>নিরাপদ পেমেন্ট গেটওয়ে</span>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">256-Bit SSL Encrypted</span>
                      </div>

                      {/* Live 15-Minute Countdown Timer */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-mono font-black shadow-inner">
                        <i className="fas fa-clock text-[10px] animate-pulse"></i>
                        <span>{formatGatewayTimer(gatewayTimeLeft)}</span>
                      </div>
                    </div>

                    {/* ORDER & PAYABLE AMOUNT BANNER */}
                    <div className="bg-gradient-to-r from-blue-900/40 via-indigo-950/60 to-slate-900/80 border border-blue-500/30 rounded-2xl p-4 flex items-center justify-between shadow-lg">
                      <div>
                        <span className="text-[10px] text-blue-300 font-extrabold uppercase tracking-widest block">
                          প্রদেয় টাকার পরিমাণ (Payable Amount):
                        </span>
                        <div className="flex items-baseline gap-1 mt-0.5">
                          <span className="text-2xl sm:text-3xl font-black text-amber-300">
                            ৳ {parseFloat(depositAmount) || 0}
                          </span>
                          <span className="text-[11px] text-slate-400 font-medium">BDT</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setDepositStep('amount');
                          haptic('light');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer active:scale-95"
                      >
                        <i className="fas fa-edit text-[10px]"></i>
                        <span>টাকা পরিবর্তন</span>
                      </button>
                    </div>

                    {/* PAYMENT METHOD SELECTOR TABS (With custom brand badge styling) */}
                    <div>
                      <p className="text-[11px] font-extrabold text-slate-300 uppercase tracking-wider mb-2 flex items-center justify-between">
                        <span>পেমেন্ট গেটওয়ে নির্বাচন:</span>
                        <button
                          type="button"
                          onClick={() => setDepositStep('method')}
                          className="text-[10px] text-purple-400 hover:text-purple-300 font-bold underline"
                        >
                          সব মেথড দেখুন
                        </button>
                      </p>
                      <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none pb-1.5">
                        {(Object.entries(paymentMethodsConfig) as [string, PaymentMethodConfig][])
                          .filter(([_, m]) => m && m.active !== false)
                          .map(([key, method]) => {
                            const methodId = method.id || key;
                            const isSelected = selectedMethod === methodId;
                            const mKey = (method.iconType || method.id || method.label || key).toLowerCase();
                            const isBkash = mKey.includes('bkash');
                            const isNagad = mKey.includes('nagad');
                            const isRocket = mKey.includes('rocket');
                            const isUpay = mKey.includes('upay');
                            const isBinance = mKey.includes('binance') || mKey.includes('crypto') || mKey.includes('usdt') || !!method.isCrypto;

                            let tabStyle = 'bg-slate-900/70 hover:bg-slate-900 text-slate-400 border-white/10';
                            if (isSelected) {
                              if (isBkash) tabStyle = 'bg-gradient-to-r from-[#e2136e] to-[#9b0f49] text-white border-pink-300 shadow-[0_0_20px_rgba(226,19,110,0.5)] scale-105';
                              else if (isNagad) tabStyle = 'bg-gradient-to-r from-[#ea580c] to-[#c2410c] text-white border-orange-300 shadow-[0_0_20px_rgba(234,88,12,0.5)] scale-105';
                              else if (isRocket) tabStyle = 'bg-gradient-to-r from-[#8c3494] to-[#4c1d95] text-white border-purple-300 shadow-[0_0_20px_rgba(140,52,148,0.5)] scale-105';
                              else if (isUpay) tabStyle = 'bg-gradient-to-r from-[#005696] to-[#003b73] text-white border-cyan-300 shadow-[0_0_20px_rgba(0,119,182,0.5)] scale-105';
                              else if (isBinance) tabStyle = 'bg-gradient-to-r from-[#f0b90b] to-[#b48608] text-slate-950 font-black border-yellow-200 shadow-[0_0_20px_rgba(240,185,11,0.5)] scale-105';
                              else tabStyle = 'bg-gradient-to-r from-emerald-600 to-teal-800 text-white border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)] scale-105';
                            }

                            return (
                              <div
                                key={methodId}
                                onClick={() => {
                                  setSelectedMethod(methodId);
                                  haptic('light');
                                }}
                                className={`relative flex items-center gap-2 py-2 px-3.5 rounded-2xl cursor-pointer transition-all flex-shrink-0 border font-black text-xs ${tabStyle}`}
                              >
                                {renderMethodLogo(method, 'w-5 h-5')}
                                <span>{method.label}</span>
                                {isSelected && (
                                  <span className="w-2 h-2 rounded-full bg-white shadow-sm animate-ping ml-0.5"></span>
                                )}
                              </div>
                            );
                          })}
                      </div>
                    </div>

                    {/* DEDICATED DISTINCT BRANDED PAYMENT CARDS */}
                    {(() => {
                      const activeCfg = paymentMethodsConfig[selectedMethod] ||
                        (Object.values(paymentMethodsConfig) as PaymentMethodConfig[]).find((m) => m && (m.id === selectedMethod || m.label === selectedMethod)) || {
                          id: selectedMethod,
                          label: selectedMethod,
                          number: '01840442809',
                          type: 'Send Money',
                          ussd: '*247#',
                          color: '#e2136e',
                          active: true
                        };

                      const mKey = (activeCfg.iconType || activeCfg.id || activeCfg.label || selectedMethod).toLowerCase();
                      const isBkash = mKey.includes('bkash');
                      const isNagad = mKey.includes('nagad');
                      const isRocket = mKey.includes('rocket');
                      const isUpay = mKey.includes('upay');
                      const isBinance = mKey.includes('binance') || mKey.includes('crypto') || mKey.includes('usdt') || !!activeCfg.isCrypto;

                      const amountNum = parseFloat(depositAmount) || 0;
                      const usdAmount = (amountNum / 120).toFixed(2);

                      // 1. BKASH (বিকাশ) DEDICATED GATEWAY CARD
                      if (isBkash) {
                        return (
                          <div className="rounded-3xl p-5 sm:p-7 text-white shadow-2xl transition-all duration-300 relative overflow-hidden border border-pink-400/40 bg-gradient-to-br from-[#a00947] via-[#e2136e] to-[#730630]">
                            {/* Decorative ambient elements */}
                            <div className="absolute top-0 right-0 w-56 h-56 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
                            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-pink-400/20 rounded-full blur-2xl pointer-events-none"></div>

                            {/* bKash Header Badge */}
                            <div className="flex items-center justify-between pb-4 mb-4 border-b border-pink-300/30">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center">
                                  {renderMethodLogo(activeCfg, 'w-9 h-9')}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-black text-lg text-white tracking-wide">
                                      বিকাশ পেমেন্ট গেটওয়ে
                                    </h3>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/20 text-white font-extrabold border border-white/30">
                                      bKash Personal
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-pink-100/90 font-medium mt-0.5">
                                    {activeCfg.ussd || '*247#'} অথবা বিকাশ অ্যাপ দিয়ে সেন্ড মানি করুন
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Recipient Number Box */}
                            <div className="p-3.5 rounded-2xl bg-black/40 backdrop-blur-md border border-pink-300/40 mb-4 shadow-inner">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-pink-200 uppercase tracking-wider flex items-center gap-1.5">
                                  <i className="fas fa-mobile-alt text-amber-300"></i>
                                  <span>বিকাশ পার্সোনাল নম্বর (সেন্ড মানি):</span>
                                </span>
                                <span className="text-[10px] text-pink-200 font-mono">Personal Send Money</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <span className="font-mono font-black text-base sm:text-lg text-amber-300 tracking-widest select-all">
                                  {activeCfg.number}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyNumber(activeCfg.number)}
                                  className="px-3.5 py-1.5 rounded-xl bg-pink-500/40 hover:bg-pink-500/60 text-white border border-pink-300/50 font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                  <i className="fas fa-copy text-amber-300"></i>
                                  <span>Copy Number</span>
                                </button>
                              </div>
                            </div>

                            {/* 5-Step bKash Guidelines */}
                            <div className="space-y-2.5 text-xs sm:text-sm font-semibold text-white/95 leading-relaxed bg-black/25 p-3.5 rounded-2xl border border-pink-400/20 mb-4">
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#e2136e] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ১
                                </span>
                                <span>
                                  বিকাশ অ্যাপ ওপেন করুন অথবা ডায়াল করুন <strong>*247#</strong>
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#e2136e] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ২
                                </span>
                                <span>
                                  <strong>Send Money</strong> (সেন্ড মানি) অপশন নির্বাচন করুন
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#e2136e] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ৩
                                </span>
                                <span>
                                  প্রাপক নম্বর বক্সে <strong>{activeCfg.number}</strong> লিখুন
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#e2136e] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ৪
                                </span>
                                <span>
                                  টাকার পরিমাণ <strong>৳ {amountNum}</strong> লিখে আপনার বিকাশ <strong>PIN</strong> দিয়ে লেনদেন সম্পন্ন করুন
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#e2136e] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ৫
                                </span>
                                <span>
                                  লেনদেনের পর মেসেজে আসা <strong>TrxID (১০ ডিজিট)</strong> নিচের বক্সে দিন
                                </span>
                              </div>
                            </div>

                            {/* Transaction ID Input */}
                            <div className="mb-4">
                              <label className="block text-xs font-black text-white mb-1.5 flex items-center justify-between">
                                <span>বিকাশ ট্রানজেকশন আইডি দিন (bKash TrxID):</span>
                                <span className="text-[10px] text-pink-200 font-mono">Example: BLM6AK9012</span>
                              </label>
                              <input
                                type="text"
                                className="w-full bg-white text-slate-950 font-black font-mono text-sm sm:text-base px-4 py-3.5 rounded-xl border-2 border-white/60 focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300/30 uppercase placeholder:text-slate-400 shadow-lg text-center tracking-widest"
                                placeholder="এখানে bKash TrxID লিখুন"
                                value={depositTrxId}
                                onChange={(e) => {
                                  setDepositTrxId(e.target.value);
                                  setDepTrxErr('');
                                }}
                              />
                              {depTrxErr && (
                                <p className="text-xs font-bold text-yellow-200 mt-2 bg-black/60 px-3 py-1.5 rounded-lg text-center shadow border border-yellow-400/40">
                                  ⚠️ {depTrxErr}
                                </p>
                              )}
                            </div>

                            {/* Screenshot Upload */}
                            <div className="mb-5 p-3 rounded-2xl bg-black/35 backdrop-blur-md border border-pink-300/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <i className="fas fa-camera text-yellow-300"></i>
                                  <span>পেমেন্ট স্ক্রিনশট বা স্লিপ আপলোড (ঐচ্ছিক):</span>
                                </label>
                                {depositReceiptImage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDepositReceiptImage('');
                                      setDepositReceiptFileName('');
                                      haptic('light');
                                    }}
                                    className="text-[10px] text-pink-200 hover:text-white font-bold underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <i className="fas fa-times"></i> ছবি মুছুন
                                  </button>
                                )}
                              </div>

                              {depositReceiptImage ? (
                                <div className="relative rounded-xl overflow-hidden border-2 border-pink-300/60 bg-black/60 p-2 flex items-center gap-3">
                                  <img
                                    src={depositReceiptImage}
                                    alt="bKash Screenshot"
                                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-white/20 cursor-pointer shadow-md"
                                    onClick={() => setSelectedScreenshotPreview(depositReceiptImage)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                      <i className="fas fa-check-circle"></i>
                                      <span>স্ক্রিনশট যুক্ত হয়েছে!</span>
                                    </p>
                                    <p className="text-[10px] text-slate-300 truncate font-mono mt-0.5">
                                      {depositReceiptFileName || 'bkash_receipt.png'}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <label className="relative flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-pink-300/40 hover:border-white bg-white/5 hover:bg-white/10 cursor-pointer transition text-center group">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleDepositReceiptUpload}
                                  />
                                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <i className="fas fa-cloud-upload-alt text-amber-300"></i>
                                    <span>বিকাশ পেমেন্ট স্ক্রিনশট সিলেক্ট করুন</span>
                                  </span>
                                  <span className="text-[10px] text-pink-200/80 mt-0.5">
                                    JPG, PNG (সর্বোচ্চ ৮MB)
                                  </span>
                                </label>
                              )}
                            </div>

                            {/* Verify Button */}
                            <button
                              type="button"
                              onClick={handleSubmitDeposit}
                              disabled={depositSubmitting}
                              className="w-full py-4 rounded-2xl bg-white hover:bg-pink-50 text-[#e2136e] font-black text-base sm:text-lg tracking-wider uppercase shadow-2xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-2 border-white/80"
                            >
                              {depositSubmitting ? (
                                <span className="loading-spinner"></span>
                              ) : (
                                <>
                                  <span>বিকাশ ভেরিফাই করুন (VERIFY bKash)</span>
                                  <i className="fas fa-check-circle text-emerald-600 text-lg"></i>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      }

                      // 2. NAGAD (নগদ) DEDICATED GATEWAY CARD
                      if (isNagad) {
                        return (
                          <div className="rounded-3xl p-5 sm:p-7 text-white shadow-2xl transition-all duration-300 relative overflow-hidden border border-orange-400/40 bg-gradient-to-br from-[#9a3412] via-[#ea580c] to-[#7c2d12]">
                            {/* Decorative ambient elements */}
                            <div className="absolute top-0 right-0 w-56 h-56 bg-amber-400/15 rounded-full blur-3xl pointer-events-none"></div>
                            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-orange-400/20 rounded-full blur-2xl pointer-events-none"></div>

                            {/* Nagad Header Badge */}
                            <div className="flex items-center justify-between pb-4 mb-4 border-b border-orange-300/30">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center">
                                  {renderMethodLogo(activeCfg, 'w-9 h-9')}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-black text-lg text-white tracking-wide">
                                      নগদ পেমেন্ট গেটওয়ে
                                    </h3>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/20 text-white font-extrabold border border-white/30">
                                      ডাক বিভাগ অনুমোদিত
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-orange-100/90 font-medium mt-0.5">
                                    {activeCfg.ussd || '*167#'} ডায়াল অথবা নগদ অ্যাপ দিয়ে সেন্ড মানি করুন
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Recipient Number Box */}
                            <div className="p-3.5 rounded-2xl bg-black/40 backdrop-blur-md border border-orange-300/40 mb-4 shadow-inner">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-orange-200 uppercase tracking-wider flex items-center gap-1.5">
                                  <i className="fas fa-mobile-alt text-amber-300"></i>
                                  <span>নগদ একাউন্ট নম্বর (Send Money):</span>
                                </span>
                                <span className="text-[10px] text-orange-200 font-mono">Nagad Personal</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <span className="font-mono font-black text-base sm:text-lg text-amber-300 tracking-widest select-all">
                                  {activeCfg.number}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyNumber(activeCfg.number)}
                                  className="px-3.5 py-1.5 rounded-xl bg-orange-500/40 hover:bg-orange-500/60 text-white border border-orange-300/50 font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                  <i className="fas fa-copy text-amber-300"></i>
                                  <span>Copy Nagad</span>
                                </button>
                              </div>
                            </div>

                            {/* 5-Step Nagad Guidelines */}
                            <div className="space-y-2.5 text-xs sm:text-sm font-semibold text-white/95 leading-relaxed bg-black/25 p-3.5 rounded-2xl border border-orange-400/20 mb-4">
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#ea580c] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ১
                                </span>
                                <span>
                                  নগদ অ্যাপ ওপেন করুন অথবা ডায়াল প্যাডে ডায়াল করুন <strong>*167#</strong>
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#ea580c] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ২
                                </span>
                                <span>
                                  মেনু থেকে <strong>Send Money</strong> (সেন্ড মানি) অপশন নির্বাচন করুন
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#ea580c] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ৩
                                </span>
                                <span>
                                  প্রাপক নগদ নম্বরে <strong>{activeCfg.number}</strong> টাইপ করুন
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#ea580c] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ৪
                                </span>
                                <span>
                                  টাকার পরিমাণ <strong>৳ {amountNum}</strong> ও আপনার নগদ <strong>PIN</strong> দিয়ে ট্যাপ করে ধরে রাখুন
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#ea580c] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ৫
                                </span>
                                <span>
                                  লেনদেন সফল হলে স্ক্রিন বা এসএমএস-এর <strong>Txn ID (৮ ডিজিট)</strong> নিচে দিন
                                </span>
                              </div>
                            </div>

                            {/* Transaction ID Input */}
                            <div className="mb-4">
                              <label className="block text-xs font-black text-white mb-1.5 flex items-center justify-between">
                                <span>নগদ ট্রানজেকশন আইডি দিন (Nagad TxnID):</span>
                                <span className="text-[10px] text-orange-200 font-mono">Example: 7NB82M94</span>
                              </label>
                              <input
                                type="text"
                                className="w-full bg-white text-slate-950 font-black font-mono text-sm sm:text-base px-4 py-3.5 rounded-xl border-2 border-white/60 focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300/30 uppercase placeholder:text-slate-400 shadow-lg text-center tracking-widest"
                                placeholder="এখানে Nagad Txn ID লিখুন"
                                value={depositTrxId}
                                onChange={(e) => {
                                  setDepositTrxId(e.target.value);
                                  setDepTrxErr('');
                                }}
                              />
                              {depTrxErr && (
                                <p className="text-xs font-bold text-yellow-200 mt-2 bg-black/60 px-3 py-1.5 rounded-lg text-center shadow border border-yellow-400/40">
                                  ⚠️ {depTrxErr}
                                </p>
                              )}
                            </div>

                            {/* Screenshot Upload */}
                            <div className="mb-5 p-3 rounded-2xl bg-black/35 backdrop-blur-md border border-orange-300/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <i className="fas fa-camera text-yellow-300"></i>
                                  <span>নগদ পেমেন্ট স্ক্রিনশট (ঐচ্ছিক):</span>
                                </label>
                                {depositReceiptImage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDepositReceiptImage('');
                                      setDepositReceiptFileName('');
                                      haptic('light');
                                    }}
                                    className="text-[10px] text-orange-200 hover:text-white font-bold underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <i className="fas fa-times"></i> ছবি মুছুন
                                  </button>
                                )}
                              </div>

                              {depositReceiptImage ? (
                                <div className="relative rounded-xl overflow-hidden border-2 border-orange-300/60 bg-black/60 p-2 flex items-center gap-3">
                                  <img
                                    src={depositReceiptImage}
                                    alt="Nagad Screenshot"
                                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-white/20 cursor-pointer shadow-md"
                                    onClick={() => setSelectedScreenshotPreview(depositReceiptImage)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                      <i className="fas fa-check-circle"></i>
                                      <span>স্ক্রিনশট যুক্ত হয়েছে!</span>
                                    </p>
                                    <p className="text-[10px] text-slate-300 truncate font-mono mt-0.5">
                                      {depositReceiptFileName || 'nagad_receipt.png'}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <label className="relative flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-orange-300/40 hover:border-white bg-white/5 hover:bg-white/10 cursor-pointer transition text-center group">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleDepositReceiptUpload}
                                  />
                                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <i className="fas fa-cloud-upload-alt text-amber-300"></i>
                                    <span>নগদ পেমেন্ট স্ক্রিনশট সিলেক্ট করুন</span>
                                  </span>
                                  <span className="text-[10px] text-orange-200/80 mt-0.5">
                                    JPG, PNG (সর্বোচ্চ ৮MB)
                                  </span>
                                </label>
                              )}
                            </div>

                            {/* Verify Button */}
                            <button
                              type="button"
                              onClick={handleSubmitDeposit}
                              disabled={depositSubmitting}
                              className="w-full py-4 rounded-2xl bg-white hover:bg-orange-50 text-[#ea580c] font-black text-base sm:text-lg tracking-wider uppercase shadow-2xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-2 border-white/80"
                            >
                              {depositSubmitting ? (
                                <span className="loading-spinner"></span>
                              ) : (
                                <>
                                  <span>নগদ ভেরিফাই করুন (VERIFY NAGAD)</span>
                                  <i className="fas fa-check-circle text-emerald-600 text-lg"></i>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      }

                      // 3. ROCKET (রকেট - ডাচ বাংলা ব্যাংক) DEDICATED GATEWAY CARD
                      if (isRocket) {
                        return (
                          <div className="rounded-3xl p-5 sm:p-7 text-white shadow-2xl transition-all duration-300 relative overflow-hidden border border-purple-400/40 bg-gradient-to-br from-[#4c1d95] via-[#8c3494] to-[#2e1065]">
                            {/* Decorative ambient elements */}
                            <div className="absolute top-0 right-0 w-56 h-56 bg-purple-400/15 rounded-full blur-3xl pointer-events-none"></div>
                            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-violet-400/20 rounded-full blur-2xl pointer-events-none"></div>

                            {/* Rocket Header Badge */}
                            <div className="flex items-center justify-between pb-4 mb-4 border-b border-purple-300/30">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center">
                                  {renderMethodLogo(activeCfg, 'w-9 h-9')}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-black text-lg text-white tracking-wide">
                                      রকেট পেমেন্ট গেটওয়ে
                                    </h3>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/20 text-white font-extrabold border border-white/30">
                                      DBBL Rocket
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-purple-200 font-medium mt-0.5">
                                    {activeCfg.ussd || '*322#'} ডায়াল অথবা রকেট অ্যাপ দিয়ে টাকা পাঠান
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Recipient Number Box */}
                            <div className="p-3.5 rounded-2xl bg-black/40 backdrop-blur-md border border-purple-300/40 mb-4 shadow-inner">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-purple-200 uppercase tracking-wider flex items-center gap-1.5">
                                  <i className="fas fa-mobile-alt text-amber-300"></i>
                                  <span>রকেট ১২-ডিজিট একাউন্ট নম্বর:</span>
                                </span>
                                <span className="text-[10px] text-purple-200 font-mono">12-Digit Account</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <span className="font-mono font-black text-base sm:text-lg text-amber-300 tracking-widest select-all">
                                  {activeCfg.number}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyNumber(activeCfg.number)}
                                  className="px-3.5 py-1.5 rounded-xl bg-purple-500/40 hover:bg-purple-500/60 text-white border border-purple-300/50 font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                  <i className="fas fa-copy text-amber-300"></i>
                                  <span>Copy Rocket</span>
                                </button>
                              </div>
                            </div>

                            {/* 5-Step Rocket Guidelines */}
                            <div className="space-y-2.5 text-xs sm:text-sm font-semibold text-white/95 leading-relaxed bg-black/25 p-3.5 rounded-2xl border border-purple-400/20 mb-4">
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#8c3494] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ১
                                </span>
                                <span>
                                  রকেট অ্যাপ ওপেন করুন অথবা ডায়াল করুন <strong>*322#</strong>
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#8c3494] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ২
                                </span>
                                <span>
                                  <strong>Send Money</strong> নির্বাচন করুন
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#8c3494] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ৩
                                </span>
                                <span>
                                  প্রাপক রকেট একাউন্ট নম্বরে <strong>{activeCfg.number}</strong> দিন
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#8c3494] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ৪
                                </span>
                                <span>
                                  টাকার পরিমাণ <strong>৳ {amountNum}</strong> দিয়ে রকেট <strong>PIN</strong> দিয়ে সম্পন্ন করুন
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#8c3494] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ৫
                                </span>
                                <span>
                                  ফিরতি মেসেজে আসা <strong>Txn ID</strong> নিচের বক্সে দিন
                                </span>
                              </div>
                            </div>

                            {/* Transaction ID Input */}
                            <div className="mb-4">
                              <label className="block text-xs font-black text-white mb-1.5 flex items-center justify-between">
                                <span>রকেট ট্রানজেকশন আইডি দিন (Rocket TxnID):</span>
                                <span className="text-[10px] text-purple-200 font-mono">Example: 2984716253</span>
                              </label>
                              <input
                                type="text"
                                className="w-full bg-white text-slate-950 font-black font-mono text-sm sm:text-base px-4 py-3.5 rounded-xl border-2 border-white/60 focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300/30 uppercase placeholder:text-slate-400 shadow-lg text-center tracking-widest"
                                placeholder="এখানে Rocket Txn ID লিখুন"
                                value={depositTrxId}
                                onChange={(e) => {
                                  setDepositTrxId(e.target.value);
                                  setDepTrxErr('');
                                }}
                              />
                              {depTrxErr && (
                                <p className="text-xs font-bold text-yellow-200 mt-2 bg-black/60 px-3 py-1.5 rounded-lg text-center shadow border border-yellow-400/40">
                                  ⚠️ {depTrxErr}
                                </p>
                              )}
                            </div>

                            {/* Screenshot Upload */}
                            <div className="mb-5 p-3 rounded-2xl bg-black/35 backdrop-blur-md border border-purple-300/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <i className="fas fa-camera text-yellow-300"></i>
                                  <span>রকেট পেমেন্ট স্লিপ / স্ক্রিনশট (ঐচ্ছিক):</span>
                                </label>
                                {depositReceiptImage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDepositReceiptImage('');
                                      setDepositReceiptFileName('');
                                      haptic('light');
                                    }}
                                    className="text-[10px] text-purple-200 hover:text-white font-bold underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <i className="fas fa-times"></i> ছবি মুছুন
                                  </button>
                                )}
                              </div>

                              {depositReceiptImage ? (
                                <div className="relative rounded-xl overflow-hidden border-2 border-purple-300/60 bg-black/60 p-2 flex items-center gap-3">
                                  <img
                                    src={depositReceiptImage}
                                    alt="Rocket Screenshot"
                                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-white/20 cursor-pointer shadow-md"
                                    onClick={() => setSelectedScreenshotPreview(depositReceiptImage)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                      <i className="fas fa-check-circle"></i>
                                      <span>স্ক্রিনশট যুক্ত হয়েছে!</span>
                                    </p>
                                    <p className="text-[10px] text-slate-300 truncate font-mono mt-0.5">
                                      {depositReceiptFileName || 'rocket_receipt.png'}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <label className="relative flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-purple-300/40 hover:border-white bg-white/5 hover:bg-white/10 cursor-pointer transition text-center group">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleDepositReceiptUpload}
                                  />
                                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <i className="fas fa-cloud-upload-alt text-amber-300"></i>
                                    <span>রকেট পেমেন্ট স্ক্রিনশট সিলেক্ট করুন</span>
                                  </span>
                                  <span className="text-[10px] text-purple-200/80 mt-0.5">
                                    JPG, PNG (সর্বোচ্চ ৮MB)
                                  </span>
                                </label>
                              )}
                            </div>

                            {/* Verify Button */}
                            <button
                              type="button"
                              onClick={handleSubmitDeposit}
                              disabled={depositSubmitting}
                              className="w-full py-4 rounded-2xl bg-white hover:bg-purple-50 text-[#8c3494] font-black text-base sm:text-lg tracking-wider uppercase shadow-2xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-2 border-white/80"
                            >
                              {depositSubmitting ? (
                                <span className="loading-spinner"></span>
                              ) : (
                                <>
                                  <span>রকেট ভেরিফাই করুন (VERIFY ROCKET)</span>
                                  <i className="fas fa-check-circle text-emerald-600 text-lg"></i>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      }

                      // 4. UPAY (উপায় - UCB FINTECH) DEDICATED GATEWAY CARD
                      if (isUpay) {
                        return (
                          <div className="rounded-3xl p-5 sm:p-7 text-white shadow-2xl transition-all duration-300 relative overflow-hidden border border-cyan-400/40 bg-gradient-to-br from-[#00284d] via-[#005696] to-[#00172e]">
                            {/* Decorative ambient elements */}
                            <div className="absolute top-0 right-0 w-56 h-56 bg-cyan-400/15 rounded-full blur-3xl pointer-events-none"></div>
                            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-blue-500/20 rounded-full blur-2xl pointer-events-none"></div>

                            {/* Upay Header Badge */}
                            <div className="flex items-center justify-between pb-4 mb-4 border-b border-cyan-300/30">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center">
                                  {renderMethodLogo(activeCfg, 'w-9 h-9')}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-black text-lg text-white tracking-wide">
                                      উপায় পেমেন্ট গেটওয়ে
                                    </h3>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/20 text-cyan-200 font-extrabold border border-white/30">
                                      UCB Fintech
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-cyan-200 font-medium mt-0.5">
                                    {activeCfg.ussd || '*268#'} ডায়াল অথবা উপায় অ্যাপ দিয়ে সেন্ড মানি করুন
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Recipient Number Box */}
                            <div className="p-3.5 rounded-2xl bg-black/40 backdrop-blur-md border border-cyan-300/40 mb-4 shadow-inner">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-cyan-200 uppercase tracking-wider flex items-center gap-1.5">
                                  <i className="fas fa-mobile-alt text-amber-300"></i>
                                  <span>উপায় ওয়ালেট নম্বর:</span>
                                </span>
                                <span className="text-[10px] text-cyan-200 font-mono">Upay Wallet</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <span className="font-mono font-black text-base sm:text-lg text-amber-300 tracking-widest select-all">
                                  {activeCfg.number}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyNumber(activeCfg.number)}
                                  className="px-3.5 py-1.5 rounded-xl bg-cyan-600/40 hover:bg-cyan-600/60 text-white border border-cyan-300/50 font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                  <i className="fas fa-copy text-amber-300"></i>
                                  <span>Copy Upay</span>
                                </button>
                              </div>
                            </div>

                            {/* 5-Step Upay Guidelines */}
                            <div className="space-y-2.5 text-xs sm:text-sm font-semibold text-white/95 leading-relaxed bg-black/25 p-3.5 rounded-2xl border border-cyan-400/20 mb-4">
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#005696] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ১
                                </span>
                                <span>
                                  উপায় অ্যাপ ওপেন করুন অথবা ডায়াল করুন <strong>*268#</strong>
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#005696] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ২
                                </span>
                                <span>
                                  <strong>Send Money</strong> নির্বাচন করুন
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#005696] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ৩
                                </span>
                                <span>
                                  প্রাপক উপায় ওয়ালেট নম্বর হিসেবে <strong>{activeCfg.number}</strong> দিন
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#005696] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ৪
                                </span>
                                <span>
                                  টাকার পরিমাণ <strong>৳ {amountNum}</strong> ও আপনার উপায় <strong>PIN</strong> দিয়ে সম্পন্ন করুন
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-white text-[#005696] font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ৫
                                </span>
                                <span>
                                  ফিরতি মেসেজে পাওয়া <strong>TrxID</strong> নিচের বক্সে দিন
                                </span>
                              </div>
                            </div>

                            {/* Transaction ID Input */}
                            <div className="mb-4">
                              <label className="block text-xs font-black text-white mb-1.5 flex items-center justify-between">
                                <span>উপায় ট্রানজেকশন আইডি দিন (Upay TrxID):</span>
                                <span className="text-[10px] text-cyan-200 font-mono">Example: UP18492048</span>
                              </label>
                              <input
                                type="text"
                                className="w-full bg-white text-slate-950 font-black font-mono text-sm sm:text-base px-4 py-3.5 rounded-xl border-2 border-white/60 focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300/30 uppercase placeholder:text-slate-400 shadow-lg text-center tracking-widest"
                                placeholder="এখানে Upay Trx ID লিখুন"
                                value={depositTrxId}
                                onChange={(e) => {
                                  setDepositTrxId(e.target.value);
                                  setDepTrxErr('');
                                }}
                              />
                              {depTrxErr && (
                                <p className="text-xs font-bold text-yellow-200 mt-2 bg-black/60 px-3 py-1.5 rounded-lg text-center shadow border border-yellow-400/40">
                                  ⚠️ {depTrxErr}
                                </p>
                              )}
                            </div>

                            {/* Screenshot Upload */}
                            <div className="mb-5 p-3 rounded-2xl bg-black/35 backdrop-blur-md border border-cyan-300/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <i className="fas fa-camera text-yellow-300"></i>
                                  <span>উপায় পেমেন্ট স্ক্রিনশট (ঐচ্ছিক):</span>
                                </label>
                                {depositReceiptImage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDepositReceiptImage('');
                                      setDepositReceiptFileName('');
                                      haptic('light');
                                    }}
                                    className="text-[10px] text-cyan-200 hover:text-white font-bold underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <i className="fas fa-times"></i> ছবি মুছুন
                                  </button>
                                )}
                              </div>

                              {depositReceiptImage ? (
                                <div className="relative rounded-xl overflow-hidden border-2 border-cyan-300/60 bg-black/60 p-2 flex items-center gap-3">
                                  <img
                                    src={depositReceiptImage}
                                    alt="Upay Screenshot"
                                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-white/20 cursor-pointer shadow-md"
                                    onClick={() => setSelectedScreenshotPreview(depositReceiptImage)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                      <i className="fas fa-check-circle"></i>
                                      <span>স্ক্রিনশট যুক্ত হয়েছে!</span>
                                    </p>
                                    <p className="text-[10px] text-slate-300 truncate font-mono mt-0.5">
                                      {depositReceiptFileName || 'upay_receipt.png'}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <label className="relative flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-cyan-300/40 hover:border-white bg-white/5 hover:bg-white/10 cursor-pointer transition text-center group">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleDepositReceiptUpload}
                                  />
                                  <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                    <i className="fas fa-cloud-upload-alt text-amber-300"></i>
                                    <span>উপায় পেমেন্ট স্ক্রিনশট সিলেক্ট করুন</span>
                                  </span>
                                  <span className="text-[10px] text-cyan-200/80 mt-0.5">
                                    JPG, PNG (সর্বোচ্চ ৮MB)
                                  </span>
                                </label>
                              )}
                            </div>

                            {/* Verify Button */}
                            <button
                              type="button"
                              onClick={handleSubmitDeposit}
                              disabled={depositSubmitting}
                              className="w-full py-4 rounded-2xl bg-white hover:bg-cyan-50 text-[#005696] font-black text-base sm:text-lg tracking-wider uppercase shadow-2xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-2 border-white/80"
                            >
                              {depositSubmitting ? (
                                <span className="loading-spinner"></span>
                              ) : (
                                <>
                                  <span>উপায় ভেরিফাই করুন (VERIFY UPAY)</span>
                                  <i className="fas fa-check-circle text-emerald-600 text-lg"></i>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      }

                      // 5. BINANCE / USDT / CRYPTO DEDICATED GATEWAY CARD
                      if (isBinance) {
                        return (
                          <div className="rounded-3xl p-5 sm:p-7 text-white shadow-2xl transition-all duration-300 relative overflow-hidden border border-yellow-400/50 bg-gradient-to-br from-[#1e2329] via-[#12161a] to-[#0b0e11]">
                            {/* Decorative ambient elements */}
                            <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/15 rounded-full blur-3xl pointer-events-none"></div>
                            <div className="absolute -bottom-10 -left-10 w-48 h-48 bg-amber-500/15 rounded-full blur-2xl pointer-events-none"></div>

                            {/* Binance Header Badge */}
                            <div className="flex items-center justify-between pb-4 mb-4 border-b border-yellow-500/30">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-2xl bg-[#f0b90b] p-1.5 shadow-lg flex items-center justify-center">
                                  {renderMethodLogo(activeCfg, 'w-9 h-9')}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-black text-lg text-yellow-400 tracking-wide font-mono">
                                      BINANCE PAY & USDT
                                    </h3>
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#f0b90b]/20 text-yellow-300 font-extrabold border border-[#f0b90b]/40 font-mono">
                                      0% Fee
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-300 font-medium mt-0.5">
                                    Binance Pay UID অথবা USDT (BEP20 / TRC20) নেটওয়ার্কে পে করুন
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Real-time Crypto USD Rate & Calculator Banner */}
                            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-yellow-950/40 via-amber-950/50 to-slate-900/80 border border-yellow-500/40 mb-4 shadow-inner">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[11px] font-extrabold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                                  <i className="fas fa-calculator text-yellow-300"></i>
                                  <span>USD ডলার কনভার্শন রেট (1 USDT = ৳120):</span>
                                </span>
                                <span className="text-[10px] text-amber-300 font-mono font-bold">Instant Rate</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <div>
                                  <span className="font-mono font-black text-xl sm:text-2xl text-yellow-300 tracking-wider">
                                    $ {usdAmount} <span className="text-xs text-slate-400 font-normal">USD / USDT</span>
                                  </span>
                                  <span className="text-[11px] text-slate-400 block font-mono mt-0.5">
                                    (Equivalent to ৳ {amountNum} BDT)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => copyNumber(usdAmount)}
                                  className="px-3.5 py-1.5 rounded-xl bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-300 border border-yellow-400/40 font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm font-mono"
                                >
                                  <i className="fas fa-copy text-yellow-400"></i>
                                  <span>Copy ${usdAmount}</span>
                                </button>
                              </div>
                            </div>

                            {/* Binance Pay UID / Wallet Box */}
                            <div className="p-3.5 rounded-2xl bg-black/60 backdrop-blur-md border border-yellow-500/40 mb-4 shadow-inner">
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[11px] font-bold text-yellow-300 uppercase tracking-wider flex items-center gap-1.5">
                                  <i className="fas fa-wallet text-yellow-400"></i>
                                  <span>Binance Pay ID / UID (বা ওয়ালেট এড্রেস):</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono">Binance Pay</span>
                              </div>
                              <div className="flex items-center justify-between gap-2 mt-1">
                                <span className="font-mono font-black text-base sm:text-lg text-yellow-300 tracking-widest select-all">
                                  {activeCfg.number}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => copyNumber(activeCfg.number)}
                                  className="px-3.5 py-1.5 rounded-xl bg-[#f0b90b] hover:bg-yellow-400 text-slate-950 font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
                                >
                                  <i className="fas fa-copy text-slate-900"></i>
                                  <span>Copy UID</span>
                                </button>
                              </div>
                            </div>

                            {/* 5-Step Binance Guidelines */}
                            <div className="space-y-2.5 text-xs sm:text-sm font-semibold text-slate-200 leading-relaxed bg-black/40 p-3.5 rounded-2xl border border-yellow-500/20 mb-4">
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-[#f0b90b] text-slate-950 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ১
                                </span>
                                <span>
                                  Binance App ওপেন করে <strong>Pay</strong> অথবা <strong>Send</strong> অপশনে যান (বা Trust Wallet)
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-[#f0b90b] text-slate-950 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ২
                                </span>
                                <span>
                                  <strong>Pay ID / Binance UID</strong> অথবা USDT নেটওয়ার্ক সিলেক্ট করুন
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-[#f0b90b] text-slate-950 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ৩
                                </span>
                                <span>
                                  Payee ID হিসেবে <strong>{activeCfg.number}</strong> দিন
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-[#f0b90b] text-slate-950 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ৪
                                </span>
                                <span>
                                  সঠিক পরিমাণ <strong>${usdAmount} USD</strong> পাঠিয়ে লেনদেন নিশ্চিত করুন
                                </span>
                              </div>
                              <div className="flex items-start gap-2.5">
                                <span className="w-5 h-5 rounded-full bg-[#f0b90b] text-slate-950 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                  ৫
                                </span>
                                <span>
                                  লেনদেনের <strong>Order ID / TxID / Transaction Hash</strong> নিচের বক্সে দিন
                                </span>
                              </div>
                            </div>

                            {/* Transaction ID Input */}
                            <div className="mb-4">
                              <label className="block text-xs font-black text-yellow-300 mb-1.5 flex items-center justify-between">
                                <span>Binance Order ID / TxID / Hash দিন:</span>
                                <span className="text-[10px] text-slate-400 font-mono">Example: 3948201948</span>
                              </label>
                              <input
                                type="text"
                                className="w-full bg-slate-950 text-yellow-300 font-black font-mono text-sm sm:text-base px-4 py-3.5 rounded-xl border-2 border-yellow-500/60 focus:border-yellow-300 focus:outline-none focus:ring-4 focus:ring-yellow-400/20 uppercase placeholder:text-slate-500 shadow-lg text-center tracking-widest"
                                placeholder="Binance Order ID / Hash লিখুন"
                                value={depositTrxId}
                                onChange={(e) => {
                                  setDepositTrxId(e.target.value);
                                  setDepTrxErr('');
                                }}
                              />
                              {depTrxErr && (
                                <p className="text-xs font-bold text-yellow-300 mt-2 bg-black/80 px-3 py-1.5 rounded-lg text-center shadow border border-yellow-400/50">
                                  ⚠️ {depTrxErr}
                                </p>
                              )}
                            </div>

                            {/* Screenshot Upload */}
                            <div className="mb-5 p-3 rounded-2xl bg-black/40 backdrop-blur-md border border-yellow-500/30 space-y-2">
                              <div className="flex items-center justify-between">
                                <label className="text-xs font-bold text-yellow-200 flex items-center gap-1.5">
                                  <i className="fas fa-camera text-yellow-400"></i>
                                  <span>Binance পেমেন্ট স্ক্রিনশট (ঐচ্ছিক):</span>
                                </label>
                                {depositReceiptImage && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDepositReceiptImage('');
                                      setDepositReceiptFileName('');
                                      haptic('light');
                                    }}
                                    className="text-[10px] text-yellow-300 hover:text-white font-bold underline flex items-center gap-1 cursor-pointer"
                                  >
                                    <i className="fas fa-times"></i> ছবি মুছুন
                                  </button>
                                )}
                              </div>

                              {depositReceiptImage ? (
                                <div className="relative rounded-xl overflow-hidden border-2 border-yellow-400/60 bg-black/60 p-2 flex items-center gap-3">
                                  <img
                                    src={depositReceiptImage}
                                    alt="Binance Screenshot"
                                    className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-white/20 cursor-pointer shadow-md"
                                    onClick={() => setSelectedScreenshotPreview(depositReceiptImage)}
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                      <i className="fas fa-check-circle"></i>
                                      <span>স্ক্রিনশট যুক্ত হয়েছে!</span>
                                    </p>
                                    <p className="text-[10px] text-slate-300 truncate font-mono mt-0.5">
                                      {depositReceiptFileName || 'binance_receipt.png'}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <label className="relative flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-yellow-400/40 hover:border-yellow-300 bg-white/5 hover:bg-white/10 cursor-pointer transition text-center group">
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={handleDepositReceiptUpload}
                                  />
                                  <span className="text-xs font-bold text-yellow-300 flex items-center gap-1.5">
                                    <i className="fas fa-cloud-upload-alt text-yellow-400"></i>
                                    <span>Binance পেমেন্ট স্ক্রিনশট সিলেক্ট করুন</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 mt-0.5">
                                    JPG, PNG (সর্বোচ্চ ৮MB)
                                  </span>
                                </label>
                              )}
                            </div>

                            {/* Verify Button */}
                            <button
                              type="button"
                              onClick={handleSubmitDeposit}
                              disabled={depositSubmitting}
                              className="w-full py-4 rounded-2xl bg-[#f0b90b] hover:bg-yellow-400 text-slate-950 font-black text-base sm:text-lg tracking-wider uppercase shadow-[0_0_25px_rgba(240,185,11,0.4)] transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-2 border-yellow-300"
                            >
                              {depositSubmitting ? (
                                <span className="loading-spinner"></span>
                              ) : (
                                <>
                                  <span>VERIFY BINANCE PAYMENT</span>
                                  <i className="fas fa-check-circle text-slate-950 text-lg"></i>
                                </>
                              )}
                            </button>
                          </div>
                        );
                      }

                      // 6. BANK TRANSFER / OTHER CUSTOM METHODS DEDICATED GATEWAY CARD
                      return (
                        <div className="rounded-3xl p-5 sm:p-7 text-white shadow-2xl transition-all duration-300 relative overflow-hidden border border-emerald-400/40 bg-gradient-to-br from-[#064e3b] via-[#0f766e] to-[#022c22]">
                          {/* Decorative ambient elements */}
                          <div className="absolute top-0 right-0 w-56 h-56 bg-emerald-400/15 rounded-full blur-3xl pointer-events-none"></div>

                          {/* Bank Header Badge */}
                          <div className="flex items-center justify-between pb-4 mb-4 border-b border-emerald-300/30">
                            <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-2xl bg-white p-1.5 shadow-lg flex items-center justify-center">
                                {renderMethodLogo(activeCfg, 'w-9 h-9')}
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-black text-lg text-white tracking-wide">
                                    {activeCfg.label || selectedMethod} পেমেন্ট গেটওয়ে
                                  </h3>
                                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-white/20 text-emerald-200 font-extrabold border border-white/30">
                                    Bank / Custom
                                  </span>
                                </div>
                                <p className="text-[11px] text-emerald-100 font-medium mt-0.5">
                                  নিচের একাউন্টে টাকা পাঠিয়ে ট্রানজেকশন আইডি দিন
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Recipient Number / Account Box */}
                          <div className="p-3.5 rounded-2xl bg-black/40 backdrop-blur-md border border-emerald-300/40 mb-4 shadow-inner">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider flex items-center gap-1.5">
                                <i className="fas fa-university text-amber-300"></i>
                                <span>ব্যাংক একাউন্ট নম্বর:</span>
                              </span>
                              <span className="text-[10px] text-emerald-200 font-mono">Account / Wallet</span>
                            </div>
                            <div className="flex items-center justify-between gap-2 mt-1">
                              <span className="font-mono font-black text-base sm:text-lg text-amber-300 tracking-widest select-all">
                                {activeCfg.number}
                              </span>
                              <button
                                type="button"
                                onClick={() => copyNumber(activeCfg.number)}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600/40 hover:bg-emerald-600/60 text-white border border-emerald-300/50 font-black text-xs transition active:scale-95 flex items-center gap-1.5 cursor-pointer shadow-sm"
                              >
                                <i className="fas fa-copy text-amber-300"></i>
                                <span>Copy Details</span>
                              </button>
                            </div>
                          </div>

                          {/* Instructions */}
                          <div className="space-y-2.5 text-xs sm:text-sm font-semibold text-white/95 leading-relaxed bg-black/25 p-3.5 rounded-2xl border border-emerald-400/20 mb-4">
                            <div className="flex items-start gap-2.5">
                              <span className="w-5 h-5 rounded-full bg-white text-emerald-800 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                ১
                              </span>
                              <span>
                                আপনার ব্যাংক অ্যাপ অথবা শাখা থেকে টাকা পাঠান
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5">
                              <span className="w-5 h-5 rounded-full bg-white text-emerald-800 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                ২
                              </span>
                              <span>
                                প্রাপক হিসেবে <strong>{activeCfg.number}</strong> নম্বরে <strong>৳ {amountNum}</strong> পাঠান
                              </span>
                            </div>
                            <div className="flex items-start gap-2.5">
                              <span className="w-5 h-5 rounded-full bg-white text-emerald-800 font-black text-[11px] flex items-center justify-center flex-shrink-0 mt-0.5 shadow">
                                ৩
                              </span>
                              <span>
                                পেমেন্ট সম্পন্ন করে ব্যাংক <strong>Reference No / Transaction ID</strong> নিচের বক্সে দিন
                              </span>
                            </div>
                          </div>

                          {/* Transaction ID Input */}
                          <div className="mb-4">
                            <label className="block text-xs font-black text-white mb-1.5 flex items-center justify-between">
                              <span>ট্রানজেকশন আইডি / রেফারেন্স নম্বর দিন:</span>
                              <span className="text-[10px] text-emerald-200 font-mono">Reference ID</span>
                            </label>
                            <input
                              type="text"
                              className="w-full bg-white text-slate-950 font-black font-mono text-sm sm:text-base px-4 py-3.5 rounded-xl border-2 border-white/60 focus:border-amber-300 focus:outline-none focus:ring-4 focus:ring-amber-300/30 uppercase placeholder:text-slate-400 shadow-lg text-center tracking-widest"
                              placeholder="Transaction / Ref ID লিখুন"
                              value={depositTrxId}
                              onChange={(e) => {
                                setDepositTrxId(e.target.value);
                                setDepTrxErr('');
                              }}
                            />
                            {depTrxErr && (
                              <p className="text-xs font-bold text-yellow-200 mt-2 bg-black/60 px-3 py-1.5 rounded-lg text-center shadow border border-yellow-400/40">
                                ⚠️ {depTrxErr}
                              </p>
                            )}
                          </div>

                          {/* Screenshot Upload */}
                          <div className="mb-5 p-3 rounded-2xl bg-black/35 backdrop-blur-md border border-emerald-300/30 space-y-2">
                            <div className="flex items-center justify-between">
                              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                                <i className="fas fa-camera text-yellow-300"></i>
                                <span>পেমেন্ট স্লিপ বা স্ক্রিনশট (ঐচ্ছিক):</span>
                              </label>
                              {depositReceiptImage && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setDepositReceiptImage('');
                                    setDepositReceiptFileName('');
                                    haptic('light');
                                  }}
                                  className="text-[10px] text-emerald-200 hover:text-white font-bold underline flex items-center gap-1 cursor-pointer"
                                >
                                  <i className="fas fa-times"></i> ছবি মুছুন
                                </button>
                              )}
                            </div>

                            {depositReceiptImage ? (
                              <div className="relative rounded-xl overflow-hidden border-2 border-emerald-300/60 bg-black/60 p-2 flex items-center gap-3">
                                <img
                                  src={depositReceiptImage}
                                  alt="Bank Screenshot"
                                  className="w-14 h-14 sm:w-16 sm:h-16 object-cover rounded-lg border border-white/20 cursor-pointer shadow-md"
                                  onClick={() => setSelectedScreenshotPreview(depositReceiptImage)}
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-emerald-300 flex items-center gap-1">
                                    <i className="fas fa-check-circle"></i>
                                    <span>রসিদের ছবি যুক্ত হয়েছে!</span>
                                  </p>
                                  <p className="text-[10px] text-slate-300 truncate font-mono mt-0.5">
                                    {depositReceiptFileName || 'bank_slip.png'}
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <label className="relative flex flex-col items-center justify-center p-3 rounded-xl border-2 border-dashed border-emerald-300/40 hover:border-white bg-white/5 hover:bg-white/10 cursor-pointer transition text-center group">
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={handleDepositReceiptUpload}
                                />
                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                  <i className="fas fa-cloud-upload-alt text-amber-300"></i>
                                  <span>পেমেন্ট স্লিপের ছবি সিলেক্ট করুন</span>
                                </span>
                                <span className="text-[10px] text-emerald-200/80 mt-0.5">
                                  JPG, PNG (সর্বোচ্চ ৮MB)
                                </span>
                              </label>
                            )}
                          </div>

                          {/* Verify Button */}
                          <button
                            type="button"
                            onClick={handleSubmitDeposit}
                            disabled={depositSubmitting}
                            className="w-full py-4 rounded-2xl bg-white hover:bg-emerald-50 text-[#064e3b] font-black text-base sm:text-lg tracking-wider uppercase shadow-2xl transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer border-2 border-white/80"
                          >
                            {depositSubmitting ? (
                              <span className="loading-spinner"></span>
                            ) : (
                              <>
                                <span>পেমেন্ট ভেরিফাই করুন (VERIFY PAYMENT)</span>
                                <i className="fas fa-check-circle text-emerald-600 text-lg"></i>
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })()}

                    {/* GATEWAY FOOTER */}
                    <div className="text-center py-2 text-[11px] text-slate-400 flex items-center justify-center gap-4">
                      <span className="flex items-center gap-1">
                        <i className="fas fa-lock text-emerald-400"></i> নিরাপদ পেমেন্ট
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <i className="fas fa-bolt text-amber-400"></i> দ্রুত ভেরিফিকেশন
                      </span>
                      <span>•</span>
                      <a
                        href="https://t.me/RF2_SMM"
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-400 hover:underline flex items-center gap-1 font-bold"
                      >
                        <i className="fab fa-telegram"></i> হেল্পলাইন
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Deposit History */}
              <div className="mt-6">
                <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <i className="fas fa-history text-blue-400"></i>
                  <span>Recent Deposit Requests (আপনার সাম্প্রতিক রিকোয়েস্ট)</span>
                </h3>

                {depositHistory.length === 0 ? (
                  <div className="glass-card p-4 text-center">
                    <p className="text-[11px] text-slate-500 font-medium">
                      এখনো কোনো ডিপোজিট রিকোয়েস্ট নেই
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {depositHistory.map((dep, depIdx) => (
                      <div key={`${dep.id || 'dep'}-${depIdx}`} className="deposit-history-card">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[9px] text-slate-400 font-mono">
                            {dep.timestamp
                              ? new Date(dep.timestamp.seconds * 1000).toLocaleString('en-BD', {
                                  day: '2-digit',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })
                              : 'Just now'}
                          </span>
                          <span
                            className={`text-[8px] font-bold px-2 py-0.5 rounded-md ${
                              dep.status === 'Approved'
                                ? 'text-emerald-400 bg-emerald-500/15 border border-emerald-500/25'
                                : dep.status === 'Rejected'
                                ? 'text-red-400 bg-red-500/15 border border-red-500/25'
                                : 'text-amber-400 bg-amber-500/15 border border-amber-500/25'
                            }`}
                          >
                            {dep.status}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[11px] text-slate-300 font-bold uppercase flex items-center gap-1">
                            <span>{dep.method}</span>
                            <span className="text-slate-500">•</span>
                            <span className="font-mono text-amber-300">{dep.trxId}</span>
                          </span>
                          <span className="font-black text-base text-white">
                            ৳ {dep.amount}
                          </span>
                        </div>
                        {dep.screenshotUrl && (
                          <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <i className="fas fa-image text-amber-400"></i>
                              <span>পেমেন্ট স্ক্রিনশট সংযুক্ত আছে</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setSelectedScreenshotPreview(dep.screenshotUrl!)}
                              className="text-[10px] font-bold text-amber-300 hover:text-amber-200 underline flex items-center gap-1 cursor-pointer"
                            >
                              <i className="fas fa-eye text-[9px]"></i>
                              <span>ছবি দেখুন</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>
          )}

          {/* PROFILE TAB */}
          {activeTab === 'profile' && (
            <section className="px-4 sm:px-6 mt-4 pb-20 animate-fade-in space-y-5">
              {/* Profile Card Header */}
              <div className="glass-card p-6 border border-amber-500/30 bg-gradient-to-br from-slate-900/90 via-[#0b1329] to-slate-900 relative overflow-hidden shadow-[0_0_40px_rgba(245,158,11,0.15)] text-center rounded-3xl">
                {/* Background Decorative Glow */}
                <div className="absolute top-0 right-0 w-36 h-36 bg-amber-500/10 rounded-full blur-3xl pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-36 h-36 bg-blue-500/10 rounded-full blur-3xl pointer-events-none"></div>

                {/* Profile Avatar with Upload Camera Badge */}
                <div className="relative w-28 h-28 mx-auto mb-3 group">
                  <div className="w-28 h-28 rounded-3xl overflow-hidden border-2 border-amber-400/60 shadow-2xl bg-slate-950 flex items-center justify-center relative ring-4 ring-amber-500/10">
                    {userPhotoURL || currentUser?.photoURL ? (
                      <img
                        src={userPhotoURL || currentUser?.photoURL}
                        alt="Profile"
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                    ) : (
                      <img
                        src={`https://ui-avatars.com/api/?name=${encodeURIComponent(
                          currentUser?.name || 'User'
                        )}&background=3b82f6&color=fff&bold=true&size=200`}
                        alt="Avatar"
                        className="w-full h-full object-cover"
                      />
                    )}

                    {profileSubmitting && (
                      <div className="absolute inset-0 bg-black/75 flex items-center justify-center backdrop-blur-xs">
                        <span className="loading-spinner"></span>
                      </div>
                    )}
                  </div>

                  {/* Upload Camera Icon Button */}
                  <label
                    className="absolute -bottom-2 -right-2 w-10 h-10 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black flex items-center justify-center shadow-xl cursor-pointer border-2 border-[#030712] transition active:scale-95 group/btn"
                    title="Change Profile Picture (ছবি পরিবর্তন করুন)"
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProfilePicUpload}
                      className="hidden"
                      disabled={profileSubmitting}
                    />
                    <i className="fas fa-camera text-sm"></i>
                  </label>

                  {/* Remove Photo option if custom photo exists */}
                  {(userPhotoURL || currentUser?.photoURL) && (
                    <button
                      onClick={handleRemoveProfilePic}
                      disabled={profileSubmitting}
                      className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-600/90 text-white flex items-center justify-center text-xs shadow-md hover:scale-110 transition border border-white/20"
                      title="Remove Photo"
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  )}
                </div>

                {/* User Name & Name Edit Form */}
                {isEditingName ? (
                  <div className="flex items-center justify-center gap-2 max-w-xs mx-auto mt-2">
                    <input
                      type="text"
                      className="input-modern py-1.5 px-3 text-xs text-center font-bold"
                      value={editUserName}
                      onChange={(e) => setEditUserName(e.target.value)}
                      placeholder="Enter full name"
                    />
                    <button
                      onClick={handleUpdateUserName}
                      disabled={profileSubmitting}
                      className="px-3 py-1.5 bg-emerald-500 text-black text-xs font-black rounded-xl hover:bg-emerald-400 transition shadow"
                    >
                      {profileSubmitting ? '...' : 'Save'}
                    </button>
                    <button
                      onClick={() => setIsEditingName(false)}
                      className="px-2 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 mt-2">
                    <h2 className="text-xl font-black text-white">{currentUser?.name || 'User'}</h2>
                    <button
                      onClick={() => {
                        setEditUserName(currentUser?.name || '');
                        setIsEditingName(true);
                      }}
                      className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-amber-400 flex items-center justify-center text-xs transition border border-white/5"
                      title="Edit Display Name (নাম পরিবর্তন)"
                    >
                      <i className="fas fa-pen"></i>
                    </button>
                  </div>
                )}

                {/* User Meta Badges & Username Edit */}
                <div className="flex flex-wrap items-center justify-center gap-2 mt-3">
                  {isEditingUsername ? (
                    <div className="w-full max-w-xs mx-auto mt-2 p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-amber-300 font-bold">
                        <span>Change Username (ইউজার নাম পরিবর্তন)</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-mono">@</span>
                        <input
                          type="text"
                          className="auth-input py-1 pl-7 text-xs font-mono lowercase"
                          placeholder="new_username"
                          value={editUserUsername}
                          onChange={(e) => setEditUserUsername(e.target.value)}
                        />
                      </div>
                      {editUserUsernameErr && (
                        <p className="text-[10px] text-red-400 font-semibold">{editUserUsernameErr}</p>
                      )}
                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingUsername(false);
                            setEditUserUsernameErr('');
                          }}
                          className="px-2.5 py-1 bg-slate-800 text-slate-300 text-[11px] font-bold rounded-lg hover:bg-slate-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleUpdateUserUsername}
                          disabled={profileSubmitting}
                          className="px-3 py-1 bg-amber-500 text-black text-[11px] font-black rounded-lg hover:bg-amber-400 transition"
                        >
                          {profileSubmitting ? 'Saving...' : 'Update Username'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono font-bold text-slate-300 bg-white/5 px-3 py-1 rounded-full border border-white/10 flex items-center gap-1.5">
                        <i className="fas fa-at text-amber-400"></i>
                        <span>{currentUser?.username || currentUser?.uid.slice(0, 8)}</span>
                      </span>
                      <button
                        onClick={() => {
                          setEditUserUsername(currentUser?.username || '');
                          setEditUserUsernameErr('');
                          setIsEditingUsername(true);
                        }}
                        className="w-6 h-6 rounded-md bg-white/5 hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 flex items-center justify-center text-[10px] transition border border-white/5"
                        title="Change Username (ইউজার নাম পরিবর্তন করুন)"
                      >
                        <i className="fas fa-pen"></i>
                      </button>
                    </div>
                  )}

                  <span className="text-[11px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20 flex items-center gap-1.5">
                    <i className="fas fa-shield-check text-emerald-400"></i>
                    <span>VERIFIED USER</span>
                  </span>
                </div>
              </div>

              {/* Account Details & Stats */}
              <div className="glass-card p-4 space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-id-card text-amber-400"></i>
                    <span>Account Details (একাউন্ট তথ্য)</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">ACTIVE</span>
                </h4>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-slate-400">User ID (UID):</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-amber-300 font-bold">{currentUser?.uid}</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(currentUser?.uid || '');
                          showToast('UID Copied to clipboard', 'success');
                        }}
                        className="text-[10px] text-slate-400 hover:text-white bg-white/5 px-2 py-0.5 rounded transition"
                      >
                        <i className="fas fa-copy"></i>
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-slate-400">Username:</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-white font-bold">@{currentUser?.username}</span>
                      <button
                        onClick={() => {
                          setEditUserUsername(currentUser?.username || '');
                          setEditUserUsernameErr('');
                          setIsEditingUsername(true);
                        }}
                        className="text-[10px] text-amber-400 hover:text-amber-300 underline"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-slate-400">Full Name:</span>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold">{currentUser?.name}</span>
                      <button
                        onClick={() => {
                          setEditUserName(currentUser?.name || '');
                          setIsEditingName(true);
                        }}
                        className="text-[10px] text-amber-400 hover:text-amber-300 underline"
                      >
                        Edit
                      </button>
                    </div>
                  </div>

                  {currentUser?.email && (
                    <div className="flex justify-between items-center py-1 border-b border-white/5">
                      <span className="text-slate-400">Gmail / Email:</span>
                      <span className="font-mono text-slate-200 font-semibold">{currentUser.email}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center py-1 border-b border-white/5">
                    <span className="text-slate-400">Current Balance:</span>
                    <span className="font-mono text-emerald-400 font-extrabold text-sm">৳ {userBalance.toFixed(2)}</span>
                  </div>

                  <div className="flex justify-between items-center py-1">
                    <span className="text-slate-400">Total Orders:</span>
                    <span className="font-mono text-blue-400 font-extrabold text-sm">{userTotalOrders}</span>
                  </div>
                </div>

                {/* Quick Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
                  <button
                    onClick={() => {
                      setActiveTab('funds');
                      haptic('light');
                    }}
                    className="py-2 px-3 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[10px] font-extrabold flex items-center justify-center gap-1.5 transition border border-emerald-500/30 active:scale-95"
                  >
                    <i className="fas fa-plus-circle"></i> ADD FUNDS (ডিপোজিট)
                  </button>
                  <button
                    onClick={() => {
                      setActiveTab('orders');
                      haptic('light');
                    }}
                    className="py-2 px-3 rounded-xl bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[10px] font-extrabold flex items-center justify-center gap-1.5 transition border border-blue-500/30 active:scale-95"
                  >
                    <i className="fas fa-list"></i> MY ORDERS (অর্ডার)
                  </button>
                </div>
              </div>

              {/* Security & Credentials Section */}
              <div className="glass-card p-4 space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center justify-between border-b border-white/5 pb-2">
                  <div className="flex items-center gap-2">
                    <i className="fas fa-shield-alt text-amber-400"></i>
                    <span>Security & Account Settings (সিকিউরিটি ও সেটিংস)</span>
                  </div>
                </h4>

                <div className="space-y-2">
                  {/* Change Password Button & Trigger */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-xs">
                        <i className="fas fa-key"></i>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Password (পাসওয়ার্ড)</p>
                        <p className="text-[10px] text-slate-400">আপনার একাউন্টের পাসওয়ার্ড পরিবর্তন করুন</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setShowChangePassModal(true);
                        setChangePassErr('');
                        setChangePassSuccess('');
                        setCurrentPasswordInput('');
                        setNewPasswordInput('');
                        setConfirmNewPasswordInput('');
                        haptic('light');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-[11px] font-bold transition active:scale-95 flex items-center gap-1.5"
                    >
                      <i className="fas fa-lock text-[10px]"></i>
                      <span>পাসওয়ার্ড পরিবর্তন</span>
                    </button>
                  </div>

                  {/* Change Username Button & Trigger */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 text-xs">
                        <i className="fas fa-at"></i>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">Username (ইউজার নাম)</p>
                        <p className="text-[10px] text-slate-400">বর্তমান: @{currentUser?.username}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setEditUserUsername(currentUser?.username || '');
                        setEditUserUsernameErr('');
                        setIsEditingUsername(true);
                        haptic('light');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/30 text-[11px] font-bold transition active:scale-95 flex items-center gap-1.5"
                    >
                      <i className="fas fa-pen text-[10px]"></i>
                      <span>ইউজার নাম পরিবর্তন</span>
                    </button>
                  </div>
                </div>
              </div>

{/* Referral & 10% Deposit Bonus Card in Profile */}
              <div
                onClick={() => {
                  setShowReferralModal(true);
                  haptic('heavy');
                }}
                className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-600/15 to-slate-900 border border-amber-500/40 flex items-center justify-between cursor-pointer hover:border-amber-400 transition active:scale-95 shadow-[0_4px_20px_rgba(245,158,11,0.15)]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-amber-500/30 text-amber-300 flex items-center justify-center text-lg border border-amber-500/40 shadow-inner">
                    <i className="fas fa-hand-holding-dollar"></i>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-extrabold text-xs text-white">রেফারেল প্রোগ্রাম ({referralConfig.bonusPercent || 10}% ডিপোজিট বোনাস)</h4>
                      <span className="bg-emerald-500 text-black font-black text-[9px] px-1.5 py-0.2 rounded font-mono">
                        +{referralConfig.bonusPercent || 10}%
                      </span>
                    </div>
                    <p className="text-[10px] text-amber-200/80 mt-0.5">
                      মোট রেফার: <strong className="text-white">{userTotalReferrals} জন</strong> • অর্জিত বোনাস: <strong className="text-emerald-400 font-mono">৳{userReferralEarnings.toFixed(2)}</strong>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-amber-400 text-xs font-black bg-amber-500/10 px-2.5 py-1.5 rounded-xl border border-amber-500/30">
                  <span>ড্যাশবোর্ড</span>
                  <i className="fas fa-arrow-right text-[9px]"></i>
                </div>
              </div>

              {/* Earn Free Rewards Banner */}
              <div
                onClick={() => {
                  setShowTasksModal(true);
                  haptic('heavy');
                }}
                className="p-4 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-500/10 to-transparent border border-amber-500/30 flex items-center justify-between cursor-pointer hover:border-amber-400 transition active:scale-95"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/30 text-amber-400 flex items-center justify-center text-lg border border-amber-500/40">
                    <i className="fas fa-gift"></i>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs text-white">Daily Tasks & Screenshot Rewards</h4>
                    <p className="text-[10px] text-amber-200/80">টাস্ক কমপ্লিট করে ফ্রিতে টাকা ইনকাম করুন</p>
                  </div>
                </div>
                <i className="fas fa-chevron-right text-amber-400 text-xs"></i>
              </div>


              {/* Support & Community Section */}
              <div className="glass-card p-4 space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
                  <i className="fas fa-headset text-amber-400"></i>
                  <span>Help & Support Center (সাপোর্ট ও সোশ্যাল লিঙ্ক)</span>
                </h4>

                {/* Live AI Support Card in Profile */}
                {welcomeConfig.aiSupportEnabled !== false && (
                  <div
                    onClick={() => {
                      setShowAISupportModal(true);
                      haptic('heavy');
                    }}
                    className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/20 via-yellow-600/10 to-blue-900/30 border border-amber-500/40 hover:border-amber-400 flex items-center justify-between cursor-pointer transition active:scale-95 shadow-[0_4px_15px_rgba(245,158,11,0.1)]"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/30 text-amber-300 flex items-center justify-center text-lg border border-amber-500/40">
                        <i className="fas fa-robot"></i>
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h5 className="font-extrabold text-xs text-white">২৪/৭ লাইভ AI সাপোর্ট</h5>
                          <span className="bg-emerald-500 text-black text-[9px] font-bold px-1.5 py-0.2 rounded font-mono">
                            INSTANT
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-300 mt-0.5">যেকোনো প্রশ্ন করুন, ভয়েসে শুনুন বা টাইপ করুন</p>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 rounded-xl bg-amber-500 text-black font-extrabold text-xs shadow hover:bg-amber-400 transition">
                      চ্যাট করুন
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <a
                    href="https://t.me/RF2_SMM"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 border border-sky-500/30 flex items-center gap-3 transition active:scale-95"
                  >
                    <div className="w-9 h-9 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center text-lg">
                      <i className="fab fa-telegram-plane"></i>
                    </div>
                    <div>
                      <h5 className="font-extrabold text-xs text-white">Telegram</h5>
                      <p className="text-[9px] text-sky-300">Admin Chat</p>
                    </div>
                  </a>

                  <a
                    href="https://wa.me/8801342163841"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-3 transition active:scale-95"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg">
                      <i className="fab fa-whatsapp"></i>
                    </div>
                    <div>
                      <h5 className="font-extrabold text-xs text-white">WhatsApp</h5>
                      <p className="text-[9px] text-emerald-300">24/7 Available</p>
                    </div>
                  </a>
                </div>

                <div className="pt-2 border-t border-white/5 space-y-2">
                  <div
                    onClick={() => {
                      navigator.clipboard.writeText('https://t.me/RF2_SMM');
                      showToast('Telegram Link Copied', 'success');
                    }}
                    className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/5 flex items-center justify-between cursor-pointer transition text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <i className="fab fa-telegram text-sky-400"></i>
                      <span className="font-semibold text-white">Official Telegram Group</span>
                    </div>
                    <i className="fas fa-copy text-slate-500 text-[10px]"></i>
                  </div>

                  <div
                    onClick={() => {
                      navigator.clipboard.writeText('https://www.facebook.com/share/1EKKUHMxCw/');
                      showToast('Facebook Link Copied', 'success');
                    }}
                    className="p-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-white/5 flex items-center justify-between cursor-pointer transition text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <i className="fab fa-facebook text-blue-500"></i>
                      <span className="font-semibold text-white">Facebook Official Page</span>
                    </div>
                    <i className="fas fa-copy text-slate-500 text-[10px]"></i>
                  </div>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="w-full py-3 rounded-2xl bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition active:scale-95"
              >
                <i className="fas fa-right-from-bracket"></i>
                <span>LOGOUT FROM ACCOUNT (লগআউট করুন)</span>
              </button>
            </section>
          )}

          {/* ADMIN TAB */}
          {activeTab === 'admin' && isAdminUser && (
            <section className="px-4 sm:px-6 mt-4 pb-20 animate-fade-in">
              {/* Top Banner */}
              <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)] mb-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-lg shadow-lg">
                      <i className="fas fa-crown"></i>
                    </div>
                    <div>
                      <h2 className="text-base font-black text-white flex items-center gap-2">
                        <span>SMM Panel Admin Dashboard</span>
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold">
                          FULL CONTROL
                        </span>
                      </h2>
                      <p className="text-[10px] text-slate-400">Manage users, deposits, orders, services & settings</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleExportBackup}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 border border-white/10 flex items-center gap-1.5 transition active:scale-95"
                    >
                      <i className="fas fa-download text-amber-400"></i>
                      <span>Backup JSON</span>
                    </button>
                  </div>
                </div>

                {/* Stat Counters Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-4 border-t border-white/10">
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Total Users</span>
                    <div className="text-lg font-black text-white mt-0.5">{allUsersList.length}</div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-bold text-slate-400 uppercase">Total Orders</span>
                    <div className="text-lg font-black text-blue-400 mt-0.5">{allAdminOrdersList.length}</div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-bold text-amber-400/80 uppercase">Pending Deposits</span>
                    <div className="text-lg font-black text-amber-400 mt-0.5">
                      {allDepositRequests.filter((d) => d.status === 'Pending').length}
                    </div>
                  </div>
                  <div className="bg-white/5 p-3 rounded-2xl border border-white/5">
                    <span className="text-[9px] font-bold text-emerald-400/80 uppercase">Services Active</span>
                    <div className="text-lg font-black text-emerald-400 mt-0.5">{allServices.length}</div>
                  </div>
                </div>
              </div>

              {/* Sub Navigation Bar */}
              <div className="flex overflow-x-auto gap-2 p-1.5 bg-slate-900/90 rounded-2xl border border-white/10 mb-5 scrollbar-none">
                {[
                  { id: 'users', label: 'Users & Balance', icon: 'fas fa-users' },
                  { id: 'referrals', label: 'Referral 5% Bonus (রেফারেল)', icon: 'fas fa-gift' },
                  { id: 'payment', label: 'Payment Numbers', icon: 'fas fa-mobile-alt' },
                  { id: 'deposits', label: 'Deposit Requests', icon: 'fas fa-wallet' },
                  { id: 'orders', label: 'Orders Control', icon: 'fas fa-list-check' },
                  { id: 'services', label: 'Services (API)', icon: 'fas fa-server' },
                  { id: 'welcome', label: '3D ভয়েস ও মেসেজ', icon: 'fas fa-volume-up' },
                  { id: 'notifications', label: 'Broadcast', icon: 'fas fa-bullhorn' },
                  { id: 'links', label: 'Support Links', icon: 'fas fa-link' },
                  { id: 'settings', label: 'Site Logo & Settings (লোগো ও সেটিংস)', icon: 'fas fa-cog' },
                  { id: 'support', label: 'Live AI & Chat Support (লাইভ ইনবক্স)', icon: 'fas fa-headset' },
                  { id: 'tasks', label: 'Tasks & Screenshots Proof (টাস্ক প্রুফ)', icon: 'fas fa-tasks' }
                ].map((st, stIdx) => (
                  <button
                    key={`${st.id}-${stIdx}`}
                    onClick={() => {
                      setAdminSubTab(st.id as any);
                      haptic('light');
                    }}
                    className={`whitespace-nowrap px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                      adminSubTab === st.id
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <i className={st.icon}></i>
                    <span>{st.label}</span>
                  </button>
                ))}
              </div>

              {/* SUB TAB 1: USERS & BALANCE (ডিপোজিট এমাউন্ট বাড়ানো-কমানো) */}
              {adminSubTab === 'users' && (
                <div className="space-y-4">
                  {/* Search bar */}
                  <div className="relative">
                    <input
                      type="text"
                      className="input-modern pl-10 text-xs"
                      placeholder="Search User by UID or Name..."
                      value={adminSearch}
                      onChange={(e) => setAdminSearch(e.target.value)}
                    />
                    <i className="fas fa-search absolute left-3.5 top-3.5 text-slate-500 text-xs"></i>
                  </div>

                  {/* Users Cards */}
                  <div className="space-y-3">
                    {allUsersList
                      .filter((u) => {
                        const q = adminSearch.toLowerCase().trim();
                        if (!q) return true;
                        return u.uid.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q);
                      })
                      .map((u) => {
                        const currentVal = userBalanceAdjustInput[u.uid] || '';
                        const numVal = parseFloat(currentVal) || 0;

                        return (
                          <div
                            key={u.uid}
                            className="bg-slate-900/80 border border-white/10 rounded-2xl p-4 space-y-3 shadow-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-sm">
                                  <i className="fas fa-user"></i>
                                </div>
                                <div>
                                  <h4 className="font-extrabold text-sm text-white">{u.name || 'User'}</h4>
                                  <p className="text-[10px] text-slate-400 font-mono">UID: {u.uid}</p>
                                </div>
                              </div>

                              <div className="text-right">
                                <span className="text-[9px] text-slate-500 font-bold uppercase block">Current Balance</span>
                                <span className="text-base font-black text-emerald-400">৳ {(u.balance || 0).toFixed(2)}</span>
                              </div>
                            </div>

                            {/* Quick Balance Adjustment Row (ডিপোজিট বাড়ানো / কমানো) */}
                            <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-extrabold text-slate-300 flex items-center gap-1">
                                  <i className="fas fa-coins text-amber-400"></i>
                                  <span>Adjust Balance (ডিপোজিট এমাউন্ট বাড়ান / কমান):</span>
                                </span>
                              </div>

                              {/* Quick buttons */}
                              <div className="flex flex-wrap gap-1.5">
                                {[50, 100, 500, 1000].map((amt, amtIdx) => (
                                  <button
                                    key={`${amt}-${amtIdx}`}
                                    onClick={() => handleAddUserBalance(u.uid, amt)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-extrabold text-[10px] border border-emerald-500/30 transition active:scale-95"
                                  >
                                    +৳{amt}
                                  </button>
                                ))}
                                {[50, 100, 500].map((amt, amtIdx) => (
                                  <button
                                    key={`${amt}-${amtIdx}`}
                                    onClick={() => handleSubtractUserBalance(u.uid, amt)}
                                    className="px-2.5 py-1 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 font-extrabold text-[10px] border border-red-500/30 transition active:scale-95"
                                  >
                                    -৳{amt}
                                  </button>
                                ))}
                              </div>

                              {/* Custom input */}
                              <div className="flex items-center gap-2 pt-1">
                                <input
                                  type="number"
                                  className="input-modern text-xs py-1.5 px-3"
                                  placeholder="Enter custom amount..."
                                  value={currentVal}
                                  onChange={(e) =>
                                    setUserBalanceAdjustInput((prev) => ({
                                      ...prev,
                                      [u.uid]: e.target.value
                                    }))
                                  }
                                />
                                <button
                                  onClick={() => handleAddUserBalance(u.uid, numVal)}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded-xl transition active:scale-95 flex-shrink-0"
                                >
                                  ADD (+)
                                </button>
                                <button
                                  onClick={() => handleSubtractUserBalance(u.uid, numVal)}
                                  className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] rounded-xl transition active:scale-95 flex-shrink-0"
                                >
                                  SUB (-)
                                </button>
                                <button
                                  onClick={() => handleSetUserBalance(u.uid, numVal)}
                                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-[10px] rounded-xl transition active:scale-95 flex-shrink-0"
                                >
                                  SET EXACT
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* SUB TAB: PAYMENT NUMBERS & CUSTOM LOGO / GATEWAY MANAGEMENT */}
              {adminSubTab === 'payment' && (
                <div className="space-y-4">
                  {/* Top Banner with Add Method Button */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/50 via-indigo-900/40 to-slate-900/80 border border-blue-500/30 shadow-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <i className="fas fa-mobile-alt text-amber-400 text-base"></i>
                        <h3 className="font-extrabold text-sm text-white">পেমেন্ট গেটওয়ে, লোগো ও নম্বর কন্ট্রোল</h3>
                      </div>
                      <p className="text-[11px] text-slate-300">
                        এখানে বিকাশ, নগদ, রকেটের নম্বর, ডায়াল কোড, লোগো এবং নতুন যেকোনো পেমেন্ট সিস্টেম যোগ বা পরিবর্তন করতে পারবেন।
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setShowAddMethodModal(true);
                        haptic('light');
                      }}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg transition active:scale-95 flex items-center justify-center gap-1.5 flex-shrink-0 cursor-pointer"
                    >
                      <i className="fas fa-plus-circle"></i>
                      <span>+ নতুন মেথড যোগ করুন</span>
                    </button>
                  </div>

                  {/* ADD NEW PAYMENT METHOD MODAL */}
                  {showAddMethodModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
                      <div className="bg-slate-900 border border-white/20 rounded-3xl p-5 sm:p-6 w-full max-w-lg shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between pb-3 border-b border-white/10">
                          <h3 className="font-black text-sm sm:text-base text-white flex items-center gap-2">
                            <i className="fas fa-wallet text-emerald-400"></i>
                            <span>নতুন পেমেন্ট মেথড যোগ করুন</span>
                          </h3>
                          <button
                            onClick={() => setShowAddMethodModal(false)}
                            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-400 hover:text-white flex items-center justify-center text-xs transition"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>

                        <div className="space-y-3">
                          {/* Method Name */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-300 block mb-1">
                              মেথডের নাম (Method Label, e.g. Upay Personal, Cellfin): *
                            </label>
                            <input
                              type="text"
                              className="input-modern text-xs py-2.5 px-3 font-bold"
                              placeholder="e.g. Upay, Rocket, Bank Transfer"
                              value={newMethodLabel}
                              onChange={(e) => setNewMethodLabel(e.target.value)}
                            />
                          </div>

                          {/* Account/Phone Number */}
                          <div>
                            <label className="text-[11px] font-bold text-slate-300 block mb-1">
                              ফোন নম্বর / ওয়ালেট এড্রেস (Account / Phone Number): *
                            </label>
                            <input
                              type="text"
                              className="input-modern text-xs py-2.5 px-3 font-mono font-bold text-amber-300"
                              placeholder="e.g. 01840442809"
                              value={newMethodNumber}
                              onChange={(e) => setNewMethodNumber(e.target.value)}
                            />
                          </div>

                          {/* Method Type & USSD Grid */}
                          <div className="grid grid-cols-2 gap-2.5">
                            <div>
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                লেনদেনের ধরন (Type):
                              </label>
                              <select
                                className="input-modern text-xs py-2 px-2 bg-slate-800 text-white font-bold"
                                value={newMethodType}
                                onChange={(e) => setNewMethodType(e.target.value as any)}
                              >
                                <option value="Send Money">Send Money (সেন্ড মানি)</option>
                                <option value="Cash Out">Cash Out (ক্যাশ আউট)</option>
                                <option value="Payment">Payment (পেমেন্ট)</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                ডায়াল কোড (USSD Code):
                              </label>
                              <input
                                type="text"
                                className="input-modern text-xs py-2 px-2 font-mono font-bold text-cyan-300"
                                placeholder="e.g. *247# or *167#"
                                value={newMethodUssd}
                                onChange={(e) => setNewMethodUssd(e.target.value)}
                              />
                            </div>
                          </div>

                          {/* Brand Theme Color */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-300 block mb-1.5">
                              ব্যান্ড কালার (Brand Theme Color):
                            </label>
                            <div className="flex flex-wrap items-center gap-2">
                              {[
                                { name: 'bKash Pink', code: '#e2136e' },
                                { name: 'Nagad Orange', code: '#ea580c' },
                                { name: 'Rocket Purple', code: '#8c3494' },
                                { name: 'Upay Blue', code: '#005696' },
                                { name: 'Binance Gold', code: '#f0b90b' },
                                { name: 'Emerald', code: '#10b981' },
                                { name: 'Sky Blue', code: '#0284c7' },
                                { name: 'Indigo', code: '#4f46e5' },
                                { name: 'Red', code: '#dc2626' }
                              ].map((c) => (
                                <button
                                  key={c.code}
                                  type="button"
                                  onClick={() => setNewMethodColor(c.code)}
                                  className={`w-7 h-7 rounded-xl border-2 transition active:scale-95 ${
                                    newMethodColor === c.code ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-80 hover:opacity-100'
                                  }`}
                                  style={{ backgroundColor: c.code }}
                                  title={c.name}
                                />
                              ))}
                              <input
                                type="color"
                                value={newMethodColor}
                                onChange={(e) => setNewMethodColor(e.target.value)}
                                className="w-8 h-8 rounded-lg bg-transparent border-0 cursor-pointer"
                                title="Custom Color Picker"
                              />
                              <span className="text-[10px] font-mono font-bold text-slate-300">
                                {newMethodColor}
                              </span>
                            </div>
                          </div>

                          {/* Preset Icon Type & Logo URL */}
                          <div className="space-y-2 pt-2 border-t border-white/10">
                            <label className="text-[10px] font-bold text-slate-300 block">
                              লোগো অপশন (Logo Selection):
                            </label>

                            <div className="grid grid-cols-4 gap-1.5">
                              {[
                                { id: 'bkash', label: 'bKash SVG' },
                                { id: 'nagad', label: 'Nagad SVG' },
                                { id: 'rocket', label: 'Rocket SVG' },
                                { id: 'upay', label: 'Upay SVG' },
                                { id: 'binance', label: 'Binance' },
                                { id: 'usdt', label: 'USDT ₮' },
                                { id: 'custom', label: 'Custom URL' }
                              ].map((item) => (
                                <button
                                  key={item.id}
                                  type="button"
                                  onClick={() => setNewMethodIconType(item.id as any)}
                                  className={`py-1.5 px-2 rounded-xl text-[10px] font-bold border transition ${
                                    newMethodIconType === item.id
                                      ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                                      : 'bg-white/5 text-slate-400 border-white/10 hover:bg-white/10'
                                  }`}
                                >
                                  {item.label}
                                </button>
                              ))}
                            </div>

                            <div>
                              <label className="text-[10px] font-bold text-slate-400 block mb-1">
                                কাস্টম লোগো ছবি আপলোড বা লিংক (Logo Image Upload or URL):
                              </label>
                              <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2">
                                  <label className="flex-1 cursor-pointer py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95">
                                    <i className="fas fa-image"></i>
                                    <span>গ্যালারি থেকে ছবি আপলোড করুন</span>
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          try {
                                            const base64 = await compressImageToBase64(file, 400, 400, 0.85);
                                            setNewMethodLogoUrl(base64);
                                            setNewMethodIconType('custom');
                                            showToast('✅ লোগো ছবি সিলেক্ট হয়েছে!', 'success');
                                          } catch (err) {
                                            showToast('Failed to load image', 'error');
                                          }
                                        }
                                      }}
                                    />
                                  </label>
                                  {newMethodLogoUrl && (
                                    <button
                                      type="button"
                                      onClick={() => setNewMethodLogoUrl('')}
                                      className="px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold border border-red-500/30 transition"
                                      title="ছবি রিমুভ করুন"
                                    >
                                      <i className="fas fa-times"></i>
                                    </button>
                                  )}
                                </div>
                                <input
                                  type="text"
                                  className="input-modern text-xs py-2 px-3"
                                  placeholder="অথবা ছবির URL পেস্ট করুন (e.g. https://...)"
                                  value={newMethodLogoUrl}
                                  onChange={(e) => setNewMethodLogoUrl(e.target.value)}
                                />
                              </div>
                            </div>

                            {/* Live Logo Preview Box */}
                            <div className="p-3 rounded-2xl bg-black/40 border border-white/10 flex items-center justify-between">
                              <span className="text-[10px] font-bold text-slate-400">লাইভ লোগো প্রিভিউ:</span>
                              <div className="flex items-center gap-2">
                                {renderMethodLogo(
                                  {
                                    label: newMethodLabel || 'Demo',
                                    iconType: newMethodIconType,
                                    logoUrl: newMethodLogoUrl,
                                    color: newMethodColor
                                  },
                                  'w-8 h-8'
                                )}
                                <span className="text-xs font-black text-white">{newMethodLabel || 'Preview'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Extra Note / Details */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-300 block mb-1">
                              নোট / নির্দেশিকা (Optional Notice / Rate):
                            </label>
                            <input
                              type="text"
                              className="input-modern text-xs py-2 px-3"
                              placeholder="e.g. 0.10$ = 12 TK / Only Personal Send Money"
                              value={newMethodNote}
                              onChange={(e) => setNewMethodNote(e.target.value)}
                            />
                          </div>
                        </div>

                        {/* Modal Action Buttons */}
                        <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                          <button
                            type="button"
                            onClick={() => setShowAddMethodModal(false)}
                            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-bold transition"
                          >
                            বাতিল
                          </button>
                          <button
                            type="button"
                            onClick={handleAddNewPaymentMethod}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black shadow-lg transition active:scale-95 flex items-center gap-1.5"
                          >
                            <i className="fas fa-save"></i>
                            <span>💾 মেথড যোগ করুন</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ALL PAYMENT METHODS LIST */}
                  <div className="grid grid-cols-1 gap-4">
                    {(Object.entries(paymentMethodsConfig) as [string, PaymentMethodConfig][]).map(([key, config]) => {
                      const editState: PaymentMethodConfig = editingPaymentMethods[key] || {
                        ...config
                      };

                      return (
                        <div
                          key={key}
                          className="bg-slate-900/90 border border-white/10 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl hover:border-white/20 transition"
                        >
                          {/* Card Header */}
                          <div className="flex items-center justify-between pb-3 border-b border-white/10">
                            <div className="flex items-center gap-3">
                              {/* Live Logo */}
                              {renderMethodLogo(editState, 'w-10 h-10')}
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-black text-sm text-white">{editState.label || config.label}</h4>
                                  <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded-md text-slate-300 font-mono">
                                    ID: {key}
                                  </span>
                                </div>
                                <span className="text-[10px] text-amber-300/90 font-mono font-bold">
                                  {editState.number || 'No number set'}
                                </span>
                              </div>
                            </div>

                            {/* Active Toggle & Delete Button */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingPaymentMethods((prev) => ({
                                    ...prev,
                                    [key]: { ...editState, active: editState.active === false ? true : false }
                                  }))
                                }
                                className={`text-[10px] font-extrabold px-3 py-1 rounded-full border transition cursor-pointer ${
                                  editState.active !== false
                                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                    : 'bg-red-500/15 text-red-400 border-red-500/30'
                                }`}
                              >
                                {editState.active !== false ? '● Active (চালু)' : '○ Inactive (বন্ধ)'}
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`Are you sure you want to delete "${config.label}"?`)) {
                                    handleDeletePaymentMethod(key);
                                  }
                                }}
                                className="w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center text-xs transition active:scale-95 cursor-pointer"
                                title="Delete Method"
                              >
                                <i className="fas fa-trash-alt"></i>
                              </button>
                            </div>
                          </div>

                          {/* Editable Controls Grid */}
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Label */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                মেথডের নাম (Method Label):
                              </label>
                              <input
                                type="text"
                                className="input-modern text-xs py-2 px-3 font-bold"
                                value={editState.label}
                                onChange={(e) =>
                                  setEditingPaymentMethods((prev) => ({
                                    ...prev,
                                    [key]: { ...editState, label: e.target.value }
                                  }))
                                }
                              />
                            </div>

                            {/* Number */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                নম্বর / ওয়ালেট এড্রেস (Phone / Account):
                              </label>
                              <input
                                type="text"
                                className="input-modern text-xs py-2 px-3 font-mono font-bold text-amber-300"
                                value={editState.number}
                                onChange={(e) =>
                                  setEditingPaymentMethods((prev) => ({
                                    ...prev,
                                    [key]: { ...editState, number: e.target.value }
                                  }))
                                }
                              />
                            </div>

                            {/* Type */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                ধরন (Type):
                              </label>
                              <select
                                className="input-modern text-xs py-2 px-2 bg-slate-800 text-white font-bold"
                                value={editState.type || 'Send Money'}
                                onChange={(e) =>
                                  setEditingPaymentMethods((prev) => ({
                                    ...prev,
                                    [key]: { ...editState, type: e.target.value as any }
                                  }))
                                }
                              >
                                <option value="Send Money">Send Money</option>
                                <option value="Cash Out">Cash Out</option>
                                <option value="Payment">Payment</option>
                              </select>
                            </div>

                            {/* USSD Code */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                ডায়াল কোড (USSD Dial Code):
                              </label>
                              <input
                                type="text"
                                className="input-modern text-xs py-2 px-3 font-mono font-bold text-cyan-300"
                                value={editState.ussd || '*247#'}
                                onChange={(e) =>
                                  setEditingPaymentMethods((prev) => ({
                                    ...prev,
                                    [key]: { ...editState, ussd: e.target.value }
                                  }))
                                }
                              />
                            </div>

                            {/* Custom Color Selection */}
                            <div>
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                থিম কালার (Theme Color):
                              </label>
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={editState.color || '#e2136e'}
                                  onChange={(e) =>
                                    setEditingPaymentMethods((prev) => ({
                                      ...prev,
                                      [key]: { ...editState, color: e.target.value }
                                    }))
                                  }
                                  className="w-7 h-7 rounded-lg bg-transparent border-0 cursor-pointer"
                                />
                                <input
                                  type="text"
                                  className="input-modern text-xs py-1 px-2 font-mono"
                                  value={editState.color || '#e2136e'}
                                  onChange={(e) =>
                                    setEditingPaymentMethods((prev) => ({
                                      ...prev,
                                      [key]: { ...editState, color: e.target.value }
                                    }))
                                  }
                                />
                              </div>
                            </div>

                            {/* Custom Logo Image Upload or URL */}
                            <div className="sm:col-span-2">
                              <label className="text-[10px] font-bold text-slate-300 block mb-1">
                                লোগো ছবি পরিবর্তন (Upload Image or paste URL):
                              </label>
                              <div className="flex flex-col sm:flex-row gap-2">
                                <label className="cursor-pointer py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-300 text-xs font-bold flex items-center justify-center gap-2 transition active:scale-95 flex-shrink-0">
                                  <i className="fas fa-image"></i>
                                  <span>গ্যালারি থেকে ছবি</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={async (e) => {
                                      const file = e.target.files?.[0];
                                      if (file) {
                                        try {
                                          const base64 = await compressImageToBase64(file, 400, 400, 0.85);
                                          setEditingPaymentMethods((prev) => ({
                                            ...prev,
                                            [key]: { ...editState, logoUrl: base64 }
                                          }));
                                          showToast('✅ ছবি আপলোড হয়েছে! নিচে Save বাটনে চাপুন।', 'success');
                                        } catch (err) {
                                          showToast('Failed to load image', 'error');
                                        }
                                      }
                                    }}
                                  />
                                </label>
                                {editState.logoUrl && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingPaymentMethods((prev) => ({
                                        ...prev,
                                        [key]: { ...editState, logoUrl: '' }
                                      }))
                                    }
                                    className="px-3 py-2 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs font-bold border border-red-500/30 transition flex-shrink-0"
                                    title="ছবি রিমুভ করুন"
                                  >
                                    <i className="fas fa-trash-alt mr-1"></i> ছবি সরান
                                  </button>
                                )}
                                <input
                                  type="text"
                                  className="input-modern text-xs py-2 px-3 flex-1"
                                  placeholder="অথবা ছবির URL পেস্ট করুন..."
                                  value={editState.logoUrl || ''}
                                  onChange={(e) =>
                                    setEditingPaymentMethods((prev) => ({
                                      ...prev,
                                      [key]: { ...editState, logoUrl: e.target.value }
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          </div>

                          {/* Note Field */}
                          <div>
                            <label className="text-[10px] font-bold text-slate-300 block mb-1">
                              নোট / রেট / নির্দেশিকা (Optional Notice):
                            </label>
                            <input
                              type="text"
                              className="input-modern text-xs py-2 px-3"
                              placeholder="e.g. 0.10$ = 12 TK"
                              value={editState.note || ''}
                              onChange={(e) =>
                                setEditingPaymentMethods((prev) => ({
                                  ...prev,
                                  [key]: { ...editState, note: e.target.value }
                                }))
                              }
                            />
                          </div>

                          {/* Save Button */}
                          <button
                            type="button"
                            onClick={() => handleSavePaymentMethod(key, editState)}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 hover:from-blue-500 hover:to-indigo-500 text-white font-black text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <i className="fas fa-save"></i>
                            <span>সেভ করুন ({editState.label || key})</span>
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* SUB TAB 2: DEPOSIT REQUESTS (ডিপোজিট কন্ট্রোল & এমাউন্ট এডিট) */}
              {adminSubTab === 'deposits' && (
                <div className="space-y-3">
                  {/* Filter tabs */}
                  <div className="flex gap-2">
                    {(['all', 'Pending', 'Approved', 'Rejected'] as const).map((f) => (
                      <button
                        key={f}
                        onClick={() => setDepFilter(f)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition ${
                          depFilter === f
                            ? 'bg-amber-500 text-slate-950 shadow'
                            : 'bg-slate-900 border border-white/10 text-slate-400'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>

                  {allDepositRequests
                    .filter((d) => (depFilter === 'all' ? true : d.status === depFilter))
                    .map((dep, depIdx) => {
                      const currentEditable = customDepAmounts[dep.id] ?? String(dep.amount);

                      return (
                        <div
                          key={`${dep.id || 'dep'}-${depIdx}`}
                          className={`p-4 rounded-2xl border transition-all space-y-3 ${
                            dep.status === 'Pending'
                              ? 'bg-slate-900/90 border-amber-500/40 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
                              : dep.status === 'Approved'
                              ? 'bg-slate-900/60 border-emerald-500/30'
                              : 'bg-slate-900/40 border-red-500/30 opacity-75'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[9px] font-black px-2 py-0.5 rounded-md ${
                                  dep.status === 'Approved'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : dep.status === 'Rejected'
                                    ? 'bg-red-500/20 text-red-400'
                                    : 'bg-amber-500/20 text-amber-400 animate-pulse'
                                }`}
                              >
                                {dep.status}
                              </span>
                              <span className="text-[10px] font-mono text-slate-400">
                                {dep.method.toUpperCase()}
                              </span>
                            </div>
                            <span className="text-[10px] font-mono text-slate-500">
                              {dep.timestamp
                                ? new Date(dep.timestamp.seconds * 1000).toLocaleString('en-BD', {
                                    day: '2-digit',
                                    month: 'short',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })
                                : 'Recent'}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-[9px] text-slate-500 font-bold uppercase block">User UID</span>
                              <span className="font-mono text-slate-300 font-bold">{dep.uid}</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-slate-500 font-bold uppercase block">Trx ID / Hash</span>
                              <span className="font-mono text-blue-400 font-extrabold">{dep.trxId}</span>
                            </div>
                          </div>

                          {/* Uploaded Payment Screenshot (Proof) */}
                          {dep.screenshotUrl && (
                            <div className="p-2.5 bg-black/50 rounded-xl border border-amber-500/30 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <img
                                  src={dep.screenshotUrl}
                                  alt="Deposit Proof"
                                  className="w-12 h-12 object-cover rounded-lg border border-amber-400/40 cursor-pointer hover:scale-105 transition"
                                  onClick={() => setSelectedScreenshotPreview(dep.screenshotUrl!)}
                                />
                                <div>
                                  <span className="text-[10px] font-bold text-amber-300 block">
                                    📸 পেমেন্ট স্ক্রিনশট প্রুফ
                                  </span>
                                  <span className="text-[9px] text-slate-400">ছবি দেখতে ক্লিক করুন</span>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedScreenshotPreview(dep.screenshotUrl!)}
                                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                              >
                                <i className="fas fa-search-plus"></i>
                                <span>View Proof</span>
                              </button>
                            </div>
                          )}

                          {/* Editable Deposit Amount before Approval */}
                          <div className="bg-black/40 p-3 rounded-xl border border-white/5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-slate-400 font-bold">Requested Deposit Amount:</span>
                              <span className="text-sm font-black text-white">৳ {dep.amount}</span>
                            </div>

                            {dep.status === 'Pending' && (
                              <div className="space-y-2 pt-1 border-t border-white/5">
                                <div className="flex items-center justify-between">
                                  <label className="text-[10px] font-extrabold text-amber-400 flex items-center gap-1">
                                    <i className="fas fa-edit"></i>
                                    <span>Edit Deposit Amount (এমাউন্ট বাড়ান বা কমান):</span>
                                  </label>
                                  {parseFloat(currentEditable) !== dep.amount && (
                                    <span className="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full animate-pulse">
                                      ৳{dep.amount} → ৳{currentEditable}
                                    </span>
                                  )}
                                </div>

                                {/* Quick Adjustment Buttons (+10, +50, -10, Reset) */}
                                <div className="flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = (parseFloat(currentEditable) || dep.amount) + 10;
                                      setCustomDepAmounts((prev) => ({ ...prev, [dep.id]: String(val) }));
                                    }}
                                    className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-extrabold text-[10px] rounded-lg border border-emerald-500/30 transition active:scale-95"
                                  >
                                    +10 ৳
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = (parseFloat(currentEditable) || dep.amount) + 50;
                                      setCustomDepAmounts((prev) => ({ ...prev, [dep.id]: String(val) }));
                                    }}
                                    className="px-2 py-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-extrabold text-[10px] rounded-lg border border-emerald-500/30 transition active:scale-95"
                                  >
                                    +50 ৳
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const val = Math.max(0, (parseFloat(currentEditable) || dep.amount) - 10);
                                      setCustomDepAmounts((prev) => ({ ...prev, [dep.id]: String(val) }));
                                    }}
                                    className="px-2 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-extrabold text-[10px] rounded-lg border border-red-500/30 transition active:scale-95"
                                  >
                                    -10 ৳
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setCustomDepAmounts((prev) => ({ ...prev, [dep.id]: String(dep.amount) }));
                                    }}
                                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-[10px] rounded-lg border border-white/10 transition active:scale-95"
                                  >
                                    Reset (৳{dep.amount})
                                  </button>
                                </div>

                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    className="input-modern text-xs py-1.5 px-3 font-mono font-bold text-amber-300"
                                    placeholder="Enter final amount..."
                                    value={currentEditable}
                                    onChange={(e) =>
                                      setCustomDepAmounts((prev) => ({
                                        ...prev,
                                        [dep.id]: e.target.value
                                      }))
                                    }
                                  />
                                  <span className="text-xs font-bold text-slate-400">৳</span>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Actions */}
                          {dep.status === 'Pending' && (
                            <div className="flex gap-2 pt-1">
                              <button
                                onClick={() =>
                                  handleApproveDepositCustom(dep.id, dep.uid, parseFloat(currentEditable) || dep.amount)
                                }
                                className="flex-1 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow transition active:scale-95 flex items-center justify-center gap-1.5"
                              >
                                <i className="fas fa-check-circle"></i>
                                <span>APPROVE & CREDIT (৳ {currentEditable})</span>
                              </button>
                              <button
                                onClick={() => handleRejectDeposit(dep.id)}
                                className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-bold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-1"
                              >
                                <i className="fas fa-times-circle"></i>
                                <span>REJECT</span>
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}

              {/* SUB TAB 3: ORDERS CONTROL */}
              {adminSubTab === 'orders' && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-extrabold text-slate-300">All Orders ({allAdminOrdersList.length})</span>
                    <select
                      className="input-modern py-1 px-3 text-xs w-auto"
                      value={orderStatusFilter}
                      onChange={(e) => setOrderStatusFilter(e.target.value)}
                    >
                      <option value="all">All Statuses</option>
                      <option value="Pending">Pending</option>
                      <option value="Processing">Processing</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Completed">Completed</option>
                      <option value="Cancelled">Cancelled</option>
                    </select>
                  </div>

                  {allAdminOrdersList
                    .filter((o) => (orderStatusFilter === 'all' ? true : o.status === orderStatusFilter))
                    .map((o, oIdx) => (
                      <div key={`${o.id || 'ord'}-${oIdx}`} className="glass-card p-4 space-y-2">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-mono text-slate-400 font-bold">#{o.id.slice(-8)}</span>
                          <span className="font-mono text-slate-400 text-[10px]">User: {o.uid.slice(0, 8)}</span>
                        </div>

                        <h4 className="font-extrabold text-xs text-white leading-snug">{o.service}</h4>
                        <p className="text-[10px] text-slate-400 font-mono truncate">{o.link}</p>

                        <div className="flex justify-between items-center pt-2 border-t border-white/5">
                          <div className="text-xs">
                            <span className="text-slate-400">Qty: {o.qty?.toLocaleString()} | </span>
                            <span className="text-emerald-400 font-bold">৳ {o.cost?.toFixed(2)}</span>
                          </div>

                          {/* Change Status Dropdown */}
                          <div className="flex items-center gap-2">
                            <select
                              className="input-modern text-xs py-1 px-2.5 w-auto"
                              value={o.status || 'Pending'}
                              onChange={(e) => handleUpdateOrderStatus(o.id, e.target.value)}
                            >
                              <option value="Pending">Pending</option>
                              <option value="Processing">Processing</option>
                              <option value="In Progress">In Progress</option>
                              <option value="Completed">Completed</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>

                            {(!o.apiOrderId || o.apiError) && (
                              <button
                                onClick={() => handleRetryOrder(o)}
                                className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold text-[10px] rounded-lg border border-amber-500/30"
                              >
                                Retry API
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* SUB TAB 4: SERVICES MANAGEMENT */}
              {adminSubTab === 'services' && (
                <div className="space-y-4">
                  {/* Service Add/Edit Form Card */}
                  <div className="glass-card p-4 space-y-3">
                    <h3 className="font-extrabold text-xs text-white flex items-center justify-between">
                      <span>{editingServiceId ? 'Edit Service' : 'Add New Service (SMMGen API)'}</span>
                      {editingServiceId && (
                        <button
                          onClick={() => {
                            setEditingServiceId(null);
                            setAdminName('');
                            setAdminCategory('');
                            setAdminPrice('');
                            setAdminApiServiceId('');
                          }}
                          className="text-[10px] text-red-400 hover:underline"
                        >
                          Cancel Edit
                        </button>
                      )}
                    </h3>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="form-label">Service Name</label>
                        <input
                          type="text"
                          className="input-modern text-xs"
                          placeholder="e.g. Facebook Likes [Instant]"
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label">Category</label>
                        <input
                          type="text"
                          className="input-modern text-xs"
                          placeholder="e.g. Facebook"
                          value={adminCategory}
                          onChange={(e) => setAdminCategory(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="form-label">Price / 1k (৳)</label>
                        <input
                          type="number"
                          className="input-modern text-xs"
                          placeholder="৳ 25"
                          value={adminPrice}
                          onChange={(e) => setAdminPrice(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label">Min Qty</label>
                        <input
                          type="number"
                          className="input-modern text-xs"
                          value={adminMin}
                          onChange={(e) => setAdminMin(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label">API Service ID</label>
                        <input
                          type="text"
                          className="input-modern text-xs font-mono"
                          placeholder="15806"
                          value={adminApiServiceId}
                          onChange={(e) => setAdminApiServiceId(e.target.value)}
                        />
                      </div>
                    </div>

                    <button
                      onClick={handleSaveServiceManual}
                      disabled={adminSubmitting}
                      className="btn-primary-solid py-2 text-xs w-full flex items-center justify-center gap-1"
                    >
                      {adminSubmitting ? (
                        <span className="loading-spinner"></span>
                      ) : (
                        <>
                          <i className="fas fa-plus-circle"></i>
                          <span>{editingServiceId ? 'SAVE SERVICE CHANGES' : 'CREATE SERVICE NOW'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Existing Services List */}
                  <div className="space-y-2">
                    {allServices.map((svc, svcIdx) => (
                      <div key={`${svc.id || 'svc'}-${svcIdx}`} className="p-3 bg-slate-900/80 border border-white/10 rounded-2xl flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] bg-blue-500/20 text-blue-300 font-bold px-2 py-0.5 rounded">
                              {svc.category}
                            </span>
                            <span className="text-[9px] font-mono text-slate-400">ID: {svc.id}</span>
                          </div>
                          <h4 className="font-extrabold text-xs text-white mt-1">{svc.name}</h4>
                          <p className="text-[10px] text-emerald-400 font-bold">৳ {svc.price} / 1k</p>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setEditingServiceId(svc.id);
                              setAdminName(svc.name);
                              setAdminCategory(svc.category);
                              setAdminPrice(String(svc.price));
                              setAdminMin(String(svc.min));
                              setAdminMax(String(svc.max || 100000));
                              setAdminDesc(svc.desc || '');
                              setAdminApiServiceId(svc.apiServiceId || '');
                            }}
                            className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-300 flex items-center justify-center text-xs"
                          >
                            <i className="fas fa-edit"></i>
                          </button>
                          <button
                            onClick={() => handleDeleteService(svc.id, svc.name)}
                            className="w-7 h-7 rounded-lg bg-red-500/20 text-red-300 flex items-center justify-center text-xs"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUB TAB 5: BROADCAST & LIVE NOTICE TICKER */}
              {adminSubTab === 'notifications' && (
                <div className="space-y-4">
                  {/* SECTION 1: HOME PAGE SCROLLING LIVE NOTICE TICKER */}
                  <div className="glass-card p-5 space-y-4 border border-amber-500/40 bg-gradient-to-br from-amber-950/20 via-slate-900/90 to-slate-900/90 shadow-[0_4px_25px_rgba(245,158,11,0.15)] rounded-2xl animate-fade-in">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-500 flex items-center justify-center text-slate-950 text-lg font-black shadow-lg">
                          <i className="fas fa-bullhorn"></i>
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-white flex items-center gap-2">
                            <span>হোম পেইজের স্ক্রলিং নোটিশ পরিবর্তন (Live Notice Ticker)</span>
                            <span className="text-[9px] bg-amber-500/25 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40 font-mono font-bold">
                              HOMEPAGE TICKER
                            </span>
                          </h3>
                          <p className="text-[11px] text-slate-300">
                            এখানে যে নোটিশ লিখবেন তা সমস্ত ইউজারদের হোম স্ক্রিনের উপরে লাইভ অ্যানিমেটেড হয়ে স্ক্রল করবে।
                          </p>
                        </div>
                      </div>

                      {/* On/Off Switch */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-300">নোটিশ বার:</span>
                        <button
                          type="button"
                          onClick={() => handleQuickToggleFeature('showNoticeTicker', !adminShowNoticeTicker)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-black transition cursor-pointer active:scale-95 ${
                            adminShowNoticeTicker
                              ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                              : 'bg-red-500/30 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {adminShowNoticeTicker ? '✅ চালু (ON)' : '❌ বন্ধ (OFF)'}
                        </button>
                      </div>
                    </div>

                    {/* Live Preview Box */}
                    <div className="p-3 bg-black/50 rounded-xl border border-amber-500/30">
                      <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-wider text-amber-400 mb-2">
                        <span>লাইভ প্রিভিউ (Live Preview)</span>
                        <span className="text-slate-400 font-normal">ইউজাররা ঠিক যেভাবে দেখবে</span>
                      </div>
                      <div className="overflow-hidden rounded-xl bg-slate-900/90 border border-amber-500/30 p-2 flex items-center gap-2 shadow-inner">
                        <div className="flex items-center gap-1 bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded-lg border border-amber-500/40 whitespace-nowrap">
                          <i className="fas fa-bullhorn text-amber-400 text-xs animate-bounce"></i>
                          <span>নোটিশ</span>
                        </div>
                        <div className="overflow-hidden whitespace-nowrap w-full">
                          <p className="text-[11px] font-semibold text-slate-200 inline-block animate-marquee">
                            {adminNoticeText || '⚡ কোনো নোটিশ দেওয়া নেই'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Notice Input */}
                    <div>
                      <label className="form-label text-slate-300 flex items-center justify-between">
                        <span className="font-extrabold">স্ক্রলিং নোটিশ লিখুন (Notice Text)</span>
                        <span className="text-[10px] text-slate-400">ইমোজি ও স্পেশাল ক্যারেক্টার সাপোর্ট করে</span>
                      </label>
                      <textarea
                        rows={3}
                        className="input-modern text-xs text-white resize-none border-amber-500/30 focus:border-amber-400"
                        placeholder="যেমন: ⚡ ২৪/৭ ইনস্ট্যান্ট সার্ভিস সক্রিয় | বিকাশ, নগদ, রকেটে ইনস্ট্যান্ট ডিপোজিট বোনাস চলছে | যেকোনো প্রয়োজনে লাইভ সাপোর্টে যোগাযোগ করুন 🚀"
                        value={adminNoticeText}
                        onChange={(e) => setAdminNoticeText(e.target.value)}
                      />
                    </div>

                    {/* Quick Preset Templates */}
                    <div>
                      <span className="text-[11px] font-bold text-slate-400 block mb-2">তাত্ক্ষণিক প্রি-সেট নোটিশ (Quick Notice Presets):</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const t = '⚡ ২৪/৭ ইনস্ট্যান্ট সার্ভিস সক্রিয় | বিকাশ, নগদ, রকেটে ইনস্ট্যান্ট ডিপোজিট বোনাস চলছে | যেকোনো প্রয়োজনে আমাদের লাইভ সাপোর্টে যোগাযোগ করুন 🚀';
                            setAdminNoticeText(t);
                            showToast('প্রি-সেট লোড হয়েছে, সেভ বাটনে ক্লিক করুন', 'info');
                          }}
                          className="p-2 text-left rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                        >
                          🌟 <strong className="text-white">স্ট্যান্ডার্ড নোটিশ:</strong> ২৪/৭ ইনস্ট্যান্ট সার্ভিস ও সাপোর্ট
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const t = '🎉 ধামাকা অফার! প্রতি ১০০০ টাকা ডিপোজিটে ১০০ টাকা ফ্রি বোনাস | অটোমেটিক বিকাশ ও নগদ পেমেন্ট চালু আছে 💰';
                            setAdminNoticeText(t);
                            showToast('প্রি-সেট লোড হয়েছে, সেভ বাটনে ক্লিক করুন', 'info');
                          }}
                          className="p-2 text-left rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                        >
                          🎁 <strong className="text-white">ডিপোজিট অফার:</strong> ক্যাশব্যাক ও বোনাস নোটিশ
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const t = '🚀 ফেসবুক ফলোয়ার, ইউটিউব সাবস্ক্রাইবার ও ইনস্টাগ্রাম লাইক এখন সুপার ফাস্ট স্পিডে ডেলিভারি হচ্ছে! এখনই অর্ডার করুন 🔥';
                            setAdminNoticeText(t);
                            showToast('প্রি-সেট লোড হয়েছে, সেভ বাটনে ক্লিক করুন', 'info');
                          }}
                          className="p-2 text-left rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                        >
                          ⚡ <strong className="text-white">সার্ভিস আপডেট:</strong> সুপার স্পিড ডেলিভারি
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const t = '📢 সার্ভার মেইনটেন্যান্স সফলভাবে সম্পন্ন হয়েছে | সকল সোশ্যাল মিডিয়া সার্ভিস ১০০% সচল ও সক্রিয় আছে 🛡️';
                            setAdminNoticeText(t);
                            showToast('প্রি-সেট লোড হয়েছে, সেভ বাটনে ক্লিক করুন', 'info');
                          }}
                          className="p-2 text-left rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs text-slate-300 hover:text-white transition cursor-pointer"
                        >
                          🛠️ <strong className="text-white">মেইনটেন্যান্স নোটিশ:</strong> সার্ভার আপডেট
                        </button>
                      </div>
                    </div>

                    {/* Save Notice Button */}
                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleSaveNoticeText()}
                        disabled={adminSavingNotice}
                        className="w-full py-3 px-5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 font-black text-xs sm:text-sm shadow-[0_4px_20px_rgba(245,158,11,0.3)] hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                      >
                        {adminSavingNotice ? (
                          <>
                            <i className="fas fa-spinner fa-spin"></i>
                            <span>নোটিশ সেভ হচ্ছে...</span>
                          </>
                        ) : (
                          <>
                            <i className="fas fa-save"></i>
                            <span>💾 হোম নোটিশ আপডেট ও সেভ করুন (Save Notice)</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* SECTION 2: BROADCAST NOTIFICATION TO ALL USERS */}
                  <div className="glass-card p-5 space-y-4 border border-blue-500/30 rounded-2xl">
                    <h3 className="font-extrabold text-xs text-white flex items-center gap-2 pb-2 border-b border-white/10">
                      <i className="fas fa-paper-plane text-blue-400"></i>
                      <span>পুশ ব্রডকাস্ট নোটিফিকেশন পাঠান (Post Broadcast Notification to All Users)</span>
                    </h3>

                    <div>
                      <label className="form-label">Notification Title</label>
                      <input
                        type="text"
                        className="input-modern text-xs"
                        placeholder="e.g. Special Weekend Deposit Bonus 🎉"
                        value={broadcastTitle}
                        onChange={(e) => setBroadcastTitle(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="form-label">Type</label>
                      <select
                        className="input-modern text-xs"
                        value={broadcastType}
                        onChange={(e) => setBroadcastType(e.target.value as any)}
                      >
                        <option value="system">System Notice 🚀</option>
                        <option value="promo">Promo / Offer 🎉</option>
                        <option value="deposit">Deposit Update 💳</option>
                      </select>
                    </div>

                    <div>
                      <label className="form-label">Message Details</label>
                      <textarea
                        rows={3}
                        className="input-modern text-xs resize-none"
                        placeholder="Write message to send to all users..."
                        value={broadcastMessage}
                        onChange={(e) => setBroadcastMessage(e.target.value)}
                      />
                    </div>

                    {/* Broadcast Image / Banner Upload */}
                    <div className="space-y-2 p-3 bg-black/40 rounded-2xl border border-white/10">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-extrabold text-white flex items-center gap-1.5">
                          <i className="fas fa-image text-amber-400"></i>
                          <span>Attach Image / Banner (ছবি সংযুক্ত করুন - ঐচ্ছিক)</span>
                        </label>
                        {broadcastImage && (
                          <button
                            onClick={() => setBroadcastImage(null)}
                            className="text-[10px] text-red-400 hover:underline font-bold cursor-pointer"
                          >
                            Remove Photo
                          </button>
                        )}
                      </div>

                      {broadcastImage ? (
                        <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-amber-500/40 bg-slate-950">
                          <img src={broadcastImage} alt="Broadcast Banner Preview" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setBroadcastImage(null)}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center text-xs shadow hover:scale-110 transition cursor-pointer"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-amber-500/30 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 rounded-xl transition cursor-pointer text-center">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAdminBroadcastImageUpload}
                            className="hidden"
                          />
                          <i className="fas fa-cloud-arrow-up text-amber-400 text-xl mb-1"></i>
                          <span className="text-xs font-bold text-white">ব্রডকাস্ট নোটিশের জন্য ছবি আপলোড করুন</span>
                        </label>
                      )}
                    </div>

                    <button
                      onClick={handleSendBroadcast}
                      className="btn-primary-solid py-2.5 text-xs w-full flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <i className="fas fa-paper-plane text-xs"></i>
                      <span>BROADCAST TO ALL USERS</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SUB TAB 6: SUPPORT LINKS */}
              {adminSubTab === 'links' && (
                <div className="space-y-4">
                  <div className="glass-card p-4 space-y-3">
                    <h3 className="font-extrabold text-xs text-white">Add New Support Link</h3>
                    <input
                      type="text"
                      className="input-modern text-xs"
                      placeholder="Link Title (e.g. Telegram Channel)"
                      value={newLinkName}
                      onChange={(e) => setNewLinkName(e.target.value)}
                    />
                    <input
                      type="text"
                      className="input-modern text-xs"
                      placeholder="URL (e.g. https://t.me/RF2_SMM)"
                      value={newLinkUrl}
                      onChange={(e) => setNewLinkUrl(e.target.value)}
                    />
                    <button
                      onClick={handleAddSupportLink}
                      className="btn-primary-solid py-2 text-xs w-full flex items-center justify-center gap-1"
                    >
                      <i className="fas fa-plus"></i>
                      <span>ADD LINK</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {supportLinks.map((sl, slIdx) => (
                      <div key={`${sl.id || 'sl'}-${slIdx}`} className="p-3 bg-slate-900/80 border border-white/10 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <i className={`${sl.icon} text-blue-400 text-sm`}></i>
                          <div>
                            <h4 className="font-extrabold text-xs text-white">{sl.name}</h4>
                            <p className="text-[10px] text-slate-400 font-mono truncate max-w-[200px]">{sl.url}</p>
                          </div>
                        </div>

                        <button
                          onClick={() => handleDeleteSupportLink(sl.id)}
                          className="w-7 h-7 rounded-lg bg-red-500/20 text-red-300 flex items-center justify-center text-xs"
                        >
                          <i className="fas fa-trash"></i>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUB TAB: 3D WELCOME VOICE & ANNOUNCEMENT SETTINGS */}
              {adminSubTab === 'welcome' && (
                <div className="glass-card p-5 space-y-5 animate-fade-in">
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-lg shadow">
                        <i className="fas fa-volume-up"></i>
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-white flex items-center gap-2">
                          <span>3D ওয়েলকাম ভয়েস ও মেসেজ কন্ট্রোল</span>
                          <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30 font-mono">
                            AUDIO & SPEECH
                          </span>
                        </h3>
                        <p className="text-[11px] text-slate-300">
                          ইউজার অ্যাকাউন্টে ঢোকার পর স্পিকারে যা বলবে (অডিও ফাইল/ভয়েস রেকর্ড/TTS) এবং স্ক্রিনে যে মেসেজ দেখাবে
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* MASTER SOUND & USER PANEL VISIBILITY TOGGLES */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 border border-cyan-500/30 space-y-3 shadow-inner">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <div className="flex items-center gap-2">
                        <i className="fas fa-sliders-h text-cyan-400 text-sm"></i>
                        <span className="text-xs font-black text-white">ইউজার প্যানেল সাউন্ড ও ডিসপ্লে কন্ট্রোল (Sound & Visibility Switches)</span>
                      </div>
                      <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full font-mono border border-cyan-500/30 font-bold">
                        REAL-TIME SYNC
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {/* 1. Welcome Sound / Voice Toggle */}
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${adminSoundEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                            <i className={`fas ${adminSoundEnabled ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
                          </div>
                          <div>
                            <div className="text-xs font-black text-white">ওয়েলকাম সাউন্ড / ভয়েস</div>
                            <div className="text-[10px] text-slate-400">
                              {adminSoundEnabled ? '🔊 সাউন্ড চালু (Play Audio)' : '🔇 মিউট / কোনো সাউন্ড আসবে না'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickToggleFeature('soundEnabled', !adminSoundEnabled)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 ${
                            adminSoundEnabled
                              ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                              : 'bg-red-500/30 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {adminSoundEnabled ? 'ON (চালু)' : 'OFF (বন্ধ)'}
                        </button>
                      </div>

                      {/* 2. Welcome Modal Popup Toggle */}
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${adminWelcomeEnabled ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                            <i className="fas fa-window-restore"></i>
                          </div>
                          <div>
                            <div className="text-xs font-black text-white">ওয়েলকাম পপআপ স্ক্রিন</div>
                            <div className="text-[10px] text-slate-400">
                              {adminWelcomeEnabled ? '🌟 লগইনে পপআপ আসবে' : '🚫 পপআপ বন্ধ (ইউজারে দেখাবে না)'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickToggleFeature('enabled', !adminWelcomeEnabled)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 ${
                            adminWelcomeEnabled
                              ? 'bg-emerald-500 text-slate-950 shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                              : 'bg-red-500/30 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {adminWelcomeEnabled ? 'ON (চালু)' : 'OFF (বন্ধ)'}
                        </button>
                      </div>

                      {/* 3. Header 3D Live Button Toggle */}
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${adminShow3DButton ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                            <i className="fas fa-cube"></i>
                          </div>
                          <div>
                            <div className="text-xs font-black text-white">হেডারের 3D লাইভ বাটন</div>
                            <div className="text-[10px] text-slate-400">
                              {adminShow3DButton ? '🧊 হেডারে 3D বাটন দৃশ্যমান' : '🚫 হেডারে 3D বাটন দেখাবে না'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickToggleFeature('show3DButton', !adminShow3DButton)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 ${
                            adminShow3DButton
                              ? 'bg-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(56,189,248,0.5)]'
                              : 'bg-red-500/30 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {adminShow3DButton ? 'ON (চালু)' : 'OFF (বন্ধ)'}
                        </button>
                      </div>

                      {/* 4. Live Notice Ticker Toggle */}
                      <div className="p-3 rounded-xl bg-slate-900/90 border border-white/10 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${adminShowNoticeTicker ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-red-500/20 text-red-300 border border-red-500/30'}`}>
                            <i className="fas fa-bullhorn"></i>
                          </div>
                          <div>
                            <div className="text-xs font-black text-white">হোম নোটিশ টিকার বার</div>
                            <div className="text-[10px] text-slate-400">
                              {adminShowNoticeTicker ? '📢 নোটিশ বার চালু' : '🚫 নোটিশ বার লুকানো (OFF)'}
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleQuickToggleFeature('showNoticeTicker', !adminShowNoticeTicker)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 ${
                            adminShowNoticeTicker
                              ? 'bg-amber-400 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                              : 'bg-red-500/30 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {adminShowNoticeTicker ? 'ON (চালু)' : 'OFF (বন্ধ)'}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Audio Mode Selection Tabs */}
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-2">
                      ভয়েস মেথড নির্বাচন করুন (Select Voice Mode):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Option 1: Bangla TTS */}
                      <button
                        type="button"
                        onClick={() => setAdminAudioMode('tts')}
                        className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3 cursor-pointer ${
                          adminAudioMode === 'tts'
                            ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_20px_rgba(56,189,248,0.25)]'
                            : 'bg-slate-900/60 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${
                            adminAudioMode === 'tts' ? 'bg-cyan-500 text-slate-950 shadow' : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          <i className="fas fa-comment-dots"></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-xs text-white">১. বাংলা টেক্সট-টু-স্পিচ (TTS)</h4>
                            {adminAudioMode === 'tts' && (
                              <span className="text-[9px] bg-cyan-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            নিচে যা লিখবেন, স্পিকার স্পষ্ট বাংলায় পড়ে শোনাবে
                          </p>
                        </div>
                      </button>

                      {/* Option 2: Custom Audio Upload / Record */}
                      <button
                        type="button"
                        onClick={() => setAdminAudioMode('custom')}
                        className={`p-3.5 rounded-2xl border text-left transition flex items-start gap-3 cursor-pointer ${
                          adminAudioMode === 'custom'
                            ? 'bg-purple-500/20 border-purple-400 shadow-[0_0_20px_rgba(168,85,247,0.25)]'
                            : 'bg-slate-900/60 border-white/10 hover:border-white/20'
                        }`}
                      >
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg ${
                            adminAudioMode === 'custom' ? 'bg-purple-500 text-white shadow' : 'bg-white/10 text-slate-300'
                          }`}
                        >
                          <i className="fas fa-microphone-lines"></i>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-xs text-white">২. কাস্টম অডিও আপলোড / ভয়েস রেকর্ড</h4>
                            {adminAudioMode === 'custom' && (
                              <span className="text-[9px] bg-purple-400 text-slate-950 font-black px-1.5 py-0.2 rounded-full">
                                ACTIVE
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            নিজের রেকর্ড করা MP3 অডিও ফাইল আপলোড বা সরাসরি রেকর্ড করুন
                          </p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* CUSTOM AUDIO UPLOAD & RECORDING CONTROLS (If custom mode is selected) */}
                  {adminAudioMode === 'custom' && (
                    <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30 space-y-4 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-purple-300 flex items-center gap-1.5">
                          <i className="fas fa-file-audio"></i>
                          <span>কাস্টম অডিও ফাইল আপলোড অথবা লাইভ রেকর্ড করুন</span>
                        </span>
                        {adminCustomAudioUrl && (
                          <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 font-mono">
                            ✅ অডিও রেডি
                          </span>
                        )}
                      </div>

                      {/* Dropzone & Live Recorder Grid */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {/* 1. File Upload Dropzone */}
                        <div
                          onDragOver={(e) => e.preventDefault()}
                          onDrop={handleAudioFileUpload}
                          className="relative p-4 rounded-xl border-2 border-dashed border-purple-400/40 hover:border-purple-400 bg-slate-900/60 flex flex-col items-center justify-center text-center transition group cursor-pointer"
                        >
                          <input
                            type="file"
                            accept="audio/*,.mp3,.wav,.m4a,.ogg,.aac,.webm"
                            onChange={handleAudioFileUpload}
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                          />
                          <div className="w-10 h-10 rounded-full bg-purple-500/20 text-purple-300 flex items-center justify-center text-lg mb-2 group-hover:scale-110 transition">
                            <i className="fas fa-cloud-arrow-up"></i>
                          </div>
                          <p className="text-xs font-bold text-white">
                            {adminAudioUploading ? 'আপলোড হচ্ছে...' : 'অডিও ফাইল সিলেক্ট / ড্র্যাগ করুন'}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 font-mono">
                            সাপোর্টেড: MP3, WAV, M4A, OGG (সর্বোচ্চ ৩MB)
                          </p>
                        </div>

                        {/* 2. Live Microphone Recorder */}
                        <div className="p-4 rounded-xl border border-white/10 bg-slate-900/60 flex flex-col items-center justify-center text-center">
                          {adminIsRecording ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-center gap-2">
                                <span className="w-3 h-3 rounded-full bg-red-500 animate-ping"></span>
                                <span className="text-sm font-black text-red-400 font-mono">
                                  রেকর্ডিং চলছে... 00:{adminRecordingDuration < 10 ? `0${adminRecordingDuration}` : adminRecordingDuration}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={handleStopRecording}
                                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg active:scale-95 transition flex items-center gap-1.5 mx-auto cursor-pointer"
                              >
                                <i className="fas fa-stop"></i>
                                <span>রেকর্ডিং সম্পন্ন করুন (Stop)</span>
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="w-10 h-10 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center text-lg mx-auto">
                                <i className="fas fa-microphone"></i>
                              </div>
                              <p className="text-xs font-bold text-white">সরাসরি মুখে বলে রেকর্ড করুন</p>
                              <button
                                type="button"
                                onClick={handleStartRecording}
                                className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:brightness-110 text-white font-bold text-xs shadow active:scale-95 transition flex items-center gap-1.5 mx-auto cursor-pointer"
                              >
                                <i className="fas fa-circle text-[8px] text-white animate-pulse"></i>
                                <span>ভয়েস রেকর্ড শুরু করুন</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Active Custom Audio Player Bar */}
                      {adminCustomAudioUrl && (
                        <div className="p-3.5 rounded-xl bg-slate-900/90 border border-purple-500/40 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleTogglePlayCustomAudio}
                              className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-base transition shadow cursor-pointer ${
                                adminAudioPlaying
                                  ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]'
                                  : 'bg-purple-600 hover:bg-purple-500'
                              }`}
                            >
                              <i className={`fas ${adminAudioPlaying ? 'fa-pause' : 'fa-play ml-0.5'}`}></i>
                            </button>
                            <div>
                              <div className="flex items-center gap-2">
                                <h5 className="font-extrabold text-xs text-white truncate max-w-[200px] sm:max-w-[280px]">
                                  {adminAudioFileName || 'Uploaded Custom Audio Clip'}
                                </h5>
                                <span className="text-[9px] bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded font-mono">
                                  {adminAudioPlaying ? 'PLAYING' : 'AUDIO READY'}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400">
                                {adminAudioPlaying ? 'স্পিকারে অডিও বাজছে...' : 'প্লে বাটনে চাপ দিয়ে প্রিভিউ শুনুন'}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={handleRemoveCustomAudio}
                              className="px-3 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/40 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                              <i className="fas fa-trash text-[10px]"></i>
                              <span>অডিও মুছুন</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Title Field */}
                  <div>
                    <label className="form-label flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold text-slate-200">
                        <i className="fas fa-heading text-cyan-400"></i>
                        <span>ওয়েলকাম টাইটেল (Headline Title)</span>
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">স্ক্রিনের বড় হেডিং</span>
                    </label>
                    <input
                      type="text"
                      className="input-modern font-bold text-sm text-cyan-300"
                      value={adminWelcomeTitle}
                      onChange={(e) => setAdminWelcomeTitle(e.target.value)}
                      placeholder="e.g. ওয়েলকাম RF SMM PANEL!"
                    />
                  </div>

                  {/* Speech & Announcement Textarea */}
                  <div>
                    <label className="form-label flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold text-slate-200">
                        <i className="fas fa-comment-dots text-amber-400"></i>
                        <span>
                          {adminAudioMode === 'custom'
                            ? 'স্ক্রিনের সাবটাইটেল টেক্সট (Screen Subtitle Text)'
                            : 'ওয়েলকাম বাংলা ভয়েস ও মেসেজ (Speech Voice & Subtitle Text)'}
                        </span>
                      </span>
                      <span className="text-[10px] text-amber-300 font-bold">
                        {adminAudioMode === 'custom' ? 'স্ক্রিনে প্রদর্শিত হবে' : 'স্পিকারে ঠিক এটিই বলবে'}
                      </span>
                    </label>
                    <textarea
                      rows={3}
                      className="input-modern text-sm font-medium leading-relaxed resize-none"
                      value={adminWelcomeText}
                      onChange={(e) => setAdminWelcomeText(e.target.value)}
                      placeholder="এখানে যা লিখবেন, অ্যাকাউন্টে ঢোকার পর ৩D স্ক্রিনে তা সুন্দরভাবে ভেসে উঠবে..."
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
                      <i className="fas fa-info-circle text-blue-400"></i>
                      <span>ইউজার অ্যাকাউন্টে লগইন করলে বা অ্যাপে ঢুকলে মাত্র ১ বার এই ভয়েসটি স্বয়ংক্রিয়ভাবে বাজবে।</span>
                    </p>
                  </div>

                  {/* Quick Preset Buttons */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 block mb-2">রেডিমেড প্রি-সেট মেসেজ (Quick Templates):</span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAdminWelcomeTitle('ওয়েলকাম RF SMM PANEL!');
                          setAdminWelcomeText('ওয়েলকাম টু আর এফ এসএমএম প্যানেল। বাংলাদেশের এক নম্বর সোশ্যাল মিডিয়া মার্কেটিং প্ল্যাটফর্মে আপনাকে স্বাগতম।');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                      >
                        🌟 প্রি-সেট ১: অফিসিয়াল স্বাগতম
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminWelcomeTitle('RF SMM - সুপার স্পিড প্যানেল');
                          setAdminWelcomeText('ওয়েলকাম টু আর এফ এসএমএম প্যানেল। অটোমেটিক সুপার ফাস্ট ডেলিভারি এবং ২৪ ঘন্টা ইনস্ট্যান্ট সাপোর্টে আপনাকে স্বাগতম।');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                      >
                        ⚡ প্রি-সেট ২: সুপার ফাস্ট সার্ভিস
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAdminWelcomeTitle('ধামাকা অফার চলছে!');
                          setAdminWelcomeText('ওয়েলকাম টু আর এফ এসএমএম প্যানেল। আমাদের প্যানেলে চলছে অবিশ্বাস্য ডিসকাউন্ট অফার। এখনই অর্ডার করুন!');
                        }}
                        className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
                      >
                        🔥 প্রি-সেট ৩: ধামাকা অফার
                      </button>
                    </div>
                  </div>

                  {/* Home Live Notice Ticker Text Area inside Welcome Tab */}
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="form-label mb-0 flex items-center gap-1.5 font-bold text-amber-300">
                        <i className="fas fa-bullhorn text-amber-400"></i>
                        <span>হোম স্ক্রলিং নোটিশ পরিবর্তন (Home Live Notice Ticker)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => handleSaveNoticeText()}
                        disabled={adminSavingNotice}
                        className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-lg text-xs font-black transition cursor-pointer active:scale-95 shadow"
                      >
                        {adminSavingNotice ? 'সেভ হচ্ছে...' : '💾 নোটিশ সেভ'}
                      </button>
                    </div>
                    <textarea
                      rows={2}
                      className="input-modern text-xs font-medium resize-none border-amber-500/30 focus:border-amber-400"
                      value={adminNoticeText}
                      onChange={(e) => setAdminNoticeText(e.target.value)}
                      placeholder="হোম স্ক্রিনের নোটিশ বারে যা স্ক্রল করবে..."
                    />
                    <p className="text-[10px] text-slate-300">
                      💡 এটি সরাসরি ইউজার প্যানেলের উপরে অ্যানিমেটেড হয়ে স্ক্রল করবে।
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="pt-3 border-t border-white/10 flex flex-wrap items-center gap-3">
                    {/* Save Button */}
                    <button
                      onClick={handleSaveWelcomeConfig}
                      disabled={adminSavingWelcome}
                      className="flex-1 min-w-[180px] py-3 px-5 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-600 text-white font-extrabold text-xs sm:text-sm shadow-lg hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {adminSavingWelcome ? (
                        <>
                          <i className="fas fa-spinner fa-spin"></i>
                          <span>সেভ হচ্ছে...</span>
                        </>
                      ) : (
                        <>
                          <i className="fas fa-save text-emerald-300"></i>
                          <span>💾 পরিবর্তন সেভ করুন (Save Settings)</span>
                        </>
                      )}
                    </button>

                    {/* Test Voice / Audio Button */}
                    {adminAudioMode === 'custom' && adminCustomAudioUrl ? (
                      <button
                        onClick={handleTogglePlayCustomAudio}
                        className="py-3 px-4 rounded-xl bg-purple-900/80 hover:bg-purple-800 text-purple-200 border border-purple-500/40 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow cursor-pointer"
                      >
                        <i className={`fas ${adminAudioPlaying ? 'fa-pause' : 'fa-play'} text-amber-300`}></i>
                        <span>{adminAudioPlaying ? 'অডিও থামান' : '🎵 অডিও ফাইল শুনুন'}</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => handleTestSpeech(adminWelcomeText)}
                        className="py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow cursor-pointer"
                      >
                        <i className="fas fa-play text-amber-300"></i>
                        <span>🔊 TTS ভয়েস শুনুন</span>
                      </button>
                    )}

                    {/* Fullscreen 3D Test */}
                    <button
                      onClick={() => setShowWelcomeModal(true)}
                      className="py-3 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white border border-purple-400/30 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition active:scale-95 shadow cursor-pointer"
                    >
                      <i className="fas fa-cube text-cyan-300"></i>
                      <span>🎉 ৩D ফুলস্ক্রিন প্রিভিউ</span>
                    </button>
                  </div>
                </div>
              )}

              {/* SUB TAB 7: SETTINGS & BACKUP */}
              {adminSubTab === 'settings' && (
                <div className="space-y-4">
                  {/* HOME PAGE & SITE LOGO CHANGER CARD */}
                  <div className="glass-card p-5 space-y-4 border border-amber-500/40 bg-gradient-to-br from-amber-950/20 via-slate-900/90 to-slate-900/90 shadow-[0_4px_25px_rgba(245,158,11,0.15)] rounded-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-500 flex items-center justify-center text-slate-950 text-lg font-black shadow-lg">
                          <i className="fas fa-image"></i>
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-white flex items-center gap-2">
                            <span>হোম পেইজের লোগো পরিবর্তন ও আপলোড (Site Logo)</span>
                            <span className="text-[9px] bg-amber-500/25 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/40 font-mono font-bold">
                              BRAND LOGO
                            </span>
                          </h3>
                          <p className="text-[11px] text-slate-300">
                            এখানে নতুন লোগো ছবি আপলোড বা ইমেজ লিঙ্ক বসালে তা স্বয়ংক্রিয়ভাবে হোম পেইজ ও ওয়েলকাম মডালে সেট হয়ে যাবে।
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Logo Live Preview & Upload Zone */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                      {/* Live Preview Box */}
                      <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/50 border border-amber-500/30 text-center">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">
                          বর্তমান লোগো প্রিভিউ (Live Preview)
                        </span>
                        <div className="w-24 h-24 rounded-2xl bg-gradient-to-b from-slate-900 to-slate-950 border border-amber-400/40 flex items-center justify-center p-2 shadow-inner overflow-hidden relative group">
                          {(adminSiteLogoInput.trim() || adminSiteLogo) ? (
                            <img
                              src={adminSiteLogoInput.trim() || adminSiteLogo}
                              alt="Site Logo Preview"
                              className="max-w-full max-h-full object-contain drop-shadow-[0_0_10px_rgba(251,191,36,0.6)]"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center text-amber-400">
                              <i className="fas fa-crown text-2xl mb-1"></i>
                              <span className="text-[10px] font-black tracking-wider">RF SMM</span>
                              <span className="text-[8px] text-slate-400">ডিফল্ট লোগো</span>
                            </div>
                          )}
                        </div>
                        {(adminSiteLogoInput || adminSiteLogo) && (
                          <button
                            type="button"
                            onClick={() => {
                              setAdminSiteLogo('');
                              setAdminSiteLogoInput('');
                              handleSaveSiteLogo('');
                            }}
                            className="mt-2 text-[10px] text-red-400 hover:text-red-300 underline font-semibold cursor-pointer"
                          >
                            <i className="fas fa-trash-alt mr-1"></i>লোগো রিসেট (ডিফল্টে ফিরুন)
                          </button>
                        )}
                      </div>

                      {/* Upload Options & Link Input */}
                      <div className="md:col-span-2 space-y-3">
                        {/* Option A: File Upload (From Phone/Computer) */}
                        <div>
                          <label className="text-xs font-bold text-slate-200 block mb-1.5 flex items-center gap-1.5">
                            <i className="fas fa-file-upload text-cyan-400"></i>
                            <span>১. মোবাইল / কম্পিউটার থেকে নতুন লোগো ছবি আপলোড করুন:</span>
                          </label>
                          <label className="flex items-center justify-center gap-2 w-full p-3 rounded-xl border-2 border-dashed border-cyan-500/40 hover:border-cyan-400 bg-cyan-950/20 hover:bg-cyan-950/30 cursor-pointer transition active:scale-[0.99] text-cyan-300">
                            <i className="fas fa-cloud-upload-alt text-lg"></i>
                            <span className="text-xs font-extrabold">গ্যালারি থেকে লোগো সিলেক্ট করুন (PNG, JPG, SVG, WebP)</span>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={handleLogoFileUpload}
                            />
                          </label>
                        </div>

                        {/* Option B: Image URL */}
                        <div>
                          <label className="text-xs font-bold text-slate-200 block mb-1.5 flex items-center gap-1.5">
                            <i className="fas fa-link text-amber-400"></i>
                            <span>২. অথবা সরাসরি ছবির লিঙ্ক (Image URL) দিন:</span>
                          </label>
                          <input
                            type="url"
                            className="input-modern text-xs"
                            placeholder="https://example.com/logo.png"
                            value={adminSiteLogoInput}
                            onChange={(e) => setAdminSiteLogoInput(e.target.value)}
                          />
                        </div>

                        {/* Save Button */}
                        <div className="pt-1 flex gap-2">
                          <button
                            onClick={() => handleSaveSiteLogo()}
                            disabled={adminSavingLogo}
                            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 text-slate-950 font-black text-xs shadow-[0_4px_15px_rgba(245,158,11,0.3)] hover:brightness-110 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer"
                          >
                            {adminSavingLogo ? (
                              <>
                                <i className="fas fa-spinner fa-spin"></i>
                                <span>সেভ হচ্ছে...</span>
                              </>
                            ) : (
                              <>
                                <i className="fas fa-check-circle text-slate-950"></i>
                                <span>💾 লোগো সেভ করুন (Save New Logo)</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Embedded Welcome Voice & Master Sound Controls in Settings */}
                  <div className="glass-card p-5 space-y-4 border border-cyan-500/30">
                    <div className="flex items-center justify-between pb-2 border-b border-white/10">
                      <h3 className="font-extrabold text-xs text-white flex items-center gap-2">
                        <i className="fas fa-volume-up text-cyan-400"></i>
                        <span>3D ওয়েলকাম ভয়েস, সাউন্ড ও ফিচার কন্ট্রোল</span>
                      </h3>
                      <button
                        onClick={() => setAdminSubTab('welcome')}
                        className="text-[11px] text-cyan-300 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <span>সম্পূর্ণ এডিটর খুলুন</span>
                        <i className="fas fa-arrow-right text-[9px]"></i>
                      </button>
                    </div>

                    {/* Quick On/Off Sound and Feature Buttons */}
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickToggleFeature('soundEnabled', !adminSoundEnabled)}
                        className={`p-2.5 rounded-xl text-left border transition flex items-center justify-between cursor-pointer ${
                          adminSoundEnabled
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-red-500/10 border-red-500/30 text-red-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <i className={`fas ${adminSoundEnabled ? 'fa-volume-up' : 'fa-volume-mute'}`}></i>
                          <span className="text-xs font-bold">ওয়েলকাম সাউন্ড</span>
                        </div>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black/40">
                          {adminSoundEnabled ? 'ON' : 'OFF'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickToggleFeature('enabled', !adminWelcomeEnabled)}
                        className={`p-2.5 rounded-xl text-left border transition flex items-center justify-between cursor-pointer ${
                          adminWelcomeEnabled
                            ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            : 'bg-red-500/10 border-red-500/30 text-red-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <i className="fas fa-window-restore"></i>
                          <span className="text-xs font-bold">ওয়েলকাম পপআপ</span>
                        </div>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black/40">
                          {adminWelcomeEnabled ? 'ON' : 'OFF'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickToggleFeature('show3DButton', !adminShow3DButton)}
                        className={`p-2.5 rounded-xl text-left border transition flex items-center justify-between cursor-pointer ${
                          adminShow3DButton
                            ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                            : 'bg-red-500/10 border-red-500/30 text-red-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <i className="fas fa-cube"></i>
                          <span className="text-xs font-bold">হেডার 3D বাটন</span>
                        </div>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black/40">
                          {adminShow3DButton ? 'ON' : 'OFF'}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleQuickToggleFeature('showNoticeTicker', !adminShowNoticeTicker)}
                        className={`p-2.5 rounded-xl text-left border transition flex items-center justify-between cursor-pointer ${
                          adminShowNoticeTicker
                            ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                            : 'bg-red-500/10 border-red-500/30 text-red-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <i className="fas fa-bullhorn"></i>
                          <span className="text-xs font-bold">নোটিশ বার</span>
                        </div>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black/40">
                          {adminShowNoticeTicker ? 'ON' : 'OFF'}
                        </span>
                      </button>
                    </div>

                    <div>
                      <label className="form-label text-slate-300">ওয়েলকাম ভয়েস টেক্সট (Speech Text)</label>
                      <textarea
                        rows={2}
                        className="input-modern text-xs resize-none"
                        value={adminWelcomeText}
                        onChange={(e) => setAdminWelcomeText(e.target.value)}
                        placeholder="ভয়েস মেসেজ লিখুন..."
                      />
                    </div>

                    <div>
                      <label className="form-label text-amber-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 font-bold">
                          <i className="fas fa-bullhorn text-amber-400"></i>
                          <span>হোম পেইজের স্ক্রলিং নোটিশ (Live Notice Ticker Text)</span>
                        </span>
                      </label>
                      <textarea
                        rows={2}
                        className="input-modern text-xs resize-none border-amber-500/30 focus:border-amber-400"
                        value={adminNoticeText}
                        onChange={(e) => setAdminNoticeText(e.target.value)}
                        placeholder="হোম স্ক্রিনে যে নোটিশটি স্ক্রল করবে..."
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleSaveWelcomeConfig}
                        disabled={adminSavingWelcome}
                        className="btn-primary-gradient py-2 px-4 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <i className="fas fa-save"></i>
                        <span>{adminSavingWelcome ? 'সেভ হচ্ছে...' : 'সেটিংস ও নোটিশ সেভ করুন'}</span>
                      </button>
                      <button
                        onClick={() => handleTestSpeech(adminWelcomeText)}
                        className="btn-secondary-solid py-2 px-3 text-xs font-bold flex items-center gap-1.5 text-cyan-300 cursor-pointer"
                      >
                        <i className="fas fa-play text-amber-300"></i>
                        <span>ভয়েস টেস্ট</span>
                      </button>
                    </div>
                  </div>

                  {/* TELEGRAM LIVE ORDER NOTIFICATION STATUS & TEST */}
                  <div className="glass-card p-5 space-y-4 border border-sky-500/40 bg-gradient-to-br from-sky-950/30 via-slate-900/90 to-slate-900/90 shadow-[0_4px_25px_rgba(14,165,233,0.15)] rounded-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-500 flex items-center justify-center text-white text-lg font-black shadow-lg">
                          <i className="fab fa-telegram-plane"></i>
                        </div>
                        <div>
                          <h3 className="font-black text-sm text-white flex items-center gap-2">
                            <span>টেলিগ্রাম লাইভ অর্ডার নোটিফিকেশন (২টি চ্যানেল)</span>
                            <span className="text-[9px] bg-emerald-500/25 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/40 font-mono font-bold">
                              LIVE ACTIVE
                            </span>
                          </h3>
                          <p className="text-[11px] text-slate-300">
                            যেকোনো ইউজার অর্ডার করার সাথে সাথে লোগো, অর্ডার আইডি, সার্ভিস ও কাস্টমার ডিটেইলস সহ সরাসরি ২ টি চ্যানেলে স্টাইলিশ পোস্ট যাবে।
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-3 rounded-xl bg-slate-800/80 border border-white/10 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400">চ্যানেল ১ (Official Admin):</span>
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded">সংযুক্ত</span>
                        </div>
                        <a
                          href="https://t.me/RF2_SMM"
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-sky-400 hover:underline flex items-center gap-1.5"
                        >
                          <i className="fab fa-telegram"></i>
                          <span>@RF2_SMM</span>
                        </a>
                      </div>

                      <div className="p-3 rounded-xl bg-slate-800/80 border border-white/10 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400">চ্যানেল ২ (Farju SMM Channel):</span>
                          <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-1.5 py-0.5 rounded">সংযুক্ত</span>
                        </div>
                        <a
                          href="https://t.me/FARJU_SMM_PANAL"
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-bold text-sky-400 hover:underline flex items-center gap-1.5"
                        >
                          <i className="fab fa-telegram"></i>
                          <span>@FARJU_SMM_PANAL</span>
                        </a>
                      </div>
                    </div>

                    <div className="p-3 rounded-xl bg-slate-950/60 border border-white/5 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-[11px] text-slate-300">
                        <span className="text-slate-400">বট আইডি:</span> <code className="text-sky-300 font-mono">@Turbo_DownloaderBot</code>
                      </div>
                      <button
                        type="button"
                        onClick={async () => {
                          showToast('টেলিগ্রামে টেস্ট পোস্ট পাঠানো হচ্ছে...', 'info');
                          try {
                            const resp = await fetch('/api/telegram/order-notify', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                orderId: 'TEST-' + Math.floor(100000 + Math.random() * 900000),
                                apiOrderId: '98412',
                                serviceName: 'Facebook Page Followers | High Speed',
                                category: 'Facebook Services',
                                quantity: 1000,
                                cost: 55.0,
                                link: 'https://facebook.com/rf.smm.official',
                                userName: currentUser?.displayName || 'Farju Admin',
                                userEmail: currentUser?.email || 'farju@gmail.com',
                                status: 'Processing ⚡',
                                createdAt: new Date().toISOString(),
                                siteLogo: adminSiteLogo || welcomeConfig.siteLogo || '',
                              })
                            });
                            const dt = await resp.json();
                            if (dt.success) {
                              haptic('success');
                              showToast('✅ @RF2_SMM ও @FARJU_SMM_PANAL চ্যানেলে লাইভ নোটিফিকেশন সফল হয়েছে!', 'success');
                            } else {
                              showToast('ত্রুটি: ' + (dt.error || 'Failed'), 'error');
                            }
                          } catch (e: any) {
                            showToast('Error: ' + e.message, 'error');
                          }
                        }}
                        className="btn-primary-gradient py-2 px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white"
                      >
                        <i className="fas fa-paper-plane"></i>
                        <span>টেস্ট নোটিফিকেশন পাঠান (Send Test)</span>
                      </button>
                    </div>
                  </div>

                  <div className="glass-card p-5 space-y-4">
                    <h3 className="font-extrabold text-xs text-white flex items-center gap-2">
                      <i className="fas fa-sliders-h text-blue-400"></i>
                      <span>SMM Panel API Configuration</span>
                    </h3>

                    <div>
                      <label className="form-label">SMMGen API Key</label>
                      <input
                        type="text"
                        className="input-modern font-mono text-xs"
                        defaultValue="64994346bbbbeeaa10307df325162283"
                        disabled
                      />
                    </div>

                    <div>
                      <label className="form-label">API Base URL</label>
                      <input
                        type="text"
                        className="input-modern font-mono text-xs"
                        defaultValue="https://my.smmgen.com/api/v2"
                        disabled
                      />
                    </div>

                    <div className="pt-2 border-t border-white/10">
                      <h4 className="font-extrabold text-xs text-white mb-2">Data Export & Backup</h4>
                      <button
                        onClick={handleExportBackup}
                        className="btn-secondary-solid py-2 text-xs flex items-center justify-center gap-2"
                      >
                        <i className="fas fa-download"></i>
                        <span>DOWNLOAD FULL PANEL BACKUP (JSON)</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB TAB 8: TASKS & SCREENSHOT PROOFS */}
              {adminSubTab === 'tasks' && (
                <div className="space-y-5">
                  {/* Admin Tasks Header Banner */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/60 via-yellow-900/40 to-slate-900 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-base">
                        <i className="fas fa-tasks"></i>
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-white">Task Proofs & Screenshots (প্রুফ ও স্ক্রিনশট রিভিউ)</h3>
                        <p className="text-[10px] text-amber-200/80">ইউজারদের জমা দেওয়া টাস্ক প্রুফ ও সর্বোচ্চ ৫টি স্ক্রিনশট রিভিউ করে রিওয়ার্ড এপ্রুভ করুন</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-400 bg-black/40 px-3 py-1.5 rounded-xl border border-amber-500/20">
                      <span>Pending Reviews:</span>
                      <span className="text-white bg-amber-500 px-2 py-0.5 rounded-md text-[11px] text-black font-black">
                        {allTaskSubmissions.filter((s) => s.status === 'Pending').length}
                      </span>
                    </div>
                  </div>

                  {/* Section 1: Task Proof Submissions Review */}
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h4 className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-2">
                        <span>User Task Submissions ({allTaskSubmissions.length})</span>
                      </h4>

                      {/* Filter Buttons */}
                      <div className="flex bg-slate-900 p-1 rounded-xl border border-white/10 gap-1 text-[11px]">
                        {(['all', 'Pending', 'Approved', 'Rejected'] as const).map((f) => (
                          <button
                            key={f}
                            onClick={() => setAdminTaskFilter(f)}
                            className={`px-2.5 py-1 rounded-lg font-extrabold transition ${
                              adminTaskFilter === f
                                ? 'bg-amber-500 text-black shadow'
                                : 'text-slate-400 hover:text-white'
                            }`}
                          >
                            {f === 'all' ? 'All' : f}
                          </button>
                        ))}
                      </div>
                    </div>

                    {allTaskSubmissions.filter((s) => (adminTaskFilter === 'all' ? true : s.status === adminTaskFilter)).length === 0 ? (
                      <div className="glass-card p-8 text-center">
                        <i className="fas fa-file-circle-xmark text-3xl text-slate-600 mb-2"></i>
                        <p className="text-xs font-bold text-slate-400">No task submissions found in this filter.</p>
                      </div>
                    ) : (
                      allTaskSubmissions
                        .filter((s) => (adminTaskFilter === 'all' ? true : s.status === adminTaskFilter))
                        .map((sub, subIdx) => {
                          return (
                            <div
                              key={`${sub.id || 'sub'}-${subIdx}`}
                              className={`glass-card p-4 space-y-3 border transition-all ${
                                sub.status === 'Pending'
                                  ? 'border-amber-500/40 bg-amber-950/10'
                                  : sub.status === 'Approved'
                                  ? 'border-emerald-500/30'
                                  : 'border-red-500/30'
                              }`}
                            >
                              {/* Header info */}
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-xl bg-slate-800 border border-white/10 flex items-center justify-center text-amber-400 font-extrabold text-xs">
                                    <i className="fas fa-user-check"></i>
                                  </div>
                                  <div>
                                    <h4 className="font-extrabold text-xs text-white flex items-center gap-1.5">
                                      <span>{sub.userName || 'User'}</span>
                                      <span className="font-mono text-[9px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded">
                                        UID: {sub.userId ? sub.userId.slice(0, 8) : 'N/A'}
                                      </span>
                                    </h4>
                                    <p className="text-[10px] text-amber-300 font-semibold">{sub.taskTitle}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-black text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                    +৳ {sub.reward}
                                  </span>
                                  <span
                                    className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase border ${
                                      sub.status === 'Approved'
                                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                        : sub.status === 'Pending'
                                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/30 animate-pulse'
                                        : 'bg-red-500/20 text-red-400 border-red-500/30'
                                    }`}
                                  >
                                    {sub.status}
                                  </span>
                                </div>
                              </div>

                              {/* User Submitted Proof Text */}
                              {sub.proofText && (
                                <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-xs text-slate-300 space-y-1">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                                    <i className="fas fa-comment-dots text-amber-400 mr-1"></i> User Submitted Note / ID:
                                  </span>
                                  <p className="font-mono text-white whitespace-pre-wrap select-all">{sub.proofText}</p>
                                </div>
                              )}

                              {/* Screenshots Gallery Grid (Up to 5 Screenshots) */}
                              <div>
                                <span className="text-[10px] font-extrabold text-slate-300 flex items-center gap-1.5 mb-2">
                                  <i className="fas fa-images text-amber-400"></i>
                                  <span>Submitted Screenshots ({sub.screenshots ? sub.screenshots.length : 0} / 5):</span>
                                  <span className="text-[9px] text-slate-400 font-normal">(Click image to zoom full screen)</span>
                                </span>

                                {!sub.screenshots || sub.screenshots.length === 0 ? (
                                  <div className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-center text-xs text-slate-500">
                                    No screenshot images attached
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                                    {sub.screenshots.map((imgSrc, imgIdx) => (
                                      <div
                                        key={imgIdx}
                                        onClick={() => setSelectedScreenshotPreview(imgSrc)}
                                        className="group relative aspect-video sm:aspect-square bg-slate-950 rounded-xl overflow-hidden border border-amber-500/30 hover:border-amber-400 cursor-pointer shadow transition active:scale-95"
                                      >
                                        <img
                                          src={imgSrc}
                                          alt={`Screenshot ${imgIdx + 1}`}
                                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                                        />
                                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                                          <i className="fas fa-search-plus text-white text-base"></i>
                                        </div>
                                        <span className="absolute bottom-1 right-1 bg-black/80 text-[8px] font-mono text-amber-300 px-1.5 py-0.5 rounded font-bold">
                                          #{imgIdx + 1}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>

                              {/* Submission Date & Admin Actions */}
                              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5 text-[10px] text-slate-400">
                                <span className="font-mono">Submitted: {sub.submittedAt || 'Recently'}</span>

                                {sub.status === 'Pending' && (
                                  <div className="flex gap-2 w-full sm:w-auto">
                                    <button
                                      onClick={() => handleApproveTaskSubmission(sub)}
                                      className="flex-1 sm:flex-initial px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs rounded-xl shadow transition active:scale-95 flex items-center justify-center gap-1.5"
                                    >
                                      <i className="fas fa-check-circle"></i>
                                      <span>APPROVE & CREDIT (৳{sub.reward})</span>
                                    </button>
                                    <button
                                      onClick={() => handleRejectTaskSubmission(sub.id)}
                                      className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/30 font-bold text-xs rounded-xl transition active:scale-95 flex items-center justify-center gap-1"
                                    >
                                      <i className="fas fa-times-circle"></i>
                                      <span>REJECT</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>

                  {/* Section 2: Create & Manage Custom Tasks */}
                  <div className="glass-card p-4 space-y-4">
                    <h4 className="font-extrabold text-xs text-white uppercase tracking-wider flex items-center gap-2">
                      <i className="fas fa-plus-circle text-amber-400"></i>
                      <span>Add New System Task (নতুন টাস্ক যোগ করুন)</span>
                    </h4>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="form-label">Task Title (টাস্ক এর নাম)</label>
                        <input
                          type="text"
                          className="input-modern text-xs"
                          placeholder="e.g. YouTube Channel Subscribe"
                          value={newTaskTitle}
                          onChange={(e) => setNewTaskTitle(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="form-label">Reward Amount (রিওয়ার্ড ৳)</label>
                        <input
                          type="number"
                          className="input-modern text-xs font-mono"
                          placeholder="e.g. 5"
                          value={newTaskReward}
                          onChange={(e) => setNewTaskReward(e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="form-label">Task Link (টাস্ক এর লিঙ্ক)</label>
                      <input
                        type="text"
                        className="input-modern text-xs font-mono"
                        placeholder="e.g. https://youtube.com/c/yourchannel"
                        value={newTaskLink}
                        onChange={(e) => setNewTaskLink(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="form-label">Task Description & Instructions</label>
                      <textarea
                        rows={2}
                        className="input-modern text-xs resize-none"
                        placeholder="e.g. চ্যানেল সাবস্ক্রাইব করে বেল আইকন অন করে ৫টি স্ক্রিনশট পর্যন্ত প্রুফ আপলোড দিন।"
                        value={newTaskDesc}
                        onChange={(e) => setNewTaskDesc(e.target.value)}
                      />
                    </div>

                    {/* Task Image / Banner File Upload Field */}
                    <div className="space-y-2 p-3 bg-black/40 rounded-2xl border border-white/10">
                      <div className="flex justify-between items-center text-xs">
                        <label className="font-extrabold text-white flex items-center gap-1.5">
                          <i className="fas fa-image text-amber-400"></i>
                          <span>Task Image / Banner (টাস্ক এর ছবি বা ব্যানার আপলোড)</span>
                        </label>
                        {newTaskImage && (
                          <button
                            onClick={() => setNewTaskImage(null)}
                            className="text-[10px] text-red-400 hover:underline font-bold"
                          >
                            Remove Image
                          </button>
                        )}
                      </div>

                      {newTaskImage ? (
                        <div className="relative aspect-video w-full rounded-xl overflow-hidden border border-amber-500/40 bg-slate-950">
                          <img src={newTaskImage} alt="Task Banner Preview" className="w-full h-full object-cover" />
                          <button
                            onClick={() => setNewTaskImage(null)}
                            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 text-white flex items-center justify-center text-xs shadow hover:scale-110 transition"
                          >
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                      ) : (
                        <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-amber-500/30 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/10 rounded-xl transition cursor-pointer text-center">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleAdminTaskImageUpload}
                            className="hidden"
                          />
                          <i className="fas fa-file-image text-amber-400 text-xl mb-1"></i>
                          <span className="text-xs font-bold text-white">ক্লিক করে টাস্ক এর ছবি আপলোড করুন</span>
                          <span className="text-[9px] text-slate-400">(Upload image/banner for this task)</span>
                        </label>
                      )}
                    </div>

                    <button
                      onClick={handleCreateAdminTask}
                      className="btn-primary-solid py-2.5 text-xs w-full flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-plus text-xs"></i>
                      <span>CREATE & PUBLISH TASK</span>
                    </button>

                    {/* Active System Tasks List */}
                    <div className="pt-3 border-t border-white/10 space-y-2">
                      <h5 className="font-extrabold text-xs text-slate-300">Current Active Tasks ({customTasks.length})</h5>
                      <div className="space-y-2">
                        {customTasks.map((task, taskIdx) => (
                          <div key={`${task.id || 'task'}-${taskIdx}`} className="p-3 rounded-xl bg-slate-900/80 border border-white/5 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5">
                              {task.image ? (
                                <img
                                  src={task.image}
                                  alt={task.title}
                                  onClick={() => setSelectedScreenshotPreview(task.image!)}
                                  className="w-10 h-10 rounded-xl object-cover border border-amber-500/40 cursor-pointer hover:scale-105 transition"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs">
                                  <i className={task.icon || 'fas fa-tasks'}></i>
                                </div>
                              )}
                              <div>
                                <h6 className="font-bold text-xs text-white">{task.title}</h6>
                                <span className="text-[10px] text-emerald-400 font-mono font-bold">Reward: ৳{task.reward}</span>
                              </div>
                            </div>

                            <button
                              onClick={() => handleDeleteAdminTask(task.id)}
                              className="w-7 h-7 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 flex items-center justify-center text-xs transition"
                              title="Delete Task"
                            >
                              <i className="fas fa-trash-alt"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUB TAB: REFERRAL & COMMISSION MANAGEMENT */}
              {adminSubTab === 'referrals' && (
                <div className="space-y-5">
                  {/* Referral Header Banner */}
                  <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/70 via-yellow-900/40 to-slate-900 border border-amber-500/40 flex flex-wrap items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-lg shadow-inner">
                        <i className="fas fa-gift"></i>
                      </div>
                      <div>
                        <h3 className="font-black text-sm text-white flex items-center gap-2">
                          <span>Referral Bonus System (রেফারেল ও ডিপোজিট বোনাস কন্ট্রোল)</span>
                          <span className="text-[9px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded border border-emerald-500/30">
                            {referralConfig.enabled ? 'ACTIVE ⚡' : 'DISABLED'}
                          </span>
                        </h3>
                        <p className="text-[10px] text-amber-200/80">
                          রেফারেল লিংক দিয়ে যুক্ত ইউজার যেকোনো পরিমাণ ডিপোজিট করলে ইনভাইটার স্বয়ংক্রিয়ভাবে {referralConfig.bonusPercent || 10}% কমিশন পাবে
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-300 bg-black/50 px-3 py-1.5 rounded-xl border border-amber-500/30">
                      <span>Total Commissions Paid:</span>
                      <span className="text-emerald-400 font-black">
                        ৳{allReferralCommissions.reduce((acc, c) => acc + (c.commissionAmount || 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* Settings Control Cards */}
                  <div className="glass-card p-4 space-y-4 border border-amber-500/20">
                    <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
                      <i className="fas fa-sliders text-amber-400"></i>
                      <span>Referral System Configuration (কনফিগারেশন)</span>
                    </h4>

                    {/* 1. Referral Website Link Control */}
                    <div className="p-4 rounded-2xl bg-slate-900/90 border border-amber-500/30 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <label className="text-xs font-black text-white flex items-center gap-1.5">
                          <i className="fas fa-globe text-cyan-400"></i>
                          <span>Referral Website Base URL (রেফারেল ওয়েবসাইটের মূল লিংক)</span>
                        </label>
                        <span className="text-[10px] text-amber-300 font-mono">
                          {referralConfig.websiteUrl || window.location.origin}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        এডমিন প্যানেল থেকে আপনার কাস্টম ডোমেইন বা ওয়েবসাইটের লিংক দিন (যেমন: https://yourdomain.com)। ইউজারের রেফারেল লিংক এই লিংকের সাথে <code className="text-amber-300">?ref=username</code> আকারে তৈরি হবে।
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="url"
                          className="input-modern text-xs font-mono text-cyan-300 flex-1"
                          placeholder={window.location.origin}
                          value={referralConfig.websiteUrl || ''}
                          onChange={(e) => {
                            setReferralConfig((prev) => ({ ...prev, websiteUrl: e.target.value }));
                          }}
                        />
                        <button
                          onClick={() => {
                            setReferralConfig((prev) => ({ ...prev, websiteUrl: window.location.origin }));
                            showToast('Current site origin inserted!', 'info');
                          }}
                          type="button"
                          className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-white/10 transition whitespace-nowrap"
                        >
                          <i className="fas fa-crosshairs mr-1 text-cyan-400"></i> Use Current URL
                        </button>
                        <button
                          onClick={async () => {
                            try {
                              setAdminSavingReferralConfig(true);
                              const cleanUrl = (referralConfig.websiteUrl || '').trim();
                              await setDoc(doc(db, 'settings', 'referral_config'), {
                                ...referralConfig,
                                websiteUrl: cleanUrl
                              }, { merge: true });
                              showToast('✅ Referral Website URL saved successfully!', 'success');
                              haptic('success');
                            } catch (e: any) {
                              showToast('Error saving URL: ' + e.message, 'error');
                            } finally {
                              setAdminSavingReferralConfig(false);
                            }
                          }}
                          disabled={adminSavingReferralConfig}
                          type="button"
                          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl shadow transition whitespace-nowrap"
                        >
                          {adminSavingReferralConfig ? <span className="loading-spinner"></span> : <span><i className="fas fa-save mr-1"></i> Save URL</span>}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* 2. System Active Status */}
                      <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-white/10 space-y-2">
                        <label className="text-xs font-extrabold text-white flex items-center justify-between">
                          <span>System Active Status</span>
                          <span className={referralConfig.enabled ? 'text-emerald-400 font-black' : 'text-red-400 font-black'}>
                            {referralConfig.enabled ? 'Enabled ⚡' : 'Disabled ⛔'}
                          </span>
                        </label>
                        <p className="text-[10px] text-slate-400">Enable or pause automatic referral commission payout on deposit approval.</p>
                        <button
                          onClick={async () => {
                            try {
                              const newStatus = !referralConfig.enabled;
                              await setDoc(doc(db, 'settings', 'referral_config'), {
                                ...referralConfig,
                                enabled: newStatus
                              }, { merge: true });
                              setReferralConfig(prev => ({ ...prev, enabled: newStatus }));
                              showToast(`Referral system ${newStatus ? 'enabled' : 'disabled'}!`, 'success');
                              haptic('success');
                            } catch (e: any) {
                              showToast('Error updating status: ' + e.message, 'error');
                            }
                          }}
                          className={`w-full py-2.5 px-3 rounded-xl font-black text-xs transition flex items-center justify-center gap-2 ${
                            referralConfig.enabled
                              ? 'bg-red-500/20 text-red-300 border border-red-500/40 hover:bg-red-500/30'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30'
                          }`}
                        >
                          <i className={`fas ${referralConfig.enabled ? 'fa-pause' : 'fa-play'}`}></i>
                          <span>{referralConfig.enabled ? 'Pause Referral System' : 'Activate Referral System'}</span>
                        </button>
                      </div>

                      {/* 3. Commission Percentage */}
                      <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-white/10 space-y-2">
                        <label className="text-xs font-extrabold text-white flex items-center justify-between">
                          <span>Commission Percentage (% বোনাস হার)</span>
                          <span className="text-amber-400 font-mono font-bold text-sm">{referralConfig.bonusPercent}%</span>
                        </label>
                        <p className="text-[10px] text-slate-400">যেকোনো ডিপোজিট অনুমোদনের পর ইনভাইটার এই হারে কমিশন পাবে।</p>
                        
                        {/* Preset Quick Chips */}
                        <div className="flex gap-1.5 mb-1">
                          {[5, 10, 15, 20].map((pct) => (
                            <button
                              key={pct}
                              type="button"
                              onClick={() => setReferralConfig((prev) => ({ ...prev, bonusPercent: pct }))}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold transition border ${
                                referralConfig.bonusPercent === pct
                                  ? 'bg-amber-500 text-black border-amber-400 shadow'
                                  : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                              }`}
                            >
                              {pct}%
                            </button>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            className="input-modern text-xs font-mono font-bold text-amber-300 py-1.5"
                            value={referralConfig.bonusPercent}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setReferralConfig(prev => ({ ...prev, bonusPercent: val }));
                            }}
                          />
                          <button
                            onClick={async () => {
                              try {
                                await setDoc(doc(db, 'settings', 'referral_config'), {
                                  ...referralConfig,
                                  bonusPercent: referralConfig.bonusPercent || 10
                                }, { merge: true });
                                showToast(`✅ Referral bonus set to ${referralConfig.bonusPercent}%!`, 'success');
                                haptic('success');
                              } catch (e: any) {
                                showToast('Error: ' + e.message, 'error');
                              }
                            }}
                            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl shadow transition whitespace-nowrap"
                          >
                            Save %
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section: Referral Commission History Log */}
                  <div className="glass-card p-4 space-y-3 border border-white/5">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2">
                        <i className="fas fa-history text-amber-400"></i>
                        <span>Referral Payout History (রেফারেল কমিশন হিস্টোরি)</span>
                      </h4>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {allReferralCommissions.length} records
                      </span>
                    </div>

                    {allReferralCommissions.length === 0 ? (
                      <div className="p-4 rounded-xl bg-slate-900/60 border border-white/5 text-center text-xs text-slate-400">
                        No referral commissions logged yet.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {allReferralCommissions.map((comm, commIdx) => (
                          <div
                            key={`${comm.id || "comm"}-${commIdx}`}
                            className="p-3 rounded-xl bg-slate-900/80 border border-white/5 flex flex-wrap items-center justify-between gap-2 text-xs"
                          >
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-white">@{comm.referrerUsername}</span>
                                <span className="text-[10px] text-slate-400">earned from</span>
                                <span className="font-bold text-amber-300">@{comm.referredUsername}</span>
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Deposit: ৳{comm.depositAmount} ({comm.bonusPercent}%) •{' '}
                                {comm.timestamp?.toDate
                                  ? comm.timestamp.toDate().toLocaleString()
                                  : 'Recently'}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-mono font-black text-emerald-400">
                                +৳{comm.commissionAmount.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            
              {/* SUB TAB: AI & LIVE SUPPORT INBOX */}
              {adminSubTab === 'support' && (
                <AdminLiveSupportPanel
                  aiSupportEnabled={welcomeConfig.aiSupportEnabled !== false}
                  onToggleAiSupport={async (enabled) => {
                    setWelcomeConfig((prev) => ({ ...prev, aiSupportEnabled: enabled }));
                    try {
                      await setDoc(
                        doc(db, 'settings', 'welcome_config'),
                        { aiSupportEnabled: enabled, updatedAt: serverTimestamp() },
                        { merge: true }
                      );
                      showToast(
                        enabled
                          ? '✅ ইউজারদের জন্য লাইভ AI সাপোর্ট চালু করা হয়েছে (ON)'
                          : '⛔ ইউজারদের জন্য লাইভ AI সাপোর্ট বন্ধ করা হয়েছে (OFF - Hidden from users)',
                        enabled ? 'success' : 'info'
                      );
                    } catch (err: any) {
                      showToast('সেটিংস আপডেট ব্যর্থ: ' + err.message, 'error');
                    }
                  }}
                  showToast={showToast}
                  adminUser={currentUser}
                />
              )}
</section>
          )}

          {/* Floating 24/7 Live AI Support Button */}
          {welcomeConfig.aiSupportEnabled !== false && (
          <button
            onClick={() => {
              setShowAISupportModal(true);
              haptic('heavy');
            }}
            className="fixed bottom-20 right-4 sm:right-6 z-40 bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-black px-3.5 py-2.5 rounded-full shadow-[0_6px_25px_rgba(245,158,11,0.5)] border-2 border-slate-900 flex items-center gap-2 font-black text-xs transition-all duration-200 hover:scale-105 active:scale-95 group cursor-pointer"
            title="২৪/৭ লাইভ AI সাপোর্ট (Live AI Support)"
          >
            <div className="relative">
              <i className="fas fa-robot text-sm"></i>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-500 border border-black rounded-full animate-ping"></span>
            </div>
            <span className="tracking-tight font-extrabold">AI সাপোর্ট</span>
            <span className="px-1.5 py-0.2 bg-black/20 text-black text-[9px] font-mono rounded-full font-extrabold">LIVE</span>
          </button>
          )}

          {/* Bottom Floating Navigation Bar */}
          <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#070d1d]/90 backdrop-blur-xl border-t border-white/10 px-4 py-2 flex items-center justify-around max-w-lg mx-auto sm:rounded-t-2xl shadow-2xl">
            <button
              onClick={() => {
                setActiveTab('home');
                haptic('light');
              }}
              className={`flex flex-col items-center gap-1 transition ${
                activeTab === 'home' ? 'text-amber-400 scale-105' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className="fas fa-home text-base"></i>
              <span className="text-[10px] font-bold">Home</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('orders');
                haptic('light');
              }}
              className={`flex flex-col items-center gap-1 transition ${
                activeTab === 'orders' ? 'text-amber-400 scale-105' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className="fas fa-shopping-bag text-base"></i>
              <span className="text-[10px] font-bold">Orders</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('funds');
                haptic('heavy');
              }}
              className={`flex flex-col items-center gap-1 transition ${
                activeTab === 'funds' ? 'text-cyan-400 scale-105' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <div className="w-9 h-9 -mt-4 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-black flex items-center justify-center shadow-lg shadow-amber-500/30 border-2 border-[#070d1d]">
                <i className="fas fa-wallet text-sm"></i>
              </div>
              <span className="text-[10px] font-bold text-amber-300">Deposit</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('profile');
                haptic('light');
              }}
              className={`flex flex-col items-center gap-1 transition ${
                activeTab === 'profile' ? 'text-amber-400 scale-105' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <i className="fas fa-user text-base"></i>
              <span className="text-[10px] font-bold">Profile</span>
            </button>

            {isAdminUser && (
              <button
                onClick={() => {
                  setActiveTab(activeTab === 'admin' ? 'home' : 'admin');
                  haptic('heavy');
                }}
                className={`flex flex-col items-center gap-1 transition ${
                  activeTab === 'admin' ? 'text-amber-400 scale-105' : 'text-amber-500/70 hover:text-amber-400'
                }`}
              >
                <i className="fas fa-crown text-base"></i>
                <span className="text-[10px] font-bold">Admin</span>
              </button>
            )}
          </nav>

          {/* Screenshot Preview Modal */}
          {selectedScreenshotPreview && (
            <div
              onClick={() => setSelectedScreenshotPreview(null)}
              className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 cursor-zoom-out animate-in fade-in duration-200"
            >
              <div className="relative max-w-4xl max-h-[90vh] bg-slate-900 border border-white/20 rounded-2xl overflow-hidden shadow-2xl p-2">
                <img
                  src={selectedScreenshotPreview}
                  alt="Proof Screenshot"
                  className="w-full h-full object-contain max-h-[85vh] rounded-xl"
                />
                <button
                  type="button"
                  onClick={() => setSelectedScreenshotPreview(null)}
                  className="absolute top-4 right-4 bg-black/80 text-white rounded-full w-8 h-8 flex items-center justify-center border border-white/20 hover:bg-black transition"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            </div>
          )}

          {/* Change Password Modal */}
          {showChangePassModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
              <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-md w-full p-5 space-y-4 shadow-[0_10px_40px_rgba(0,0,0,0.8)] relative">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                      <i className="fas fa-lock"></i>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white">Change Password (পাসওয়ার্ড পরিবর্তন)</h3>
                      <p className="text-[10px] text-slate-400">নিরাপত্তার স্বার্থে নতুন পাসওয়ার্ড সেট করুন</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setShowChangePassModal(false);
                      setChangePassErr('');
                      setChangePassSuccess('');
                    }}
                    className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center text-xs transition"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                {/* Body Form */}
                <div className="space-y-3">
                  {changePassErr && (
                    <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs font-semibold flex items-center gap-2">
                      <i className="fas fa-exclamation-circle text-xs flex-shrink-0"></i>
                      <span>{changePassErr}</span>
                    </div>
                  )}

                  {changePassSuccess && (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-semibold flex items-center gap-2">
                      <i className="fas fa-check-circle text-xs flex-shrink-0"></i>
                      <span>{changePassSuccess}</span>
                    </div>
                  )}

                  <div>
                    <label className="form-label text-xs mb-1 text-slate-300">
                      Current Password (বর্তমান পাসওয়ার্ড)
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        className="auth-input pl-9"
                        placeholder="Enter current password"
                        value={currentPasswordInput}
                        onChange={(e) => setCurrentPasswordInput(e.target.value)}
                      />
                      <i className="fas fa-key absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                    </div>
                  </div>

                  <div>
                    <label className="form-label text-xs mb-1 text-slate-300">
                      New Password (নতুন পাসওয়ার্ড - কমপক্ষে ৬ অক্ষর)
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        className="auth-input pl-9"
                        placeholder="Enter new strong password"
                        value={newPasswordInput}
                        onChange={(e) => setNewPasswordInput(e.target.value)}
                      />
                      <i className="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                    </div>
                  </div>

                  <div>
                    <label className="form-label text-xs mb-1 text-slate-300">
                      Confirm New Password (নতুন পাসওয়ার্ড নিশ্চিত করুন)
                    </label>
                    <div className="relative">
                      <input
                        type="password"
                        className="auth-input pl-9"
                        placeholder="Re-enter new password"
                        value={confirmNewPasswordInput}
                        onChange={(e) => setConfirmNewPasswordInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleChangePassword()}
                      />
                      <i className="fas fa-shield-check absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                    </div>
                  </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/10">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePassModal(false);
                      setChangePassErr('');
                      setChangePassSuccess('');
                    }}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition"
                  >
                    Cancel / বাতিল
                  </button>
                  <button
                    type="button"
                    onClick={handleChangePassword}
                    disabled={changePassSubmitting}
                    className="btn-primary-solid px-5 py-2 text-xs font-black flex items-center gap-2"
                  >
                    {changePassSubmitting ? (
                      <>
                        <span className="loading-spinner"></span>
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-save text-xs"></i>
                        <span>Update Password / সেভ করুন</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Referral & 5% Bonus Modal */}
          {showReferralModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
              <div className="w-full max-w-md bg-gradient-to-b from-slate-900 via-slate-900 to-[#030712] border border-amber-500/40 rounded-3xl p-5 shadow-2xl text-white space-y-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-400 text-black flex items-center justify-center font-black text-lg shadow-lg shadow-amber-500/30">
                      <i className="fas fa-gift"></i>
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white flex items-center gap-1.5">
                        <span>রেফারেল ও ৫% ক্যাশ বোনাস</span>
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-500 text-black text-[9px] font-black">5% Active</span>
                      </h3>
                      <p className="text-[10px] text-slate-400">প্রতিটি ডিপোজিটে লাইফটাইম ৫% কমিশন পান</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowReferralModal(false)}
                    className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                {/* Live Stats Overview */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-slate-800/80 border border-white/5 p-2.5 rounded-2xl text-center">
                    <span className="text-[10px] text-slate-400 block">মোট রেফারেল</span>
                    <span className="text-base font-black font-mono text-amber-400">{userTotalReferrals}</span>
                    <span className="text-[9px] text-slate-400 block">জন মেম্বার</span>
                  </div>
                  <div className="bg-slate-800/80 border border-white/5 p-2.5 rounded-2xl text-center">
                    <span className="text-[10px] text-slate-400 block">মোট আয় (৫%)</span>
                    <span className="text-base font-black font-mono text-emerald-400">৳{userReferralEarnings.toFixed(2)}</span>
                    <span className="text-[9px] text-slate-400 block">কমিশন</span>
                  </div>
                  <div className="bg-slate-800/80 border border-white/5 p-2.5 rounded-2xl text-center">
                    <span className="text-[10px] text-slate-400 block">বোনাস হার</span>
                    <span className="text-base font-black font-mono text-yellow-400">{referralConfig.bonusPercent || 5}%</span>
                    <span className="text-[9px] text-slate-400 block">ইনস্ট্যান্ট ক্যাশ</span>
                  </div>
                </div>

                {/* Referral Link Box */}
                <div className="bg-slate-800/90 border border-amber-500/30 p-3.5 rounded-2xl space-y-2.5 shadow-inner">
                  <label className="text-xs font-bold text-amber-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <i className="fas fa-link text-[11px]"></i>
                      <span>আপনার রেফারেল লিংক</span>
                    </span>
                    <span className="text-[9px] text-emerald-400 font-normal">১ ক্লিকে কপি করুন</span>
                  </label>
                  
                  <div className="flex items-center gap-2 bg-black/50 border border-white/10 rounded-xl px-3 py-2">
                    <input
                      type="text"
                      readOnly
                      value={
                        referralConfig.websiteUrl
                          ? `${referralConfig.websiteUrl.replace(/\/+$/, '')}/?ref=${currentUser?.username || ''}`
                          : `${window.location.origin}/?ref=${currentUser?.username || ''}`
                      }
                      className="bg-transparent text-[11px] font-mono text-slate-200 outline-none w-full select-all"
                    />
                    <button
                      onClick={() => {
                        const link = referralConfig.websiteUrl
                          ? `${referralConfig.websiteUrl.replace(/\/+$/, '')}/?ref=${currentUser?.username || ''}`
                          : `${window.location.origin}/?ref=${currentUser?.username || ''}`;
                        navigator.clipboard.writeText(link);
                        showToast('✅ রেফারেল লিংক কপি করা হয়েছে!', 'success');
                        haptic('success');
                      }}
                      className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-lg shadow whitespace-nowrap active:scale-95 transition"
                    >
                      <i className="fas fa-copy mr-1"></i> Copy
                    </button>
                  </div>

                  {/* Referral Code Box */}
                  <div className="flex items-center justify-between bg-black/30 border border-white/5 rounded-xl px-3 py-2 text-xs">
                    <span className="text-slate-400">রেফারেল কোড: <strong className="text-white font-mono">{currentUser?.username || 'N/A'}</strong></span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(currentUser?.username || '');
                        showToast('✅ রেফারেল কোড কপি করা হয়েছে!', 'success');
                        haptic('success');
                      }}
                      className="text-amber-400 hover:text-amber-300 text-xs font-bold flex items-center gap-1"
                    >
                      <i className="fas fa-copy"></i> কপি কোড
                    </button>
                  </div>
                </div>

                {/* Social Share Buttons */}
                <div className="grid grid-cols-2 gap-2">
                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `🔥 RF SMM PANEL - বাংলাদেশের সেরা ও বিশ্বস্ত সোশ্যাল মিডিয়া মার্কেটিং প্ল্যাটফর্ম!\nলাইক, ফলোয়ার, ওয়াচটাইম নিন মাত্র কয়েক টাকায়।\n🎁 এখনই একাউন্ট খুলুন এবং ব্যালেন্স যোগ করুন:\n${
                        referralConfig.websiteUrl
                          ? `${referralConfig.websiteUrl.replace(/\/+$/, '')}/?ref=${currentUser?.username || ''}`
                          : `${window.location.origin}/?ref=${currentUser?.username || ''}`
                      }`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 px-3 bg-[#25D366]/20 hover:bg-[#25D366]/30 border border-[#25D366]/40 rounded-xl text-[#25D366] text-xs font-bold transition active:scale-95"
                  >
                    <i className="fab fa-whatsapp text-sm"></i>
                    <span>WhatsApp Share</span>
                  </a>

                  <a
                    href={`https://t.me/share/url?url=${encodeURIComponent(
                      referralConfig.websiteUrl
                        ? `${referralConfig.websiteUrl.replace(/\/+$/, '')}/?ref=${currentUser?.username || ''}`
                        : `${window.location.origin}/?ref=${currentUser?.username || ''}`
                    )}&text=${encodeURIComponent('🔥 RF SMM PANEL - বাংলাদেশের সেরা SMM প্ল্যাটফর্ম! এখনই যুক্ত হোন')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 py-2.5 px-3 bg-[#229ED9]/20 hover:bg-[#229ED9]/30 border border-[#229ED9]/40 rounded-xl text-[#229ED9] text-xs font-bold transition active:scale-95"
                  >
                    <i className="fab fa-telegram-plane text-sm"></i>
                    <span>Telegram Share</span>
                  </a>
                </div>

                {/* How It Works Guide */}
                <div className="bg-slate-800/50 border border-white/5 p-3 rounded-2xl space-y-2 text-xs">
                  <h4 className="font-extrabold text-amber-300 text-[11px] uppercase tracking-wider flex items-center gap-1.5">
                    <i className="fas fa-info-circle"></i>
                    <span>কীভাবে ৫% কমিশন পাবেন?</span>
                  </h4>
                  <ul className="space-y-1.5 text-[11px] text-slate-300">
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[9px] shrink-0 mt-0.5">১</span>
                      <span>আপনার রেফারেল লিংক অথবা ইউজারনেম কোড বন্ধুদের কাছে শেয়ার করুন।</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[9px] shrink-0 mt-0.5">২</span>
                      <span>বন্ধু আপনার লিংকের মাধ্যমে একাউন্ট খুলে বিকাশ/নগদ/রকেটে যেকোনো পরিমাণ ডিপোজিট করবে।</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-400 font-bold flex items-center justify-center text-[9px] shrink-0 mt-0.5">৩</span>
                      <span>ডিপোজিট অ্যাপ্রুভ হওয়ামাত্রই আপনি সাথে সাথে <strong>৫% ক্যাশ বোনাস</strong> সরাসরি আপনার মেইন একাউন্ট ব্যালেন্সে পেয়ে যাবেন!</span>
                    </li>
                  </ul>
                </div>

                {/* My Referral Commission History */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <i className="fas fa-history text-amber-400"></i>
                      <span>আমার কমিশন হিস্টোরি</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {userReferralCommissions.length} টি বোনাস
                    </span>
                  </div>

                  {userReferralCommissions.length === 0 ? (
                    <div className="p-3.5 rounded-2xl bg-slate-800/30 border border-white/5 text-center text-[11px] text-slate-400">
                      এখনো কোনো রেফারেল কমিশন যোগ হয়নি। বন্ধুদের ইনভাইট করুন এবং ৫% বোনাস অর্জন করুন!
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                      {userReferralCommissions.map((comm, commIdx) => (
                        <div
                          key={`${comm.id || "comm"}-${commIdx}`}
                          className="p-2.5 rounded-xl bg-slate-800/70 border border-white/5 flex items-center justify-between text-xs"
                        >
                          <div>
                            <div className="font-bold text-white text-[11px]">
                              @{comm.referredUsername || 'User'} এর ডিপোজিট থেকে
                            </div>
                            <div className="text-[10px] text-slate-400">
                              ডিপোজিট: ৳{comm.depositAmount} ({comm.bonusPercent}%) •{' '}
                              {comm.timestamp?.toDate
                                ? comm.timestamp.toDate().toLocaleDateString()
                                : 'সম্প্রতি'}
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-black text-emerald-400 font-mono text-xs block">
                              +৳{comm.commissionAmount.toFixed(2)}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold">
                              জমা হয়েছে
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Live AI Support Assistant Modal */}
          {showAISupportModal && (
            <LiveAISupportModal
              isOpen={showAISupportModal}
              onClose={() => setShowAISupportModal(false)}
              currentUser={currentUser}
              userBalance={userBalance}
              userTotalOrders={userTotalOrders}
              isSupportEnabled={welcomeConfig.aiSupportEnabled !== false}
              isAiAutoReplyEnabled={true}
              onNavigateToDeposit={() => setActiveTab('funds')}
              onNavigateToOrders={() => setActiveTab('orders')}
              onNavigateToReferral={() => setShowReferralModal(true)}
            />
          )}

          {/* Welcome Announcement Modal */}
          {showWelcomeModal && (
            <Welcome3DModal
              show={showWelcomeModal}
              userBalance={userBalance || 0}
              userTotalOrders={userTotalOrders || 0}
              welcomeTitle={welcomeConfig.title}
              welcomeText={welcomeConfig.text}
              audioMode={welcomeConfig.audioMode}
              customAudioUrl={welcomeConfig.customAudioUrl}
              soundEnabled={welcomeConfig.soundEnabled}
              siteLogo={adminSiteLogo || welcomeConfig.siteLogo}
              onClose={() => setShowWelcomeModal(false)}
              onNavigateToOrder={() => {
                setShowWelcomeModal(false);
                setActiveTab('home');
              }}
              onNavigateToDeposit={() => {
                setShowWelcomeModal(false);
                setActiveTab('funds');
              }}
            />
          )}

          {/* 3D Theme Customizer Modal */}
          {show3DThemeModal && (
            <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
              <div className="w-full max-w-md bg-slate-900 border border-amber-500/30 rounded-3xl p-5 shadow-2xl text-white space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 text-sm">
                      <i className="fas fa-cube"></i>
                    </div>
                    <div>
                      <h4 className="font-extrabold text-sm text-white">Live 3D Background Theme</h4>
                      <p className="text-[10px] text-slate-400">Choose your futuristic canvas visual</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShow3DThemeModal(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg"
                  >
                    <i className="fas fa-times"></i>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {(Object.keys(THEME_CONFIGS) as ThreeDTheme[]).map((themeKey) => (
                    <button
                      key={themeKey}
                      onClick={() => {
                        setThreeDTheme(themeKey);
                        localStorage.setItem('smm_3d_theme', themeKey);
                        haptic('light');
                      }}
                      className={`p-3 rounded-2xl border text-left transition ${
                        threeDTheme === themeKey
                          ? 'bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/20'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <span className="font-black text-xs block text-white capitalize">
                        {THEME_CONFIGS[themeKey]?.name || themeKey.replace('_', ' ')}
                      </span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">
                        {THEME_CONFIGS[themeKey]?.badge || 'Interactive 3D graphics'}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="pt-2 border-t border-white/10 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">Enable 3D Background:</span>
                  <button
                    onClick={() => {
                      const next = !is3DEnabled;
                      setIs3DEnabled(next);
                      localStorage.setItem('smm_3d_enabled', String(next));
                      haptic('heavy');
                    }}
                    className={`px-3 py-1.5 rounded-xl font-bold text-xs transition ${
                      is3DEnabled ? 'bg-emerald-500 text-black' : 'bg-red-500/20 text-red-300 border border-red-500/40'
                    }`}
                  >
                    {is3DEnabled ? 'ON ⚡' : 'OFF ⛔'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
