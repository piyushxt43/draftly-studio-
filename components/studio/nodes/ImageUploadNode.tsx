'use client';

import { memo, useCallback, useRef } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { useStudioStore } from '@/lib/studio-store';

function ImageUploadNode({ id, data }: NodeProps) {
  const updateNodeData = useStudioStore((s) => s.updateNodeData);
  const d = data as { imageUrl: string | null; fileName: string | null; label: string };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        alert('Please upload an image file');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        updateNodeData(id, { imageUrl: reader.result as string, fileName: file.name });
      };
      reader.readAsDataURL(file);
    },
    [id, updateNodeData],
  );

  const handleRemove = useCallback(() => {
    updateNodeData(id, { imageUrl: null, fileName: null });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [id, updateNodeData]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files?.[0];
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        updateNodeData(id, { imageUrl: reader.result as string, fileName: file.name });
      };
      reader.readAsDataURL(file);
    },
    [id, updateNodeData],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div className="bg-[#141414] border border-white/10 rounded-xl w-[380px] shadow-2xl overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-gradient-to-r from-emerald-600/20 to-teal-600/20 border-b border-white/5">
        <div className="w-6 h-6 rounded-md bg-emerald-500/20 flex items-center justify-center">
          <i className="fa-solid fa-image text-emerald-400 text-xs"></i>
        </div>
        <span className="text-xs font-semibold text-white/90 tracking-wide">IMAGE UPLOAD</span>
      </div>

      <div className="p-3">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {d.imageUrl ? (
          <div className="relative group">
            <img src={d.imageUrl} alt={d.fileName || 'Uploaded image'} className="w-full h-40 object-cover rounded-lg" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
              <button onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-xs text-white transition-all">
                Replace
              </button>
              <button onClick={handleRemove} className="px-3 py-1.5 bg-red-500/30 hover:bg-red-500/50 rounded-lg text-xs text-white transition-all">
                Remove
              </button>
            </div>
            <div className="mt-2 text-[10px] text-white/40 truncate">{d.fileName}</div>
          </div>
        ) : (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="w-full h-32 border-2 border-dashed border-white/10 hover:border-emerald-500/40 rounded-lg flex flex-col items-center justify-center gap-2 cursor-pointer transition-all hover:bg-emerald-500/5"
          >
            <i className="fa-solid fa-cloud-arrow-up text-white/30 text-xl"></i>
            <span className="text-xs text-white/40">Drop image or click to upload</span>
            <span className="text-[10px] text-white/20">PNG, JPG, WebP, GIF</span>
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export default memo(ImageUploadNode);
