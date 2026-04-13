// data/news.service.js
import { NEWS_MOCK } from "./news.mock.js";

/**
 * Contrato único: devuelve { items: [], meta: {} }
 * Así después cambiamos mock por RSS sin tocar la UI.
 */
export async function getNewsMock() {
  // simulamos latencia real
  await new Promise((r) => setTimeout(r, 250));

  // orden por fecha desc (más nuevas primero)
  const items = [...NEWS_MOCK].sort(
    (a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)
  );

  return {
    items,
    meta: {
      source: "mock",
      total: items.length,
      generatedAt: new Date().toISOString()
    }
  };
}