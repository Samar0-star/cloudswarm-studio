import React, { useState, useMemo } from 'react';
import {
  Globe,
  Network,
  Server,
  Layers,
  Cpu,
  Database,
  HardDrive,
  Radio,
  Shield,
  KeyRound,
  Lock,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
  Sparkles,
  Zap,
  Boxes,
  BrainCircuit,
  Cloud,
  Container,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';
import {
  CLOUD_RESOURCE_CATALOG,
  type ResourceCatalogItem,
  isK8sResource,
} from '../../core/catalog/resourceCatalog';
import type { CloudProvider, ResourceCategory } from '../../types/topology';

export type ProviderFilterTab = 'all' | 'aws' | 'azure' | 'google' | 'k8s';

export const ResourcePalette: React.FC = () => {
  const {
    addNode,
    topologyState,
    canvasPan,
    canvasZoom,
    selectNode,
    updateAgentPresence,
    isPaletteOpen,
    setIsPaletteOpen,
  } = useCloudSwarmStore();

  // Open by default as a permanent docked left CAD drawer
  const [localIsOpen, setLocalIsOpen] = useState(true);
  const isOpen = isPaletteOpen ?? localIsOpen;
  const setIsOpen = (open: boolean) => {
    setLocalIsOpen(open);
    if (setIsPaletteOpen) {
      setIsPaletteOpen(open);
    }
  };

  const [searchQuery, setSearchQuery] = useState('');
  const [activeProviderTab, setActiveProviderTab] = useState<ProviderFilterTab>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const categories: Array<'All' | ResourceCategory> = [
    'All',
    'Compute',
    'Storage',
    'Database',
    'Network',
    'Security',
    'AI/ML',
  ];

  // Provider & K8s counts
  const providerCounts = useMemo(() => {
    const counts = { all: CLOUD_RESOURCE_CATALOG.length, aws: 0, azure: 0, google: 0, k8s: 0 };
    for (const item of CLOUD_RESOURCE_CATALOG) {
      if (item.provider === 'aws') counts.aws++;
      else if (item.provider === 'azure') counts.azure++;
      else if (item.provider === 'google') counts.google++;
      if (isK8sResource(item)) counts.k8s++;
    }
    return counts;
  }, []);

  // Category counts based on active provider tab
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { All: 0 };
    for (const cat of categories) {
      if (cat !== 'All') counts[cat] = 0;
    }
    for (const item of CLOUD_RESOURCE_CATALOG) {
      const matchesProvider =
        activeProviderTab === 'all' ||
        (activeProviderTab === 'k8s' ? isK8sResource(item) : item.provider === activeProviderTab);

      if (matchesProvider) {
        counts.All = (counts.All || 0) + 1;
        counts[item.category] = (counts[item.category] || 0) + 1;
      }
    }
    return counts;
  }, [activeProviderTab]);

  const filteredCatalog = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return CLOUD_RESOURCE_CATALOG.filter((item) => {
      // Provider filter tab
      if (activeProviderTab === 'k8s') {
        if (!isK8sResource(item)) return false;
      } else if (activeProviderTab !== 'all') {
        if (item.provider !== activeProviderTab) return false;
      }

      // Category filter tab
      if (selectedCategory !== 'All' && item.category !== selectedCategory) {
        return false;
      }

      // Instant search filter
      if (query) {
        const matchesName = item.name.toLowerCase().includes(query);
        const matchesType = item.type.toLowerCase().includes(query);
        const matchesDesc = item.description.toLowerCase().includes(query);
        const matchesCat = item.category.toLowerCase().includes(query);
        const matchesProv = (
          item.provider === 'google' ? 'gcp google cloud' : item.provider
        ).includes(query);
        const matchesK8s = isK8sResource(item) && 'k8s kubernetes container'.includes(query);
        if (!matchesName && !matchesType && !matchesDesc && !matchesCat && !matchesProv && !matchesK8s) {
          return false;
        }
      }

      return true;
    });
  }, [searchQuery, activeProviderTab, selectedCategory]);

  const getCategoryIcon = (category: ResourceCategory, iconName?: string) => {
    switch (iconName) {
      case 'Server':
        return <Server className="h-3.5 w-3.5 text-emerald-400" />;
      case 'Cpu':
        return <Cpu className="h-3.5 w-3.5 text-indigo-400" />;
      case 'Layers':
        return <Layers className="h-3.5 w-3.5 text-teal-400" />;
      case 'HardDrive':
        return <HardDrive className="h-3.5 w-3.5 text-amber-400" />;
      case 'Database':
        return <Database className="h-3.5 w-3.5 text-violet-400" />;
      case 'Radio':
        return <Radio className="h-3.5 w-3.5 text-blue-400" />;
      case 'Network':
        return <Network className="h-3.5 w-3.5 text-sky-400" />;
      case 'Globe':
        return <Globe className="h-3.5 w-3.5 text-cyan-400" />;
      case 'Shield':
        return <Shield className="h-3.5 w-3.5 text-rose-400" />;
      case 'KeyRound':
      case 'Lock':
        return <KeyRound className="h-3.5 w-3.5 text-orange-400" />;
      case 'BrainCircuit':
      case 'Sparkles':
        return <BrainCircuit className="h-3.5 w-3.5 text-fuchsia-400" />;
      default:
        break;
    }

    switch (category) {
      case 'Compute':
        return <Server className="h-3.5 w-3.5 text-emerald-400" />;
      case 'Storage':
        return <HardDrive className="h-3.5 w-3.5 text-amber-400" />;
      case 'Database':
        return <Database className="h-3.5 w-3.5 text-violet-400" />;
      case 'Network':
        return <Network className="h-3.5 w-3.5 text-cyan-400" />;
      case 'Security':
        return <Shield className="h-3.5 w-3.5 text-rose-400" />;
      case 'AI/ML':
        return <BrainCircuit className="h-3.5 w-3.5 text-fuchsia-400" />;
      default:
        return <Boxes className="h-3.5 w-3.5 text-slate-400" />;
    }
  };

  const getProviderBadges = (item: ResourceCatalogItem) => {
    const isK8s = isK8sResource(item);
    return (
      <div className="flex items-center space-x-1 shrink-0">
        {item.provider === 'aws' && (
          <span className="px-1 py-0.2 rounded text-[9px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            AWS
          </span>
        )}
        {item.provider === 'azure' && (
          <span className="px-1 py-0.2 rounded text-[9px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            Azure
          </span>
        )}
        {item.provider === 'google' && (
          <span className="px-1 py-0.2 rounded text-[9px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            GCP
          </span>
        )}
        {isK8s && (
          <span className="px-1 py-0.2 rounded text-[9px] font-mono font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700">
            K8s
          </span>
        )}
      </div>
    );
  };

  const handleSpawnResource = (item: ResourceCatalogItem) => {
    const existingCount = Object.values(topologyState.nodes).filter(
      (n) => n.type === item.type
    ).length;
    const cleanPrefix = item.type
      .replace(/^aws_/, '')
      .replace(/^azurerm_/, '')
      .replace(/^google_/, '');
    const nodeId = `${cleanPrefix}_${existingCount + 1}`;

    const spawnX = Math.round((-canvasPan.x + 420 + Math.random() * 80) / canvasZoom);
    const spawnY = Math.round((-canvasPan.y + 200 + Math.random() * 80) / canvasZoom);

    addNode({
      id: nodeId,
      type: item.type,
      name: `${item.name} ${existingCount + 1}`,
      position: { x: spawnX, y: spawnY },
      config: { ...item.defaultConfig },
      metadata: {
        createdBy: 'director',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        status: 'healthy',
      },
      version: 1,
    });

    selectNode(nodeId);
  };

  const handleDragStart = (e: React.DragEvent, item: ResourceCatalogItem) => {
    e.dataTransfer.setData('application/json', JSON.stringify(item));
    e.dataTransfer.setData('text/plain', item.type);
    e.dataTransfer.effectAllowed = 'copy';

    updateAgentPresence('director', {
      isDragging: true,
      draggedItemType: item.type,
      draggedItemName: item.name,
    });
  };

  const handleDragEnd = () => {
    updateAgentPresence('director', {
      isDragging: false,
      draggedItemType: undefined,
      draggedItemName: undefined,
    });
  };

  return (
    <div
      className="absolute top-3 left-3 bottom-3 z-30 flex flex-col items-start pointer-events-none select-none"
      data-testid="resource-palette"
    >
      {/* Collapsed Mini CAD Rail Trigger */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto flex items-center space-x-2 px-3 py-2 bg-white/95 dark:bg-[#0D0E10]/95 hover:bg-zinc-50 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-lg text-zinc-800 dark:text-zinc-100 text-xs font-semibold transition-all backdrop-blur-xl cursor-pointer"
          title="Open Primitives Catalog"
          data-testid="palette-toggle-btn"
        >
          <Boxes className="h-4 w-4 text-zinc-600 dark:text-zinc-400" />
          <span>Primitives</span>
          <span className="text-[10px] font-mono px-1.5 py-0.2 bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 font-semibold rounded-md border border-zinc-200 dark:border-zinc-800">
            {CLOUD_RESOURCE_CATALOG.length}
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
        </button>
      )}

      {/* Permanent Docked Left CAD Drawer */}
      {isOpen && (
        <div
          className="pointer-events-auto w-76 md:w-80 h-full max-h-[calc(100vh-160px)] flex flex-col bg-white/98 dark:bg-[#090A0C]/98 border border-zinc-200 dark:border-zinc-800/90 rounded-2xl shadow-xl overflow-hidden backdrop-blur-2xl animate-in fade-in slide-in-from-left-2 duration-200 text-zinc-900 dark:text-zinc-100"
          data-testid="palette-expanded-menu"
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Drawer CAD Header */}
          <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/60 shrink-0">
            <div className="flex items-center space-x-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300">
                <Boxes className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 tracking-wide uppercase font-mono">
                CAD Primitives
              </h3>
              <span className="text-[10px] font-mono text-zinc-500 font-normal">
                ({filteredCatalog.length}/{CLOUD_RESOURCE_CATALOG.length})
              </span>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
              title="Collapse CAD Drawer"
              data-testid="palette-close-btn"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          </div>

          {/* Controls Bar: Cloud Provider Tabs & Search */}
          <div className="p-3 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-[#0A0B0E] space-y-2.5 shrink-0">
            {/* Cloud Provider Tabs (All, AWS, Azure, GCP, K8s) */}
            <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none pb-0.5">
              <button
                onClick={() => setActiveProviderTab('all')}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-medium transition-all cursor-pointer shrink-0 ${
                  activeProviderTab === 'all'
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
                }`}
                data-testid="provider-filter-all"
              >
                All ({providerCounts.all})
              </button>

              <button
                onClick={() => setActiveProviderTab('aws')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[10px] font-mono font-medium transition-all cursor-pointer shrink-0 ${
                  activeProviderTab === 'aws'
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
                }`}
                data-testid="provider-filter-aws"
              >
                <span>AWS</span>
                <span className="text-[9px] opacity-75">({providerCounts.aws})</span>
              </button>

              <button
                onClick={() => setActiveProviderTab('azure')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[10px] font-mono font-medium transition-all cursor-pointer shrink-0 ${
                  activeProviderTab === 'azure'
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
                }`}
                data-testid="provider-filter-azure"
              >
                <span>Azure</span>
                <span className="text-[9px] opacity-75">({providerCounts.azure})</span>
              </button>

              <button
                onClick={() => setActiveProviderTab('google')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[10px] font-mono font-medium transition-all cursor-pointer shrink-0 ${
                  activeProviderTab === 'google'
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
                }`}
                data-testid="provider-filter-gcp"
              >
                <span>GCP</span>
                <span className="text-[9px] opacity-75">({providerCounts.google})</span>
              </button>

              <button
                onClick={() => setActiveProviderTab('k8s')}
                className={`flex items-center space-x-1 px-2 py-1 rounded-lg text-[10px] font-mono font-medium transition-all cursor-pointer shrink-0 ${
                  activeProviderTab === 'k8s'
                    ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold shadow-xs'
                    : 'bg-zinc-100 dark:bg-zinc-900/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 border border-zinc-200 dark:border-zinc-800'
                }`}
                data-testid="provider-filter-k8s"
              >
                <Container className="h-3 w-3" />
                <span>K8s</span>
                <span className="text-[9px] opacity-75">({providerCounts.k8s})</span>
              </button>
            </div>

            {/* Instant Search Bar */}
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-zinc-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder="Instant search 108 primitives..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-7 py-1.5 bg-zinc-100 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 rounded-lg text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 outline-none focus:border-zinc-400 dark:focus:border-zinc-600 transition-colors font-mono"
                data-testid="palette-search-input"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 p-0.5 text-zinc-400 hover:text-zinc-800 dark:text-zinc-500 dark:hover:text-zinc-100 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Category Filter Tabs */}
            <div className="flex items-center space-x-1 overflow-x-auto scrollbar-none pb-0.5">
              {categories.map((cat) => {
                const count = categoryCounts[cat] ?? 0;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={`flex items-center space-x-1 px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors shrink-0 cursor-pointer ${
                      selectedCategory === cat
                        ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-semibold'
                        : 'bg-transparent text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200'
                    }`}
                    data-testid={`category-tab-${cat.toLowerCase().replace('/', '-')}`}
                  >
                    <span>{cat}</span>
                    <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* List of Primitives (Scrollable with Sleek Custom Scrollbar) */}
          <div
            className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-800 scrollbar-track-transparent"
            data-testid="palette-items-list"
          >
            {filteredCatalog.length === 0 ? (
              <div className="py-8 text-center text-zinc-400 dark:text-zinc-500 text-xs">
                No primitives match your filter criteria.
              </div>
            ) : (
              filteredCatalog.map((item) => (
                <div
                  key={item.type}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, item)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleSpawnResource(item)}
                  className="group flex items-center justify-between p-2 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 bg-white dark:bg-zinc-900/40 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-grab active:cursor-grabbing transition-all select-none"
                  title={`${item.name}\n${item.description}\n(Click to place at center or Drag onto canvas)`}
                  data-testid={`palette-item-${item.type}`}
                >
                  <div className="flex items-center space-x-2.5 truncate min-w-0">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400">
                      {getCategoryIcon(item.category, item.iconName)}
                    </div>
                    <div className="truncate min-w-0">
                      <div className="flex items-center space-x-1.5 truncate">
                        <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">
                          {item.name}
                        </span>
                        {getProviderBadges(item)}
                      </div>
                      <div className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono truncate max-w-[160px]">
                        {item.type}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 ml-2">
                    {item.pricingModel?.baseMonthlyRate !== undefined && (
                      <span className="text-[9px] font-mono text-zinc-500 dark:text-zinc-400">
                        ${item.pricingModel.baseMonthlyRate.toFixed(0)}/mo
                      </span>
                    )}
                    <div className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 group-hover:bg-zinc-200 dark:group-hover:bg-zinc-700 group-hover:text-zinc-900 dark:group-hover:text-white transition-all">
                      <Plus className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Dock Footer: Helpful CAD Hint */}
          <div className="p-2 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50 dark:bg-zinc-900/60 text-center shrink-0">
            <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">
              Tip: Drag onto canvas or click to spawn
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
