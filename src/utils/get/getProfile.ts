import { load } from "cheerio"
import { _tiktokDesktopUrl } from "../../constants/api"
import {
  TiktokStalkUserResponse,
  StatsUserProfile,
  UserProfile,
  StatsV2UserProfile
} from "../../types/get/getProfile"
import retry from "async-retry"
import { fetch, ProxyAgent } from "undici"

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"

export const StalkUser = async (
  username: string,
  proxy?: string,
  cookie?: string
): Promise<TiktokStalkUserResponse> => {
  username = username.replace("@", "")

  try {
    const data = await retry(
      async (bail) => {
        const res = await fetch(`${_tiktokDesktopUrl}/@${username}`, {
          headers: {
            "User-Agent": USER_AGENT,
            ...(cookie ? { Cookie: cookie } : {})
          },
          ...(proxy ? { dispatcher: new ProxyAgent(proxy) } : {})
        })

        const html = await res.text()

        const $ = load(html)
        const scriptText = $("script#__UNIVERSAL_DATA_FOR_REHYDRATION__").text()
        if (!scriptText) {
          // WAF block - retryable
          throw new Error("WAF_BLOCKED")
        }

        return html
      },
      {
        retries: 20,
        minTimeout: 500,
        maxTimeout: 2000,
        randomize: true,
        onRetry: (err) => {
          if ((err as Error).message !== "WAF_BLOCKED") throw err
        }
      }
    )

    const $ = load(data)
    const scriptText = $("script#__UNIVERSAL_DATA_FOR_REHYDRATION__").text()
    const result = JSON.parse(scriptText)
    const userDetail = result?.["__DEFAULT_SCOPE__"]?.["webapp.user-detail"]
    const dataUser = userDetail?.userInfo

    if (!dataUser) {
      return { status: "error", message: "User not found!" }
    }

    const { user, stats, statsV2 } = parseDataUser(dataUser)
    return { status: "success", result: { user, stats, statsV2 } }
  } catch (error: any) {
    if (error.message === "WAF_BLOCKED") {
      return {
        status: "error",
        message: "TikTok blocked the request (WAF). Please provide a cookie or try again later."
      }
    }
    return {
      status: "error",
      message: error instanceof Error ? error.message : "Failed to fetch user"
    }
  }
}

const parseDataUser = (dataUser: any) => {
  // User Info Result
  const user: UserProfile = {
    uid: dataUser.user.id,
    username: dataUser.user.uniqueId,
    nickname: dataUser.user.nickname,
    avatarLarger: dataUser.user.avatarLarger,
    avatarThumb: dataUser.user.avatarThumb,
    avatarMedium: dataUser.user.avatarMedium,
    signature: dataUser.user.signature,
    bioLink: dataUser.user.bioLink?.link || null,
    verified: dataUser.user.verified,
    privateAccount: dataUser.user.privateAccount,
    region: dataUser.user.region,
    commerceUser: Boolean(dataUser.user.commerceUserInfo?.commerceUser),
    usernameModifyTime: dataUser.user.uniqueIdModifyTime,
    nicknameModifyTime: dataUser.user.nickNameModifyTime,
    secUid: dataUser.user.secUid
  }

  // Statistics Result
  const stats: StatsUserProfile = {
    followerCount: dataUser.stats.followerCount,
    followingCount: dataUser.stats.followingCount,
    heartCount: dataUser.stats.heartCount,
    videoCount: dataUser.stats.videoCount,
    likeCount: dataUser.stats.diggCount,
    friendCount: dataUser.stats.friendCount
  }

  // Statistics V2 Result
  const statsV2: StatsV2UserProfile = {
    followerCount: dataUser.statsV2.followerCount,
    followingCount: dataUser.statsV2.followingCount,
    heartCount: dataUser.statsV2.heartCount,
    videoCount: dataUser.statsV2.videoCount,
    likeCount: dataUser.statsV2.diggCount,
    friendCount: dataUser.statsV2.friendCount
  }

  return { user, stats, statsV2 }
}
