import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Connection,
} from '@xyflow/react';

export interface TextPromptData {
  label: string;
  prompt: string;
  style: string;
}

export interface ImageUploadData {
  label: string;
  imageUrl: string | null;
  fileName: string | null;
}

export interface ImageGenData {
  label: string;
  model: string;
  aspectRatio: string;
  numOutputs: number;
  guidanceScale: number;
  outputImages: string[];
  isRunning: boolean;
  error: string | null;
}

export interface VideoGenData {
  label: string;
  model: string;
  duration: number;
  outputUrl: string | null;
  isRunning: boolean;
  progress: number;
  error: string | null;
}

export type StudioNodeData =
  | TextPromptData
  | ImageUploadData
  | ImageGenData
  | VideoGenData;

export interface StudioState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;

  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  setSelectedNode: (id: string | null) => void;
  addNode: (type: string, position: { x: number; y: number }, data?: Record<string, unknown>) => string;
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;
  removeNode: (id: string) => void;
  getUpstreamData: (nodeId: string) => { prompt?: string; style?: string; imageUrl?: string; imageUrls: string[] };
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;

  undoStack: Array<{ nodes: Node[]; edges: Edge[] }>;
  redoStack: Array<{ nodes: Node[]; edges: Edge[] }>;
  pushUndoState: () => void;
  undo: () => void;
  redo: () => void;

  loadTemplate: (templateId: string) => void;

  batchImageTrigger: number;
  batchVideoTrigger: number;
  triggerBatchImages: () => void;
  triggerBatchVideos: () => void;
}

function defaultDataForType(type: string): Record<string, unknown> {
  switch (type) {
    case 'textPrompt':
      return { label: 'Text Prompt', prompt: '', style: 'photorealistic' };
    case 'imageUpload':
      return { label: 'Image Upload', imageUrl: null, fileName: null };
    case 'imageGen':
      return {
        label: 'Image Generation',
        model: 'local-sd15',
        aspectRatio: '1:1',
        numOutputs: 1,
        guidanceScale: 7.5,
        outputImages: [],
        isRunning: false,
        error: null,
      };
    case 'videoGen':
      return {
        label: 'Video Generation',
        model: 'local-animatediff',
        duration: 2,
        aspectRatio: '16:9',
        outputUrl: null,
        isRunning: false,
        progress: 0,
        error: null,
      };
    default:
      return { label: type };
  }
}

const TEMPLATES: Record<string, { nodes: Node[]; edges: Edge[] }> = {
  'quick-image-5': (() => {
    const angles = [
      { label: 'Hero Front', prompt: 'Professional product photography, front view, studio lighting on white background, high-end commercial shot', videoPrompt: 'Slow smooth 360-degree orbit around the product, studio lighting' },
      { label: 'Lifestyle', prompt: 'Product in a beautiful lifestyle setting, natural lighting, editorial photography, warm tones', videoPrompt: 'Camera slowly pulling back to reveal the lifestyle scene, smooth dolly motion' },
      { label: 'Close-Up Detail', prompt: 'Extreme close-up of product details and textures, macro photography, shallow depth of field', videoPrompt: 'Slow macro camera movement revealing intricate product details' },
      { label: 'Dark Moody', prompt: 'Product on dark background with dramatic rim lighting, luxury feel, high contrast', videoPrompt: 'Dramatic lighting sweep across the product, cinematic shadows' },
      { label: 'Flat Lay', prompt: 'Top-down flat lay product arrangement with props, editorial style, soft shadows', videoPrompt: 'Top-down camera slowly rotating over the flat lay arrangement' },
    ];

    const COL_UPLOAD = -550;
    const COL_TP = 80;
    const COL_IMG = 720;
    const COL_VTP = 1400;
    const COL_VID = 2050;
    const ROW = 380;

    const nodes: Node[] = [
      {
        id: 'qi5-upload',
        type: 'imageUpload',
        position: { x: COL_UPLOAD, y: 2 * ROW },
        data: { ...defaultDataForType('imageUpload'), label: 'Upload Product Image' },
      },
    ];
    const edges: Edge[] = [];

    angles.forEach((a, i) => {
      const tpId = `qi5-tp-${i}`;
      const genId = `qi5-img-${i}`;
      const vtpId = `qi5-vtp-${i}`;
      const vidId = `qi5-vid-${i}`;

      nodes.push({
        id: tpId,
        type: 'textPrompt',
        position: { x: COL_TP, y: i * ROW },
        data: { ...defaultDataForType('textPrompt'), prompt: a.prompt, style: 'photorealistic', label: a.label },
      });

      nodes.push({
        id: genId,
        type: 'imageGen',
        position: { x: COL_IMG, y: i * ROW },
        data: { ...defaultDataForType('imageGen'), label: a.label },
      });

      nodes.push({
        id: vtpId,
        type: 'textPrompt',
        position: { x: COL_VTP, y: i * ROW },
        data: { ...defaultDataForType('textPrompt'), prompt: a.videoPrompt, style: 'cinematic', label: `Video: ${a.label}` },
      });

      nodes.push({
        id: vidId,
        type: 'videoGen',
        position: { x: COL_VID, y: i * ROW },
        data: { ...defaultDataForType('videoGen'), label: a.label },
      });

      edges.push({ id: `qi5-eu-${i}`, source: 'qi5-upload', target: genId, type: 'animatedEdge' });
      edges.push({ id: `qi5-et-${i}`, source: tpId, target: genId, type: 'animatedEdge' });
      edges.push({ id: `qi5-eiv-${i}`, source: genId, target: vidId, type: 'animatedEdge' });
      edges.push({ id: `qi5-evp-${i}`, source: vtpId, target: vidId, type: 'animatedEdge' });
    });

    return { nodes, edges };
  })(),

  'simple': {
    nodes: [
      {
        id: 'simple-tp',
        type: 'textPrompt',
        position: { x: 0, y: 100 },
        data: { ...defaultDataForType('textPrompt'), prompt: 'A beautiful landscape, photorealistic, golden hour lighting' },
      },
      {
        id: 'simple-img',
        type: 'imageGen',
        position: { x: 500, y: 100 },
        data: defaultDataForType('imageGen'),
      },
    ],
    edges: [
      { id: 'simple-e1', source: 'simple-tp', target: 'simple-img', type: 'animatedEdge' },
    ],
  },
};

