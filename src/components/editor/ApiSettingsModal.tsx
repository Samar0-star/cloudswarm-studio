import React, { useState } from 'react';
import {
  KeyRound,
  Cpu,
  CheckCircle2,
  AlertCircle,
  Zap,
  Radio,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { Modal } from '../common/Modal';
import { Button } from '../common/Button';
import { useCloudSwarmStore } from '../../store/useCloudSwarmStore';

export const ApiSettingsModal: React.FC = () => {
  const {
    isApiSettingsOpen,
    setIsApiSettingsOpen,
    engineMode,
    setEngineMode,
    googleApiKeys,
    setGoogleApiKeys,
    nvidiaApiKey,
    setNvidiaApiKey,
    selectedModel,
    setSelectedModel,
    geminiClient,
  } = useCloudSwarmStore();

  const [inputGeminiKeys, setInputGeminiKeys] = useState(googleApiKeys.join('\n'));
  const [inputNimKey, setInputNimKey] = useState(nvidiaApiKey);
  const [showKey, setShowKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');

  const models = [
    { id: 'gemini-3.7-flash', name: 'Google Gemini 3.7 Flash', tag: 'Ultra-Fast <400ms Sub-Second Swarm (Recommended)', provider: 'gemini' },
    { id: 'gemini-2.5-pro', name: 'Google Gemini 2.5 Pro', tag: 'Deep Architectural Reasoning', provider: 'gemini' },
    { id: 'moonshotai/kimi-k3', name: 'Moonshot Kimi-K3', tag: 'NVIDIA NIM Streaming', provider: 'nim' },
    { id: 'nvidia/llama-3.1-nemotron-70b-instruct', name: 'NVIDIA Nemotron 70B', tag: 'Cloud Synthesis', provider: 'nim' },
  ];

  const handleSave = () => {
    const parsedKeys = inputGeminiKeys.split(/[\n,]+/).map((k) => k.trim()).filter((k) => k.length > 0);
    setGoogleApiKeys(parsedKeys);
    setNvidiaApiKey(inputNimKey);
    setIsApiSettingsOpen(false);
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');

    if (engineMode === 'live_gemini') {
      const keys = inputGeminiKeys.split(/[\n,]+/).map((k) => k.trim()).filter((k) => k.length > 0);
      if (keys.length === 0) {
        setTestStatus('error');
        setTestMessage('Please enter at least one Google Gemini API key.');
        return;
      }

      let successCount = 0;
      for (const k of keys) {
        try {
          const res = await fetch('/api/gemini/v1beta/openai/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${k}`,
            },
            body: JSON.stringify({
              model: 'gemini-2.5-flash',
              messages: [{ role: 'user', content: 'Respond with OK' }],
              max_tokens: 5,
            }),
          });
          if (res.ok) successCount++;
        } catch {
          // ignore single key error
        }
      }

      if (successCount > 0) {
        setTestStatus('success');
        setTestMessage(`Verified ${successCount}/${keys.length} Gemini API keys active in rotation pool!`);
      } else {
        setTestStatus('error');
        setTestMessage('All tested Gemini API keys failed or rate-limited.');
      }
    } else {
      if (!inputNimKey.trim()) {
        setTestStatus('error');
        setTestMessage('Please enter an NVIDIA NIM API key first.');
        return;
      }
      try {
        const res = await fetch('/api/nim/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${inputNimKey.trim()}`,
          },
          body: JSON.stringify({
            model: selectedModel.startsWith('gemini') ? 'moonshotai/kimi-k3' : selectedModel,
            messages: [{ role: 'user', content: 'Respond with OK' }],
            max_tokens: 5,
          }),
        });

        if (res.ok) {
          setTestStatus('success');
          setTestMessage('NVIDIA NIM API connection verified!');
        } else {
          const text = await res.text();
          setTestStatus('error');
          setTestMessage(`HTTP ${res.status}: ${text.slice(0, 80)}`);
        }
      } catch (err: any) {
        setTestStatus('error');
        setTestMessage(err.message || 'Network connection failed');
      }
    }
  };

  return (
    <Modal
      isOpen={isApiSettingsOpen}
      onClose={() => setIsApiSettingsOpen(false)}
      title="Multi-Agent LLM Engine & API Key Rotation"
      description="Configure high-speed Google Gemini with automatic multi-key failover rotation or NVIDIA NIM."
      size="md"
      footer={
        <div className="flex items-center justify-between w-full">
          <Button variant="ghost" size="sm" onClick={() => setIsApiSettingsOpen(false)}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleSave}>
            Save & Apply Settings
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-1 text-slate-200">
        {/* Engine Mode Selector */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase font-mono mb-2">
            Execution Engine Mode
          </label>
          <div className="grid grid-cols-3 gap-2">
            <div
              onClick={() => {
                setEngineMode('live_gemini');
                if (selectedModel !== 'gemini-3.7-flash' && selectedModel !== 'gemini-2.5-pro') {
                  setSelectedModel('gemini-3.7-flash');
                }
              }}
              className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                engineMode === 'live_gemini'
                  ? 'border-cyan-500/80 bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center space-x-1.5 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                <span className="text-xs font-bold text-slate-100">Live Gemini</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                High-speed Gemini 2.5 Flash with automatic multi-key rotation pool.
              </p>
            </div>

            <div
              onClick={() => {
                setEngineMode('live_nim');
                setSelectedModel('moonshotai/kimi-k3');
              }}
              className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                engineMode === 'live_nim'
                  ? 'border-indigo-500/80 bg-indigo-950/20 shadow-[0_0_15px_rgba(99,102,241,0.15)]'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center space-x-1.5 mb-1">
                <Layers className="h-3.5 w-3.5 text-indigo-400" />
                <span className="text-xs font-bold text-slate-100">Live NVIDIA NIM</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Streams reasoning from Kimi-K3 / Nemotron on NVIDIA NIM.
              </p>
            </div>

            <div
              onClick={() => setEngineMode('simulator')}
              className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                engineMode === 'simulator'
                  ? 'border-emerald-500/80 bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                  : 'border-slate-800 bg-slate-900/60 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center space-x-1.5 mb-1">
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-bold text-slate-100">Zero-Key Simulator</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-tight">
                Runs pre-seeded 3-agent swarm in &lt;50ms. Zero keys required.
              </p>
            </div>
          </div>
        </div>

        {/* Model Selection */}
        <div>
          <label className="block text-xs font-bold text-slate-300 uppercase font-mono mb-1.5">
            Active Frontier Model
          </label>
          <div className="space-y-1.5">
            {models.map((m) => (
              <div
                key={m.id}
                onClick={() => setSelectedModel(m.id)}
                className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer transition-colors ${
                  selectedModel === m.id
                    ? 'border-cyan-500/60 bg-slate-900 text-cyan-300'
                    : 'border-slate-800 bg-slate-950/40 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <Cpu className="h-4 w-4 text-cyan-400" />
                  <div>
                    <div className="text-xs font-semibold text-slate-200">{m.name}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{m.id}</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300">
                  {m.tag}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Google Gemini Multi-Key Rotation Pool */}
        {engineMode === 'live_gemini' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase font-mono flex items-center space-x-1.5">
                <RefreshCw className="h-3 w-3 text-cyan-400" />
                <span>Google API Key Rotation Pool (1 per line)</span>
              </label>
              <span className="text-[10px] text-cyan-400 font-mono">
                {googleApiKeys.length} Keys Active in Pool
              </span>
            </div>

            <textarea
              rows={3}
              placeholder="AIzaSyA1ZP...&#10;AIzaSyDrdn...&#10;AIzaSyDFSU..."
              value={inputGeminiKeys}
              onChange={(e) => setInputGeminiKeys(e.target.value)}
              className="w-full p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-600 outline-none focus:border-cyan-500/50"
            />
            <p className="text-[10px] text-slate-500 mt-1">
              CloudSwarm automatically rotates across these keys in round-robin and fails over instantly if any key hits a rate limit (HTTP 429).
            </p>
          </div>
        )}

        {/* NVIDIA NIM Key Input */}
        {engineMode === 'live_nim' && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-bold text-slate-300 uppercase font-mono">
                NVIDIA NIM API Key
              </label>
              <span className="text-[10px] text-slate-500 font-mono">OpenAI-Compatible</span>
            </div>

            <div className="relative flex items-center">
              <KeyRound className="absolute left-3 h-4 w-4 text-slate-500" />
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="nvapi-..."
                value={inputNimKey}
                onChange={(e) => setInputNimKey(e.target.value)}
                className="w-full pl-9 pr-20 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-slate-100 placeholder-slate-600 outline-none focus:border-indigo-500/50"
              />
              <div className="absolute right-2 flex items-center space-x-1">
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="p-1 text-slate-400 hover:text-slate-200"
                >
                  {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Test Connection Button & Status */}
        <div className="flex items-center justify-between pt-1">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleTestConnection}
            disabled={testStatus === 'testing'}
            leftIcon={<Radio className="h-3.5 w-3.5 text-cyan-400" />}
          >
            <span>{testStatus === 'testing' ? 'Testing Pool Connection...' : 'Test Key Pool'}</span>
          </Button>

          {testStatus === 'success' && (
            <div className="flex items-center space-x-1 text-xs font-mono text-emerald-400">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className="truncate max-w-[280px]">{testMessage}</span>
            </div>
          )}

          {testStatus === 'error' && (
            <div className="flex items-center space-x-1 text-xs font-mono text-rose-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="truncate max-w-[280px]">{testMessage || 'Connection Failed'}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
