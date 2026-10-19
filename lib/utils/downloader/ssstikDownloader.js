"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SSSTik = void 0;
const undici_1 = require("undici");
const async_retry_1 = __importDefault(require("async-retry"));
const cheerio_1 = require("cheerio");
const api_1 = require("../../constants/api");
const constants_1 = require("../../constants");
const proxy_1 = require("../proxy");
const USER_AGENT = "Mozilla/5.0 (X11; Linux x86_64; rv:109.0) Gecko/20100101 Firefox/111.0";
const validateTikTokUrl = (url) => constants_1.TIKTOK_URL_REGEX.test(url);
const extractTTValue = (html) => {
    const regex = /s_tt\s*=\s*["']([^"']+)["']/;
    const match = html.match(regex);
    return match ? match[1] : null;
};
const parseAuthor = ($) => ({
    avatar: $("img.result_author").attr("src") || "",
    nickname: $("h2").text().trim()
});
const parseStatistics = ($) => ({
    likeCount: $("#trending-actions > .justify-content-start").text().trim(),
    commentCount: $("#trending-actions > .justify-content-center").text().trim(),
    shareCount: $("#trending-actions > .justify-content-end").text().trim()
});
const parseImages = ($) => {
    const images = [];
    $("ul.splide__list > li").each((_, img) => {
        const href = $(img).find("a").attr("href");
        if (href)
            images.push(href);
    });
    return images;
};
const createImageResponse = ($, author, statistics, images, music) => ({
    type: "image",
    desc: $("p.maintext").text().trim(),
    author,
    statistics,
    images,
    ...(music && { music: { playUrl: [music] } })
});
const createVideoResponse = ($, author, statistics, video, music) => ({
    type: "video",
    desc: $("p.maintext").text().trim(),
    author,
    statistics,
    video: { playAddr: [video] },
    ...(music && { music: { playUrl: [music] } })
});
const createMusicResponse = (music, direct) => ({
    type: "music",
    music: { playUrl: [music] },
    direct: direct || ""
});
const fetchTT = async (proxy) => {
    try {
        const res = await (0, undici_1.fetch)(api_1._ssstikurl, {
            method: "GET",
            headers: { "User-Agent": USER_AGENT },
            ...(0, proxy_1.createDispatcher)(proxy)
        });
        const data = await res.text();
        const ttValue = extractTTValue(data);
        if (!ttValue) {
            return {
                status: "error",
                message: constants_1.ERROR_MESSAGES.NETWORK_ERROR
            };
        }
        return {
            status: "success",
            result: ttValue
        };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : constants_1.ERROR_MESSAGES.NETWORK_ERROR
        };
    }
};
const SSSTik = async (url, proxy) => {
    try {
        if (!validateTikTokUrl(url)) {
            return {
                status: "error",
                message: constants_1.ERROR_MESSAGES.INVALID_URL
            };
        }
        const tt = await fetchTT(proxy);
        if (tt.status !== "success") {
            return {
                status: "error",
                message: tt.message
            };
        }
        const response = await (0, async_retry_1.default)(async () => {
            const res = await (0, undici_1.fetch)(api_1._ssstikapi, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
                    Origin: api_1._ssstikurl,
                    Referer: `${api_1._ssstikurl}/en`,
                    "User-Agent": USER_AGENT
                },
                body: new URLSearchParams({
                    id: url,
                    locale: "en",
                    tt: tt.result
                }),
                ...(0, proxy_1.createDispatcher)(proxy)
            });
            if (res.status === 200) {
                return await res.text();
            }
            throw new Error(constants_1.ERROR_MESSAGES.NETWORK_ERROR);
        }, {
            retries: 20,
            minTimeout: 200,
            maxTimeout: 1000
        });
        const $ = (0, cheerio_1.load)(response);
        const author = parseAuthor($);
        const statistics = parseStatistics($);
        const video = $("a.without_watermark").attr("href");
        const music = $("a.music").attr("href");
        const direct = $("a.music_direct").attr("href");
        const images = parseImages($);
        let result;
        if (images.length > 0) {
            result = createImageResponse($, author, statistics, images, music);
        }
        else if (video) {
            result = createVideoResponse($, author, statistics, video, music);
        }
        else if (music) {
            result = createMusicResponse(music, direct);
        }
        else {
            return {
                status: "error",
                message: constants_1.ERROR_MESSAGES.NETWORK_ERROR
            };
        }
        return {
            status: "success",
            result
        };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : constants_1.ERROR_MESSAGES.NETWORK_ERROR
        };
    }
};
exports.SSSTik = SSSTik;
