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
import {
  saveWorkflowLocal,
  loadWorkflowLocal,
  listWorkflowsLocal,
  deleteWorkflowLocal,
  generateLocalId,
  type LocalWorkflow,
} from './studio-local-db';

// ── Node data types ──────────────────────────────────────────────────

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
  provider: 'replicate' | 'fal' | 'api-easy' | 'local';
  aspectRatio: string;
  numOutputs: number;
  guidanceScale: number;
  outputImages: string[];
  isRunning: boolean;
  error: string | null;
}

export interface ImageVariationData {
  label: string;
  model: string;
  provider: 'replicate' | 'fal' | 'api-easy';
  strength: number;
  stylePrompt: string;
  outputImages: string[];
  isRunning: boolean;
  error: string | null;
}

export interface VideoGenData {
  label: string;
  model: string;
  provider: 'replicate' | 'fal' | 'api-easy' | 'local';
  duration: number;
  outputUrl: string | null;
  jobId: string | null;
  isRunning: boolean;
  progress: number;
  error: string | null;
}

export interface UpscaleData {
  label: string;
  scale: number;
  outputImage: string | null;
  isRunning: boolean;
  error: string | null;
}

export interface RemoveBGData {
  label: string;
  outputImage: string | null;
  isRunning: boolean;
  error: string | null;
}

export interface PreviewData {
  label: string;
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
}

export type StudioNodeData =
  | TextPromptData
  | ImageUploadData
  | ImageGenData
  | ImageVariationData
  | VideoGenData
  | UpscaleData
  | RemoveBGData
  | PreviewData;

// ── Store type ───────────────────────────────────────────────────────

export interface WorkflowMeta {
  id: string;
  name: string;
  updatedAt: string;
  createdAt: string;
}

export interface StudioState {
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;

  // Current user (for credit billing)
  currentUserId: string | null;
  setCurrentUserId: (userId: string | null) => void;

  // Workflow persistence
  currentWorkflowId: string | null;
  currentWorkflowName: string;
  isSaving: boolean;
  lastSavedAt: string | null;
  workflows: WorkflowMeta[];

  // React Flow handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Actions
  setSelectedNode: (id: string | null) => void;
  addNode: (type: string, position: { x: number; y: number }, data?: Record<string, unknown>) => string;
  updateNodeData: (id: string, data: Partial<Record<string, unknown>>) => void;
  removeNode: (id: string) => void;
  getUpstreamData: (nodeId: string) => { prompt?: string; style?: string; imageUrl?: string; imageUrls: string[] };
  setNodes: (nodes: Node[]) => void;
  setEdges: (edges: Edge[]) => void;

  // Workflow persistence actions
  setWorkflowName: (name: string) => void;
  saveWorkflow: (userId: string) => Promise<void>;
  loadWorkflow: (userId: string, workflowId: string) => Promise<void>;
  loadWorkflowList: (userId: string) => Promise<void>;
  deleteWorkflow: (userId: string, workflowId: string) => Promise<void>;
  newWorkflow: () => void;

  // Undo/redo
  undoStack: Array<{ nodes: Node[]; edges: Edge[] }>;
  redoStack: Array<{ nodes: Node[]; edges: Edge[] }>;
  pushUndoState: () => void;
  undo: () => void;
  redo: () => void;

  // Templates
  loadTemplate: (templateId: string) => void;

  // Batch generation
  batchImageTrigger: number;
  batchVideoTrigger: number;
  triggerBatchImages: () => void;
  triggerBatchVideos: () => void;
  setGlobalImageModel: (model: string) => void;
  setGlobalVideoModel: (model: string) => void;
}

// ── Default data factories ───────────────────────────────────────────

function defaultDataForType(type: string): Record<string, unknown> {
  switch (type) {
    case 'textPrompt':
      return { label: 'Text Prompt', prompt: '', style: 'photorealistic' };
    case 'imageUpload':
      return { label: 'Image Upload', imageUrl: null, fileName: null };
    case 'imageGen':
      return {
        label: 'Image Generation',
        model: 'nano-banana-pro',
        provider: 'api-easy',
        aspectRatio: '1:1',
        numOutputs: 1,
        guidanceScale: 7.5,
        outputImages: [],
        isRunning: false,
        error: null,
      };
    case 'imageVariation':
      return {
        label: 'Image Variation',
        model: 'flux-redux',
        provider: 'fal',
        strength: 0.7,
        stylePrompt: '',
        outputImages: [],
        isRunning: false,
        error: null,
      };
    case 'videoGen':
      return {
        label: 'Video Generation',
        model: 'veo-3.0-fast',
        provider: 'api-easy',
        duration: 8,
        aspectRatio: '16:9',
        resolution: '1K',
        outputUrl: null,
        jobId: null,
        isRunning: false,
        progress: 0,
        error: null,
      };
    case 'upscale':
      return {
        label: 'Upscale',
        scale: 2,
        outputImage: null,
        isRunning: false,
        error: null,
      };
    case 'removeBG':
      return {
        label: 'Remove Background',
        outputImage: null,
        isRunning: false,
        error: null,
      };
    case 'preview':
      return { label: 'Preview', mediaUrl: null, mediaType: null };
    default:
      return { label: type };
  }
}

