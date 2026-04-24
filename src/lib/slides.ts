export interface Slide {
  id: number;
  caption: string;
  mobileImage: string;
  desktopImage: string;
  type: 'image' | 'final';
}

export const slides: Slide[] = [
  {
    id: 1,
    caption: "It's been a long week...",
    mobileImage: "/story1-mobile.png",
    desktopImage: "/story1-desktop.png",
    type: 'image'
  },
  {
    id: 2,
    caption: "I checked my wallet today...",
    mobileImage: "/story2-mobile.png",
    desktopImage: "/story2-desktop.png",
    type: 'image'
  },
  {
    id: 3,
    caption: "My stomach thinks my throat has been cut 😭",
    mobileImage: "/story3-mobile.png",
    desktopImage: "/story3-desktop.png",
    type: 'image'
  },
  {
    id: 4,
    caption: "I walked past KFC and... I can still smell it",
    mobileImage: "/story4-mobile.png",
    desktopImage: "/story4-desktop.png",
    type: 'image'
  },
  {
    id: 5,
    caption: "Current living situation: Minimalist (Broke)",
    mobileImage: "/story5-mobile.png",
    desktopImage: "/story5-desktop.png",
    type: 'image'
  },
  {
    id: 6,
    caption: "My last resort... 🙏",
    mobileImage: "/story6-mobile.png",
    desktopImage: "/story6-desktop.png",
    type: 'image'
  },
  {
    id: 7,
    type: 'final',
    mobileImage: "",
    desktopImage: "",
    caption: "Send help 🙏"
  }
];
