"use client";

import React from "react";

export function ChartBackground() {
  const generateData = () => {
    const data = [];
    // We want a very clean sine wave pattern as seen in the reference
    for (let i = 0; i < 200; i++) {
      // Primary wave + secondary wave for organic but clean look
      const wave = Math.sin(i * 0.15) * 80 + Math.sin(i * 0.05) * 120;
      // Add very slight noise to the body open/close to simulate candles
      const noise = Math.sin(i * 4.321) * 15;
      
      // Calculate Y position (SVG Y is inverted)
      // Moved from 400 to 250 to shift the entire chart much higher on the screen
      const center = 250 - wave;
      
      const open = center + noise;
      const close = center - noise;
      
      // Wicks extend slightly beyond the body
      const high = Math.min(open, close) - 10 - Math.abs(Math.sin(i * 3.14) * 15);
      const low = Math.max(open, close) + 10 + Math.abs(Math.sin(i * 2.71) * 15);
      
      data.push({
        up: close < open,
        open,
        close,
        high,
        low,
      });
    }
    return data;
  };

  const CHART_DATA = generateData();

  // Tightly packed spacing to match the reference image
  const CANDLE_SPACING = 14; 
  const CANDLE_WIDTH = 8;
  const VIEWBOX_WIDTH = 200 * CANDLE_SPACING + 40;

  return (
    <svg className="absolute w-full h-[140%] -top-[20%] opacity-[0.05] z-0 pointer-events-none" viewBox={`0 0 ${VIEWBOX_WIDTH} 800`} preserveAspectRatio="xMidYMid slice">
      {/* Candlesticks only - deeply packed */}
      <g stroke="#16a34a" strokeWidth="1.5">
        {CHART_DATA.map((d, i) => {
          const x = i * CANDLE_SPACING + 20;
          const bodyY = Math.min(d.open, d.close);
          const bodyHeight = Math.max(Math.abs(d.close - d.open), 4); // ensure min height
          
          return (
            <g key={`candle-${i}`}>
              {/* Wick */}
              <line x1={x} y1={d.high} x2={x} y2={d.low} />
              {/* Body */}
              <rect 
                x={x - (CANDLE_WIDTH / 2)} 
                y={bodyY} 
                width={CANDLE_WIDTH} 
                height={bodyHeight} 
                fill={d.up ? "#fdfdfd" : "#16a34a"} 
                stroke="#16a34a" 
              />
            </g>
          );
        })}
      </g>
    </svg>
  );
}
