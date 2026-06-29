import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function run() {
  const PAGES_TO_SCRAPE = 5; // Número de páginas de reportes recientes a extraer
  console.log(`Iniciando extractor para desaparecidosterremotovenezuela.com (Páginas a extraer: ${PAGES_TO_SCRAPE})...`);
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  try {
    await page.setViewport({ width: 1280, height: 900 });
    
    console.log('Navegando a la página principal...');
    await page.goto('https://desaparecidosterremotovenezuela.com/', {
      waitUntil: 'networkidle2',
      timeout: 60000
    });

    let allReports = [];

    for (let pageNum = 1; pageNum <= PAGES_TO_SCRAPE; pageNum++) {
      console.log(`\n--- Procesando página ${pageNum} de ${PAGES_TO_SCRAPE} ---`);
      
      // Esperar a que las tarjetas estén visibles
      await page.waitForSelector('h3', { timeout: 15000 });
      
      // Extraer reportes de la página actual
      const reportsOnPage = await page.evaluate(() => {
        const h3Elements = Array.from(document.querySelectorAll('h3'));
        
        const cards = h3Elements.map(h3 => {
          let parent = h3.parentElement;
          while (parent && !parent.className.includes('styles_card__') && parent.tagName !== 'BODY') {
            parent = parent.parentElement;
          }
          return parent && parent.tagName !== 'BODY' ? parent : null;
        }).filter(c => c !== null);

        return cards.map(card => {
          const nameEl = card.querySelector('h3');
          if (!nameEl) return null;
          const name = nameEl.innerText.trim();

          // Estado del reporte (badge)
          const badgeEl = card.querySelector('span[class*="styles_badge__"]');
          const badgeText = badgeEl ? badgeEl.innerText.trim() : '';
          
          let status = 'missing'; // missing | safe | hospitalized | located
          if (badgeText.includes('Localizado') || badgeText.includes('A salvo') || badgeText.includes('A Salvo')) {
            status = 'safe';
          } else if (badgeText.includes('hospital') || badgeText.includes('Hospital') || badgeText.includes('Hospitalizado')) {
            status = 'hospitalized';
          } else if (badgeText.includes('centro') || badgeText.includes('Centro')) {
            status = 'located';
          }

          // Ubicación
          const locEl = card.querySelector('div[class*="styles_location__"] span');
          const locationName = locEl ? locEl.innerText.trim() : 'Desconocido';

          // Edad
          let age = null;
          const ageEl = card.querySelector('p[class*="styles_edad__"]');
          if (ageEl) {
            const match = ageEl.innerText.match(/\d+/);
            if (match) age = parseInt(match[0], 10);
          }

          // Fecha
          const dateEl = card.querySelector('div[class*="styles_footer__"] span');
          const date = dateEl ? dateEl.innerText.trim() : '';

          // Foto del desaparecido
          const imgEl = card.querySelector('img');
          let photoUrl = imgEl ? imgEl.src : null;
          
          // Omitir avatares por defecto
          if (photoUrl && (photoUrl.includes('flaticon.com') || photoUrl.includes('avatar') || photoUrl.includes('placeholder'))) {
            photoUrl = null;
          }

          // Crear descripción legible
          let description = '';
          if (age) {
            description += `${age} años de edad. `;
          }
          description += `Visto por última vez en ${locationName} el ${date || 'recientemente'}.`;

          return {
            name,
            age,
            status,
            locationName,
            description,
            photoUrl,
            createdAt: new Date().toISOString()
          };
        }).filter(r => r !== null);
      });

      console.log(`Extraídos ${reportsOnPage.length} reportes de la página ${pageNum}.`);
      allReports = allReports.concat(reportsOnPage);

      // Si no es la última página, hacer clic en "Siguiente"
      if (pageNum < PAGES_TO_SCRAPE) {
        const nextButton = await page.$('button[aria-label="Página siguiente"]');
        if (nextButton) {
          const isDisabled = await page.evaluate(btn => btn.disabled, nextButton);
          if (isDisabled) {
            console.log('El botón "Siguiente" está deshabilitado. Fin de los datos.');
            break;
          }
          
          console.log('Haciendo clic en el botón Siguiente...');
          await nextButton.click();
          await new Promise(resolve => setTimeout(resolve, 2500));
        } else {
          console.log('No se encontró el botón "Siguiente".');
          break;
        }
      }
    }

    console.log(`\nProceso finalizado. Total reportes acumulados: ${allReports.length}`);
    
    const dataDir = path.join(__dirname, '../src/data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const outputPath = path.join(dataDir, 'scraped_reports.json');
    fs.writeFileSync(outputPath, JSON.stringify(allReports, null, 2), 'utf-8');
    console.log(`Datos guardados con éxito en: ${outputPath}`);

  } catch (error) {
    console.error('❌ Error durante la extracción:', error);
  } finally {
    await browser.close();
    console.log('Navegador cerrado.');
  }
}

run();
