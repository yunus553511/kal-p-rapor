// Modern animasyonlu uygulama ana JS dosyası
// Google Sheets'ten özet verileri çek, kutulara animasyonlu yaz, arama ve popup için temel fonksiyonlar

// SheetJS proxy ile Google Sheets'ten veri çekme ve kutulara animasyonlu yazma
const SHEET_OZET_XLSX = 'https://docs.google.com/spreadsheets/d/1RP5kRFKAUUJye7-lPnlmeNaN805eF_88/export?format=xlsx&id=1RP5kRFKAUUJye7-lPnlmeNaN805eF_88&gid=2132791514';
const SHEET_DETAY_XLSX = 'https://docs.google.com/spreadsheets/d/1RP5kRFKAUUJye7-lPnlmeNaN805eF_88/export?format=xlsx&id=1RP5kRFKAUUJye7-lPnlmeNaN805eF_88&gid=600580160';

let proxyReady = false;
function waitProxyReady(cb) {
    if (proxyReady) { cb(); return; }
    function onReady(e) {
        if (e.data && e.data.source === 'proxy' && e.data.action === 'ready') {
            window.removeEventListener('message', onReady);
            proxyReady = true;
            cb();
        }
    }
    window.addEventListener('message', onReady);
}

function requestSheetFromProxy(url, gid, cb) {
    const proxy = document.getElementById('proxyFrame').contentWindow;
    function onMessage(e) {
        if (!e.data || e.data.source !== 'proxy') return;
        if (e.data.action === 'sheetLoaded' && e.data.gid === gid) {
            window.removeEventListener('message', onMessage);
            cb(e.data.buffer);
        }
        if (e.data.action === 'error') {
            window.removeEventListener('message', onMessage);
            alert('Veri yükleme hatası: ' + e.data.error);
        }
    }
    window.addEventListener('message', onMessage);
    proxy.postMessage({ action: 'loadSheet', url, gid }, '*');
}

function fetchAndAnimateStats() {
    requestSheetFromProxy(SHEET_OZET_XLSX, '2132791514', function(buffer) {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const ws = workbook.Sheets[workbook.SheetNames[0]];
        const B2 = ws['B2'] ? ws['B2'].v : 0;
        const C2 = ws['C2'] ? ws['C2'].v : 0;
        const D2 = ws['D2'] ? ws['D2'].v : 0;
        animateValue('farkliProfilAdeti', 0, Number(B2), 1000);
        animateValue('aktifKalipAdeti', 0, Number(C2), 1000);
        animateValue('hurdaKalipAdeti', 0, Number(D2), 1000);
    });
}
function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    let startTimestamp = null;
    const step = timestamp => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.textContent = Math.floor(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
        else obj.textContent = end;
    };
    window.requestAnimationFrame(step);
}
// Logo animasyonu ve başlık harf animasyonu
function initLogoAnim() {
    const logo = document.getElementById('logo');
    if (!logo) return;
    logo.style.opacity = '0';
    logo.style.transform = 'scale(0.8)';
    setTimeout(() => {
        logo.style.transition = 'all 0.8s cubic-bezier(.4,2,.6,1)';
        logo.style.opacity = '1';
        logo.style.transform = 'scale(1)';
    }, 300);
}
function initTitleAnim() {
    const title = document.querySelector('.gradient-text');
    if (!title) return;
    const text = title.textContent;
    let html = '';
    for (let i = 0; i < text.length; i++) {
        if (text[i] === ' ') html += ' ';
        else html += `<span style="display:inline-block;opacity:0;animation:fadeInUp 0.8s ${(i*0.06)+0.4}s forwards;">${text[i]}</span>`;
    }
    title.innerHTML = html;
}

function searchProfileCode(kod) {
    if (!kod || kod.trim() === '') {
        showResults([]);
        return;
    }
    requestSheetFromProxy(SHEET_DETAY_XLSX, '600580160', function(buffer) {
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const range = XLSX.utils.decode_range(sheet['!ref']);
        let results = [];
        let allRows = [];
        for (let row = range.s.r + 1; row <= range.e.r; row++) { // +1: başlık atla
            let rowData = {};
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cell = sheet[XLSX.utils.encode_cell({c:col, r:row})];
                const headerCell = sheet[XLSX.utils.encode_cell({c:col, r:range.s.r})];
                const key = headerCell ? String(headerCell.v).trim() : XLSX.utils.encode_col(col);
                rowData[key] = cell ? cell.v : '';
            }
            allRows.push(rowData);
            // Eşleşme: başlık 'PROFİL KODU' ile, trim ve küçük harf duyarsız
            if (rowData['PROFİL KODU'] && String(rowData['PROFİL KODU']).trim().toLowerCase() === kod.trim().toLowerCase()) {
                results.push(rowData);
            }
        }
        console.log('Sheetten okunan tüm satırlar:', allRows);
        showResults(results);
    });
}

