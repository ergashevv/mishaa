async function test() {
  const queries = [
    'subject:("DC Comics") AND language:(eng) AND mediatype:texts AND NOT collection:printdisabled',
    'subject:("Marvel Comics") AND language:(eng) AND mediatype:texts AND NOT collection:printdisabled'
  ];
  for (const query of queries) {
    const url = `https://archive.org/advancedsearch.php?q=${query}&fl[]=identifier,title,language,collection&rows=10&page=1&output=json`;
    console.log("Query:", query);
    try {
      const res = await fetch(url);
      const data = await res.json();
      console.log("Results count:", data.response.numFound);
      console.log("First 5 titles:", data.response.docs.slice(0, 5).map(d => d.title));
    } catch (e) {
      console.error(e);
    }
  }
}
test();
