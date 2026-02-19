'use client';

import { useEffect } from 'react';
import StudioCanvas from '@/components/studio/StudioCanvas';
import NodeSidebar from '@/components/studio/NodeSidebar';
import StudioToolbar from '@/components/studio/StudioToolbar';
import { useStudioStore } from '@/lib/studio-store';

export default function StudioPage() {
  const loadTemplate = useStudioStore((s) => s.loadTemplate);
  const nodes = useStudioStore((s) => s.nodes);

  useEffect(() => {
    if (nodes.length === 0) {
      loadTemplate('quick-image-5');
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0a]">
      <StudioToolbar />
      <div className="flex flex-1 overflow-hidden">
        <NodeSidebar />
        <StudioCanvas />
      </div>
    </div>
  );
}
