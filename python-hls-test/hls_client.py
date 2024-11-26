import requests
import m3u8
import os
import logging
import time
from typing import Set, List
import subprocess
import tempfile
from urllib.parse import urljoin
import shutil

MANIFEST_URL = "http://35.188.2.50:8080/hls/test.m3u8"


class LiveHLSClient:
    def __init__(self, manifest_url: str):
        """
        Initialize the HLS client for live streaming with playback.
        
        Args:
            manifest_url: URL to the .m3u8 manifest file
        """
        self.manifest_url = manifest_url
        self.base_url = '/'.join(manifest_url.split('/')[:-1]) + '/'
        self.session = requests.Session()
        self.downloaded_segments: Set[str] = set()
        self.current_segments: List[str] = []
        
        # Create a temporary directory for segments
        self.temp_dir = tempfile.mkdtemp()
        self.playlist_path = os.path.join(self.temp_dir, 'playlist.txt')
        
        # Set up logging
        logging.basicConfig(level=logging.INFO)
        self.logger = logging.getLogger(__name__)
        
        # Flag to control the streaming
        self.is_running = False
        self.ffplay_process = None

    def download_manifest(self) -> m3u8.M3U8:
        """Download and parse the manifest file."""
        try:
            response = self.session.get(self.manifest_url)
            response.raise_for_status()
            return m3u8.loads(response.text)
        except requests.RequestException as e:
            self.logger.error(f"Failed to download manifest: {e}")
            raise

    def download_segment(self, segment_uri: str) -> str:
        """
        Download a single segment and save it to disk.
        
        Args:
            segment_uri: URI of the segment to download
            
        Returns:
            str: Path to the saved segment file
        """
        if not segment_uri.startswith('http'):
            segment_url = urljoin(self.base_url, segment_uri)
        else:
            segment_url = segment_uri

        try:
            self.logger.info(f"Downloading segment: {segment_uri}")
            response = self.session.get(segment_url)
            response.raise_for_status()
            
            # Save segment to temp directory
            filename = os.path.join(self.temp_dir, os.path.basename(segment_uri))
            with open(filename, 'wb') as f:
                f.write(response.content)
            
            return filename
            
        except requests.RequestException as e:
            self.logger.error(f"Failed to download segment: {e}")
            return None

    def update_playlist(self):
        """Update the playlist file with current segments."""
        with open(self.playlist_path, 'w') as f:
            for segment in self.current_segments:
                f.write(f"file '{segment}'\n")

    def start_playback(self):
        """Start or restart the video playback."""
        if self.ffplay_process:
            self.ffplay_process.terminate()
            self.ffplay_process.wait()

        ffplay_cmd = [
            'ffplay',
            '-fflags', 'nobuffer',
            '-flags', 'low_delay',
            '-framedrop',
            '-sync', 'ext',
            '-f', 'concat',
            '-safe', '0',
            '-i', self.playlist_path
        ]

        try:
            self.ffplay_process = subprocess.Popen(
                ffplay_cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL
            )
        except FileNotFoundError:
            self.logger.error("ffplay not found. Please install FFmpeg.")
            self.is_running = False
        except Exception as e:
            self.logger.error(f"Failed to start playback: {e}")
            self.is_running = False

    # def cleanup_old_segments(self, keep_count: int = 5):
    #     """Remove old segments, keeping only the most recent ones."""
    #     while len(self.current_segments) > keep_count:
    #         old_segment = self.current_segments.pop(0)
    #         try:
    #             os.remove(old_segment)
    #             self.logger.debug(f"Removed old segment: {old_segment}")
    #         except OSError as e:
    #             self.logger.error(f"Failed to remove segment {old_segment}: {e}")

    def start_streaming(self):
        """Start the live stream processing and playback."""
        self.logger.info("Starting live stream...")
        self.is_running = True
        
        try:
            while self.is_running:
                # Get current manifest
                manifest = self.download_manifest()
                
                # Track if we need to update playlist
                playlist_updated = False
                
                # Process new segments
                for segment in manifest.segments:
                    if segment.uri not in self.downloaded_segments:
                        segment_path = self.download_segment(segment.uri)
                        if segment_path:
                            self.downloaded_segments.add(segment.uri)
                            self.current_segments.append(segment_path)
                            playlist_updated = True
                
                if playlist_updated:
                    # Clean up old segments
                    # self.cleanup_old_segments()
                    # Update playlist file
                    self.update_playlist()
                    
                    # Start/restart playback if needed
                    if not self.ffplay_process or self.ffplay_process.poll() is not None:
                        self.start_playback()
                
                # Wait before next manifest update
                target_duration = getattr(manifest, 'target_duration', 2)
                self.logger.info(f"Sleeping for {target_duration / 2} seconds")
                time.sleep(target_duration / 2)
                
        except KeyboardInterrupt:
            self.logger.info("Stream stopped by user")
        except Exception as e:
            self.logger.error(f"Stream failed: {e}")
        finally:
            # Cleanup
            if self.ffplay_process:
                self.ffplay_process.terminate()
            try:
                shutil.rmtree(self.temp_dir)
            except Exception as e:
                self.logger.error(f"Failed to clean up temporary directory: {e}")
            self.logger.info("Stream ended")

if __name__ == "__main__":
    client = LiveHLSClient(MANIFEST_URL)
    client.start_streaming()