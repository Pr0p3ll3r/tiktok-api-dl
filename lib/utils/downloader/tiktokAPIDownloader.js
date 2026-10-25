"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TiktokAPI = exports.handleRedirect = void 0;
const undici_1 = require("undici");
const async_retry_1 = __importDefault(require("async-retry"));
const api_1 = require("../../constants/api");
const params_1 = require("../../constants/params");
const constants_1 = require("../../constants");
const proxy_1 = require("../proxy");
const USER_AGENT = "com.zhiliaoapp.musically/300904 (2018111632; U; Android 10; en_US; Pixel 4; Build/QQ3A.200805.001; Cronet/58.0.2991.0)";
const validateTikTokUrl = (url) => constants_1.TIKTOK_URL_REGEX.test(url);
const extractVideoId = (responseUrl) => {
    const matches = responseUrl.match(/\d{17,21}/g);
    return matches ? matches[0] : null;
};
const parseStatistics = (content) => ({
    playCount: content.statistics.play_count,
    likeCount: content.statistics.digg_count,
    commentCount: content.statistics.comment_count,
    saveCount: content.statistics.collect_count,
    shareCount: content.statistics.share_count
});
const parseAuthor = (content) => ({
    uid: content.author.uid,
    username: content.author.unique_id,
    uniqueId: content.author.unique_id,
    nickname: content.author.nickname,
    signature: content.author.signature,
    region: content.author.region,
    avatarThumb: content.author?.avatar_thumb?.url_list || [],
    avatarMedium: content.author?.avatar_medium?.url_list || [],
    url: `${api_1._tiktokDesktopUrl}/@${content.author.unique_id}`
});
const parseMusic = (content) => ({
    id: content.music.id,
    title: content.music.title,
    author: content.music.author,
    album: content.music.album,
    playUrl: content.music?.play_url?.url_list || [],
    coverLarge: content.music?.cover_large?.url_list || [],
    coverMedium: content.music?.cover_medium?.url_list || [],
    coverThumb: content.music?.cover_thumb?.url_list || [],
    duration: content.music.duration,
    isCommerceMusic: content.music.is_commerce_music,
    isOriginalSound: content.music.is_original_sound,
    isAuthorArtist: content.music.is_author_artist
});
const parseVideo = (content) => ({
    ratio: content.video.ratio,
    duration: content.video.duration,
    playAddr: content.video?.play_addr?.url_list || [],
    downloadAddr: content.video?.download_addr?.url_list || [],
    cover: content.video?.cover?.url_list || [],
    dynamicCover: content.video?.dynamic_cover?.url_list || [],
    originCover: content.video?.origin_cover?.url_list || []
});
const parseTiktokData = (ID, data) => {
    const content = data?.aweme_list?.find((v) => v.aweme_id === ID);
    if (!content)
        return { content: null };
    return {
        content,
        statistics: parseStatistics(content),
        author: parseAuthor(content),
        music: parseMusic(content)
    };
};
const fetchTiktokData = async (ID, proxy) => {
    try {
        const response = await (0, async_retry_1.default)(async () => {
            const res = await (0, undici_1.fetch)((0, api_1._tiktokvFeed)((0, params_1._tiktokApiParams)({ aweme_id: ID })), {
                method: "OPTIONS",
                headers: { "User-Agent": USER_AGENT },
                ...(0, proxy_1.createDispatcher)(proxy)
            });
            if (!res.ok)
                throw new Error(constants_1.ERROR_MESSAGES.NETWORK_ERROR);
            const resData = await res.json();
            if (resData && resData.status_code === 0) {
                return resData;
            }
            throw new Error(constants_1.ERROR_MESSAGES.NETWORK_ERROR);
        }, {
            retries: 20,
            minTimeout: 200,
            maxTimeout: 1000
        });
        return parseTiktokData(ID, response);
    }
    catch (error) {
        console.error("Error fetching TikTok data:", error);
        return null;
    }
};
const createImageResponse = (content, author, statistics, music) => ({
    status: "success",
    result: {
        type: "image",
        id: content.aweme_id,
        createTime: content.create_time,
        desc: content.desc,
        isTurnOffComment: content.item_comment_settings === 3,
        hashtag: content.text_extra
            .filter((x) => x.hashtag_name !== undefined)
            .map((v) => v.hashtag_name),
        isADS: content.is_ads,
        author,
        statistics,
        images: content.image_post_info.images?.map((v) => v?.display_image?.url_list[0]) || [],
        music
    }
});
const createVideoResponse = (content, author, statistics, music) => ({
    status: "success",
    result: {
        type: "video",
        id: content.aweme_id,
        createTime: content.create_time,
        desc: content.desc,
        isTurnOffComment: content.item_comment_settings === 3,
        hashtag: content.text_extra
            .filter((x) => x.hashtag_name !== undefined)
            .map((v) => v.hashtag_name),
        isADS: content.is_ads,
        author,
        statistics,
        video: parseVideo(content),
        music
    }
});
const handleRedirect = async (url, proxy) => {
    try {
        const response = await (0, undici_1.fetch)(url, {
            method: "HEAD",
            redirect: "follow",
            ...(0, proxy_1.createDispatcher)(proxy)
        });
        return (response.url || url).split("?")[0];
    }
    catch {
        return url;
    }
};
exports.handleRedirect = handleRedirect;
const TiktokAPI = async (url, proxy, showOriginalResponse) => {
    try {
        if (!validateTikTokUrl(url)) {
            return {
                status: "error",
                message: constants_1.ERROR_MESSAGES.INVALID_URL
            };
        }
        url = url.replace("https://vm", "https://vt");
        const request = await (0, undici_1.fetch)(url, {
            method: "GET",
            headers: {
                "User-Agent": USER_AGENT,
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.9",
            },
            redirect: "follow",
            ...(0, proxy_1.createDispatcher)(proxy),
        });
        const redirectUrl = request.url || url;
        const videoId = extractVideoId(redirectUrl);
        if (!videoId) {
            return {
                status: "error",
                message: constants_1.ERROR_MESSAGES.INVALID_URL
            };
        }
        const data = await fetchTiktokData(videoId, proxy);
        if (!data?.content) {
            return {
                status: "error",
                message: constants_1.ERROR_MESSAGES.NETWORK_ERROR
            };
        }
        const { content, author, statistics, music } = data;
        if (!author || !statistics || !music) {
            return { status: "error", message: constants_1.ERROR_MESSAGES.NETWORK_ERROR };
        }
        const response = content.image_post_info
            ? createImageResponse(content, author, statistics, music)
            : createVideoResponse(content, author, statistics, music);
        if (showOriginalResponse) {
            return {
                status: "success",
                resultNotParsed: data
            };
        }
        return response;
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : constants_1.ERROR_MESSAGES.NETWORK_ERROR
        };
    }
};
exports.TiktokAPI = TiktokAPI;
