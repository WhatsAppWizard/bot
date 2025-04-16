/**
 * Regular expression patterns for various social media platforms
 * Each regex is designed to match the URL format for a specific platform
 */

// Facebook URLs including watch, reels, videos, posts and fb.watch short links
export const facebookRegex = /^https?:\/\/(?:www\.|web\.|m\.)?facebook\.com\/(watch(\?v=|\/\?v=)[0-9]+(?!\/)|reel\/[0-9]+|[a-zA-Z0-9.\-_]+\/(videos|posts)\/[0-9]+|[0-9]+\/(videos|posts)\/[0-9]+|[a-zA-Z0-9]+\/(videos|posts)\/[0-9]+|share\/(v|r)\/[a-zA-Z0-9]+\/?)([^/?#&]+).*$|^https:\/\/fb\.watch\/[a-zA-Z0-9]+$/;

// Instagram URLs for posts, reels, stories, tv and share links
export const instagramRegex = /^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|reels|tv|stories|share)\/([^/?#&]+).*/;

// TikTok URLs for various formats including user videos, photos and short links
export const tiktokRegex = /^https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\/(?:@[^/]+\/(?:video|photo)\/\d+|v\/\d+|t\/[\w]+|[\w-]+)\/?/i;

// YouTube URLs for standard watch URLs, shorts and embed links
export const youtubeRegex = /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&][^#\s]*)?/;

// Twitter/X URLs for tweet status links
export const twitterRegex = /^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/(?:#!\/)?(?:[\w_]+\/status(?:es)?\/)([0-9]+)(?:[?&][^#\s]*)?/;


export const normalizeURL = (url: string): string => {
  return /^(https?:\/\/)(?!www\.)[a-z0-9]+/i.test(url) 
    ? url.replace(/^(https?:\/\/)([^./]+\.[^./]+)(\/.*)?$/, "$1www.$2$3") 
    : url;
};


export const fixThumbnail = (url: string): string => {
  const toReplace = "https://snapinsta.app/photo.php?photo=";
  return url.includes(toReplace) ? decodeURIComponent(url.replace(toReplace, "")) : url;
};


export const detectPlatformFromURL = (url: string): string | null => {
  if (facebookRegex.test(url)) return "Facebook";
  if (instagramRegex.test(url)) return "Instagram";
  if (tiktokRegex.test(url)) return "TikTok";
  if (youtubeRegex.test(url)) return "YouTube";
  if (twitterRegex.test(url)) return "Twitter";
  return null;
};