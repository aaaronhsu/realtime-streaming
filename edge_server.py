from flask import Flask, jsonify, send_file

from dao import fetch_file

app = Flask(__name__)

@app.route("/")
def hello_world():
    return "<p>Hello, World!</p>"

@app.route("/hls/<route>", methods=['GET'])
def fetch_m3a8(route):
    file = fetch_file(route)
    return file

app.run(port=8080)
