export const facebookRegex = /^https?:\/\/(?:www\.|web\.|m\.)?facebook\.com\/(watch(\?v=|\/\?v=)[0-9]+(?!\/)|reel\/[0-9]+|[a-zA-Z0-9.\-_]+\/(videos|posts)\/[0-9]+|[0-9]+\/(videos|posts)\/[0-9]+|[a-zA-Z0-9]+\/(videos|posts)\/[0-9]+|share\/(v|r)\/[a-zA-Z0-9]+\/?)([^/?#&]+).*$|^https:\/\/fb\.watch\/[a-zA-Z0-9]+$/g;
export const instagramRegex = /^https?:\/\/(?:www\.)?instagram\.com\/(?:p|reel|reels|tv|stories|share)\/([^/?#&]+).*/g;
export const tiktokRegex = /^https?:\/\/(?:www\.|m\.|vm\.|vt\.)?tiktok\.com\/(?:@[^/]+\/(?:video|photo)\/\d+|v\/\d+|t\/[\w]+|[\w-]+)\/?/gi;
export const youtubeRegex = /^https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})(?:[?&][^#\s]*)?/;

export const normalizeURL = (url: string) => {
  return /^(https?:\/\/)(?!www\.)[a-z0-9]+/i.test(url) ? url.replace(/^(https?:\/\/)([^./]+\.[^./]+)(\/.*)?$/, "$1www.$2$3") : url;
};

export const fixThumbnail = (url: string) => {
  const toReplace = "https://snapinsta.app/photo.php?photo=";
  return url.includes(toReplace) ? decodeURIComponent(url.replace(toReplace, "")) : url;
};

export const DetectPlatformFromRegex = (url: string) => {
  if (facebookRegex.test(url)) return "Facebook";
  if (instagramRegex.test(url)) return "Instagram";
  if (tiktokRegex.test(url)) return "TikTok";
  if (youtubeRegex.test(url)) return "YouTube";
  return null;
}