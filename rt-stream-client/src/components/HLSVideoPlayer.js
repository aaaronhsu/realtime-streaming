"use client"
import React, { useEffect, useRef, useState } from 'react';
import muxjs from 'mux.js';

class LiveHLSManager {
  constructor(videoElement, manifestUrl, onStats) {
    this.mediaSource = new MediaSource();
    this.sourceBuffer = null;
    this.downloadedSegments = new Set();
    this.currentSegments = [];
    this.manifestUrl = manifestUrl;
    this.baseUrl = manifestUrl.split('/').slice(0, -1).join('/') + '/';
    this.isRunning = false;
    this.videoElement = videoElement;
    this.updateInterval = null;
    this.onStats = onStats;
    this.debug = true;
    this.transmuxer = new muxjs.mp4.Transmuxer();

    // Create object URL and set it as video source
    this.videoElement.src = URL.createObjectURL(this.mediaSource);

    this.mediaSource.addEventListener('sourceopen', () => {
      try {
        // Use a more flexible MIME type that supports various MP4 codecs
        this.log("MediaSource ready")
        this.sourceBuffer = this.mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');
        this.sourceBuffer.mode = 'segments';
        
        this.sourceBuffer.addEventListener('updateend', () => {
          this.processNextSegment();
          this.updateStats();
        });

        this.startStreaming();
      } catch (error) {
        this.log(`Failed to initialize MediaSource: ${error}`);
      }
    });

    // Monitor buffer state
    this.videoElement.addEventListener('waiting', () => {
      this.processNextSegment();
    });

    this.videoElement.addEventListener('loadedmetadata', () => this.log('Video loadedmetadata'));
    this.videoElement.addEventListener('canplay', () => this.log('Video canplay'));
    this.videoElement.addEventListener('playing', () => this.log('Video playing'));
    this.videoElement.addEventListener('waiting', () => this.log('Video waiting'));
    this.videoElement.addEventListener('error', (e) => this.log('Video error:', e));

    this.transmuxer.on('data', (segment) => {
      const { initSegment, data } = segment;
    
      try {
        if (!this.sourceBuffer.updating) {
          this.sourceBuffer.appendBuffer(new Uint8Array([...initSegment, ...data]));
        }
      } catch (error) {
        this.log(`Error appending buffer: ${error}`);
      }
    });
  }

  log(...args) {
    if (this.debug) {
      console.log('[LiveHLSManager]', ...args);
    }
  }

  updateStats() {
    const buffered = this.videoElement.buffered.length 
      ? this.videoElement.buffered.end(this.videoElement.buffered.length - 1) - this.videoElement.buffered.start(0)
      : 0;

    this.onStats({
      buffered,
      downloaded: this.downloadedSegments.size,
    });
  }

