import re

# 1. Fix LiveAISupportModal.tsx
with open("src/components/LiveAISupportModal.tsx", "r", encoding="utf-8") as f:
    c = f.read()
# Clean up key attribute in messages
c = re.sub(r'key=\{[^}]*\}', lambda m: 'key={msg.id ? `msg-${msg.id}-${idx}` : `msg-${idx}`}' if 'msg' in m.group(0) else m.group(0), c)
with open("src/components/LiveAISupportModal.tsx", "w", encoding="utf-8") as f:
    f.write(c)

# 2. Fix AdminLiveSupportPanel.tsx
with open("src/components/AdminLiveSupportPanel.tsx", "r", encoding="utf-8") as f:
    c = f.read()
c = re.sub(r'key=\{[^}]*\}', lambda m: 'key={thread.id ? `thr-${thread.id}-${idx}` : `thr-${idx}`}' if 'thread' in m.group(0) else ('key={msg.id ? `msg-${msg.id}-${idx}` : `msg-${idx}`}' if 'msg' in m.group(0) else m.group(0)), c)
with open("src/components/AdminLiveSupportPanel.tsx", "w", encoding="utf-8") as f:
    f.write(c)

print("Updated modals")
