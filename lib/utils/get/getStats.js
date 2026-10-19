"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStats = void 0;
const undici_1 = require("undici");
const zlib_1 = __importDefault(require("zlib"));
const api_1 = require("../../constants/api");
const params_1 = require("../../constants/params");
const proxy_1 = require("../proxy");
const USER_AGENT = "com.zhiliaoapp.musically/300904 (2018111632; U; Android 10; en_US; Pixel 4; Build/QQ3A.200805.001; Cronet/58.0.2991.0)";
const extractId = (input) => {
    const trimmed = input.trim();
    if (/^\d{17,21}$/.test(trimmed)) {
        return trimmed;
    }
    const matches = trimmed.match(/\d{17,21}/g);
    return matches ? matches[0] : null;
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fetchFromTikwm = async (id, proxy) => {
    try {
        const url = `https://www.tikwm.com/api/?url=https://www.tiktok.com/@a/video/${id}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 4000);
        const res = await (0, undici_1.fetch)(url, {
            signal: controller.signal,
            ...(0, proxy_1.createDispatcher)(proxy)
        });
        clearTimeout(timeout);
        if (!res.ok)
            return null;
        const json = await res.json();
        if (json.code !== 0 || !json.data)
            return null;
        const d = json.data;
        return {
            id,
            likeCount: d.digg_count || 0,
            commentCount: d.comment_count || 0,
            shareCount: d.share_count || 0,
            playCount: d.play_count || 0,
            downloadCount: d.download_count || 0,
            collectCount: d.collect_count || 0
        };
    }
    catch {
        return null;
    }
};
const fetchFromTikTokFeed = async (id, proxy) => {
    try {
        const url = (0, api_1._tiktokvFeed)((0, params_1._tiktokApiParams)({ aweme_id: id }));
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 6000);
        const res = await (0, undici_1.fetch)(url, {
            method: "OPTIONS",
            headers: { "User-Agent": USER_AGENT },
            signal: controller.signal,
            ...(0, proxy_1.createDispatcher)(proxy)
        });
        clearTimeout(timeout);
        if (!res.ok)
            return null;
        const buffer = Buffer.from(await res.arrayBuffer());
        let data;
        try {
            if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
                data = JSON.parse(zlib_1.default.gunzipSync(buffer).toString());
            }
            else {
                data = JSON.parse(buffer.toString());
            }
        }
        catch {
            return null;
        }
        const content = data?.aweme_list?.find((v) => v.aweme_id === id);
        if (!content?.statistics)
            return null;
        const s = content.statistics;
        return {
            id,
            likeCount: s.digg_count || 0,
            commentCount: s.comment_count || 0,
            shareCount: s.share_count || 0,
            playCount: s.play_count || 0,
            downloadCount: s.download_count || 0,
            collectCount: s.collect_count || 0
        };
    }
    catch {
        return null;
    }
};
const fetchSingleStat = async (id, proxy) => {
    const fromTikwm = await fetchFromTikwm(id, proxy);
    if (fromTikwm)
        return fromTikwm;
    return await fetchFromTikTokFeed(id, proxy);
};
const getStats = async (idsOrUrls, proxy) => {
    const inputs = Array.isArray(idsOrUrls) ? idsOrUrls : [idsOrUrls];
    const validIds = [];
    for (const input of inputs) {
        if (!input || typeof input !== "string")
            continue;
        const id = extractId(input);
        if (id && !validIds.includes(id)) {
            validIds.push(id);
        }
    }
    if (validIds.length === 0) {
        return {
            status: "error",
            message: "No valid TikTok post IDs or URLs provided!"
        };
    }
    try {
        const results = [];
        for (let i = 0; i < validIds.length; i++) {
            if (i > 0) {
                await delay(120);
            }
            const stat = await fetchSingleStat(validIds[i], proxy);
            if (stat) {
                results.push(stat);
            }
        }
        if (results.length === 0) {
            return {
                status: "error",
                message: "Failed to fetch stats for provided IDs. Post(s) may be private or removed."
            };
        }
        return {
            status: "success",
            result: results
        };
    }
    catch (error) {
        return {
            status: "error",
            message: error?.message || "An error occurred while fetching stats"
        };
    }
};
exports.getStats = getStats;
