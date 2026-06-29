import puppeteer from 'puppeteer';

async function run() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto('https://desaparecidosterremotovenezuela.com/', { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const parsedData = await page.evaluate(() => {
      const card = document.querySelector('div[class*="styles_card__"]');
      if (!card) return { error: 'No card found' };

      const allChildren = Array.from(card.querySelectorAll('*')).map(el => {
        return {
          tagName: el.tagName,
          className: el.className,
          title: el.getAttribute('title'),
          innerText: el.innerText
        };
      });

      const titleElements = Array.from(card.querySelectorAll('[title]')).map(el => {
        return {
          tagName: el.tagName,
          title: el.getAttribute('title'),
          text: el.innerText
        };
      });

      return {
        allChildrenCount: allChildren.length,
        allChildrenSample: allChildren.slice(0, 10),
        titleElements
      };
    });
    
    console.log(JSON.stringify(parsedData, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
}

run();
