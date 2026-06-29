import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('https://desaparecidosterremotovenezuela.com/', { waitUntil: 'networkidle2' });
    
    // Esperar a que la página se monte
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const structure = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (!main) return 'No main element found';
      
      // Obtener clases y estructura de primer y segundo nivel de main
      const children = Array.from(main.children).map((el, i) => {
        return `${i}: ${el.tagName}.${el.className} | InnerHTML: ${el.innerHTML.substring(0, 150)}...`;
      });
      
      return children.join('\n');
    });
    
    console.log('--- MAIN STRUCTURE ---');
    console.log(structure);
    console.log('----------------------');

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

run();
