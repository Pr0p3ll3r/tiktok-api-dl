"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTrendingCreators = exports.getTrendings = void 0;
const undici_1 = require("undici");
const api_1 = require("../../constants/api");
const params_1 = require("../../constants/params");
const proxy_1 = require("../proxy");
const getTrendings = async (proxy) => {
    try {
        const url = (0, api_1._tiktokTrendings)((0, params_1._getTrendingsParams)());
        const response = await (0, undici_1.fetch)(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0",
                Accept: "application/json, text/plain, */*",
                "Accept-Language": "en-US,en;q=0.9"
            },
            ...(0, proxy_1.createDispatcher)(proxy)
        });
        if (!response.ok) {
            return { status: "error", message: "Failed to fetch trending data" };
        }
        const data = await response.json();
        if (!data?.body || data.statusCode !== 0) {
            return { status: "error", message: "Failed to fetch trending data" };
        }
        return { status: "success", result: parseTrendingData(data.body) };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to fetch trending data"
        };
    }
};
exports.getTrendings = getTrendings;
const parseTrendingData = (body) => body
    .filter((section) => section.exploreList && Array.isArray(section.exploreList))
    .map((section) => ({
    exploreList: section.exploreList,
    pageState: section.pageState || {}
}));
const getTrendingCreators = async (proxy) => {
    try {
        const trendingResponse = await (0, exports.getTrendings)(proxy);
        if (trendingResponse.status === "error") {
            return { status: "error", message: trendingResponse.message };
        }
        const creators = [];
        trendingResponse.result?.forEach((data) => {
            data.exploreList.forEach((item) => {
                if (item.cardItem?.type === 2) {
                    const c = item.cardItem;
                    creators.push({
                        id: c.id,
                        username: c.subTitle.replace("@", ""),
                        nickname: c.title,
                        avatarThumb: c.cover,
                        description: c.description,
                        verified: c.extraInfo?.verified || false,
                        followerCount: c.extraInfo?.fans || 0,
                        likeCount: c.extraInfo?.likes || 0,
                        videoCount: c.extraInfo?.video || 0,
                        followingCount: c.extraInfo?.following || 0,
                        heartCount: c.extraInfo?.heart || 0,
                        diggCount: c.extraInfo?.digg || 0,
                        secUid: c.extraInfo?.secUid || "",
                        link: c.link
                    });
                }
            });
        });
        return { status: "success", result: creators };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to fetch trending creators"
        };
    }
};
exports.getTrendingCreators = getTrendingCreators;
