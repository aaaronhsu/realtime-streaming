from flask import send_file, jsonify
import os
import requests
from datetime import datetime, timedelta
import logging

logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')
# stores stringnames of files that have been cached
cache_times = dict()


def request_file_from_server(filename, server="http://104.198.236.232:8080/hls"):
    logging.debug(f"Requesting {filename} from origin server")
    try:
        response = requests.get(f'{server}/{filename}')
        response.raise_for_status()

        with open(f'cache/{filename}', 'wb') as file:
            for chunk in response.iter_content(chunk_size=128):
                file.write(chunk)

        cache_times[filename] = datetime.now()
        return True
    except Exception as e:
        print(f"Error caching file: {e}")
        return False

def is_file_stale(filename):
    if filename not in cache_times:
        return True

    base_name, ext = filename.split('.')

    if ext == 'm3u8':
        cache_expiration_time = timedelta(seconds=1)
    elif ext == 'ts':
        cache_expiration_time = timedelta(seconds=600)
    else:
        return True

    earliest_valid_cache_time = datetime.now() - cache_expiration_time
    valid_cache = cache_times[filename] > earliest_valid_cache_time

    if not valid_cache:
        del cache_times[filename]

    return valid_cache

def fetch_file(filename):
    if is_file_stale(filename):
        if not request_file_from_server(filename):
            return jsonify({"error": "Unable to fetch file"}, 500)
    else:
        logging.debug(f"Fetching {filename} from cache")
    return send_file(f'cache/{filename}')
