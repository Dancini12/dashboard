const FEEDS = {
  agro:    "https://news.google.com/rss/search?q=agroneg%C3%B3cio+OR+soja+OR+milho+OR+boi+gordo+brasil+when%3A7d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
  mercado: "https://news.google.com/rss/search?q=economia+brasil+OR+d%C3%B3lar+OR+selic+OR+bolsa+when%3A7d&hl=pt-BR&gl=BR&ceid=BR:pt-419",
};

function getTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}(?:[^>]*)><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`))?.[1]
    ?? xml.match(new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`))?.[1]
    ?? "";
  return m.trim();
}

function getAttr(xml, tag, attr) {
  return xml.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`))?.[ 1] ?? "";
}

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ");
}

export default async function handler(req, res) {
  const feed = req.query?.feed ?? "agro";
  const url = FEEDS[feed];
  if (!url) return res.status(400).json({ error: "feed inválido" });

  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
    if (!r.ok) throw new Error(`RSS status ${r.status}`);
    const xml = await r.text();

    const items = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block = m[1];
      const rawTitle = decodeEntities(getTag(block, "title"));
      const lastDash = rawTitle.lastIndexOf(" - ");
      const title  = lastDash > 0 ? rawTitle.slice(0, lastDash).trim() : rawTitle;
      const author = lastDash > 0 ? rawTitle.slice(lastDash + 3).trim() : getTag(block, "source");
      const link      = getTag(block, "link") || getAttr(block, "link", "href");
      const pubDate   = getTag(block, "pubDate");
      const thumbnail = getAttr(block, "media:thumbnail", "url") || getAttr(block, "enclosure", "url");

      if (title) items.push({ title, author, link, pubDate, thumbnail });
    }

    items.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({ status: "ok", items: items.slice(0, 20) });
  } catch (err) {
    res.status(500).json({ error: "falha ao buscar notícias", detail: err.message });
  }
}
