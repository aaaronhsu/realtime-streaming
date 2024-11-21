from flask import Flask, jsonify, send_file
from flask_cors import CORS  # Add this import

from dao import fetch_file

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes


@app.route("/")
def hello_world():
    return "<p>Hello, World!</p>"


@app.route("/hls/<route>", methods=["GET"])
def fetch_m3a8(route):
    file = fetch_file(route)
    return file


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
