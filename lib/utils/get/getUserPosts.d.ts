import { Posts, TiktokUserPostsResponse } from "../../types/get/getUserPosts";
export declare const getUserPosts: (username: string, cookie?: string | string[], proxy?: string, postLimit?: number) => Promise<TiktokUserPostsResponse>;
export declare const fetchPostsFromEmbed: (username: string, profileUser?: any, postLimit?: number, proxy?: string, cookies?: string) => Promise<Posts[]>;
