import { ReactNode } from 'react';
import { 
  Plus, Trash2, Zap, MessageCircle, Cloud, Star, AlignLeft, 
  RotateCcw, Sparkles, User, FileDown, Smartphone, Monitor, BookOpen, 
  BookMarked, FilePlus, Copy, Command, Smartphone as PhoneIcon
} from 'lucide-react';

export type Lang = 'en' | 'ru' | 'uz';
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
}

export interface BubbleConfig {
  label: string;
  icon: ReactNode;
  color: string;
  bgColor: string;
  textColor: string;
  borderStyle: string;
}
