import { fetch } from "undici"
import zlib from "zlib"
import { _tiktokvFeed } from "../../constants/api"
import { _tiktokApiParams } from "../../constants/params"
import { createDispatcher } from "../proxy"
import { PostStats, TiktokGetStatsResponse } from "../../types/get/getStats"

const USER_AGENT =
  "com.zhiliaoapp.musically/300904 (2018111632; U; Android 10; en_US; Pixel 4; Build/QQ3A.200805.001; Cronet/58.0.2991.0)"

const extractId = (input: string): string | null => {
  const trimmed = input.trim()
  if (/^\d{17,21}$/.test(trimmed)) {
    return trimmed
  }
  const matches = trimmed.match(/\d{17,21}/g)
  return matches ? matches[0] : null
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Primary fast resolver: TikWM (super fast ~400ms, no proxy required, handles videos & images)
const fetchFromTikwm = async (id: string, proxy?: string): Promise<PostStats | null> => {
  try {
    const url = `https://www.tikwm.com/api/?url=https://www.tiktok.com/@a/video/${id}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 4000)

    const res = await fetch(url, {
      signal: controller.signal,
      ...createDispatcher(proxy)
    })
    clearTimeout(timeout)

    if (!res.ok) return null
    const json: any = await res.json()
    if (json.code !== 0 || !json.data) return null

    const d = json.data
    return {
      id,
      playCount: d.play_count || 0,
      likeCount: d.digg_count || 0,
      commentCount: d.comment_count || 0,
      saveCount: d.collect_count || 0,
      shareCount: d.share_count || 0
    }
  } catch {
    return null
  }
}

// Fallback resolver: Direct mobile TikTok feed
const fetchFromTikTokFeed = async (id: string, proxy?: string): Promise<PostStats | null> => {
  try {
    const url = _tiktokvFeed(_tiktokApiParams({ aweme_id: id }))
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)

    const res = await fetch(url, {
      method: "OPTIONS",
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
      ...createDispatcher(proxy)
    })
    clearTimeout(timeout)

    if (!res.ok) return null
    const buffer = Buffer.from(await res.arrayBuffer())
    let data: any
    try {
      if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
        data = JSON.parse(zlib.gunzipSync(buffer).toString())
      } else {
        data = JSON.parse(buffer.toString())
      }
    } catch {
      return null
    }

    const content = data?.aweme_list?.find((v: any) => v.aweme_id === id)
    if (!content?.statistics) return null

    const s = content.statistics
    return {
      id,
      playCount: s.play_count || 0,
      likeCount: s.digg_count || 0,
      commentCount: s.comment_count || 0,
      saveCount: s.collect_count || 0,
      shareCount: s.share_count || 0
    }
  } catch {
    return null
  }
}

const fetchSingleStat = async (id: string, proxy?: string): Promise<PostStats | null> => {
  const fromTikwm = await fetchFromTikwm(id, proxy)
  if (fromTikwm) return fromTikwm

  return await fetchFromTikTokFeed(id, proxy)
}

export const getStats = async (
  idsOrUrls: string | string[],
  proxy?: string
): Promise<TiktokGetStatsResponse> => {
  const inputs = Array.isArray(idsOrUrls) ? idsOrUrls : [idsOrUrls]
  const validIds: string[] = []

  for (const input of inputs) {
    if (!input || typeof input !== "string") continue
    const id = extractId(input)
    if (id && !validIds.includes(id)) {
      validIds.push(id)
    }
  }

  if (validIds.length === 0) {
    return {
      status: "error",
      message: "No valid TikTok post IDs or URLs provided!"
    }
  }

  try {
    // Process with slight staggered delay to prevent rate limiting
    const results: PostStats[] = []

    for (let i = 0; i < validIds.length; i++) {
      if (i > 0) {
        await delay(120) // 120ms safety pause between requests
      }
      const stat = await fetchSingleStat(validIds[i], proxy)
      if (stat) {
        results.push(stat)
      }
    }

    if (results.length === 0) {
      return {
        status: "error",
        message: "Failed to fetch stats for provided IDs. Post(s) may be private or removed."
      }
    }

    return {
      status: "success",
      result: results
    }
  } catch (error: any) {
    return {
      status: "error",
      message: error?.message || "An error occurred while fetching stats"
    }
  }
}
