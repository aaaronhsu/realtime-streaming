import React, { useState, useEffect, useRef } from 'react';

const HLSVideoPlayer = ({ manifestUrl }) => {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!manifestUrl) {
      setError('Manifest URL is required');
      return;
    }

    const loadManifest = async () => {
      try {
        setIsLoading(true);
        // Check if the browser supports MSE (Media Source Extensions)
        if (!window.MediaSource || !MediaSource.isTypeSupported('video/mp4; codecs="avc1.42E01E,mp4a.40.2"')) {
          throw new Error('Browser does not support required video features');
        }

        const response = await fetch(manifestUrl);
        if (!response.ok) {
          throw new Error('Failed to load manifest file');
        }

        const manifest = await response.text();
        const mediaSource = new MediaSource();
        videoRef.current.src = URL.createObjectURL(mediaSource);

        mediaSource.addEventListener('sourceopen', () => {
          const sourceBuffer = mediaSource.addSourceBuffer('video/mp4; codecs="avc1.42E01E,mp4a.40.2"');
          processManifest(manifest, sourceBuffer);
        });

      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadManifest();
  }, [manifestUrl]);

  const processManifest = async (manifest, sourceBuffer) => {
    // Parse manifest file to get segment URLs
    const segments = manifest
      .split('\n')
      .filter(line => line.endsWith('.ts'))
      .map(segment => {
        // Handle both absolute and relative URLs
        return segment.startsWith('http') 
          ? segment 
          : new URL(segment, manifestUrl).href;
      });

    // Load segments sequentially
    for (const segmentUrl of segments) {
      try {
        const response = await fetch(segmentUrl);
        if (!response.ok) {
          throw new Error(`Failed to load segment: ${segmentUrl}`);
        }
        
        const data = await response.arrayBuffer();
        
        // Wait if the buffer is updating
        if (sourceBuffer.updating) {
          await new Promise(resolve => {
            sourceBuffer.addEventListener('updateend', resolve, { once: true });
          });
        }
        
        sourceBuffer.appendBuffer(data);
        
        // Wait for the buffer to finish updating before continuing
        await new Promise(resolve => {
          sourceBuffer.addEventListener('updateend', resolve, { once: true });
        });
      } catch (err) {
        console.error(`Error loading segment ${segmentUrl}:`, err);
        setError(`Failed to load video segment: ${err.message}`);
      }
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {error && (
        <div className="p-4 bg-red-100 text-red-800 rounded-md">
          {error}
        </div>
      )}
      
      <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          </div>
        )}
        
        <video 
          ref={videoRef}
          className="w-full h-full"
          controls
          autoPlay
          playsInline
        />
      </div>
    </div>
  );
};

export default HLSVideoPlayer;