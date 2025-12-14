const fs = require('fs');
const path = require('path');

// JSON'dan value → key mapping
function buildReverseMap(jsonPath) {
  const json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const reverseMap = new Map();

  function traverse(obj, prefix = '') {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'object') {
        traverse(value, fullKey);
      } else if (typeof value === 'string') {
        reverseMap.set(value.trim(), fullKey);
      }
    }
  }

  traverse(json);
  return reverseMap;
}

// HTML dosyasını güncelle
function updateHtmlFile(filePath, reverseMap) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  const changes = [];

  reverseMap.forEach((key, value) => {
    const escapedValue = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Pattern 1: Text node'lar <tag>Metin</tag>
    const textNodeRegex = new RegExp(`(>)\\s*${escapedValue}\\s*(<)`, 'g');
    if (textNodeRegex.test(content)) {
      content = content.replace(textNodeRegex, (match, p1, p2) => {
        if (!match.includes('translate') && !match.includes('{{')) {
          changes.push({ type: 'text node', value, key });
          modified = true;
          return `${p1}{{ '${key}' | translate }}${p2}`;
        }
        return match;
      });
    }

    // Pattern 2: Attribute value'lar placeholder="Metin"
    const attrRegex = new RegExp(`(placeholder|title|alt|aria-label)=["']${escapedValue}["']`, 'g');
    if (attrRegex.test(content)) {
      content = content.replace(attrRegex, (match, attrName) => {
        if (!match.includes('translate')) {
          changes.push({ type: `attribute: ${attrName}`, value, key });
          modified = true;
          return `[${attrName}]="'${key}' | translate"`;
        }
        return match;
      });
    }

    // Pattern 3: Button text <button>Kaydet</button>
    const buttonRegex = new RegExp(`(<button[^>]*>)\\s*${escapedValue}\\s*(</button>)`, 'gi');
    if (buttonRegex.test(content)) {
      content = content.replace(buttonRegex, (match, openTag, closeTag) => {
        if (!match.includes('translate') && !match.includes('{{')) {
          changes.push({ type: 'button text', value, key });
          modified = true;
          return `${openTag}{{ '${key}' | translate }}${closeTag}`;
        }
        return match;
      });
    }

    // Pattern 4: mat-label içindeki text
    const matLabelRegex = new RegExp(`(<mat-label[^>]*>)\\s*${escapedValue}\\s*(</mat-label>)`, 'gi');
    if (matLabelRegex.test(content)) {
      content = content.replace(matLabelRegex, (match, openTag, closeTag) => {
        if (!match.includes('translate') && !match.includes('{{')) {
          changes.push({ type: 'mat-label', value, key });
          modified = true;
          return `${openTag}{{ '${key}' | translate }}${closeTag}`;
        }
        return match;
      });
    }

    // Pattern 5: span içindeki text
    const spanRegex = new RegExp(`(<span[^>]*>)\\s*${escapedValue}\\s*(</span>)`, 'gi');
    if (spanRegex.test(content)) {
      content = content.replace(spanRegex, (match, openTag, closeTag) => {
        if (!match.includes('translate') && !match.includes('{{') && !openTag.includes('class=')) {
          changes.push({ type: 'span text', value, key });
          modified = true;
          return `${openTag}{{ '${key}' | translate }}${closeTag}`;
        }
        return match;
      });
    }
  });

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${path.basename(filePath)}`);
    changes.forEach(c => console.log(`   🔄 [${c.type}] "${c.value}" → {{ '${c.key}' | translate }}`));
  }

  return modified;
}

// TranslateModule'ün import edildiğini kontrol et
function ensureTranslateModule(tsFilePath) {
  let content = fs.readFileSync(tsFilePath, 'utf8');

  if (!content.includes('TranslateModule')) {
    // imports array'ini bul
    const importsMatch = content.match(/imports:\s*\[([^\]]*)\]/s);
    if (importsMatch) {
      const imports = importsMatch[1];
      if (!imports.includes('TranslateModule')) {
        const newImports = imports.trim() + ',\n    TranslateModule';
        content = content.replace(/imports:\s*\[([^\]]*)\]/s, `imports: [${newImports}\n  ]`);

        // Import statement ekle
        if (!content.includes("from '@ngx-translate/core'")) {
          const importSection = content.match(/import[^;]+from[^;]+;/);
          if (importSection) {
            const insertPos = content.indexOf(importSection[0]) + importSection[0].length;
            content = content.slice(0, insertPos) +
                      "\nimport { TranslateModule } from '@ngx-translate/core';" +
                      content.slice(insertPos);
          }
        }

        fs.writeFileSync(tsFilePath, content, 'utf8');
        console.log(`   ✅ TranslateModule eklendi: ${path.basename(tsFilePath)}`);
      }
    }
  }
}

// Ana fonksiyon
function processDirectory(dir, reverseMap) {
  const files = fs.readdirSync(dir);
  let stats = { total: 0, updated: 0 };

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory() && !['node_modules', 'dist', '.angular'].includes(file)) {
      const subStats = processDirectory(filePath, reverseMap);
      stats.total += subStats.total;
      stats.updated += subStats.updated;
    } else if (file.endsWith('.component.html')) {
      stats.total++;
      if (updateHtmlFile(filePath, reverseMap)) {
        stats.updated++;

        // İlgili .ts dosyasına TranslateModule ekle
        const tsFilePath = filePath.replace('.html', '.ts');
        if (fs.existsSync(tsFilePath)) {
          ensureTranslateModule(tsFilePath);
        }
      }
    }
  });

  return stats;
}

// Çalıştır
console.log('🚀 HTML dosyaları güncelleniyor...\n');
const reverseMap = buildReverseMap('./src/assets/i18n/tr.json');
console.log(`📚 ${reverseMap.size} çeviri yüklendi\n`);

const stats = processDirectory('./src/app', reverseMap);

console.log(`\n${'='.repeat(60)}`);
console.log(`✅ Tamamlandı! ${stats.updated}/${stats.total} dosya güncellendi`);
console.log('='.repeat(60));
