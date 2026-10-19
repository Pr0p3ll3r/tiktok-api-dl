"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMusicDetail = void 0;
const undici_1 = require("undici");
const api_1 = require("../../constants/api");
const params_1 = require("../../constants/params");
const tiktokService_1 = require("../../services/tiktokService");
const headers_1 = require("../../constants/headers");
const urlExtractors_1 = require("../urlExtractors");
const proxy_1 = require("../proxy");
const getMusicDetail = async (musicIdOrUrl, cookie, proxy) => {
    try {
        const musicId = (0, urlExtractors_1.extractMusicId)(musicIdOrUrl);
        if (!musicId) {
            return { status: "error", message: "Invalid music ID or URL format" };
        }
        const Tiktok = new tiktokService_1.TiktokService();
        const params = (0, params_1._getMusicDetailParams)(musicId);
        const xttparams = Tiktok.generateXTTParams(params);
        const url = new URL((0, api_1._tiktokGetMusicDetail)());
        url.search = params;
        const response = await (0, undici_1.fetch)(url.toString(), {
            headers: {
                "User-Agent": headers_1.webUserAgent,
                Cookie: Array.isArray(cookie) ? cookie.join("; ") : cookie,
                "x-tt-params": xttparams
            },
            ...(0, proxy_1.createDispatcher)(proxy)
        });
        console.log("Response status:", response.status);
        const responseData = await response.json();
        if (responseData.statusCode === 0 && responseData.musicInfo) {
            return {
                status: "success",
                result: {
                    musicInfo: responseData.musicInfo,
                    shareMeta: responseData.shareMeta
                }
            };
        }
        return {
            status: "error",
            message: responseData.status_msg || "Music not found"
        };
    }
    catch (err) {
        return {
            status: "error",
            message: err.message || "Failed to fetch music detail"
        };
    }
};
exports.getMusicDetail = getMusicDetail;
