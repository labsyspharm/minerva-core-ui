import { chromium, test, expect } from '@playwright/test';

test('zoom', async () => {

  const browser = await chromium.launch({
    headless: false,
    devtools: true
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://localhost:5173/');

  // Get dimensions of visible area
  const { width, height } = await page.evaluate(() => ({
      width: window.innerWidth,
      height: window.innerHeight
  }));
  const start = [
    0.5 * width, 0.5 * height
  ].map(x => parseInt(x));

  const pre_ms = 5000;
  const scroll_ms = 1000;
  const scroll_speed = 0.5;
  const scroll_steps = 10;
  const post_ms = 20000;

  await page.waitForTimeout(pre_ms);
  const scrolls = (
    [...new Array(scroll_steps).keys()].map(() => (
      async () => {
        const half_step = scroll_ms/scroll_steps;
        await page.mouse.wheel(0, -half_step*scroll_speed);
        await page.waitForTimeout(half_step*(1-scroll_speed));
      }
    ))
  );
  await page.mouse.move(...start);
  for (const scroll of scrolls) {
    await scroll();
  }
  await page.waitForTimeout(post_ms);
  await browser.close();
});