// --- POPUP YARDIMCI FONKSİYONLARI ---
function groupByFigurAndFirma(detaySatirlar) {
    // ['1 FİGÜR ALMEKS', ...] -> { '1 FİGÜR ALMEKS': 3, ... }
    const counts = {};
    detaySatirlar.forEach(satir => {
        counts[satir] = (counts[satir] || 0) + 1;
    });
    // '1 FİGÜR ALMEKS' -> { figur: '1 FİGÜR', firma: 'ALMEKS', count: 3 }
    return Object.entries(counts).map(([key, count]) => {
        const parts = key.split(' ');
        return {
            figur: parts.slice(0,2).join(' '),
            firma: parts.slice(2).join(' '),
            count
        };
    });
}

function excelDateToString(excelDate) {
    // Excel seri tarihi -> yyyy-mm-dd
    if (!excelDate) return '';
    if (typeof excelDate === 'string') {
        // ISO format veya DD.MM.YYYY ise dönüştür
        if (/^\d{4}-\d{2}-\d{2}$/.test(excelDate)) return excelDate;
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(excelDate)) {
            const [d, m, y] = excelDate.split('.');
            return `${y}-${m}-${d}`;
        }
    }
    // Excel serial date (float veya int)
    if (!isNaN(excelDate)) {
        // Bazı Excel dosyalarında tarih UTC+0 olarak gelir, saat farkı için +2 saat eklenir
        const utc_days = Math.floor(Number(excelDate) - 25569);
        const utc_value = utc_days * 86400;
        const date_info = new Date(utc_value * 1000);
        // Türkiye için saat farkı düzeltmesi (UTC+3)
        date_info.setHours(date_info.getHours() + 3);
        return date_info.toISOString().slice(0, 10);
    }
    return excelDate;
}

function fetchSayfa4Son4Tarih(kod, callback) {
    // Sayfa4 gid: 278605159
    requestSheetFromProxy(
        'https://docs.google.com/spreadsheets/d/1RP5kRFKAUUJye7-lPnlmeNaN805eF_88/export?format=xlsx&id=1RP5kRFKAUUJye7-lPnlmeNaN805eF_88&gid=278605159',
        '278605159',
        function(buffer) {
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const range = XLSX.utils.decode_range(sheet['!ref']);
            let rows = [];
            
            // Aranan kodu hem direkt hem AP önekiyle arayabilmek için normalize et
            let rawKod = String(kod).trim().toLowerCase();
            let normalizedKod = rawKod;
            let apVersion = '';
            
            // Gonderilen kod AP ile basliyorsa, bir de AP eklenmis versiyonunu kontrol et
            if (!rawKod.startsWith('ap')) {
                apVersion = 'ap' + rawKod;
            } else {
                // Gonderilen kod AP ile basliyorsa, bir de AP'siz halini kontrol et
                normalizedKod = rawKod.substring(2);
            }
            
            console.log(`Aranıyor - Normal kod: "${normalizedKod}", AP versiyonu: "${apVersion ? apVersion : 'Yok'}"`);
            
            for (let row = range.s.r + 1; row <= range.e.r; row++) {
                const kodCell = sheet[XLSX.utils.encode_cell({c:1, r:row})];
                
                if (!kodCell || !kodCell.v) continue; // Boş hücreleri atla
                
                // Hücre değerini normalize et
                const cellValue = String(kodCell.v).trim().toLowerCase();
                
                // Hem normal kod, hem AP versiyonu ile kontrol et
                if (cellValue === normalizedKod || (apVersion && cellValue === apVersion)) {
                    const tarihCell = sheet[XLSX.utils.encode_cell({c:0, r:row})]; // A sütunu
                    const tarih = tarihCell ? tarihCell.v : '';
                    rows.push({
                        tarih: tarih,
                        tarihStr: excelDateToString(tarih),
                        siparis_boyu: sheet[XLSX.utils.encode_cell({c:3, r:row})]?.v || '',
                        uretilen_adet: sheet[XLSX.utils.encode_cell({c:4, r:row})]?.v || '',
                        uretilen_kg: sheet[XLSX.utils.encode_cell({c:15, r:row})]?.v || '',
                        sorun: sheet[XLSX.utils.encode_cell({c:17, r:row})]?.v || '',
                        tashihat: sheet[XLSX.utils.encode_cell({c:18, r:row})]?.v || ''
                    });
                }
            }
            
            // Tarihe göre sırala (en yeni başa)
            rows.sort((a, b) => new Date(b.tarihStr) - new Date(a.tarihStr));
            callback(rows.slice(0, 4));
        }
    );
}

