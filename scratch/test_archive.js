async function test() {
  const queries = [
    'collection:(comic_books_archive) AND Marvel',
    'subject:(Marvel Comics) AND mediatype:texts',
    'collection:(comic_books) AND Marvel'
  ];
  for (const query of queries) {
    const url = `https://archive.org/advancedsearch.php?q=${query}&fl[]=identifier,title&rows=5&page=1&output=json`;
    console.log("Query:", query);
    try {
      const res = await fetch(url);
      const data = await res.json();
      console.log("Results count:", data.response.numFound);
      console.log("First 3 titles:", data.response.docs.slice(0, 3).map(d => d.title));
    } catch (e) {
      console.error(e);
    }
  }
}
test();
