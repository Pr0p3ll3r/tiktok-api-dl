"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchUser = void 0;
const undici_1 = require("undici");
const api_1 = require("../../constants/api");
const tiktokService_1 = require("../../services/tiktokService");
const headers_1 = require("../../constants/headers");
const constants_1 = require("../../constants");
const proxy_1 = require("../proxy");
const formatCookie = (cookie) => Array.isArray(cookie)
    ? cookie.map((v) => `${v.name}=${v.value}`).join("; ")
    : cookie;
const SearchUser = async (username, cookie, page = 1, proxy) => {
    try {
        if (!cookie) {
            return { status: "error", message: constants_1.ERROR_MESSAGES.COOKIE_REQUIRED };
        }
        const Tiktok = new tiktokService_1.TiktokService();
        const res = await (0, undici_1.fetch)(Tiktok.generateURLXbogus(username, page), {
            method: "GET",
            headers: {
                "User-Agent": headers_1.webUserAgent,
                cookie: formatCookie(cookie)
            },
            ...(0, proxy_1.createDispatcher)(proxy)
        });
        const data = await res.json();
        if (data.status_code === 2483) {
            return { status: "error", message: constants_1.ERROR_MESSAGES.INVALID_COOKIE };
        }
        if (data.status_code !== 0) {
            return { status: "error", message: data.status_msg || "TikTok API error" };
        }
        if (!data.user_list) {
            return { status: "error", message: constants_1.ERROR_MESSAGES.USER_NOT_FOUND };
        }
        const result = data.user_list.map((user) => ({
            uid: user.user_info.uid,
            username: user.user_info.unique_id,
            nickname: user.user_info.nickname,
            signature: user.user_info.signature,
            followerCount: user.user_info.follower_count,
            avatarThumb: user.user_info.avatar_thumb,
            isVerified: user.custom_verify !== "",
            secUid: user.user_info.sec_uid,
            url: `${api_1._tiktokDesktopUrl}/@${user.user_info.unique_id}`
        }));
        if (!result.length) {
            return { status: "error", message: constants_1.ERROR_MESSAGES.USER_NOT_FOUND };
        }
        return { status: "success", result, page, totalResults: result.length };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to search users"
        };
    }
};
exports.SearchUser = SearchUser;