  async downloadManifest() {
    try {
      const response = await fetch(this.manifestUrl, {
        method: 'GET'
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.text();
    } catch (error) {
      throw new Error(`Failed to download manifest: ${error}`);
    }
  }

  async downloadSegment(segmentUri) {
    const url = segmentUri.startsWith('http') ? segmentUri : `${this.baseUrl}${segmentUri}`;
    try {
      const response = await fetch(url, {
        method: 'GET'
      });
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const arrayBuffer = await response.arrayBuffer();
      
      // Log the size of received segment for debugging
      this.log(`Downloaded segment size: ${arrayBuffer.byteLength} bytes`);
      
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      throw new Error(`Failed to download segment: ${error}`);
    }
  }

  parseManifest(manifestText) {
    const lines = manifestText.split('\n');
    const segments = [];
    let targetDuration = 2;
    let currentSegment = {};

    lines.forEach(line => {
      line = line.trim();
      
      if (line.startsWith('#EXTINF:')) {
        currentSegment.duration = parseFloat(line.split(':')[1]);
      } else if (line.startsWith('#EXT-X-TARGETDURATION:')) {
        targetDuration = parseInt(line.split(':')[1]);
      } else if (!line.startsWith('#') && line) {
        currentSegment.uri = line;
        if (currentSegment.duration && currentSegment.uri) {
          segments.push({ ...currentSegment });
          currentSegment = {};
        }
      }
    });

    return { segments, targetDuration };
  }

  async processNextSegment() {
    if (!this.sourceBuffer || this.sourceBuffer.updating || this.currentSegments.length === 0) {
      return;
    }

    // Check if we need to remove old segments
    // if (this.videoElement.buffered.length > 0) {
    //   const bufferEnd = this.videoElement.buffered.end(this.videoElement.buffered.length - 1);
    //   this.log(`Buffer end: ${bufferEnd.toFixed(1)}s`);
    //   if (bufferEnd - this.videoElement.currentTime > 30 && this.videoElement.currentTime - this.videoElement.buffered.start(0) > 10) {
    //     try {
    //       const removeStart = this.videoElement.buffered.start(0);
    //       const removeEnd = this.videoElement.buffered.start(0) + 10;
    //       this.sourceBuffer.remove(removeStart, removeEnd);
    //       this.log(`Removed buffer: ${removeStart.toFixed(1)}s - ${removeEnd.toFixed(1)}s`);
    //       return;
    //     } catch (error) {
    //       console.warn('Error removing buffer:', error);
    //     }
    //   }
    // }



    try {
      const segmentUri = this.currentSegments[0];
      this.log(`Processing segment: ${segmentUri}`);

      if (!this.downloadedSegments.has(segmentUri)) {
        const segmentData = await this.downloadSegment(segmentUri);
        
        // Transmux the MPEG-TS data to MP4
        this.transmuxer.push(segmentData);
        this.transmuxer.flush();

        this.currentSegments.shift();
        this.downloadedSegments.add(segmentUri);
        
        if (!this.videoElement.playing) {
            // this.videoElement.muted = true;
            await this.videoElement.play();
        }
      } else {
        this.currentSegments.shift();
      }
    } catch (error) {
      this.log(`Failed to process segment: ${error}`);
    }
  }

  async startStreaming() {
    this.isRunning = true;
    
    const updateManifest = async () => {
      if (!this.isRunning) return;

      try {
        const manifestText = await this.downloadManifest();
        const { segments, targetDuration } = this.parseManifest(manifestText);

        // Process new segments
        segments.forEach(segment => {
          if (!this.downloadedSegments.has(segment.uri) && 
              !this.currentSegments.includes(segment.uri)) {
            this.currentSegments.push(segment.uri);
          }
        });

        await this.processNextSegment();

        // Schedule next update
        this.updateInterval = window.setTimeout(updateManifest, (targetDuration / 2) * 1000);
      } catch (error) {
        this.onError(`Streaming error: ${error}`);
        this.stop();
      }
    };

    await updateManifest();
  }

  stop() {
    this.isRunning = false;
    if (this.updateInterval) {
      clearTimeout(this.updateInterval);
    }
    if (this.transmuxer) {
      this.transmuxer.dispose();
    }
    
    if (this.mediaSource.readyState === 'open') {
      if (this.sourceBuffer) {
        try {
          this.sourceBuffer.abort();
          this.mediaSource.removeSourceBuffer(this.sourceBuffer);
        } catch (error) {
          console.error('Error cleaning up source buffer:', error);
        }
      }
      try {
        this.mediaSource.endOfStream();
      } catch (error) {
        console.error('Error ending media stream:', error);
      }
    }

    URL.revokeObjectURL(this.videoElement.src);
  }
}

const HLSVideoPlayer = ({ manifestUrl }) => {
  const videoRef = useRef(null);
  const hlsManagerRef = useRef(null);
  const [stats, setStats] = useState({
    buffered: 0,
    downloaded: 0,
  });

  useEffect(() => {
    if (!videoRef.current) return;

    hlsManagerRef.current = new LiveHLSManager(
      videoRef.current,
      manifestUrl,
      (stats) => setStats(stats)
    );

    return () => {
      if (hlsManagerRef.current) {
        hlsManagerRef.current.stop();
      }
    };
  }, [manifestUrl]);

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <div className="relative">
        <video
          ref={videoRef}
          className="w-full aspect-video bg-black"
          controls
          autoPlay
          playsInline
          muted
        />
      </div>
      
      {/* Stats Display */}
      <div className="mt-2 text-sm">
        <div>Buffered: {stats.buffered.toFixed(1)}s</div>
        <div>Segments Downloaded: {stats.downloaded}</div>
      </div>
      
    </div>
  );
};

export default HLSVideoPlayer;