let nodeIdCounter = 0;

export const useStudioStore = create<StudioState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  undoStack: [],
  redoStack: [],
  batchImageTrigger: 0,
  batchVideoTrigger: 0,

  onNodesChange: (changes) => {
    const hasStructural = changes.some((c) => c.type === 'remove' || c.type === 'add');
    if (hasStructural) {
      const { nodes, edges, undoStack } = get();
      const snapshot = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
      set({ undoStack: [...undoStack.slice(-30), snapshot], redoStack: [] });
    }
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    const hasStructural = changes.some((c) => c.type === 'remove' || c.type === 'add');
    if (hasStructural) {
      const { nodes, edges, undoStack } = get();
      const snapshot = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
      set({ undoStack: [...undoStack.slice(-30), snapshot], redoStack: [] });
    }
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection: Connection) => {
    const { nodes, edges, undoStack } = get();
    const snapshot = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
    set({
      undoStack: [...undoStack.slice(-30), snapshot],
      redoStack: [],
      edges: addEdge(
        { ...connection, animated: true, type: 'animatedEdge' },
        get().edges,
      ),
    });
  },

  setSelectedNode: (id) => set({ selectedNodeId: id }),

  addNode: (type, position, data) => {
    const { nodes: currentNodes, edges: currentEdges, undoStack } = get();
    const snapshot = { nodes: JSON.parse(JSON.stringify(currentNodes)), edges: JSON.parse(JSON.stringify(currentEdges)) };
    const id = `${type}-${++nodeIdCounter}-${Date.now()}`;
    const newNode: Node = {
      id,
      type,
      position,
      data: { ...defaultDataForType(type), ...data },
    };
    set({
      nodes: [...get().nodes, newNode],
      undoStack: [...undoStack.slice(-30), snapshot],
      redoStack: [],
    });
    return id;
  },

  updateNodeData: (id, data) => {
    set({
      nodes: get().nodes.map((node) =>
        node.id === id ? { ...node, data: { ...node.data, ...data } } : node,
      ),
    });
  },

  removeNode: (id) => {
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
    });
  },

  getUpstreamData: (nodeId) => {
    const { nodes, edges } = get();
    const result: { prompt?: string; style?: string; imageUrl?: string; imageUrls: string[] } = { imageUrls: [] };

    const visited = new Set<string>();

    function walk(currentId: string) {
      if (visited.has(currentId)) return;
      visited.add(currentId);

      const incomingEdges = edges.filter((e) => e.target === currentId);

      for (const edge of incomingEdges) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (!sourceNode) continue;

        const d = sourceNode.data as Record<string, unknown>;

        if (sourceNode.type === 'textPrompt') {
          if (!result.prompt) {
            result.prompt = d.prompt as string;
            result.style = d.style as string;
          }
        }

        let foundImage: string | null = null;
        if (sourceNode.type === 'imageUpload') {
          foundImage = d.imageUrl as string;
        } else if (sourceNode.type === 'imageGen') {
          const imgs = d.outputImages as string[];
          if (imgs?.length) foundImage = imgs[0];
        }

        if (foundImage && !result.imageUrls.includes(foundImage)) {
          result.imageUrls.push(foundImage);
        }

        walk(sourceNode.id);
      }
    }

    walk(nodeId);

    if (result.imageUrls.length > 0) {
      result.imageUrl = result.imageUrls[0];
    }

    return result;
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  pushUndoState: () => {
    const { nodes, edges, undoStack } = get();
    const snapshot = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
    set({ undoStack: [...undoStack.slice(-30), snapshot], redoStack: [] });
  },

  undo: () => {
    const { undoStack, nodes, edges } = get();
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...get().redoStack, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }],
      nodes: prev.nodes,
      edges: prev.edges,
    });
  },

  redo: () => {
    const { redoStack, nodes, edges } = get();
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    set({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...get().undoStack, { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) }],
      nodes: next.nodes,
      edges: next.edges,
    });
  },

  triggerBatchImages: () => {
    set({ batchImageTrigger: get().batchImageTrigger + 1 });
  },

  triggerBatchVideos: () => {
    set({ batchVideoTrigger: get().batchVideoTrigger + 1 });
  },

  loadTemplate: (templateId) => {
    const template = TEMPLATES[templateId];
    if (!template) return;
    set({
      nodes: JSON.parse(JSON.stringify(template.nodes)),
      edges: JSON.parse(JSON.stringify(template.edges)),
      selectedNodeId: null,
      undoStack: [],
      redoStack: [],
    });
  },
}));
