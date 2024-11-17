'use client'

import HLSVideoPlayer from "@/components/HLSVideoPlayer";

export default function Home() {
  return (
    <div>
      Home
      <HLSVideoPlayer manifestUrl="http://35.188.2.50:8080/hls/test.m3u8" />
    </div>
  );
}
