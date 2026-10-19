import { fetch } from "undici"
import { load } from "cheerio"
import { _tiktokDesktopUrl } from "../../constants/api"
import {
  AuthorPost,
  Posts,
  TiktokUserPostsResponse
} from "../../types/get/getUserPosts"
import { StalkUser } from "../get/getProfile"
import retry from "async-retry"
import { createDispatcher } from "../proxy"
// @ts-ignore
import xbogus from "../../../helper/xbogus"

export const getUserPosts = async (
  username: string,
  cookie?: string | string[],
  proxy?: string,
  postLimit?: number
): Promise<TiktokUserPostsResponse> => {
  try {
    const cleanUsername = username.replace(/^@/, "").trim()
    if (!cleanUsername) {
      return { status: "error", message: "Username is required!" }
    }

    let cookies = ""
    if (cookie) {
      cookies = Array.isArray(cookie) ? cookie.join("; ") : cookie
    } else {
      cookies = await getCookiesFromProfile(cleanUsername, proxy)
    }

    const profileRes = await StalkUser(cleanUsername, proxy, cookies || undefined)
    if (profileRes.status === "error" && profileRes.message === "User not found!") {
      return { status: "error", message: "User not found!" }
    }

    let data: Posts[] = []

    // 1. If cookies are available and we have secUid, try the web API item_list
    if (profileRes.status === "success" && profileRes.result?.user?.secUid) {
      const secUid = profileRes.result.user.secUid
      try {
        data = await parseUserPosts(secUid, postLimit, proxy, cookies)
      } catch {
        // Fall back to embed if API returned empty response or failed
        data = []
      }
    }

    // 2. Fallback: fetch public posts from TikTok embed
    if (!data.length) {
      try {
        data = await fetchPostsFromEmbed(
          cleanUsername,
          profileRes.status === "success" ? profileRes.result : undefined,
          postLimit,
          proxy
        )
      } catch (embedErr: any) {
        if (embedErr.message === "User not found!") {
          return { status: "error", message: "User not found!" }
        }
        if (profileRes.status === "error") {
          return { status: "error", message: profileRes.message || embedErr.message }
        }
        throw embedErr
      }
    }

    if (!data.length) {
      if (profileRes.status === "success" && profileRes.result?.stats?.videoCount === 0) {
        return { status: "error", message: "No posts found!" }
      }
      return {
        status: "error",
        message: "Unable to fetch posts. User not found or profile has no public posts."
      }
    }

    return { status: "success", result: data, totalPosts: data.length }
  } catch (err: any) {
    if (err.status == 400 || err.response?.data?.statusCode == 10201) {
      return { status: "error", message: "User not found!" }
    }
    return { status: "error", message: err.message || "Failed to fetch posts" }
  }
}

const getCookiesFromProfile = async (
  username: string,
  proxy?: string
): Promise<string> => {
  try {
    const response = await fetch(
      `${_tiktokDesktopUrl}/@${username.replace("@", "")}`,
      {
        headers: {
          "User-Agent": userAgent,
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9"
        },
        ...createDispatcher(proxy)
      }
    )
    const setCookies = (response.headers as any).getSetCookie?.() || []
    return setCookies.map((c: string) => c.split(";")[0]).join("; ")
  } catch {
    return ""
  }
}

