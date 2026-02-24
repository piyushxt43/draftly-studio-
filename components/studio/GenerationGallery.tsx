'use client';

import { useMemo, useState } from 'react';
import { useStudioStore } from '@/lib/studio-store';

interface GalleryItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  nodeLabel: string;
  model: string;
  prompt?: string;
}

export default function GenerationGallery({ onClose }: { onClose: () => void }) {
  const nodes = useStudioStore((s) => s.nodes);
  const [filter, setFilter] = useState<'all' | 'images' | 'videos'>('all');
  const [expandedImage, setExpandedImage] = useState<string | null>(null);

  // Collect all generated outputs from nodes
  const galleryItems = useMemo(() => {
    const items: GalleryItem[] = [];

    for (const node of nodes) {
      const d = node.data as Record<string, unknown>;

      if (node.type === 'imageGen') {
        const imgs = d.outputImages as string[] | undefined;
        if (imgs?.length) {
          for (let i = 0; i < imgs.length; i++) {
            items.push({
              id: `${node.id}-img-${i}`,
              type: 'image',
              url: imgs[i],
              nodeLabel: (d.label as string) || 'Image Gen',
              model: (d.model as string) || '',
              prompt: d.prompt as string | undefined,
            });
          }
        }
      }

      if (node.type === 'imageVariation') {
        const imgs = d.outputImages as string[] | undefined;
        if (imgs?.length) {
          for (let i = 0; i < imgs.length; i++) {
            items.push({
              id: `${node.id}-var-${i}`,
              type: 'image',
              url: imgs[i],
              nodeLabel: (d.label as string) || 'Variation',
              model: (d.model as string) || '',
            });
          }
        }
      }

      if (node.type === 'upscale') {
        const img = d.outputImage as string | undefined;
        if (img) {
          items.push({
            id: `${node.id}-upscale`,
            type: 'image',
            url: img,
            nodeLabel: 'Upscaled',
            model: '',
          });
        }
      }

      if (node.type === 'removeBG') {
        const img = d.outputImage as string | undefined;
        if (img) {
          items.push({
            id: `${node.id}-rmbg`,
            type: 'image',
            url: img,
            nodeLabel: 'BG Removed',
            model: '',
          });
        }
      }

      if (node.type === 'videoGen') {
        const url = d.outputUrl as string | undefined;
        if (url) {
          items.push({
            id: `${node.id}-video`,
            type: 'video',
            url,
            nodeLabel: (d.label as string) || 'Video Gen',
            model: (d.model as string) || '',
          });
        }
      }
    }

    return items;
  }, [nodes]);

  const filteredItems = useMemo(() => {
    if (filter === 'images') return galleryItems.filter((i) => i.type === 'image');
    if (filter === 'videos') return galleryItems.filter((i) => i.type === 'video');
    return galleryItems;
  }, [galleryItems, filter]);

  const imageCount = galleryItems.filter((i) => i.type === 'image').length;
  const videoCount = galleryItems.filter((i) => i.type === 'video').length;

  const handleDownload = (url: string, filename: string) => {
    if (url.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
    } else {
      window.open(url, '_blank');
    }
  };

  const handleDownloadAll = () => {
    filteredItems.forEach((item, i) => {
      setTimeout(() => {
        const ext = item.type === 'video' ? 'mp4' : 'png';
        handleDownload(item.url, `draftly-${item.type}-${i + 1}.${ext}`);
      }, i * 300);
    });
  };

  return (
    <>
      <div className="w-80 bg-[#0a0a0a] border-l border-white/5 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h2 className="text-sm font-bold text-white/90">Gallery</h2>
              <p className="text-[10px] text-white/30 mt-0.5">
                {imageCount} images, {videoCount} videos
              </p>
            </div>
            <div className="flex items-center gap-1">
              {filteredItems.length > 0 && (
                <button
                  onClick={handleDownloadAll}
                  className="px-2.5 py-1.5 rounded-lg bg-violet-500/20 text-violet-300 hover:bg-violet-500/30 transition-all text-[10px] font-semibold flex items-center gap-1.5"
                  title="Download all"
                >
                  <i className="fa-solid fa-download text-[9px]"></i>
                  Save All
                </button>
              )}
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-all"
              >
                <i className="fa-solid fa-times text-xs"></i>
              </button>
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
            {(['all', 'images', 'videos'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`flex-1 py-1 rounded-md text-[10px] font-semibold transition-all capitalize ${
                  filter === f
                    ? 'bg-white/10 text-white/90'
                    : 'text-white/40 hover:text-white/60'
                }`}
              >
                {f === 'all' ? `All (${galleryItems.length})` : f === 'images' ? `Images (${imageCount})` : `Videos (${videoCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Gallery content */}
        <div className="flex-1 overflow-y-auto p-3">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16">
              <i className="fa-solid fa-images text-white/10 text-3xl mb-3 block"></i>
              <p className="text-xs text-white/30 font-medium">No outputs yet</p>
              <p className="text-[10px] text-white/20 mt-1 max-w-[200px] mx-auto">
                Generated images and videos will appear here as you create them
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-white/5 bg-white/[0.02] overflow-hidden hover:border-white/10 transition-all"
                >
                  {/* Media */}
                  {item.type === 'image' ? (
                    <div
                      className="cursor-pointer"
                      onClick={() => setExpandedImage(item.url)}
                    >
                      <img
                        src={item.url}
                        alt={item.nodeLabel}
                        className="w-full object-cover"
                      />
                    </div>
                  ) : (
                    <video
                      src={item.url}
                      controls
                      loop
                      muted
                      className="w-full"
                    />
                  )}

                  {/* Info & Actions */}
                  <div className="p-2.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold text-white/70 truncate">{item.nodeLabel}</div>
                        {item.model && (
                          <div className="text-[9px] text-white/30 truncate">{item.model}</div>
                        )}
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                        item.type === 'image' ? 'bg-blue-500/10 text-blue-400' : 'bg-rose-500/10 text-rose-400'
                      }`}>
                        {item.type}
                      </span>
                    </div>

                    {/* Download button — prominent */}
                    <button
                      onClick={() => {
                        const ext = item.type === 'video' ? 'mp4' : 'png';
                        handleDownload(item.url, `draftly-${item.id}.${ext}`);
                      }}
                      className={`w-full py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2 border ${
                        item.type === 'image'
                          ? 'bg-blue-600/15 text-blue-300 hover:bg-blue-600/30 border-blue-500/20'
                          : 'bg-rose-600/15 text-rose-300 hover:bg-rose-600/30 border-rose-500/20'
                      }`}
                    >
                      <i className="fa-solid fa-download text-[10px]"></i>
                      Download {item.type === 'image' ? 'Image' : 'Video'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Expanded image overlay */}
      {expandedImage && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-8"
          onClick={() => setExpandedImage(null)}
        >
          <img
            src={expandedImage}
            alt="Expanded"
            className="max-w-full max-h-full object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setExpandedImage(null)}
            className="absolute top-6 right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/70 hover:text-white transition-all"
          >
            <i className="fa-solid fa-times text-lg"></i>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDownload(expandedImage, `draftly-fullsize-${Date.now()}.png`);
            }}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm flex items-center gap-2 transition-all backdrop-blur-lg border border-white/10"
          >
            <i className="fa-solid fa-download"></i>
            Download Full Size
          </button>
        </div>
      )}
    </>
  );
}
