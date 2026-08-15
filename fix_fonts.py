with open('E:\\WhatsApp\\backend\\pdf_export\\generator.py', 'r') as f:
    content = f.read()

# Simple replacement: replace all fontName references with Helvetica/Helvetica-Bold
content = content.replace("\\'Inter\\'", "\\'Helvetica\\'")
content = content.replace("\\'Inter-Bold\\'", "\\'Helvetica-Bold\\'")
content = content.replace("\\'Inter-Medium\\'", "\\'Helvetica-Bold\\'")
content = content.replace("\\'Inter-SemiBold\\'", "\\'Helvetica-Bold\\'")

with open('E:\\WhatsApp\\backend\\pdf_export\\generator.py', 'w') as f:
    f.write(content)

print('Fixed font names')