export const fetchPostsFromEmbed = async (
  username: string,
  profileUser?: any,
  postLimit?: number,
  proxy?: string
): Promise<Posts[]> => {
  const cleanUsername = username.replace(/^@/, "").trim()
  const url = `${_tiktokDesktopUrl}/embed/@${cleanUsername}`

  const res = await fetch(url, {
    headers: {
      "User-Agent": userAgent,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9"
    },
    ...createDispatcher(proxy)
  })

  if (res.status === 400 || res.status === 404) {
    throw new Error("User not found!")
  }

  if (!res.ok) {
    throw new Error(`HTTP error: ${res.status}`)
  }

  const html = await res.text()
  const $ = load(html)
  const scriptText = $("#__FRONTITY_CONNECT_STATE__").text()
  if (!scriptText) {
    throw new Error("Failed to parse TikTok embed response")
  }

  let data: any
  try {
    data = JSON.parse(scriptText)
  } catch {
    throw new Error("Failed to parse TikTok embed JSON")
  }

  const key = `/embed/@${cleanUsername}`
  const embedData = data.source?.data?.[key]
  if (!embedData) {
    throw new Error("User not found!")
  }

  if (embedData.isError || embedData.userInfo?.code === 400) {
    throw new Error("User not found!")
  }

  const videoList: any[] = embedData.videoList || []
  if (!videoList.length) {
    return []
  }

  const authorInfo = embedData.userInfo || profileUser?.user

  const posts: Posts[] = videoList.map((v: any) => {
    let createTime = 0
    try {
      createTime = Number(BigInt(v.id) >> 32n)
    } catch {
      createTime = Math.floor(Date.now() / 1000)
    }

    const author: AuthorPost = {
      id:
        profileUser?.user?.uid ||
        profileUser?.user?.id ||
        authorInfo?.id ||
        "",
      username:
        profileUser?.user?.uniqueId ||
        authorInfo?.uniqueId ||
        v.authorUniqueId ||
        cleanUsername,
      nickname: profileUser?.user?.nickname || authorInfo?.nickname || "",
      avatarLarger:
        profileUser?.user?.avatarLarger || authorInfo?.avatarThumbUrl || "",
      avatarThumb:
        profileUser?.user?.avatarThumb || authorInfo?.avatarThumbUrl || "",
      avatarMedium:
        profileUser?.user?.avatarMedium || authorInfo?.avatarThumbUrl || "",
      signature: profileUser?.user?.signature || authorInfo?.signature || "",
      verified: Boolean(
        profileUser?.user?.verified ?? authorInfo?.verified
      ),
      openFavorite: Boolean(profileUser?.user?.openFavorite),
      privateAccount: Boolean(
        profileUser?.user?.privateAccount ?? authorInfo?.privateAccount
      ),
      isADVirtual: Boolean(profileUser?.user?.isADVirtual),
      isEmbedBanned: Boolean(profileUser?.user?.isEmbedBanned)
    }

    const video = {
      id: String(v.id),
      duration: v.video?.duration || 0,
      format: v.video?.format || "mp4",
      bitrate: v.video?.bitrate || 0,
      ratio: v.ratio || v.video?.ratio || "720p",
      playAddr: v.playAddr || v.video?.playAddr || "",
      cover: v.coverUrl || v.video?.cover || "",
      originCover: v.originCoverUrl || v.video?.originCover || "",
      dynamicCover: v.dynamicCoverUrl || v.video?.dynamicCover || "",
      downloadAddr: v.playAddr || v.video?.downloadAddr || ""
    }

    const stats = {
      likeCount: v.stats?.likeCount || 0,
      collectCount: v.stats?.collectCount || 0,
      commentCount: v.stats?.commentCount || 0,
      playCount: v.playCount || v.stats?.playCount || 0,
      shareCount: v.stats?.shareCount || 0
    }

    const music = {
      id: "",
      title: "",
      authorName: author.nickname,
      coverLarge: "",
      coverMedium: "",
      coverThumb: "",
      duration: 0,
      playUrl: "",
      original: true
    }

    return {
      id: String(v.id),
      desc: v.desc || "",
      createTime,
      digged: 0,
      duetEnabled: 1,
      forFriend: 0,
      officalItem: 0,
      originalItem: 0,
      privateItem: v.privateItem ? 1 : 0,
      shareEnabled: 1,
      stitchEnabled: 1,
      stats,
      author,
      video,
      music
    }
  })

  return postLimit ? posts.slice(0, postLimit) : posts
}

const parseUserPosts = async (
  secUid: string,
  postLimit?: number,
  proxy?: string,
  cookies?: string
): Promise<Posts[]> => {
  let page = 1
  let hasMore = true
  let responseCursor: string | number = 0
  const posts: Posts[] = []

  while (hasMore) {
    const count = page === 1 ? 35 : 30

    const result = await requestUserPosts(
      secUid,
      responseCursor,
      count,
      proxy,
      cookies
    )

    if (
      !result?.itemList ||
      !Array.isArray(result.itemList) ||
      result.itemList.length === 0
    ) {
      break
    }

    result.itemList.forEach((v: any) => {
      const author: AuthorPost = {
        id: v.author?.id || "",
        username: v.author?.uniqueId || "",
        nickname: v.author?.nickname || "",
        avatarLarger: v.author?.avatarLarger || "",
        avatarThumb: v.author?.avatarThumb || "",
        avatarMedium: v.author?.avatarMedium || "",
        signature: v.author?.signature || "",
        verified: Boolean(v.author?.verified),
        openFavorite: Boolean(v.author?.openFavorite),
        privateAccount: Boolean(v.author?.privateAccount),
        isADVirtual: Boolean(v.author?.isADVirtual),
        isEmbedBanned: Boolean(v.author?.isEmbedBanned)
      }

      if (v.imagePost) {
        const imagePost: string[] = (v.imagePost.images || []).map(
          (img: any) => img.imageURL?.urlList?.[0] || ""
        )

        posts.push({
          id: String(v.id),
          desc: v.desc || "",
          createTime: v.createTime || 0,
          digged: v.digged || 0,
          duetEnabled: v.duetEnabled || 0,
          forFriend: v.forFriend || 0,
          officalItem: v.officalItem || 0,
          originalItem: v.originalItem || 0,
          privateItem: v.privateItem || 0,
          shareEnabled: v.shareEnabled || 0,
          stitchEnabled: v.stitchEnabled || 0,
          stats: v.stats || {
            collectCount: 0,
            commentCount: 0,
            likeCount: 0,
            playCount: 0,
            shareCount: 0
          },
          music: v.music || {
            id: "",
            title: "",
            authorName: "",
            coverLarge: "",
            coverMedium: "",
            coverThumb: "",
            duration: 0,
            playUrl: "",
            original: false
          },
          author,
          imagePost
        })
      } else {
        const video = {
          id: String(v.video?.id || v.id),
          duration: v.video?.duration || 0,
          format: v.video?.format || "mp4",
          bitrate: v.video?.bitrate || 0,
          ratio: v.video?.ratio || "720p",
          playAddr: v.video?.playAddr || "",
          cover: v.video?.cover || "",
          originCover: v.video?.originCover || "",
          dynamicCover: v.video?.dynamicCover || "",
          downloadAddr: v.video?.downloadAddr || ""
        }

        posts.push({
          id: String(v.id),
          desc: v.desc || "",
          createTime: v.createTime || 0,
          digged: v.digged || 0,
          duetEnabled: v.duetEnabled || 0,
          forFriend: v.forFriend || 0,
          officalItem: v.officalItem || 0,
          originalItem: v.originalItem || 0,
          privateItem: v.privateItem || 0,
          shareEnabled: v.shareEnabled || 0,
          stitchEnabled: v.stitchEnabled || 0,
          stats: v.stats || {
            collectCount: 0,
            commentCount: 0,
            likeCount: 0,
            playCount: 0,
            shareCount: 0
          },
          music: v.music || {
            id: "",
            title: "",
            authorName: "",
            coverLarge: "",
            coverMedium: "",
            coverThumb: "",
            duration: 0,
            playUrl: "",
            original: false
          },
          author,
          video
        })
      }
    })

    hasMore = Boolean(result.hasMore)
    const nextCursor = result.cursor
    if (!nextCursor || nextCursor === responseCursor) {
      hasMore = false
      break
    }
    responseCursor = nextCursor
    page++

    if (postLimit && posts.length >= postLimit) {
      hasMore = false
      break
    }
  }

  return postLimit ? posts.slice(0, postLimit) : posts
}

