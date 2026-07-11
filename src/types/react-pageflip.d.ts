declare module 'react-pageflip' {
  import * as React from 'react';
  const HTMLFlipBook: React.ForwardRefExoticComponent<
    React.PropsWithChildren<Record<string, unknown>> & React.RefAttributes<unknown>
  >;
  export default HTMLFlipBook;
}
