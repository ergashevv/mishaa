'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';

interface InkCanvasProps {
  inkData?: string;
  onUpdate: (data: string) => void;
  isLocked: boolean;
  color?: string;
  weight?: number;
}

export function InkCanvas({ inkData, onUpdate, isLocked, color = '#000000', weight = 2 }: InkCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Load existing inkData
    if (inkData) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0);
      img.src = inkData;
    }
  }, []);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (isLocked) return;
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas) {
      onUpdate(canvas.toDataURL());
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isLocked) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    ctx.lineWidth = weight;
    ctx.lineCap = 'round';
    ctx.strokeStyle = color;

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  return (
    <canvas
      ref={canvasRef}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseOut={stopDrawing}
      onTouchStart={startDrawing}
      onTouchMove={draw}
      onTouchEnd={stopDrawing}
      width={1000}
      height={1000}
      className={`absolute inset-0 w-full h-full z-10 touch-none ${isLocked ? 'pointer-events-none' : 'cursor-crosshair'}`}
    />
  );
}
