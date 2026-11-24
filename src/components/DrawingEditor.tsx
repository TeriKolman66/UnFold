import { useEffect, useRef, useState } from 'react';
import type { EmbeddedAttachment } from '../types';

const WIDTH = 640;
const HEIGHT = 360;

export function DrawingEditor({ attachment, onChange }: { attachment?: EmbeddedAttachment; onChange: (attachment: EmbeddedAttachment) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [color, setColor] = useState('#f2f2f2');

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;
    context.fillStyle = '#111111';
    context.fillRect(0, 0, WIDTH, HEIGHT);
    if (!attachment?.dataUrl) return;
    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, WIDTH, HEIGHT);
    image.src = attachment.dataUrl;
  }, [attachment?.dataUrl]);

  const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * WIDTH / rect.width, y: (event.clientY - rect.top) * HEIGHT / rect.height };
  };
  const save = () => {
    const dataUrl = canvasRef.current?.toDataURL('image/png');
    if (dataUrl) onChange({ name: 'drawing.png', mimeType: 'image/png', size: Math.round(dataUrl.length * .75), dataUrl });
  };
  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const { x, y } = point(event);
    drawing.current = true;
    context.strokeStyle = color;
    context.lineWidth = 4;
    context.lineJoin = 'round';
    context.lineCap = 'round';
    context.beginPath();
    context.moveTo(x, y);
    context.lineTo(x + .01, y + .01);
    context.stroke();
  };
  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.stroke();
  };
  const stop = () => { if (drawing.current) { drawing.current = false; save(); } };
  const clear = () => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) return;
    context.fillStyle = '#111111';
    context.fillRect(0, 0, WIDTH, HEIGHT);
    save();
  };

  return <div className="drawing-editor">
    <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} onPointerDown={start} onPointerMove={move} onPointerUp={stop} onPointerCancel={stop} aria-label="Draw inside this clue" />
    <div><button className={color === '#f2f2f2' ? 'active' : ''} onClick={() => setColor('#f2f2f2')}>White</button><button className={color === '#cf5863' ? 'active' : ''} onClick={() => setColor('#cf5863')}>Red</button><button onClick={clear}>Clear</button></div>
  </div>;
}
