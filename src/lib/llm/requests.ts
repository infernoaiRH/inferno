/**
 * Records the hosts of network requests this context (the page, or the model worker) starts from
 * now on. Call the returned function to stop and read them. Resource Timing covers fetch, XHR,
 * scripts, styles, images, fonts and beacons; it does not see WebSocket or WebRTC traffic.
 */
export function watchRequests(): () => string[] {
  const since = performance.now();
  const hosts = new Set<string>();
  const note = (entries: PerformanceEntryList) => {
    for (const e of entries) if (e.startTime >= since) hosts.add(new URL(e.name).host);
  };
  const observer = new PerformanceObserver((list) => note(list.getEntries()));
  observer.observe({ type: "resource" });
  // ponytail: an entry lands when its response ends, so a request still in flight when this stops
  // is missed; keep observing a little longer if that ever matters.
  return () => {
    note(observer.takeRecords());
    observer.disconnect();
    return [...hosts];
  };
}
