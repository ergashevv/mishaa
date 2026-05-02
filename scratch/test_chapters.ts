
import { getChapters } from '../src/actions/comic';

async function test() {
  const chapters = await getChapters('mangadex', 'e78a489b-6632-4d61-b00b-5206f5b8b22b', 'en');
  console.log('Chapters found:', chapters.length);
  if (chapters.length > 0) {
    console.log('First chapter:', chapters[0]);
  }
}

test();
