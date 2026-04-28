import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { nameStartsWith, limit = 10 } = await req.json();
    const apiKey = process.env.RAPIDAPI_KEY;

    if (!apiKey) {
      return NextResponse.json({ error: "RapidAPI Key not configured." }, { status: 500 });
    }

    const response = await fetch("https://marvelstefan-skliarovv1.p.rapidapi.com/getCharacters", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-rapidapi-host": "marvelstefan-skliarovv1.p.rapidapi.com",
        "x-rapidapi-key": apiKey
      },
      body: new URLSearchParams({
        nameStartsWith: nameStartsWith || "",
        limit: limit.toString()
      })
    });

    if (!response.ok) {
      const errData = await response.text();
      console.error("Marvel API Error:", errData);
      return NextResponse.json({ error: "Failed to fetch from Marvel API" }, { status: response.status });
    }

    const data = await response.json();
    // RapidAPI response format might vary, but usually it returns a list of characters
    // Based on official Marvel API (which this likely proxies), it's data.results
    return NextResponse.json(data);
  } catch (error: unknown) {
    console.error("Marvel Proxy Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
