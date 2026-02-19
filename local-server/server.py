"""
Draftly Studio — Local AI Inference Server
===========================================
Runs on http://localhost:8000
Optimized for GTX 1050 Ti (4GB VRAM) with CPU offloading.

Image gen:  Stable Diffusion 1.5 (fits in ~3.5GB with offloading)
Video gen:  AnimateDiff (SD 1.5 + motion module, ~16 frame clips)

Start:
    cd local-server
    python server.py
"""

import os
import uuid
import time
import logging
import gc
from pathlib import Path
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("draftly-local")

# ── Output directory ──────────────────────────────────────────────────

OUTPUT_DIR = Path(__file__).parent / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

# ── Globals for lazy-loaded models ────────────────────────────────────

image_pipe = None
video_pipe = None

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
DTYPE = torch.float16 if DEVICE == "cuda" else torch.float32

# Track which pipe is currently in VRAM (to swap between them on 4GB GPU)
active_pipe = None  # "image" or "video" or None


def free_vram():
    """Free GPU memory by deleting any loaded pipe from VRAM."""
    global image_pipe, video_pipe, active_pipe
    if active_pipe == "image" and image_pipe is not None:
        image_pipe.to("cpu")
    elif active_pipe == "video" and video_pipe is not None:
        video_pipe.to("cpu")
    active_pipe = None
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()
        torch.cuda.synchronize()


# ── Helper: load image pipeline ──────────────────────────────────────

def get_image_pipe():
    global image_pipe, active_pipe

    if image_pipe is not None and active_pipe == "image":
        return image_pipe

    # Free VRAM if video pipe is loaded
    if active_pipe == "video":
        logger.info("Swapping video pipe out of VRAM for image pipe...")
        free_vram()

    if image_pipe is None:
        logger.info("Loading Stable Diffusion 1.5 (first run downloads ~5GB)...")

        from diffusers import StableDiffusionPipeline

        image_pipe = StableDiffusionPipeline.from_pretrained(
            "stable-diffusion-v1-5/stable-diffusion-v1-5",
            torch_dtype=DTYPE,
            safety_checker=None,
            requires_safety_checker=False,
        )

        # Critical optimizations for 4GB VRAM:
        image_pipe.enable_attention_slicing()         # Process attention in chunks
        image_pipe.enable_vae_slicing()               # Process VAE in chunks

        logger.info("SD 1.5 pipeline loaded")

    # Move to GPU with CPU offloading (keeps parts on CPU, moves to GPU as needed)
    image_pipe.enable_model_cpu_offload()
    active_pipe = "image"
    return image_pipe


# ── Helper: load video pipeline (AnimateDiff) ────────────────────────

def get_video_pipe():
    global video_pipe, active_pipe

    if video_pipe is not None and active_pipe == "video":
        return video_pipe

    # Free VRAM if image pipe is loaded
    if active_pipe == "image":
        logger.info("Swapping image pipe out of VRAM for video pipe...")
        free_vram()

    if video_pipe is None:
        logger.info("Loading AnimateDiff pipeline (first run downloads ~5GB)...")

        from diffusers import AnimateDiffPipeline, MotionAdapter, DDIMScheduler

        # Load the motion adapter
        adapter = MotionAdapter.from_pretrained(
            "guoyww/animatediff-motion-adapter-v1-5-3",
            torch_dtype=DTYPE,
        )

        # Build AnimateDiff pipeline on top of SD 1.5
        video_pipe = AnimateDiffPipeline.from_pretrained(
            "stable-diffusion-v1-5/stable-diffusion-v1-5",
            motion_adapter=adapter,
            torch_dtype=DTYPE,
            safety_checker=None,
            requires_safety_checker=False,
        )

        video_pipe.scheduler = DDIMScheduler.from_pretrained(
            "stable-diffusion-v1-5/stable-diffusion-v1-5",
            subfolder="scheduler",
            clip_sample=False,
            timestep_spacing="linspace",
            beta_schedule="linear",
            steps_offset=1,
        )

        # Critical optimizations for 4GB VRAM
        video_pipe.enable_attention_slicing()
        video_pipe.enable_vae_slicing()

        logger.info("AnimateDiff pipeline loaded")

    video_pipe.enable_model_cpu_offload()
    active_pipe = "video"
    return video_pipe


# ── FastAPI app ───────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    gpu_name = "None"
    vram = "N/A"
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        vram = f"{torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB"

    logger.info("=" * 50)
    logger.info("  Draftly Local AI Server")
    logger.info("=" * 50)
    logger.info(f"  Device: {DEVICE}")
    logger.info(f"  GPU: {gpu_name}")
    logger.info(f"  VRAM: {vram}")
    logger.info(f"  Output dir: {OUTPUT_DIR}")
    logger.info("")
    logger.info("  Image gen: SD 1.5 (loads on first request, ~5GB download)")
    logger.info("  Video gen: AnimateDiff (loads on first request, ~5GB download)")
    logger.info("  Note: Only one model in VRAM at a time (auto-swaps)")
    logger.info("")
    logger.info("  Server ready at http://localhost:8000")
    logger.info("=" * 50)
    yield
    logger.info("Shutting down...")


app = FastAPI(title="Draftly Local AI", lifespan=lifespan)

# Allow requests from Next.js dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve generated files
app.mount("/outputs", StaticFiles(directory=str(OUTPUT_DIR)), name="outputs")


# ── Health check ──────────────────────────────────────────────────────

