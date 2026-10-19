"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserReposts = void 0;
const undici_1 = require("undici");
const api_1 = require("../../constants/api");
const params_1 = require("../../constants/params");
const getProfile_1 = require("../get/getProfile");
const async_retry_1 = __importDefault(require("async-retry"));
const proxy_1 = require("../proxy");
const getUserReposts = async (username, proxy, postLimit, filterDeletedPost = true) => {
    try {
        const profileRes = await (0, getProfile_1.StalkUser)(username);
        if (profileRes.status === "error") {
            return { status: "error", message: profileRes.message };
        }
        const secUid = profileRes.result.user.secUid;
        const data = await parseUserReposts(secUid, postLimit, proxy, filterDeletedPost);
        if (!data.length) {
            return { status: "error", message: "No reposts found!" };
        }
        return { status: "success", result: data, totalReposts: data.length };
    }
    catch (err) {
        if (err.status == 400 || err.response?.data?.statusCode == 10201) {
            return { status: "error", message: "User not found!" };
        }
        return { status: "error", message: err.message || "Failed to fetch reposts" };
    }
};
exports.getUserReposts = getUserReposts;
const parseUserReposts = async (secUid, postLimit, proxy, filterDeletedPost) => {
    let page = 1;
    let hasMore = true;
    let responseCursor = 0;
    const posts = [];
    let counter = 0;
    while (hasMore) {
        let result = null;
        let urlCursor = 0;
        let urlCount = 0;
        if (page === 1) {
            urlCount = 16;
            urlCursor = 0;
        }
        else {
            urlCount = 16;
            urlCursor = responseCursor;
        }
        result = await requestUserReposts(proxy, secUid, urlCursor, urlCount);
        if (!result || !result.itemList || result.itemList.length === 0) {
            hasMore = false;
            break;
        }
        if (filterDeletedPost) {
            result.itemList = result.itemList.filter((item) => item.createTime !== 0);
        }
        result?.itemList?.forEach((v) => {
            const author = {
                id: v.author?.id,
                username: v.author?.uniqueId,
                nickname: v.author?.nickname,
                avatarLarger: v.author?.avatarLarger,
                avatarThumb: v.author?.avatarThumb,
                avatarMedium: v.author?.avatarMedium,
                signature: v.author?.signature,
                verified: v.author?.verified,
                openFavorite: v.author?.openFavorite,
                privateAccount: v.author?.privateAccount,
                isADVirtual: v.author?.isADVirtual,
                isEmbedBanned: v.author?.isEmbedBanned
            };
            if (v.imagePost) {
                const imagePost = {
                    title: v.imagePost.title || "",
                    images: v.imagePost.images?.map((img) => ({
                        imageURL: {
                            urlList: img.imageURL?.urlList || []
                        }
                    })) || []
                };
                posts.push({
                    id: v.id,
                    desc: v.desc,
                    createTime: v.createTime,
                    digged: v.digged || false,
                    duetEnabled: v.duetEnabled,
                    forFriend: v.forFriend || false,
                    officalItem: v.officalItem || false,
                    originalItem: v.originalItem || false,
                    privateItem: v.privateItem || false,
                    secret: v.secret || false,
                    shareEnabled: v.shareEnabled || false,
                    stitchEnabled: v.stitchEnabled,
                    stats: v.stats || { shareCount: 0 },
                    music: v.music || {},
                    author,
                    imagePost,
                    AIGCDescription: v.AIGCDescription,
                    CategoryType: v.CategoryType,
                    collected: v.collected,
                    contents: v.contents || [],
                    challenges: v.challenges || [],
                    textExtra: v.textExtra || [],
                    textLanguage: v.textLanguage,
                    textTranslatable: v.textTranslatable,
                    titleLanguage: v.titleLanguage,
                    titleTranslatable: v.titleTranslatable,
                    isAd: v.isAd,
                    isReviewing: v.isReviewing,
                    itemCommentStatus: v.itemCommentStatus,
                    item_control: v.item_control,
                    duetDisplay: v.duetDisplay,
                    stitchDisplay: v.stitchDisplay,
                    diversificationId: v.diversificationId,
                    backendSourceEventTracking: v.backendSourceEventTracking,
                    stickersOnItem: v.stickersOnItem || [],
                    videoSuggestWordsList: v.videoSuggestWordsList
                });
            }
            else {
                const video = {
                    id: v.video?.id,
                    duration: v.video?.duration,
                    format: v.video?.format,
                    bitrate: v.video?.bitrate,
                    ratio: v.video?.ratio,
                    playAddr: v.video?.playAddr,
                    cover: v.video?.cover,
                    originCover: v.video?.originCover,
                    dynamicCover: v.video?.dynamicCover,
                    downloadAddr: v.video?.downloadAddr
                };
                posts.push({
                    id: v.id,
                    desc: v.desc,
                    createTime: v.createTime,
                    digged: v.digged || false,
                    duetEnabled: v.duetEnabled,
                    forFriend: v.forFriend || false,
                    officalItem: v.officalItem || false,
                    originalItem: v.originalItem || false,
                    privateItem: v.privateItem || false,
                    secret: v.secret || false,
                    shareEnabled: v.shareEnabled || false,
                    stitchEnabled: v.stitchEnabled,
                    stats: v.stats || { shareCount: 0 },
                    music: v.music || {},
                    author,
                    video,
                    AIGCDescription: v.AIGCDescription,
                    CategoryType: v.CategoryType,
                    collected: v.collected,
                    contents: v.contents || [],
                    challenges: v.challenges || [],
                    textExtra: v.textExtra || [],
                    textLanguage: v.textLanguage,
                    textTranslatable: v.textTranslatable,
                    titleLanguage: v.titleLanguage,
                    titleTranslatable: v.titleTranslatable,
                    isAd: v.isAd,
                    isReviewing: v.isReviewing,
                    itemCommentStatus: v.itemCommentStatus,
                    item_control: v.item_control,
                    duetDisplay: v.duetDisplay,
                    stitchDisplay: v.stitchDisplay,
                    diversificationId: v.diversificationId,
                    backendSourceEventTracking: v.backendSourceEventTracking,
                    stickersOnItem: v.stickersOnItem || [],
                    videoSuggestWordsList: v.videoSuggestWordsList
                });
            }
        });
        hasMore = result.hasMore;
        responseCursor = hasMore ? result.cursor : 0;
        page++;
        counter++;
        if (postLimit && posts.length >= postLimit) {
            hasMore = false;
            break;
        }
    }
    return postLimit ? posts.slice(0, postLimit) : posts;
};
const requestUserReposts = async (proxy, secUid = "", cursor = 0, count = 0) => {
    return (0, async_retry_1.default)(async (bail, attempt) => {
        try {
            let urlParams = (0, params_1._getUserRepostsParams)(secUid, cursor, count);
            const res = await (0, undici_1.fetch)(`${(0, api_1._tiktokGetReposts)(urlParams)}`, {
                headers: {
                    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36 Edg/138.0.0.0"
                },
                ...(0, proxy_1.createDispatcher)(proxy)
            });
            if (res.status === 400) {
                bail(new Error("Video not found!"));
                return;
            }
            if (!res.ok)
                throw new Error(`HTTP error: ${res.status}`);
            const data = await res.json();
            if (!data)
                throw new Error("Empty response");
            return data;
        }
        catch (error) {
            throw error;
        }
    }, {
        retries: 10,
        minTimeout: 1000,
        maxTimeout: 5000,
        factor: 2
    });
};
