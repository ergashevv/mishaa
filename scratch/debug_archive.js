async function debugMetadata(id) {
  const url = `https://archive.org/metadata/${id}`;
  const res = await fetch(url);
  const data = await res.json();
  console.log("ID:", id);
  console.log("Metadata Page Count:", data.metadata.page_count);
  console.log("Files (first 10):", data.files.slice(0, 10).map(f => ({ name: f.name, format: f.format })));
}

// Let's find some Marvel IDs first
async function findIds() {
  const query = 'subject:("Marvel Comics") AND mediatype:texts';
  const url = `https://archive.org/advancedsearch.php?q=${query}&fl[]=identifier&rows=3&page=1&output=json`;
  const res = await fetch(url);
  const data = await res.json();
  for (const doc of data.response.docs) {
    await debugMetadata(doc.identifier);
  }
}

findIds();
