with open("src/App.tsx", "r", encoding="utf-8") as f:
    text = f.read()

target_block = """  // 5. Realtime User Deposit Requests Sync
  useEffect(() => {
    if (!isLoggedIn || !currentUser?.uid) return;

    const q = query(
      collection(db, 'deposit_requests'),
      where('uid', '==', currentUser.uid),
      orderBy('timestamp', 'desc')
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const list: DepositRequest[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as DepositRequest);
      });
      setDepositHistory(list);
    });

    return () => unsub();
  }, [isLoggedIn, currentUser?.uid]);"""

replacement_block = """  // 5. Realtime User Deposit Requests Sync
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
  }, [isLoggedIn, currentUser?.uid]);"""

if target_block in text:
    text = text.replace(target_block, replacement_block, 1)
    print("Successfully replaced composite query in Realtime User Deposit Requests Sync!")
else:
    print("target_block not found directly, let's search")

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(text)

