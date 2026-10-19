"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LIMITS = exports.ERROR_MESSAGES = exports.SEARCH_TYPES = exports.DOWNLOADER_VERSIONS = exports.TIKTOK_URL_REGEX = void 0;
exports.TIKTOK_URL_REGEX = /https:\/\/(?:m|t|www|vm|vt|lite)?\.?tiktok\.com\/((?:.*\b(?:(?:usr|v|embed|user|video|photo)\/|\?shareId=|\&item_id=)(\d+))|\w+)/;
exports.DOWNLOADER_VERSIONS = {
    V1: "v1",
    V2: "v2",
    V3: "v3"
};
exports.SEARCH_TYPES = {
    USER: "user",
    LIVE: "live",
    VIDEO: "video"
};
exports.ERROR_MESSAGES = {
    COOKIE_REQUIRED: "Cookie is required!",
    INVALID_COOKIE: "Invalid cookie!",
    INVALID_VERSION: "Invalid downloader version",
    INVALID_SEARCH_TYPE: "Invalid search type",
    INVALID_URL: "Invalid TikTok URL",
    NETWORK_ERROR: "Network error occurred",
    RATE_LIMIT: "Rate limit exceeded",
    USER_NOT_FOUND: "User not found!",
    NO_RESULTS: "No results found!"
};
exports.DEFAULT_LIMITS = {
    POST_LIMIT: 30,
    COMMENT_LIMIT: 20,
    SEARCH_PAGE_SIZE: 20
};
