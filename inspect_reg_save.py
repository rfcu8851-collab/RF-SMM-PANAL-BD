with open('src/App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i in range(2480, 2565):
    print(f"{i+1}: {lines[i]}", end="")
