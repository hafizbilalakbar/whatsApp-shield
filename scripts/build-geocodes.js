import fs from 'fs';
import path from 'path';
import * as bson from 'bson';

const sourceDir = 'node_modules/libphonenumber-geo-carrier/resources/geocodes/en';
const targetDir = 'src/data/geocodes';

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

const files = fs.readdirSync(sourceDir).filter(f => f.endsWith('.bson'));
console.log(`Exporting ${files.length} calling code datasets from libphonenumber-geo-carrier into ${targetDir}...`);

let totalEntries = 0;
const manifest = {};

for (const file of files) {
  const callingCode = path.basename(file, '.bson');
  const bData = fs.readFileSync(path.join(sourceDir, file));
  const data = bson.deserialize(bData);
  const count = Object.keys(data).length;
  totalEntries += count;

  fs.writeFileSync(path.join(targetDir, `${callingCode}.json`), JSON.stringify(data));
  manifest[callingCode] = count;
}

fs.writeFileSync(path.join(targetDir, 'manifest.json'), JSON.stringify(manifest, null, 2));

console.log(`Successfully generated ${files.length} offline geocode datasets (${totalEntries} total entries).`);
