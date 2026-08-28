import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update handleRegister to ensure referrerUid and referrerUsername are set cleanly
# and passed to session and users doc
reg_start = text.find('// Handler: Register (with required Gmail / Email)')
reg_end = text.find('// Handler: Logout')
if reg_start != -1 and reg_end != -1:
    old_reg_section = text[reg_start:reg_end]
    
    # Check if we can improve referral code lookup in handleRegister
    new_reg_section = old_reg_section.replace(
        "referrerUsername = uDoc.data().name || 'Referrer';",
        "referrerUsername = uDoc.data().username || uDoc.data().name || refInput;"
    )
    # If not found by UID, check if user exists by username in users
    target_ref_search = """          if (!refSnap.empty) {
            referrerUid = refSnap.docs[0].id;
            referrerUsername = refSnap.docs[0].data().username || refInput;
          } else {
            // Check by UID
            const uDoc = await getDoc(doc(db, 'users', refInput));
            if (uDoc.exists()) {
              referrerUid = refInput;
              referrerUsername = uDoc.data().name || 'Referrer';
            }
          }"""
    
    better_ref_search = """          if (!refSnap.empty) {
            referrerUid = refSnap.docs[0].id;
            referrerUsername = refSnap.docs[0].data().username || refInput;
          } else {
            const qRefUser = query(collection(db, 'users'), where('username', '==', refInput));
            const snapRefUser = await getDocs(qRefUser);
            if (!snapRefUser.empty) {
              referrerUid = snapRefUser.docs[0].id;
              referrerUsername = snapRefUser.docs[0].data().username || refInput;
            } else {
              const uDoc = await getDoc(doc(db, 'users', refInput));
              if (uDoc.exists()) {
                referrerUid = refInput;
                referrerUsername = uDoc.data().username || uDoc.data().name || refInput;
              } else {
                referrerUid = refInput;
                referrerUsername = refInput;
              }
            }
          }"""
    if target_ref_search in text:
        text = text.replace(target_ref_search, better_ref_search, 1)
        print("Updated referral lookup in handleRegister!")

# 2. Update handleSubmitDeposit to include referrer info
old_dep_save = """      await addDoc(collection(db, 'deposit_requests'), {
        uid: currentUser.uid,
        amount: amt,
        trxId: trx,
        method: activeConfig.label || selectedMethod,
        screenshotUrl: depositReceiptImage || '',
        status: 'Pending',
        timestamp: serverTimestamp()
      });"""

new_dep_save = """      await addDoc(collection(db, 'deposit_requests'), {
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
      });"""

if old_dep_save in text:
    text = text.replace(old_dep_save, new_dep_save, 1)
    print("Updated handleSubmitDeposit with referral info!")
else:
    print("old_dep_save not found")

# 3. Add Referral Modal to JSX
modal_marker = '{/* Welcome Announcement Modal */}'
referral_modal_jsx = """{/* Referral & 5% Bonus Modal */}
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
                      `🔥 RF SMM PANEL - বাংলাদেশের সেরা ও বিশ্বস্ত সোশ্যাল মিডিয়া মার্কেটিং প্ল্যাটফর্ম!\\nলাইক, ফলোয়ার, ওয়াচটাইম নিন মাত্র কয়েক টাকায়।\\n🎁 এখনই একাউন্ট খুলুন এবং ব্যালেন্স যোগ করুন:\\n${
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
                      {userReferralCommissions.map((comm) => (
                        <div
                          key={comm.id}
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

          """

if modal_marker in text and 'showReferralModal &&' not in text:
    text = text.replace(modal_marker, referral_modal_jsx + modal_marker, 1)
    print("Referral Modal added to JSX successfully!")
else:
    print("Modal marker not found or already added")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

