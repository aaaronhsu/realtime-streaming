FROM --platform=linux/amd64 python:3.9-slim

WORKDIR /app
COPY requirements.txt /app/
RUN pip install -r requirements.txt
COPY . /app/
EXPOSE 8080
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "edge_server:app"]
