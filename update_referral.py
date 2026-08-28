import re

with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update processReferralDepositBonus
start_marker = '// Helper: Award Referral Deposit Bonus'
end_marker = 'const handleApproveDepositCustom ='

start_idx = text.find(start_marker)
end_idx = text.find(end_marker)

if start_idx != -1 and end_idx != -1:
    new_bonus_code = """// Helper: Award Referral Deposit Bonus (5% Cash Commission) to Referrer upon Deposit Approval
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

  """
    text = text[:start_idx] + new_bonus_code + text[end_idx:]
    print("Replaced processReferralDepositBonus successfully!")
else:
    print("Markers not found for processReferralDepositBonus")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
