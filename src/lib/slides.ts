export interface Slide {
  id: number;
  caption: string;
  mobileImage: string;
  desktopImage: string;
  type: 'image' | 'final' | 'title';
  titleText?: string;
  subtitleText?: string;
}

export const slides: Slide[] = [
  // Part 1
  {
    id: 1,
    caption: "",
    mobileImage: "/story1-mobile.png",
    desktopImage: "/story1-desktop.png",
    type: 'image'
  },
  {
    id: 2,
    caption: "",
    mobileImage: "/story2-mobile.png",
    desktopImage: "/story2-desktop.png",
    type: 'image'
  },
  {
    id: 3,
    caption: "",
    mobileImage: "/story3-mobile.png",
    desktopImage: "/story3-desktop.png",
    type: 'image'
  },
  {
    id: 4,
    caption: "",
    mobileImage: "/story4-mobile.png",
    desktopImage: "/story4-desktop.png",
    type: 'image'
  },
  {
    id: 5,
    caption: "",
    mobileImage: "/story5-mobile.png",
    desktopImage: "/story5-desktop.png",
    type: 'image'
  },
  {
    id: 6,
    caption: "",
    mobileImage: "/story6-mobile.png",
    desktopImage: "/story6-desktop.png",
    type: 'image'
  },
  // MOVIE TITLE SLIDE
  {
    id: 7,
    type: 'title',
    titleText: "SEASON 2",
    subtitleText: "THE UNTOLD CHAPTER",
    caption: "",
    mobileImage: "",
    desktopImage: ""
  },
  // Part 2
  {
    id: 8,
    caption: "",
    mobileImage: "/new1-mobile.png",
    desktopImage: "/new1-desktop.png",
    type: 'image'
  },
  {
    id: 9,
    caption: "",
    mobileImage: "/new2-mobile.png",
    desktopImage: "/new2-desktop.png",
    type: 'image'
  },
  {
    id: 10,
    caption: "",
    mobileImage: "/new3-mobile.png",
    desktopImage: "/new3-desktop.png",
    type: 'image'
  },
  {
    id: 11,
    caption: "",
    mobileImage: "/new4-mobile.png",
    desktopImage: "/new4-desktop.png",
    type: 'image'
  },
  {
    id: 12,
    caption: "",
    mobileImage: "/new5-mobile.png",
    desktopImage: "/new5-desktop.png",
    type: 'image'
  },
  {
    id: 13,
    caption: "",
    mobileImage: "/new6-mobile.png",
    desktopImage: "/new6-desktop.png",
    type: 'image'
  },
  // Final Slide
  {
    id: 14,
    type: 'final',
    mobileImage: "",
    desktopImage: "",
    caption: "Send help 🙏"
  }
];
