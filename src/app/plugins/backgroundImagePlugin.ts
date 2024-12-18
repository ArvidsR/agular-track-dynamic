import { Chart, Plugin } from 'chart.js';

export const backgroundImagePlugin: Plugin<'scatter'> = {
  id: 'backgroundImagePlugin',
  beforeDraw: (chart: Chart) => { // Pareizs tips Chart
    const ctx = chart.ctx;

    const xScale = chart.scales['x'];
    const yScale = chart.scales['y'];

    if (!xScale || !yScale) return;

    let img: HTMLImageElement | null = (backgroundImagePlugin as any)._img;

    const drawImage = () => {
      if (img) {
        ctx.save();

        const dataA = { x: 0.023, y: 22.212 };
        const dataB = { x: -50.354, y: 0.014 };

        const pixelA = { x: 959.5, y: 186 };
        const pixelB = { x: 156, y: 539.5 };

        const canvasA = {
          x: xScale.getPixelForValue(dataA.x),
          y: yScale.getPixelForValue(dataA.y),
        };
        const canvasB = {
          x: xScale.getPixelForValue(dataB.x),
          y: yScale.getPixelForValue(dataB.y),
        };

        const scaleX = (canvasB.x - canvasA.x) / (pixelB.x - pixelA.x);
        const scaleY = (canvasB.y - canvasA.y) / (pixelB.y - pixelA.y);

        const offsetX = canvasA.x - pixelA.x * scaleX;
        const offsetY = canvasA.y - pixelA.y * scaleY;

        ctx.drawImage(
          img,
          offsetX,
          offsetY,
          img.width * scaleX,
          img.height * scaleY
        );

        ctx.restore();
      }
    };

    if (!img) {
      img = new Image();
      img.src = 'assets/track-image.png';
      img.onload = () => {
        (backgroundImagePlugin as any)._img = img;
        chart.update();
      };
    } else {
      drawImage();
    }
  }
};