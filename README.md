# Draftly Studio — Open Source

**AI image & video generation studio with the same node-based workflow as Draftly Studio (text/image/video/upscale/remove-bg/preview).**

![Draftly Studio](https://img.shields.io/badge/License-MIT-blue) ![Python](https://img.shields.io/badge/Python-3.10+-green) ![Next.js](https://img.shields.io/badge/Next.js-14-black)

## What is this?

Draftly Studio is a node-based creative workflow tool where you connect AI models together visually. Upload a product photo, write prompts, and generate professional images and videos — all running on your own hardware with zero API costs.

**Cloud version**: [draftly.in](https://www.draftly.space/) — 12+ premium AI models, no GPU required.

## Features

- 1:1 Draftly Studio node system (Text Prompt, Image Upload, Image Gen, Image Variation, Video Gen, Upscale, Remove BG, Preview)
- Visual node canvas (drag, drop, connect)
- Batch generation for image/video nodes
- API routes for image/video generation, polling, download, image edit, remove-bg, upscaling
- Works with API-Easy (`nano-banana-pro`, `veo-3.1-fast`) + fal.ai + Replicate + optional local server

## Supported Open-Source Models

### Image Models

| Model | VRAM | Size | Speed | Repo |
|-------|------|------|-------|------|
| **Stable Diffusion 1.5** | 4 GB | ~5 GB | ~15s/img | `stable-diffusion-v1-5/stable-diffusion-v1-5` |
| **Stable Diffusion XL** | 8 GB | ~7 GB | ~5s/img | `stabilityai/stable-diffusion-xl-base-1.0` |
| **Flux.1 Dev** | 12 GB | ~12 GB | ~8s/img | `black-forest-labs/FLUX.1-dev` |
| **Fooocus** | 6 GB | ~10 GB | ~6s/img | `lllyasviel/Fooocus` |
| **Stable Cascade** | 10 GB | ~8 GB | ~10s/img | `stabilityai/stable-cascade` |

### Video Models

| Model | VRAM | Size | Speed | Repo |
|-------|------|------|-------|------|
| **AnimateDiff** (built-in) | 4 GB | ~5 GB | ~3min/clip | `guoyww/animatediff-motion-adapter-v1-5-3` |
| **CogVideoX** | 16 GB | ~10 GB | ~2min/clip | `THUDM/CogVideoX-5b` |
| **Hunyuan Video** | 16 GB | ~15 GB | ~3min/clip | `tencent/HunyuanVideo` |
| **Open-Sora** | 12 GB | ~8 GB | ~2min/clip | `hpcaitech/Open-Sora` |
| **Wan 2.1** | 12 GB | ~14 GB | ~2min/clip | `Wan-Video/Wan2.1` |

## System Requirements

| Spec | Minimum | Recommended |
|------|---------|-------------|
| GPU | GTX 1050 Ti (4 GB) | RTX 3060+ (12 GB) |
| RAM | 16 GB | 32 GB |
| Storage | 50 GB free | 100 GB+ |
| OS | Windows / Linux / macOS | Any |
| Python | 3.10+ | 3.11 |
| Node.js | 18+ | 20+ |

## Quick Start

### 1. Clone the repo

```bash
git clone https://github.com/piyushxt43/draftly-studio-.git
cd draftly-studio-
```

### 2. Install Python dependencies + PyTorch with CUDA

```bash
cd local-server
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu121
pip install -r requirements.txt
```

### 3. Start the local AI server

```bash
python server.py
```

The server starts at `http://localhost:8000`. Models download automatically on first use (~5 GB each).

### 4. Configure environment variables

```bash
cp .env.example .env.local
```

Set at least these:

- `API_EASY_API_KEY`
- `API_EASY_BASE_URL=https://api.apiyi.com/v1`
- `API_EASY_IMAGE_MODEL=nano-banana-pro`
- `API_EASY_VIDEO_MODEL=veo-3.1-fast`

### 5. Install Node.js dependencies and start the Studio

```bash
cd ..
npm install
npm run dev
```

### 6. Open the Studio

Go to **http://localhost:3000** in your browser. The studio auto-detects the local server and shows local models.

## How It Works

```
[Image Upload] ──→ [Image Gen Node] ──→ [Video Gen Node]
                        ↑                      ↑
               [Text Prompt]           [Text Prompt]
```

1. **Upload** a product photo or reference image
2. **Write prompts** describing angles, styles, or scenes
3. **Connect** nodes by clicking handles
4. **Generate** — images and videos render on your GPU
5. **Download** results directly

## Project Structure

```
draftly-studio-/
├── app/                    # Next.js app (studio UI)
│   ├── page.tsx           # Studio page
│   └── api/studio/        # API routes (proxy to local server)
├── components/studio/      # React Flow nodes & canvas
├── lib/                    # Store, utilities
├── local-server/           # Python AI server
│   ├── server.py          # FastAPI server (SD 1.5 + AnimateDiff)
│   ├── requirements.txt   # Python dependencies
│   └── start.ps1          # Windows quick-start script
└── README.md
```

## Adding More Models

The local server uses Hugging Face `diffusers`. To add a new model, edit `local-server/server.py` and change the model ID:

```python
# Change from SD 1.5:
pipe = StableDiffusionPipeline.from_pretrained("stable-diffusion-v1-5/stable-diffusion-v1-5")

# To SDXL:
pipe = StableDiffusionXLPipeline.from_pretrained("stabilityai/stable-diffusion-xl-base-1.0")
```

Models auto-download from Hugging Face on first use.

## License

MIT — use it however you want.

## Cloud Version

Don't want to set up GPUs? Use the hosted version at **[draftly.in](https://draftly.in)** with 12+ premium AI models (Gemini, Veo 3.0, Flux Pro, and more) starting at $25/month.
