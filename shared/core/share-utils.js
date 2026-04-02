(function initIsfShare(global) {
  "use strict";

  const HASH_COMPRESSED_PREFIX = "z:";
  const HASH_STATE_MAX_LENGTH = 6000;
  const SHARE_ID_QUERY_PARAM = "sid";
  const VIEW_MODE_QUERY_PARAM = "view";
  const VIEW_MODE_QUERY_VALUE = "1";

  const LZ_URI_SAFE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+-$";
  const LZ_URI_SAFE_REVERSE_MAP = new Map(
    Array.from(LZ_URI_SAFE_ALPHABET).map((char, index) => [char, index]),
  );

  function lzCompress(uncompressed, bitsPerChar, getCharFromInt) {
    if (uncompressed === null || uncompressed === undefined || uncompressed === "") {
      return "";
    }
  
    const dictionary = Object.create(null);
    const dictionaryToCreate = Object.create(null);
    let c = "";
    let wc = "";
    let w = "";
    let enlargeIn = 2;
    let dictSize = 3;
    let numBits = 2;
    const data = [];
    let dataVal = 0;
    let dataPosition = 0;
  
    const pushBit = (bit) => {
      dataVal = (dataVal << 1) | (bit & 1);
      if (dataPosition === bitsPerChar - 1) {
        dataPosition = 0;
        data.push(getCharFromInt(dataVal));
        dataVal = 0;
        return;
      }
      dataPosition += 1;
    };
  
    const pushBits = (value, bitCount) => {
      let localValue = value;
      for (let index = 0; index < bitCount; index += 1) {
        pushBit(localValue & 1);
        localValue >>= 1;
      }
    };
  
    for (let index = 0; index < uncompressed.length; index += 1) {
      c = uncompressed.charAt(index);
      if (!Object.prototype.hasOwnProperty.call(dictionary, c)) {
        dictionary[c] = dictSize;
        dictSize += 1;
        dictionaryToCreate[c] = true;
      }
  
      wc = `${w}${c}`;
      if (Object.prototype.hasOwnProperty.call(dictionary, wc)) {
        w = wc;
        continue;
      }
  
      if (Object.prototype.hasOwnProperty.call(dictionaryToCreate, w)) {
        if (w.charCodeAt(0) < 256) {
          pushBits(0, numBits);
          pushBits(w.charCodeAt(0), 8);
        } else {
          pushBits(1, numBits);
          pushBits(w.charCodeAt(0), 16);
        }
        enlargeIn -= 1;
        if (enlargeIn === 0) {
          enlargeIn = 2 ** numBits;
          numBits += 1;
        }
        delete dictionaryToCreate[w];
      } else {
        pushBits(dictionary[w], numBits);
      }
  
      enlargeIn -= 1;
      if (enlargeIn === 0) {
        enlargeIn = 2 ** numBits;
        numBits += 1;
      }
      dictionary[wc] = dictSize;
      dictSize += 1;
      w = String(c);
    }
  
    if (w !== "") {
      if (Object.prototype.hasOwnProperty.call(dictionaryToCreate, w)) {
        if (w.charCodeAt(0) < 256) {
          pushBits(0, numBits);
          pushBits(w.charCodeAt(0), 8);
        } else {
          pushBits(1, numBits);
          pushBits(w.charCodeAt(0), 16);
        }
        enlargeIn -= 1;
        if (enlargeIn === 0) {
          enlargeIn = 2 ** numBits;
          numBits += 1;
        }
        delete dictionaryToCreate[w];
      } else {
        pushBits(dictionary[w], numBits);
      }
  
      enlargeIn -= 1;
      if (enlargeIn === 0) {
        enlargeIn = 2 ** numBits;
        numBits += 1;
      }
    }
  
    pushBits(2, numBits);
  
    while (true) {
      dataVal <<= 1;
      if (dataPosition === bitsPerChar - 1) {
        data.push(getCharFromInt(dataVal));
        break;
      }
      dataPosition += 1;
    }
    return data.join("");
  }
  
  function lzDecompress(length, resetValue, getNextValue) {
    const dictionary = [];
    const result = [];
    const data = {
      val: getNextValue(0),
      position: resetValue,
      index: 1,
    };
    let enlargeIn = 4;
    let dictSize = 4;
    let numBits = 3;
    let entry = "";
    let w = "";
    let bits = 0;
    let c;
  
    const readBits = (bitCount) => {
      let localBits = 0;
      let maxpower = 2 ** bitCount;
      let power = 1;
      while (power !== maxpower) {
        const resb = data.val & data.position;
        data.position >>= 1;
        if (data.position === 0) {
          data.position = resetValue;
          data.val = getNextValue(data.index);
          data.index += 1;
        }
        localBits |= (resb > 0 ? 1 : 0) * power;
        power <<= 1;
      }
      return localBits;
    };
  
    for (let index = 0; index < 3; index += 1) {
      dictionary[index] = index;
    }
  
    bits = readBits(2);
    switch (bits) {
      case 0:
        c = String.fromCharCode(readBits(8));
        break;
      case 1:
        c = String.fromCharCode(readBits(16));
        break;
      case 2:
        return "";
      default:
        c = "";
    }
  
    dictionary[3] = c;
    w = c;
    result.push(c);
  
    while (true) {
      if (data.index > length) {
        return "";
      }
      const code = readBits(numBits);
      let currentCode = code;
  
      if (currentCode === 0) {
        dictionary[dictSize] = String.fromCharCode(readBits(8));
        currentCode = dictSize;
        dictSize += 1;
        enlargeIn -= 1;
      } else if (currentCode === 1) {
        dictionary[dictSize] = String.fromCharCode(readBits(16));
        currentCode = dictSize;
        dictSize += 1;
        enlargeIn -= 1;
      } else if (currentCode === 2) {
        return result.join("");
      }
  
      if (enlargeIn === 0) {
        enlargeIn = 2 ** numBits;
        numBits += 1;
      }
  
      if (dictionary[currentCode]) {
        entry = dictionary[currentCode];
      } else if (currentCode === dictSize) {
        entry = w + w.charAt(0);
      } else {
        return null;
      }
  
      result.push(entry);
      dictionary[dictSize] = w + entry.charAt(0);
      dictSize += 1;
      enlargeIn -= 1;
      w = entry;
  
      if (enlargeIn === 0) {
        enlargeIn = 2 ** numBits;
        numBits += 1;
      }
    }
  }

  function lzCompressToUriComponent(input) {
    if (input === null || input === undefined) {
      return "";
    }
    return lzCompress(String(input), 6, (value) => LZ_URI_SAFE_ALPHABET.charAt(value));
  }
  
  function lzDecompressFromUriComponent(input) {
    if (input === null || input === undefined) {
      return "";
    }
    const normalized = String(input).replace(/ /g, "+");
    if (!normalized) {
      return "";
    }
    return lzDecompress(normalized.length, 32, (index) => {
      const char = normalized.charAt(index);
      return LZ_URI_SAFE_REVERSE_MAP.has(char) ? LZ_URI_SAFE_REVERSE_MAP.get(char) : 0;
    });
  }

  function encodeBase64Url(text) {
    const safeText = String(text ?? "");
    const bytes = new TextEncoder().encode(safeText);
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }
  
  function decodeBase64Url(value) {
    const normalized = String(value ?? "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function buildStateEnvelope(appKey, schemaVersion, dataObj) {
    return {
      app: appKey,
      schemaVersion: schemaVersion,
      exportedAt: new Date().toISOString(),
      data: dataObj,
    };
  }

  function parseStateEnvelope(parsed, expectedAppKey) {
    if (!parsed || typeof parsed !== "object") {
      return null;
    }
  
    if (Object.prototype.hasOwnProperty.call(parsed, "data")) {
      const app = typeof parsed.app === "string" ? parsed.app.trim() : "";
      if (expectedAppKey && app && app !== expectedAppKey) {
        return null;
      }
      if (!parsed.data || typeof parsed.data !== "object") {
        return null;
      }
      return parsed.data;
    }
  
    // Legacy support without envelope
    return parsed;
  }

  function encodePayloadForHash(envelope) {
    try {
      const serialized = JSON.stringify(envelope);
      const compressed = lzCompressToUriComponent(serialized);
      const compressedPayload = `${HASH_COMPRESSED_PREFIX}${compressed}`;
      if (compressed && compressedPayload.length <= HASH_STATE_MAX_LENGTH) {
        return compressedPayload;
      }
      const legacyEncoded = encodeBase64Url(serialized);
      if (!legacyEncoded || legacyEncoded.length > HASH_STATE_MAX_LENGTH) {
        return null;
      }
      return legacyEncoded;
    } catch (_error) {
      return null;
    }
  }

  function decodePayloadFromHash(hashParam, expectedAppKey = null) {
    try {
      if (!hashParam) return null;
      
      const decoded = hashParam.startsWith(HASH_COMPRESSED_PREFIX)
        ? lzDecompressFromUriComponent(hashParam.slice(HASH_COMPRESSED_PREFIX.length))
        : decodeBase64Url(hashParam);
        
      if (!decoded) {
        return null;
      }
      const parsed = JSON.parse(decoded);
      return parseStateEnvelope(parsed, expectedAppKey);
    } catch (_error) {
      return null;
    }
  }

  function detectViewMode() {
    try {
      const params = new URLSearchParams(window.location.search);
      const raw = String(params.get(VIEW_MODE_QUERY_PARAM) || "").trim().toLowerCase();
      return raw === VIEW_MODE_QUERY_VALUE || raw === "true" || raw === "view";
    } catch (_error) {
      return false;
    }
  }

  function getShareIdFromUrl() {
    try {
      const params = new URLSearchParams(window.location.search);
      const text = String(params.get(SHARE_ID_QUERY_PARAM) || "").trim();
      if (!text || !/^[a-zA-Z0-9_-]{8,48}$/.test(text)) {
        return "";
      }
      return text;
    } catch (_error) {
      return "";
    }
  }

  function exportAsJson(envelope, filenamePrefix = "export") {
    const blob = new Blob([JSON.stringify(envelope, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${filenamePrefix}-${datePart}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function parseImportedJson(text, expectedAppKey = null) {
    const parsed = JSON.parse(String(text ?? ""));
    const data = parseStateEnvelope(parsed, expectedAppKey);
    if (!data) {
      throw new Error("invalid-json");
    }
    return data;
  }

  global.IsfShare = {
    buildStateEnvelope,
    parseStateEnvelope,
    encodePayloadForHash,
    decodePayloadFromHash,
    detectViewMode,
    getShareIdFromUrl,
    exportAsJson,
    parseImportedJson,
    VIEW_MODE_QUERY_PARAM,
    VIEW_MODE_QUERY_VALUE,
    SHARE_ID_QUERY_PARAM,
  };

})(window);
