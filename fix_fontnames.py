with open('E:\\WhatsApp\\backend\\pdf_export\\generator.py', 'r') as f:
    content = f.read()

# Replace all occurrences of: fontName='Inter', fontSize=N, fontName='Inter-X'
# with: fontName='Inter-X', fontSize=N
import re

# Find all such patterns and fix them
pattern = r"fontName='Inter', fontSize=(\d+\.?\d*), fontName='Inter-([A-Za-z]+)'"
matches = re.findall(pattern, content)
print(f"Found {len(matches)} fontName duplicates: {matches}")

for match in matches:
    size, style = match
    old_pattern = f"fontName='Inter', fontSize={size}, fontName='Inter-{style}'"
    new_pattern = f"fontName='Inter-{style}', fontSize={size}"
    content = content.replace(old_pattern, new_pattern)

with open('E:\\WhatsApp\\backend\\pdf_export\\generator.py', 'w') as f:
    f.write(content)

print('Fixed all fontName duplicates')