function fetchSayfa1Tonaj(kod, callback) {
    // Sayfa1 gid: 1238184358
    requestSheetFromProxy(
        'https://docs.google.com/spreadsheets/d/1RP5kRFKAUUJye7-lPnlmeNaN805eF_88/export?format=xlsx&id=1RP5kRFKAUUJye7-lPnlmeNaN805eF_88&gid=1238184358',
        '1238184358',
        function(buffer) {
            const workbook = XLSX.read(buffer, { type: 'array' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const range = XLSX.utils.decode_range(sheet['!ref']);
            let matched = false;
            console.log(`Aranıyor: Kod="${kod}"`);
            
            for (let row = range.s.r + 1; row <= range.e.r; row++) {
                // B sütunu = 1 (kodu arama)
                // J sütunu = 9 (kesin tonaj)
                // K sütunu = 10 (tahmini tonaj)
                // L sütunu = 11 (tahmini tenefer)
                const b_cell = sheet[XLSX.utils.encode_cell({c:1, r:row})];
                
                if (!b_cell) continue; // Boş hücreleri atla
                
                const b_str = String(b_cell.v || '').toLowerCase().trim();
                const kod_str = String(kod).toLowerCase().trim(); 
                
                console.log(`Kontrol: B sütunu (Kod)="${b_str}"`);
                
                // Kod bilgisi B sütununda
                if (b_str === kod_str) {
                    matched = true;
                    console.log(`Eşleşme bulundu: Satır ${row}`);
                    
                    // J sütununda veri varsa kesin tonaj, yoksa K sütunundaki tahmini tonaj
                    const j_cell = sheet[XLSX.utils.encode_cell({c:9, r:row})];
                    const k_cell = sheet[XLSX.utils.encode_cell({c:10, r:row})];
                    const l_cell = sheet[XLSX.utils.encode_cell({c:11, r:row})];
                    
                    // Cell değerleri hakkında daha fazla bilgi
                    console.log(`Bulundu (Satır ${row}):\n` + 
                               `J hücresi (Kesin Tonaj): `, j_cell, '\n' + 
                               `K hücresi (Tahmini Tonaj): `, k_cell, '\n' + 
                               `L hücresi (Tahmini Tenefer): `, l_cell);
                    
                    // Get values with safe defaults
                    const kesin = j_cell?.v;
                    const tahmini = k_cell?.v;
                    const tenefer = l_cell?.v;
                    
                    return callback({
                        kesin: kesin !== undefined ? kesin : '', 
                        tahmini: tahmini !== undefined ? tahmini : '',
                        tenefer: tenefer !== undefined ? tenefer : ''
                    });
                }
            }
            
            if (!matched) {
                console.log(`Eşleşme bulunamadı: Kod='${kod}'`);
            }
            callback({ kesin: '', tahmini: '', tenefer: '' });
        }
    );
}

function showPopup(row, detaySatirlar, kod) {
    const modal = document.getElementById('reportModal');
    const content = document.getElementById('reportContent');
    
    // Raporun oluşturulma tarihini formatla (gg.aa.yyyy)
    const bugun = new Date();
    const gun = String(bugun.getDate()).padStart(2, '0');
    const ay = String(bugun.getMonth() + 1).padStart(2, '0'); // Ay 0-11 aralığında
    const yil = bugun.getFullYear();
    const formatlanmisTarih = `${gun}.${ay}.${yil}`;
    
    content.innerHTML = `<div class="popup-rapor">
        <div class="popup-header">
            <img src='logo.png' class='popup-logo' />
            <div class='popup-title'>BEYMETAL KALIP RAPOR</div>
            <div class='popup-date'>Rapor Tarihi: ${formatlanmisTarih}</div>
            <span class='popup-close' title='Kapat'>&times;</span>
        </div>
        <div class='popup-body'>
            <div class='popup-kod'><b>Aranan Kod:</b> <span>${kod}</span></div>
            <div class='popup-toplam-adet'><b>Toplam Adet:</b> <span>${row['TOPLAM ADET']}</span></div>
            <div class='popup-grup'><b>Kalıplar:</b><div class='popup-gruplar'></div></div>
            <div class='popup-son-tarih'></div>
            <div class='popup-figur-tonaj'></div>
            <div class='popup-yuzdelik-grafik'></div>
            <div class='popup-tenefer'></div>
        </div>
        <div class='popup-footer'>
            <button class='pdf-download-btn'><i class='fas fa-file-pdf'></i> PDF olarak indir</button>
            <div class='pdf-auto-text'>Bu rapor otomatik olarak oluşturulmuştur</div>
        </div>
    </div>`;
    modal.style.display = 'flex';
    // Gruplama
    const gruplar = groupByFigurAndFirma(detaySatirlar);
    const gruplarDiv = content.querySelector('.popup-gruplar');
    gruplar.forEach(g => {
        const el = document.createElement('div');
        el.textContent = `${g.figur} ${g.count} ${g.firma}`;
        el.className = 'popup-grup-item';
        el.addEventListener('click', () => {
            fetchSayfa1Tonaj(g.figur, function(tonaj) {
                // J sütununda veri varsa kesin tonaj, yoksa K sütunundaki tahmini tonaj
                let val, tip;
                
                // Güncellenmiş tonaj bilgisi gösterimi:
                // 1. Eğer J sütununda (kesin) veri varsa onu göster
                // 2. J sütununda veri yoksa K sütunundaki (tahmini) veriyi göster
                // 3. Tenefer bilgisi her zaman L sütunundan alın
                if (tonaj.kesin && tonaj.kesin !== '' && tonaj.kesin !== 0) {
                    val = tonaj.kesin;
                    tip = 'Kesin Tonaj';
                } else if (tonaj.tahmini && tonaj.tahmini !== '' && tonaj.tahmini !== 0) {
                    val = tonaj.tahmini;
                    tip = 'Tahmini Tonaj';
                } else {
                    val = 'Veri yok';
                    tip = '';
                }
                
                content.querySelector('.popup-figur-tonaj').innerHTML = `<b>${g.figur} için ${tip}:</b> <span>${val}</span>`;
                
                // Yüzdelik grafik gösterimi
                let yuzde = 0;
                if (val && !isNaN(val)) yuzde = Math.min(100, Math.round((val/15000)*100));
                content.querySelector('.popup-yuzdelik-grafik').innerHTML = `<div class='progress-bar'><div class='progress-fill' style='width:${yuzde}%;'>${yuzde}%</div></div>`;
                
                // Tenefer bilgisi gösterimi (L sütunu)
                const teneferDeger = tonaj.tenefer || '-';
                content.querySelector('.popup-tenefer').innerHTML = `<b>Tahmini Tenefer:</b> <span>${teneferDeger}</span>`;
            });
        });
        gruplarDiv.appendChild(el);
    });
    if (gruplar.length) gruplarDiv.children[0].click();
    // Son 4 tarihli satırı çek
    fetchSayfa4Son4Tarih(kod, function(sonlar) {
        if (sonlar && sonlar.length) {
            let tablo = `<b>Son 4 Tarihli Bilgiler:</b><table class='popup-tablo a4-table'><tr><th>Tarih</th><th>Sipariş Boyu</th><th>Üretilen Adet</th><th>Üretilen KG</th><th>Sorun</th><th>Tashihat</th></tr>`;
            sonlar.forEach(s => {
                tablo += `<tr><td>${excelDateToString(s.tarih)}</td><td>${s.siparis_boyu}</td><td>${s.uretilen_adet}</td><td>${s.uretilen_kg}</td><td>${s.sorun}</td><td>${s.tashihat}</td></tr>`;
            });
            tablo += '</table>';
            content.querySelector('.popup-son-tarih').innerHTML = tablo;
        } else {
            content.querySelector('.popup-son-tarih').innerHTML = 'Son tarihli bilgi bulunamadı.';
        }
    });
    content.querySelector('.pdf-download-btn').onclick = function() {
        const opt = {
            margin:       0,
            filename:     'beymetal_kalip_rapor.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, backgroundColor: '#fff' },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['avoid-all', 'css', 'legacy'] }
        };
        html2pdf().set(opt).from(content.querySelector('.popup-rapor')).save();
    };
    // Modal kapama
    content.querySelector('.popup-close').onclick = function() {
        modal.style.display = 'none';
    };
    document.querySelector('.close-button').onclick = function() {
        modal.style.display = 'none';
    };
}

// --- SONUÇ EKRANI ANİMASYON, TIKLANABİLİRLİK, KAYDIRMA ---
function showResults(results) {
    const container = document.getElementById('results');
    if (!results.length) {
        container.innerHTML = '<div class="no-result">Sonuç bulunamadı.</div>';
        return;
    }
    let html = '';
    results.forEach((row, idx) => {
        let detaySatirlar = [];
        const figurler = ['1 FİGÜR', '2 FİGÜR', '3 FİGÜR', '4 FİGÜR', '6 FİGÜR'];
        figurler.forEach(figur => {
            if (row[figur]) {
                const parcalar = String(row[figur]).split(/\s+/).filter(Boolean);
                for (let i = 0; i < parcalar.length; i += 2) {
                    let adet = parseInt(parcalar[i]);
                    let firma = parcalar[i+1] ? parcalar[i+1].toUpperCase() : '';
                    if (!isNaN(adet) && firma) {
                        for (let j = 0; j < adet; j++) {
                            detaySatirlar.push(figur + ' ' + firma);
                        }
                    } else if (parcalar[i] && !isNaN(Number(parcalar[i])) === false) {
                        detaySatirlar.push(figur + ' ' + parcalar[i].toUpperCase());
                    }
                }
            }
        });
        html += `<div class="result-box animated" tabindex="0" style="cursor:pointer;overflow-x:auto;">
            <div class="profil-header"><b>PROFİL KODU:</b> ${row['PROFİL KODU']} <span class="adet-badge">${row['TOPLAM ADET']}</span></div>
            <div class="detay-list">
                ${detaySatirlar.map(satir => `<div class="detay-item">${satir}</div>`).join('')}
            </div>
        </div>`;
    });
    container.innerHTML = html;
    setTimeout(() => {
        document.querySelectorAll('.result-box.animated').forEach((el, i) => {
            el.classList.add('fade-in');
            el.style.transitionDelay = (i * 0.07) + 's';
        });
        // Tıklanabilirlik ve popup
        document.querySelectorAll('.result-box').forEach((el, i) => {
            el.onclick = () => {
                const row = results[i];
                let detaySatirlar = [];
                const figurler = ['1 FİGÜR', '2 FİGÜR', '3 FİGÜR', '4 FİGÜR', '6 FİGÜR'];
                figurler.forEach(figur => {
                    if (row[figur]) {
                        const parcalar = String(row[figur]).split(/\s+/).filter(Boolean);
                        for (let j = 0; j < parcalar.length; j += 2) {
                            let adet = parseInt(parcalar[j]);
                            let firma = parcalar[j+1] ? parcalar[j+1].toUpperCase() : '';
                            if (!isNaN(adet) && firma) {
                                for (let k = 0; k < adet; k++) {
                                    detaySatirlar.push(figur + ' ' + firma);
                                }
                            } else if (parcalar[j] && !isNaN(Number(parcalar[j])) === false) {
                                detaySatirlar.push(figur + ' ' + parcalar[j].toUpperCase());
                            }
                        }
                    }
                });
                showPopup(row, detaySatirlar, row['PROFİL KODU']);
            };
        });
    }, 50);
}

document.addEventListener('DOMContentLoaded', () => {
    waitProxyReady(fetchAndAnimateStats);
    initLogoAnim();
    initTitleAnim();
    // Arama butonu ve enter event
    document.getElementById('searchButton').addEventListener('click', () => {
        const kod = document.getElementById('kalipKodu').value;
        searchProfileCode(kod);
    });
    document.getElementById('kalipKodu').addEventListener('keydown', e => {
        if (e.key === 'Enter') {
            const kod = document.getElementById('kalipKodu').value;
            searchProfileCode(kod);
        }
    });
});
