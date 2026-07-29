/**
 * Best-effort LiDAR capability detection from the User-Agent string.
 *
 * IMPORTANT — read before trusting this for anything but UI ordering:
 *
 * Apple does not put the device model in Safari's User-Agent. Every iPhone
 * reports the same `(iPhone; CPU iPhone OS 17_5 like Mac OS X)` regardless of
 * whether it is a 12 Pro with a LiDAR sensor or an SE without one. Worse, since
 * iPadOS 13 Safari defaults to "Request Desktop Website" and an iPad Pro
 * identifies itself as `(Macintosh; Intel Mac OS X 10_15_7)` — byte-identical
 * to a MacBook.
 *
 * So a precise "iPhone 12 Pro+ / iPad Pro 2021+" test is not achievable from the
 * UA alone. What we can do is rule devices *out*: LiDAR arrived with the iPhone
 * 12 Pro (shipped on iOS 14.1) and the iPad Pro M1 (iPadOS 14.5), so anything
 * below iOS 14 — or not an Apple mobile device at all — definitely cannot scan.
 * iOS >= 14 is therefore necessary but not sufficient.
 *
 * The consequence for the UI: both paths are always offered and this only
 * decides which card gets the primary call to action. A non-Pro iPhone user who
 * taps the LiDAR card lands on the magicplan instructions and finds out there;
 * nobody is ever locked out of a working path. If we later need certainty, the
 * honest fix is a client-side WebXR / `navigator.xr` probe or simply asking the
 * user — not a longer UA regex.
 */

/** First iOS version shipped on any LiDAR-equipped device (iPhone 12 Pro). */
const MIN_LIDAR_IOS_MAJOR = 14;

export type DeviceCapability = {
  /** The device *may* have a LiDAR sensor — use for CTA ordering only. */
  lidarLikely: boolean;
  isAppleMobile: boolean;
  iosMajorVersion: number | null;
  /** Why we decided what we decided, surfaced in the UI as a hint. */
  reason: "ios-lidar-era" | "ios-too-old" | "not-apple-mobile" | "unknown";
};

export function detectDeviceCapability(
  userAgent: string | null | undefined,
): DeviceCapability {
  if (!userAgent) {
    return {
      lidarLikely: false,
      isAppleMobile: false,
      iosMajorVersion: null,
      reason: "unknown",
    };
  }

  const isAppleMobile = /\b(iPhone|iPad|iPod)\b/.test(userAgent);

  if (!isAppleMobile) {
    return {
      lidarLikely: false,
      isAppleMobile: false,
      iosMajorVersion: null,
      reason: "not-apple-mobile",
    };
  }

  const iosMajorVersion = parseIosMajorVersion(userAgent);

  // Unknown version on an Apple mobile device: assume capable rather than hide
  // the faster path from someone who can use it.
  if (iosMajorVersion === null) {
    return {
      lidarLikely: true,
      isAppleMobile: true,
      iosMajorVersion: null,
      reason: "ios-lidar-era",
    };
  }

  const lidarLikely = iosMajorVersion >= MIN_LIDAR_IOS_MAJOR;

  return {
    lidarLikely,
    isAppleMobile: true,
    iosMajorVersion,
    reason: lidarLikely ? "ios-lidar-era" : "ios-too-old",
  };
}

/** Reads the major version out of `CPU iPhone OS 17_5` / `CPU OS 14_5`. */
function parseIosMajorVersion(userAgent: string): number | null {
  const match = /\b(?:iPhone )?OS (\d+)[_.]/.exec(userAgent);
  if (!match) return null;

  const major = Number.parseInt(match[1], 10);
  return Number.isFinite(major) ? major : null;
}
