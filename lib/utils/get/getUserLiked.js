"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserLiked = void 0;
const undici_1 = require("undici");
const api_1 = require("../../constants/api");
const getProfile_1 = require("./getProfile");
const params_1 = require("../../constants/params");
const tiktokService_1 = require("../../services/tiktokService");
const async_retry_1 = __importDefault(require("async-retry"));
const proxy_1 = require("../proxy");
const getUserLiked = async (username, cookie, proxy, postLimit) => {
    const profileRes = await (0, getProfile_1.StalkUser)(username);
    if (profileRes.status === "error") {
        return { status: "error", message: profileRes.message };
    }
    const id = profileRes.result.user.uid;
    const secUid = profileRes.result.user.secUid;
    const data = await parseUserLiked(id, secUid, cookie, postLimit, proxy);
    if (!data.length) {
        return { status: "error", message: "No liked videos found!" };
    }
    return { status: "success", result: data, totalPosts: data.length };
};
exports.getUserLiked = getUserLiked;
const parseUserLiked = async (id, secUid, cookie, postLimit, proxy) => {
    let hasMore = true;
    const favorites = [];
    let counter = 0;
    while (hasMore) {
        let result = null;
        result = await requestUserLiked(id, secUid, cookie, postLimit, proxy);
        result?.itemList?.forEach((v) => {
            const statsAuthor = {
                likeCount: v.authorStats.diggCount,
                followerCount: v.authorStats.followerCount,
                followingCount: v.authorStats.followingCount,
                friendCount: v.authorStats.friendCount,
                heartCount: v.authorStats.heartCount,
                postsCount: v.authorStats.videoCount
            };
            const author = {
                id: v.author.id,
                username: v.author.uniqueId,
                nickname: v.author.nickname,
                avatarLarger: v.author.avatarLarger,
                avatarThumb: v.author.avatarThumb,
                avatarMedium: v.author.avatarMedium,
                signature: v.author.signature,
                verified: v.author.verified,
                openFavorite: v.author.openFavorite,
                privateAccount: v.author.privateAccount,
                isADVirtual: v.author.isADVirtual,
                isEmbedBanned: v.author.isEmbedBanned,
                stats: statsAuthor
            };
            const stats = {
                collectCount: v.statsV2.collectCount,
                commentCount: v.statsV2.commentCount,
                diggCount: v.statsV2.diggCount,
                playCount: v.statsV2.playCount,
                repostCount: v.statsV2.repostCount,
                shareCount: v.statsV2.shareCount
            };
            const music = {
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
                isCopyrighted: v.music.isCopyrighted,
                private: v.music.private
            };
            const response = {
                id: v.id,
                desc: v.desc,
                createTime: v.createTime,
                duetEnabled: v.duetEnabled || false,
                digged: v.digged || false,
                forFriend: v.forFriend || false,
                isAd: v.isAd || false,
                originalItem: v.originalItem || false,
                privateItem: v.privateItem || false,
                officialItem: v.officialItem || false,
                secret: v.secret || false,
                shareEnabled: v.shareEnabled || false,
                stitchEanbled: v.stitchEanbled || false,
                textTranslatable: v.textTranslatable || false
            };
            if (v.imagePost) {
                const imagePost = [];
                v.imagePost.images.forEach((image) => {
                    imagePost.push({
                        title: image.title,
                        images: image.imageURL.urlList[0]
                    });
                });
                favorites.push({
                    ...response,
                    author,
                    stats,
                    imagePost,
                    music
                });
            }
            else {
                const video = {
                    id: v.video.id,
                    videoID: v.video.id,
                    duration: v.video.duration,
                    ratio: v.video.ratio,
                    cover: v.video.cover,
                    originCover: v.video.originCover,
                    dynamicCover: v.video.dynamicCover,
                    playAddr: v.video.playAddr,
                    downloadAddr: v.video.downloadAddr,
                    format: v.video.format,
                    bitrate: v.video.bitrate,
                    bitrateInfo: v.video.bitrateInfo
                };
                favorites.push({
                    ...response,
                    author,
                    stats,
                    video,
                    music
                });
            }
        });
        hasMore = result.hasMore;
        counter++;
        if (postLimit && favorites.length >= postLimit) {
            hasMore = false;
            break;
        }
    }
    return postLimit ? favorites.slice(0, postLimit) : favorites;
};
const requestUserLiked = async (id, secUid, cookie, postLimit, proxy) => {
    const Tiktok = new tiktokService_1.TiktokService();
    const url = new URL((0, api_1._tiktokGetUserLiked)((0, params_1._getUserLikedParams)(id, secUid, postLimit)));
    const signature = Tiktok.generateSignature(url);
    url.searchParams.append("_signature", signature);
    const xbogus = Tiktok.generateXBogus(url, signature);
    url.searchParams.append("X-Bogus", xbogus);
    const xttparams = Tiktok.generateXTTParams(url.searchParams.toString());
    return await (0, async_retry_1.default)(async (bail, attempt) => {
        try {
            const res = await (0, undici_1.fetch)(url.toString(), {
                headers: {
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.35",
                    cookie: Array.isArray(cookie) ? cookie.join("; ") : cookie,
                    "x-tt-params": xttparams
                },
                ...(0, proxy_1.createDispatcher)(proxy)
            });
            if (!res.ok)
                throw new Error(`HTTP error: ${res.status}`);
            const data = await res.json();
            if (!data)
                throw new Error("Empty response");
            return data;
        }
        catch (error) {
            if (attempt === 3) {
                bail(error);
            }
            throw error;
        }
    }, {
        retries: 10,
        minTimeout: 1000,
        maxTimeout: 5000,
        factor: 2
    });
};
