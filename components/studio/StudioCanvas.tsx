'use client';

import { useCallback, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import { useStudioStore } from '@/lib/studio-store';

import TextPromptNode from './nodes/TextPromptNode';
import ImageUploadNode from './nodes/ImageUploadNode';
import ImageGenNode from './nodes/ImageGenNode';
import VideoGenNode from './nodes/VideoGenNode';
import AnimatedEdge from './edges/AnimatedEdge';

const nodeTypes = {
  textPrompt: TextPromptNode,
  imageUpload: ImageUploadNode,
  imageGen: ImageGenNode,
  videoGen: VideoGenNode,
};

const edgeTypes = {
  animatedEdge: AnimatedEdge,
};

export default function StudioCanvas() {
  const reactFlowRef = useRef<ReactFlowInstance | null>(null);
  const nodes = useStudioStore((s) => s.nodes);
  const edges = useStudioStore((s) => s.edges);
  const onNodesChange = useStudioStore((s) => s.onNodesChange);
  const onEdgesChange = useStudioStore((s) => s.onEdgesChange);
  const onConnect = useStudioStore((s) => s.onConnect);
  const setSelectedNode = useStudioStore((s) => s.setSelectedNode);
  const addNode = useStudioStore((s) => s.addNode);

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowRef.current = instance;
  }, []);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      setSelectedNode(node.id);
    },
    [setSelectedNode],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, [setSelectedNode]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const type = e.dataTransfer.getData('application/reactflow');
      if (!type || !reactFlowRef.current) return;

      const position = reactFlowRef.current.screenToFlowPosition({
        x: e.clientX,
        y: e.clientY,
      });

      addNode(type, position);
    },
    [addNode],
  );

  return (
    <div className="flex-1 h-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={{ animated: true, type: 'animatedEdge' }}
        connectOnClick={true}
        snapToGrid={true}
        snapGrid={[20, 20]}
        fitView
        proOptions={{ hideAttribution: true }}
        className="studio-canvas"
        minZoom={0.1}
        maxZoom={2}
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="rgba(255,255,255,0.05)"
        />
        <Controls
          className="!bg-[#141414] !border-white/10 !rounded-lg !shadow-xl [&>button]:!bg-[#1a1a1a] [&>button]:!border-white/10 [&>button]:!text-white/60 [&>button:hover]:!bg-white/10"
        />
        <MiniMap
          nodeStrokeColor="rgba(255,255,255,0.2)"
          nodeColor="rgba(255,255,255,0.05)"
          maskColor="rgba(0,0,0,0.8)"
          className="!bg-[#0a0a0a] !border-white/5 !rounded-lg"
        />
      </ReactFlow>
    </div>
  );
}
