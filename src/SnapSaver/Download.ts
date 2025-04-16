import { CheerioAPI, load } from "cheerio";
import type { SnapSaveDownloaderData, SnapSaveDownloaderMedia, SnapSaveDownloaderResponse } from "./types";
import { facebookRegex, fixThumbnail, instagramRegex, normalizeURL, tiktokRegex } from "./utils";

/**
 * Decodes SnapApp encoded content
 * @param args Array of arguments from the encoded content
 * @returns Decoded content
 */
function decodeSnapApp(args: string[]): string {
  let [encodedContent, u, charMap, subtractValue, base, decodedResult] = args;
  
  /**
   * Internal decoder function for number conversion
   */
  function decodeNumber(value: number, fromBase: number, toBase: number): string {
    const charset = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/".split("");
    const fromCharset = charset.slice(0, fromBase);
    const toCharset = charset.slice(0, toBase);
    
    // @ts-expect-error - Known limitation in type inference for this algorithm
    let decimal = value.split("").reverse().reduce((sum: number, char: string, index: number) => {
      if (fromCharset.indexOf(char) !== -1)
        return sum += fromCharset.indexOf(char) * (Math.pow(fromBase, index));
      return sum;
    }, 0);
    
    let result = "";
    while (decimal > 0) {
      result = toCharset[decimal % toBase] + result;
      decimal = (decimal - (decimal % toBase)) / toBase;
    }
    return result || "0";
  }

  decodedResult = "";
  for (let i = 0, len = encodedContent.length; i < len; i++) {
    let segment = "";
    while (encodedContent[i] !== charMap[Number(base)]) {
      segment += encodedContent[i];
      i++;
    }
    
    for (let j = 0; j < charMap.length; j++) {
      segment = segment.replace(new RegExp(charMap[j], "g"), j.toString());
    }
    
    // @ts-expect-error - Known limitation in type inference for this algorithm
    decodedResult += String.fromCharCode(decodeNumber(segment, base, 10) - subtractValue);
  }

  return fixEncoding(decodedResult);
}

/**
 * Fixes UTF-8 encoding issues in the decoded content
 */
function fixEncoding(str: string): string {
  const bytes = new Uint8Array(str.split("").map(char => char.charCodeAt(0)));
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * Extracts the encoded arguments from SnapSave HTML response
 */
function getEncodedSnapApp(data: string): string[] {
  return data.split("decodeURIComponent(escape(r))}(")[1]
    .split("))")[0]
    .split(",")
    .map(v => v.replace(/"/g, "").trim());
}

/**
 * Extracts the decoded HTML content from SnapSave response
 */
function getDecodedSnapSave(data: string): string {
  return data.split("getElementById(\"download-section\").innerHTML = \"")[1]
    .split("\"; document.getElementById(\"inputData\").remove(); ")[0]
    .replace(/\\(\\)?/g, "");
}

/**
 * Decrypts the SnapSave response by chaining the decoding functions
 */
function decryptSnapSave(data: string): string {
  return getDecodedSnapSave(decodeSnapApp(getEncodedSnapApp(data)));
}

/**
 * Main function to download media from social platforms via SnapSave
 * @param url URL of the social media post to download
 * @returns Response containing success status and download data
 */
export const SnapSaver = async (url: string): Promise<SnapSaveDownloaderResponse> => {
  try {
    // Validate URL against supported platforms
    const regexList = [facebookRegex, instagramRegex, tiktokRegex];
    if (!regexList.some(regex => url.match(regex))) {
      return { 
        success: false, 
        message: "Invalid URL" 
      };
    }

    // Prepare request to SnapSave API
    const formData = new URLSearchParams();
    formData.append("url", normalizeURL(url));

    const response = await fetch("https://snapsave.app/action.php?lang=en", {
      method: "POST",
      headers: {
        "accept": "*/*",
        "content-type": "application/x-www-form-urlencoded",
        "origin": "https://snapsave.app",
        "referer": "https://snapsave.app/",
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0"
      },
      body: formData
    });

    // Process response
    const html = await response.text();
    const decodedHtml = decryptSnapSave(html);
    const $ = load(decodedHtml);
    
    const data: SnapSaveDownloaderData = {};
    const media: SnapSaveDownloaderMedia[] = [];

    // Extract data based on the HTML structure
    if ($("table.table").length || $("article.media > figure").length) {
      // Extract metadata
      const description = $("span.video-des").text().trim();
      const preview = $("article.media > figure").find("img").attr("src");
      
      if (description) data.description = description;
      if (preview) data.preview = preview;
      
      // Extract media from table layout
      if ($("table.table").length) {
        extractTableMedia($, media);
      }
      // Extract media from card layout
      else if ($("div.card").length) {
        extractCardMedia($, media);
      }
      // Extract media from simple layout
      else {
        extractSimpleMedia($, media);
      }
    }
    // Extract media from download items layout
    else if ($("div.download-items").length) {
      extractDownloadItemsMedia($, media);
    }

    // Validate results
    if (!media.length) {
      return { 
        success: false, 
        message: "No downloadable media found" 
      };
    }

    return { 
      success: true, 
      data: { ...data, media } 
    };
  }
  catch (error) {
    console.error("SnapSaver error:", error);
    return { 
      success: false, 
      message: "Failed to process download request" 
    };
  }
};

/**
 * Extract media items from table layout
 */
function extractTableMedia($: CheerioAPI, media: SnapSaveDownloaderMedia[]): void {
  $("tbody > tr").each((_, el) => {
    const $el = $(el);
    const $td = $el.find("td");
    const resolution = $td.eq(0).text();
    let mediaUrl = $td.eq(2).find("a").attr("href") || $td.eq(2).find("button").attr("onclick");
    const shouldRender = /get_progressApi/ig.test(mediaUrl || "");
    
    if (shouldRender) {
      mediaUrl = "https://snapsave.app" + /get_progressApi\('(.*?)'\)/.exec(mediaUrl || "")?.[1] || mediaUrl;
    }
    
    media.push({
      resolution,
      ...(shouldRender ? { shouldRender } : {}),
      url: mediaUrl,
      type: resolution ? "video" : "image"
    });
  });
}

/**
 * Extract media items from card layout
 */
function extractCardMedia($: CheerioAPI, media: SnapSaveDownloaderMedia[]): void {
  $("div.card").each((_, el) => {
    const cardBody = $(el).find("div.card-body");
    const aText = cardBody.find("a").text().trim();
    const url = cardBody.find("a").attr("href");
    const type = aText === "Download Photo" ? "image" : "video";
    
    media.push({
      url,
      type
    });
  });
}

/**
 * Extract media from simple layout
 */
function extractSimpleMedia($: CheerioAPI, media: SnapSaveDownloaderMedia[]): void {
  const url = $("a").attr("href") || $("button").attr("onclick");
  const aText = $("a").text().trim();
  const type = aText === "Download Photo" ? "image" : "video";
  
  media.push({
    url,
    type
  });
}

/**
 * Extract media from download items layout
 */
function extractDownloadItemsMedia($: CheerioAPI, media: SnapSaveDownloaderMedia[]): void {
  $("div.download-items").each((_, el) => {
    const itemThumbnail = $(el).find("div.download-items__thumb > img").attr("src");
    const itemBtn = $(el).find("div.download-items__btn");
    const url = itemBtn.find("a").attr("href");
    const spanText = itemBtn.find("span").text().trim();
    const type = spanText === "Download Photo" ? "image" : "video";
    
    media.push({
      url,
      ...(type === "video" && itemThumbnail ? {
        thumbnail: fixThumbnail(itemThumbnail)
      } : {}),
      type
    });
  });
}