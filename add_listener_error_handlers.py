with open("src/App.tsx", "r", encoding="utf-8") as f:
    text = f.read()

# Check userRef listener
old_u_sync = """    const unsubscribe = onSnapshot(userRef, (docSnap) => {"""
new_u_sync = """    const unsubscribe = onSnapshot(userRef, (docSnap) => {"""

# Check services listener
old_services = """    const unsub = onSnapshot(collection(db, 'services'), (snapshot) => {
      const list: ServiceData[] = [];
      const catsSet = new Set<string>();

      snapshot.forEach((d) => {
        const data = { id: d.id, ...d.data() } as ServiceData;
        list.push(data);
        if (data.category) catsSet.add(data.category);
      });

      setAllServices(list);
      setCategories(Array.from(catsSet).sort());
    });"""

new_services = """    const unsub = onSnapshot(collection(db, 'services'), (snapshot) => {
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
    });"""

if old_services in text:
    text = text.replace(old_services, new_services, 1)

# Check orders listener
old_orders = """    const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: OrderData[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.uid === currentUser.uid) {
          list.push({ id: docSnap.id, ...data } as OrderData);
        }
      });
      setOrdersList(list);
    });"""

new_orders = """    const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
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
    });"""

if old_orders in text:
    text = text.replace(old_orders, new_orders, 1)

# Check admin all deposit requests
old_all_dep = """    const q = query(collection(db, 'deposit_requests'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: DepositRequest[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as DepositRequest);
      });
      setAllDepositRequests(list);
    });"""

new_all_dep = """    const q = query(collection(db, 'deposit_requests'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: DepositRequest[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as DepositRequest);
      });
      setAllDepositRequests(list);
    }, (err) => {
      console.warn('All deposit requests sync notice:', err.message);
    });"""

if old_all_dep in text:
    text = text.replace(old_all_dep, new_all_dep, 1)

# Check admin all orders
old_all_orders = """    const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: OrderData[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as OrderData);
      });
      setAllAdminOrdersList(list);
    });"""

new_all_orders = """    const q = query(collection(db, 'orders'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: OrderData[] = [];
      snapshot.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as OrderData);
      });
      setAllAdminOrdersList(list);
    }, (err) => {
      console.warn('All admin orders sync notice:', err.message);
    });"""

if old_all_orders in text:
    text = text.replace(old_all_orders, new_all_orders, 1)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(text)

print("Listener error handlers updated successfully!")
