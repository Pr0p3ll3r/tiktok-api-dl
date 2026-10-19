"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createDispatcher = void 0;
const undici_1 = require("undici");
const createDispatcher = (proxy) => {
    if (!proxy)
        return {};
    return { dispatcher: new undici_1.ProxyAgent(proxy) };
};
exports.createDispatcher = createDispatcher;
