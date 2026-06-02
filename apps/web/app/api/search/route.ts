/**
 * Live product-search suggestions for the header autocomplete. Returns the top
 * trigram-ranked matches as lightweight JSON (the dropdown renders the price in
 * the shopper's currency itself via the client `<Price>`). Blank/short queries
 * return an empty list. Read-only and cheap; the heavy lifting is the single
 * indexed query in `searchSuggestions`.
 */
import { NextResponse } from "next/server"

import { reportError } from "@/lib/errors"
import { searchSuggestions, SEARCH_MIN_CHARS } from "@/lib/repos/products.repo"

/** Max suggestions surfaced in the dropdown. */
const SUGGESTION_LIMIT = 6

export async function GET(request: Request): Promise<Response> {
  const q = new URL(request.url).searchParams.get("q")?.trim() ?? ""
  if (q.length < SEARCH_MIN_CHARS) {
    return NextResponse.json({ results: [] })
  }

  try {
    const results = await searchSuggestions(q, SUGGESTION_LIMIT)
    return NextResponse.json({ results })
  } catch (error) {
    reportError("api:search", error, { q })
    // Degrade quietly — a failed suggestion fetch must never break typing.
    return NextResponse.json({ results: [] }, { status: 200 })
  }
}
