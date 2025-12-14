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

// Regex için escape
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// TypeScript dosyasını güncelle
function updateTypeScriptFile(filePath, reverseMap) {
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  const changes = [];

  // ✅ Tüm match'leri bul (uzundan kısaya)
  const allMatches = [];
  const sortedEntries = Array.from(reverseMap.entries()).sort((a, b) => b[0].length - a[0].length);

  sortedEntries.forEach(([value, key]) => {
    const escapedValue = escapeRegex(value);

    // Tüm quote türleri için ara
    const quoteTypes = ["'", '"', '`'];

    quoteTypes.forEach(quote => {
      const pattern = new RegExp(quote + escapedValue + quote, 'g');
      let match;

      while ((match = pattern.exec(content)) !== null) {
        const matchStart = match.index;
        const matchEnd = matchStart + match[0].length;

        // Önceki ve sonraki bağlam
        const beforeContext = content.slice(Math.max(0, matchStart - 50), matchStart);
        const afterContext = content.slice(matchEnd, Math.min(content.length, matchEnd + 30));

        // Zaten çevrilmiş mi?
        const isAlreadyTranslated =
          beforeContext.includes('translate.instant') ||
          beforeContext.includes('| translate') ||
          beforeContext.endsWith('.instant(') ||
          afterContext.startsWith(' | translate');

        if (!isAlreadyTranslated) {
          // Bu match'i sakla
          allMatches.push({
            start: matchStart,
            end: matchEnd,
            original: match[0],
            replacement: `this.translate.instant('${key}')`,
            value: value,
            key: key
          });
        }
      }
    });
  });

  // ✅ Çakışan match'leri temizle (uzun olanı tut)
  const cleanedMatches = [];
  allMatches.sort((a, b) => a.start - b.start);

  for (let i = 0; i < allMatches.length; i++) {
    const current = allMatches[i];
    let isOverlapping = false;

    // Daha uzun bir match ile çakışıyor mu?
    for (let j = 0; j < allMatches.length; j++) {
      if (i !== j) {
        const other = allMatches[j];
        const isCurrentInsideOther = current.start >= other.start && current.end <= other.end;
        const isOtherLonger = (other.end - other.start) > (current.end - current.start);

        if (isCurrentInsideOther && isOtherLonger) {
          isOverlapping = true;
          break;
        }
      }
    }

    if (!isOverlapping) {
      cleanedMatches.push(current);
    }
  }

  // ✅ Sondan başa doğru değiştir (pozisyonlar bozulmasın)
  cleanedMatches.sort((a, b) => b.start - a.start);

  cleanedMatches.forEach(match => {
    content = content.slice(0, match.start) +
              match.replacement +
              content.slice(match.end);
    changes.push({ value: match.value, key: match.key });
  });

  const modified = content !== originalContent;

  if (modified) {
    // ✅ TranslateService import'unu ekle
    if (!content.includes("from '@ngx-translate/core'")) {
      const importSection = content.match(/import[^;]+;/);
      if (importSection) {
        const insertPos = content.indexOf(importSection[0]) + importSection[0].length;
        content = content.slice(0, insertPos) +
                  "\nimport { TranslateModule, TranslateService } from '@ngx-translate/core';" +
                  content.slice(insertPos);
      }
    }

    // ✅ inject ekle (yoksa)
    if (!content.includes('inject')) {
      const angularCoreImport = content.match(/import\s*{([^}]+)}\s*from\s*['"]@angular\/core['"]/);
      if (angularCoreImport) {
        const imports = angularCoreImport[1];
        if (!imports.includes('inject')) {
          const newImports = imports.trim() + ', inject';
          content = content.replace(
            /import\s*{([^}]+)}\s*from\s*['"]@angular\/core['"]/,
            `import { ${newImports} } from '@angular/core'`
          );
        }
      }
    }

    // ✅ export class'dan hemen sonraki satıra private translate = inject(TranslateService) ekle
    if (!content.includes('translate = inject(TranslateService)')) {
      const classMatch = content.match(/(export\s+class\s+\w+[^{]*{\s*)/);
      if (classMatch) {
        const insertPos = content.indexOf(classMatch[1]) + classMatch[1].length;
        content = content.slice(0, insertPos) +
                  "\n  private translate = inject(TranslateService);\n" +
                  content.slice(insertPos);
        console.log(`   ✅ private translate = inject(TranslateService) eklendi`);
      }
    }

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ ${path.basename(filePath)}`);

    // Benzersiz değişiklikleri göster
    const uniqueChanges = [...new Map(changes.map(c => [c.key, c])).values()];
    uniqueChanges.forEach(c => console.log(`   🔄 "${c.value}" → translate.instant('${c.key}')`));
  }

  return modified;
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
    } else if ((file.endsWith('.component.ts') || file.endsWith('.service.ts')) && !file.endsWith('.spec.ts')) {
      stats.total++;
      if (updateTypeScriptFile(filePath, reverseMap)) {
        stats.updated++;
      }
    }
  });

  return stats;
}

// Çalıştır
console.log('🚀 TypeScript dosyaları güncelleniyor...\n');
const reverseMap = buildReverseMap('./src/assets/i18n/tr.json');
console.log(`📚 ${reverseMap.size} çeviri yüklendi\n`);

const stats = processDirectory('./src/app', reverseMap);

console.log(`\n${'='.repeat(60)}`);
console.log(`✅ Tamamlandı! ${stats.updated}/${stats.total} dosya güncellendi`);
console.log('='.repeat(60));
