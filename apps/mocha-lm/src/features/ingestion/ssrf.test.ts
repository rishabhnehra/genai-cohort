import { describe, expect, it } from "vitest";
import { isPrivateOrReservedIp } from "./ssrf";

describe("isPrivateOrReservedIp", () => {
  it("rejects RFC 1918 private ranges", () => {
    expect(isPrivateOrReservedIp("10.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("172.16.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("172.31.255.255")).toBe(true);
    expect(isPrivateOrReservedIp("192.168.1.1")).toBe(true);
  });

  it("rejects loopback addresses", () => {
    expect(isPrivateOrReservedIp("127.0.0.1")).toBe(true);
    expect(isPrivateOrReservedIp("127.255.255.255")).toBe(true);
    expect(isPrivateOrReservedIp("::1")).toBe(true);
  });

  it("rejects link-local addresses, including the cloud metadata IP", () => {
    expect(isPrivateOrReservedIp("169.254.169.254")).toBe(true);
    expect(isPrivateOrReservedIp("169.254.1.1")).toBe(true);
    expect(isPrivateOrReservedIp("fe80::1")).toBe(true);
  });

  it("rejects IPv6 unique local addresses", () => {
    expect(isPrivateOrReservedIp("fc00::1")).toBe(true);
    expect(isPrivateOrReservedIp("fd12:3456:789a::1")).toBe(true);
  });

  it("rejects IPv4-mapped IPv6 addresses that wrap a private IPv4", () => {
    expect(isPrivateOrReservedIp("::ffff:10.0.0.1")).toBe(true);
  });

  it("rejects reserved/multicast ranges", () => {
    expect(isPrivateOrReservedIp("0.0.0.0")).toBe(true);
    expect(isPrivateOrReservedIp("224.0.0.1")).toBe(true);
  });

  it("allows public IPv4 addresses", () => {
    expect(isPrivateOrReservedIp("8.8.8.8")).toBe(false);
    expect(isPrivateOrReservedIp("1.1.1.1")).toBe(false);
    expect(isPrivateOrReservedIp("93.184.216.34")).toBe(false);
  });

  it("allows public IPv6 addresses", () => {
    expect(isPrivateOrReservedIp("2606:4700:4700::1111")).toBe(false);
  });

  it("treats non-IP input as unsafe", () => {
    expect(isPrivateOrReservedIp("not-an-ip")).toBe(true);
  });
});
