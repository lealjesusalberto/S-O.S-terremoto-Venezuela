import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('https://desaparecidosterremotovenezuela.com/', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const cardHtml = await page.evaluate(() => {
      const card = document.querySelector('div[class*="styles_card__"]');
      return card ? card.outerHTML : 'No card element found';
    });
    
    console.log('--- CARD HTML ---');
    console.log(cardHtml);
    console.log('-----------------');

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

run();
