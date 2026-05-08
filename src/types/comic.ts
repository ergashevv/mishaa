import { ReactNode } from 'react';

export type Lang = 'en' | 'ru';
export type BubbleType = 'speech' | 'thought' | 'shout' | 'caption' | 'narration' | 'sfx';
export type BubblePosition = 
  'top-left' | 'top-center' | 'top-right' | 
  'mid-left' | 'mid-center' | 'mid-right' | 
  'bot-left' | 'bot-center' | 'bot-right';

export interface TextElement {
  id: string;
  type: BubbleType;
  text: string;
  position?: BubblePosition;
  x?: number; // %
  y?: number; // %
  tailX?: number; // % offset
  tailY?: number; // % offset
  charName?: string;
  fontSize?: number;
  rotation?: number;
  color?: string;
  bgColor?: string;
  fontFamily?: string;
}

export interface Panel {
  id: string;
  prompt: string;
  status: 'idle' | 'loading' | 'success' | 'error';
  image?: string;
  textElements: TextElement[];
  size: PanelSize;
  rowSpan?: number;
  colSpan?: number;
  customHeight?: string;
  characterIds?: string[]; // IDs of characters in this panel
  shotType?: string;      // close-up, wide, etc.
  lighting?: string;      // cinematic, moody, etc.
  draftX?: number;        // Figma-style drafting X
  draftY?: number;        // Figma-style drafting Y
  filter?: string;        // Visual filter (halftone, noir, etc.)
  clipPath?: string;      // Non-rectangular panel cuts
  rotation?: number;      // Panel rotation (degrees)
  zIndex?: number;        // Depth layering
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  brightness?: number;    // Image adjustment
  contrast?: number;      // Image adjustment
  inkData?: string;       // Serialized ink paths (SVG/Base64)
  imageScale?: number;    // Zoom inside panel
  imageX?: number;        // Pan X inside panel
  imageY?: number;        // Pan Y inside panel
}

export interface ComicPage {
  id: string;
  title: string;
  panels: Panel[];
  issueNumber?: string;
  price?: string;
  releaseMonth?: string;
  isCover?: boolean;
}

export type PanelSize = 'small' | 'medium' | 'large' | 'wide' | 'mega';

export interface Character {
  id: string;
  name: string;
  role: string;
  description: string;
  imageUrl: string;
  promptBase?: string;    // Core visual prompt for AI consistency
}

export interface BubbleConfig {
  label: string;
  icon: ReactNode;
  color: string;
  bgColor: string;
  textColor: string;
  borderStyle: string;
}

// --- Library Feature Types ---
export interface ComicBook {
  id: string;
  title: string;
  issueNumber: number;
  coverImage: string;
  description: string;
  publisher: string;
  publishedDate: string;
  pages: string[]; // List of image URLs for the pages
  category: 'Golden Age' | 'Silver Age' | 'Modern' | 'Indie';
}

export interface ComicGalleryProps {
  comics: ComicBook[];
}
