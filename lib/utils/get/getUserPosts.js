"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchPostsFromEmbed = exports.getUserPosts = void 0;
const undici_1 = require("undici");
const cheerio_1 = require("cheerio");
const api_1 = require("../../constants/api");
const getProfile_1 = require("../get/getProfile");
const async_retry_1 = __importDefault(require("async-retry"));
const proxy_1 = require("../proxy");
const xbogus_1 = __importDefault(require("../../../helper/xbogus"));
const getUserPosts = async (username, cookie, proxy, postLimit) => {
    try {
        const cleanUsername = username.replace(/^@/, "").trim();
        if (!cleanUsername) {
            return { status: "error", message: "Username is required!" };
        }
        let cookies = "";
        if (cookie) {
            cookies = Array.isArray(cookie) ? cookie.join("; ") : cookie;
        }
        else {
            cookies = await getCookiesFromProfile(cleanUsername, proxy);
        }
        const profileRes = await (0, getProfile_1.StalkUser)(cleanUsername, proxy, cookies || undefined);
        if (profileRes.status === "error" && profileRes.message === "User not found!") {
            return { status: "error", message: "User not found!" };
        }
        let data = [];
        if (profileRes.status === "success" && profileRes.result?.user?.secUid) {
            const secUid = profileRes.result.user.secUid;
            try {
                data = await parseUserPosts(secUid, postLimit, proxy, cookies);
            }
            catch {
                data = [];
            }
        }
        if (!data.length) {
            try {
                data = await (0, exports.fetchPostsFromEmbed)(cleanUsername, profileRes.status === "success" ? profileRes.result : undefined, postLimit, proxy, cookies);
            }
            catch (embedErr) {
                if (embedErr.message === "User not found!") {
                    return { status: "error", message: "User not found!" };
                }
                if (profileRes.status === "error") {
                    return { status: "error", message: profileRes.message || embedErr.message };
                }
                throw embedErr;
            }
        }
        if (!data.length) {
            if (profileRes.status === "success" && profileRes.result?.stats?.videoCount === 0) {
                return { status: "error", message: "No posts found!" };
            }
            return {
                status: "error",
                message: "Unable to fetch posts. User not found or profile has no public posts."
            };
        }
        return { status: "success", result: data, totalPosts: data.length };
    }
    catch (err) {
        if (err.status == 400 || err.response?.data?.statusCode == 10201) {
            return { status: "error", message: "User not found!" };
        }
        return { status: "error", message: err.message || "Failed to fetch posts" };
    }
};
exports.getUserPosts = getUserPosts;
const getCookiesFromProfile = async (username, proxy) => {
    try {
        const response = await (0, undici_1.fetch)(`${api_1._tiktokDesktopUrl}/@${username.replace("@", "")}`, {
            headers: {
                "User-Agent": userAgent,
                Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9"
            },
            ...(0, proxy_1.createDispatcher)(proxy)
        });
        const setCookies = response.headers.getSetCookie?.() || [];
        return setCookies.map((c) => c.split(";")[0]).join("; ");
    }
    catch {
        return "";
    }
};
const fetchPostsFromEmbed = async (username, profileUser, postLimit, proxy, cookies) => {
    const cleanUsername = username.replace(/^@/, "").trim();
    const url = `${api_1._tiktokDesktopUrl}/embed/@${cleanUsername}`;
    const res = await (0, undici_1.fetch)(url, {
        headers: {
            "User-Agent": userAgent,
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            Referer: "https://www.tiktok.com/",
            ...(cookies ? { Cookie: cookies } : {})
        },
        ...(0, proxy_1.createDispatcher)(proxy)
    });
    if (res.status === 400 || res.status === 404) {
        throw new Error("User not found!");
    }
    if (!res.ok) {
        if (res.status === 500 || res.status === 403) {
            throw new Error(`TikTok blocked embed request (HTTP ${res.status}). Datacenter IP detected on server. Provide a proxy or cookie.`);
        }
        throw new Error(`HTTP error: ${res.status}`);
    }
    const html = await res.text();
    const $ = (0, cheerio_1.load)(html);
    const scriptText = $("#__FRONTITY_CONNECT_STATE__").text();
    if (!scriptText) {
        throw new Error("Failed to parse TikTok embed response");
    }
    let data;
    try {
        data = JSON.parse(scriptText);
    }
    catch {
        throw new Error("Failed to parse TikTok embed JSON");
    }
    const key = `/embed/@${cleanUsername}`;
    const embedData = data.source?.data?.[key];
    if (!embedData) {
        throw new Error("User not found!");
    }
    if (embedData.isError || embedData.userInfo?.code === 400) {
        throw new Error("User not found!");
    }
    const videoList = embedData.videoList || [];
    if (!videoList.length) {
        return [];
    }
    const authorInfo = embedData.userInfo || profileUser?.user;
    const posts = videoList.map((v) => {
        let createTime = 0;
        try {
            createTime = Number(BigInt(v.id) >> 32n);
        }
        catch {
            createTime = Math.floor(Date.now() / 1000);
        }
        const author = {
            id: profileUser?.user?.uid ||
                profileUser?.user?.id ||
                authorInfo?.id ||
                "",
            username: profileUser?.user?.uniqueId ||
                authorInfo?.uniqueId ||
                v.authorUniqueId ||
                cleanUsername,
            nickname: profileUser?.user?.nickname || authorInfo?.nickname || "",
            avatarLarger: profileUser?.user?.avatarLarger || authorInfo?.avatarThumbUrl || "",
            avatarThumb: profileUser?.user?.avatarThumb || authorInfo?.avatarThumbUrl || "",
            avatarMedium: profileUser?.user?.avatarMedium || authorInfo?.avatarThumbUrl || "",
            signature: profileUser?.user?.signature || authorInfo?.signature || "",
            verified: Boolean(profileUser?.user?.verified ?? authorInfo?.verified),
            openFavorite: Boolean(profileUser?.user?.openFavorite),
            privateAccount: Boolean(profileUser?.user?.privateAccount ?? authorInfo?.privateAccount),
            isADVirtual: Boolean(profileUser?.user?.isADVirtual),
            isEmbedBanned: Boolean(profileUser?.user?.isEmbedBanned)
        };
        const video = {
            id: String(v.id),
            format: "mp4",
            ratio: v.ratio || v.video?.ratio || "720p",
            playAddr: v.playAddr || v.video?.playAddr || "",
            cover: v.coverUrl || v.video?.cover || "",
            originCover: v.originCoverUrl || v.video?.originCover || "",
            dynamicCover: v.dynamicCoverUrl || v.video?.dynamicCover || "",
            downloadAddr: v.playAddr || v.video?.downloadAddr || ""
        };
        const stats = {
            playCount: v.playCount || v.stats?.playCount || 0
        };
        return {
            id: String(v.id),
            desc: v.desc || "",
            createTime,
            privateItem: Boolean(v.privateItem),
            stats,
            author,
            video
        };
    });
    return postLimit ? posts.slice(0, postLimit) : posts;
};
exports.fetchPostsFromEmbed = fetchPostsFromEmbed;
const parseUserPosts = async (secUid, postLimit, proxy, cookies) => {
    let page = 1;
    let hasMore = true;
    let responseCursor = 0;
    const posts = [];
    while (hasMore) {
        const count = page === 1 ? 35 : 30;
        const result = await requestUserPosts(secUid, responseCursor, count, proxy, cookies);
        if (!result?.itemList ||
            !Array.isArray(result.itemList) ||
            result.itemList.length === 0) {
            break;
        }
        result.itemList.forEach((v) => {
            const author = {
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
            };
            const stats = {
                playCount: v.stats?.playCount || 0
            };
            const video = {
                id: String(v.video?.id || v.id),
                format: v.video?.format || "mp4",
                ratio: v.video?.ratio || "720p",
                playAddr: v.video?.playAddr || "",
                cover: v.video?.cover || "",
                originCover: v.video?.originCover || "",
                dynamicCover: v.video?.dynamicCover || "",
                downloadAddr: v.video?.downloadAddr || ""
            };
            posts.push({
                id: String(v.id),
                desc: v.desc || "",
                createTime: v.createTime || 0,
                privateItem: Boolean(v.privateItem),
                stats,
                author,
                video
            });
        });
        hasMore = Boolean(result.hasMore);
        const nextCursor = result.cursor;
        if (!nextCursor || nextCursor === responseCursor) {
            hasMore = false;
            break;
        }
        responseCursor = nextCursor;
        page++;
        if (postLimit && posts.length >= postLimit) {
            hasMore = false;
            break;
        }
    }
    return postLimit ? posts.slice(0, postLimit) : posts;
};
const userAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const requestUserPosts = async (secUid, cursor = 0, count = 35, proxy, cookies) => {
    return (0, async_retry_1.default)(async (bail, attempt) => {
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
        });
        const msTokenMatch = cookies?.match(/msToken=([^;]+)/);
        if (msTokenMatch) {
            params.append("msToken", msTokenMatch[1]);
        }
        const baseUrl = `${api_1._tiktokDesktopUrl}/api/post/item_list/?${params.toString()}`;
        const xBogusValue = (0, xbogus_1.default)(baseUrl, userAgent);
        const finalUrl = `${baseUrl}&X-Bogus=${xBogusValue}`;
        const res = await (0, undici_1.fetch)(finalUrl, {
            headers: {
                "User-Agent": userAgent,
                Accept: "*/*",
                "Accept-Language": "en-US,en;q=0.9",
                Referer: `${api_1._tiktokDesktopUrl}/`,
                "Sec-Ch-Ua": '"Not(A:Brand";v="8", "Chromium";v="144", "Microsoft Edge";v="144"',
                "Sec-Ch-Ua-Mobile": "?0",
                "Sec-Ch-Ua-Platform": '"Windows"',
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-origin",
                ...(cookies ? { Cookie: cookies } : {})
            },
            ...(0, proxy_1.createDispatcher)(proxy)
        });
        if (res.status === 400 || res.status === 404) {
            bail(new Error("User not found!"));
            return;
        }
        if (res.status === 429) {
            if (attempt >= 2) {
                bail(new Error("Rate limited by TikTok. Please try again later."));
                return;
            }
            throw new Error("Rate limited");
        }
        const raw = await res.text();
        if (!raw || !raw.trim()) {
            bail(new Error("Empty response"));
            return;
        }
        let data;
        try {
            data = JSON.parse(raw);
        }
        catch {
            bail(new Error("Empty response"));
            return;
        }
        return data;
    }, {
        retries: 2,
        minTimeout: 500,
        maxTimeout: 2000,
        factor: 2
    });
};
