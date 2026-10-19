"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchLive = void 0;
const undici_1 = require("undici");
const api_1 = require("../../constants/api");
const params_1 = require("../../constants/params");
const constants_1 = require("../../constants");
const proxy_1 = require("../proxy");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0";
const formatCookie = (cookie) => Array.isArray(cookie)
    ? cookie.map((v) => `${v.name}=${v.value}`).join("; ")
    : cookie;
const SearchLive = async (keyword, cookie, page = 1, proxy) => {
    try {
        if (!cookie) {
            return { status: "error", message: constants_1.ERROR_MESSAGES.COOKIE_REQUIRED };
        }
        const res = await (0, undici_1.fetch)((0, api_1._tiktokSearchLiveFull)((0, params_1._liveSearchParams)(keyword, page)), {
            method: "GET",
            headers: {
                "User-Agent": USER_AGENT,
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
        if (!data.data) {
            return { status: "error", message: "No live streams found!" };
        }
        const result = data.data.map((v) => {
            const content = JSON.parse(v.live_info.raw_data);
            const liveInfo = {
                id: content.id,
                title: content.title,
                cover: content.cover?.url_list || [],
                squareCover: content.square_cover_img?.url_list || [],
                rectangleCover: content.rectangle_cover_img?.url_list || [],
                liveTypeThirdParty: content.live_type_third_party,
                hashtag: content.hashtag?.title || "",
                startTime: content.start_time,
                stats: {
                    totalUser: content.stats.total_user,
                    viewerCount: content.user_count,
                    likeCount: content.like_count
                },
                owner: {
                    uid: content.owner.id,
                    nickname: content.owner.nickname,
                    username: content.owner.display_id,
                    signature: content.owner.bio_description,
                    avatarThumb: content.owner.avatar_thumb?.url_list || [],
                    avatarMedium: content.owner.avatar_medium?.url_list || [],
                    avatarLarge: content.owner.avatar_large?.url_list || [],
                    modifyTime: content.owner.modify_time,
                    stats: {
                        followingCount: content.owner.follow_info.following_count,
                        followerCount: content.owner.follow_info.follower_count
                    },
                    isVerified: content.owner?.authentication_info?.custom_verify === "verified account" || false
                }
            };
            return {
                roomInfo: {
                    hasCommerceGoods: v.live_info.room_info.has_commerce_goods,
                    isBattle: v.live_info.room_info.is_battle
                },
                liveInfo
            };
        });
        if (!result.length) {
            return { status: "error", message: "No live streams found!" };
        }
        return { status: "success", result, page, totalResults: result.length };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to search live streams"
        };
    }
};
exports.SearchLive = SearchLive;
