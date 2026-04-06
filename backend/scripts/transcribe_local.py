import sys
import json
import os
from faster_whisper import WhisperModel

def transcribe(audio_path, model_size="small", device="cpu", compute_type="int8"):
    # model sizes: tiny, base, small, medium, large-v3
    # device: cpu, cuda
    # compute_type: int8, float16 (for cuda)
    
    try:
        model = WhisperModel(model_size, device=device, compute_type=compute_type)
        
        segments, info = model.transcribe(audio_path, beam_size=5)
        
        results = []
        for segment in segments:
            results.append({
                "start": segment.start,
                "end": segment.end,
                "text": segment.text.strip()
            })
            
        return results
    except Exception as e:
        return {"error": str(e)}

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "No audio path provided"}))
        sys.exit(1)
        
    audio_file = sys.argv[1]
    model = sys.argv[2] if len(sys.argv) > 2 else "small"
    
    if not os.path.exists(audio_file):
        print(json.dumps({"error": f"File not found: {audio_file}"}))
        sys.exit(1)
        
    output = transcribe(audio_file, model_size=model)
    print(json.dumps(output, ensure_ascii=False))
