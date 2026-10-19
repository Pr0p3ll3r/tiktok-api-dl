"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPlaylist = void 0;
const undici_1 = require("undici");
const api_1 = require("../../constants/api");
const params_1 = require("../../constants/params");
const constants_1 = require("../../constants");
const proxy_1 = require("../proxy");
const async_retry_1 = __importDefault(require("async-retry"));
const getPlaylist = async (playlistId, proxy, page = 1, count = 5) => {
    try {
        const response = await (0, async_retry_1.default)(async () => {
            const res = await (0, undici_1.fetch)((0, api_1._tiktokGetPlaylist)((0, params_1._getPlaylistParams)(playlistId, page, count)), {
                method: "GET",
                headers: {
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:138.0) Gecko/20100101 Firefox/138.0",
                    Accept: "*/*",
                    "Accept-Language": "en-US,en;q=0.7",
                    Referer: "https://www.tiktok.com/",
                    Origin: "https://www.tiktok.com",
                    "Content-Type": "application/json"
                },
                ...(0, proxy_1.createDispatcher)(proxy)
            });
            if (!res.ok)
                throw new Error(constants_1.ERROR_MESSAGES.NETWORK_ERROR);
            const resData = await res.json();
            if (resData && resData.statusCode === 0) {
                return resData;
            }
            throw new Error(constants_1.ERROR_MESSAGES.NETWORK_ERROR);
        }, {
            retries: 20,
            minTimeout: 200,
            maxTimeout: 1000
        });
        return {
            status: "success",
            result: {
                hasMore: response.hasMore,
                itemList: response.itemList || [],
                extra: response.extra
            }
        };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : constants_1.ERROR_MESSAGES.NETWORK_ERROR
        };
    }
};
exports.getPlaylist = getPlaylist;
