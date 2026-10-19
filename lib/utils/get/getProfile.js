"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StalkUser = void 0;
const cheerio_1 = require("cheerio");
const api_1 = require("../../constants/api");
const async_retry_1 = __importDefault(require("async-retry"));
const undici_1 = require("undici");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const StalkUser = async (username, proxy, cookie) => {
    username = username.replace("@", "");
    try {
        const data = await (0, async_retry_1.default)(async (bail) => {
            const res = await (0, undici_1.fetch)(`${api_1._tiktokDesktopUrl}/@${username}`, {
                headers: {
                    "User-Agent": USER_AGENT,
                    ...(cookie ? { Cookie: cookie } : {})
                },
                ...(proxy ? { dispatcher: new undici_1.ProxyAgent(proxy) } : {})
            });
            const html = await res.text();
            const $ = (0, cheerio_1.load)(html);
            const scriptText = $("script#__UNIVERSAL_DATA_FOR_REHYDRATION__").text();
            if (!scriptText) {
                throw new Error("WAF_BLOCKED");
            }
            return html;
        }, {
            retries: 20,
            minTimeout: 500,
            maxTimeout: 2000,
            randomize: true,
            onRetry: (err) => {
                if (err.message !== "WAF_BLOCKED")
                    throw err;
            }
        });
        const $ = (0, cheerio_1.load)(data);
        const scriptText = $("script#__UNIVERSAL_DATA_FOR_REHYDRATION__").text();
        const result = JSON.parse(scriptText);
        const userDetail = result?.["__DEFAULT_SCOPE__"]?.["webapp.user-detail"];
        const dataUser = userDetail?.userInfo;
        if (!dataUser) {
            return { status: "error", message: "User not found!" };
        }
        const { user, stats, statsV2 } = parseDataUser(dataUser);
        return { status: "success", result: { user, stats, statsV2 } };
    }
    catch (error) {
        if (error.message === "WAF_BLOCKED") {
            return {
                status: "error",
                message: "TikTok blocked the request (WAF). Please provide a cookie or try again later."
            };
        }
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to fetch user"
        };
    }
};
exports.StalkUser = StalkUser;
const parseDataUser = (dataUser) => {
    const user = {
        uid: dataUser.user.id,
        username: dataUser.user.uniqueId,
        nickname: dataUser.user.nickname,
        avatarLarger: dataUser.user.avatarLarger,
        avatarThumb: dataUser.user.avatarThumb,
        avatarMedium: dataUser.user.avatarMedium,
        signature: dataUser.user.signature,
        verified: dataUser.user.verified,
        privateAccount: dataUser.user.privateAccount,
        region: dataUser.user.region,
        commerceUser: dataUser.user.commerceUserInfo.commerceUser,
        usernameModifyTime: dataUser.user.uniqueIdModifyTime,
        nicknameModifyTime: dataUser.user.nickNameModifyTime,
        secUid: dataUser.user.secUid
    };
    const stats = {
        followerCount: dataUser.stats.followerCount,
        followingCount: dataUser.stats.followingCount,
        heartCount: dataUser.stats.heartCount,
        videoCount: dataUser.stats.videoCount,
        likeCount: dataUser.stats.diggCount,
        friendCount: dataUser.stats.friendCount
    };
    const statsV2 = {
        followerCount: dataUser.statsV2.followerCount,
        followingCount: dataUser.statsV2.followingCount,
        heartCount: dataUser.statsV2.heartCount,
        videoCount: dataUser.statsV2.videoCount,
        likeCount: dataUser.statsV2.diggCount,
        friendCount: dataUser.statsV2.friendCount
    };
    return { user, stats, statsV2 };
};
