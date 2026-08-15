from backend.pdf_export.generator import render_pdf_report
import os

campaign = {
    'id': 'camp_001',
    'name': 'Audience Scan - Bahamas',
    'countryCode': 'BS',
    'countryName': 'Bahamas',
}

results = [
    {
        'id': 'r1',
        'formatted': '+14155552670',
        'exists': True,
        'isValidFormat': True,
        'isBusiness': False,
        'displayName': 'John Doe',
        'avatar': None,
    },
    {
        'id': 'r2',
        'formatted': '+14155552671',
        'exists': True,
        'isValidFormat': True,
        'isBusiness': True,
        'displayName': 'Business Corp',
        'avatar': None,
    },
    {
        'id': 'r3',
        'formatted': '+14155552672',
        'exists': False,
        'isValidFormat': True,
        'isBusiness': False,
        'displayName': 'Jane Smith',
        'avatar': None,
    },
]

pdf_bytes = render_pdf_report(campaign, results, {'filterType': 'All Results'})
print(f'PDF generated: {len(pdf_bytes)} bytes')

with open('test.pdf', 'wb') as f:
    f.write(pdf_bytes)

with open('test.pdf', 'rb') as f:
    header = f.read(5)
    valid = header == b'%PDF-'
    print(f'Valid PDF: {valid}')

os.remove('test.pdf')
print('Done - test.pdf cleaned up')