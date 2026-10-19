"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getComments = void 0;
const undici_1 = require("undici");
const api_1 = require("../../constants/api");
const params_1 = require("../../constants/params");
const constants_1 = require("../../constants");
const proxy_1 = require("../proxy");
const getComments = async (url, proxy, commentLimit) => {
    try {
        if (!constants_1.TIKTOK_URL_REGEX.test(url)) {
            return { status: "error", message: "Invalid TikTok URL" };
        }
        url = url.replace("https://vm", "https://vt");
        const response = await (0, undici_1.fetch)(url, {
            method: "HEAD",
            redirect: "follow",
            ...(0, proxy_1.createDispatcher)(proxy)
        });
        const responseUrl = response.url;
        const idMatch = responseUrl.match(/\d{17,21}/g);
        if (!idMatch) {
            return {
                status: "error",
                message: "Failed to extract video ID from URL"
            };
        }
        const resultComments = await parseComments(idMatch[0], commentLimit, proxy);
        if (!resultComments.comments.length) {
            return { status: "error", message: "No comments found!" };
        }
        return {
            status: "success",
            result: resultComments.comments,
            totalComments: resultComments.total
        };
    }
    catch (error) {
        return {
            status: "error",
            message: error instanceof Error ? error.message : "Failed to fetch comments"
        };
    }
};
exports.getComments = getComments;
const requestComments = async (id, commentLimit, proxy) => {
    const res = await (0, undici_1.fetch)((0, api_1._tiktokGetComments)((0, params_1._getCommentsParams)(id, commentLimit)), {
        method: "GET",
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.114 Safari/537.36"
        },
        ...(0, proxy_1.createDispatcher)(proxy)
    });
    return await res.json();
};
const parseComments = async (id, commentLimit, proxy) => {
    const comments = [];
    let total = 0;
    let hasMore = true;
    while (hasMore) {
        const result = await requestComments(id, commentLimit, proxy);
        hasMore = result.has_more === 1;
        if (result.comments) {
            result.comments.forEach((v) => {
                const comment = {
                    cid: v.cid,
                    text: v.text,
                    commentLanguage: v.comment_language,
                    createTime: v.create_time,
                    likeCount: v.digg_count,
                    isAuthorLiked: v.is_author_digged,
                    isCommentTranslatable: v.is_comment_translatable,
                    replyCommentTotal: v.reply_comment_total,
                    user: {
                        uid: v.user.uid,
                        avatarThumb: v.user.avatar_thumb.url_list,
                        nickname: v.user.nickname,
                        username: v.user.unique_id,
                        isVerified: v.user.custom_verify !== ""
                    },
                    url: v.share_info?.url || "",
                    replyComment: []
                };
                if (v.reply_comment !== null) {
                    v.reply_comment.forEach((reply) => {
                        comment.replyComment.push({
                            cid: reply.cid,
                            text: reply.text,
                            commentLanguage: reply.comment_language,
                            createTime: reply.create_time,
                            likeCount: reply.digg_count,
                            isAuthorLiked: reply.is_author_digged,
                            isCommentTranslatable: reply.is_comment_translatable,
                            replyCommentTotal: reply.reply_comment_total,
                            user: {
                                uid: reply.user.uid,
                                avatarThumb: reply.user.avatar_thumb.url_list,
                                nickname: reply.user.nickname,
                                username: reply.user.unique_id,
                                isVerified: reply.user.custom_verify !== ""
                            },
                            url: reply.share_info?.url || "",
                            replyComment: []
                        });
                        total++;
                    });
                }
                total++;
                comments.push(comment);
            });
        }
        if (commentLimit && comments.length >= commentLimit)
            break;
    }
    const response = commentLimit ? comments.slice(0, commentLimit) : comments;
    return { total: response.length, comments: response };
};