const userAgent =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0"

const requestUserPosts = async (
  secUid: string,
  cursor: number | string = 0,
  count: number = 35,
  proxy?: string,
  cookies?: string
): Promise<any> => {
  return retry(
    async (bail, attempt) => {
      const params = new URLSearchParams({
        WebIdLastTime: Math.floor(Date.now() / 1000).toString(),
        aid: "1988",
        app_language: "en",
        app_name: "tiktok_web",
        browser_language: "en-US",
        browser_name: "Mozilla",
        browser_online: "true",
        browser_platform: "Win32",
        browser_version: userAgent.replace("Mozilla/", ""),
        channel: "tiktok_web",
        cookie_enabled: "true",
        count: count.toString(),
        coverFormat: "2",
        cursor: cursor.toString(),
        device_platform: "web_pc",
        focus_state: "true",
        history_len: "2",
        is_fullscreen: "false",
        is_page_visible: "true",
        language: "en",
        os: "windows",
        priority_region: "",
        referer: "",
        region: "ID",
        screen_height: "1080",
        screen_width: "1920",
        secUid: secUid,
        tz_name: "Asia/Jakarta",
        user_is_login: "false",
        webcast_language: "en"
      })

      const msTokenMatch = cookies?.match(/msToken=([^;]+)/)
      if (msTokenMatch) {
        params.append("msToken", msTokenMatch[1])
      }

      const baseUrl = `${_tiktokDesktopUrl}/api/post/item_list/?${params.toString()}`
      const xBogusValue = xbogus(baseUrl, userAgent)
      const finalUrl = `${baseUrl}&X-Bogus=${xBogusValue}`

      const res = await fetch(finalUrl, {
        headers: {
          "User-Agent": userAgent,
          Accept: "*/*",
          "Accept-Language": "en-US,en;q=0.9",
          Referer: `${_tiktokDesktopUrl}/`,
          "Sec-Ch-Ua":
            '"Not(A:Brand";v="8", "Chromium";v="144", "Microsoft Edge";v="144"',
          "Sec-Ch-Ua-Mobile": "?0",
          "Sec-Ch-Ua-Platform": '"Windows"',
          "Sec-Fetch-Dest": "empty",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Site": "same-origin",
          ...(cookies ? { Cookie: cookies } : {})
        },
        ...createDispatcher(proxy)
      })

      if (res.status === 400 || res.status === 404) {
        bail(new Error("User not found!"))
        return
      }

      if (res.status === 429) {
        if (attempt >= 2) {
          bail(new Error("Rate limited by TikTok. Please try again later."))
          return
        }
        throw new Error("Rate limited")
      }

      const raw = await res.text()
      if (!raw || !raw.trim()) {
        bail(new Error("Empty response"))
        return
      }

      let data: any
      try {
        data = JSON.parse(raw)
      } catch {
        bail(new Error("Empty response"))
        return
      }

      return data
    },
    {
      retries: 2,
      minTimeout: 500,
      maxTimeout: 2000,
      factor: 2
    }
  )
}