// ── Counter for unique node IDs ──────────────────────────────────────

let nodeIdCounter = 0;

// ── Store ────────────────────────────────────────────────────────────

export const useStudioStore = create<StudioState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedNodeId: null,
  currentUserId: null,
  setCurrentUserId: (userId) => set({ currentUserId: userId }),
  currentWorkflowId: null,
  currentWorkflowName: 'Untitled Workflow',
  isSaving: false,
  lastSavedAt: null,
  workflows: [],
  undoStack: [],
  redoStack: [],
  batchImageTrigger: 0,
  batchVideoTrigger: 0,

  onNodesChange: (changes) => {
    // Push undo state for structural changes (remove, add) but not position drags
    const hasStructural = changes.some((c) => c.type === 'remove' || c.type === 'add');
    if (hasStructural) {
      const { nodes, edges, undoStack } = get();
      const snapshot = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
      set({ undoStack: [...undoStack.slice(-30), snapshot], redoStack: [] });
    }
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    // Push undo state for structural edge changes (remove)
    const hasStructural = changes.some((c) => c.type === 'remove' || c.type === 'add');
    if (hasStructural) {
      const { nodes, edges, undoStack } = get();
      const snapshot = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
      set({ undoStack: [...undoStack.slice(-30), snapshot], redoStack: [] });
    }
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection: Connection) => {
    // Push undo state before connecting
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
    // Push undo state before adding
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

    // Recursive walk up the graph to collect prompt + ALL upstream images.
    // This ensures that when multiple image sources are connected (e.g., an uploaded
    // product photo AND a previously generated image), ALL images are collected and
    // sent to the API for proper image editing / product placement.
    const visited = new Set<string>();

    function walk(currentId: string) {
      if (visited.has(currentId)) return;  // prevent cycles
      visited.add(currentId);

      const incomingEdges = edges.filter((e) => e.target === currentId);

      for (const edge of incomingEdges) {
        const sourceNode = nodes.find((n) => n.id === edge.source);
        if (!sourceNode) continue;

        const d = sourceNode.data as Record<string, unknown>;

        // Collect text prompt (take the first one found walking upstream)
        if (sourceNode.type === 'textPrompt') {
          if (!result.prompt) {
            result.prompt = d.prompt as string;
            result.style = d.style as string;
          }
        }

        // Collect ALL upstream images (not just the first one)
        let foundImage: string | null = null;
        if (sourceNode.type === 'imageUpload') {
          foundImage = d.imageUrl as string;
        } else if (sourceNode.type === 'imageGen' || sourceNode.type === 'imageVariation') {
          const imgs = d.outputImages as string[];
          if (imgs?.length) foundImage = imgs[0];
        } else if (sourceNode.type === 'upscale' || sourceNode.type === 'removeBG') {
          if (d.outputImage) foundImage = d.outputImage as string;
        }

        if (foundImage && !result.imageUrls.includes(foundImage)) {
          result.imageUrls.push(foundImage);
        }

        // Always keep walking upstream to find prompt and more images
        walk(sourceNode.id);
      }
    }

    walk(nodeId);

    // Set imageUrl to first image for backward compatibility
    if (result.imageUrls.length > 0) {
      result.imageUrl = result.imageUrls[0];
    }

    return result;
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  // ── Workflow persistence ──────────────────────────────────

  setWorkflowName: (name) => set({ currentWorkflowName: name }),

  saveWorkflow: async (userId) => {
    const { nodes, edges, currentWorkflowId, currentWorkflowName } = get();
    set({ isSaving: true });

    try {
      const now = new Date().toISOString();
      const wfId = currentWorkflowId || generateLocalId();

      const workflow: LocalWorkflow = {
        id: wfId,
        userId,
        name: currentWorkflowName,
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
        createdAt: currentWorkflowId ? '' : now, // preserve on update
        updatedAt: now,
      };

      // If updating, keep the original createdAt
      if (currentWorkflowId) {
        const existing = await loadWorkflowLocal(currentWorkflowId);
        if (existing) workflow.createdAt = existing.createdAt;
      }
      if (!workflow.createdAt) workflow.createdAt = now;

      await saveWorkflowLocal(workflow);

      set({
        currentWorkflowId: wfId,
        isSaving: false,
        lastSavedAt: now,
      });
    } catch (err) {
      console.error('Save workflow error:', err);
      set({ isSaving: false });
    }
  },

  loadWorkflow: async (_userId, workflowId) => {
    try {
      const workflow = await loadWorkflowLocal(workflowId);
      if (!workflow) throw new Error('Workflow not found');

      set({
        nodes: (workflow.nodes as Node[]) || [],
        edges: (workflow.edges as Edge[]) || [],
        currentWorkflowId: workflow.id,
        currentWorkflowName: workflow.name || 'Untitled Workflow',
        lastSavedAt: workflow.updatedAt,
        selectedNodeId: null,
      });
    } catch (err) {
      console.error('Load workflow error:', err);
    }
  },

  loadWorkflowList: async (userId) => {
    try {
      const workflows = await listWorkflowsLocal(userId);
      set({
        workflows: workflows.map((w) => ({
          id: w.id,
          name: w.name,
          updatedAt: w.updatedAt,
          createdAt: w.createdAt,
        })),
      });
    } catch (err) {
      console.error('Load workflow list error:', err);
    }
  },

  deleteWorkflow: async (_userId, workflowId) => {
    try {
      await deleteWorkflowLocal(workflowId);

      // Remove from local list
      set({
        workflows: get().workflows.filter((w) => w.id !== workflowId),
        ...(get().currentWorkflowId === workflowId
          ? { currentWorkflowId: null, currentWorkflowName: 'Untitled Workflow', nodes: [], edges: [] }
          : {}),
      });
    } catch (err) {
      console.error('Delete workflow error:', err);
    }
  },

  newWorkflow: () => {
    set({
      nodes: [],
      edges: [],
      currentWorkflowId: null,
      currentWorkflowName: 'Untitled Workflow',
      lastSavedAt: null,
      selectedNodeId: null,
      undoStack: [],
      redoStack: [],
    });
  },

  // ── Undo / Redo ───────────────────────────────────────────

  pushUndoState: () => {
    const { nodes, edges, undoStack } = get();
    const snapshot = { nodes: JSON.parse(JSON.stringify(nodes)), edges: JSON.parse(JSON.stringify(edges)) };
    set({
      undoStack: [...undoStack.slice(-30), snapshot], // Keep last 30 states
      redoStack: [],
    });
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

  // ── Batch generation ──────────────────────────────────────

  triggerBatchImages: () => {
    set({ batchImageTrigger: get().batchImageTrigger + 1 });
  },

  triggerBatchVideos: () => {
    set({ batchVideoTrigger: get().batchVideoTrigger + 1 });
  },

  setGlobalImageModel: (model: string) => {
    const nodes = get().nodes.map((node) => {
      if (node.type === 'imageGen') {
        return { ...node, data: { ...node.data, model } };
      }
      return node;
    });
    set({ nodes });
  },

  setGlobalVideoModel: (model: string) => {
    const nodes = get().nodes.map((node) => {
      if (node.type === 'videoGen') {
        return { ...node, data: { ...node.data, model } };
      }
      return node;
    });
    set({ nodes });
  },

  // ── Templates ─────────────────────────────────────────────

  loadTemplate: (templateId) => {
    const templates: Record<string, { nodes: Node[]; edges: Edge[] }> = {
      'text-to-image': {
        nodes: [
          { id: 'tpl-upload-1', type: 'imageUpload', position: { x: 80, y: 60 }, data: { ...defaultDataForType('imageUpload'), label: 'Upload Product Image' } },
          { id: 'tpl-prompt-1', type: 'textPrompt', position: { x: 80, y: 420 }, data: { ...defaultDataForType('textPrompt'), prompt: 'Describe your product or subject' } },
          { id: 'tpl-gen-1', type: 'imageGen', position: { x: 700, y: 200 }, data: defaultDataForType('imageGen') },
          { id: 'tpl-preview-1', type: 'preview', position: { x: 1350, y: 230 }, data: defaultDataForType('preview') },
        ],
        edges: [
          { id: 'tpl-e0', source: 'tpl-upload-1', target: 'tpl-gen-1', animated: true, type: 'animatedEdge' },
          { id: 'tpl-e1', source: 'tpl-prompt-1', target: 'tpl-gen-1', animated: true, type: 'animatedEdge' },
          { id: 'tpl-e2', source: 'tpl-gen-1', target: 'tpl-preview-1', animated: true, type: 'animatedEdge' },
        ],
      },
      'image-to-video': {
        nodes: [
          { id: 'tpl-upload-1', type: 'imageUpload', position: { x: 80, y: 0 }, data: { ...defaultDataForType('imageUpload'), label: 'Upload Product Image' } },
          { id: 'tpl-prompt-1', type: 'textPrompt', position: { x: 80, y: 380 }, data: { ...defaultDataForType('textPrompt'), prompt: 'Describe the scene or motion you want' } },
          { id: 'tpl-gen-1', type: 'imageGen', position: { x: 700, y: 140 }, data: defaultDataForType('imageGen') },
          { id: 'tpl-video-1', type: 'videoGen', position: { x: 1350, y: 140 }, data: defaultDataForType('videoGen') },
          { id: 'tpl-preview-1', type: 'preview', position: { x: 2000, y: 170 }, data: defaultDataForType('preview') },
        ],
        edges: [
          { id: 'tpl-e0', source: 'tpl-upload-1', target: 'tpl-gen-1', animated: true, type: 'animatedEdge' },
          { id: 'tpl-e1', source: 'tpl-prompt-1', target: 'tpl-gen-1', animated: true, type: 'animatedEdge' },
          { id: 'tpl-e2', source: 'tpl-gen-1', target: 'tpl-video-1', animated: true, type: 'animatedEdge' },
          { id: 'tpl-e3', source: 'tpl-video-1', target: 'tpl-preview-1', animated: true, type: 'animatedEdge' },
        ],
      },
      'image-pipeline': {
        nodes: [
          { id: 'tpl-upload-1', type: 'imageUpload', position: { x: 80, y: 220 }, data: defaultDataForType('imageUpload') },
          { id: 'tpl-rmbg-1', type: 'removeBG', position: { x: 700, y: 80 }, data: defaultDataForType('removeBG') },
          { id: 'tpl-upscale-1', type: 'upscale', position: { x: 700, y: 450 }, data: defaultDataForType('upscale') },
          { id: 'tpl-variation-1', type: 'imageVariation', position: { x: 1350, y: 220 }, data: defaultDataForType('imageVariation') },
          { id: 'tpl-preview-1', type: 'preview', position: { x: 2000, y: 220 }, data: defaultDataForType('preview') },
        ],
        edges: [
          { id: 'tpl-e1', source: 'tpl-upload-1', target: 'tpl-rmbg-1', animated: true, type: 'animatedEdge' },
          { id: 'tpl-e2', source: 'tpl-upload-1', target: 'tpl-upscale-1', animated: true, type: 'animatedEdge' },
          { id: 'tpl-e3', source: 'tpl-rmbg-1', target: 'tpl-variation-1', animated: true, type: 'animatedEdge' },
          { id: 'tpl-e4', source: 'tpl-variation-1', target: 'tpl-preview-1', animated: true, type: 'animatedEdge' },
        ],
      },
      'brand-asset-pack': (() => {
        // 10 cinematic image angle prompts
        const imageAngles = [
          { label: 'Hero Front', prompt: 'Front-facing hero shot, centered composition, studio lighting, clean background, product photography, 8K' },
          { label: '3/4 Angle', prompt: 'Three-quarter angle view, slight tilt, dramatic side lighting, cinematic depth of field, commercial photography' },
          { label: 'Side Profile', prompt: 'Clean side profile view, rim lighting, silhouette edge glow, editorial style, minimalist background' },
          { label: 'Top Down', prompt: 'Flat lay top-down overhead view, symmetrical composition, soft even lighting, catalog style' },
          { label: 'Low Angle', prompt: 'Low angle looking up, powerful heroic perspective, dramatic sky background, wide lens, cinematic' },
          { label: 'Close-Up Detail', prompt: 'Extreme close-up macro shot, sharp focus on texture and details, shallow depth of field, studio lighting' },
          { label: 'Dynamic Action', prompt: 'Dynamic action angle, motion blur background, frozen subject, sports photography style, high shutter speed' },
          { label: 'Environmental', prompt: 'Environmental context shot, subject in natural setting, golden hour lighting, lifestyle photography, bokeh background' },
          { label: 'Dramatic Backlit', prompt: 'Backlit silhouette shot, golden rim light, lens flare, moody atmosphere, cinematic color grading' },
          { label: 'Minimal White', prompt: 'Isolated on pure white background, soft shadows, e-commerce product shot, clean and minimal, centered' },
        ];
        // 5 cinematic video prompt styles — each linked to one of the first 5 image gen outputs
        const videoStyles = [
          { label: 'Slow Orbit', prompt: 'Slow smooth 360-degree orbit around subject, cinematic camera movement, studio lighting, 4K', fromImage: 0 },
          { label: 'Zoom Reveal', prompt: 'Slow dramatic zoom-in reveal, starting wide and pushing into detail, rack focus, cinematic', fromImage: 1 },
          { label: 'Parallax Pan', prompt: 'Smooth horizontal parallax pan, layered depth, cinematic letterbox, ambient movement', fromImage: 2 },
          { label: 'Epic Rise', prompt: 'Camera slowly rising upward, revealing subject from below to eye level, dramatic orchestral feel', fromImage: 3 },
          { label: 'Glitch Promo', prompt: 'Fast-paced promo cut, glitch transitions, dynamic zoom bursts, social media ad style, energetic', fromImage: 4 },
        ];

        const COL_PROMPT = 80;
        const COL_IMG = 720;
        const COL_VIDPROMPT = 1400;
        const COL_VID = 2050;
        const ROW_GAP = 380;

        const nodes: Node[] = [
          // Product upload node — feeds into all image gen nodes
          { id: 'ba-upload', type: 'imageUpload', position: { x: COL_PROMPT - 600, y: 4 * ROW_GAP }, data: { ...defaultDataForType('imageUpload'), label: 'Upload Product Image' } },
        ];
        const edges: Edge[] = [];

        // 10 image generation nodes — each with its own text prompt
        imageAngles.forEach((angle, i) => {
          const imgId = `ba-img-${i}`;
          const promptId = `ba-imgprompt-${i}`;
          nodes.push({
            id: promptId,
            type: 'textPrompt',
            position: { x: COL_PROMPT, y: i * ROW_GAP },
            data: { ...defaultDataForType('textPrompt'), prompt: angle.prompt, style: 'cinematic', label: angle.label },
          });
          nodes.push({
            id: imgId,
            type: 'imageGen',
            position: { x: COL_IMG, y: i * ROW_GAP },
            data: { ...defaultDataForType('imageGen'), label: angle.label },
          });
          // Upload → Image Gen (for image editing/reference)
          edges.push({ id: `ba-e-upload-img-${i}`, source: 'ba-upload', target: imgId, type: 'animatedEdge' });
          // Text Prompt → Image Gen
          edges.push({ id: `ba-e-prompt-img-${i}`, source: promptId, target: imgId, type: 'animatedEdge' });
        });

        // 5 video generation nodes — each connected FROM an image gen node + its own camera prompt
        videoStyles.forEach((style, i) => {
          const videoId = `ba-vid-${i}`;
          const vidPromptId = `ba-vidprompt-${i}`;
          const sourceImgId = `ba-img-${style.fromImage}`;
          const yPos = style.fromImage * ROW_GAP; // align vertically with source image

          nodes.push({
            id: vidPromptId,
            type: 'textPrompt',
            position: { x: COL_VIDPROMPT, y: yPos },
            data: { ...defaultDataForType('textPrompt'), prompt: style.prompt, style: 'cinematic', label: `Video: ${style.label}` },
          });
          nodes.push({
            id: videoId,
            type: 'videoGen',
            position: { x: COL_VID, y: yPos },
            data: { ...defaultDataForType('videoGen'), label: style.label },
          });
          // Image Gen output → Video Gen (uses generated image)
          edges.push({ id: `ba-e-img-vid-${i}`, source: sourceImgId, target: videoId, type: 'animatedEdge' });
          // Camera movement prompt → Video Gen
          edges.push({ id: `ba-e-prompt-vid-${i}`, source: vidPromptId, target: videoId, type: 'animatedEdge' });
        });

        return { nodes, edges };
      })(),

      // ── Quick Image Pack — 5 cinematic images + 5 videos ──────────
      'quick-image-5': (() => {
        const angles = [
          { label: 'Hero Front', prompt: 'Front-facing hero shot, centered composition, studio lighting, clean background, product photography, 8K', videoPrompt: 'Slow smooth 360-degree orbit around subject, cinematic camera movement, studio lighting, 4K' },
          { label: '3/4 Angle', prompt: 'Three-quarter angle view, slight tilt, dramatic side lighting, cinematic depth of field, commercial photography', videoPrompt: 'Slow dramatic zoom-in reveal, starting wide and pushing into detail, rack focus, cinematic' },
          { label: 'Top Down', prompt: 'Flat lay top-down overhead view, symmetrical composition, soft even lighting, catalog style', videoPrompt: 'Smooth horizontal parallax pan, layered depth, cinematic letterbox, ambient movement' },
          { label: 'Close-Up Detail', prompt: 'Extreme close-up macro shot, sharp focus on texture and details, shallow depth of field, studio lighting', videoPrompt: 'Camera slowly rising upward, revealing subject from below to eye level, dramatic orchestral feel' },
          { label: 'Minimal White', prompt: 'Isolated on pure white background, soft shadows, e-commerce product shot, clean and minimal, centered', videoPrompt: 'Fast-paced promo cut, glitch transitions, dynamic zoom bursts, social media ad style, energetic' },
        ];

        const COL_UPLOAD = -550;
        const COL_TP = 80;
        const COL_IMG = 720;
        const COL_VTP = 1400;
        const COL_VID = 2050;
        const ROW = 380;

        const nodes: Node[] = [
          { id: 'qi5-upload', type: 'imageUpload', position: { x: COL_UPLOAD, y: 2 * ROW }, data: { ...defaultDataForType('imageUpload'), label: 'Upload Product Image' } },
        ];
        const edges: Edge[] = [];

        angles.forEach((a, i) => {
          const genId = `qi5-img-${i}`;
          const vidId = `qi5-vid-${i}`;
          // Text prompt → Image Gen
          nodes.push({
            id: `qi5-tp-${i}`,
            type: 'textPrompt',
            position: { x: COL_TP, y: i * ROW },
            data: { ...defaultDataForType('textPrompt'), prompt: a.prompt, style: 'cinematic', label: a.label },
          });
          nodes.push({
            id: genId,
            type: 'imageGen',
            position: { x: COL_IMG, y: i * ROW },
            data: { ...defaultDataForType('imageGen'), label: a.label },
          });
          // Video prompt + Video Gen (connected from image gen output)
          nodes.push({
            id: `qi5-vtp-${i}`,
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
          // Upload → Image Gen
          edges.push({ id: `qi5-eu-${i}`, source: 'qi5-upload', target: genId, type: 'animatedEdge' });
          // Text Prompt → Image Gen
          edges.push({ id: `qi5-ep-${i}`, source: `qi5-tp-${i}`, target: genId, type: 'animatedEdge' });
          // Image Gen → Video Gen
          edges.push({ id: `qi5-eiv-${i}`, source: genId, target: vidId, type: 'animatedEdge' });
          // Video Prompt → Video Gen
          edges.push({ id: `qi5-evp-${i}`, source: `qi5-vtp-${i}`, target: vidId, type: 'animatedEdge' });
        });

        return { nodes, edges };
      })(),

      // ── Content Creator Pack — 10 images + 3 videos ────────
      // All start with a product upload node, then image gen, then video gen from outputs
      'content-creator-10': (() => {
        const imagePrompts = [
          { label: 'Hero Front', prompt: 'Front-facing hero shot, centered composition, studio lighting, clean background, product photography, 8K' },
          { label: '3/4 Angle', prompt: 'Three-quarter angle view, slight tilt, dramatic side lighting, cinematic depth of field, commercial photography' },
          { label: 'Side Profile', prompt: 'Clean side profile view, rim lighting, silhouette edge glow, editorial style, minimalist background' },
          { label: 'Top Down', prompt: 'Flat lay top-down overhead view, symmetrical composition, soft even lighting, catalog style' },
          { label: 'Low Angle', prompt: 'Low angle looking up, powerful heroic perspective, dramatic sky background, wide lens, cinematic' },
          { label: 'Close-Up', prompt: 'Extreme close-up macro shot, sharp focus on texture and details, shallow depth of field, studio lighting' },
          { label: 'Dynamic Action', prompt: 'Dynamic action angle, motion blur background, frozen subject, sports photography style, high shutter speed' },
          { label: 'Environmental', prompt: 'Environmental context shot, subject in natural setting, golden hour lighting, lifestyle photography, bokeh background' },
          { label: 'Dramatic Backlit', prompt: 'Backlit silhouette shot, golden rim light, lens flare, moody atmosphere, cinematic color grading' },
          { label: 'Minimal White', prompt: 'Isolated on pure white background, soft shadows, e-commerce product shot, clean and minimal, centered' },
        ];
        const videoPrompts = [
          { label: 'Slow Orbit', prompt: 'Slow smooth 360-degree orbit around subject, cinematic camera movement, studio lighting, 4K', fromImage: 0 },
          { label: 'Zoom Reveal', prompt: 'Slow dramatic zoom-in reveal, starting wide and pushing into detail, rack focus, cinematic', fromImage: 1 },
          { label: 'Epic Rise', prompt: 'Camera slowly rising upward, revealing subject from below to eye level, dramatic orchestral feel', fromImage: 2 },
        ];

        const COL_UPLOAD = -550;
        const COL_TP = 80;
        const COL_IMG = 720;
        const COL_VTP = 1400;
        const COL_VID = 2050;
        const ROW = 380;

        const nodes: Node[] = [
          // Product upload node — feeds into all image gen nodes
          { id: 'cc10-upload', type: 'imageUpload', position: { x: COL_UPLOAD, y: 4 * ROW }, data: { ...defaultDataForType('imageUpload'), label: 'Upload Product Image' } },
        ];
        const edges: Edge[] = [];

        // 10 image gen nodes with text prompts
        imagePrompts.forEach((a, i) => {
          const genId = `cc10-img-${i}`;
          nodes.push({
            id: `cc10-tp-${i}`,
            type: 'textPrompt',
            position: { x: COL_TP, y: i * ROW },
            data: { ...defaultDataForType('textPrompt'), prompt: a.prompt, style: 'cinematic', label: a.label },
          });
          nodes.push({
            id: genId,
            type: 'imageGen',
            position: { x: COL_IMG, y: i * ROW },
            data: { ...defaultDataForType('imageGen'), label: a.label },
          });
          // Upload → Image Gen (product reference)
          edges.push({ id: `cc10-eu-${i}`, source: 'cc10-upload', target: genId, type: 'animatedEdge' });
          // Text Prompt → Image Gen (angle/style)
          edges.push({ id: `cc10-ep-${i}`, source: `cc10-tp-${i}`, target: genId, type: 'animatedEdge' });
        });

        // 3 video gen nodes — connected FROM image gen outputs + camera movement prompts
        videoPrompts.forEach((v, i) => {
          const vidId = `cc10-vid-${i}`;
          const sourceImgId = `cc10-img-${v.fromImage}`;
          const yPos = v.fromImage * ROW;

          nodes.push({
            id: `cc10-vtp-${i}`,
            type: 'textPrompt',
            position: { x: COL_VTP, y: yPos },
            data: { ...defaultDataForType('textPrompt'), prompt: v.prompt, style: 'cinematic', label: `Video: ${v.label}` },
          });
          nodes.push({
            id: vidId,
            type: 'videoGen',
            position: { x: COL_VID, y: yPos },
            data: { ...defaultDataForType('videoGen'), label: v.label },
          });
          // Image Gen → Video Gen (generated image as input)
          edges.push({ id: `cc10-eiv-${i}`, source: sourceImgId, target: vidId, type: 'animatedEdge' });
          // Camera prompt → Video Gen
          edges.push({ id: `cc10-evp-${i}`, source: `cc10-vtp-${i}`, target: vidId, type: 'animatedEdge' });
        });

        return { nodes, edges };
      })(),

      // ── Full Production Pack — 15 images + 5 videos ────────
      // All start with product upload, then image gen, then video gen from outputs
      'full-production-15': (() => {
        const imagePrompts = [
          { label: 'Hero Front', prompt: 'Front-facing hero shot, centered composition, studio lighting, clean background, product photography, 8K' },
          { label: '3/4 Angle', prompt: 'Three-quarter angle view, slight tilt, dramatic side lighting, cinematic depth of field, commercial photography' },
          { label: 'Side Profile', prompt: 'Clean side profile view, rim lighting, silhouette edge glow, editorial style, minimalist background' },
          { label: 'Top Down', prompt: 'Flat lay top-down overhead view, symmetrical composition, soft even lighting, catalog style' },
          { label: 'Low Angle', prompt: 'Low angle looking up, powerful heroic perspective, dramatic sky background, wide lens, cinematic' },
          { label: 'Close-Up Detail', prompt: 'Extreme close-up macro shot, sharp focus on texture and details, shallow depth of field, studio lighting' },
          { label: 'Dynamic Action', prompt: 'Dynamic action angle, motion blur background, frozen subject, sports photography style, high shutter speed' },
          { label: 'Environmental', prompt: 'Environmental context shot, subject in natural setting, golden hour lighting, lifestyle photography, bokeh background' },
          { label: 'Dramatic Backlit', prompt: 'Backlit silhouette shot, golden rim light, lens flare, moody atmosphere, cinematic color grading' },
          { label: 'Minimal White', prompt: 'Isolated on pure white background, soft shadows, e-commerce product shot, clean and minimal, centered' },
          { label: 'Wide Landscape', prompt: 'Ultra-wide landscape composition, subject small in frame, sweeping vista, golden hour, anamorphic lens feel' },
          { label: 'Dutch Angle', prompt: 'Dynamic dutch angle tilt, tension and energy, street photography style, dramatic shadows, urban setting' },
          { label: 'Reflection', prompt: 'Reflective surface composition, mirror or water reflection, symmetrical framing, moody and artistic' },
          { label: 'Soft Portrait', prompt: 'Soft diffused light portrait style, pastel tones, gentle bokeh, intimate and warm, editorial fashion' },
          { label: 'Neon Night', prompt: 'Neon-lit night scene, cyberpunk color palette, reflective wet surfaces, cinematic nighttime photography' },
        ];
        const videoPrompts = [
          { label: 'Slow Orbit', prompt: 'Slow smooth 360-degree orbit around subject, cinematic camera movement, studio lighting, 4K', fromImage: 0 },
          { label: 'Zoom Reveal', prompt: 'Slow dramatic zoom-in reveal, starting wide and pushing into detail, rack focus, cinematic', fromImage: 1 },
          { label: 'Parallax Pan', prompt: 'Smooth horizontal parallax pan, layered depth, cinematic letterbox, ambient movement', fromImage: 2 },
          { label: 'Epic Rise', prompt: 'Camera slowly rising upward, revealing subject from below to eye level, dramatic orchestral feel', fromImage: 3 },
          { label: 'Glitch Promo', prompt: 'Fast-paced promo cut, glitch transitions, dynamic zoom bursts, social media ad style, energetic', fromImage: 4 },
        ];

        const COL_UPLOAD = -550;
        const COL_TP = 80;
        const COL_IMG = 720;
        const COL_VTP = 1400;
        const COL_VID = 2050;
        const ROW = 380;

        const nodes: Node[] = [
          // Product upload node — feeds into all image gen nodes
          { id: 'fp15-upload', type: 'imageUpload', position: { x: COL_UPLOAD, y: 7 * ROW }, data: { ...defaultDataForType('imageUpload'), label: 'Upload Product Image' } },
        ];
        const edges: Edge[] = [];

        // 15 image gen nodes with text prompts
        imagePrompts.forEach((a, i) => {
          const genId = `fp15-img-${i}`;
          nodes.push({
            id: `fp15-tp-${i}`,
            type: 'textPrompt',
            position: { x: COL_TP, y: i * ROW },
            data: { ...defaultDataForType('textPrompt'), prompt: a.prompt, style: 'cinematic', label: a.label },
          });
          nodes.push({
            id: genId,
            type: 'imageGen',
            position: { x: COL_IMG, y: i * ROW },
            data: { ...defaultDataForType('imageGen'), label: a.label },
          });
          // Upload → Image Gen (product reference)
          edges.push({ id: `fp15-eu-${i}`, source: 'fp15-upload', target: genId, type: 'animatedEdge' });
          // Text Prompt → Image Gen (angle/style)
          edges.push({ id: `fp15-ep-${i}`, source: `fp15-tp-${i}`, target: genId, type: 'animatedEdge' });
        });

        // 5 video gen nodes — connected FROM image gen outputs + camera movement prompts
        videoPrompts.forEach((v, i) => {
          const vidId = `fp15-vid-${i}`;
          const sourceImgId = `fp15-img-${v.fromImage}`;
          const yPos = v.fromImage * ROW;

          nodes.push({
            id: `fp15-vtp-${i}`,
            type: 'textPrompt',
            position: { x: COL_VTP, y: yPos },
            data: { ...defaultDataForType('textPrompt'), prompt: v.prompt, style: 'cinematic', label: `Video: ${v.label}` },
          });
          nodes.push({
            id: vidId,
            type: 'videoGen',
            position: { x: COL_VID, y: yPos },
            data: { ...defaultDataForType('videoGen'), label: v.label },
          });
          // Image Gen → Video Gen (generated image as input)
          edges.push({ id: `fp15-eiv-${i}`, source: sourceImgId, target: vidId, type: 'animatedEdge' });
          // Camera prompt → Video Gen
          edges.push({ id: `fp15-evp-${i}`, source: `fp15-vtp-${i}`, target: vidId, type: 'animatedEdge' });
        });

        return { nodes, edges };
      })(),
    };

    const template = templates[templateId];
    if (!template) return;

    set({
      nodes: template.nodes,
      edges: template.edges,
      currentWorkflowId: null,
      currentWorkflowName: templateId.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      selectedNodeId: null,
      undoStack: [],
      redoStack: [],
    });
  },
}));
