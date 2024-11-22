'use client'

import HLSVideoPlayer from "@/components/HLSVideoPlayer";

export default function Home() {
  return (
    <>
      Home
      <HLSVideoPlayer manifestUrl="http://34.75.81.163:8080/hls/test.m3u8" />
    </>
  );
}

// reg server: http://35.188.2.50:8080/hls/test.m3u8