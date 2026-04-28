async function test() {
  const id = 'batman-the-killing-joke_202508';
  for (let i = 0; i < 5; i++) {
    const url = `https://archive.org/services/img/${id}/${i}`;
    console.log("Testing:", url);
    try {
      const res = await fetch(url, { method: 'HEAD' });
      console.log(`Page ${i} status:`, res.status);
    } catch (e) {
      console.error(e);
    }
  }
}
test();
