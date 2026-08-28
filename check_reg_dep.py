with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Inspect handleSubmitDeposit
pos1 = text.find('const handleSubmitDeposit =')
print("handleSubmitDeposit:")
print(text[pos1:pos1+1000])

# Inspect handleRegister
pos2 = text.find('const handleRegister =')
print("\nhandleRegister snippet:")
print(text[pos2:pos2+1200])

