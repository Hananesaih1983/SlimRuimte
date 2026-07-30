// @vitest-environment node

import { describe, expect, it } from "vitest";
import { detectDeviceCapability } from "@/lib/scan/device";

/**
 * The test brief asked for `isLidarCapable`, exact per device model:
 *   iPhone 12 Pro -> true, iPhone 11 -> false.
 *
 * That function cannot exist, and the tests below say so explicitly rather than
 * asserting a fiction. Safari sends NO device model. An iPhone 11 and an
 * iPhone 12 Pro on the same iOS build emit byte-identical User-Agent strings —
 * see `IPHONE_MODERN` below, which is simultaneously a valid iPhone 11 UA and a
 * valid iPhone 12 Pro UA. No parser can separate them, so the per-model
 * assertion is untestable in principle, not merely unimplemented.
 *
 * What the shipped `detectDeviceCapability` claims is weaker and true: it rules
 * devices OUT. LiDAR arrived with the iPhone 12 Pro (iOS 14.1) and the iPad Pro
 * M1 (iPadOS 14.5), so iOS < 14 or non-Apple definitely cannot scan.
 * `lidarLikely` is a CTA-ordering hint, not an entitlement check — both scan
 * paths stay reachable, so a false positive costs a user one extra tap and a
 * false negative costs nothing at all.
 */

const IPHONE_MODERN =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

/** An iPhone 11 can reach iOS 17, so this is the last build that separates it. */
const IPHONE_PRE_LIDAR_OS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 13_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.1.2 Mobile/15E148 Safari/604.1";

const IPAD_PRO_2021 =
  "Mozilla/5.0 (iPad; CPU OS 14_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1 Mobile/15E148 Safari/604.1";

/** iPadOS 13+ defaults to "Request Desktop Website" and claims to be a Mac. */
const IPAD_DESKTOP_MODE =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";

const ANDROID =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

describe("detectDeviceCapability", () => {
  it("treats a LiDAR-era iPhone as capable", () => {
    expect(detectDeviceCapability(IPHONE_MODERN).lidarLikely).toBe(true);
  });

  it("rules out an iPhone on an iOS that predates LiDAR", () => {
    const result = detectDeviceCapability(IPHONE_PRE_LIDAR_OS);
    expect(result.lidarLikely).toBe(false);
    expect(result.reason).toBe("ios-too-old");
  });

  it("treats an iPad Pro 2021 as capable", () => {
    const result = detectDeviceCapability(IPAD_PRO_2021);
    expect(result.lidarLikely).toBe(true);
    expect(result.iosMajorVersion).toBe(14);
  });

  it("rules out Android", () => {
    const result = detectDeviceCapability(ANDROID);
    expect(result.lidarLikely).toBe(false);
    expect(result.reason).toBe("not-apple-mobile");
    expect(result.isAppleMobile).toBe(false);
  });

  it("rules out an empty User-Agent", () => {
    const result = detectDeviceCapability("");
    expect(result.lidarLikely).toBe(false);
    expect(result.reason).toBe("unknown");
  });

  it("rules out a missing User-Agent header", () => {
    expect(detectDeviceCapability(null).lidarLikely).toBe(false);
    expect(detectDeviceCapability(undefined).lidarLikely).toBe(false);
  });

  describe("documented limits of UA sniffing", () => {
    it("cannot separate an iPhone 11 from an iPhone 12 Pro — same UA, same verdict", () => {
      // This IS the iPhone 11 case from the brief. It returns true, and no
      // amount of regex will make it return false: there is nothing in the
      // string that differs. Asserting `false` here would only be asserting
      // that we had hard-coded a wrong answer.
      const asIphone11 = detectDeviceCapability(IPHONE_MODERN);
      const asIphone12Pro = detectDeviceCapability(IPHONE_MODERN);

      expect(asIphone11).toEqual(asIphone12Pro);
      expect(asIphone11.lidarLikely).toBe(true);
    });

    it("misses an iPad Pro in desktop mode, which is indistinguishable from a MacBook", () => {
      const result = detectDeviceCapability(IPAD_DESKTOP_MODE);
      expect(result.lidarLikely).toBe(false);
      expect(result.reason).toBe("not-apple-mobile");
    });

    it("assumes capable when an Apple mobile device reports no parsable version", () => {
      // Better to over-offer the fast path than to hide it from someone who
      // can actually use it — nobody is locked out either way.
      const result = detectDeviceCapability("Mozilla/5.0 (iPhone) AppleWebKit/605.1.15");
      expect(result.lidarLikely).toBe(true);
      expect(result.iosMajorVersion).toBeNull();
    });

    it("does not match 'iPhone' inside an unrelated word", () => {
      expect(detectDeviceCapability("MyiPhoneClone/1.0").isAppleMobile).toBe(false);
    });
  });

  describe("the iOS 14 boundary", () => {
    const at = (major: number) =>
      detectDeviceCapability(`Mozilla/5.0 (iPhone; CPU iPhone OS ${major}_0 like Mac OS X)`);

    it("rejects iOS 13", () => {
      expect(at(13).lidarLikely).toBe(false);
    });

    it("accepts iOS 14, the first LiDAR-era release", () => {
      expect(at(14).lidarLikely).toBe(true);
    });

    it("accepts a two-digit major above the boundary without string-comparing it", () => {
      // A naive string compare would rank "9" above "14".
      expect(at(18).lidarLikely).toBe(true);
      expect(at(9).lidarLikely).toBe(false);
    });
  });
});
