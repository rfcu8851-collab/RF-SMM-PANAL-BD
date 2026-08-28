with open("src/App.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Add import
old_import = "import { Welcome3DModal } from './components/Welcome3DModal';"
new_import = """import { Welcome3DModal } from './components/Welcome3DModal';
import { LiveAISupportModal } from './components/LiveAISupportModal';"""

if old_import in text:
    text = text.replace(old_import, new_import, 1)
    print("Import added successfully!")
else:
    print("Welcome3DModal import not found!")

# 2. Add state
old_state = "const [showWelcomeModal, setShowWelcomeModal] = useState(false);"
new_state = """const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [showAISupportModal, setShowAISupportModal] = useState(false);"""

if old_state in text:
    text = text.replace(old_state, new_state, 1)
    print("State added successfully!")
else:
    print("showWelcomeModal state not found!")

# 3. Add Live AI banner in Home Tab
old_home_search = """          {/* HOME TAB */}
          {activeTab === 'home' && (
            <section className="px-5 mt-5">
              {/* SEARCH BAR TRIGGER */}"""

new_home_search = """          {/* HOME TAB */}
          {activeTab === 'home' && (
            <section className="px-5 mt-5">
              {/* 24/7 Live AI Support Banner */}
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

              {/* SEARCH BAR TRIGGER */}"""

if old_home_search in text:
    text = text.replace(old_home_search, new_home_search, 1)
    print("Home tab AI banner added successfully!")
else:
    print("old_home_search not found!")

# 4. Add Live AI Card in Profile Support section
old_prof_support = """              {/* Support & Community Section */}
              <div className="glass-card p-4 space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
                  <i className="fas fa-headset text-amber-400"></i>
                  <span>Help & Support Center (সাপোর্ট ও সোশ্যাল লিঙ্ক)</span>
                </h4>"""

new_prof_support = """              {/* Support & Community Section */}
              <div className="glass-card p-4 space-y-3">
                <h4 className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-2 border-b border-white/5 pb-2">
                  <i className="fas fa-headset text-amber-400"></i>
                  <span>Help & Support Center (সাপোর্ট ও সোশ্যাল লিঙ্ক)</span>
                </h4>

                {/* Live AI Support Card in Profile */}
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
                </div>"""

if old_prof_support in text:
    text = text.replace(old_prof_support, new_prof_support, 1)
    print("Profile AI support card added successfully!")
else:
    print("old_prof_support not found!")

# 5. Add Floating Live AI Support Button and Render Modal
old_bottom_nav_end = """          {/* Bottom Floating Navigation Bar */}"""

new_bottom_nav_end = """          {/* Floating 24/7 Live AI Support Button */}
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

          {/* Bottom Floating Navigation Bar */}"""

if old_bottom_nav_end in text:
    text = text.replace(old_bottom_nav_end, new_bottom_nav_end, 1)
    print("Floating button added successfully!")
else:
    print("old_bottom_nav_end not found!")

# 6. Render LiveAISupportModal
old_modal_render = """          {/* Welcome Announcement Modal */}"""

new_modal_render = """          {/* Live AI Support Assistant Modal */}
          {showAISupportModal && (
            <LiveAISupportModal
              isOpen={showAISupportModal}
              onClose={() => setShowAISupportModal(false)}
              currentUser={currentUser}
              userBalance={userBalance}
              userTotalOrders={userTotalOrders}
              onNavigateToDeposit={() => setActiveTab('funds')}
              onNavigateToOrders={() => setActiveTab('orders')}
              onNavigateToReferral={() => setShowReferralModal(true)}
            />
          )}

          {/* Welcome Announcement Modal */}"""

if old_modal_render in text:
    text = text.replace(old_modal_render, new_modal_render, 1)
    print("LiveAISupportModal render block added successfully!")
else:
    print("old_modal_render not found!")

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(text)

print("Finished updating App.tsx for Live AI Support!")
