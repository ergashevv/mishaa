'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface ComicMastheadProps {
  title: string;
  issue: string;
  price: string;
  month: string;
}

export function ComicMasthead({ title, issue, price, month }: ComicMastheadProps) {
  return (
    <div className="absolute top-0 left-0 w-full z-[80] pointer-events-none p-4">
      <div className="relative">
        {/* The Bold Marvel-style Header */}
        <motion.div 
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col"
        >
          <div className="flex items-end justify-between border-b-4 border-black pb-1">
             <div className="flex flex-col">
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-black bg-white px-2 py-0.5 w-fit mb-1">Marvel Premiere</span>
                <h1 className="text-6xl font-black italic uppercase tracking-tighter text-black leading-none" style={{ fontFamily: 'Impact, sans-serif' }}>
                   {title || 'FOUNDRY'}
                </h1>
             </div>
             <div className="flex flex-col items-end">
                <div className="bg-black text-white px-3 py-1 text-[12px] font-black uppercase tracking-widest">
                   {issue}
                </div>
                <div className="text-[8px] font-black uppercase tracking-widest text-black mt-1">
                   {month} // {price}
                </div>
             </div>
          </div>
          
          <div className="flex justify-between items-start mt-2">
             <div className="w-16 h-20 bg-white border-2 border-black flex flex-col items-center justify-center gap-1">
                <div className="w-10 h-0.5 bg-black" />
                <div className="w-12 h-0.5 bg-black" />
                <div className="w-8 h-0.5 bg-black" />
                <span className="text-[6px] font-black">BARCODE</span>
             </div>
             <div className="text-[7px] font-black uppercase tracking-widest text-right max-w-[150px] leading-tight">
                "THE MOST DYNAMIC ACTION OF THE NEW GENERATION!"
             </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
