"""
KrishiSathi Face Recognition Microservice
Uses DeepFace + OpenCV for face encoding and matching.
Runs on port 5001 alongside the Node.js server on port 5000.
"""

import base64
import io
import sys
import os
import json

# Fix Windows console encoding (cp1252 can't handle emoji from DeepFace logs)
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')
os.environ['PYTHONIOENCODING'] = 'utf-8'

import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
from PIL import Image

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max
CORS(app)

# Lazy-load DeepFace (heavy import)
_deepface = None

def get_deepface():
    global _deepface
    if _deepface is None:
        # Suppress TF warnings
        os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
        os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
        import tensorflow as tf
        tf.get_logger().setLevel('ERROR')
        from deepface import DeepFace
        _deepface = DeepFace
        print("[FaceService] DeepFace loaded successfully", flush=True)
    return _deepface


def decode_image(data_url_or_base64):
    """Decode a base64 image (with or without data URL prefix) to a numpy array."""
    if data_url_or_base64.startswith('data:'):
        # Strip data URL prefix
        _, b64data = data_url_or_base64.split(',', 1)
    else:
        b64data = data_url_or_base64

    img_bytes = base64.b64decode(b64data)
    img = Image.open(io.BytesIO(img_bytes)).convert('RGB')
    return np.array(img)


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "face-recognition"})


@app.route('/encode', methods=['POST'])
def encode_face():
    """
    Extract face embedding from an image.
    Input: { "image": "<base64 data URL>" }
    Output: { "success": true, "encoding": [512 floats] }
    """
    try:
        data = request.get_json(force=True, silent=True)
        if not data or 'image' not in data:
            return jsonify({"success": False, "message": "No image provided"}), 400

        image_str = data['image']
        print(f"[FaceService] Encode request: image length={len(image_str)}", flush=True)

        img_array = decode_image(image_str)
        print(f"[FaceService] Decoded image shape: {img_array.shape}", flush=True)

        DeepFace = get_deepface()

        embeddings = DeepFace.represent(
            img_path=img_array,
            model_name="Facenet512",
            detector_backend="opencv",
            enforce_detection=False,
        )

        if not embeddings or len(embeddings) == 0:
            return jsonify({"success": False, "message": "No face detected in image"}), 400

        # Return the first face's embedding
        encoding = embeddings[0]["embedding"]
        print(f"[FaceService] Encode success: {len(encoding)} dims", flush=True)

        return jsonify({
            "success": True,
            "encoding": encoding,
            "dimensions": len(encoding),
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[FaceService] Encode error: {e}", flush=True)
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/match', methods=['POST'])
def match_face():
    """
    Match a captured face against stored face encodings.
    Input: {
        "captured": "<base64 data URL>",
        "stored": [ { "userId": "...", "name": "...", "encoding": [128 floats] }, ... ]
    }
    Output: { "success": true, "match": { "userId": "...", "name": "...", "distance": 0.x } }
    """
    try:
        data = request.get_json(force=True, silent=True)
        if not data or 'captured' not in data or 'stored' not in data:
            return jsonify({"success": False, "message": "Missing captured image or stored encodings"}), 400

        stored = data['stored']
        if len(stored) == 0:
            return jsonify({"success": False, "message": "No stored faces to compare"}), 404

        # Get encoding of captured face
        img_array = decode_image(data['captured'])
        DeepFace = get_deepface()

        embeddings = DeepFace.represent(
            img_path=img_array,
            model_name="Facenet512",
            detector_backend="opencv",
            enforce_detection=False,
        )

        if not embeddings or len(embeddings) == 0:
            return jsonify({"success": False, "message": "No face detected in captured image"}), 400

        captured_enc = np.array(embeddings[0]["embedding"])

        # Compare with all stored encodings using cosine similarity
        best_match = None
        best_distance = float('inf')

        # Facenet512 threshold for cosine distance is ~0.30
        THRESHOLD = 0.40  # Slightly lenient for hackathon demo

        for entry in stored:
            stored_enc = np.array(entry['encoding'])

            # Cosine distance
            dot = np.dot(captured_enc, stored_enc)
            norm = np.linalg.norm(captured_enc) * np.linalg.norm(stored_enc)
            cosine_sim = dot / norm if norm > 0 else 0
            distance = 1 - cosine_sim

            if distance < best_distance:
                best_distance = distance
                best_match = entry

        if best_match and best_distance < THRESHOLD:
            return jsonify({
                "success": True,
                "match": {
                    "userId": best_match['userId'],
                    "name": best_match.get('name', ''),
                    "distance": round(best_distance, 4),
                    "confidence": round((1 - best_distance) * 100, 1),
                },
            })

        return jsonify({
            "success": False,
            "message": "Face not recognized",
            "bestDistance": round(best_distance, 4) if best_distance < float('inf') else None,
        }), 401

    except Exception as e:
        print(f"[FaceService] Match error: {e}", flush=True)
        return jsonify({"success": False, "message": str(e)}), 500


@app.route('/verify', methods=['POST'])
def verify_faces():
    """
    Verify if two face images are the same person.
    Input: { "image1": "<base64>", "image2": "<base64>" }
    Output: { "success": true, "verified": true/false, "distance": 0.x }
    """
    try:
        data = request.json
        img1 = decode_image(data['image1'])
        img2 = decode_image(data['image2'])

        DeepFace = get_deepface()

        result = DeepFace.verify(
            img1_path=img1,
            img2_path=img2,
            model_name="Facenet512",
            detector_backend="opencv",
            enforce_detection=False,
        )

        return jsonify({
            "success": True,
            "verified": result["verified"],
            "distance": round(result["distance"], 4),
            "threshold": result["threshold"],
        })
    except Exception as e:
        print(f"[FaceService] Verify error: {e}", flush=True)
        return jsonify({"success": False, "message": str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('FACE_SERVICE_PORT', 5001))
    print(f"[FaceService] Starting on port {port}...", flush=True)

    # Pre-load model on startup
    print("[FaceService] Pre-loading face recognition model...", flush=True)
    try:
        get_deepface()
        print("[FaceService] Model loaded. Ready!", flush=True)
    except Exception as e:
        print(f"[FaceService] Warning: Could not pre-load model: {e}", flush=True)

    app.run(host='0.0.0.0', port=port, debug=False)
