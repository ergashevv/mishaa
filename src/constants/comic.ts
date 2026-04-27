import React from 'react';
import { 
  MessageCircle, Cloud, Star, AlignLeft, Zap
} from 'lucide-react';
import { BubbleConfig, BubbleType } from '@/types/comic';

export const ART_STYLES: Record<string, string> = {
  'Industrial Noir': 'Industrial noir, high contrast, heavy shadows, metallic textures, cinematic lighting',
  'Marvel Classic': 'Classic Marvel comic book style, bold lines, vibrant colors, superhero dynamic',
  'Cyberpunk': 'Cyberpunk aesthetic, neon glows, rainy streets, futuristic tech, high detail',
  'Manga': 'High quality manga style, clean lines, halftone patterns, expressive features',
  'Watercolor': 'Watercolor painting, soft edges, paper texture, fluid washes, artistic',
  'Oil Painting': 'Impressionist oil painting, heavy brushstrokes, rich textures, classical art style',
  'Line Art': 'Minimalist line art, clean black and white, simple vectors',
  'Ukiyo-e': 'Traditional Japanese Ukiyo-e woodblock print style, flat colors, classical motifs',
  'Crayon': 'Childlike crayon drawing, rough textures, vibrant colors, hand-drawn look',
  'Custom': '',
};

export const BUBBLE_CONFIGS: Record<BubbleType, BubbleConfig> = {
  speech: {
    label: 'Speech', icon: React.createElement(MessageCircle, { size: 11 }), color: '#ffffff', bgColor: '#ffffff',
    textColor: '#000000', borderStyle: 'solid',
  },
  thought: {
    label: 'Thought', icon: React.createElement(Cloud, { size: 11 }), color: '#f8fafc', bgColor: '#f8fafc',
    textColor: '#1e293b', borderStyle: 'dashed',
  },
  shout: {
    label: 'Shout', icon: React.createElement(Star, { size: 11 }), color: '#ff4d00', bgColor: '#ff4d00',
    textColor: '#ffffff', borderStyle: 'solid',
  },
  caption: {
    label: 'Caption', icon: React.createElement(Zap, { size: 11 }), color: '#000000', bgColor: '#000000',
    textColor: '#ffffff', borderStyle: 'solid',
  },
  narration: {
    label: 'Narration', icon: React.createElement(AlignLeft, { size: 11 }), color: '#0f172a', bgColor: '#0f172a',
    textColor: '#ffffff', borderStyle: 'solid',
  },
  sfx: {
    label: 'SFX', icon: React.createElement(Zap, { size: 11 }), color: '#facc15', bgColor: '#facc15',
    textColor: '#000000', borderStyle: 'solid',
  },
};

export const SHOT_TYPES = [
  { id: 'close-up', name: 'Close Up', prompt: 'extreme close-up portait, high detail face', icon: '👤' },
  { id: 'medium', name: 'Medium', prompt: 'medium shot, waist up', icon: '🧍' },
  { id: 'wide', name: 'Wide', prompt: 'wide shot, full body, cinematic background', icon: '🌄' },
  { id: 'low-angle', name: 'Low Angle', prompt: 'low angle shot, looking up, heroic perspective', icon: '📐' },
  { id: 'bird-eye', name: 'Bird Eye', prompt: 'overhead bird eye view, top-down perspective', icon: '🦅' },
];

export const PRINT_STANDARDS = [
  { 
    id: 'us-comic', 
    label: 'American Standard', 
    desc: 'DC/Marvel Standard (6.625" x 10.25")',
    width: 198.75, // in mm approx
    height: 307.5, // in mm approx
    bleed: 3.175,  // 0.125" bleed
    safeArea: 12.7, // 0.5" margin
    icon: 'BookOpen' 
  },
  { 
    id: 'manga-tankobon', 
    label: 'Manga Tankobon', 
    desc: 'Standard Japanese B6 (5" x 7.5")',
    width: 128,
    height: 182,
    bleed: 3,
    safeArea: 10,
    icon: 'BookMarked' 
  },
  { 
    id: 'european-album', 
    label: 'European Album', 
    desc: 'Standard A4 (8.3" x 11.7")',
    width: 210,
    height: 297,
    bleed: 5,
    safeArea: 15,
    icon: 'FilePlus' 
  },
  { 
    id: 'webtoon', 
    label: 'Digital Webtoon', 
    desc: 'Optimized for Mobile Scroll (800px width)',
    width: 211, // aspect ratio equivalent
    height: 600, // variable
    bleed: 0,
    safeArea: 20,
    icon: 'Smartphone' 
  },
];

export const PDF_SIZES = PRINT_STANDARDS;

export const POSITIONS = {
  'top-left': 'top-4 left-4',
  'top-center': 'top-4 left-1/2 -translate-x-1/2',
  'top-right': 'top-4 right-4',
  'mid-left': 'top-1/2 left-4 -translate-y-1/2',
  'mid-center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
  'mid-right': 'top-1/2 right-4 -translate-y-1/2',
  'bot-left': 'bottom-8 left-4',
  'bot-center': 'bottom-8 left-1/2 -translate-x-1/2',
  'bot-right': 'bottom-8 right-4',
};
