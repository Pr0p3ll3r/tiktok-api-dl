"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SearchVideo = void 0;
const undici_1 = require("undici");
const api_1 = require("../../constants/api");
const params_1 = require("../../constants/params");
const async_retry_1 = __importDefault(require("async-retry"));
const constants_1 = require("../../constants");
const proxy_1 = require("../proxy");
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36 Edg/122.0.0.0";
const formatCookie = (cookie) => Array.isArray(cookie)
    ? cookie.map((v) => `${v.name}=${v.value}`).join("; ")
    : cookie;
const SearchVideo = async (keyword, cookie, page = 1, proxy) => {
    try {
        if (!cookie) {
            return { status: "error", message: constants_1.ERROR_MESSAGES.COOKIE_REQUIRED };
        }
        const data = await requestVideoSearch(keyword, page, cookie, proxy);
        if (data.status_code === 2483) {
            return { status: "error", message: constants_1.ERROR_MESSAGES.INVALID_COOKIE };
        }
        if (data.status_code !== 0) {
            return { status: "error", message: data.status_msg || "TikTok API error" };
        }
        if (!data.item_list) {
            return { status: "error", message: "No videos found!" };
        }
        const result = data.item_list.map((v) => ({
            id: v.id,
            desc: v.desc,
            createTime: v.createTime,
            author: {
                id: v.author.id,
                uniqueId: v.author.uniqueId,
                nickname: v.author.nickname,
                avatarThumb: v.author.avatarThumb,
                avatarMedium: v.author.avatarMedium,
                avatarLarger: v.author.avatarLarger,
                signature: v.author.signature,
                verified: v.author.verified,
                secUid: v.author.secUid,
                openFavorite: v.author.openFavorite,
                privateAccount: v.author.privateAccount,
                isADVirtual: v.author.isADVirtual,
                tiktokSeller: v.author.ttSeller,
                isEmbedBanned: v.author.isEmbedBanned
            },
            stats: {
                likeCount: v.stats.diggCount,
                shareCount: v.stats.shareCount,
                commentCount: v.stats.commentCount,
                playCount: v.stats.playCount,
                collectCount: v.stats.collectCount
            },
            video: {
                id: v.video.id,
                ratio: v.video.ratio,
                cover: v.video.cover,
                originCover: v.video.originCover,
                dynamicCover: v.video.dynamicCover,
                playAddr: v.video.playAddr,
                downloadAddr: v.video.downloadAddr,
                format: v.video.format
            },
            music: {
                id: v.music.id,
                title: v.music.title,
                playUrl: v.music.playUrl,
                coverThumb: v.music.coverThumb,
                coverMedium: v.music.coverMedium,
                coverLarge: v.music.coverLarge,
                authorName: v.music.authorName,
                original: v.music.original,
                album: v.music.album,
                duration: v.music.duration,
                isCopyrighted: v.music.isCopyrighted
            }
        }));
        if (!result.length) {
            return { status: "error", message: "No videos found!" };
        }
        return { status: "success", result, page, totalResults: result.length };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to search videos"
        };
    }
};
exports.SearchVideo = SearchVideo;
const requestVideoSearch = async (keyword, page, cookie, proxy) => {
    return (0, async_retry_1.default)(async () => {
        const res = await (0, undici_1.fetch)((0, api_1._tiktokSearchVideoFull)((0, params_1._videoSearchParams)(keyword, page)), {
            method: "GET",
            headers: {
                "User-Agent": USER_AGENT,
                cookie: formatCookie(cookie)
            },
            ...(0, proxy_1.createDispatcher)(proxy)
        });
        if (!res.ok)
            throw new Error("Empty response");
        const data = await res.json();
        return data;
    }, {
        retries: 10,
        minTimeout: 1000,
        maxTimeout: 5000,
        factor: 2
    });
};