@app.get("/health")
async def health():
    gpu_name = None
    vram = None
    if torch.cuda.is_available():
        gpu_name = torch.cuda.get_device_name(0)
        vram = f"{torch.cuda.get_device_properties(0).total_memory / 1024**3:.1f} GB"

    return {
        "status": "ok",
        "device": DEVICE,
        "cuda_available": torch.cuda.is_available(),
        "gpu": gpu_name,
        "vram": vram,
        "image_model_loaded": image_pipe is not None,
        "video_model_loaded": video_pipe is not None,
        "active_pipe": active_pipe,
        "ltx_configured": False,  # Not using LTX on this GPU
    }


# ── Image generation ──────────────────────────────────────────────────

class ImageRequest(BaseModel):
    prompt: str
    width: int = 512
    height: int = 512
    num_images: int = 1
    guidance_scale: float = 7.5
    num_inference_steps: int = 25
    seed: int = -1


@app.post("/api/generate-image")
async def generate_image(req: ImageRequest):
    try:
        pipe = get_image_pipe()

        # Clamp resolution for 4GB VRAM
        width = min(req.width, 768)
        height = min(req.height, 768)
        # Ensure divisible by 8
        width = (width // 8) * 8
        height = (height // 8) * 8

        seed = req.seed if req.seed >= 0 else int(time.time()) % (2**32)
        generator = torch.Generator(device="cpu").manual_seed(seed)

        logger.info(f"Generating image: '{req.prompt[:80]}...' ({width}x{height})")
        start = time.time()

        result = pipe(
            prompt=req.prompt,
            width=width,
            height=height,
            num_images_per_prompt=min(req.num_images, 2),  # Limit batch for VRAM
            guidance_scale=req.guidance_scale,
            num_inference_steps=req.num_inference_steps,
            generator=generator,
        )

        elapsed = time.time() - start
        logger.info(f"Image generated in {elapsed:.1f}s")

        urls = []
        for img in result.images:
            filename = f"img_{uuid.uuid4().hex[:12]}.png"
            filepath = OUTPUT_DIR / filename
            img.save(filepath)
            urls.append(f"http://localhost:8000/outputs/{filename}")

        return {"images": urls, "seed": seed, "elapsed": round(elapsed, 2)}

    except torch.cuda.OutOfMemoryError:
        free_vram()
        raise HTTPException(
            status_code=507,
            detail="GPU out of memory. Try a smaller resolution (512x512) or fewer images.",
        )
    except Exception as e:
        logger.error(f"Image generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Video generation (AnimateDiff) ────────────────────────────────────

class VideoRequest(BaseModel):
    prompt: str
    width: int = 512
    height: int = 512
    num_frames: int = 16
    frame_rate: float = 8.0
    seed: int = -1
    image_path: str | None = None


@app.post("/api/generate-video")
async def generate_video(req: VideoRequest):
    try:
        pipe = get_video_pipe()

        # Clamp for 4GB VRAM: small resolution, 16 frames max
        width = min(req.width, 512)
        height = min(req.height, 512)
        width = (width // 8) * 8
        height = (height // 8) * 8
        num_frames = min(req.num_frames, 16)

        seed = req.seed if req.seed >= 0 else int(time.time()) % (2**32)
        generator = torch.Generator(device="cpu").manual_seed(seed)

        logger.info(f"Generating video: '{req.prompt[:80]}...' ({width}x{height}, {num_frames} frames)")
        start = time.time()

        output = pipe(
            prompt=req.prompt,
            width=width,
            height=height,
            num_frames=num_frames,
            guidance_scale=7.5,
            num_inference_steps=20,
            generator=generator,
        )

        frames = output.frames[0]  # List of PIL images
        elapsed = time.time() - start
        logger.info(f"Video generated in {elapsed:.1f}s ({len(frames)} frames)")

        # Export as GIF (simpler than mp4, no ffmpeg needed)
        filename = f"vid_{uuid.uuid4().hex[:12]}.gif"
        filepath = OUTPUT_DIR / filename

        # Save as animated GIF
        frame_duration = int(1000 / req.frame_rate)  # ms per frame
        frames[0].save(
            filepath,
            save_all=True,
            append_images=frames[1:],
            duration=frame_duration,
            loop=0,
        )

        # Also try saving as mp4 if imageio is available
        mp4_url = None
        try:
            from diffusers.utils import export_to_video
            mp4_filename = f"vid_{uuid.uuid4().hex[:12]}.mp4"
            mp4_filepath = OUTPUT_DIR / mp4_filename
            export_to_video(frames, str(mp4_filepath), fps=int(req.frame_rate))
            mp4_url = f"http://localhost:8000/outputs/{mp4_filename}"
        except Exception:
            pass  # GIF is the fallback

        gif_url = f"http://localhost:8000/outputs/{filename}"

        return {
            "video_url": mp4_url or gif_url,
            "gif_url": gif_url,
            "seed": seed,
            "elapsed": round(elapsed, 2),
            "frames": len(frames),
        }

    except torch.cuda.OutOfMemoryError:
        free_vram()
        raise HTTPException(
            status_code=507,
            detail="GPU out of memory. Try 512x512 resolution with 16 frames.",
        )
    except Exception as e:
        logger.error(f"Video generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ── Image upload ──────────────────────────────────────────────────────

@app.post("/api/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """Upload an image for img-to-video or processing."""
    filename = f"upload_{uuid.uuid4().hex[:12]}_{file.filename}"
    filepath = OUTPUT_DIR / filename
    content = await file.read()
    with open(filepath, "wb") as f:
        f.write(content)
    return {"path": str(filepath), "url": f"http://localhost:8000/outputs/{filename}"}


# ── Run ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
